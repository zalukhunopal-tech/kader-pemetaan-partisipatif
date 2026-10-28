import { DataSpasialItem, JenisGeometri, KategoriSurvei, KoordinatTitik } from "../types";
import { hitungLuasPoligonHa, hitungPanjangGarisKm } from "./geoUtils";
import { buatId } from "./id";

/**
 * IMPOR BERKAS (GeoJSON, KML, GPX)
 * Setiap fitur divalidasi sebelum menjadi objek: tipe geometri, rentang koordinat, dan jumlah
 * titik minimum. Fitur yang tidak valid dilewati dan dilaporkan, bukan diimpor setengah rusak.
 */

export const BATAS_FITUR_IMPOR = 5000;
export const BATAS_BYTE_IMPOR = 10_000_000;

export const KATEGORI_VALID: KategoriSurvei[] = [
  "Flora",
  "Fauna",
  "Mata Air",
  "Tanda Batas",
  "Ancaman / Temuan",
  "Wilayah Adat / Lahan"
];

export interface FiturImpor {
  jenisGeometri: JenisGeometri;
  koordinat: KoordinatTitik[];
  judul?: string;
  kategori?: KategoriSurvei;
  namaLokal?: string;
  deskripsi?: string;
  simulasi?: boolean;
}

export interface HasilParse {
  format: "GeoJSON" | "KML" | "GPX";
  fitur: FiturImpor[];
  /** Alasan untuk setiap fitur yang dilewati */
  dilewati: string[];
}

const teks = (v: unknown, maks = 500): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, maks) : undefined;
};

function posisiValid(p: unknown): KoordinatTitik | null {
  if (!Array.isArray(p) || p.length < 2) return null;
  const [lng, lat, ele] = p as unknown[];
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const t: KoordinatTitik = { lat, lng };
  if (typeof ele === "number" && Number.isFinite(ele)) t.elevasi = ele;
  return t;
}

const samaTitik = (a: KoordinatTitik, b: KoordinatTitik) => a.lat === b.lat && a.lng === b.lng;

interface Bentuk {
  jenis: JenisGeometri;
  koordinat: KoordinatTitik[];
}

/** Menguraikan satu geometri GeoJSON menjadi satu atau beberapa bentuk; alasan dilaporkan lewat `lapor` */
function uraikanGeometri(g: unknown, lapor: (alasan: string) => void): Bentuk[] {
  if (!g || typeof g !== "object") {
    lapor("fitur tanpa geometri");
    return [];
  }
  const geo = g as { type?: string; coordinates?: unknown; geometries?: unknown[] };

  const baris = (c: unknown, minimal: number): KoordinatTitik[] | null => {
    if (!Array.isArray(c)) return null;
    const hasil: KoordinatTitik[] = [];
    for (const p of c) {
      const t = posisiValid(p);
      if (!t) return null;
      hasil.push(t);
    }
    return hasil.length >= minimal ? hasil : null;
  };

  const poligon = (c: unknown): Bentuk | null => {
    if (!Array.isArray(c) || c.length === 0) return null;
    const cincin = baris(c[0], 3);
    if (!cincin) return null;
    // Cincin GeoJSON ditutup dengan titik pertama; aplikasi menyimpan cincin terbuka
    const terbuka =
      cincin.length > 3 && samaTitik(cincin[0], cincin[cincin.length - 1]) ? cincin.slice(0, -1) : cincin;
    return terbuka.length >= 3 ? { jenis: "polygon", koordinat: terbuka } : null;
  };

  const bentuk: Bentuk[] = [];
  switch (geo.type) {
    case "Point": {
      const t = posisiValid(geo.coordinates);
      if (t) bentuk.push({ jenis: "point", koordinat: [t] });
      else lapor("koordinat titik tidak valid");
      break;
    }
    case "MultiPoint": {
      for (const p of Array.isArray(geo.coordinates) ? geo.coordinates : []) {
        const t = posisiValid(p);
        if (t) bentuk.push({ jenis: "point", koordinat: [t] });
        else lapor("koordinat titik tidak valid");
      }
      break;
    }
    case "LineString": {
      const k = baris(geo.coordinates, 2);
      if (k) bentuk.push({ jenis: "line", koordinat: k });
      else lapor("jalur butuh minimal 2 titik dengan koordinat valid");
      break;
    }
    case "MultiLineString": {
      for (const l of Array.isArray(geo.coordinates) ? geo.coordinates : []) {
        const k = baris(l, 2);
        if (k) bentuk.push({ jenis: "line", koordinat: k });
        else lapor("jalur butuh minimal 2 titik dengan koordinat valid");
      }
      break;
    }
    case "Polygon": {
      const p = poligon(geo.coordinates);
      if (p) bentuk.push(p);
      else lapor("poligon butuh minimal 3 sudut dengan koordinat valid");
      break;
    }
    case "MultiPolygon": {
      for (const pg of Array.isArray(geo.coordinates) ? geo.coordinates : []) {
        const p = poligon(pg);
        if (p) bentuk.push(p);
        else lapor("poligon butuh minimal 3 sudut dengan koordinat valid");
      }
      break;
    }
    case "GeometryCollection": {
      for (const sub of Array.isArray(geo.geometries) ? geo.geometries : []) {
        bentuk.push(...uraikanGeometri(sub, lapor));
      }
      break;
    }
    default:
      lapor(`tipe geometri ${String(geo.type ?? "kosong")} tidak didukung`);
  }
  return bentuk;
}

function lengkapiBentuk(bentuk: Bentuk[], atribut: Omit<FiturImpor, "jenisGeometri" | "koordinat">): FiturImpor[] {
  return bentuk.map((b, i) => ({
    ...atribut,
    judul: bentuk.length > 1 && atribut.judul ? `${atribut.judul} (${i + 1})` : atribut.judul,
    jenisGeometri: b.jenis,
    koordinat: atribut.simulasi ? b.koordinat.map((k) => ({ ...k, simulasi: true })) : b.koordinat
  }));
}

export function parseGeoJSON(isi: string): HasilParse {
  let json: unknown;
  try {
    json = JSON.parse(isi);
  } catch {
    throw new Error("Berkas bukan JSON yang valid.");
  }
  const j = json as { type?: string; features?: unknown[]; geometry?: unknown };

  let daftar: unknown[];
  if (j && j.type === "FeatureCollection" && Array.isArray(j.features)) daftar = j.features;
  else if (j && j.type === "Feature") daftar = [j];
  else if (j && typeof j.type === "string") daftar = [{ type: "Feature", properties: {}, geometry: j }]; // geometri polos
  else throw new Error("Berkas bukan GeoJSON: tidak ada FeatureCollection, Feature, atau geometri.");

  if (daftar.length > BATAS_FITUR_IMPOR) {
    throw new Error(`Berkas memuat ${daftar.length} fitur, melebihi batas ${BATAS_FITUR_IMPOR} per impor.`);
  }

  const fitur: FiturImpor[] = [];
  const dilewati: string[] = [];
  daftar.forEach((f, i) => {
    const feat = (f ?? {}) as { properties?: Record<string, unknown> | null; geometry?: unknown };
    const alasanFitur: string[] = [];
    const bentuk = uraikanGeometri(feat.geometry, (a) => alasanFitur.push(a));
    const p = feat.properties ?? {};
    const kategori = KATEGORI_VALID.find((k) => k === p.kategori);
    fitur.push(
      ...lengkapiBentuk(bentuk, {
        judul: teks(p.judul) ?? teks(p.name) ?? teks(p.Name) ?? teks(p.title) ?? `Impor #${i + 1}`,
        kategori,
        namaLokal: teks(p.namaLokal),
        deskripsi: teks(p.deskripsi) ?? teks(p.description),
        simulasi: p.simulasi === true
      })
    );
    alasanFitur.forEach((a) => dilewati.push(`fitur ${i + 1}: ${a}`));
  });
  return { format: "GeoJSON", fitur, dilewati };
}

/* ---------- KML dan GPX ---------- */

function bacaXml(isi: string, nama: string): Document {
  const doc = new DOMParser().parseFromString(isi, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`Berkas bukan ${nama} yang valid (XML rusak).`);
  }
  return doc;
}

const isiTag = (el: Element, tag: string): string | undefined =>
  teks(el.getElementsByTagName(tag)[0]?.textContent ?? undefined);

function koordinatKML(el: Element | undefined): number[][] {
  const mentah = el?.getElementsByTagName("coordinates")[0]?.textContent ?? "";
  return mentah
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.split(",").map(Number));
}

export function parseKML(isi: string): HasilParse {
  const doc = bacaXml(isi, "KML");
  const penanda = Array.from(doc.getElementsByTagName("Placemark"));
  if (penanda.length === 0) throw new Error("Berkas KML tidak memuat Placemark.");
  if (penanda.length > BATAS_FITUR_IMPOR) {
    throw new Error(`Berkas memuat ${penanda.length} fitur, melebihi batas ${BATAS_FITUR_IMPOR} per impor.`);
  }

  const fitur: FiturImpor[] = [];
  const dilewati: string[] = [];
  penanda.forEach((pm, i) => {
    const bentuk: Bentuk[] = [];
    const lapor = (a: string) => dilewati.push(`fitur ${i + 1}: ${a}`);
    for (const el of Array.from(pm.getElementsByTagName("Point"))) {
      bentuk.push(...uraikanGeometri({ type: "Point", coordinates: koordinatKML(el)[0] }, lapor));
    }
    for (const el of Array.from(pm.getElementsByTagName("LineString"))) {
      bentuk.push(...uraikanGeometri({ type: "LineString", coordinates: koordinatKML(el) }, lapor));
    }
    for (const el of Array.from(pm.getElementsByTagName("Polygon"))) {
      const luar = el.getElementsByTagName("outerBoundaryIs")[0];
      bentuk.push(...uraikanGeometri({ type: "Polygon", coordinates: [koordinatKML(luar)] }, lapor));
    }
    if (bentuk.length === 0 && pm.getElementsByTagName("Point").length + pm.getElementsByTagName("LineString").length + pm.getElementsByTagName("Polygon").length === 0) {
      lapor("tidak ada geometri yang didukung (Point, LineString, Polygon)");
    }
    fitur.push(
      ...lengkapiBentuk(bentuk, {
        judul: isiTag(pm, "name") ?? `Impor #${i + 1}`,
        deskripsi: isiTag(pm, "description")
      })
    );
  });
  return { format: "KML", fitur, dilewati };
}

export function parseGPX(isi: string): HasilParse {
  const doc = bacaXml(isi, "GPX");
  if (doc.getElementsByTagName("gpx").length === 0) throw new Error("Berkas bukan GPX: elemen gpx tidak ditemukan.");

  const titikGpx = (el: Element): number[] => {
    const lat = Number(el.getAttribute("lat"));
    const lon = Number(el.getAttribute("lon"));
    const ele = el.getElementsByTagName("ele")[0]?.textContent;
    const t = [lon, lat];
    if (ele !== undefined && ele !== null && ele.trim() !== "" && Number.isFinite(Number(ele))) t.push(Number(ele));
    return t;
  };

  const fitur: FiturImpor[] = [];
  const dilewati: string[] = [];
  let urut = 0;
  const tambah = (bentuk: Bentuk[], judul: string | undefined, deskripsi: string | undefined) => {
    fitur.push(...lengkapiBentuk(bentuk, { judul: judul ?? `Impor #${urut}`, deskripsi }));
  };

  for (const w of Array.from(doc.getElementsByTagName("wpt"))) {
    urut++;
    const lapor = (a: string) => dilewati.push(`titik ${urut}: ${a}`);
    tambah(uraikanGeometri({ type: "Point", coordinates: titikGpx(w) }, lapor), isiTag(w, "name"), isiTag(w, "desc"));
  }
  for (const k of Array.from(doc.getElementsByTagName("trk"))) {
    urut++;
    const lapor = (a: string) => dilewati.push(`jejak ${urut}: ${a}`);
    const titik = Array.from(k.getElementsByTagName("trkpt")).map(titikGpx);
    tambah(uraikanGeometri({ type: "LineString", coordinates: titik }, lapor), isiTag(k, "name"), isiTag(k, "desc"));
  }
  for (const r of Array.from(doc.getElementsByTagName("rte"))) {
    urut++;
    const lapor = (a: string) => dilewati.push(`rute ${urut}: ${a}`);
    const titik = Array.from(r.getElementsByTagName("rtept")).map(titikGpx);
    tambah(uraikanGeometri({ type: "LineString", coordinates: titik }, lapor), isiTag(r, "name"), isiTag(r, "desc"));
  }
  if (urut === 0) throw new Error("Berkas GPX tidak memuat titik, jejak, atau rute.");
  if (urut > BATAS_FITUR_IMPOR) throw new Error(`Berkas memuat ${urut} fitur, melebihi batas ${BATAS_FITUR_IMPOR} per impor.`);
  return { format: "GPX", fitur, dilewati };
}

/** Memilih parser dari ekstensi nama berkas, lalu dari isi bila ekstensi tidak dikenal */
export function parseBerkas(namaBerkas: string, isi: string): HasilParse {
  if (isi.length > BATAS_BYTE_IMPOR) {
    throw new Error(`Berkas terlalu besar (batas ${Math.round(BATAS_BYTE_IMPOR / 1_000_000)} MB).`);
  }
  const ekstensi = namaBerkas.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const awal = isi.trimStart().slice(0, 200).toLowerCase();
  if (ekstensi === "geojson" || ekstensi === "json") return parseGeoJSON(isi);
  if (ekstensi === "kml") return parseKML(isi);
  if (ekstensi === "gpx") return parseGPX(isi);
  if (awal.startsWith("{")) return parseGeoJSON(isi);
  if (awal.includes("<kml")) return parseKML(isi);
  if (awal.includes("<gpx")) return parseGPX(isi);
  throw new Error("Format berkas tidak dikenali. Gunakan .geojson, .json, .kml, atau .gpx.");
}

/** Ringkasan alasan fitur yang dilewati, dikelompokkan: "2x koordinat titik tidak valid; 1x ..." */
export function ringkasDilewati(dilewati: string[]): string {
  if (dilewati.length === 0) return "";
  const hitung = new Map<string, number>();
  for (const d of dilewati) {
    const alasan = d.replace(/^[^:]+:\s*/, "");
    hitung.set(alasan, (hitung.get(alasan) ?? 0) + 1);
  }
  return [...hitung.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([a, n]) => (n > 1 ? `${n}x ${a}` : a))
    .join("; ");
}

export interface KonteksImpor {
  idKader: string;
  namaKader: string;
  desaWilayah: string;
}

/** Mengubah fitur impor menjadi objek spasial milik pengimpor (status lokal, ditandai diimpor) */
export function fiturKeDataSpasial(f: FiturImpor, ctx: KonteksImpor): DataSpasialItem {
  const sekarang = new Date().toISOString();
  return {
    id: buatId("IMP"),
    idKader: ctx.idKader,
    namaKader: ctx.namaKader,
    desaWilayah: ctx.desaWilayah,
    jenisGeometri: f.jenisGeometri,
    kategori: f.kategori ?? "Flora",
    judul: f.judul ?? "Hasil impor",
    namaLokal: f.namaLokal,
    deskripsi: f.deskripsi ?? "Hasil impor berkas",
    koordinat: f.koordinat,
    panjangKm: f.jenisGeometri === "line" ? hitungPanjangGarisKm(f.koordinat) : 0,
    luasHa: f.jenisGeometri === "polygon" ? hitungLuasPoligonHa(f.koordinat) : 0,
    statusSinkron: "lokal",
    diimpor: true,
    createdAt: sekarang,
    updatedAt: sekarang,
    riwayatPembaruan: []
  };
}
