import { dapatkanSqlJs } from "./mbtilesProtocol";

export interface HasilDeteksiMBTiles {
  crs: string;
  crsDeskripsi: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  pusatLat: number;
  pusatLng: number;
  zoomMin: number;
  zoomMax: number;
  format?: string;
  namaArea?: string;
  tileType?: "vector" | "raster" | "unknown";
}

/**
 * Konversi indeks koordinat tile slippy/TMS ke derajat bujur WGS84
 */
export function tileKeBujur(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

/**
 * Konversi indeks koordinat tile slippy/TMS ke derajat lintang WGS84
 */
export function tileKeLintang(yXyz: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * yXyz) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Membaca buffer biner MBTiles melalui WebAssembly SQL.js secara utuh
 * Query metadata dan tiles table dengan konversi TMS y: tmsY = (1 << z) - 1 - y
 */
export async function parseMBTilesSqlWasm(
  buffer: ArrayBuffer | Uint8Array,
  namaFallback = "Peta MBTiles"
): Promise<HasilDeteksiMBTiles | null> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 100) return null;

  // Header SQLite 3
  const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
  for (let i = 0; i < 16; i++) {
    if (bytes[i] !== magic[i]) return null;
  }

  try {
    const SQL = await dapatkanSqlJs();
    const db = new SQL.Database(bytes);

    try {
      const metadataMap: Record<string, string> = {};
      const res = db.exec("SELECT name, value FROM metadata");
      if (res.length > 0) {
        for (const row of res[0].values) {
          if (row[0] && row[1]) {
            metadataMap[String(row[0]).toLowerCase()] = String(row[1]);
          }
        }
      }

      const namaArea = metadataMap.name || namaFallback;
      let rawFormat = (metadataMap.format || "").toLowerCase();
      let tileType: "vector" | "raster" | "unknown" = "unknown";

      if (rawFormat === "pbf" || rawFormat === "mvt" || metadataMap.type === "vector") {
        rawFormat = "pbf";
        tileType = "vector";
      } else if (["png", "jpg", "jpeg", "webp"].includes(rawFormat)) {
        tileType = "raster";
      }

      let minLng: number | null = null;
      let minLat: number | null = null;
      let maxLng: number | null = null;
      let maxLat: number | null = null;

      // 1. Coba baca bounds dari metadata
      if (metadataMap.bounds) {
        const bParts = metadataMap.bounds.split(",").map((v) => parseFloat(v.trim()));
        if (bParts.length >= 4 && !bParts.some(isNaN)) {
          minLng = Number(Math.max(-180, Math.min(180, bParts[0])).toFixed(6));
          minLat = Number(Math.max(-85.0511, Math.min(85.0511, bParts[1])).toFixed(6));
          maxLng = Number(Math.max(-180, Math.min(180, bParts[2])).toFixed(6));
          maxLat = Number(Math.max(-85.0511, Math.min(85.0511, bParts[3])).toFixed(6));
        }
      }

      // 2. Jika bounds tidak ada di metadata, query tabel tiles langsung!
      if (minLng === null || minLat === null || maxLng === null || maxLat === null) {
        try {
          const tileStats = db.exec(
            "SELECT min(zoom_level), max(zoom_level), min(tile_column), max(tile_column), min(tile_row), max(tile_row) FROM tiles"
          );
          if (tileStats.length > 0 && tileStats[0].values.length > 0) {
            const row = tileStats[0].values[0];
            const minZ = Number(row[0]);
            const maxZ = Number(row[1]);
            const minCol = Number(row[2]);
            const maxCol = Number(row[3]);
            const minRow = Number(row[4]);
            const maxRow = Number(row[5]);

            if (!isNaN(minZ) && !isNaN(minCol) && !isNaN(maxCol)) {
              minLng = Number(tileKeBujur(minCol, minZ).toFixed(6));
              maxLng = Number(tileKeBujur(maxCol + 1, minZ).toFixed(6));
              // TMS to XYZ Y
              const yTop = (1 << minZ) - 1 - maxRow;
              const yBottom = (1 << minZ) - 1 - minRow;
              maxLat = Number(tileKeLintang(yTop, minZ).toFixed(6));
              minLat = Number(tileKeLintang(yBottom + 1, minZ).toFixed(6));
            }
          }
        } catch {
          // Abaikan jika query tiles gagal
        }
      }

      let zoomMin = parseInt(metadataMap.minzoom || "0", 10);
      let zoomMax = parseInt(metadataMap.maxzoom || "18", 10);
      if (isNaN(zoomMin)) zoomMin = 0;
      if (isNaN(zoomMax)) zoomMax = 18;

      let pusatLng = Number(((minLng! + maxLng!) / 2).toFixed(6));
      let pusatLat = Number(((minLat! + maxLat!) / 2).toFixed(6));

      if (metadataMap.center) {
        const cParts = metadataMap.center.split(",").map((v) => parseFloat(v.trim()));
        if (cParts.length >= 2 && !isNaN(cParts[0]) && !isNaN(cParts[1])) {
          pusatLng = Number(cParts[0].toFixed(6));
          pusatLat = Number(cParts[1].toFixed(6));
        }
      }

      if (minLng !== null && minLat !== null && maxLng !== null && maxLat !== null) {
        return {
          namaArea,
          crs: "EPSG:3857 / EPSG:4326 (WGS 84)",
          crsDeskripsi: `MBTiles SQLite (${tileType.toUpperCase()} - ${rawFormat.toUpperCase() || "TILE"})`,
          minLng,
          minLat,
          maxLng,
          maxLat,
          pusatLng,
          pusatLat,
          zoomMin,
          zoomMax,
          format: rawFormat || undefined,
          tileType
        };
      }
    } finally {
      db.close();
    }
  } catch (err) {
    // Fallback ke parser buffer teks bila SQL.js belum siap
  }

  return parseMBTilesBuffer(buffer);
}

/**
 * Membaca buffer biner berkas MBTiles (basis data SQLite 3) dan mengekstrak:
 * - Sistem Koordinat (standar MBTiles: EPSG:3857 Web Mercator dengan batas EPSG:4326 WGS 84)
 * - Batas Bounding Box (minLng, minLat, maxLng, maxLat) dari tabel metadata atau indeks tile
 * - Titik pusat (center) dan rentang zoom (minzoom, maxzoom)
 */
export function parseMBTilesBuffer(buffer: ArrayBuffer | Uint8Array): HasilDeteksiMBTiles | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 100) return null;

  // 1. Validasi Header SQLite 3
  const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
  for (let i = 0; i < 16; i++) {
    if (bytes[i] !== magic[i]) return null;
  }

  // 2. Baca teks dari buffer untuk mendeteksi rekaman tabel metadata
  const maxRead = Math.min(bytes.length, 1024 * 1024);
  let teks = "";
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    teks = decoder.decode(bytes.subarray(0, maxRead));
  } catch {
    for (let i = 0; i < maxRead; i++) {
      const b = bytes[i];
      teks += b >= 32 && b <= 126 ? String.fromCharCode(b) : " ";
    }
  }

  // 3. Ekstrak metadata: bounds, center, minzoom, maxzoom, format, name, crs/srs
  let minLng: number | null = null;
  let minLat: number | null = null;
  let maxLng: number | null = null;
  let maxLat: number | null = null;

  const polaBounds = /bounds['"]?\s*[,:]\s*['"]?\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i;
  const matchBounds = teks.match(polaBounds);
  if (matchBounds) {
    const w = parseFloat(matchBounds[1]);
    const s = parseFloat(matchBounds[2]);
    const e = parseFloat(matchBounds[3]);
    const n = parseFloat(matchBounds[4]);
    if (w >= -180 && e <= 180 && s >= -90 && n <= 90 && w <= e && s <= n) {
      minLng = w;
      minLat = s;
      maxLng = e;
      maxLat = n;
    }
  }

  let pusatLat: number | null = null;
  let pusatLng: number | null = null;
  let zoomAwal: number | null = null;
  const polaCenter = /center['"]?\s*[,:]\s*['"]?\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*(?:,\s*(\d+))?/i;
  const matchCenter = teks.match(polaCenter);
  if (matchCenter) {
    const cLng = parseFloat(matchCenter[1]);
    const cLat = parseFloat(matchCenter[2]);
    if (cLng >= -180 && cLng <= 180 && cLat >= -90 && cLat <= 90) {
      pusatLng = cLng;
      pusatLat = cLat;
      if (matchCenter[3]) zoomAwal = parseInt(matchCenter[3], 10);
    }
  }

  let zoomMin = 0;
  let zoomMax = 18;
  const matchMinZoom = teks.match(/minzoom['"]?\s*[,:]\s*['"]?(\d+)/i);
  if (matchMinZoom) zoomMin = parseInt(matchMinZoom[1], 10);
  const matchMaxZoom = teks.match(/maxzoom['"]?\s*[,:]\s*['"]?(\d+)/i);
  if (matchMaxZoom) zoomMax = parseInt(matchMaxZoom[1], 10);

  let namaArea: string | undefined = undefined;
  const matchName = teks.match(/name['"]?\s*[,:]\s*['"]?([^'",;\n\r]+)/i);
  if (matchName) {
    const n = matchName[1].trim();
    if (n && n.length > 2 && !/^(text|varchar|integer|real|table|metadata)$/i.test(n)) {
      namaArea = n;
    }
  }

  let format: string | undefined = undefined;
  const matchFormat = teks.match(/format['"]?\s*[,:]\s*['"]?(pbf|png|jpg|jpeg|webp)/i);
  if (matchFormat) format = matchFormat[1].toLowerCase();

  let crs = "EPSG:3857 / EPSG:4326 (WGS 84)";
  let crsDeskripsi = "Tiles Spherical Mercator (EPSG:3857) dengan batas koordinat WGS 84 (EPSG:4326)";
  const matchCrs = teks.match(/(?:crs|srs)['"]?\s*[,:]\s*['"]?([^'",;\n\r]+)/i);
  if (matchCrs) {
    const rawCrs = matchCrs[1].trim();
    if (rawCrs.length > 3 && !/^(text|null)$/i.test(rawCrs)) {
      crs = rawCrs;
      crsDeskripsi = `Definisi CRS Khusus MBTiles: ${rawCrs}`;
    }
  }

  if ((minLng === null || minLat === null || maxLng === null || maxLat === null) && pusatLat !== null && pusatLng !== null) {
    const rentangDerajat = Math.max(0.02, 360 / Math.pow(2, zoomAwal ?? 12));
    minLng = Number((pusatLng - rentangDerajat / 2).toFixed(7));
    maxLng = Number((pusatLng + rentangDerajat / 2).toFixed(7));
    minLat = Number((pusatLat - rentangDerajat / 2).toFixed(7));
    maxLat = Number((pusatLat + rentangDerajat / 2).toFixed(7));
  }

  if (minLng === null || minLat === null || maxLng === null || maxLat === null) {
    return null;
  }

  if (pusatLat === null || pusatLng === null) {
    pusatLat = Number(((minLat + maxLat) / 2).toFixed(7));
    pusatLng = Number(((minLng + maxLng) / 2).toFixed(7));
  }

  return {
    crs,
    crsDeskripsi,
    minLat,
    maxLat,
    minLng,
    maxLng,
    pusatLat,
    pusatLng,
    zoomMin,
    zoomMax,
    format,
    namaArea
  };
}
