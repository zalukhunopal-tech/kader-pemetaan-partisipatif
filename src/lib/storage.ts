import {
  AreaPetaOffline,
  DataSpasialItem,
  KaderAktifPresence,
  KlaimUpahHOK,
  KonfigurasiGDrive,
  LapisanSpasial,
  PengumumanBroadcast,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  TugasPemetaan
} from "../types";

// Versi 4 storage keys untuk memastikan semua mock/contoh lama dibersihkan
const KEY_PROFIL = "geokader_profil_v4";
const KEY_SPASIAL = "geokader_data_spasial_v4";
const KEY_OFFLINE_MAPS = "geokader_offline_maps_v4";
const KEY_LAPISAN = "geokader_lapisan_v4";
const KEY_SERTIFIKAT = "geokader_sertifikat_v4";
const KEY_UPAH_HOK = "geokader_upah_hok_v4";
const KEY_PENGUMUMAN = "geokader_pengumuman_v4";
const KEY_TUGAS = "geokader_tugas_v4";
const KEY_PESAN = "geokader_pesan_v4";
const KEY_GDRIVE = "geokader_gdrive_v4";
const KEY_KADER_AKTIF = "geokader_kader_aktif_v4";

export const PROFIL_BAWAAN: ProfilKader = {
  idKader: "KDR-2026-014",
  nama: "Budi Santoso",
  desaWilayah: "Desa Rimba Lestari",
  kelompokMasyarakat: "Kelompok Tani Hutan (KTH) Mandiri",
  noHp: "0812-3456-7890",
  namaOrganisasi: "Konsorsium Pemetaan Partisipatif Nusantara",
  tarifHokRupiah: 150000,
  modePerhitunganUpah: "kumulatif",
  modeKombinasiTarget: "per_kategori"
};

// Data Spasial Lapangan dimulai bersih (kosong tanpa contoh dummy)
export const DATA_SPASIAL_AWAL: DataSpasialItem[] = [];

// Pustaka Peta Offline dimulai bersih (contoh mock lama dihapus)
export const AREA_OFFLINE_AWAL: AreaPetaOffline[] = [];

// Lapisan Spasial Kategori Standar
export const LAPISAN_AWAL: LapisanSpasial[] = [
  {
    id: "LYR-01",
    nama: "Lapisan Flora",
    jumlahPeta: 0,
    kategoriDefault: "Flora",
    createdAt: new Date().toISOString()
  },
  {
    id: "LYR-02",
    nama: "Lapisan Fauna",
    jumlahPeta: 0,
    kategoriDefault: "Fauna",
    createdAt: new Date().toISOString()
  },
  {
    id: "LYR-03",
    nama: "Lapisan Mata Air",
    jumlahPeta: 0,
    kategoriDefault: "Mata Air",
    createdAt: new Date().toISOString()
  },
  {
    id: "LYR-04",
    nama: "Lapisan Wilayah Adat & Batas",
    jumlahPeta: 0,
    kategoriDefault: "Wilayah Adat / Lahan",
    createdAt: new Date().toISOString()
  }
];

export const SERTIFIKAT_AWAL: SertifikatKader[] = [];
export const KLAIM_UPAH_AWAL: KlaimUpahHOK[] = [];
export const PENGUMUMAN_AWAL: PengumumanBroadcast[] = [];
export const TUGAS_AWAL: TugasPemetaan[] = [];
export const PESAN_AWAL: PesanKomunikasi[] = [];

// Data Kehadiran Kader Aktif & Koordinat GPS Lapangan Terkini untuk Monitor Admin
export const KADER_AKTIF_AWAL: KaderAktifPresence[] = [
  {
    idKader: "KDR-2026-014",
    nama: "Budi Santoso",
    desaWilayah: "Desa Rimba Lestari",
    status: "survei_aktif",
    lat: -0.94725,
    lng: 100.4178,
    akurasi: 3.2,
    baterai: 88,
    aktivitasTerakhir: "Sedang Merekam Titik Flora (Blok Hulu)",
    waktuUpdate: "Baru saja"
  },
  {
    idKader: "KDR-2026-008",
    nama: "Siti Rahmah",
    desaWilayah: "Desa Rimba Lestari",
    status: "online",
    lat: -0.9448,
    lng: 100.4212,
    akurasi: 4.0,
    baterai: 76,
    aktivitasTerakhir: "Patroli Jalur Punggungan Dusun I",
    waktuUpdate: "4 menit lalu"
  },
  {
    idKader: "KDR-2026-021",
    nama: "Ahmad Fadli",
    desaWilayah: "Dusun II Batu Putih",
    status: "survei_aktif",
    lat: -0.9491,
    lng: 100.4151,
    akurasi: 2.8,
    baterai: 94,
    aktivitasTerakhir: "Pengukuran Koordinat Sumber Air",
    waktuUpdate: "1 menit lalu"
  },
  {
    idKader: "KDR-2026-035",
    nama: "Dewi Lestari",
    desaWilayah: "Desa Rimba Lestari",
    status: "offline",
    lat: -0.9518,
    lng: 100.4235,
    akurasi: 5.5,
    baterai: 42,
    aktivitasTerakhir: "Standby di Pos Koordinasi Desa",
    waktuUpdate: "1 jam lalu"
  }
];

function bacaJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function simpanJson<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // abaikan kuota
  }
}

export const muatProfil = () => bacaJson<ProfilKader>(KEY_PROFIL, PROFIL_BAWAAN);
export const simpanProfil = (v: ProfilKader) => simpanJson(KEY_PROFIL, v);

export const muatDataSpasial = () => bacaJson<DataSpasialItem[]>(KEY_SPASIAL, DATA_SPASIAL_AWAL);
export const simpanDataSpasial = (v: DataSpasialItem[]) => simpanJson(KEY_SPASIAL, v);

export const muatAreaOffline = () => bacaJson<AreaPetaOffline[]>(KEY_OFFLINE_MAPS, AREA_OFFLINE_AWAL);
export const simpanAreaOffline = (v: AreaPetaOffline[]) => simpanJson(KEY_OFFLINE_MAPS, v);

export const muatLapisan = () => bacaJson<LapisanSpasial[]>(KEY_LAPISAN, LAPISAN_AWAL);
export const simpanLapisan = (v: LapisanSpasial[]) => simpanJson(KEY_LAPISAN, v);

export const muatSertifikat = () => bacaJson<SertifikatKader[]>(KEY_SERTIFIKAT, SERTIFIKAT_AWAL);
export const simpanSertifikat = (v: SertifikatKader[]) => simpanJson(KEY_SERTIFIKAT, v);

export const muatKlaimUpah = () => bacaJson<KlaimUpahHOK[]>(KEY_UPAH_HOK, KLAIM_UPAH_AWAL);
export const simpanKlaimUpah = (v: KlaimUpahHOK[]) => simpanJson(KEY_UPAH_HOK, v);

export const muatPengumuman = () => bacaJson<PengumumanBroadcast[]>(KEY_PENGUMUMAN, PENGUMUMAN_AWAL);
export const simpanPengumuman = (v: PengumumanBroadcast[]) => simpanJson(KEY_PENGUMUMAN, v);

export const muatTugas = () => bacaJson<TugasPemetaan[]>(KEY_TUGAS, TUGAS_AWAL);
export const simpanTugas = (v: TugasPemetaan[]) => simpanJson(KEY_TUGAS, v);

export const muatPesan = () => bacaJson<PesanKomunikasi[]>(KEY_PESAN, PESAN_AWAL);
export const simpanPesan = (v: PesanKomunikasi[]) => simpanJson(KEY_PESAN, v);

export const muatKaderAktif = () => bacaJson<KaderAktifPresence[]>(KEY_KADER_AKTIF, KADER_AKTIF_AWAL);
export const simpanKaderAktif = (v: KaderAktifPresence[]) => simpanJson(KEY_KADER_AKTIF, v);

export const muatKonfigGDrive = () =>
  bacaJson<KonfigurasiGDrive>(KEY_GDRIVE, {
    webAppUrl: "",
    folderIdDatabase: "Database_Pemetaan",
    spreadsheetIdMaster: "Master_Spasial_Sheets",
    autoSyncSaatOnline: true,
    terakhirSinkron: ""
  });
export const simpanKonfigGDrive = (v: KonfigurasiGDrive) => simpanJson(KEY_GDRIVE, v);
