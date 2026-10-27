export type PeranPengguna = "kader" | "admin";

export type JenisGeometri = "point" | "line" | "polygon";

export type KategoriSurvei =
  | "Flora"
  | "Fauna"
  | "Mata Air"
  | "Tanda Batas"
  | "Ancaman / Temuan"
  | "Wilayah Adat / Lahan";

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
}

export interface PembaruanObjek {
  id: string;
  tanggal: string;
  olehKader: string;
  kondisiTerbaru: string;
  catatan: string;
  fotoBase64?: string;
}

export interface DataSpasialItem {
  id: string;
  idKader: string;
  namaKader: string;
  desaWilayah: string;
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
  diunduhPada: string;
  jenisFile?: "XYZ Tiles" | "GeoPDF / GeoTIFF" | "MBTiles / KMZ";
}

export type BasemapType = "satelit" | "osm" | "topo" | "taktis";

export type FormatKoordinat = "DD" | "DMS" | "UTM";

export interface ProfilKader {
  idKader: string;
  nama: string;
  desaWilayah: string;
  kelompokMasyarakat: string;
  noHp: string;
  namaOrganisasi: string;
  tarifHokRupiah: number;
  modePerhitunganUpah: "kumulatif" | "reset_setelah_sertifikat";
  modeKombinasiTarget: "per_kategori" | "gabungan_proporsional";
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
}

export interface KlaimUpahHOK {
  id: string;
  idKader: string;
  namaKader: string;
  desaWilayah: string;
  paketKe: number; // misal Paket 2, 4, 6...
  jumlahHok: number; // 1 Hari Orang Kerja (1 HOK)
  nominalRupiah: number;
  rincianBukti: string;
  tanggalKlaim: string;
  status: "terbuka" | "diajukan" | "disetujui" | "dicairkan";
  catatanAdmin?: string;
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
  status: "aktif" | "selesai";
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
  statusKirim: "antrean_offline" | "terkirim";
  pinKoordinat?: {
    lat: number;
    lng: number;
    label: string;
  };
  lampiranFoto?: string;
  durasiSuaraDetik?: number;
}

export interface KonfigurasiGDrive {
  webAppUrl: string; // URL Google Apps Script Web App
  folderIdDatabase: string;
  spreadsheetIdMaster: string;
  autoSyncSaatOnline: boolean;
  terakhirSinkron?: string;
}

export type MenuTab =
  | "peta"
  | "data_sync"
  | "reward"
  | "tugas"
  | "komunikasi"
  | "admin";
