import {
  AreaPetaOffline,
  DataSpasialItem,
  KaderAktifPresence,
  LapisanSpasial,
  PengumumanBroadcast,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  StatusGDrive,
  TugasPemetaan
} from "../types";
import { unikkanId } from "./id";
import { bacaTeks, siapkanPenyimpanan, tulisTeks } from "./penyimpanan";

// Versi 5 storage keys — seluruh contoh/dummy data dihapus bersih
const KEY_PROFIL = "geokader_profil_v5";
const KEY_SPASIAL = "geokader_data_spasial_v5";
const KEY_OFFLINE_MAPS = "geokader_offline_maps_v5";
const KEY_LAPISAN = "geokader_lapisan_v5";
const KEY_SERTIFIKAT = "geokader_sertifikat_v5";
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
  namaOrganisasi: "Sertifikat Kader Pemetaan Partisipatif",
  modeKombinasiTarget: "per_kategori",
  namaPenandatanganSertifikat: "Koordinator Program GIS",
  jabatanPenandatanganSertifikat: "Koordinator Verifikasi Spasial",
  temaKegiatanSertifikat: "Inventarisasi dan Verifikasi Data Geospasial Wilayah Desa Rimba Hijau"
};

// Seluruh data awal dimulai kosong (tanpa data contoh/dummy)
export const DATA_SPASIAL_AWAL: DataSpasialItem[] = [];
export const AREA_OFFLINE_AWAL: AreaPetaOffline[] = [];
export const LAPISAN_AWAL: LapisanSpasial[] = [];
export const SERTIFIKAT_AWAL: SertifikatKader[] = [];
export const PENGUMUMAN_AWAL: PengumumanBroadcast[] = [];
export const TUGAS_AWAL: TugasPemetaan[] = [];
export const PESAN_AWAL: PesanKomunikasi[] = [];
export const KADER_AKTIF_AWAL: KaderAktifPresence[] = [];

/** Kunci data yang dipindahkan dari localStorage ke IndexedDB (sesi/akun tetap di localStorage) */
export const KUNCI_DATA = [
  KEY_PROFIL,
  KEY_SPASIAL,
  KEY_OFFLINE_MAPS,
  KEY_LAPISAN,
  KEY_SERTIFIKAT,
  KEY_PENGUMUMAN,
  KEY_TUGAS,
  KEY_PESAN,
  KEY_GDRIVE,
  KEY_KADER_AKTIF
];

/** Harus selesai sebelum aplikasi membaca data (dipanggil di main.tsx) */
export const siapkanStorage = () => siapkanPenyimpanan(KUNCI_DATA);

function bacaJson<T>(key: string, fallback: T): T {
  try {
    const raw = bacaTeks(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Kegagalan menulis (mis. kuota penuh) tidak lagi diabaikan: penyimpanan.ts mencatatnya
// pada status yang ditampilkan aplikasi sebagai peringatan.
function simpanJson<T>(key: string, val: T): void {
  tulisTeks(key, JSON.stringify(val));
}

export const muatProfil = () => {
  const p = bacaJson<ProfilKader>(KEY_PROFIL, PROFIL_BAWAAN);
  if (!p.namaOrganisasi || p.namaOrganisasi === "Konsorsium Pemetaan Partisipatif") {
    p.namaOrganisasi = "Sertifikat Kader Pemetaan Partisipatif";
  }
  if (p.nama === "Budi Santoso (Kader Lapangan)") {
    p.nama = "Budi Santoso";
  }
  return p;
};
export const simpanProfil = (v: ProfilKader) => simpanJson(KEY_PROFIL, v);

export const muatDataSpasial = () => unikkanId(bacaJson<DataSpasialItem[]>(KEY_SPASIAL, DATA_SPASIAL_AWAL));
export const simpanDataSpasial = (v: DataSpasialItem[]) => simpanJson(KEY_SPASIAL, v);

export const muatAreaOffline = () => unikkanId(bacaJson<AreaPetaOffline[]>(KEY_OFFLINE_MAPS, AREA_OFFLINE_AWAL));
export const simpanAreaOffline = (v: AreaPetaOffline[]) => simpanJson(KEY_OFFLINE_MAPS, v);

export const muatLapisan = () => unikkanId(bacaJson<LapisanSpasial[]>(KEY_LAPISAN, LAPISAN_AWAL));
export const simpanLapisan = (v: LapisanSpasial[]) => simpanJson(KEY_LAPISAN, v);

export const muatSertifikat = () => unikkanId(bacaJson<SertifikatKader[]>(KEY_SERTIFIKAT, SERTIFIKAT_AWAL));
export const simpanSertifikat = (v: SertifikatKader[]) => simpanJson(KEY_SERTIFIKAT, v);

export const muatPengumuman = () => unikkanId(bacaJson<PengumumanBroadcast[]>(KEY_PENGUMUMAN, PENGUMUMAN_AWAL));
export const simpanPengumuman = (v: PengumumanBroadcast[]) => simpanJson(KEY_PENGUMUMAN, v);

export const muatTugas = () => unikkanId(bacaJson<TugasPemetaan[]>(KEY_TUGAS, TUGAS_AWAL));
export const simpanTugas = (v: TugasPemetaan[]) => simpanJson(KEY_TUGAS, v);

// Data lama bertanda "terkirim"/"antrean_offline", padahal pesan tidak pernah meninggalkan perangkat
export const muatPesan = () =>
  unikkanId(bacaJson<PesanKomunikasi[]>(KEY_PESAN, PESAN_AWAL)).map((m) => ({ ...m, statusKirim: "tersimpan" as const }));
export const simpanPesan = (v: PesanKomunikasi[]) => simpanJson(KEY_PESAN, v);

export const muatKaderAktif = () => bacaJson<KaderAktifPresence[]>(KEY_KADER_AKTIF, KADER_AKTIF_AWAL);
export const simpanKaderAktif = (v: KaderAktifPresence[]) => simpanJson(KEY_KADER_AKTIF, v);

/**
 * Hanya waktu sinkron terakhir. Alamat dan token Google Drive kini diisi saat build; nilai lama
 * (URL, token, nama folder) yang pernah diketik di Konfigurasi dibuang saat status disimpan lagi.
 */
export const muatStatusGDrive = (): StatusGDrive => {
  const v = bacaJson<StatusGDrive>(KEY_GDRIVE, {});
  return v.terakhirSinkron ? { terakhirSinkron: v.terakhirSinkron } : {};
};
export const simpanStatusGDrive = (v: StatusGDrive) => simpanJson(KEY_GDRIVE, { terakhirSinkron: v.terakhirSinkron ?? "" });
