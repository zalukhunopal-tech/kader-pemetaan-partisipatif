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
 * Membaca buffer biner berkas MBTiles (basis data SQLite 3) dan mengekstrak:
 * - Sistem Koordinat (standar MBTiles: EPSG:3857 Web Mercator dengan batas EPSG:4326 WGS 84)
 * - Batas Bounding Box (minLng, minLat, maxLng, maxLat) dari tabel metadata atau indeks tile
 * - Titik pusat (center) dan rentang zoom (minzoom, maxzoom)
 */
export function parseMBTilesBuffer(buffer: ArrayBuffer | Uint8Array): HasilDeteksiMBTiles | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 100) return null;

  // 1. Validasi Header SQLite 3
  // "SQLite format 3\0" = 16 bytes
  const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
  for (let i = 0; i < 16; i++) {
    if (bytes[i] !== magic[i]) return null;
  }

  // 2. Baca teks dari cuplikan buffer untuk mendeteksi rekaman tabel metadata
  // SQLite menyimpan teks record tabel dalam UTF-8 tanpa enkripsi
  const maxRead = Math.min(bytes.length, 1024 * 1024); // Maks 1 MB
  let teks = "";
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    teks = decoder.decode(bytes.subarray(0, maxRead));
  } catch {
    // Fallback string konversi manual
    for (let i = 0; i < maxRead; i++) {
      const b = bytes[i];
      if (b >= 32 && b <= 126) {
        teks += String.fromCharCode(b);
      } else {
        teks += " ";
      }
    }
  }

  // 3. Ekstrak metadata: bounds, center, minzoom, maxzoom, format, name, crs/srs
  let minLng: number | null = null;
  let minLat: number | null = null;
  let maxLng: number | null = null;
  let maxLat: number | null = null;

  // Pola A: metadata 'bounds' -> "minLng,minLat,maxLng,maxLat"
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

  // Pola B: metadata 'center' -> "lng,lat,zoom"
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

  // Pola C: minzoom & maxzoom
  let zoomMin = 0;
  let zoomMax = 18;
  const matchMinZoom = teks.match(/minzoom['"]?\s*[,:]\s*['"]?(\d+)/i);
  if (matchMinZoom) zoomMin = parseInt(matchMinZoom[1], 10);
  const matchMaxZoom = teks.match(/maxzoom['"]?\s*[,:]\s*['"]?(\d+)/i);
  if (matchMaxZoom) zoomMax = parseInt(matchMaxZoom[1], 10);

  // Pola D: nama dan format
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

  // Pola E: CRS / SRS kustom jika ada
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

  // Jika bounds tidak ditemukan tapi center ada, estimasi bounding box di sekitar center berdasarkan zoom
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
