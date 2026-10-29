export type PeranPengguna = "kader" | "admin";

export type JenisGeometri = "point" | "line" | "polygon";

export type KategoriSurvei = "Flora" | "Fauna" | "Mata Air" | "Tanda Batas" | "Ancaman / Temuan" | "Wilayah Adat / Lahan";

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
  akurasi?: number; // meter
  timestamp?: string;
  simulasi?: boolean; // true = titik acak dari mode simulasi, bukan GPS perangkat
}

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
  driveFileUrl?: string;
  statusSinkron: StatusSinkron;
  diimpor?: boolean; // true = berasal dari berkas luar, bukan rekaman lapangan kader
  catatanAdmin?: string;
  createdAt: string;
  updatedAt: string;
  riwayatPembaruan: PembaruanObjek[];
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
  thumbnailType?: "radar" | "vector" | "dem_atas" | "dem_bawah";
  diunduhPada: string;
  jenisFile?: "XYZ Tiles" | "GeoPDF / GeoTIFF" | "MBTiles / KMZ";
  /** true bila tile benar-benar tersimpan di perangkat; selain itu entri hanya catatan */
  unduhanNyata?: boolean;
  /** Templat URL tile saat diunduh (untuk menghapus tile area ini) */
  templateTile?: string;
  jumlahGagal?: number;
}

export interface LapisanSpasial {
  id: string;
  nama: string;
  jumlahPeta: number;
  kategoriDefault?: KategoriSurvei;
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
  kategoriTarget: KategoriSurvei;
  targetKuantitas: string; // misal "20 Titik Pohon Pakan" atau "3 Ha Kebun Timur"
  batasWaktu: string;
  koordinatAcuan: KoordinatTitik;
  batasPoligonAcuan?: KoordinatTitik[];
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
