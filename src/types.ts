export type PeranPengguna = "kader" | "admin";

export type JenisGeometri = "point" | "line" | "polygon";

export type KategoriSurvei =
  | "Biodiversitas"
  | "Flora"
  | "Fauna"
  | "Mata Air"
  | "Tanda Batas"
  | "Ancaman / Temuan"
  | "Wilayah Adat / Lahan"
  | "Sarana Desa"
  | "Situs Budaya"
  | "Lainnya";

export type StatusSinkron =
  | "lokal" // Tersimpan di HP (Belum Sinkron)
  | "mengunggah" // Sedang Mengunggah
  | "tersinkron" // Tersinkron ke GDrive
  | "terverifikasi" // Terverifikasi Admin
  | "ditolak"; // Perlu Revisi

export interface KoordinatTitik {
  lat: number;
  lng: number;
  elevasi?: number; // Z (mdpl)
  akurasi?: number; // meter (horizontal)
  akurasiVertikal?: number; // meter (vertikal)
  kecepatan?: number; // m/s
  timestamp?: string;
  simulasi?: boolean; // true = titik acak dari mode simulasi, bukan GPS perangkat
}

export interface HasilRataRataGps {
  titik: KoordinatTitik;
  jumlahSampel: number;
  durasiDetik: number;
  /** Sebaran pengamatan, bukan jaminan akurasi survei/geodetik. */
  sebaranMeter: number;
  metode: "inverse_variance";
}

export interface MemoSuara {
  id: string;
  mimeType: "audio/webm;codecs=opus" | "audio/ogg;codecs=opus" | "audio/mp4";
  dataUrl: string;
  durasiDetik: number;
  ukuranByte: number;
  direkamPada: string;
  sha256: string;
}

export interface BuktiFotoLapangan {
  posisi: KoordinatTitik;
  diambilPada: string;
  idKader: string;
  desa: string;
  tematik?: string;
  /** Stamp visual tidak sama dengan metadata EXIF atau bukti bebas manipulasi. */
  stampVisual: boolean;
}

export interface KesepakatanBatas {
  saksi: string[];
  catatan: string;
  disepakatiPada?: string;
  beritaAcaraUrl?: string;
}

export interface SkorKualitasData {
  versi: 1;
  skor: number;
  grade: "A" | "B" | "C" | "D";
  rincian: { gps: number; fotoGeotag: number; atribut: number; geometri: number };
  masalah: string[];
  geometriValid: boolean;
}

export interface KonfigurasiHok {
  idProgram: string;
  versi: string;
  zonaWaktu: string;
  jamPerHok: number;
  bobotJam: number;
  hokPerKmMedanBerat: number;
  bonusTitikGradeA: number;
  batasHokPerHari: number;
}

/** Interval waktu eksplisit mencegah durasi patroli ganda dihitung dua kali. */
export interface SesiPatroliHok {
  id: string;
  idKader: string;
  mulai: string;
  selesai: string;
  kmMedanBerat: number;
  terverifikasi: boolean;
  simulasi?: boolean;
}

export interface RincianHokHarian {
  tanggal: string;
  idKader: string;
  idProgram: string;
  versiRumus: string;
  menitEfektif: number;
  kmMedanBerat: number;
  titikGradeA: number;
  hokJam: number;
  hokJarak: number;
  hokBonus: number;
  hokSebelumBatas: number;
  totalHok: number;
  sumberId: string[];
}

export interface StatusAntreanSinkron {
  idData: string;
  fingerprint: string;
  uploadId?: string;
  fase: "metadata" | "media" | "selesai" | "konflik" | "gagal";
  chunkDiterima: number[];
  jumlahChunk: number;
  percobaan: number;
  cobaLagiPada?: string;
  galat?: string;
}

export interface KonflikSinkron {
  idData: string;
  revisiServer: string;
  lokal: DataSpasialItem;
  server: DataSpasialItem;
  terdeteksiPada: string;
}

export type PilihanResolusiKonflik = "lokal" | "admin" | "gabungkan";

export interface PembaruanObjek {
  id: string;
  tanggal: string;
  idKader?: string; // pencatat pembaruan; entri lama hanya punya olehKader (nama)
  olehKader: string;
  kondisiTerbaru: string;
  catatan: string;
  fotoBase64?: string;
}

/**
 * Wilayah administrasi tempat kader bertugas. Menentukan folder tujuan di Google Drive:
 * Provinsi / Kabupaten atau Kota / Kecamatan / Kelurahan atau Desa.
 */
export interface WilayahAdministrasi {
  provinsi: string;
  /** Kabupaten atau kota */
  kabupaten: string;
  kecamatan: string;
  /** Kelurahan atau desa */
  desa: string;
}

export interface DataSpasialItem {
  id: string;
  idKader: string;
  namaKader: string;
  desaWilayah: string;
  /** Wilayah akun pembuat saat data direkam; data lama tanpa cap memakai wilayah akunnya saat ini */
  wilayah?: WilayahAdministrasi;
  jenisGeometri: JenisGeometri;
  kategori: KategoriSurvei;
  judul: string;
  namaLokal?: string;
  namaIlmiah?: string;
  jumlahIndividu?: number;
  manfaatMasyarakat?: string;
  kondisiAncaman?: string;
  deskripsi: string;
  koordinat: KoordinatTitik[]; // 1 untuk point, >=2 untuk line, >=3 untuk polygon
  panjangKm: number; // Dihitung otomatis untuk line
  luasHa: number; // Dihitung otomatis untuk polygon
  durasiMenit?: number;
  kompasDerajat?: number;
  fotoBase64?: string;
  namaFileFoto?: string;
  gpsAveraging?: HasilRataRataGps;
  memoSuara?: MemoSuara[];
  buktiFoto?: BuktiFotoLapangan;
  kesepakatanBatas?: KesepakatanBatas;
  kualitasData?: SkorKualitasData;
  /** Token CAS server; tidak dibandingkan menggunakan jam perangkat. */
  revisiServer?: string;
  konflikSinkron?: KonflikSinkron;
  driveFileUrl?: string;
  /** Atribut simbologi & tautan standar WebGIS PRM-AID + SNI */
  url?: string;
  tepi?: string;
  warna?: string;
  simbol?: string;
  /** Nama kolam peta tematik (kosong/undefined = data peta biasa / non-tematik) */
  tematik?: string;
  /** ID Lapisan / Tugas asal serta nilai isian atribut kustom sesuai skema Admin */
  lapisanId?: string;
  lapisanNama?: string;
  tugasId?: string;
  atributKustom?: Record<string, string>;
  elevasi?: number;
  /** Penanda bahwa data sedang berada di folder pencadangan 90 hari (tidak masuk database aktif maupun level) */
  dalamPencadangan?: boolean;
  statusSinkron: StatusSinkron;
  diimpor?: boolean; // true = berasal dari berkas luar, bukan rekaman lapangan kader
  catatanAdmin?: string;
  createdAt: string;
  updatedAt: string;
  riwayatPembaruan: PembaruanObjek[];
}

export type StatusPencadanganGDrive =
  | "menunggu_pindah"
  | "di_pencadangan"
  | "menunggu_pulih"
  | "menunggu_hapus_permanen"
  | "lokal_saja";

/**
 * Arsip sementara 90 hari untuk data survei yang dihapus akun Admin.
 * Selama belum dipulihkan, data tidak berada di database aktif dan tidak dihitung dalam kenaikan level.
 * Setelah 90 hari tidak dipulihkan, data dihapus secara permanen.
 */
export interface ItemPencadanganSpasial {
  id: string;
  data: DataSpasialItem;
  dipindahkanPada: string;
  kedaluwarsaPada: string;
  alasan?: string;
  dihapusOleh?: string;
  statusGDrive: StatusPencadanganGDrive;
}

export interface AreaPetaOffline {
  id: string;
  namaArea: string;
  basemapId: BasemapType;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoomMin: number;
  zoomMax: number;
  jumlahTile: number;
  ukuranMb: number;
  jarakKm?: number;
  thumbnailType?: "radar" | "vector" | "dem_atas" | "dem_bawah" | "geopdf_sheet";
  thumbnailDataUrl?: string;
  thumbnailUrl?: string;
  /** Raster telah dipotong sesuai viewport GEO; tanpa margin kertas buatan. */
  rasterGeoreferensi?: boolean;
  petaKustomDataUrl?: string;
  petaKustomUrl?: string;
  statusTeks?: string;
  diunduhPada: string;
  jenisFile?: "XYZ Tiles" | "GeoPDF / GeoTIFF" | "MBTiles / KMZ" | "PMTiles";
  tipeTile?: "vector" | "raster" | "raster-dem";
  crs?: string;
  crsDeskripsi?: string;
  pusatLat?: number;
  pusatLng?: number;
  lebarPixel?: number;
  tinggiPixel?: number;
  resolusiMeter?: number;
  /** true bila tile benar-benar tersimpan di perangkat; selain itu entri hanya catatan */
  unduhanNyata?: boolean;
  /** Templat URL tile saat diunduh (untuk menghapus tile area ini) */
  templateTile?: string;
  jumlahGagal?: number;
  formatGeoref?: "iso32000" | "ogc-lgi" | "geotiff" | "mbtiles" | "pmtiles" | "manual";
  metodeTransformasi?: "afin-proyeksi" | "afin-geografis" | "homografi";
  sisaMeter?: number | null;
  indeksHalaman?: number;
  empatSudut?: [number, number][];
}

export type TipeFieldSkema = "teks" | "angka" | "nominal" | "pilihan" | "tanggal" | "catatan" | "foto";

export interface FieldSkemaAtribut {
  id: string;
  nama: string;
  /** Nama tabel pengelompokan yang dibuat dan dinamai bebas oleh Admin */
  tabel?: string;
  tipe: TipeFieldSkema;
  wajib?: boolean;
  /** Daftar nilai pilihan dropdown yang ditetapkan Admin */
  opsi?: string[];
  /** Nilai bawaan (default) yang ditentukan Admin untuk kolom ini */
  nilaiBawaan?: string;
  placeholder?: string;
}

export interface SkemaAtributGeometri {
  point: FieldSkemaAtribut[];
  line: FieldSkemaAtribut[];
  polygon: FieldSkemaAtribut[];
  /** Daftar nama tabel aktif per geometri (Admin dapat menambah/mengurangi tabel kosong maupun terisi) */
  daftarTabel?: {
    point: string[];
    line: string[];
    polygon: string[];
  };
}

export interface LapisanSpasial {
  id: string;
  nama: string;
  jumlahPeta: number;
  kategoriDefault?: KategoriSurvei;
  /** true = kolam data peta tematik yang terbentuk dari pengisian survei */
  adalahTematik?: boolean;
  /** ID Tugas Pemetaan asal bila lapisan ditautkan dari Tugas yang dibuat Admin */
  tugasId?: string;
  /** Sasaran user/kader penerima tugas (idKader atau email). Kosong atau ['*'] = Semua Kader */
  targetKader?: string[];
  /** Tipe data geometri yang dipilih Admin (Point, Line, Polygon). Kosong = default semua tipe */
  tipeGeometriDiizinkan?: JenisGeometri[];
  /** Isian format data yang ditentukan Admin */
  fields?: FieldSkemaAtribut[];
  /** Konfigurasi isian atribut peta interaktif untuk Point, Line, dan Polygon */
  skemaGeometri?: SkemaAtributGeometri;
  deskripsi?: string;
  createdAt: string;
}

export type BasemapType = "satelit" | "google" | "esri" | "osm" | "topo" | "taktis";

export type FormatKoordinat = "DD" | "DMS" | "UTM";

export interface LogoSertifikatItem {
  id: string;
  nama: string;
  warnaAksen?: string;
  imageBase64?: string;
}

export interface PenandatanganSertifikatItem {
  id: string;
  jabatan: string;
  instansi: string;
  nama: string;
  tandaTanganBase64?: string;
}

export interface ProfilKader {
  idKader: string;
  nama: string;
  desaWilayah: string;
  kelompokMasyarakat: string;
  noHp: string;
  namaOrganisasi: string;
  modeKombinasiTarget: "per_kategori" | "gabungan_proporsional";
  fotoKaderBase64?: string;
  namaPenandatanganSertifikat?: string;
  jabatanPenandatanganSertifikat?: string;
  logoSertifikatList?: LogoSertifikatItem[];
  penandatanganList?: PenandatanganSertifikatItem[];
  temaKegiatanSertifikat?: string;
}

export interface SertifikatKader {
  id: string;
  nomorSertifikat: string;
  idKader: string;
  namaKader: string;
  desaWilayah: string;
  namaOrganisasi: string;
  tanggalTerbit: string;
  alasanCapaian: string; // mis. "50 Titik Koordinat" / "5,2 km Tracking" / "5,4 Ha Poligon"
  status: "menunggu_admin" | "diterbitkan";
  ditandatanganiOleh: string;
  jabatanPenandatangan: string;
  fotoKaderBase64?: string;
  logoSertifikatList?: LogoSertifikatItem[];
  penandatanganList?: PenandatanganSertifikatItem[];
  temaKegiatanSertifikat?: string;
}

export interface PengumumanBroadcast {
  id: string;
  judul: string;
  isi: string;
  kategori: "Info Umum" | "Panduan Survei" | "Peringatan Cuaca" | "Jadwal Kumpul";
  targetDesa: string; // "Semua Wilayah" atau nama desa
  olehAdmin: string;
  tanggal: string;
  penting?: boolean;
}

export interface TugasPemetaan {
  id: string;
  judul: string;
  deskripsi: string;
  targetWilayah: string;
  jenisTargetGeometri: JenisGeometri;
  kategoriTarget?: KategoriSurvei;
  targetKuantitas: string; // misal "20 Titik Pohon Pakan" atau "3 Ha Kebun Timur"
  batasWaktu: string;
  koordinatAcuan: KoordinatTitik;
  batasPoligonAcuan?: KoordinatTitik[];
  /** Sasaran user/kader penerima tugas (idKader atau email). Kosong atau ['*'] = Semua Kader */
  targetKader?: string[];
  /** Tipe data geometri yang dipilih Admin (Point, Line, Polygon). Kosong = default semua tipe */
  tipeGeometriDiizinkan?: JenisGeometri[];
  /** Isian format data yang ditentukan Admin */
  fields?: FieldSkemaAtribut[];
  /** Konfigurasi isian peta interaktif (Point, Line, Polygon) yang diatur Admin */
  skemaGeometri?: SkemaAtributGeometri;
  status: "aktif" | "menunggu_verifikasi" | "selesai";
  dibuatOleh: string;
}

export interface PesanKomunikasi {
  id: string;
  saluran: "komunitas" | "admin"; // komunitas = User<->User, admin = User<->Admin
  idPengirim: string;
  namaPengirim: string;
  peranPengirim: PeranPengguna;
  desaPengirim: string;
  teks: string;
  waktu: string;
  /** Pesan hanya tersimpan di perangkat ini; belum ada server yang meneruskannya ke perangkat lain */
  statusKirim: "tersimpan";
  pinKoordinat?: {
    lat: number;
    lng: number;
    label: string;
  };
  lampiranFoto?: string;
  durasiSuaraDetik?: number;
  audioDataUrl?: string;
  eskalasiAdmin?: boolean;
}

/** Status unggahan ke Google Drive di perangkat ini. Alamat dan token Drive diisi saat build, bukan di aplikasi. */
export interface StatusGDrive {
  terakhirSinkron?: string;
}

export interface KaderAktifPresence {
  idKader: string;
  nama: string;
  desaWilayah: string;
  status: "online" | "survei_aktif" | "offline";
  lat: number;
  lng: number;
  akurasi: number;
  baterai: number;
  aktivitasTerakhir: string;
  waktuUpdate: string;
}

export type MenuTab = "pustaka" | "peta" | "data_sync" | "reward" | "tugas" | "komunikasi" | "admin";
