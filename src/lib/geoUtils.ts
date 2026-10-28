import { DataSpasialItem, FormatKoordinat, KoordinatTitik } from "../types";

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
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
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
 * Menggunakan rumus Spherical Excess / Shoelace Geodesic proyeksi lokal
 */
export function hitungLuasPoligonHa(titik: KoordinatTitik[]): number {
  if (titik.length < 3) return 0;
  let areaM2 = 0;
  const n = titik.length;
  for (let i = 0; i < n; i++) {
    const p1 = titik[i];
    const p2 = titik[(i + 1) % n];
    const x1 = toRad(p1.lng) * EARTH_RADIUS_M * Math.cos(toRad((p1.lat + p2.lat) / 2));
    const y1 = toRad(p1.lat) * EARTH_RADIUS_M;
    const x2 = toRad(p2.lng) * EARTH_RADIUS_M * Math.cos(toRad((p1.lat + p2.lat) / 2));
    const y2 = toRad(p2.lat) * EARTH_RADIUS_M;
    areaM2 += x1 * y2 - x2 * y1;
  }
  const luasMeterPersegi = Math.abs(areaM2) / 2;
  // 1 Hektare = 10.000 m²
  return Number((luasMeterPersegi / 10000).toFixed(3));
}

/**
 * Menghitung sudut kompas (bearing) dari titik A ke titik B (0 - 360 derajat)
 */
export function hitungBearingDerajat(a: KoordinatTitik, b: KoordinatTitik): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
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
  const idx = Math.round(((derajat % 360) / 45)) % 8;
  return arah[idx];
}

/**
 * Format koordinat ke Decimal Degrees (DD), Degrees Minutes Seconds (DMS), atau pendekatan UTM
 */
export function formatKoordinatTeks(
  lat: number,
  lng: number,
  format: FormatKoordinat = "DD"
): string {
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
  const alfa = [
    n / 2 - (2 * n2) / 3 + (5 * n3) / 16,
    (13 * n2) / 48 - (3 * n3) / 5,
    (61 * n3) / 240
  ];
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
const posisiGeoJSON = (p: KoordinatTitik): number[] =>
  p.elevasi !== undefined ? [p.lng, p.lat, p.elevasi] : [p.lng, p.lat];

const posisiKML = (p: KoordinatTitik): string =>
  p.elevasi !== undefined ? `${p.lng},${p.lat},${p.elevasi}` : `${p.lng},${p.lat}`;

const eleGPX = (p: KoordinatTitik, awalan = ""): string =>
  p.elevasi !== undefined ? `${awalan}<ele>${p.elevasi}</ele>\n` : "";

/**
 * Ekspor daftar DataSpasialItem menjadi string GeoJSON FeatureCollection standar QGIS/ArcGIS
 */
export function eksporKeGeoJSON(daftar: DataSpasialItem[]): string {
  const features = daftar.map((item) => {
    let geometry: Record<string, unknown>;
    if (item.jenisGeometri === "point") {
      const p = item.koordinat[0] || { lat: 0, lng: 0 };
      geometry = {
        type: "Point",
        coordinates: posisiGeoJSON(p)
      };
    } else if (item.jenisGeometri === "line") {
      geometry = {
        type: "LineString",
        coordinates: item.koordinat.map(posisiGeoJSON)
      };
    } else {
      const ring = item.koordinat.map(posisiGeoJSON);
      if (ring.length > 0) ring.push([...ring[0]]);
      geometry = {
        type: "Polygon",
        coordinates: [ring]
      };
    }
    return {
      type: "Feature",
      id: item.id,
      geometry,
      properties: {
        id: item.id,
        idKader: item.idKader,
        namaKader: item.namaKader,
        desaWilayah: item.desaWilayah,
        jenisGeometri: item.jenisGeometri,
        kategori: item.kategori,
        judul: item.judul,
        namaLokal: item.namaLokal || "",
        namaIlmiah: item.namaIlmiah || "",
        jumlahIndividu: item.jumlahIndividu ?? null,
        manfaatMasyarakat: item.manfaatMasyarakat || "",
        kondisiAncaman: item.kondisiAncaman || "",
        deskripsi: item.deskripsi,
        panjangKm: item.panjangKm,
        luasHa: item.luasHa,
        statusSinkron: item.statusSinkron,
        simulasi: adalahDataSimulasi(item),
        diimpor: adalahDataImpor(item),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        jumlahPembaruan: item.riwayatPembaruan.length
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
  const esc = (s: string) =>
    (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const placemarks = daftar
    .map((item) => {
      const coords = item.koordinat
        .map((p) => posisiKML(p))
        .join(" ");
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
  const esc = (s: string) =>
    (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

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
      const pts = d.koordinat
        .map(
          (p) =>
            `      <trkpt lat="${p.lat}" lon="${p.lng}">${eleGPX(p)}</trkpt>`
        )
        .join("\n");
      return `  <trk>
    <name>${esc(d.judul)} (${d.jenisGeometri})</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GeoKader Partisipatif" xmlns="http://www.topografix.com/GPX/1/1">
${wpts}
${trks}
</gpx>`;
}

/**
 * Ekspor ke CSV Master Tabel (Format Google Sheets Database)
 */
export function eksporKeCSV(daftar: DataSpasialItem[]): string {
  const header = [
    "ID_Data",
    "ID_Kader",
    "Nama_Kader",
    "Desa_Wilayah",
    "Jenis_Geometri",
    "Kategori",
    "Judul_Objek",
    "Nama_Lokal",
    "Nama_Ilmiah",
    "Jumlah_Individu",
    "Panjang_Km",
    "Luas_Ha",
    "Koordinat_WKT",
    "Status_Sinkron",
    "Waktu_Rekam"
  ];
  const escCsv = (val: unknown) => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = daftar.map((d) =>
    [
      d.id,
      d.idKader,
      d.namaKader,
      d.desaWilayah,
      d.jenisGeometri,
      d.kategori,
      d.judul,
      d.namaLokal || "",
      d.namaIlmiah || "",
      d.jumlahIndividu ?? "",
      d.panjangKm,
      d.luasHa,
      keWKT(d),
      d.statusSinkron,
      d.createdAt
    ]
      .map(escCsv)
      .join(",")
  );
  return "\uFEFF" + [header.join(","), ...rows].join("\r\n");
}
