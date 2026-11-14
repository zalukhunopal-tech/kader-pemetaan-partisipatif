import { AreaPetaOffline, DataSpasialItem, JenisGeometri } from "../types";
import { hitungLuasPoligonHa, hitungPanjangGarisKm } from "./geoUtils";

export const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

const SHAPE_TYPE_MAP: Record<JenisGeometri, number> = {
  point: 1,
  line: 3,
  polygon: 5
};

const LABEL_GEOMETRI_BERKAS: Record<JenisGeometri, string> = {
  point: "titik",
  line: "jalur",
  polygon: "area"
};

interface KotakBbox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface RecordShp {
  content: Uint8Array;
  bbox: KotakBbox;
}

export interface BerkasArsip {
  nama: string;
  isi: Uint8Array;
}

export interface HasilShapefile {
  shp: Uint8Array;
  shx: Uint8Array;
  dbf: Uint8Array;
  prj: Uint8Array;
  jenisGeometri: JenisGeometri;
  jumlahFitur: number;
}

function hitungBboxKoordinat(pts: { lat: number; lng: number }[]): KotakBbox {
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = pts[0].lng;
  let maxX = pts[0].lng;
  let minY = pts[0].lat;
  let maxY = pts[0].lat;
  for (const pt of pts) {
    if (pt.lng < minX) minX = pt.lng;
    if (pt.lng > maxX) maxX = pt.lng;
    if (pt.lat < minY) minY = pt.lat;
    if (pt.lat > maxY) maxY = pt.lat;
  }
  return { minX, minY, maxX, maxY };
}

function gabungBbox(daftar: KotakBbox[]): KotakBbox {
  if (daftar.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return daftar.reduce(
    (acc, cur) => ({
      minX: Math.min(acc.minX, cur.minX),
      minY: Math.min(acc.minY, cur.minY),
      maxX: Math.max(acc.maxX, cur.maxX),
      maxY: Math.max(acc.maxY, cur.maxY)
    }),
    { ...daftar[0] }
  );
}

/** Menjamin ring poligon tertutup dan searah jarum jam (aturan outer ring ESRI Shapefile). */
function normalisasiRingPoligon(pts: { lat: number; lng: number }[]): { lat: number; lng: number }[] {
  if (pts.length === 0) return [];
  const bersih = pts.map((p) => ({ lat: p.lat, lng: p.lng }));
  const awal = bersih[0];
  const akhir = bersih[bersih.length - 1];
  if (awal.lat !== akhir.lat || awal.lng !== akhir.lng) {
    bersih.push({ ...awal });
  }
  let twiceSignedArea = 0;
  for (let i = 0; i < bersih.length - 1; i++) {
    const a = bersih[i];
    const b = bersih[i + 1];
    twiceSignedArea += (b.lng - a.lng) * (b.lat + a.lat);
  }
  // ESRI outer ring harus clockwise (sum((x2 - x1) * (y2 + y1)) >= 0)
  return twiceSignedArea < 0 ? [...bersih].reverse() : bersih;
}

function buatRecordPoint(pt: { lat: number; lng: number }): RecordShp {
  const buf = new ArrayBuffer(20);
  const dv = new DataView(buf);
  dv.setInt32(0, 1, true);
  dv.setFloat64(4, pt.lng, true);
  dv.setFloat64(12, pt.lat, true);
  return {
    content: new Uint8Array(buf),
    bbox: { minX: pt.lng, minY: pt.lat, maxX: pt.lng, maxY: pt.lat }
  };
}

function buatRecordPoly(shapeType: 3 | 5, ptsInput: { lat: number; lng: number }[]): RecordShp {
  const pts = shapeType === 5 ? normalisasiRingPoligon(ptsInput) : ptsInput;
  const bbox = hitungBboxKoordinat(pts);
  const byteLen = 4 + 32 + 4 + 4 + 4 + pts.length * 16;
  const buf = new ArrayBuffer(byteLen);
  const dv = new DataView(buf);
  dv.setInt32(0, shapeType, true);
  dv.setFloat64(4, bbox.minX, true);
  dv.setFloat64(12, bbox.minY, true);
  dv.setFloat64(20, bbox.maxX, true);
  dv.setFloat64(28, bbox.maxY, true);
  dv.setInt32(36, 1, true); // NumParts
  dv.setInt32(40, pts.length, true); // NumPoints
  dv.setInt32(44, 0, true); // Parts[0] offset
  let pos = 48;
  for (const pt of pts) {
    dv.setFloat64(pos, pt.lng, true);
    dv.setFloat64(pos + 8, pt.lat, true);
    pos += 16;
  }
  return { content: new Uint8Array(buf), bbox };
}

function buatRecordNull(): RecordShp {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setInt32(0, 0, true);
  return { content: new Uint8Array(buf), bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
}

function tulisHeaderShp(dv: DataView, fileLengthWords: number, shapeType: number, bbox: KotakBbox): void {
  dv.setInt32(0, 9994, false); // Magic number ESRI Big-Endian
  dv.setInt32(24, fileLengthWords, false); // Panjang berkas dalam 16-bit word (BE)
  dv.setInt32(28, 1000, true); // Versi 1000 (LE)
  dv.setInt32(32, shapeType, true); // ShapeType (LE)
  dv.setFloat64(36, bbox.minX, true);
  dv.setFloat64(44, bbox.minY, true);
  dv.setFloat64(52, bbox.maxX, true);
  dv.setFloat64(60, bbox.maxY, true);
}

/** Memilih geometri dominan jika daftar memuat campuran jenis geometri. */
export function deteksiGeometriUtama(daftar: DataSpasialItem[]): JenisGeometri {
  if (daftar.length === 0) return "point";
  const hitungan: Record<JenisGeometri, number> = { point: 0, line: 0, polygon: 0 };
  for (const item of daftar) hitungan[item.jenisGeometri]++;
  const urutan: JenisGeometri[] = ["point", "line", "polygon"];
  return urutan.reduce((terbanyak, jenis) => (hitungan[jenis] > hitungan[terbanyak] ? jenis : terbanyak), daftar[0].jenisGeometri);
}

/** Mengubah daftar batas peta offline menjadi fitur poligon sementara untuk ekspor GIS. */
export function areaPetaKeDataSpasial(petaBatas: AreaPetaOffline[]): DataSpasialItem[] {
  const iso = new Date().toISOString();
  return petaBatas.map((area) => ({
    id: area.id,
    idKader: "PETA-OFFLINE",
    namaKader: "Peta Offline",
    desaWilayah: area.namaArea,
    judul: `Batas Peta: ${area.namaArea}`,
    kategori: "Tanda Batas",
    jenisGeometri: "polygon",
    koordinat: [
      { lat: area.minLat, lng: area.minLng },
      { lat: area.maxLat, lng: area.minLng },
      { lat: area.maxLat, lng: area.maxLng },
      { lat: area.minLat, lng: area.maxLng }
    ],
    panjangKm: 0,
    luasHa: 0,
    deskripsi: `Batas lembar peta (${area.crs ?? "WGS84"}, ${area.ukuranMb} MB)`,
    createdAt: iso,
    updatedAt: iso,
    riwayatPembaruan: [],
    statusSinkron: "tersinkron"
  }));
}

interface KolomDbf {
  nama: string;
  tipe: "C" | "N";
  panjang: number;
  desimal: number;
  ambil: (d: DataSpasialItem) => string;
}

const KOLOM_DBF: KolomDbf[] = [
  { nama: "ID", tipe: "C", panjang: 24, desimal: 0, ambil: (d) => d.id },
  { nama: "JUDUL", tipe: "C", panjang: 60, desimal: 0, ambil: (d) => d.judul },
  { nama: "KATEGORI", tipe: "C", panjang: 24, desimal: 0, ambil: (d) => d.kategori },
  { nama: "GEOMETRI", tipe: "C", panjang: 12, desimal: 0, ambil: (d) => d.jenisGeometri },
  { nama: "KADER", tipe: "C", panjang: 40, desimal: 0, ambil: (d) => d.namaKader },
  { nama: "WILAYAH", tipe: "C", panjang: 40, desimal: 0, ambil: (d) => d.desaWilayah },
  { nama: "TANGGAL", tipe: "C", panjang: 20, desimal: 0, ambil: (d) => d.createdAt.slice(0, 19) },
  {
    nama: "PANJANG_KM",
    tipe: "N",
    panjang: 12,
    desimal: 3,
    ambil: (d) => {
      const val = d.panjangKm || (d.jenisGeometri === "line" ? hitungPanjangGarisKm(d.koordinat) : 0);
      return val.toFixed(3);
    }
  },
  {
    nama: "LUAS_HA",
    tipe: "N",
    panjang: 12,
    desimal: 3,
    ambil: (d) => {
      const val = d.luasHa || (d.jenisGeometri === "polygon" ? hitungLuasPoligonHa(d.koordinat) : 0);
      return val.toFixed(3);
    }
  }
];

function buatDbf(daftar: DataSpasialItem[]): Uint8Array {
  const enc = new TextEncoder();
  const panjangHeader = 32 + KOLOM_DBF.length * 32 + 1;
  const panjangBaris = 1 + KOLOM_DBF.reduce((s, k) => s + k.panjang, 0);
  const totalBytes = panjangHeader + daftar.length * panjangBaris + 1;
  const out = new Uint8Array(totalBytes);
  out.fill(0x20, panjangHeader, totalBytes - 1);
  const dv = new DataView(out.buffer);
  const kini = new Date();
  out[0] = 0x03; // dBASE III tanpa memo
  out[1] = Math.max(0, kini.getFullYear() - 1900);
  out[2] = kini.getMonth() + 1;
  out[3] = kini.getDate();
  dv.setUint32(4, daftar.length, true);
  dv.setUint16(8, panjangHeader, true);
  dv.setUint16(10, panjangBaris, true);

  let posField = 32;
  for (const col of KOLOM_DBF) {
    const namaBytes = enc.encode(col.nama.slice(0, 11));
    out.set(namaBytes, posField);
    out[posField + 11] = col.tipe.charCodeAt(0);
    out[posField + 16] = col.panjang;
    out[posField + 17] = col.desimal;
    posField += 32;
  }
  out[posField] = 0x0d; // Terminator header DBF

  let posRow = panjangHeader;
  for (const item of daftar) {
    out[posRow] = 0x20; // Flag record aktif (spasi)
    let off = posRow + 1;
    for (const col of KOLOM_DBF) {
      const raw = enc.encode(col.ambil(item) || "");
      const slice = raw.slice(0, col.panjang);
      if (col.tipe === "N") {
        // Numerik rata kanan
        out.set(slice, off + (col.panjang - slice.length));
      } else {
        out.set(slice, off);
      }
      off += col.panjang;
    }
    posRow += panjangBaris;
  }
  out[totalBytes - 1] = 0x1a; // Marker EOF DBF
  return out;
}

/** Menghasilkan bundel SHP/SHX/DBF/PRJ yang sah untuk satu jenis geometri. */
export function bangunShapefileTunggal(daftar: DataSpasialItem[], jenisFilter?: JenisGeometri): HasilShapefile {
  const jenis = jenisFilter ?? deteksiGeometriUtama(daftar);
  const tersaring = daftar.filter((d) => d.jenisGeometri === jenis);
  const shapeType = tersaring.length > 0 ? SHAPE_TYPE_MAP[jenis] : SHAPE_TYPE_MAP[jenis];

  const recs: RecordShp[] = tersaring.map((item) => {
    if (item.koordinat.length === 0) return buatRecordNull();
    if (jenis === "point") return buatRecordPoint(item.koordinat[0]);
    if (jenis === "line") return buatRecordPoly(3, item.koordinat);
    return buatRecordPoly(5, item.koordinat);
  });

  const bbox = gabungBbox(recs.map((r) => r.bbox));
  const totalRecordBytes = recs.reduce((s, r) => s + 8 + r.content.length, 0);
  const totalShpBytes = 100 + totalRecordBytes;
  const shp = new Uint8Array(totalShpBytes);
  const dvShp = new DataView(shp.buffer);
  tulisHeaderShp(dvShp, totalShpBytes / 2, shapeType, bbox);

  const totalShxBytes = 100 + recs.length * 8;
  const shx = new Uint8Array(totalShxBytes);
  const dvShx = new DataView(shx.buffer);
  tulisHeaderShp(dvShx, totalShxBytes / 2, shapeType, bbox);

  let offsetByte = 100;
  recs.forEach((rec, i) => {
    const recNum = i + 1;
    const lenWords = rec.content.length / 2;
    dvShp.setInt32(offsetByte, recNum, false);
    dvShp.setInt32(offsetByte + 4, lenWords, false);
    shp.set(rec.content, offsetByte + 8);

    const shxPos = 100 + i * 8;
    dvShx.setInt32(shxPos, offsetByte / 2, false);
    dvShx.setInt32(shxPos + 4, lenWords, false);

    offsetByte += 8 + rec.content.length;
  });

  return {
    shp,
    shx,
    dbf: buatDbf(tersaring),
    prj: new TextEncoder().encode(WGS84_PRJ),
    jenisGeometri: jenis,
    jumlahFitur: tersaring.length
  };
}

/** Mengekspor daftar fitur spasial langsung ke berkas biner ESRI Shapefile (.shp). */
export function eksporKeSHP(daftar: DataSpasialItem[], jenisFilter?: JenisGeometri): Uint8Array {
  return bangunShapefileTunggal(daftar, jenisFilter).shp;
}

/** Mengekspor SHP tunggal berikut batas peta offline jika diminta. */
export function eksporShpDenganOpsi(
  daftar: DataSpasialItem[],
  petaBatas: AreaPetaOffline[],
  sertakanPeta: boolean,
  jenisFilter?: JenisGeometri
): HasilShapefile {
  const gabungan = sertakanPeta && petaBatas.length > 0 ? [...daftar, ...areaPetaKeDataSpasial(petaBatas)] : daftar;
  return bangunShapefileTunggal(gabungan, jenisFilter);
}

/** Menyusun berkas-berkas paket Shapefile per jenis geometri yang ada (.shp, .shx, .dbf, .prj). */
export function eksporPaketShapefile(
  daftar: DataSpasialItem[],
  namaDasar: string,
  petaBatas: AreaPetaOffline[] = [],
  sertakanPeta = false
): BerkasArsip[] {
  const gabungan = sertakanPeta && petaBatas.length > 0 ? [...daftar, ...areaPetaKeDataSpasial(petaBatas)] : daftar;
  const jenisAktif: JenisGeometri[] = (["point", "line", "polygon"] as JenisGeometri[]).filter((j) =>
    gabungan.some((d) => d.jenisGeometri === j)
  );
  const targetJenis = jenisAktif.length > 0 ? jenisAktif : (["point"] as JenisGeometri[]);
  const namaAman = (namaDasar.trim() || "Ekspor_AM_2").replace(/\s+/g, "_");

  const berkas: BerkasArsip[] = [];
  for (const jenis of targetJenis) {
    const hasil = bangunShapefileTunggal(gabungan, jenis);
    const prefiks = targetJenis.length > 1 ? `${namaAman}_${LABEL_GEOMETRI_BERKAS[jenis]}` : namaAman;
    berkas.push(
      { nama: `${prefiks}.shp`, isi: hasil.shp },
      { nama: `${prefiks}.shx`, isi: hasil.shx },
      { nama: `${prefiks}.dbf`, isi: hasil.dbf },
      { nama: `${prefiks}.prj`, isi: hasil.prj }
    );
  }
  return berkas;
}

const TABEL_CRC32 = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function hitungCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = TABEL_CRC32[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Membungkus daftar berkas menjadi arsip ZIP standar (STORE) tanpa ketergantungan eksternal. */
export function buatArsipZip(daftarBerkas: BerkasArsip[]): Uint8Array {
  const enc = new TextEncoder();
  const bagianLokal: Uint8Array[] = [];
  const bagianCd: Uint8Array[] = [];
  let offset = 0;

  for (const berkas of daftarBerkas) {
    const namaBytes = enc.encode(berkas.nama);
    const crc = hitungCrc32(berkas.isi);
    const ukuran = berkas.isi.length;

    const lfh = new Uint8Array(30 + namaBytes.length);
    const dvLfh = new DataView(lfh.buffer);
    dvLfh.setUint32(0, 0x04034b50, true);
    dvLfh.setUint16(4, 20, true);
    dvLfh.setUint16(6, 0x0800, true); // UTF-8
    dvLfh.setUint16(8, 0, true); // STORE
    dvLfh.setUint32(14, crc, true);
    dvLfh.setUint32(18, ukuran, true);
    dvLfh.setUint32(22, ukuran, true);
    dvLfh.setUint16(26, namaBytes.length, true);
    lfh.set(namaBytes, 30);

    const cd = new Uint8Array(46 + namaBytes.length);
    const dvCd = new DataView(cd.buffer);
    dvCd.setUint32(0, 0x02014b50, true);
    dvCd.setUint16(4, 20, true);
    dvCd.setUint16(6, 20, true);
    dvCd.setUint16(8, 0x0800, true);
    dvCd.setUint16(10, 0, true);
    dvCd.setUint32(16, crc, true);
    dvCd.setUint32(20, ukuran, true);
    dvCd.setUint32(24, ukuran, true);
    dvCd.setUint16(28, namaBytes.length, true);
    dvCd.setUint32(42, offset, true);
    cd.set(namaBytes, 46);

    bagianLokal.push(lfh, berkas.isi);
    bagianCd.push(cd);
    offset += lfh.length + berkas.isi.length;
  }

  const ukuranCd = bagianCd.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const dvEocd = new DataView(eocd.buffer);
  dvEocd.setUint32(0, 0x06054b50, true);
  dvEocd.setUint16(8, daftarBerkas.length, true);
  dvEocd.setUint16(10, daftarBerkas.length, true);
  dvEocd.setUint32(12, ukuranCd, true);
  dvEocd.setUint32(16, offset, true);

  const total = offset + ukuranCd + eocd.length;
  const zip = new Uint8Array(total);
  let pos = 0;
  for (const seg of bagianLokal) {
    zip.set(seg, pos);
    pos += seg.length;
  }
  for (const cd of bagianCd) {
    zip.set(cd, pos);
    pos += cd.length;
  }
  zip.set(eocd, pos);
  return zip;
}
