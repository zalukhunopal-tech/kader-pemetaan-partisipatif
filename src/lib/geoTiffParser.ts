import { konversiUtmKeWgs84, konversiWebMercatorKeWgs84 } from "./geoUtils";

export interface HasilDeteksiGeoTiff {
  crs: string;
  crsDeskripsi: string;
  crsEpsg?: number;
  tipeCrs: "projected" | "geographic" | "unknown";
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  pusatLat: number;
  pusatLng: number;
  lebarPixel: number;
  tinggiPixel: number;
  resolusiMeter?: number;
}

// Tag TIFF standar & GeoTIFF
const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_LENGTH = 257;
const TAG_MODEL_PIXEL_SCALE = 33550;
const TAG_MODEL_TIEPOINT = 33922;
const TAG_MODEL_TRANSFORMATION = 34264;
const TAG_GEO_KEY_DIRECTORY = 34735;
const TAG_GEO_DOUBLE_PARAMS = 34736;
const TAG_GEO_ASCII_PARAMS = 34737;

// GeoKey IDs
const GEOKEY_GT_MODEL_TYPE = 1024;
const GEOKEY_GEOGRAPHIC_TYPE = 2048;
const GEOKEY_GEOG_CITATION = 2049;
const GEOKEY_PROJECTED_CS_TYPE = 3072;
const GEOKEY_PCS_CITATION = 3073;
const GEOKEY_PROJ_NAT_ORIGIN_LONG = 3080;

/**
 * Membaca buffer biner GeoTIFF (Little Endian atau Big Endian) dan mengekstrak:
 * - Sistem Koordinat Referensi (CRS: WGS 84, UTM Zona 1-60 N/S, Web Mercator, DGN95)
 * - Bounding box geografis terhitung (minLat, maxLat, minLng, maxLng)
 * - Dimensi gambar raster (lebar & tinggi pixel)
 */
export function parseGeoTiffBuffer(buffer: ArrayBuffer | Uint8Array): HasilDeteksiGeoTiff | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 16) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // 1. Cek tanda tangan endianness
  let littleEndian = false;
  if (bytes[0] === 0x49 && bytes[1] === 0x49) {
    littleEndian = true; // "II" Intel Little Endian
  } else if (bytes[0] === 0x4d && bytes[1] === 0x4d) {
    littleEndian = false; // "MM" Motorola Big Endian
  } else {
    return null; // Bukan berkas TIFF
  }

  // 2. Cek nomor versi TIFF
  const magic = view.getUint16(2, littleEndian);
  const isBigTiff = magic === 43;
  if (magic !== 42 && !isBigTiff) {
    return null; // Bukan format TIFF standar atau BigTIFF
  }

  // 3. Baca offset IFD pertama
  let ifdOffset: number;
  if (isBigTiff) {
    if (bytes.length < 16) return null;
    const offsetSize = view.getUint16(4, littleEndian);
    if (offsetSize !== 8) return null;
    ifdOffset = Number(view.getBigUint64(8, littleEndian));
  } else {
    ifdOffset = view.getUint32(4, littleEndian);
  }

  if (ifdOffset < 8 || ifdOffset + 2 > bytes.length) return null;

  // 4. Baca entri IFD
  const numEntries = isBigTiff
    ? Number(view.getBigUint64(ifdOffset, littleEndian))
    : view.getUint16(ifdOffset, littleEndian);

  let curOffset = ifdOffset + (isBigTiff ? 8 : 2);
  const entrySize = isBigTiff ? 20 : 12;

  let imageWidth = 0;
  let imageLength = 0;
  let pixelScale: number[] | null = null;
  let tiepoint: number[] | null = null;
  let modelTransform: number[] | null = null;
  let geoKeyDirRaw: number[] | null = null;
  let geoDoubleParams: number[] | null = null;
  let geoAsciiParams = "";

  // Helper membaca nilai berdasarkan tipe TIFF
  function bacaNilaiTag(tipe: number, count: number, valOffset: number): string | number[] | null {
    if (valOffset + count > bytes.length && tipe !== 3 && tipe !== 4) return null;
    switch (tipe) {
      case 2: {
        // ASCII
        let s = "";
        for (let i = 0; i < count; i++) {
          const c = bytes[valOffset + i];
          if (c === 0) break;
          s += String.fromCharCode(c);
        }
        return s;
      }
      case 3: {
        // SHORT (uint16)
        const arr: number[] = [];
        for (let i = 0; i < count; i++) {
          const off = count === 1 ? valOffset : valOffset + i * 2;
          if (off + 2 <= bytes.length) {
            arr.push(view.getUint16(off, littleEndian));
          }
        }
        return arr;
      }
      case 4: {
        // LONG (uint32)
        const arr: number[] = [];
        for (let i = 0; i < count; i++) {
          const off = count === 1 ? valOffset : valOffset + i * 4;
          if (off + 4 <= bytes.length) {
            arr.push(view.getUint32(off, littleEndian));
          }
        }
        return arr;
      }
      case 12: {
        // DOUBLE (float64)
        const arr: number[] = [];
        for (let i = 0; i < count; i++) {
          const off = valOffset + i * 8;
          if (off + 8 <= bytes.length) {
            arr.push(view.getFloat64(off, littleEndian));
          }
        }
        return arr;
      }
      default:
        return null;
    }
  }

  for (let i = 0; i < numEntries; i++) {
    if (curOffset + entrySize > bytes.length) break;

    const tag = view.getUint16(curOffset, littleEndian);
    const tipe = view.getUint16(curOffset + 2, littleEndian);
    const count = isBigTiff
      ? Number(view.getBigUint64(curOffset + 4, littleEndian))
      : view.getUint32(curOffset + 4, littleEndian);

    const valOffsetRaw = isBigTiff
      ? Number(view.getBigUint64(curOffset + 12, littleEndian))
      : view.getUint32(curOffset + 8, littleEndian);

    // Hitung apakah nilai tersimpan inline
    const tipeSize = tipe === 12 ? 8 : tipe === 4 || tipe === 11 ? 4 : tipe === 3 ? 2 : 1;
    const totalBytes = count * tipeSize;
    const isInline = !isBigTiff && totalBytes <= 4;
    const offsetUntukBaca = isInline ? curOffset + 8 : valOffsetRaw;

    if (tag === TAG_IMAGE_WIDTH) {
      const v = bacaNilaiTag(tipe, 1, offsetUntukBaca);
      imageWidth = Array.isArray(v) ? v[0] : Number(v) || 0;
    } else if (tag === TAG_IMAGE_LENGTH) {
      const v = bacaNilaiTag(tipe, 1, offsetUntukBaca);
      imageLength = Array.isArray(v) ? v[0] : Number(v) || 0;
    } else if (tag === TAG_MODEL_PIXEL_SCALE) {
      const v = bacaNilaiTag(tipe, count, offsetUntukBaca);
      pixelScale = Array.isArray(v) ? v : null;
    } else if (tag === TAG_MODEL_TIEPOINT) {
      const v = bacaNilaiTag(tipe, count, offsetUntukBaca);
      tiepoint = Array.isArray(v) ? v : null;
    } else if (tag === TAG_MODEL_TRANSFORMATION) {
      const v = bacaNilaiTag(tipe, count, offsetUntukBaca);
      modelTransform = Array.isArray(v) ? v : null;
    } else if (tag === TAG_GEO_KEY_DIRECTORY) {
      const v = bacaNilaiTag(tipe, count, offsetUntukBaca);
      geoKeyDirRaw = Array.isArray(v) ? v : null;
    } else if (tag === TAG_GEO_DOUBLE_PARAMS) {
      const v = bacaNilaiTag(tipe, count, offsetUntukBaca);
      geoDoubleParams = Array.isArray(v) ? v : null;
    } else if (tag === TAG_GEO_ASCII_PARAMS) {
      const v = bacaNilaiTag(tipe, count, offsetUntukBaca);
      geoAsciiParams = typeof v === "string" ? v : "";
    }

    curOffset += entrySize;
  }

  // 5. Parse GeoKeys
  const geoKeys: Record<number, number | string> = {};
  if (geoKeyDirRaw && geoKeyDirRaw.length >= 4) {
    const numKeys = geoKeyDirRaw[3];
    for (let k = 0; k < numKeys; k++) {
      const idx = 4 + k * 4;
      if (idx + 3 >= geoKeyDirRaw.length) break;
      const keyId = geoKeyDirRaw[idx];
      const tagLoc = geoKeyDirRaw[idx + 1];
      const count = geoKeyDirRaw[idx + 2];
      const valOffset = geoKeyDirRaw[idx + 3];

      if (tagLoc === 0) {
        // Nilai SHORT langsung
        geoKeys[keyId] = valOffset;
      } else if (tagLoc === TAG_GEO_DOUBLE_PARAMS && geoDoubleParams) {
        if (valOffset < geoDoubleParams.length) {
          geoKeys[keyId] = geoDoubleParams[valOffset];
        }
      } else if (tagLoc === TAG_GEO_ASCII_PARAMS && geoAsciiParams) {
        const str = geoAsciiParams.slice(valOffset, valOffset + count).replace(/\|/g, "").trim();
        geoKeys[keyId] = str;
      }
    }
  }

  // 6. Tentukan Sistem Koordinat (CRS)
  let crs = "WGS 84 (EPSG:4326)";
  let crsDeskripsi = "Sistem Koordinat Geografis WGS 84";
  let crsEpsg: number | undefined = undefined;
  let tipeCrs: "projected" | "geographic" | "unknown" = "unknown";

  const pcsType = geoKeys[GEOKEY_PROJECTED_CS_TYPE] as number | undefined;
  const gcsType = geoKeys[GEOKEY_GEOGRAPHIC_TYPE] as number | undefined;
  const modelType = geoKeys[GEOKEY_GT_MODEL_TYPE] as number | undefined;
  const pcsCitation = (geoKeys[GEOKEY_PCS_CITATION] as string) || "";
  const gcsCitation = (geoKeys[GEOKEY_GEOG_CITATION] as string) || "";

  if (pcsType && pcsType > 0 && pcsType !== 32767) {
    tipeCrs = "projected";
    crsEpsg = pcsType;
    if (pcsType >= 32601 && pcsType <= 32660) {
      const zona = pcsType - 32600;
      crs = `EPSG:${pcsType} (WGS 84 / UTM Zone ${zona}N)`;
      crsDeskripsi = pcsCitation || `WGS 84 / UTM Zona ${zona} Utara (Universal Transverse Mercator)`;
    } else if (pcsType >= 32701 && pcsType <= 32760) {
      const zona = pcsType - 32700;
      crs = `EPSG:${pcsType} (WGS 84 / UTM Zone ${zona}S)`;
      crsDeskripsi = pcsCitation || `WGS 84 / UTM Zona ${zona} Selatan (Universal Transverse Mercator)`;
    } else if (pcsType === 3857 || pcsType === 900913 || pcsType === 102100) {
      crs = "EPSG:3857 (Web Mercator / Pseudo-Mercator)";
      crsDeskripsi = "WGS 84 / Web Mercator (Auxiliary Sphere)";
    } else if (pcsType >= 23830 && pcsType <= 23854) {
      crs = `EPSG:${pcsType} (DGN95 / Indonesia TM-3)`;
      crsDeskripsi = pcsCitation || `Datum Geodesi Nasional 1995 / TM-3 Indonesia`;
    } else {
      crs = `EPSG:${pcsType}`;
      crsDeskripsi = pcsCitation || `Projected Coordinate System EPSG:${pcsType}`;
    }
  } else if (gcsType && gcsType > 0) {
    tipeCrs = "geographic";
    crsEpsg = gcsType;
    if (gcsType === 4326) {
      crs = "EPSG:4326 (WGS 84)";
      crsDeskripsi = "WGS 84 (World Geodetic System 1984)";
    } else if (gcsType === 4763) {
      crs = "EPSG:4763 (DGN95)";
      crsDeskripsi = "Datum Geodesi Nasional 1995 (Indonesia)";
    } else {
      crs = `EPSG:${gcsType}`;
      crsDeskripsi = gcsCitation || `Geographic CRS EPSG:${gcsType}`;
    }
  } else if (modelType === 1) {
    // Model projected tapi EPSG user-defined (32767)
    tipeCrs = "projected";
    const natLon = geoKeys[GEOKEY_PROJ_NAT_ORIGIN_LONG] as number | undefined;
    if (typeof natLon === "number") {
      const zona = Math.min(60, Math.floor((natLon + 180) / 6) + 1);
      crs = `WGS 84 / UTM Zone ${zona}N (Meridian Tengah ${natLon}°)`;
      crsDeskripsi = pcsCitation || `Proyeksi Transverse Mercator dengan meridian tengah ${natLon}°`;
      crsEpsg = 32600 + zona;
    } else {
      crs = pcsCitation || "Projected CRS";
      crsDeskripsi = "Projected Coordinate System";
    }
  } else if (modelType === 2) {
    tipeCrs = "geographic";
    crs = "EPSG:4326 (WGS 84)";
    crsDeskripsi = gcsCitation || "WGS 84 Geografis";
    crsEpsg = 4326;
  }

  // 7. Hitung Bounding Box (Model Coordinates)
  let minModelX: number;
  let maxModelX: number;
  let minModelY: number;
  let maxModelY: number;

  const w = imageWidth || 1000;
  const h = imageLength || 1000;

  if (pixelScale && pixelScale.length >= 2 && tiepoint && tiepoint.length >= 6) {
    const sx = pixelScale[0];
    const sy = pixelScale[1];
    const tpi = tiepoint[0];
    const tpj = tiepoint[1];
    const tpx = tiepoint[3];
    const tpy = tiepoint[4];

    // Model X & Y untuk 4 sudut raster
    const xUl = tpx - tpi * sx;
    const yUl = tpy + tpj * sy;
    const xLr = xUl + w * sx;
    const yLr = yUl - h * sy;

    minModelX = Math.min(xUl, xLr);
    maxModelX = Math.max(xUl, xLr);
    minModelY = Math.min(yUl, yLr);
    maxModelY = Math.max(yUl, yLr);
  } else if (modelTransform && modelTransform.length >= 16) {
    // Menggunakan matriks transformasi affine 4x4
    const m = modelTransform;
    const corners = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h]
    ];
    const xs = corners.map(([i, j]) => m[0] * i + m[1] * j + m[3]);
    const ys = corners.map(([i, j]) => m[4] * i + m[5] * j + m[7]);
    minModelX = Math.min(...xs);
    maxModelX = Math.max(...xs);
    minModelY = Math.min(...ys);
    maxModelY = Math.max(...ys);
  } else {
    // Tidak ada georeferensi yang valid di berkas TIFF ini
    return null;
  }

  // 8. Transformasi koordinat model ke WGS 84 geografis (Lat, Lng)
  let minLat: number;
  let maxLat: number;
  let minLng: number;
  let maxLng: number;

  // Deteksi otomatis jika koordinat model sudah dalam derajat geografis
  const tampakGeografis =
    minModelX >= -180 && maxModelX <= 180 && minModelY >= -90 && maxModelY <= 90;

  if (tipeCrs === "geographic" || tampakGeografis) {
    minLng = Number(minModelX.toFixed(7));
    maxLng = Number(maxModelX.toFixed(7));
    minLat = Number(minModelY.toFixed(7));
    maxLat = Number(maxModelY.toFixed(7));
    if (tipeCrs === "unknown") {
      tipeCrs = "geographic";
      crs = "EPSG:4326 (WGS 84 Geografis)";
      crsDeskripsi = "WGS 84 (Derajat Desimal)";
      crsEpsg = 4326;
    }
  } else if (crsEpsg && ((crsEpsg >= 32601 && crsEpsg <= 32660) || (crsEpsg >= 32701 && crsEpsg <= 32760))) {
    // UTM Zone
    const isNorth = crsEpsg <= 32660;
    const zona = isNorth ? crsEpsg - 32600 : crsEpsg - 32700;
    const sudut = [
      konversiUtmKeWgs84(minModelX, minModelY, zona, isNorth ? "N" : "S"),
      konversiUtmKeWgs84(minModelX, maxModelY, zona, isNorth ? "N" : "S"),
      konversiUtmKeWgs84(maxModelX, minModelY, zona, isNorth ? "N" : "S"),
      konversiUtmKeWgs84(maxModelX, maxModelY, zona, isNorth ? "N" : "S")
    ];
    minLat = Number(Math.min(...sudut.map((p) => p.lat)).toFixed(7));
    maxLat = Number(Math.max(...sudut.map((p) => p.lat)).toFixed(7));
    minLng = Number(Math.min(...sudut.map((p) => p.lng)).toFixed(7));
    maxLng = Number(Math.max(...sudut.map((p) => p.lng)).toFixed(7));
  } else if (crsEpsg === 3857 || (Math.abs(minModelX) > 200 && Math.abs(minModelY) > 200 && Math.abs(minModelX) < 20037509)) {
    // Web Mercator
    const sudut = [
      konversiWebMercatorKeWgs84(minModelX, minModelY),
      konversiWebMercatorKeWgs84(minModelX, maxModelY),
      konversiWebMercatorKeWgs84(maxModelX, minModelY),
      konversiWebMercatorKeWgs84(maxModelX, maxModelY)
    ];
    minLat = Number(Math.min(...sudut.map((p) => p.lat)).toFixed(7));
    maxLat = Number(Math.max(...sudut.map((p) => p.lat)).toFixed(7));
    minLng = Number(Math.min(...sudut.map((p) => p.lng)).toFixed(7));
    maxLng = Number(Math.max(...sudut.map((p) => p.lng)).toFixed(7));
    if (tipeCrs === "unknown") {
      tipeCrs = "projected";
      crs = "EPSG:3857 (Web Mercator)";
      crsDeskripsi = "WGS 84 / Pseudo-Mercator";
      crsEpsg = 3857;
    }
  } else {
    // Default fallback: validasi jika koordinat masuk akal
    minLng = Number(minModelX.toFixed(7));
    maxLng = Number(maxModelX.toFixed(7));
    minLat = Number(minModelY.toFixed(7));
    maxLat = Number(maxModelY.toFixed(7));
  }

  // Hitung pusat peta
  const pusatLat = Number(((minLat + maxLat) / 2).toFixed(7));
  const pusatLng = Number(((minLng + maxLng) / 2).toFixed(7));

  return {
    crs,
    crsDeskripsi,
    crsEpsg,
    tipeCrs,
    minLat,
    maxLat,
    minLng,
    maxLng,
    pusatLat,
    pusatLng,
    lebarPixel: w,
    tinggiPixel: h,
    resolusiMeter: pixelScale ? Number(pixelScale[0].toFixed(2)) : undefined
  };
}
