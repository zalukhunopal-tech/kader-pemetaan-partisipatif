import { DataSpasialItem, JenisGeometri } from "../types";

/**
 * SKEMA ATRIBUT TABEL & SIMBOLOGI PRM-AID WEBGIS + STANDAR NASIONAL INDONESIA (SNI 6502 / BIG RBI)
 *
 * Struktur atribut tabel per jenis geometri sesuai kebutuhan unggah ke WebGIS PRM-AID
 * (https://walaya.prm.my.id/webgis/gis_data_form/form/undefined):
 * - Polygon : | label | luas_ha | keterangan | url | tepi | warna |
 * - Line    : | label | panjang_m | keterangan | url | warna |
 * - Point   : | label | kategori | keterangan | url | simbol |
 *
 * Referensi kode warna & tepi:
 * 1. Spreadsheet Kode PRM-AID (https://docs.google.com/spreadsheets/d/17vMASHkxGkmG4HWFan8i1wGCdxMx4m1o)
 * 2. Standar Nasional Indonesia (SNI 6502.2 / SNI 7645 BIG) untuk kategori tambahan yang belum
 *    tercantum di spreadsheet, disesuaikan dengan dukungan langsung Leaflet & aset ikon pada
 *    server WebGIS PRM-AID (`/assets/resources/peta/point/<simbol>`).
 */

export interface AtributPolygonPrmAid {
  label: string;
  luas_ha: number;
  keterangan: string;
  url: string;
  tepi: string;
  warna: string;
}

export interface AtributLinePrmAid {
  label: string;
  panjang_m: number;
  keterangan: string;
  url: string;
  warna: string;
}

export interface AtributPointPrmAid {
  label: string;
  kategori: string;
  keterangan: string;
  url: string;
  simbol: string;
}

export type AtributSpasialPrmAid = AtributPolygonPrmAid | AtributLinePrmAid | AtributPointPrmAid;

export const KOLOM_TABEL_POLYGON_PRM_AID = ["label", "luas_ha", "keterangan", "url", "tepi", "warna"] as const;
export const KOLOM_TABEL_LINE_PRM_AID = ["label", "panjang_m", "keterangan", "url", "warna"] as const;
export const KOLOM_TABEL_POINT_PRM_AID = ["label", "kategori", "keterangan", "url", "simbol"] as const;

export interface AturanPolygonPrmAid {
  nama: string;
  kataKunci: string[];
  tepi: string;
  warna: string;
}

/**
 * Daftar kode tepi (outline) dan warna (isi/fill) Polygon sesuai `Kode PRM-AID.xlsx`
 * Urutan disusun dari yang paling spesifik ke umum agar pencocokan kata kunci akurat.
 */
export const DAFTAR_ATURAN_POLYGON_PRM_AID: AturanPolygonPrmAid[] = [
  // Fungsi Kawasan (Per Desa) - Kode PRM-AID.xlsx
  { nama: "Area Penggunaan Lain", kataKunci: ["area penggunaan lain", "areal penggunaan lain", "apl"], tepi: "Transparent", warna: "#FFFFFF" },
  { nama: "Hutan Produksi Konversi", kataKunci: ["hutan produksi konversi", "hpk"], tepi: "Transparent", warna: "#FF5EFF" },
  { nama: "Hutan Produksi Terbatas", kataKunci: ["hutan produksi terbatas", "hpt"], tepi: "Transparent", warna: "#8AF200" },
  { nama: "Hutan Produksi", kataKunci: ["hutan produksi"], tepi: "Transparent", warna: "#FFFF00" },
  { nama: "Hutan Lindung", kataKunci: ["hutan lindung"], tepi: "Transparent", warna: "#02AD00" },
  { nama: "Hutan Konservasi", kataKunci: ["hutan konservasi", "kawasan konservasi"], tepi: "Transparent", warna: "#AD3FFF" },

  // Zonasi Kawasan Konservasi (Per Desa) - Kode PRM-AID.xlsx
  { nama: "Zona Religi, Sejarah & Budaya", kataKunci: ["zona religi", "sejarah & budaya", "sejarah dan budaya", "zona budaya"], tepi: "Transparent", warna: "#6600CC" },
  { nama: "Zona Khusus", kataKunci: ["zona khusus"], tepi: "Transparent", warna: "#969696" },
  { nama: "Zona Rehabilitasi", kataKunci: ["zona rehabilitasi"], tepi: "Transparent", warna: "#00FFFF" },
  { nama: "Zona Tradisional", kataKunci: ["zona tradisional"], tepi: "Transparent", warna: "#993300" },
  { nama: "Zonasi Pemanfaatan", kataKunci: ["zonasi pemanfaatan", "zona pemanfaatan"], tepi: "Transparent", warna: "#94C800" },
  { nama: "Zona Rimba", kataKunci: ["zona rimba"], tepi: "Transparent", warna: "#E7E200" },
  { nama: "Zona Inti", kataKunci: ["zona inti"], tepi: "Transparent", warna: "#FF0000" },

  // Zona Perhutanan Sosial - Kode PRM-AID.xlsx
  { nama: "Ruang Lindung", kataKunci: ["ruang lindung"], tepi: "Transparent", warna: "#D32F2F" },
  { nama: "Ruang Pemanfaatan", kataKunci: ["ruang pemanfaatan"], tepi: "Transparent", warna: "#00C8FF" },

  // Perhutanan Sosial & Wilayah MHA - Kode PRM-AID.xlsx
  { nama: "Hutan Adat", kataKunci: ["hutan adat"], tepi: "#4E4E4E", warna: "#4e4e4e" },
  { nama: "Hutan Desa", kataKunci: ["hutan desa"], tepi: "#00C8FF", warna: "Transparent" },
  { nama: "Hutan Kemasyarakatan", kataKunci: ["hutan kemasyarakatan", "hkm"], tepi: "#004DA8", warna: "Transparent" },
  { nama: "Hutan Tanaman Rakyat", kataKunci: ["hutan tanaman rakyat", "htr"], tepi: "#FF3264", warna: "Transparent" },
  { nama: "Kemitraan Kehutanan", kataKunci: ["kemitraan kehutanan"], tepi: "#A80000", warna: "Transparent" },
  { nama: "Wilayah MHA", kataKunci: ["wilayah mha", "masyarakat hukum adat", "wilayah adat"], tepi: "#8d4513", warna: "#C68642" },

  // Perizinan & Penggunaan Lahan - Kode PRM-AID.xlsx
  { nama: "PBPH", kataKunci: ["pbph", "perizinan berusaha pemanfaatan hutan", "hph", "hti"], tepi: "#F4A460", warna: "#F4A460" },
  { nama: "Area Perladangan", kataKunci: ["area perladangan", "perladangan", "ladang"], tepi: "#000000", warna: "#98E600" },
  { nama: "Area Perkebunan", kataKunci: ["area perkebunan", "perkebunan", "kebun"], tepi: "#000000", warna: "#00B050" },
  { nama: "Area Persawahan", kataKunci: ["area persawahan", "persawahan", "sawah"], tepi: "#000000", warna: "#FFFF00" },

  // Batas Administrasi & Lanskap - Kode PRM-AID.xlsx
  { nama: "Provinsi", kataKunci: ["provinsi", "batas provinsi"], tepi: "#000000", warna: "Transparent" },
  { nama: "Kabupaten", kataKunci: ["kabupaten", "batas kabupaten", "kota"], tepi: "#000000", warna: "Transparent" },
  { nama: "Kecamatan", kataKunci: ["kecamatan", "batas kecamatan"], tepi: "#000000", warna: "Transparent" },
  { nama: "Klaster/Lanskap", kataKunci: ["klaster", "lanskap"], tepi: "#000000", warna: "Transparent" },
  { nama: "Desa", kataKunci: ["batas desa", "wilayah desa", "desa"], tepi: "#000000", warna: "#F5F5DC" },

  // Tambahan sesuai SNI 6502 / SNI 7645 BIG untuk tutupan lahan lainnya
  { nama: "Mangrove / Rawa", kataKunci: ["mangrove", "bakau", "rawa", "gambut"], tepi: "#004D00", warna: "#02AD00" },
  { nama: "Badan Air / Danau", kataKunci: ["danau", "waduk", "embung", "kolam", "tambak", "perairan"], tepi: "#004DA8", warna: "#00BFFF" }
];

/**
 * Fallback gaya Polygon berdasarkan Kategori Survei Titik Tapak (SNI 6502 / BIG RBI + PRM-AID)
 */
export const FALLBACK_POLYGON_SNI: Record<string, { tepi: string; warna: string }> = {
  "Wilayah Adat / Lahan": { tepi: "#8d4513", warna: "#C68642" }, // Wilayah MHA (PRM-AID)
  Flora: { tepi: "#004D00", warna: "#02AD00" }, // Vegetasi Hutan / Rimba (SNI 7645 / Hutan Lindung PRM-AID)
  Fauna: { tepi: "#6600CC", warna: "#AD3FFF" }, // Habitat Satwa / Konservasi (PRM-AID)
  "Mata Air": { tepi: "#004DA8", warna: "#00BFFF" }, // Hidrografi / Badan Air (SNI 6502)
  "Tanda Batas": { tepi: "#000000", warna: "Transparent" }, // Batas Administrasi (PRM-AID / SNI 6502)
  "Ancaman / Temuan": { tepi: "#A80000", warna: "#FF0000" }, // Zona Bahaya / Kerusakan (SNI / Zona Inti PRM-AID)
  "Sarana Desa": { tepi: "#000000", warna: "#F5F5DC" }, // Area Desa / Permukiman (PRM-AID / SNI 6502)
  "Situs Budaya": { tepi: "#4A0099", warna: "#6600CC" } // Zona Religi, Sejarah & Budaya (PRM-AID)
};

export interface AturanLinePrmAid {
  nama: string;
  kataKunci: string[];
  warna: string;
}

/**
 * Daftar kode warna Line sesuai `Kode PRM-AID.xlsx` + SNI 6502 (Peta RBI BIG)
 */
export const DAFTAR_ATURAN_LINE_PRM_AID: AturanLinePrmAid[] = [
  // Kode PRM-AID.xlsx
  { nama: "Sungai", kataKunci: ["sungai", "pa ", "pa'", "aliran", "kali", "parit", "irigasi", "saluran", "air"], warna: "#00BFFF" },
  { nama: "Jalan", kataKunci: ["jalan", "jalur", "jembatan", "gang", "akses", "setapak", "poros", "trans"], warna: "#FF0000" },
  { nama: "Batas RT", kataKunci: ["batas rt", "batas rw", "batas dusun", "batas lingkungan", "rt "], warna: "#FFCC99" },
  // SNI 6502 Batas Administrasi & Tematik
  { nama: "Batas Desa / Administrasi", kataKunci: ["batas desa", "batas kecamatan", "batas kabupaten", "batas provinsi", "batas wilayah", "batas adat"], warna: "#FFCC99" }
];

export const FALLBACK_LINE_SNI: Record<string, string> = {
  "Mata Air": "#00BFFF", // Sungai / Hidrografi (Kode PRM-AID)
  "Sarana Desa": "#FF0000", // Jalan / Infrastruktur (Kode PRM-AID)
  "Tanda Batas": "#FFCC99", // Batas RT / Batas Wilayah (Kode PRM-AID)
  Flora: "#02AD00", // Jalur Vegetasi / Sabuk Hijau (SNI)
  Fauna: "#AD3FFF", // Jalur Jelajah Satwa (SNI)
  "Ancaman / Temuan": "#FF0000", // Jalur Kerusakan / Rawan Bencana (SNI)
  "Wilayah Adat / Lahan": "#8d4513", // Batas Wilayah MHA (Kode PRM-AID)
  "Situs Budaya": "#6600CC" // Jalur Sejarah / Budaya (Kode PRM-AID / SNI)
};

export interface AturanPointPrmAid {
  kategoriPrmAid: string;
  kataKunci: string[];
  simbol: string;
}

/**
 * Daftar simbol Point sesuai 10 kategori `Kode PRM-AID.xlsx` + SNI 6502 (Peta RBI BIG),
 * dipetakan langsung ke berkas ikon PNG yang tersedia di server WebGIS PRM-AID
 * (`https://walaya.prm.my.id/assets/resources/peta/point/<simbol>`).
 */
export const DAFTAR_ATURAN_POINT_PRM_AID: AturanPointPrmAid[] = [
  // 1. Kuburan (Kode PRM-AID.xlsx)
  { kategoriPrmAid: "Kuburan", kataKunci: ["kuburan", "makam", "tpu", "pemakaman", "pekuburan"], simbol: "cross.png" },

  // 2. Sanitasi (Kode PRM-AID.xlsx)
  { kategoriPrmAid: "Sanitasi", kataKunci: ["sampah", "tps", "tpa", "limbah", "daur ulang"], simbol: "trash.png" },
  { kategoriPrmAid: "Sanitasi", kataKunci: ["sanitasi", "mck", "toilet", "jamban", "wc", "kamar mandi"], simbol: "toilets.png" },
  { kategoriPrmAid: "Sanitasi", kataKunci: ["bak air bersih", "air bersih", "pdam", "sumur bor", "pipa air"], simbol: "water.png" },

  // 3. Komunikasi (Kode PRM-AID.xlsx)
  { kategoriPrmAid: "Komunikasi", kataKunci: ["wifi", "internet", "hotspot", "starlink"], simbol: "wifi.png" },
  { kategoriPrmAid: "Komunikasi", kataKunci: ["telepon", "telkom", "wartel"], simbol: "telephone.png" },
  { kategoriPrmAid: "Komunikasi", kataKunci: ["komunikasi", "tower", "bts", "pemancar", "antena", "sinyal", "radio"], simbol: "tower.png" },

  // 4. Transportasi (Kode PRM-AID.xlsx)
  { kategoriPrmAid: "Transportasi", kataKunci: ["bandara", "bandar udara", "lapangan terbang", "airstrip", "helipad"], simbol: "airport.png" },
  { kategoriPrmAid: "Transportasi", kataKunci: ["pelabuhan", "dermaga", "tambatan perahu", "ketinting", "longboat", "ferry"], simbol: "port.png" },
  { kategoriPrmAid: "Transportasi", kataKunci: ["terminal", "halte", "bus", "angkot", "damri"], simbol: "bus.png" },
  { kategoriPrmAid: "Transportasi", kataKunci: ["parkir", "garasi"], simbol: "parking.png" },
  { kategoriPrmAid: "Transportasi", kataKunci: ["transportasi", "jembatan", "gantung", "gorong-gorong", "simpang"], simbol: "bridge.png" },

  // 5. Pendidikan (Kode PRM-AID.xlsx)
  { kategoriPrmAid: "Pendidikan", kataKunci: ["perpustakaan", "taman baca", "rumah baca"], simbol: "library.png" },
  { kategoriPrmAid: "Pendidikan", kataKunci: ["universitas", "kampus", "akademi", "sekolah tinggi"], simbol: "university.png" },
  { kategoriPrmAid: "Pendidikan", kataKunci: ["pendidikan", "sekolah", "sd", "sdn", "smp", "smpn", "sma", "sman", "smk", "paud", "tk", "madrasah", "pesantren"], simbol: "school.png" },

  // 6. Kesehatan (Kode PRM-AID.xlsx)
  { kategoriPrmAid: "Kesehatan", kataKunci: ["posyandu", "polindes", "poskesdes", "bidan", "dokter", "klinik", "apotek"], simbol: "doctor.png" },
  { kategoriPrmAid: "Kesehatan", kataKunci: ["kesehatan", "puskesmas", "pustu", "rumah sakit", "rsud", "balai pengobatan"], simbol: "hospital.png" },

  // 7. Agama (Kode PRM-AID.xlsx)
  { kategoriPrmAid: "Agama", kataKunci: ["masjid", "mushola", "musala", "surau", "langgar", "islamic"], simbol: "mosque.png" },
  { kategoriPrmAid: "Agama", kataKunci: ["pura", "vihara", "klenteng", "pagoda"], simbol: "pagoda.png" },
  { kategoriPrmAid: "Agama", kataKunci: ["kapel"], simbol: "chapel.png" },
  { kategoriPrmAid: "Agama", kataKunci: ["agama", "gereja", "gkii", "gpib", "gmim", "hkbp", "katolik", "protestan", "rumah ibadah", "tempat ibadah"], simbol: "church.png" },

  // 8. Tempat Pertemuan (Kode PRM-AID.xlsx)
  { kategoriPrmAid: "Tempat Pertemuan", kataKunci: ["kantor desa", "kantor kepala desa", "kantor camat", "kantor adat", "kantor", "rumah dinas", "sekretariat"], simbol: "home.png" },
  { kategoriPrmAid: "Tempat Pertemuan", kataKunci: ["tempat pertemuan", "balai pertemuan", "bpu", "balai desa", "balai adat", "aula", "gedung pertemuan", "pendopo"], simbol: "conference.png" },

  // 9. Situs Budaya (Kode PRM-AID.xlsx)
  { kategoriPrmAid: "Situs Budaya", kataKunci: ["museum", "rumah adat", "lamin", "uma dado"], simbol: "museum.png" },
  { kategoriPrmAid: "Situs Budaya", kataKunci: ["patung", "arca", "ukiran"], simbol: "statue.png" },
  { kategoriPrmAid: "Situs Budaya", kataKunci: ["situs budaya", "cagar budaya", "situs", "budaya", "sejarah", "batu adat", "tugu", "monumen", "keramat", "leluhur"], simbol: "monument.png" },

  // 10. Dll (Tambahan) - SNI 6502 & Kategori Lapangan Titik Tapak
  { kategoriPrmAid: "Mata Air", kataKunci: ["air terjun", "curug", "rueb", "riam", "jeram"], simbol: "waterfall.png" },
  { kategoriPrmAid: "Mata Air", kataKunci: ["dam", "bendungan", "pintu air", "irigasi", "embung"], simbol: "dam.png" },
  { kategoriPrmAid: "Mata Air", kataKunci: ["danau", "telaga", "kolam"], simbol: "lake.png" },
  { kategoriPrmAid: "Mata Air", kataKunci: ["mata air", "sumber air", "sumur", "pancuran"], simbol: "water.png" },
  { kategoriPrmAid: "Flora", kataKunci: ["sawah", "ladang", "kebun", "pertanian", "padi"], simbol: "agriculture.png" },
  { kategoriPrmAid: "Flora", kataKunci: ["anggrek", "bunga", "tanaman obat", "herbal", "taman"], simbol: "garden.png" },
  { kategoriPrmAid: "Flora", kataKunci: ["pohon", "kayu", "meranti", "bengkirai", "ulin", "hutan", "mangrove", "bambu", "rotan", "flora"], simbol: "forest.png" },
  { kategoriPrmAid: "Fauna", kataKunci: ["satwa", "hewan", "harimau", "orangutan", "burung", "rangkong", "ikan", "jejak", "sarang", "fauna"], simbol: "animals.png" },
  { kategoriPrmAid: "Ancaman / Temuan", kataKunci: ["banjir", "genangan", "abrasi"], simbol: "flood.png" },
  { kategoriPrmAid: "Ancaman / Temuan", kataKunci: ["tambang", "galian", "emas", "batubara", "kuari"], simbol: "mine.png" },
  { kategoriPrmAid: "Ancaman / Temuan", kataKunci: ["kebakaran", "api", "titik panas", "hotspot", "pembalakan", "illegal logging", "longsor", "ancaman", "kerusakan"], simbol: "fire.png" },
  { kategoriPrmAid: "Sarana Desa", kataKunci: ["bumdes", "koperasi", "bank", "pasar", "warung", "toko", "ekonomi"], simbol: "bank.png" },
  { kategoriPrmAid: "Sarana Desa", kataKunci: ["lapangan", "olahraga", "bola", "voli", "stadion"], simbol: "soccer.png" },
  { kategoriPrmAid: "Sarana Desa", kataKunci: ["poskamling", "pos keamanan", "polisi", "polsek", "koramil", "babinsa"], simbol: "police.png" },
  { kategoriPrmAid: "Toponimi", kataKunci: ["gua", "liang"], simbol: "cave.png" },
  { kategoriPrmAid: "Toponimi", kataKunci: ["bukit", "gunung", "buduk", "puncak", "tanjung", "pulau", "toponimi"], simbol: "default.png" },
  { kategoriPrmAid: "Tanda Batas", kataKunci: ["tanda batas", "patok", "pilar", "batas desa", "batas wilayah", "batas adat", "batas"], simbol: "default-icon.png" }
];

export const FALLBACK_POINT_SNI: Record<string, { kategori: string; simbol: string }> = {
  Kuburan: { kategori: "Kuburan", simbol: "cross.png" },
  Sanitasi: { kategori: "Sanitasi", simbol: "toilets.png" },
  Komunikasi: { kategori: "Komunikasi", simbol: "tower.png" },
  Transportasi: { kategori: "Transportasi", simbol: "bridge.png" },
  Pendidikan: { kategori: "Pendidikan", simbol: "school.png" },
  Kesehatan: { kategori: "Kesehatan", simbol: "hospital.png" },
  Agama: { kategori: "Agama", simbol: "church.png" },
  "Tempat Pertemuan": { kategori: "Tempat Pertemuan", simbol: "conference.png" },
  "Situs Budaya": { kategori: "Situs Budaya", simbol: "monument.png" },
  Flora: { kategori: "Flora", simbol: "forest.png" },
  Fauna: { kategori: "Fauna", simbol: "animals.png" },
  "Mata Air": { kategori: "Mata Air", simbol: "water.png" },
  "Tanda Batas": { kategori: "Tanda Batas", simbol: "default-icon.png" },
  "Ancaman / Temuan": { kategori: "Ancaman / Temuan", simbol: "fire.png" },
  "Wilayah Adat / Lahan": { kategori: "Wilayah Adat / Lahan", simbol: "agriculture.png" },
  "Sarana Desa": { kategori: "Sarana Desa", simbol: "default-icon.png" }
};

function normalisasiTeksCari(...bagian: (string | undefined | null)[]): string {
  return bagian
    .map((b) => String(b ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

/**
 * Menentukan kode `tepi` dan `warna` untuk Polygon berdasarkan `Kode PRM-AID.xlsx` dan SNI 6502/7645.
 */
export function tentukanGayaPolygonPrmAid(input: {
  label?: string;
  kategori?: string;
  keterangan?: string;
  tepi?: string;
  warna?: string;
}): { tepi: string; warna: string } {
  const tepiEksplisit = input.tepi?.trim();
  const warnaEksplisit = input.warna?.trim();
  if (tepiEksplisit && warnaEksplisit) {
    return { tepi: tepiEksplisit, warna: warnaEksplisit };
  }

  // Periksa kecocokan nama eksak pada label atau kategori terlebih dahulu
  const labelDanKat = [input.label, input.kategori, input.keterangan]
    .map((s) => String(s ?? "").trim().toLowerCase())
    .filter(Boolean);
  for (const aturan of DAFTAR_ATURAN_POLYGON_PRM_AID) {
    if (labelDanKat.includes(aturan.nama.toLowerCase())) {
      return {
        tepi: tepiEksplisit || aturan.tepi,
        warna: warnaEksplisit || aturan.warna
      };
    }
  }

  // Pencocokan kata kunci pada label dan keterangan terlebih dahulu (agar kategori umum seperti "Wilayah Adat / Lahan" tidak menimpa label spesifik seperti "Area Perkebunan")
  const teksUtama = normalisasiTeksCari(input.label, input.keterangan);
  for (const aturan of DAFTAR_ATURAN_POLYGON_PRM_AID) {
    if (aturan.kataKunci.some((k) => teksUtama.includes(k))) {
      return {
        tepi: tepiEksplisit || aturan.tepi,
        warna: warnaEksplisit || aturan.warna
      };
    }
  }

  // Lalu periksa kata kunci pada kategori bila belum cocok
  const teksKategori = normalisasiTeksCari(input.kategori);
  for (const aturan of DAFTAR_ATURAN_POLYGON_PRM_AID) {
    if (aturan.kataKunci.some((k) => teksKategori.includes(k))) {
      return {
        tepi: tepiEksplisit || aturan.tepi,
        warna: warnaEksplisit || aturan.warna
      };
    }
  }

  const fb = (input.kategori && FALLBACK_POLYGON_SNI[input.kategori]) || FALLBACK_POLYGON_SNI["Wilayah Adat / Lahan"];
  return {
    tepi: tepiEksplisit || fb.tepi,
    warna: warnaEksplisit || fb.warna
  };
}

/**
 * Menentukan kode `warna` untuk Line berdasarkan `Kode PRM-AID.xlsx` dan SNI 6502.
 */
export function tentukanWarnaLinePrmAid(input: {
  label?: string;
  kategori?: string;
  keterangan?: string;
  warna?: string;
}): string {
  if (input.warna?.trim()) return input.warna.trim();

  const gabungan = normalisasiTeksCari(input.label, input.keterangan, input.kategori);
  for (const aturan of DAFTAR_ATURAN_LINE_PRM_AID) {
    if (aturan.kataKunci.some((k) => gabungan.includes(k))) {
      return aturan.warna;
    }
  }

  if (input.kategori && FALLBACK_LINE_SNI[input.kategori]) {
    return FALLBACK_LINE_SNI[input.kategori];
  }
  return "#FF0000";
}

/**
 * Menentukan `kategori` dan `simbol` untuk Point berdasarkan `Kode PRM-AID.xlsx`, SNI 6502,
 * serta ketersediaan ikon di `walaya.prm.my.id/assets/resources/peta/point/`.
 */
export function tentukanSimbolDanKategoriPointPrmAid(input: {
  label?: string;
  kategori?: string;
  keterangan?: string;
  simbol?: string;
}): { kategori: string; simbol: string } {
  const katAsli = String(input.kategori ?? "").trim();
  const simbolEksplisit = input.simbol?.trim();

  // Jika kategori langsung cocok dengan 10 kategori Point PRM-AID (mis. Kuburan, Sanitasi, Pendidikan)
  if (katAsli && FALLBACK_POINT_SNI[katAsli] && katAsli !== "Sarana Desa") {
    const gabungan = normalisasiTeksCari(input.label, input.keterangan, katAsli);
    for (const aturan of DAFTAR_ATURAN_POINT_PRM_AID) {
      if (aturan.kategoriPrmAid === katAsli && aturan.kataKunci.some((k) => gabungan.includes(k))) {
        return {
          kategori: katAsli,
          simbol: simbolEksplisit || aturan.simbol
        };
      }
    }
    return {
      kategori: katAsli,
      simbol: simbolEksplisit || FALLBACK_POINT_SNI[katAsli].simbol
    };
  }

  // Deteksi sub-kategori spesifik dari label/keterangan (terutama untuk Sarana Desa / umum)
  const gabungan = normalisasiTeksCari(input.label, input.keterangan, katAsli);
  for (const aturan of DAFTAR_ATURAN_POINT_PRM_AID) {
    if (aturan.kataKunci.some((k) => gabungan.includes(k))) {
      const kategoriHasil = !katAsli || katAsli === "Sarana Desa" ? aturan.kategoriPrmAid : katAsli;
      return {
        kategori: kategoriHasil,
        simbol: simbolEksplisit || aturan.simbol
      };
    }
  }

  if (katAsli && FALLBACK_POINT_SNI[katAsli]) {
    return {
      kategori: katAsli,
      simbol: simbolEksplisit || FALLBACK_POINT_SNI[katAsli].simbol
    };
  }

  return {
    kategori: katAsli || "Fasilitas Umum",
    simbol: simbolEksplisit || "default-icon.png"
  };
}

export interface MasukanAtributPrmAid {
  jenisGeometri: JenisGeometri;
  judul?: string;
  label?: string;
  kategori?: string;
  deskripsi?: string;
  keterangan?: string;
  namaLokal?: string;
  namaIlmiah?: string;
  luasHa?: number;
  luas_ha?: number;
  panjangKm?: number;
  panjang_m?: number;
  url?: string;
  driveFileUrl?: string;
  tepi?: string;
  warna?: string;
  simbol?: string;
}

function susunKeteranganPrmAid(item: MasukanAtributPrmAid): string {
  const ket = String(item.keterangan ?? item.deskripsi ?? "").trim();
  if (ket) return ket;
  const bagian: string[] = [];
  if (item.namaLokal?.trim()) bagian.push(item.namaLokal.trim());
  if (item.namaIlmiah?.trim()) bagian.push(`(${item.namaIlmiah.trim()})`);
  if (bagian.length > 0) return bagian.join(" ");
  return String(item.kategori ?? "").trim();
}

export function susunAtributPolygonPrmAid(item: MasukanAtributPrmAid): AtributPolygonPrmAid {
  const label = String(item.label ?? item.judul ?? "").trim();
  const keterangan = susunKeteranganPrmAid(item);
  const url = String(item.url ?? item.driveFileUrl ?? "").trim();
  const luasMentah = item.luas_ha !== undefined ? Number(item.luas_ha) : Number(item.luasHa ?? 0);
  const luas_ha = Number.isFinite(luasMentah) ? Number(luasMentah.toFixed(7)) : 0;
  const { tepi, warna } = tentukanGayaPolygonPrmAid({
    label,
    kategori: item.kategori,
    keterangan,
    tepi: item.tepi,
    warna: item.warna
  });
  return {
    label,
    luas_ha,
    keterangan,
    url,
    tepi,
    warna
  };
}

export function susunAtributLinePrmAid(item: MasukanAtributPrmAid): AtributLinePrmAid {
  const label = String(item.label ?? item.judul ?? "").trim();
  const keterangan = susunKeteranganPrmAid(item);
  const url = String(item.url ?? item.driveFileUrl ?? "").trim();
  const panjangMentah =
    item.panjang_m !== undefined ? Number(item.panjang_m) : Number(item.panjangKm ?? 0) * 1000;
  const panjang_m = Number.isFinite(panjangMentah) ? Number(panjangMentah.toFixed(2)) : 0;
  const warna = tentukanWarnaLinePrmAid({
    label,
    kategori: item.kategori,
    keterangan,
    warna: item.warna
  });
  return {
    label,
    panjang_m,
    keterangan,
    url,
    warna
  };
}

export function susunAtributPointPrmAid(item: MasukanAtributPrmAid): AtributPointPrmAid {
  const label = String(item.label ?? item.judul ?? "").trim();
  const keterangan = susunKeteranganPrmAid(item);
  const url = String(item.url ?? item.driveFileUrl ?? "").trim();
  const { kategori, simbol } = tentukanSimbolDanKategoriPointPrmAid({
    label,
    kategori: item.kategori,
    keterangan,
    simbol: item.simbol
  });
  return {
    label,
    kategori,
    keterangan,
    url,
    simbol
  };
}

/**
 * Menghasilkan objek atribut tabel sesuai jenis geometri (`point` | `line` | `polygon`)
 * untuk dimasukkan ke dalam `feature.properties` GeoJSON maupun ekspor CSV.
 */
export function susunAtributPrmAid(item: MasukanAtributPrmAid | DataSpasialItem): AtributSpasialPrmAid {
  if (item.jenisGeometri === "polygon") {
    return susunAtributPolygonPrmAid(item);
  }
  if (item.jenisGeometri === "line") {
    return susunAtributLinePrmAid(item);
  }
  return susunAtributPointPrmAid(item);
}
