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

// Versi 5 storage keys — seluruh contoh/dummy data dihapus bersih
const KEY_PROFIL = "geokader_profil_v5";
const KEY_SPASIAL = "geokader_data_spasial_v5";
const KEY_OFFLINE_MAPS = "geokader_offline_maps_v5";
const KEY_LAPISAN = "geokader_lapisan_v5";
const KEY_SERTIFIKAT = "geokader_sertifikat_v5";
const KEY_UPAH_HOK = "geokader_upah_hok_v5";
const KEY_PENGUMUMAN = "geokader_pengumuman_v5";
const KEY_TUGAS = "geokader_tugas_v5";
const KEY_PESAN = "geokader_pesan_v5";
const KEY_GDRIVE = "geokader_gdrive_v5";
const KEY_KADER_AKTIF = "geokader_kader_aktif_v5";
const KEY_CLEANED_V5 = "geokader_cleaned_v5";

function bersihkanDataContohLama(): void {
  try {
    if (localStorage.getItem(KEY_CLEANED_V5) === "1") return;
    const kunciHapus: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("geokader_") && !k.endsWith("_v5")) {
        kunciHapus.push(k);
      }
    }
    kunciHapus.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(KEY_CLEANED_V5, "1");
  } catch {
    // abaikan jika storage tidak tersedia
  }
}

bersihkanDataContohLama();

export const PROFIL_BAWAAN: ProfilKader = {
  idKader: "KDR-001",
  nama: "Kader Pemetaan",
  desaWilayah: "-",
  kelompokMasyarakat: "-",
  noHp: "-",
  namaOrganisasi: "Konsorsium Pemetaan Partisipatif",
  tarifHokRupiah: 150000,
  modePerhitunganUpah: "kumulatif",
  modeKombinasiTarget: "per_kategori"
};

// Seluruh data awal dimulai kosong (tanpa data contoh/dummy)
export const DATA_SPASIAL_AWAL: DataSpasialItem[] = [];
export const AREA_OFFLINE_AWAL: AreaPetaOffline[] = [];
export const LAPISAN_AWAL: LapisanSpasial[] = [];
export const SERTIFIKAT_AWAL: SertifikatKader[] = [];
export const KLAIM_UPAH_AWAL: KlaimUpahHOK[] = [];
export const PENGUMUMAN_AWAL: PengumumanBroadcast[] = [];
export const TUGAS_AWAL: TugasPemetaan[] = [];
export const PESAN_AWAL: PesanKomunikasi[] = [];
export const KADER_AKTIF_AWAL: KaderAktifPresence[] = [];

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
    folderIdDatabase: "",
    spreadsheetIdMaster: "",
    autoSyncSaatOnline: true,
    terakhirSinkron: ""
  });
export const simpanKonfigGDrive = (v: KonfigurasiGDrive) => simpanJson(KEY_GDRIVE, v);
