import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString } from "pdf-lib";
import proj4 from "proj4";

export interface TitikGeo {
  lat: number;
  lon: number;
}

export interface TitikPdf {
  x: number;
  y: number;
}

export interface KotakViewport {
  xMin: number;
  yMin: number;
  xMaks: number;
  yMaks: number;
}

export type FormatGeorefPdf = "iso32000" | "ogc-lgi" | "manual";
export type MetodeTransformasi = "afin-proyeksi" | "afin-geografis" | "homografi";

export interface ViewportGeo {
  nama: string;
  format: FormatGeorefPdf;
  kotak: KotakViewport;
  /** Poligon batas dalam koordinat ruang pengguna PDF (pt) */
  batasPdf: TitikPdf[];
  /** Pasangan titik ikat: titik PDF (pt) <-> koordinat geografis WGS84 */
  titikIkat: { pdf: TitikPdf; geo: TitikGeo; proyeksi?: { x: number; y: number } }[];
  crs: string | null;
  wkt: string | null;
  epsg: number | null;
  /** Matriks CTM 6 angka dari LGIDict jika ada: [a,b,c,d,e,f] memetakan PDF pt -> koordinat proyeksi */
  ctm?: [number, number, number, number, number, number];
}

export interface GeoreferensiPdf {
  indeksHalaman: number;
  lebarPt: number;
  tinggiPt: number;
  viewport: ViewportGeo[];
  utama: ViewportGeo;
}

export interface TransformasiGeoref {
  pdfKeGeo: (xPt: number, yPt: number) => TitikGeo | null;
  geoKePdf: (lat: number, lon: number) => TitikPdf | null;
  metode: MetodeTransformasi;
  crsProyeksi: string | null;
  /** Galat maksimum (meter) pada titik ikat, sebagai indikator kualitas */
  sisaMeter: number;
}

export interface TitikKontrolGeoPdf {
  /** Koordinat lokal ternormalisasi (0..1) di dalam BBox PDF */
  u: number;
  v: number;
  /** Koordinat geografis atau terproyeksi (X/Bujur, Y/Lintang) */
  x: number;
  y: number;
}

export interface TransformasiAffineGeoPdf {
  /** Matriks transformasi lokal (u, v) -> (lng, lat): x = a*u + b*v + c; y = d*u + e*v + f */
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  /** Konversi titik lokal (u, v) ke [lng, lat] */
  keGeo: (u: number, v: number) => [number, number];
  /** Konversi titik geografis (lng, lat) ke lokal [u, v] */
  keLokal: (lng: number, lat: number) => [number, number];
}

export interface ReferensiGeoPdf {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  pusatLat?: number;
  pusatLng?: number;
  /** [x1, y1, x2, y2] dalam satuan titik PDF (72 pt = 1 inci, asal kiri-bawah). */
  bbox: [number, number, number, number];
  crs?: string;
  crsDeskripsi?: string;
  /** Koordinat geografis [lng, lat] keempat sudut viewport (kiri-bawah, kiri-atas, kanan-atas, kanan-bawah) */
  empatSudut: [number, number][];
  rotasiDerajat?: number;
  affine?: TransformasiAffineGeoPdf;
  formatGeoref?: "iso32000" | "ogc-lgi" | "manual";
  metodeTransformasi?: MetodeTransformasi;
  sisaMeter?: number | null;
  indeksHalaman?: number;
  lebarPt?: number;
  tinggiPt?: number;
  batas?: TitikGeo[];
  transformasi?: TransformasiGeoref;
}

export interface HasilImporGeoPdf extends ReferensiGeoPdf {
  dataUrl: string;
  thumbnailDataUrl?: string;
  width: number;
  height: number;
}

let crsTerdaftar = false;

/**
 * Mendaftarkan seluruh zona UTM Indonesia & Global (WGS 84), Pseudo-Mercator,
 * serta DGN95 / Indonesia TM-3 (EPSG:23830 s.d. EPSG:23845) ke proj4.
 */
export function daftarkanCrsProj4(): void {
  if (crsTerdaftar) return;
  crsTerdaftar = true;

  for (let zone = 1; zone <= 60; zone++) {
    proj4.defs(`EPSG:${32600 + zone}`, `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`);
    proj4.defs(`EPSG:${32700 + zone}`, `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`);
  }

  proj4.defs(
    "EPSG:3857",
    "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs"
  );

  // DGN95 / Indonesia TM-3 (EPSG:23830 .. 23845)
  const tm3Meridian: Record<number, number> = {
    23830: 94.5,
    23831: 97.5,
    23832: 100.5,
    23833: 103.5,
    23834: 106.5,
    23835: 109.5,
    23836: 112.5,
    23837: 115.5,
    23838: 118.5,
    23839: 121.5,
    23840: 124.5,
    23841: 127.5,
    23842: 130.5,
    23843: 133.5,
    23844: 136.5,
    23845: 139.5
  };
  for (const [epsgStr, lon0] of Object.entries(tm3Meridian)) {
    proj4.defs(
      `EPSG:${epsgStr}`,
      `+proj=tmerc +lat_0=0 +lon_0=${lon0} +k=0.9999 +x_0=200000 +y_0=1500000 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`
    );
  }
}

export function definisiEpsg(kode: number): string | null {
  daftarkanCrsProj4();
  if (kode === 4326) return "EPSG:4326";
  if (kode === 3857 || kode === 900913) return "EPSG:3857";
  if ((kode >= 32601 && kode <= 32660) || (kode >= 32701 && kode <= 32760) || (kode >= 23830 && kode <= 23845)) {
    return `EPSG:${kode}`;
  }
  return null;
}

export function namaCrs(crs: string | null): string {
  if (!crs) return "WGS 84 (Geografis)";
  if (crs === "EPSG:4326") return "WGS 84 (EPSG:4326)";
  if (crs === "EPSG:3857") return "Web Mercator (EPSG:3857)";
  const mUtmU = crs.match(/^EPSG:326(\d{2})$/);
  if (mUtmU) return `WGS 84 / UTM Zona ${parseInt(mUtmU[1], 10)}N (${crs})`;
  const mUtmS = crs.match(/^EPSG:327(\d{2})$/);
  if (mUtmS) return `WGS 84 / UTM Zona ${parseInt(mUtmS[1], 10)}S (${crs})`;
  const mTm3 = crs.match(/^EPSG:(238\d{2})$/);
  if (mTm3) return `DGN95 / Indonesia TM-3 (${crs})`;
  if (crs.startsWith("PROJCS[") || crs.startsWith("GEOGCS[")) {
    const nama = crs.match(/^(?:PROJCS|GEOGCS)\["([^"]+)"/);
    if (nama) return nama[1];
  }
  return crs;
}

function siapkanCrs(epsg: number | null, wkt: string | null): string | null {
  daftarkanCrsProj4();
  if (epsg) {
    const def = definisiEpsg(epsg);
    if (def) return def;
  }
  if (wkt) {
    try {
      proj4(wkt, "EPSG:4326", [0, 0]);
      return wkt;
    } catch {
      const m = wkt.match(/UTM[_ ]zone[_ ](\d{1,2})([NS])/i);
      if (m) {
        const z = parseInt(m[1], 10);
        const arah = m[2].toUpperCase();
        const kode = arah === "N" ? 32600 + z : 32700 + z;
        return definisiEpsg(kode);
      }
      const mEpsg = wkt.match(/AUTHORITY\["EPSG"\s*,\s*"?(\d+)"?\]/i);
      if (mEpsg) {
        return definisiEpsg(parseInt(mEpsg[1], 10));
      }
    }
  }
  return null;
}

/**
 * Menyelesaikan regresi kuadrat terkecil (least-squares) transformasi Affine 2D
 * dari pasangan titik lokal (u, v) ke koordinat geografis WGS 84 (lng, lat).
 */
export function selesaikanAffine2D(titik: TitikKontrolGeoPdf[]): TransformasiAffineGeoPdf {
  const n = titik.length;
  if (n < 3) {
    throw new Error("Transformasi Affine membutuhkan minimal 3 titik kontrol.");
  }

  let suu = 0,
    suv = 0,
    su = 0;
  let svv = 0,
    sv = 0;
  let sux = 0,
    svx = 0,
    sx = 0;
  let suy = 0,
    svy = 0,
    sy = 0;

  for (const p of titik) {
    suu += p.u * p.u;
    suv += p.u * p.v;
    su += p.u;
    svv += p.v * p.v;
    sv += p.v;
    sux += p.u * p.x;
    svx += p.v * p.x;
    sx += p.x;
    suy += p.u * p.y;
    svy += p.v * p.y;
    sy += p.y;
  }

  const M = [
    [suu, suv, su],
    [suv, svv, sv],
    [su, sv, n]
  ];

  const det3 = (m: number[][]): number =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const D = det3(M);
  if (Math.abs(D) < 1e-10) {
    throw new Error("Titik kontrol GeoPDF kolinear (degenerate).");
  }

  const gantiKolom = (m: number[][], kol: number, vec: number[]): number[][] =>
    m.map((baris, r) => baris.map((val, c) => (c === kol ? vec[r] : val)));

  const bx = [sux, svx, sx];
  const by = [suy, svy, sy];

  const a = det3(gantiKolom(M, 0, bx)) / D;
  const b = det3(gantiKolom(M, 1, bx)) / D;
  const c = det3(gantiKolom(M, 2, bx)) / D;

  const d = det3(gantiKolom(M, 0, by)) / D;
  const e = det3(gantiKolom(M, 1, by)) / D;
  const f = det3(gantiKolom(M, 2, by)) / D;

  const detJ = a * e - b * d;
  if (Math.abs(detJ) < 1e-12) {
    throw new Error("Matriks transformasi GeoPDF singular (area nol).");
  }

  return {
    a,
    b,
    c,
    d,
    e,
    f,
    keGeo: (u: number, v: number): [number, number] => [a * u + b * v + c, d * u + e * v + f],
    keLokal: (lng: number, lat: number): [number, number] => {
      const dx = lng - c;
      const dy = lat - f;
      return [(e * dx - b * dy) / detJ, (-d * dx + a * dy) / detJ];
    }
  };
}

/**
 * Validasi GPTS dan LPTS GeoPDF, serta konversi otomatis dari CRS proyeksi (mis. UTM) ke WGS 84 (EPSG:4326).
 * Menangani baik GPTS dalam derajat geografis (standar ISO 32000) maupun GPTS dalam meter UTM.
 */
export function validasiKontrolGeoPdf(
  gpts: number[],
  lpts: number[] = [0, 0, 0, 1, 1, 1, 1, 0],
  crsKey = "EPSG:4326"
): Omit<ReferensiGeoPdf, "bbox"> {
  daftarkanCrsProj4();

  if (gpts.length < 8 || gpts.length % 2 !== 0 || lpts.length !== gpts.length) {
    throw new Error("Titik kontrol GPTS/LPTS GeoPDF tidak lengkap.");
  }
  if (!gpts.every(Number.isFinite) || !lpts.every(Number.isFinite)) {
    throw new Error("Titik kontrol GeoPDF bukan angka hingga.");
  }

  const lokalUnik = new Set<string>();
  const kontrolWgs84: TitikKontrolGeoPdf[] = [];

  for (let i = 0; i < gpts.length; i += 2) {
    const u = lpts[i];
    const v = lpts[i + 1];
    if (u < -0.01 || u > 1.01 || v < -0.01 || v > 1.01) {
      throw new Error("LPTS GeoPDF di luar rentang [0, 1].");
    }
    lokalUnik.add(`${u.toFixed(4)},${v.toFixed(4)}`);

    const rawY = gpts[i];
    const rawX = gpts[i + 1];

    let lat = rawY;
    let lng = rawX;

    if (crsKey !== "EPSG:4326") {
      // Perbaikan Bug GPTS ISO 32000: jika nilai sudah di dalam rentang derajat geografis [-90..90, -180..180],
      // jangan diproyeksikan ulang dari UTM karena ISO 32000 menyimpan GPTS dalam derajat [lat, lon].
      // Namun bila di luar rentang derajat (seperti meter UTM [Northing, Easting]), proyeksikan ke EPSG:4326.
      if (Math.abs(rawY) <= 90 && Math.abs(rawX) <= 180) {
        lat = rawY;
        lng = rawX;
      } else {
        try {
          let xUtm = rawX;
          let yUtm = rawY;
          if (rawY > 100000 && rawY < 900000 && rawX > 1000000) {
            xUtm = rawY;
            yUtm = rawX;
          }
          const [projLng, projLat] = proj4(crsKey, "EPSG:4326", [xUtm, yUtm]);
          lng = projLng;
          lat = projLat;
        } catch {
          if (Math.abs(rawY) <= 90 && Math.abs(rawX) <= 180) {
            lat = rawY;
            lng = rawX;
          } else {
            throw new Error(`Gagal mengonversi koordinat dari sistem ${crsKey} ke WGS 84.`);
          }
        }
      }
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error(`Koordinat GPTS GeoPDF di luar rentang bumi (${lat}, ${lng}).`);
    }

    kontrolWgs84.push({ u, v, x: lng, y: lat });
  }

  if (lokalUnik.size < 3) {
    throw new Error("Titik kontrol LPTS GeoPDF berulang (kurang dari 3 titik unik).");
  }

  const affine = selesaikanAffine2D(kontrolWgs84);

  const sudutKiriBawah = affine.keGeo(0, 0);
  const sudutKiriAtas = affine.keGeo(0, 1);
  const sudutKananAtas = affine.keGeo(1, 1);
  const sudutKananBawah = affine.keGeo(1, 0);

  const empatSudut: [number, number][] = [sudutKiriBawah, sudutKiriAtas, sudutKananAtas, sudutKananBawah];

  const semuaLng = [...kontrolWgs84.map((p) => p.x), ...empatSudut.map((s) => s[0])];
  const semuaLat = [...kontrolWgs84.map((p) => p.y), ...empatSudut.map((s) => s[1])];

  const minLat = Number(Math.min(...semuaLat).toFixed(10));
  const maxLat = Number(Math.max(...semuaLat).toFixed(10));
  const minLng = Number(Math.min(...semuaLng).toFixed(10));
  const maxLng = Number(Math.max(...semuaLng).toFixed(10));

  if (maxLat - minLat < 1e-5 || maxLng - minLng < 1e-5) {
    throw new Error("Rentang koordinat GeoPDF terlalu sempit atau kolinear.");
  }

  const dLng = sudutKananAtas[0] - sudutKiriAtas[0];
  const dLat = sudutKananAtas[1] - sudutKiriAtas[1];
  const rotasiDerajat = Number(((Math.atan2(dLat, dLng) * 180) / Math.PI).toFixed(2));

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    pusatLat: Number(((minLat + maxLat) / 2).toFixed(7)),
    pusatLng: Number(((minLng + maxLng) / 2).toFixed(7)),
    crs: crsKey,
    crsDeskripsi: namaCrs(crsKey),
    empatSudut,
    rotasiDerajat,
    affine
  };
}

/**
 * Mengubah objek internal pdf-lib menjadi nilai JS biasa secara rekursif (kedalaman maks 6).
 */
function pembuatKeJs(doc: PDFDocument) {
  const ctx = doc.context;
  const keJs = (obj: unknown, kedalaman = 0): unknown => {
    if (kedalaman > 6 || obj === null || obj === undefined) return null;
    if (obj instanceof PDFRef) {
      return keJs(ctx.lookup(obj), kedalaman + 1);
    }
    if (obj instanceof PDFNumber) return obj.asNumber();
    if (obj instanceof PDFString || obj instanceof PDFHexString) return obj.decodeText();
    if (obj instanceof PDFName) return obj.decodeText();
    if (obj instanceof PDFArray) {
      const hasil: unknown[] = [];
      for (let i = 0; i < obj.size(); i++) {
        hasil.push(keJs(obj.get(i), kedalaman + 1));
      }
      return hasil;
    }
    if (obj instanceof PDFDict) {
      const hasil: Record<string, unknown> = {};
      for (const [kunci, nilai] of obj.entries()) {
        const namaKunci = kunci.decodeText();
        hasil[namaKunci] = keJs(nilai, kedalaman + 1);
      }
      return hasil;
    }
    return obj;
  };
  return keJs;
}

function adalahAngkaArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

/**
 * Ekstraksi viewport format ISO 32000 (/VP array dengan Measure Subtype /GEO)
 */
function bacaViewportIso(rawVp: unknown, lebarPt: number, tinggiPt: number): ViewportGeo[] {
  const daftarVp = Array.isArray(rawVp) ? rawVp : rawVp && typeof rawVp === "object" ? [rawVp] : [];
  const hasil: ViewportGeo[] = [];

  for (let idx = 0; idx < daftarVp.length; idx++) {
    const vp = daftarVp[idx];
    if (!vp || typeof vp !== "object") continue;
    const rec = vp as Record<string, unknown>;
    const measure = rec.Measure as Record<string, unknown> | undefined;
    if (!measure || measure.Subtype !== "GEO") continue;

    const bboxRaw = rec.BBox;
    let kotak: KotakViewport = { xMin: 0, yMin: 0, xMaks: lebarPt, yMaks: tinggiPt };
    if (adalahAngkaArray(bboxRaw) && bboxRaw.length >= 4) {
      kotak = {
        xMin: Math.min(bboxRaw[0], bboxRaw[2]),
        yMin: Math.min(bboxRaw[1], bboxRaw[3]),
        xMaks: Math.max(bboxRaw[0], bboxRaw[2]),
        yMaks: Math.max(bboxRaw[1], bboxRaw[3])
      };
    }

    const gpts = measure.GPTS;
    if (!adalahAngkaArray(gpts) || gpts.length < 4) continue;

    const lpts = adalahAngkaArray(measure.LPTS) ? measure.LPTS : [0, 0, 0, 1, 1, 1, 1, 0];
    const bounds = adalahAngkaArray(measure.Bounds) ? measure.Bounds : [0, 0, 0, 1, 1, 1, 1, 0];

    const gcs = (measure.GCS || measure.PROJCS || measure.GEOGCS) as Record<string, unknown> | undefined;
    const epsg = gcs && typeof gcs.EPSG === "number" ? gcs.EPSG : null;
    const wkt = gcs && typeof gcs.WKT === "string" ? gcs.WKT : null;
    const crsKode = siapkanCrs(epsg, wkt);

    const lbrKotak = kotak.xMaks - kotak.xMin;
    const tgiKotak = kotak.yMaks - kotak.yMin;

    const jumlahTitik = Math.min(Math.floor(gpts.length / 2), Math.floor(lpts.length / 2));
    const titikIkat: ViewportGeo["titikIkat"] = [];

    for (let i = 0; i < jumlahTitik; i++) {
      const lx = lpts[i * 2];
      const ly = lpts[i * 2 + 1];
      const xPt = lx >= 0 && lx <= 1 ? kotak.xMin + lx * lbrKotak : lx;
      const yPt = ly >= 0 && ly <= 1 ? kotak.yMin + ly * tgiKotak : ly;

      const rawY = gpts[i * 2];
      const rawX = gpts[i * 2 + 1];

      let lat: number | null = null;
      let lon: number | null = null;
      let proyeksi: { x: number; y: number } | undefined;

      // ISO 32000-1 menetapkan GPTS sebagai [lat, lon] derajat geografis.
      // Jika sudah dalam rentang derajat [-90..90, -180..180], langsung gunakan sebagai derajat.
      if (Math.abs(rawY) <= 90 && Math.abs(rawX) <= 180) {
        lat = rawY;
        lon = rawX;
      } else if (Math.abs(rawX) <= 90 && Math.abs(rawY) <= 180) {
        lat = rawX;
        lon = rawY;
      } else if (crsKode && crsKode !== "EPSG:4326") {
        try {
          let xUtm = rawX;
          let yUtm = rawY;
          if (rawY > 100000 && rawY < 900000 && rawX > 1000000) {
            xUtm = rawY;
            yUtm = rawX;
          }
          const [lngProj, latProj] = proj4(crsKode, "EPSG:4326", [xUtm, yUtm]);
          if (Number.isFinite(latProj) && Number.isFinite(lngProj) && Math.abs(latProj) <= 90 && Math.abs(lngProj) <= 180) {
            lat = latProj;
            lon = lngProj;
            proyeksi = { x: xUtm, y: yUtm };
          }
        } catch {
          // Abaikan jika gagal
        }
      }

      if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
        titikIkat.push({ pdf: { x: xPt, y: yPt }, geo: { lat, lon }, ...(proyeksi ? { proyeksi } : {}) });
      }
    }

    if (titikIkat.length < 2) continue;

    const batasPdf: TitikPdf[] = [];
    for (let i = 0; i + 1 < bounds.length; i += 2) {
      const bx = bounds[i];
      const by = bounds[i + 1];
      batasPdf.push({
        x: bx >= 0 && bx <= 1 ? kotak.xMin + bx * lbrKotak : bx,
        y: by >= 0 && by <= 1 ? kotak.yMin + by * tgiKotak : by
      });
    }

    hasil.push({
      nama: typeof rec.Name === "string" ? rec.Name : `Viewport ${idx + 1}`,
      format: "iso32000",
      kotak,
      batasPdf,
      titikIkat,
      crs: crsKode ?? (epsg ? `EPSG:${epsg}` : "EPSG:4326"),
      wkt,
      epsg
    });
  }

  return hasil;
}

/**
 * Ekstraksi format OGC / TerraGo (/LGIDict di tingkat halaman)
 */
function bacaLgi(rawLgi: unknown, lebarPt: number, tinggiPt: number): ViewportGeo[] {
  const daftar = Array.isArray(rawLgi) ? rawLgi : rawLgi ? [rawLgi] : [];
  const hasil: ViewportGeo[] = [];

  for (let idx = 0; idx < daftar.length; idx++) {
    const item = daftar[idx];
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;

    const proj = rec.Projection as Record<string, unknown> | undefined;
    let epsg: number | null = null;
    let wkt: string | null = null;
    if (proj) {
      if (typeof proj.EPSG === "number") epsg = proj.EPSG;
      if (typeof proj.WKT === "string") wkt = proj.WKT;
      const tipeProj = proj.ProjectionType;
      const zona = proj.Zone;
      const hemi = proj.Hemisphere;
      if (!epsg && tipeProj === "UT" && typeof zona === "number") {
        epsg = hemi === "S" || hemi === "s" ? 32700 + zona : 32600 + zona;
      }
      if (!epsg && (tipeProj === "GEO" || tipeProj === "GEODETIC")) {
        epsg = 4326;
      }
    }

    const crs = siapkanCrs(epsg, wkt);

    const neat = rec.Neatline;
    const batasPdf: TitikPdf[] = [];
    let kotak: KotakViewport = { xMin: 0, yMin: 0, xMaks: lebarPt, yMaks: tinggiPt };
    if (adalahAngkaArray(neat) && neat.length >= 4) {
      let xMin = Infinity,
        yMin = Infinity,
        xMaks = -Infinity,
        yMaks = -Infinity;
      for (let i = 0; i + 1 < neat.length; i += 2) {
        const x = neat[i],
          y = neat[i + 1];
        batasPdf.push({ x, y });
        if (x < xMin) xMin = x;
        if (y < yMin) yMin = y;
        if (x > xMaks) xMaks = x;
        if (y > yMaks) yMaks = y;
      }
      kotak = { xMin, yMin, xMaks, yMaks };
    } else {
      batasPdf.push(
        { x: 0, y: 0 },
        { x: lebarPt, y: 0 },
        { x: lebarPt, y: tinggiPt },
        { x: 0, y: tinggiPt }
      );
    }

    const ctmRaw = rec.CTM;
    let ctm: [number, number, number, number, number, number] | undefined;
    const titikIkat: ViewportGeo["titikIkat"] = [];

    if (adalahAngkaArray(ctmRaw) && ctmRaw.length >= 6) {
      ctm = [ctmRaw[0], ctmRaw[1], ctmRaw[2], ctmRaw[3], ctmRaw[4], ctmRaw[5]];
      const sudutPdf: TitikPdf[] = [
        { x: kotak.xMin, y: kotak.yMin },
        { x: kotak.xMaks, y: kotak.yMin },
        { x: kotak.xMaks, y: kotak.yMaks },
        { x: kotak.xMin, y: kotak.yMaks }
      ];
      for (const p of sudutPdf) {
        const X = ctm[0] * p.x + ctm[2] * p.y + ctm[4];
        const Y = ctm[1] * p.x + ctm[3] * p.y + ctm[5];
        let lon = X,
          lat = Y;
        if (crs && crs !== "EPSG:4326") {
          try {
            const [lo, la] = proj4(crs, "EPSG:4326", [X, Y]);
            lon = lo;
            lat = la;
          } catch {
            continue;
          }
        }
        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          titikIkat.push({ pdf: p, geo: { lat, lon }, proyeksi: { x: X, y: Y } });
        }
      }
    }

    const reg = rec.Registration;
    if (titikIkat.length < 2 && Array.isArray(reg)) {
      for (const pasangan of reg) {
        const arr = Array.isArray(pasangan) ? pasangan : [];
        const angka = arr.flat().filter((x): x is number => typeof x === "number");
        if (angka.length >= 4) {
          const [px, py, gx, gy] = angka;
          let lon = gx,
            lat = gy;
          if (crs && crs !== "EPSG:4326" && (Math.abs(gx) > 180 || Math.abs(gy) > 90)) {
            try {
              const [lo, la] = proj4(crs, "EPSG:4326", [gx, gy]);
              lon = lo;
              lat = la;
            } catch {
              continue;
            }
          } else if (Math.abs(gx) <= 90 && Math.abs(gy) > 90 && Math.abs(gy) <= 180) {
            lat = gx;
            lon = gy;
          }
          if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            titikIkat.push({ pdf: { x: px, y: py }, geo: { lat, lon } });
          }
        }
      }
    }

    if (titikIkat.length < 2) continue;

    hasil.push({
      nama: typeof rec.Description === "string" ? rec.Description : `LGIDict ${idx + 1}`,
      format: "ogc-lgi",
      kotak,
      batasPdf,
      titikIkat,
      crs: crs ?? (epsg ? `EPSG:${epsg}` : "EPSG:4326"),
      wkt,
      epsg,
      ctm
    });
  }

  return hasil;
}

function pilihViewportUtama(daftar: ViewportGeo[]): ViewportGeo {
  let terbaik = daftar[0];
  let luasMaks = -1;
  for (const vp of daftar) {
    const luas = Math.max(0, vp.kotak.xMaks - vp.kotak.xMin) * Math.max(0, vp.kotak.yMaks - vp.kotak.yMin);
    if (luas > luasMaks) {
      luasMaks = luas;
      terbaik = vp;
    }
  }
  return terbaik;
}

/**
 * Membaca metadata georeferensi dari berkas PDF (mendukung ISO 32000 /VP dan TerraGo /LGIDict
 * serta memindai seluruh halaman hingga menemukan halaman ber-georeferensi).
 */
export async function bacaGeoreferensi(dataPdf: ArrayBuffer | Uint8Array): Promise<GeoreferensiPdf | null> {
  const doc = await PDFDocument.load(dataPdf, {
    ignoreEncryption: true,
    updateMetadata: false
  });
  const keJs = pembuatKeJs(doc);
  const halaman = doc.getPages();

  for (let i = 0; i < halaman.length; i++) {
    const p = halaman[i];
    const { width: lebarPt, height: tinggiPt } = p.getSize();
    const dict = p.node;

    const vpRaw = keJs(dict.get(PDFName.of("VP")));
    const lgiRaw = keJs(dict.get(PDFName.of("LGIDict")));

    const dariIso = vpRaw ? bacaViewportIso(vpRaw, lebarPt, tinggiPt) : [];
    const dariLgi = lgiRaw ? bacaLgi(lgiRaw, lebarPt, tinggiPt) : [];
    const gabungan = [...dariIso, ...dariLgi];

    if (gabungan.length > 0) {
      return {
        indeksHalaman: i,
        lebarPt,
        tinggiPt,
        viewport: gabungan,
        utama: pilihViewportUtama(gabungan)
      };
    }
  }

  return null;
}

function selesaikanLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((baris, i) => [...baris, b[i]]);

  for (let kol = 0; kol < n; kol++) {
    let barisMaks = kol;
    let nilaiMaks = Math.abs(M[kol][kol]);
    for (let r = kol + 1; r < n; r++) {
      const v = Math.abs(M[r][kol]);
      if (v > nilaiMaks) {
        nilaiMaks = v;
        barisMaks = r;
      }
    }
    if (nilaiMaks < 1e-12) return null;
    if (barisMaks !== kol) {
      const tmp = M[kol];
      M[kol] = M[barisMaks];
      M[barisMaks] = tmp;
    }
    const pivot = M[kol][kol];
    for (let j = kol; j <= n; j++) M[kol][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === kol) continue;
      const faktor = M[r][kol];
      if (faktor === 0) continue;
      for (let j = kol; j <= n; j++) M[r][j] -= faktor * M[kol][j];
    }
  }

  return M.map((baris) => baris[n]);
}

interface Afin2D {
  maju: (x: number, y: number) => { X: number; Y: number };
  balik: (X: number, Y: number) => { x: number; y: number } | null;
}

function hitungAfin(pasang: { x: number; y: number; X: number; Y: number }[]): Afin2D | null {
  if (pasang.length < 3) {
    if (pasang.length === 2) {
      const [p1, p2] = pasang;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      if (Math.abs(dx) < 1e-9 || Math.abs(dy) < 1e-9) return null;
      const a = (p2.X - p1.X) / dx;
      const e = (p2.Y - p1.Y) / dy;
      const c = p1.X - a * p1.x;
      const f = p1.Y - e * p1.y;
      if (Math.abs(a * e) < 1e-14) return null;
      return {
        maju: (x, y) => ({ X: a * x + c, Y: e * y + f }),
        balik: (X, Y) => ({ x: (X - c) / a, y: (Y - f) / e })
      };
    }
    return null;
  }

  let sxx = 0,
    sxy = 0,
    sx = 0,
    syy = 0,
    sy = 0;
  let sxX = 0,
    syX = 0,
    sX = 0,
    sxY = 0,
    syY = 0,
    sY = 0;
  const n = pasang.length;

  for (const p of pasang) {
    sxx += p.x * p.x;
    sxy += p.x * p.y;
    sx += p.x;
    syy += p.y * p.y;
    sy += p.y;
    sxX += p.x * p.X;
    syX += p.y * p.X;
    sX += p.X;
    sxY += p.x * p.Y;
    syY += p.y * p.Y;
    sY += p.Y;
  }

  const M = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n]
  ];
  const koefX = selesaikanLinear(M, [sxX, syX, sX]);
  const koefY = selesaikanLinear(M, [sxY, syY, sY]);
  if (!koefX || !koefY) return null;

  const [a, b, c] = koefX;
  const [d, e, f] = koefY;
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-14) return null;

  return {
    maju: (x, y) => ({ X: a * x + b * y + c, Y: d * x + e * y + f }),
    balik: (X, Y) => {
      const dx = X - c;
      const dy = Y - f;
      return {
        x: (e * dx - b * dy) / det,
        y: (-d * dx + a * dy) / det
      };
    }
  };
}

interface Homografi2D {
  maju: (x: number, y: number) => { X: number; Y: number } | null;
  balik: (X: number, Y: number) => { x: number; y: number } | null;
}

function hitungHomografi(pasang: { x: number; y: number; X: number; Y: number }[]): Homografi2D | null {
  if (pasang.length < 4) return null;

  const norm = (pts: { u: number; v: number }[]) => {
    let mu = 0,
      mv = 0;
    for (const p of pts) {
      mu += p.u;
      mv += p.v;
    }
    mu /= pts.length;
    mv /= pts.length;
    let rata = 0;
    for (const p of pts) rata += Math.hypot(p.u - mu, p.v - mv);
    rata /= pts.length;
    const s = rata > 1e-12 ? Math.SQRT2 / rata : 1;
    return { mu, mv, s };
  };

  const nAsal = norm(pasang.map((p) => ({ u: p.x, v: p.y })));
  const nTuj = norm(pasang.map((p) => ({ u: p.X, v: p.Y })));

  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const Atb = new Array(8).fill(0);

  for (const p of pasang) {
    const x = (p.x - nAsal.mu) * nAsal.s;
    const y = (p.y - nAsal.mv) * nAsal.s;
    const X = (p.X - nTuj.mu) * nTuj.s;
    const Y = (p.Y - nTuj.mv) * nTuj.s;

    const r1 = [x, y, 1, 0, 0, 0, -x * X, -y * X];
    const r2 = [0, 0, 0, x, y, 1, -x * Y, -y * Y];
    for (let i = 0; i < 8; i++) {
      Atb[i] += r1[i] * X + r2[i] * Y;
      for (let j = 0; j < 8; j++) {
        AtA[i][j] += r1[i] * r1[j] + r2[i] * r2[j];
      }
    }
  }

  const h = selesaikanLinear(AtA, Atb);
  if (!h) return null;
  const H = [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1]
  ];

  const inv3 = (m: number[][]): number[][] | null => {
    const [r0, r1, r2] = m;
    const k00 = r1[1] * r2[2] - r1[2] * r2[1];
    const k01 = -(r1[0] * r2[2] - r1[2] * r2[0]);
    const k02 = r1[0] * r2[1] - r1[1] * r2[0];
    const det = r0[0] * k00 + r0[1] * k01 + r0[2] * k02;
    if (Math.abs(det) < 1e-14) return null;
    const invD = 1 / det;
    return [
      [k00 * invD, -(r0[1] * r2[2] - r0[2] * r2[1]) * invD, (r0[1] * r1[2] - r0[2] * r1[1]) * invD],
      [k01 * invD, (r0[0] * r2[2] - r0[2] * r2[0]) * invD, -(r0[0] * r1[2] - r0[2] * r1[0]) * invD],
      [k02 * invD, -(r0[0] * r2[1] - r0[1] * r2[0]) * invD, (r0[0] * r1[1] - r0[1] * r1[0]) * invD]
    ];
  };

  const Hinv = inv3(H);
  if (!Hinv) return null;

  return {
    maju: (x, y) => {
      const xn = (x - nAsal.mu) * nAsal.s;
      const yn = (y - nAsal.mv) * nAsal.s;
      const w = H[2][0] * xn + H[2][1] * yn + H[2][2];
      if (Math.abs(w) < 1e-12) return null;
      const Xn = (H[0][0] * xn + H[0][1] * yn + H[0][2]) / w;
      const Yn = (H[1][0] * xn + H[1][1] * yn + H[1][2]) / w;
      return { X: Xn / nTuj.s + nTuj.mu, Y: Yn / nTuj.s + nTuj.mv };
    },
    balik: (X, Y) => {
      const Xn = (X - nTuj.mu) * nTuj.s;
      const Yn = (Y - nTuj.mv) * nTuj.s;
      const w = Hinv[2][0] * Xn + Hinv[2][1] * Yn + Hinv[2][2];
      if (Math.abs(w) < 1e-12) return null;
      const xn = (Hinv[0][0] * Xn + Hinv[0][1] * Yn + Hinv[0][2]) / w;
      const yn = (Hinv[1][0] * Xn + Hinv[1][1] * Yn + Hinv[1][2]) / w;
      return { x: xn / nAsal.s + nAsal.mu, y: yn / nAsal.s + nAsal.mv };
    }
  };
}

function jarakHaversineMeter(a: TitikGeo, b: TitikGeo): number {
  const R = 6371008.8;
  const keRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * keRad;
  const dLon = (b.lon - a.lon) * keRad;
  const lat1 = a.lat * keRad;
  const lat2 = b.lat * keRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function sisaGalatMeter(
  titikIkat: { pdf: TitikPdf; geo: TitikGeo }[],
  pdfKeGeo: (x: number, y: number) => TitikGeo | null
): number {
  let maks = 0;
  for (const t of titikIkat) {
    const pred = pdfKeGeo(t.pdf.x, t.pdf.y);
    if (!pred) return Infinity;
    const d = jarakHaversineMeter(t.geo, pred);
    if (d > maks) maks = d;
  }
  return maks;
}

/**
 * Membangun fungsi transformasi dua arah (PDF pt <-> WGS84 lat/lon)
 * dengan 3-Tier Transform (afin-proyeksi -> afin-geografis -> homografi DLT 3x3).
 */
export function buatTransformasi(vp: ViewportGeo): TransformasiGeoref | null {
  daftarkanCrsProj4();
  const ikat = vp.titikIkat;
  if (ikat.length < 2) return null;

  const crsProyeksi = vp.crs && vp.crs !== "EPSG:4326" ? vp.crs : null;
  if (crsProyeksi) {
    try {
      const pasangProyeksi = ikat.map((t) => {
        if (t.proyeksi) {
          return { x: t.pdf.x, y: t.pdf.y, X: t.proyeksi.x, Y: t.proyeksi.y };
        }
        const [X, Y] = proj4("EPSG:4326", crsProyeksi, [t.geo.lon, t.geo.lat]);
        return { x: t.pdf.x, y: t.pdf.y, X, Y };
      });
      const afin = hitungAfin(pasangProyeksi);
      if (afin) {
        const pdfKeGeo = (xPt: number, yPt: number): TitikGeo | null => {
          try {
            const { X, Y } = afin.maju(xPt, yPt);
            const [lon, lat] = proj4(crsProyeksi, "EPSG:4326", [X, Y]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            return { lat, lon };
          } catch {
            return null;
          }
        };
        const geoKePdf = (lat: number, lon: number): TitikPdf | null => {
          try {
            const [X, Y] = proj4("EPSG:4326", crsProyeksi, [lon, lat]);
            return afin.balik(X, Y);
          } catch {
            return null;
          }
        };
        const sisa = sisaGalatMeter(ikat, pdfKeGeo);
        if (Number.isFinite(sisa) && sisa < 50) {
          return { pdfKeGeo, geoKePdf, metode: "afin-proyeksi", crsProyeksi, sisaMeter: sisa };
        }
      }
    } catch {
      // Lanjut ke regresi langsung di derajat geografis
    }
  }

  const pasangGeo = ikat.map((t) => ({ x: t.pdf.x, y: t.pdf.y, X: t.geo.lon, Y: t.geo.lat }));
  const afinGeo = hitungAfin(pasangGeo);

  let kandidatAfin: TransformasiGeoref | null = null;
  if (afinGeo) {
    const pdfKeGeo = (xPt: number, yPt: number): TitikGeo | null => {
      const { X, Y } = afinGeo.maju(xPt, yPt);
      if (!Number.isFinite(X) || !Number.isFinite(Y)) return null;
      return { lat: Y, lon: X };
    };
    const geoKePdf = (lat: number, lon: number): TitikPdf | null => afinGeo.balik(lon, lat);
    const sisa = sisaGalatMeter(ikat, pdfKeGeo);
    kandidatAfin = { pdfKeGeo, geoKePdf, metode: "afin-geografis", crsProyeksi: null, sisaMeter: sisa };
  }

  if (ikat.length >= 4 && (!kandidatAfin || kandidatAfin.sisaMeter > 5)) {
    const homo = hitungHomografi(pasangGeo);
    if (homo) {
      const pdfKeGeo = (xPt: number, yPt: number): TitikGeo | null => {
        const h = homo.maju(xPt, yPt);
        return h ? { lat: h.Y, lon: h.X } : null;
      };
      const geoKePdf = (lat: number, lon: number): TitikPdf | null => homo.balik(lon, lat);
      const sisa = sisaGalatMeter(ikat, pdfKeGeo);
      if (!kandidatAfin || sisa < kandidatAfin.sisaMeter) {
        return { pdfKeGeo, geoKePdf, metode: "homografi", crsProyeksi: null, sisaMeter: sisa };
      }
    }
  }

  return kandidatAfin;
}

export function batasGeo(vp: ViewportGeo, tx: TransformasiGeoref): TitikGeo[] {
  const sumber =
    vp.batasPdf.length >= 3
      ? vp.batasPdf
      : [
          { x: vp.kotak.xMin, y: vp.kotak.yMin },
          { x: vp.kotak.xMaks, y: vp.kotak.yMin },
          { x: vp.kotak.xMaks, y: vp.kotak.yMaks },
          { x: vp.kotak.xMin, y: vp.kotak.yMaks }
        ];
  const hasil: TitikGeo[] = [];
  for (const p of sumber) {
    const g = tx.pdfKeGeo(p.x, p.y);
    if (g) hasil.push(g);
  }
  return hasil;
}

export function kotakBatas(titik: TitikGeo[]): {
  selatan: number;
  barat: number;
  utara: number;
  timur: number;
  tengah: TitikGeo;
} {
  let selatan = Infinity,
    barat = Infinity,
    utara = -Infinity,
    timur = -Infinity;
  for (const t of titik) {
    if (t.lat < selatan) selatan = t.lat;
    if (t.lon < barat) barat = t.lon;
    if (t.lat > utara) utara = t.lat;
    if (t.lon > timur) timur = t.lon;
  }
  return {
    selatan: Number(selatan.toFixed(10)),
    barat: Number(barat.toFixed(10)),
    utara: Number(utara.toFixed(10)),
    timur: Number(timur.toFixed(10)),
    tengah: {
      lat: Number(((selatan + utara) / 2).toFixed(7)),
      lon: Number(((barat + timur) / 2).toFixed(7))
    }
  };
}

/** Uji apakah koordinat geografis berada di dalam poligon batas peta (ray casting) */
export function diDalamBatas(pos: TitikGeo, poligon: TitikGeo[]): boolean {
  if (poligon.length < 3) return false;
  let diDalam = false;
  for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
    const xi = poligon[i].lon,
      yi = poligon[i].lat;
    const xj = poligon[j].lon,
      yj = poligon[j].lat;
    const potong = yi > pos.lat !== yj > pos.lat && pos.lon < ((xj - xi) * (pos.lat - yi)) / (yj - yi + 1e-15) + xi;
    if (potong) diDalam = !diDalam;
  }
  return diDalam;
}

export function kalibrasiManualDuaTitik(
  lebarPt: number,
  tinggiPt: number,
  kiriAtas: TitikGeo,
  kananBawah: TitikGeo
): GeoreferensiPdf {
  const kananAtas: TitikGeo = { lat: kiriAtas.lat, lon: kananBawah.lon };
  const kiriBawah: TitikGeo = { lat: kananBawah.lat, lon: kiriAtas.lon };
  const vp: ViewportGeo = {
    nama: "Kalibrasi Manual",
    format: "manual",
    kotak: { xMin: 0, yMin: 0, xMaks: lebarPt, yMaks: tinggiPt },
    batasPdf: [
      { x: 0, y: 0 },
      { x: lebarPt, y: 0 },
      { x: lebarPt, y: tinggiPt },
      { x: 0, y: tinggiPt }
    ],
    titikIkat: [
      { pdf: { x: 0, y: 0 }, geo: kiriBawah },
      { pdf: { x: 0, y: tinggiPt }, geo: kiriAtas },
      { pdf: { x: lebarPt, y: tinggiPt }, geo: kananAtas },
      { pdf: { x: lebarPt, y: 0 }, geo: kananBawah }
    ],
    crs: "EPSG:4326",
    wkt: null,
    epsg: 4326
  };
  return {
    indeksHalaman: 0,
    lebarPt,
    tinggiPt,
    viewport: [vp],
    utama: vp
  };
}

/**
 * Membaca referensi spasial GeoPDF dan mengembalikan ReferensiGeoPdf lengkap.
 */
export async function bacaReferensiGeoPdf(buffer: ArrayBuffer | Uint8Array): Promise<ReferensiGeoPdf> {
  daftarkanCrsProj4();
  const georef = await bacaGeoreferensi(buffer);
  if (!georef) {
    throw new Error("Berkas PDF tidak memiliki metadata georeferensi (/VP atau /LGIDict viewport tidak ditemukan).");
  }

  const vp = georef.utama;
  const tx = buatTransformasi(vp);
  if (!tx) {
    throw new Error("Viewport GEO tidak memiliki cukup titik kontrol georeferensi yang valid.");
  }

  const poligonBatas = batasGeo(vp, tx);
  const gKiriBawah = tx.pdfKeGeo(vp.kotak.xMin, vp.kotak.yMin);
  const gKiriAtas = tx.pdfKeGeo(vp.kotak.xMin, vp.kotak.yMaks);
  const gKananAtas = tx.pdfKeGeo(vp.kotak.xMaks, vp.kotak.yMaks);
  const gKananBawah = tx.pdfKeGeo(vp.kotak.xMaks, vp.kotak.yMin);

  const sudutGeo = [gKiriBawah, gKiriAtas, gKananAtas, gKananBawah].filter((s): s is TitikGeo => s !== null);
  const semuaTitik = [...vp.titikIkat.map((t) => t.geo), ...poligonBatas, ...sudutGeo];
  const kb = kotakBatas(semuaTitik);

  const empatSudut: [number, number][] = [
    [Number((gKiriBawah?.lon ?? kb.barat).toFixed(10)), Number((gKiriBawah?.lat ?? kb.selatan).toFixed(10))],
    [Number((gKiriAtas?.lon ?? kb.barat).toFixed(10)), Number((gKiriAtas?.lat ?? kb.utara).toFixed(10))],
    [Number((gKananAtas?.lon ?? kb.timur).toFixed(10)), Number((gKananAtas?.lat ?? kb.utara).toFixed(10))],
    [Number((gKananBawah?.lon ?? kb.timur).toFixed(10)), Number((gKananBawah?.lat ?? kb.selatan).toFixed(10))]
  ];

  const dLng = empatSudut[2][0] - empatSudut[1][0];
  const dLat = empatSudut[2][1] - empatSudut[1][1];
  const rotasiDerajat = Number(((Math.atan2(dLat, dLng) * 180) / Math.PI).toFixed(2));

  const crs = vp.crs || "EPSG:4326";

  return {
    minLat: kb.selatan,
    maxLat: kb.utara,
    minLng: kb.barat,
    maxLng: kb.timur,
    pusatLat: kb.tengah.lat,
    pusatLng: kb.tengah.lon,
    bbox: [vp.kotak.xMin, vp.kotak.yMin, vp.kotak.xMaks, vp.kotak.yMaks],
    crs,
    crsDeskripsi: namaCrs(crs),
    empatSudut,
    rotasiDerajat,
    formatGeoref: vp.format,
    metodeTransformasi: tx.metode,
    sisaMeter: Number.isFinite(tx.sisaMeter) ? tx.sisaMeter : null,
    indeksHalaman: georef.indeksHalaman,
    lebarPt: georef.lebarPt,
    tinggiPt: georef.tinggiPt,
    batas: poligonBatas,
    transformasi: tx
  };
}

function buatThumbnailDataUrlDariKanvas(kanvasSumber: HTMLCanvasElement, sisiMaks = 240): string | undefined {
  try {
    const rasio = Math.min(1, sisiMaks / Math.max(kanvasSumber.width, kanvasSumber.height, 1));
    const tW = Math.max(1, Math.round(kanvasSumber.width * rasio));
    const tH = Math.max(1, Math.round(kanvasSumber.height * rasio));
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = tW;
    thumbCanvas.height = tH;
    const tCtx = thumbCanvas.getContext("2d");
    if (!tCtx) return undefined;
    tCtx.fillStyle = "#ffffff";
    tCtx.fillRect(0, 0, tW, tH);
    tCtx.drawImage(kanvasSumber, 0, 0, tW, tH);
    return thumbCanvas.toDataURL("image/jpeg", 0.75);
  } catch {
    return undefined;
  }
}

/**
 * Memasang polyfill metode ES2025/ES2026 (Map.prototype.getOrInsertComputed, WeakMap.prototype.getOrInsertComputed,
 * Promise.withResolvers, Promise.try, URL.parse, Math.sumPrecise, Uint8Array.prototype.toHex) yang dibutuhkan oleh pdfjs-dist v5/v6
 * baik di main thread maupun di dalam Web Worker (melalui interseptor Blob & Worker) agar berjalan mulus di WebView Android,
 * PWA seluler terinstal, Safari iOS, dan peramban HP.
 */
export function pasangPolyfillPdfJs(): void {
  function terapkanPolyfillInti(): void {
    if (typeof Map !== "undefined") {
      const mapProto = Map.prototype as unknown as {
        getOrInsertComputed?: <K, V>(this: Map<K, V>, key: K, callbackfn: (key: K) => V) => V;
        getOrInsert?: <K, V>(this: Map<K, V>, key: K, defaultValue: V) => V;
      };
      if (typeof mapProto.getOrInsertComputed !== "function") {
        Object.defineProperty(Map.prototype, "getOrInsertComputed", {
          value: function getOrInsertComputed<K, V>(this: Map<K, V>, key: K, callbackfn: (key: K) => V): V {
            if (typeof callbackfn !== "function") {
              throw new TypeError("Callback harus berupa fungsi.");
            }
            const k = Object.is(key, -0) ? (+0 as unknown as K) : key;
            if (this.has(k)) return this.get(k) as V;
            const val = callbackfn(k);
            this.set(k, val);
            return val;
          },
          configurable: true,
          writable: true
        });
      }
      if (typeof mapProto.getOrInsert !== "function") {
        Object.defineProperty(Map.prototype, "getOrInsert", {
          value: function getOrInsert<K, V>(this: Map<K, V>, key: K, defaultValue: V): V {
            const k = Object.is(key, -0) ? (+0 as unknown as K) : key;
            if (this.has(k)) return this.get(k) as V;
            this.set(k, defaultValue);
            return defaultValue;
          },
          configurable: true,
          writable: true
        });
      }
    }

    if (typeof WeakMap !== "undefined") {
      const weakMapProto = WeakMap.prototype as unknown as {
        getOrInsertComputed?: <K extends object, V>(this: WeakMap<K, V>, key: K, callbackfn: (key: K) => V) => V;
        getOrInsert?: <K extends object, V>(this: WeakMap<K, V>, key: K, defaultValue: V) => V;
      };
      if (typeof weakMapProto.getOrInsertComputed !== "function") {
        Object.defineProperty(WeakMap.prototype, "getOrInsertComputed", {
          value: function getOrInsertComputed<K extends object, V>(this: WeakMap<K, V>, key: K, callbackfn: (key: K) => V): V {
            if (typeof callbackfn !== "function") {
              throw new TypeError("Callback harus berupa fungsi.");
            }
            if (this.has(key)) return this.get(key) as V;
            const val = callbackfn(key);
            this.set(key, val);
            return val;
          },
          configurable: true,
          writable: true
        });
      }
      if (typeof weakMapProto.getOrInsert !== "function") {
        Object.defineProperty(WeakMap.prototype, "getOrInsert", {
          value: function getOrInsert<K extends object, V>(this: WeakMap<K, V>, key: K, defaultValue: V): V {
            if (this.has(key)) return this.get(key) as V;
            this.set(key, defaultValue);
            return defaultValue;
          },
          configurable: true,
          writable: true
        });
      }
    }

    if (typeof Promise !== "undefined") {
      const promiseStatic = Promise as unknown as {
        withResolvers?: <T>() => {
          promise: Promise<T>;
          resolve: (value: T | PromiseLike<T>) => void;
          reject: (reason?: unknown) => void;
        };
        try?: <T>(fn: (...args: unknown[]) => T | PromiseLike<T>, ...args: unknown[]) => Promise<T>;
      };
      if (typeof promiseStatic.withResolvers !== "function") {
        Object.defineProperty(Promise, "withResolvers", {
          value: function withResolvers<T>() {
            let resolve!: (value: T | PromiseLike<T>) => void;
            let reject!: (reason?: unknown) => void;
            const promise = new Promise<T>((res, rej) => {
              resolve = res;
              reject = rej;
            });
            return { promise, resolve, reject };
          },
          configurable: true,
          writable: true
        });
      }
      if (typeof promiseStatic.try !== "function") {
        Object.defineProperty(Promise, "try", {
          value: function promiseTry<T>(fn: (...args: unknown[]) => T | PromiseLike<T>, ...args: unknown[]): Promise<T> {
            return new Promise<T>((resolve) => {
              resolve(fn(...args));
            });
          },
          configurable: true,
          writable: true
        });
      }
    }

    if (typeof URL !== "undefined") {
      const urlStatic = URL as unknown as {
        parse?: (url: string, base?: string) => URL | null;
      };
      if (typeof urlStatic.parse !== "function") {
        Object.defineProperty(URL, "parse", {
          value: function parse(url: string, base?: string): URL | null {
            try {
              return base !== undefined ? new URL(url, base) : new URL(url);
            } catch {
              return null;
            }
          },
          configurable: true,
          writable: true
        });
      }
    }

    const mathStatic = Math as unknown as {
      sumPrecise?: (items: Iterable<number>) => number;
    };
    if (typeof mathStatic.sumPrecise !== "function") {
      Object.defineProperty(Math, "sumPrecise", {
        value: function sumPrecise(items: Iterable<number>): number {
          let sum = 0;
          for (const n of items) sum += Number(n);
          return sum;
        },
        configurable: true,
        writable: true
      });
    }

    if (typeof Uint8Array !== "undefined") {
      const u8Proto = Uint8Array.prototype as unknown as {
        toHex?: (this: Uint8Array) => string;
      };
      if (typeof u8Proto.toHex !== "function") {
        Object.defineProperty(Uint8Array.prototype, "toHex", {
          value: function toHex(this: Uint8Array): string {
            let out = "";
            for (let i = 0; i < this.length; i++) {
              out += this[i].toString(16).padStart(2, "0");
            }
            return out;
          },
          configurable: true,
          writable: true
        });
      }
    }
  }

  terapkanPolyfillInti();

  // Pastikan setiap Web Worker yang dibuat untuk merender PDF juga menerima polyfill di dalam thread Worker-nya sendiri
  const win = globalThis as unknown as {
    __agyWorkerPatched?: boolean;
    Blob?: typeof Blob;
    Worker?: typeof Worker;
    location?: Location;
  };
  if (typeof win !== "undefined" && !win.__agyWorkerPatched && typeof win.Worker === "function" && typeof win.Blob === "function") {
    win.__agyWorkerPatched = true;
    const kodePolyfillWorker = `/* __agyPdfPolyfill */(${terapkanPolyfillInti.toString()})();\n`;
    const OrigBlob = win.Blob;
    const PatchedBlob = function Blob(blobParts?: BlobPart[], options?: BlobPropertyBag) {
      if (Array.isArray(blobParts) && blobParts.length > 0) {
        const adaImport = blobParts.some(
          (p) => typeof p === "string" && p.includes("import(") && !p.includes("__agyPdfPolyfill")
        );
        if (adaImport) {
          blobParts = [kodePolyfillWorker, ...blobParts];
        }
      }
      return options !== undefined ? new OrigBlob(blobParts, options) : new OrigBlob(blobParts);
    } as unknown as typeof Blob;
    PatchedBlob.prototype = OrigBlob.prototype;
    Object.setPrototypeOf(PatchedBlob, OrigBlob);
    win.Blob = PatchedBlob;

    const OrigWorker = win.Worker;
    const PatchedWorker = function Worker(scriptURL: string | URL, options?: WorkerOptions) {
      const urlStr = String(scriptURL || "");
      if (
        urlStr &&
        !urlStr.startsWith("blob:") &&
        !urlStr.startsWith("data:") &&
        (options?.type === "module" || urlStr.includes("pdf"))
      ) {
        try {
          const baseHref = win.location?.href || "http://localhost/";
          const fullUrl = new URL(urlStr, baseHref).href;
          const blob = new OrigBlob([`${kodePolyfillWorker}await import(${JSON.stringify(fullUrl)});\n`], {
            type: "text/javascript"
          });
          return new OrigWorker(URL.createObjectURL(blob), { ...(options || {}), type: "module" });
        } catch {
          // Lanjutkan ke OrigWorker jika pembuatan Blob URL gagal
        }
      }
      return options !== undefined ? new OrigWorker(scriptURL, options) : new OrigWorker(scriptURL);
    } as unknown as typeof Worker;
    PatchedWorker.prototype = OrigWorker.prototype;
    Object.setPrototypeOf(PatchedWorker, OrigWorker);
    win.Worker = PatchedWorker;
  }
}

// Jalankan polyfill segera saat modul dimuat
pasangPolyfillPdfJs();

/**
 * Memuat modul pdfjs-dist dengan konfigurasi legacy worker yang kompatibel penuh
 * dengan aplikasi PWA terinstal di HP (Android WebView / iOS Safari / Chrome Mobile) maupun PC.
 */
export async function muatPdfJs(): Promise<typeof import("pdfjs-dist")> {
  pasangPolyfillPdfJs();
  const g = globalThis as unknown as { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
  if (!g.pdfjsWorker?.WorkerMessageHandler) {
    const ekstrakHandler = (mod: unknown) => {
      const m = mod as { WorkerMessageHandler?: unknown; default?: { WorkerMessageHandler?: unknown } } | null;
      return m?.WorkerMessageHandler || m?.default?.WorkerMessageHandler || g.pdfjsWorker?.WorkerMessageHandler || null;
    };
    try {
      // @ts-expect-error sub-path worker legacy tidak memiliki deklarasi tipe terpisah
      const workerMod = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
      const h = ekstrakHandler(workerMod);
      if (h) g.pdfjsWorker = { WorkerMessageHandler: h };
    } catch {
      try {
        // @ts-expect-error sub-path worker standar tidak memiliki deklarasi tipe terpisah
        const workerMod2 = await import("pdfjs-dist/build/pdf.worker.min.mjs");
        const h2 = ekstrakHandler(workerMod2);
        if (h2) g.pdfjsWorker = { WorkerMessageHandler: h2 };
      } catch {
        if (typeof window !== "undefined" && window.location?.href) {
          try {
            const localWorkerUrl = new URL("./pdf.worker.min.mjs", window.location.href).href;
            const workerMod3 = await import(/* @vite-ignore */ localWorkerUrl);
            const h3 = ekstrakHandler(workerMod3);
            if (h3) g.pdfjsWorker = { WorkerMessageHandler: h3 };
          } catch {
            // Abaikan di lingkungan pengujian unit
          }
        }
      }
    }
  }

  let pdfjs: typeof import("pdfjs-dist");
  try {
    const modLegacy = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as typeof import("pdfjs-dist") & {
      default?: typeof import("pdfjs-dist");
    };
    pdfjs = (modLegacy.default || modLegacy) as typeof import("pdfjs-dist");
  } catch {
    const modStd = (await import("pdfjs-dist")) as unknown as typeof import("pdfjs-dist") & {
      default?: typeof import("pdfjs-dist");
    };
    pdfjs = (modStd.default || modStd) as typeof import("pdfjs-dist");
  }

  try {
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      if (typeof window !== "undefined" && window.location?.href && !window.location.href.startsWith("about:")) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.min.mjs", window.location.href).href;
      } else {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
      }
    }
  } catch {
    // Abaikan jika URL worker tidak didukung di lingkungan uji
  }
  return pdfjs;
}

/** Gambaran kemampuan perangkat yang dipakai untuk menentukan resolusi render peta. */
export interface LingkunganPerangkat {
  seluler: boolean;
  /** Perkiraan RAM perangkat (GB) dari navigator.deviceMemory, bila tersedia. */
  memoriGb?: number;
  jumlahCpu?: number;
}

/** Anggaran resolusi render peta: tajam bagi mata, tetap ringan bagi memori perangkat. */
export interface AnggaranResolusi {
  /** Sisi terpanjang kanvas (px). */
  sisiMaks: number;
  /** Total piksel kanvas maksimum (menjaga memori & batas kanvas HP). */
  pikselMaks: number;
  /** Kualitas JPEG penyimpanan (0-1). */
  kualitasJpeg: number;
}

export function bacaLingkunganPerangkat(): LingkunganPerangkat {
  if (typeof navigator === "undefined") return { seluler: false };
  const nav = navigator as Navigator & { deviceMemory?: number };
  const ua = nav.userAgent || "";
  let seluler = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
  if (!seluler && /Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1) seluler = true; // iPadOS
  return { seluler, memoriGb: nav.deviceMemory, jumlahCpu: nav.hardwareConcurrency };
}

/**
 * Menentukan anggaran resolusi sesuai perangkat:
 * - HP berspek rendah : 3072 px / 7 juta piksel
 * - HP / tablet       : 4096 px / 12 juta piksel (di bawah batas kanvas iOS 16,7 juta)
 * - PC / laptop       : 6144 px / 24 juta piksel
 * `sisiOverride` (opsional) hanya dapat menurunkan, tidak melampaui anggaran perangkat.
 */
export function tentukanAnggaranResolusi(
  lingkungan: LingkunganPerangkat = bacaLingkunganPerangkat(),
  sisiOverride?: number
): AnggaranResolusi {
  const rendah = lingkungan.seluler && ((lingkungan.memoriGb ?? 4) <= 3 || (lingkungan.jumlahCpu ?? 8) <= 4);
  let anggaran: AnggaranResolusi;
  if (rendah) anggaran = { sisiMaks: 3072, pikselMaks: 7_000_000, kualitasJpeg: 0.85 };
  else if (lingkungan.seluler) anggaran = { sisiMaks: 4096, pikselMaks: 12_000_000, kualitasJpeg: 0.88 };
  else anggaran = { sisiMaks: 6144, pikselMaks: 24_000_000, kualitasJpeg: 0.9 };

  if (sisiOverride && sisiOverride > 0 && sisiOverride < anggaran.sisiMaks) {
    anggaran = {
      ...anggaran,
      sisiMaks: sisiOverride,
      pikselMaks: Math.min(anggaran.pikselMaks, sisiOverride * sisiOverride)
    };
  }
  return anggaran;
}

/** Skala render (px per satuan sumber) yang tajam namun masih dalam anggaran sisi & piksel. */
export function hitungSkalaRender(
  lebarSumber: number,
  tinggiSumber: number,
  anggaran: AnggaranResolusi,
  skalaMaks = 8
): number {
  const l = Math.max(lebarSumber, 1);
  const t = Math.max(tinggiSumber, 1);
  const olehSisi = anggaran.sisiMaks / Math.max(l, t);
  const olehPiksel = Math.sqrt(anggaran.pikselMaks / (l * t));
  return Math.max(0.05, Math.min(olehSisi, olehPiksel, skalaMaks));
}

/** Menurunkan anggaran bila kanvas gagal dibuat (memori perangkat tidak cukup). */
export function turunkanAnggaranResolusi(anggaran: AnggaranResolusi, faktor: number): AnggaranResolusi {
  const f = Math.min(1, Math.max(0.2, faktor));
  return {
    sisiMaks: Math.max(512, Math.floor(anggaran.sisiMaks * f)),
    pikselMaks: Math.max(262_144, Math.floor(anggaran.pikselMaks * f * f)),
    kualitasJpeg: Math.max(0.7, anggaran.kualitasJpeg - (1 - f) * 0.2)
  };
}

async function buatDataUrlPersistenDariKanvas(canvas: HTMLCanvasElement, kualitasJpeg = 0.9): Promise<string> {
  try {
    const jpegUrl = canvas.toDataURL("image/jpeg", kualitasJpeg);
    if (jpegUrl && jpegUrl.startsWith("data:image/") && jpegUrl.length > 64) {
      return jpegUrl;
    }
  } catch {
    // Lanjut ke PNG atau Blob
  }
  try {
    const pngUrl = canvas.toDataURL("image/png");
    if (pngUrl && pngUrl.startsWith("data:image/") && pngUrl.length > 64) {
      return pngUrl;
    }
  } catch {
    // Lanjut ke Blob
  }
  if (typeof canvas.toBlob === "function") {
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) return URL.createObjectURL(blob);
    } catch {
      // Abaikan
    }
  }
  return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
}

function buatKanvasCadanganGeoPdf(ref: Partial<ReferensiGeoPdf>, lebar = 1024, tinggi = 1024): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = lebar;
  canvas.height = tinggi;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, lebar, tinggi);
    ctx.strokeStyle = "rgba(15, 118, 110, 0.2)";
    ctx.lineWidth = 2;
    const step = Math.max(64, Math.round(lebar / 8));
    for (let x = step; x < lebar; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, tinggi);
      ctx.stroke();
    }
    for (let y = step; y < tinggi; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(lebar, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, lebar - 24, tinggi - 24);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(ref.crsDeskripsi || ref.crs || "Lembar Peta GeoPDF", 36, 56);
  }
  return canvas;
}

export async function renderHalamanPdfBiasa(
  file: File | Blob,
  maxDim?: number
): Promise<{
  dataUrl: string;
  thumbnailDataUrl?: string;
  width: number;
  height: number;
  lebarPt: number;
  tinggiPt: number;
}> {
  pasangPolyfillPdfJs();
  const buffer = await file.arrayBuffer();

  try {
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      throw new Error("DOM canvas tidak tersedia.");
    }
    const pdfjs = await muatPdfJs();
    let pdf: any;
    try {
      pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const page = await pdf.getPage(1);
      const vp1 = page.getViewport({ scale: 1 });
      const anggaranAwal = tentukanAnggaranResolusi(bacaLingkunganPerangkat(), maxDim);

      let galatTerakhir: unknown = null;
      for (let percobaan = 0; percobaan < 4; percobaan++) {
        const anggaran = turunkanAnggaranResolusi(anggaranAwal, Math.pow(0.7, percobaan));
        try {
          const scale = hitungSkalaRender(vp1.width, vp1.height, anggaran);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(viewport.width));
          canvas.height = Math.max(1, Math.round(viewport.height));
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D tidak tersedia untuk merender PDF.");

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, canvas, viewport }).promise;

          const thumbnailDataUrl = buatThumbnailDataUrlDariKanvas(canvas, 240);
          const dataUrl = await buatDataUrlPersistenDariKanvas(canvas, anggaran.kualitasJpeg);
          if (dataUrl.length < 200) throw new Error("Kanvas terlalu besar untuk diekspor.");
          const hasil = {
            dataUrl,
            thumbnailDataUrl,
            width: canvas.width,
            height: canvas.height,
            lebarPt: vp1.width,
            tinggiPt: vp1.height
          };
          canvas.width = 0;
          canvas.height = 0;
          return hasil;
        } catch (err) {
          // Kanvas terlalu besar untuk memori perangkat: ulangi dengan resolusi lebih ringan.
          galatTerakhir = err;
        }
      }
      throw galatTerakhir ?? new Error("Render halaman PDF gagal.");
    } finally {
      if (pdf) {
        try {
          await (pdf as { destroy?: () => Promise<void> }).destroy?.();
        } catch {
          // Abaikan jika pembersihan worker pdfjs gagal
        }
      }
    }
  } catch (errPdfJs) {
    console.warn("Render halaman PDF dengan pdfjs gagal, menggunakan fallback pdf-lib:", errPdfJs);
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
    const p1 = doc.getPages()[0];
    const sz = p1 ? p1.getSize() : { width: 600, height: 800 };
    const cadangan = buatKanvasCadanganGeoPdf({ crsDeskripsi: "Dokumen PDF" }, Math.round(sz.width), Math.round(sz.height));
    const thumb = cadangan ? buatThumbnailDataUrlDariKanvas(cadangan, 240) : undefined;
    const dataUrl = cadangan ? await buatDataUrlPersistenDariKanvas(cadangan) : thumb || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    return {
      dataUrl,
      thumbnailDataUrl: thumb,
      width: Math.round(sz.width),
      height: Math.round(sz.height),
      lebarPt: sz.width,
      tinggiPt: sz.height
    };
  }
}

/**
 * Mengimpor GeoPDF menjadi gambar peta yang tajam namun ringan.
 * Resolusi bersifat adaptif: dihitung dari ukuran area peta di halaman PDF dan dibatasi
 * anggaran perangkat (HP berbeda dengan PC). Hanya area peta (bbox) yang dirender langsung
 * pada resolusi penuh, tanpa merender seluruh halaman lalu memotongnya (yang membuat peta blur).
 * Bila kanvas terlalu besar bagi memori perangkat, resolusi diturunkan bertahap otomatis.
 */
export async function imporGeoPdf(file: File | Blob, maxDim?: number): Promise<HasilImporGeoPdf> {
  pasangPolyfillPdfJs();
  const buffer = await file.arrayBuffer();
  const ref = await bacaReferensiGeoPdf(buffer);

  try {
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      throw new Error("DOM canvas tidak tersedia.");
    }
    const pdfjs = await muatPdfJs();
    let pdf: any;
    try {
      pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const nomorHalaman = Math.min(pdf.numPages, Math.max(1, (ref.indeksHalaman ?? 0) + 1));
      const page = await pdf.getPage(nomorHalaman);
      const vp1 = page.getViewport({ scale: 1 });
      const [x1, y1, x2, y2] = ref.bbox;
      const bboxW = Math.max(1, x2 - x1);
      const bboxH = Math.max(1, y2 - y1);
      const anggaranAwal = tentukanAnggaranResolusi(bacaLingkunganPerangkat(), maxDim);

      let galatTerakhir: unknown = null;
      for (let percobaan = 0; percobaan < 4; percobaan++) {
        const anggaran = turunkanAnggaranResolusi(anggaranAwal, Math.pow(0.7, percobaan));
        try {
          // Skala ditentukan oleh ukuran area peta (bukan seluruh halaman) agar tajam.
          const scale = hitungSkalaRender(bboxW, bboxH, anggaran);
          const viewport = page.getViewport({ scale });

          const sx = Math.max(0, Math.round(x1 * scale));
          const sy = Math.max(0, Math.round((vp1.height - y2) * scale));
          const sw = Math.max(1, Math.min(Math.round(viewport.width) - sx, Math.round(bboxW * scale)));
          const sh = Math.max(1, Math.min(Math.round(viewport.height) - sy, Math.round(bboxH * scale)));

          const kanvas = document.createElement("canvas");
          kanvas.width = sw;
          kanvas.height = sh;
          const ctx = kanvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D tidak tersedia untuk merender GeoPDF.");

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sw, sh);
          // Geser viewport sehingga hanya area peta yang tergambar, langsung di resolusi penuh.
          await page.render({
            canvasContext: ctx,
            canvas: kanvas,
            viewport,
            transform: [1, 0, 0, 1, -sx, -sy]
          }).promise;

          const thumbnailDataUrl = buatThumbnailDataUrlDariKanvas(kanvas, 240);
          const hasilUrl = await buatDataUrlPersistenDariKanvas(kanvas, anggaran.kualitasJpeg);
          if (hasilUrl.length < 200) throw new Error("Kanvas terlalu besar untuk diekspor.");
          kanvas.width = 0;
          kanvas.height = 0;

          return {
            ...ref,
            dataUrl: hasilUrl,
            thumbnailDataUrl,
            width: sw,
            height: sh
          };
        } catch (err) {
          // Kanvas terlalu besar untuk memori perangkat: ulangi dengan resolusi lebih ringan.
          galatTerakhir = err;
        }
      }
      throw galatTerakhir ?? new Error("Render GeoPDF gagal.");
    } finally {
      if (pdf) {
        try {
          await (pdf as { destroy?: () => Promise<void> }).destroy?.();
        } catch {
          // Abaikan jika pembersihan worker pdfjs gagal
        }
      }
    }
  } catch (errPdfJs) {
    console.warn("Render kanvas GeoPDF dengan pdfjs gagal, menggunakan fallback geometri:", errPdfJs);
    // Fallback tangguh apabila mesin render kanvas PDF di WebView seluler gagal:
    // georeferensi (ref) yang telah diekstrak pdf-lib tetap dipakai sepenuhnya dengan kanvas pratinjau.
    const [x1, y1, x2, y2] = ref.bbox;
    const sw = Math.max(256, Math.round(x2 - x1) || 800);
    const sh = Math.max(256, Math.round(y2 - y1) || 800);
    const cadanganCanvas = buatKanvasCadanganGeoPdf(ref, sw, sh);
    const thumbnailDataUrl = cadanganCanvas ? buatThumbnailDataUrlDariKanvas(cadanganCanvas, 240) : undefined;
    const hasilUrl = cadanganCanvas
      ? await buatDataUrlPersistenDariKanvas(cadanganCanvas)
      : thumbnailDataUrl || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    return {
      ...ref,
      dataUrl: hasilUrl,
      thumbnailDataUrl,
      width: sw,
      height: sh
    };
  }
}
