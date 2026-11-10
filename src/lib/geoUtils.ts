import { DataSpasialItem, FormatKoordinat, KoordinatTitik } from "../types";
import {
  KOLOM_TABEL_LINE_PRM_AID,
  KOLOM_TABEL_POINT_PRM_AID,
  KOLOM_TABEL_POLYGON_PRM_AID,
  susunAtributLinePrmAid,
  susunAtributPointPrmAid,
  susunAtributPolygonPrmAid
} from "./atributPrmAid";

const EARTH_RADIUS_M = 6371008.8;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Menghitung jarak Haversine antara 2 titik koordinat dalam meter
 */
export function hitungJarakMeter(a: KoordinatTitik, b: KoordinatTitik): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return EARTH_RADIUS_M * c;
}

/**
 * Menghitung panjang total garis/lintasan tracking dalam Kilometer (km)
 */
export function hitungPanjangGarisKm(titik: KoordinatTitik[]): number {
  if (titik.length < 2) return 0;
  let totalMeter = 0;
  for (let i = 1; i < titik.length; i++) {
    totalMeter += hitungJarakMeter(titik[i - 1], titik[i]);
  }
  return Number((totalMeter / 1000).toFixed(3));
}

/**
 * Menghitung luas poligon pada permukaan bumi dalam Hektare (Ha)
 * Integral luas sferis untuk poligon sederhana; hasil adalah luas horizontal, bukan luas lereng.
 */
export function hitungLuasPoligonHa(titik: KoordinatTitik[]): number {
  if (titik.length < 3) return 0;
  // Integral sferis: invariant terhadap urutan sudut dan aman di antimeridian.
  let sum = 0;
  for (let i = 0; i < titik.length; i++) {
    const a = titik[i],
      b = titik[(i + 1) % titik.length];
    const delta = ((b.lng - a.lng + 540) % 360) - 180;
    sum += toRad(delta) * (2 + Math.sin(toRad(a.lat)) + Math.sin(toRad(b.lat)));
  }
  const sphere = 4 * Math.PI * EARTH_RADIUS_M ** 2;
  const area = ((Math.abs(sum) * EARTH_RADIUS_M ** 2) / 2) % sphere;
  return Number((Math.min(area, sphere - area) / 10000).toFixed(3));
}

/**
 * Menghitung sudut kompas (bearing) dari titik A ke titik B (0 - 360 derajat)
 */
function segmenBerpotongan(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean {
  const ccw = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/**
 * Validasi integritas geometri poligon:
 * - Minimal 3 titik sudut unik
 * - Bebas dari sisi saling memotong (self-intersecting / angka 8)
 */
export function validasiPoligon(titik: KoordinatTitik[]): { valid: boolean; pesan?: string } {
  if (!Array.isArray(titik) || titik.length < 3) {
    return { valid: false, pesan: "Poligon minimal membutuhkan 3 titik sudut." };
  }
  const unik = new Set(titik.map((p) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`));
  if (unik.size < 3) {
    return { valid: false, pesan: "Poligon harus memiliki minimal 3 titik sudut unik yang berbeda." };
  }
  const n = titik.length;
  const pts = titik.map((p) => ({ x: p.lng, y: p.lat }));
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if ((i === 0 && j === n - 1) || Math.abs(i - j) <= 1) continue;
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      if (segmenBerpotongan(a1, a2, b1, b2)) {
        return { valid: false, pesan: "Batas poligon saling memotong (self-intersecting)." };
      }
    }
  }
  return { valid: true };
}

export function hitungBearingDerajat(a: KoordinatTitik, b: KoordinatTitik): number {
  if (a.lat === b.lat && a.lng === b.lng) return 0;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = toDeg(Math.atan2(y, x));
  return Math.round((brng + 360) % 360);
}

export function namaArahKompas(derajat: number): string {
  const arah = [
    "U (Utara)",
    "TL (Timur Laut)",
    "T (Timur)",
    "TG (Tenggara)",
    "S (Selatan)",
    "BD (Barat Daya)",
    "B (Barat)",
    "BL (Barat Laut)"
  ];
  const idx = Math.round((derajat % 360) / 45) % 8;
  return arah[idx];
}

/**
 * Format koordinat ke Decimal Degrees (DD), Degrees Minutes Seconds (DMS), atau pendekatan UTM
 */
export function formatKoordinatTeks(lat: number, lng: number, format: FormatKoordinat = "DD"): string {
  if (format === "DD") {
    return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
  }
  if (format === "DMS") {
    const toDMS = (val: number, pos: string, neg: string) => {
      const arah = val >= 0 ? pos : neg;
      const abs = Math.abs(val);
      const d = Math.floor(abs);
      const mFloat = (abs - d) * 60;
      const m = Math.floor(mFloat);
      const s = ((mFloat - m) * 60).toFixed(1);
      return `${d}°${m}'${s}"${arah}`;
    };
    return `${toDMS(lat, "LU", "LS")} ${toDMS(lng, "BT", "BB")}`;
  }
  const utm = konversiUTM(lat, lng);
  if (!utm) return "UTM tidak berlaku di luar lintang 80°S sampai 84°U";
  return `UTM ${utm.zona}${utm.belahan} ${utm.timur}mE ${utm.utara}mN`;
}

export interface HasilUTM {
  zona: number;
  belahan: "N" | "S";
  timur: number;
  utara: number;
}

/**
 * Koordinat UTM pada elipsoid WGS84 (proyeksi Transverse Mercator, deret Krüger).
 * Sama dengan hasil PROJ dalam hitungan milimeter. Mengembalikan null di luar 80°S-84°U.
 */
export function konversiUTM(lat: number, lng: number): HasilUTM | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -80 || lat > 84) return null;
  const A_WGS84 = 6378137;
  const F_WGS84 = 1 / 298.257223563;
  const K0 = 0.9996;
  const n = F_WGS84 / (2 - F_WGS84);
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n3 * n;
  const aBulat = (A_WGS84 / (1 + n)) * (1 + n2 / 4 + n4 / 64);
  const alfa = [n / 2 - (2 * n2) / 3 + (5 * n3) / 16, (13 * n2) / 48 - (3 * n3) / 5, (61 * n3) / 240];
  const e = Math.sqrt(F_WGS84 * (2 - F_WGS84));

  let lngNorm = ((((lng + 180) % 360) + 360) % 360) - 180;
  if (lngNorm === -180 && lng > 0) lngNorm = 180; // tepat 180° dihitung di zona 60
  const zona = Math.min(60, Math.floor((lngNorm + 180) / 6) + 1);
  const lambda0 = toRad((zona - 1) * 6 - 180 + 3);
  const phi = toRad(lat);
  const dLambda = toRad(lngNorm) - lambda0;

  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xiAksen = Math.atan2(t, Math.cos(dLambda));
  const etaAksen = Math.atanh(Math.sin(dLambda) / Math.sqrt(1 + t * t));

  let xi = xiAksen;
  let eta = etaAksen;
  for (let j = 1; j <= 3; j++) {
    xi += alfa[j - 1] * Math.sin(2 * j * xiAksen) * Math.cosh(2 * j * etaAksen);
    eta += alfa[j - 1] * Math.cos(2 * j * xiAksen) * Math.sinh(2 * j * etaAksen);
  }

  return {
    zona,
    belahan: lat >= 0 ? "N" : "S",
    timur: Math.round(500000 + K0 * aBulat * eta),
    utara: Math.round((lat < 0 ? 10000000 : 0) + K0 * aBulat * xi)
  };
}

/**
 * Konversi koordinat UTM (Easting, Northing, Zona, Belahan) ke koordinat geografis WGS84 (Lat, Lng).
 * Menggunakan invers deret Krüger dengan akurasi milimeter yang reversibel dengan konversiUTM.
 */
export function konversiUtmKeWgs84(timur: number, utara: number, zona: number, belahan: "N" | "S"): { lat: number; lng: number } {
  const A_WGS84 = 6378137;
  const F_WGS84 = 1 / 298.257223563;
  const K0 = 0.9996;
  const n = F_WGS84 / (2 - F_WGS84);
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n3 * n;
  const aBulat = (A_WGS84 / (1 + n)) * (1 + n2 / 4 + n4 / 64);
  const beta = [n / 2 - (2 * n2) / 3 + (37 * n3) / 96, n2 / 48 + n3 / 15, (17 * n3) / 480];
  const e = Math.sqrt(F_WGS84 * (2 - F_WGS84));

  const e0 = 500000;
  const n0 = belahan === "S" ? 10000000 : 0;
  const eta = (timur - e0) / (K0 * aBulat);
  const xi = (utara - n0) / (K0 * aBulat);

  let xiAksen = xi;
  let etaAksen = eta;
  for (let j = 1; j <= 3; j++) {
    xiAksen -= beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaAksen -= beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }

  const sinhEtaAksen = Math.sinh(etaAksen);
  const sinXiAksen = Math.sin(xiAksen);
  const cosXiAksen = Math.cos(xiAksen);

  const denom = Math.sqrt(sinhEtaAksen * sinhEtaAksen + cosXiAksen * cosXiAksen);
  const sinhPsi = sinXiAksen / (denom || 1e-12);
  const psi = Math.asinh(sinhPsi);
  const dLambda = Math.atan2(sinhEtaAksen, cosXiAksen);

  const lambda0 = toRad((zona - 1) * 6 - 180 + 3);
  let lng = toDeg(lambda0 + dLambda);
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;

  // Invers Newton-Raphson untuk lat geodetik
  let phi = 2 * Math.atan(Math.exp(psi)) - Math.PI / 2;
  for (let i = 0; i < 7; i++) {
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    const curPsi = Math.atanh(s) - e * Math.atanh(e * s);
    const diff = curPsi - psi;
    const deriv = (1 - e * e) / ((1 - e * e * s * s) * c || 1e-12);
    phi -= diff / deriv;
    if (Math.abs(diff) < 1e-12) break;
  }
  const lat = toDeg(phi);

  return {
    lat: Number(lat.toFixed(7)),
    lng: Number(lng.toFixed(7))
  };
}

/**
 * Konversi koordinat Web Mercator (EPSG:3857) ke WGS84 geografis (Lat, Lng)
 */
export function konversiWebMercatorKeWgs84(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / 20037508.342789244) * 180;
  const lat = (Math.atan(Math.sinh(y / 6378137.0)) * 180) / Math.PI;
  return {
    lat: Math.max(-85.05112878, Math.min(85.05112878, Number(lat.toFixed(7)))),
    lng: Math.max(-180, Math.min(180, Number(lng.toFixed(7))))
  };
}

/**
 * True bila ada titik hasil mode simulasi (bukan GPS perangkat).
 */
export function adalahDataSimulasi(item: DataSpasialItem): boolean {
  return item.koordinat.some((k) => k.simulasi === true);
}

/**
 * True bila data berasal dari berkas impor. Data lama yang diimpor sebelum ada penanda
 * dikenali dari awalan ID "IMP-".
 */
export function adalahDataImpor(item: DataSpasialItem): boolean {
  return item.diimpor === true || item.id.startsWith("IMP-");
}

/**
 * Menentukan apakah data dihitung untuk capaian paket dan skor level.
 * Data simulasi tidak pernah dihitung. Data impor baru dihitung setelah diverifikasi admin.
 */
export function dihitungUntukCapaian(item: DataSpasialItem): boolean {
  if (adalahDataSimulasi(item)) return false;
  if (adalahDataImpor(item) && item.statusSinkron !== "terverifikasi") return false;
  return true;
}

/**
 * Konversi ke WKT (Well-Known Text) untuk disimpan di kolom Google Sheets
 */
export function keWKT(item: DataSpasialItem): string {
  const k = item.koordinat;
  if (!k.length) return "EMPTY";
  if (item.jenisGeometri === "point") {
    return `POINT(${k[0].lng.toFixed(6)} ${k[0].lat.toFixed(6)})`;
  }
  if (item.jenisGeometri === "line") {
    const pts = k.map((p) => `${p.lng.toFixed(6)} ${p.lat.toFixed(6)}`).join(", ");
    return `LINESTRING(${pts})`;
  }
  const closed = [...k, k[0]];
  const pts = closed.map((p) => `${p.lng.toFixed(6)} ${p.lat.toFixed(6)}`).join(", ");
  return `POLYGON((${pts}))`;
}

/** Posisi GeoJSON: elevasi hanya ditulis bila diketahui (tidak diganti 0) */
const posisiGeoJSON = (p: KoordinatTitik): number[] => (p.elevasi !== undefined ? [p.lng, p.lat, p.elevasi] : [p.lng, p.lat]);

const posisiKML = (p: KoordinatTitik): string => (p.elevasi !== undefined ? `${p.lng},${p.lat},${p.elevasi}` : `${p.lng},${p.lat}`);

const eleGPX = (p: KoordinatTitik, awalan = ""): string => (p.elevasi !== undefined ? `${awalan}<ele>${p.elevasi}</ele>\n` : "");

/**
 * Ekspor daftar DataSpasialItem menjadi string GeoJSON FeatureCollection standar WebGIS PRM-AID / QGIS / ArcGIS.
 * Struktur atribut tabel (`properties`) menyesuaikan jenis geometri:
 * - Polygon : | label | luas_ha | keterangan | url | tepi | warna |
 * - Line    : | label | panjang_m | keterangan | url | warna |
 * - Point   : | label | kategori | keterangan | url | simbol |
 */
export function eksporKeGeoJSON(daftar: DataSpasialItem[]): string {
  const features = daftar.map((item) => {
    let geometry: Record<string, unknown>;
    let atributPrmAid: Record<string, unknown>;
    if (item.jenisGeometri === "point") {
      const p = item.koordinat[0] || { lat: 0, lng: 0 };
      geometry = {
        type: "Point",
        coordinates: posisiGeoJSON(p)
      };
      atributPrmAid = { ...susunAtributPointPrmAid(item) };
    } else if (item.jenisGeometri === "line") {
      geometry = {
        type: "LineString",
        coordinates: item.koordinat.map(posisiGeoJSON)
      };
      const panjangKm = item.panjangKm || hitungPanjangGarisKm(item.koordinat);
      atributPrmAid = { ...susunAtributLinePrmAid({ ...item, panjangKm }) };
    } else {
      const ring = item.koordinat.map(posisiGeoJSON);
      if (ring.length > 0) ring.push([...ring[0]]);
      geometry = {
        type: "Polygon",
        coordinates: [ring]
      };
      const luasHa = item.luasHa || hitungLuasPoligonHa(item.koordinat);
      atributPrmAid = { ...susunAtributPolygonPrmAid({ ...item, luasHa }) };
    }
    const sim = adalahDataSimulasi(item);
    const imp = adalahDataImpor(item);
    return {
      type: "Feature",
      id: item.id,
      geometry,
      properties: {
        ...atributPrmAid,
        ...(sim ? { simulasi: true } : {}),
        ...(imp ? { diimpor: true } : {})
      }
    };
  });

  return JSON.stringify(
    {
      type: "FeatureCollection",
      name: "Database_Pemetaan_Partisipatif_Kader",
      crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" }
      },
      features
    },
    null,
    2
  );
}

/**
 * Ekspor ke KML (Google Earth / Avenza Maps)
 */
export function eksporKeKML(daftar: DataSpasialItem[]): string {
  const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const placemarks = daftar
    .map((item) => {
      const coords = item.koordinat.map((p) => posisiKML(p)).join(" ");
      let geomXml: string;
      if (item.jenisGeometri === "point") {
        geomXml = `<Point><coordinates>${coords}</coordinates></Point>`;
      } else if (item.jenisGeometri === "line") {
        geomXml = `<LineString><tessellate>1</tessellate><coordinates>${coords}</coordinates></LineString>`;
      } else {
        const first = item.koordinat[0];
        const closed = first ? `${coords} ${posisiKML(first)}` : coords;
        geomXml = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${closed}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
      }
      return `    <Placemark>
      <name>${esc(item.judul)}</name>
      <description>${esc(
        `[${item.kategori}] ${item.deskripsi} | Kader: ${item.namaKader} (${item.desaWilayah}) | Panjang: ${item.panjangKm} km | Luas: ${item.luasHa} Ha`
      )}</description>
      ${geomXml}
    </Placemark>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Database Pemetaan Partisipatif Kader</name>
${placemarks}
  </Document>
</kml>`;
}

/**
 * Ekspor ke GPX (Garmin / AlpineQuest / Avenza)
 */
export function eksporKeGPX(daftar: DataSpasialItem[]): string {
  const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const wpts = daftar
    .filter((d) => d.jenisGeometri === "point" && d.koordinat[0])
    .map((d) => {
      const p = d.koordinat[0];
      return `  <wpt lat="${p.lat}" lon="${p.lng}">
${eleGPX(p, "    ")}    <name>${esc(d.judul)}</name>
    <desc>${esc(`${d.kategori}: ${d.deskripsi}`)}</desc>
  </wpt>`;
    })
    .join("\n");

  const trks = daftar
    .filter((d) => d.jenisGeometri !== "point")
    .map((d) => {
      const pts = d.koordinat.map((p) => `      <trkpt lat="${p.lat}" lon="${p.lng}">${eleGPX(p)}</trkpt>`).join("\n");
      return `  <trk>
    <name>${esc(d.judul)} (${d.jenisGeometri})</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Titik Tapak" xmlns="http://www.topografix.com/GPX/1/1">
${wpts}
${trks}
</gpx>`;
}

/** Menetralkan awalan formula berbahaya (=, +, -, @, tab, CR) agar tidak dieksekusi di Excel/Calc/Sheets */
/**
 * Membersihkan input teks survei dari tag skrip berbahaya atau injeksi HTML
 * sambil tetap mempertahankan karakter emoji (🌲⚠️) dan tanda baca wajar
 */
export function sanitasiTeksInput(teks: string | undefined | null): string {
  if (!teks) return "";
  return teks
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .trim();
}

export function sanitasiFormulaCsv(str: string): string {
  if (/^[=+\-@]/.test(str) && !/^-[0-9]+(\.[0-9]+)?$/.test(str)) {
    return `'${str}`;
  }
  if (/^[\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Ekspor ke CSV Tabel Atribut standar WebGIS PRM-AID:
 * - Bila seluruh daftar berupa Polygon : | label | luas_ha | keterangan | url | tepi | warna |
 * - Bila seluruh daftar berupa Line    : | label | panjang_m | keterangan | url | warna |
 * - Bila seluruh daftar berupa Point   : | label | kategori | keterangan | url | simbol |
 * - Bila campuran berbagai geometri    : menggabungkan kolom PRM-AID + jenis_geometri + koordinat_wkt
 */
export function eksporKeCSV(daftar: DataSpasialItem[]): string {
  const escCsv = (val: unknown) => {
    const str = sanitasiFormulaCsv(String(val ?? ""));
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const semuaPolygon = daftar.length > 0 && daftar.every((d) => d.jenisGeometri === "polygon");
  const semuaLine = daftar.length > 0 && daftar.every((d) => d.jenisGeometri === "line");
  const semuaPoint = daftar.length > 0 && daftar.every((d) => d.jenisGeometri === "point");

  if (semuaPolygon) {
    const header = [...KOLOM_TABEL_POLYGON_PRM_AID];
    const rows = daftar.map((d) => {
      const luasHa = d.luasHa || hitungLuasPoligonHa(d.koordinat);
      const a = susunAtributPolygonPrmAid({ ...d, luasHa });
      return [a.label, a.luas_ha, a.keterangan, a.url, a.tepi, a.warna].map(escCsv).join(",");
    });
    return "\uFEFF" + [header.join(","), ...rows].join("\r\n");
  }

  if (semuaLine) {
    const header = [...KOLOM_TABEL_LINE_PRM_AID];
    const rows = daftar.map((d) => {
      const panjangKm = d.panjangKm || hitungPanjangGarisKm(d.koordinat);
      const a = susunAtributLinePrmAid({ ...d, panjangKm });
      return [a.label, a.panjang_m, a.keterangan, a.url, a.warna].map(escCsv).join(",");
    });
    return "\uFEFF" + [header.join(","), ...rows].join("\r\n");
  }

  if (semuaPoint) {
    const header = [...KOLOM_TABEL_POINT_PRM_AID];
    const rows = daftar.map((d) => {
      const a = susunAtributPointPrmAid(d);
      return [a.label, a.kategori, a.keterangan, a.url, a.simbol].map(escCsv).join(",");
    });
    return "\uFEFF" + [header.join(","), ...rows].join("\r\n");
  }

  const header = [
    "label",
    "jenis_geometri",
    "luas_ha",
    "panjang_m",
    "kategori",
    "keterangan",
    "url",
    "tepi",
    "warna",
    "simbol",
    "koordinat_wkt"
  ];
  const rows = daftar.map((d) => {
    if (d.jenisGeometri === "polygon") {
      const luasHa = d.luasHa || hitungLuasPoligonHa(d.koordinat);
      const a = susunAtributPolygonPrmAid({ ...d, luasHa });
      return [a.label, "polygon", a.luas_ha, "", d.kategori, a.keterangan, a.url, a.tepi, a.warna, "", keWKT(d)]
        .map(escCsv)
        .join(",");
    }
    if (d.jenisGeometri === "line") {
      const panjangKm = d.panjangKm || hitungPanjangGarisKm(d.koordinat);
      const a = susunAtributLinePrmAid({ ...d, panjangKm });
      return [a.label, "line", "", a.panjang_m, d.kategori, a.keterangan, a.url, "", a.warna, "", keWKT(d)]
        .map(escCsv)
        .join(",");
    }
    const a = susunAtributPointPrmAid(d);
    return [a.label, "point", "", "", a.kategori, a.keterangan, a.url, "", "", a.simbol, keWKT(d)]
      .map(escCsv)
      .join(",");
  });
  return "\uFEFF" + [header.join(","), ...rows].join("\r\n");
}

/** WGS84 bornes; elevasi/akurasi juga harus bernilai hingga bila disediakan. */
export function koordinatValid(p: KoordinatTitik): boolean {
  return (
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lng) <= 180 &&
    (p.elevasi === undefined || Number.isFinite(p.elevasi)) &&
    (p.akurasi === undefined || (Number.isFinite(p.akurasi) && p.akurasi > 0))
  );
}

/** Rata-rata berbobot pada bola; aman melintasi bujur ±180°. Tidak mengklaim RTK/geodetik. */
export function hitungRataRataGps(sampel: KoordinatTitik[]): import("../types").HasilRataRataGps {
  const sah = sampel.filter((p) => koordinatValid(p) && !p.simulasi && p.akurasi !== undefined);
  if (!sah.length) throw new Error("Belum ada sampel GPS valid dengan akurasi diketahui.");
  const acuan = sah.reduce((n, p) => Math.min(n, p.akurasi!), Infinity);
  let x = 0,
    y = 0,
    z = 0,
    bobot = 0,
    elevasi = 0,
    bobotElevasi = 0;
  for (const p of sah) {
    const w = (acuan / p.akurasi!) ** 2;
    const lat = toRad(p.lat),
      lng = toRad(p.lng);
    x += w * Math.cos(lat) * Math.cos(lng);
    y += w * Math.cos(lat) * Math.sin(lng);
    z += w * Math.sin(lat);
    bobot += w;
    if (p.elevasi !== undefined) {
      elevasi += w * p.elevasi;
      bobotElevasi += w;
    }
  }
  if (Math.hypot(x, y, z) / bobot < 1e-6) throw new Error("Sampel GPS terlalu berjauhan.");
  const titik: KoordinatTitik = {
    lat: toDeg(Math.atan2(z, Math.hypot(x, y))),
    lng: toDeg(Math.atan2(y, x)),
    // Korelasi antar fix berarti 1/sqrt(sum(w)) terlalu optimistis: pakai RMS pengamatan.
    akurasi: Math.sqrt(sah.reduce((n, p) => n + (acuan / p.akurasi!) ** 2 * p.akurasi! ** 2, 0) / bobot)
  };
  if (bobotElevasi) titik.elevasi = elevasi / bobotElevasi;
  const waktu = sah
    .map((p) => Date.parse(p.timestamp ?? ""))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (waktu.length) titik.timestamp = new Date(waktu[waktu.length - 1]).toISOString();
  const sebaranMeter = Math.sqrt(sah.reduce((n, p) => n + hitungJarakMeter(titik, p) ** 2 * (acuan / p.akurasi!) ** 2, 0) / bobot);
  titik.akurasi = Math.max(titik.akurasi!, sebaranMeter);
  return {
    titik,
    jumlahSampel: sah.length,
    durasiDetik: waktu.length > 1 ? (waktu.at(-1)! - waktu[0]) / 1000 : 0,
    sebaranMeter,
    metode: "inverse_variance"
  };
}

function bearingRad(a: KoordinatTitik, b: KoordinatTitik): number {
  const dl = toRad(b.lng - a.lng),
    la = toRad(a.lat),
    lb = toRad(b.lat);
  return Math.atan2(Math.sin(dl) * Math.cos(lb), Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dl));
}

/** Jarak ke segmen geodesik, dalam meter; titik di luar segmen memakai ujung terdekat. */
function jarakKeSegmen(p: KoordinatTitik, a: KoordinatTitik, b: KoordinatTitik): number {
  const panjang = hitungJarakMeter(a, b) / EARTH_RADIUS_M;
  if (panjang < 1e-12) return hitungJarakMeter(p, a);
  const d = hitungJarakMeter(a, p) / EARTH_RADIUS_M,
    arah = bearingRad(a, p) - bearingRad(a, b);
  const sepanjang = Math.atan2(Math.sin(d) * Math.cos(arah), Math.cos(d));
  if (sepanjang < 0 || sepanjang > panjang) return Math.min(hitungJarakMeter(p, a), hitungJarakMeter(p, b));
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.sin(d) * Math.sin(arah))))) * EARTH_RADIUS_M;
}

/** Iteratif: tidak meluapkan call stack pada track panjang. Titik asli dan metadata dipertahankan. */
export function sederhanakanJalurDouglasPeucker(titik: KoordinatTitik[], toleransiMeter = 2): KoordinatTitik[] {
  if (!Number.isFinite(toleransiMeter) || toleransiMeter < 0) throw new Error("Toleransi jalur tidak valid.");
  if (titik.some((p) => !koordinatValid(p))) throw new Error("Koordinat jalur tidak valid.");
  if (titik.length <= 2 || toleransiMeter === 0) return [...titik];
  const ambil = new Set([0, titik.length - 1]),
    tugas: [number, number][] = [[0, titik.length - 1]];
  while (tugas.length) {
    const [awal, akhir] = tugas.pop()!;
    let maks = toleransiMeter,
      indeks = -1;
    for (let i = awal + 1; i < akhir; i++) {
      const d = jarakKeSegmen(titik[i], titik[awal], titik[akhir]);
      if (d > maks) {
        maks = d;
        indeks = i;
      }
    }
    if (indeks >= 0) {
      ambil.add(indeks);
      tugas.push([awal, indeks], [indeks, akhir]);
    }
  }
  return [...ambil].sort((a, b) => a - b).map((i) => titik[i]);
}

const samaTitik = (a: KoordinatTitik, b: KoordinatTitik) => a.lat === b.lat && a.lng === b.lng;
export function cincinTerbuka(titik: KoordinatTitik[]): KoordinatTitik[] {
  return titik.length > 1 && samaTitik(titik[0], titik.at(-1)!) ? titik.slice(0, -1) : [...titik];
}

/** Validasi untuk batas lapangan north-up dengan busur bujur pendek, termasuk sentuhan/ruas tumpang tindih. */
export function validasiGeometri(jenis: DataSpasialItem["jenisGeometri"], titik: KoordinatTitik[]): string[] {
  if (titik.some((p) => !koordinatValid(p))) return ["Koordinat tidak valid."];
  const k = jenis === "polygon" ? cincinTerbuka(titik) : titik;
  if (jenis === "point") return k.length === 1 ? [] : ["Titik harus mempunyai satu koordinat."];
  if (k.length < (jenis === "line" ? 2 : 3)) return ["Jumlah sudut geometri belum cukup."];
  if (k.some((p, i) => i > 0 && samaTitik(p, k[i - 1]))) return ["Terdapat vertex berulang."];
  if (jenis === "line") return k.some((p, i) => i > 0 && hitungJarakMeter(k[i - 1], p) > 0.001) ? [] : ["Jalur tidak memiliki panjang."];
  const p = k.map((v) => ({ ...v }));
  for (let i = 1; i < p.length; i++) p[i].lng = p[i - 1].lng + ((p[i].lng - p[i - 1].lng + 540) % 360) - 180;
  const orient = (a: KoordinatTitik, b: KoordinatTitik, c: KoordinatTitik) =>
    (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  const di = (a: KoordinatTitik, b: KoordinatTitik, c: KoordinatTitik) =>
    Math.abs(orient(a, b, c)) < 1e-12 &&
    c.lng >= Math.min(a.lng, b.lng) - 1e-12 &&
    c.lng <= Math.max(a.lng, b.lng) + 1e-12 &&
    c.lat >= Math.min(a.lat, b.lat) - 1e-12 &&
    c.lat <= Math.max(a.lat, b.lat) + 1e-12;
  for (let i = 0; i < p.length; i++) {
    const a = p[(i + p.length - 1) % p.length],
      b = p[i],
      c = p[(i + 1) % p.length];
    if (di(a, b, c) || di(b, c, a)) return ["Ruas poligon berbalik dan tumpang tindih."];
  }
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        c = p[j],
        d = p[(j + 1) % p.length];
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      if (
        (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) ||
        di(a, b, c) ||
        di(a, b, d) ||
        di(c, d, a) ||
        di(c, d, b)
      )
        return ["Poligon berpotongan atau menyentuh dirinya sendiri."];
    }
  return hitungLuasPoligonMeter2(k) > 0.001 ? [] : ["Poligon tidak memiliki luas."];
}

export function hitungLuasPoligonMeter2(titik: KoordinatTitik[]): number {
  if (titik.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < titik.length; i++) {
    const a = titik[i],
      b = titik[(i + 1) % titik.length];
    sum += toRad(((b.lng - a.lng + 540) % 360) - 180) * (2 + Math.sin(toRad(a.lat)) + Math.sin(toRad(b.lat)));
  }
  const bola = 4 * Math.PI * EARTH_RADIUS_M ** 2,
    luas = ((Math.abs(sum) * EARTH_RADIUS_M ** 2) / 2) % bola;
  return Math.min(luas, bola - luas);
}

export function snapKeVertex(titik: KoordinatTitik, kandidat: KoordinatTitik[], toleransiMeter = 5): KoordinatTitik {
  if (!koordinatValid(titik) || !Number.isFinite(toleransiMeter) || toleransiMeter < 0) throw new Error("Parameter snapping tidak valid.");
  let hasil = titik,
    jarak = toleransiMeter;
  for (const p of kandidat)
    if (koordinatValid(p)) {
      const d = hitungJarakMeter(titik, p);
      if (d <= jarak) {
        hasil = { ...titik, lat: p.lat, lng: p.lng };
        jarak = d;
      }
    }
  return hasil;
}

/** Riwayat immutable; suntingan setelah Undo membuang cabang Redo. */
export function buatEditorVertex(awal: KoordinatTitik[] = []) {
  let kini = awal.map((p) => ({ ...p }));
  const mundur: KoordinatTitik[][] = [],
    maju: KoordinatTitik[][] = [];
  return {
    titik: () => kini.map((p) => ({ ...p })),
    ubah(baru: KoordinatTitik[]) {
      mundur.push(kini);
      kini = baru.map((p) => ({ ...p }));
      maju.length = 0;
    },
    undo() {
      if (mundur.length) {
        maju.push(kini);
        kini = mundur.pop()!;
      }
    },
    redo() {
      if (maju.length) {
        mundur.push(kini);
        kini = maju.pop()!;
      }
    }
  };
}

/** Tidak memotong WKT menjadi sintaks rusak. Geometri lengkap selalu di GeoJSON. */
export function wktUntukSpreadsheet(item: DataSpasialItem, tautanGeojson = ""): { wkt: string; geometriEksternal: boolean } {
  const penuh = keWKT(item);
  if (penuh.length <= 40_000) return { wkt: penuh, geometriEksternal: false };
  const ringkas = item.jenisGeometri === "line" ? keWKT({ ...item, koordinat: sederhanakanJalurDouglasPeucker(item.koordinat, 2) }) : "";
  return {
    wkt: ringkas && ringkas.length <= 40_000 ? ringkas : `GEOMETRI_DI_GEOJSON${tautanGeojson ? ": " + tautanGeojson : ""}`,
    geometriEksternal: true
  };
}
