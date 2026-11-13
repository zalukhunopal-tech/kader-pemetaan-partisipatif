import { LogoSertifikatItem, PenandatanganSertifikatItem } from "../types";

/**
 * Daftar Logo Default pada Header Sertifikat (Dapat Diatur, Ditambah, Diubah & Dihapus)
 */
export const DEFAULT_LOGO_SERTIFIKAT: LogoSertifikatItem[] = [
  {
    id: "logo-1",
    nama: "BALAI SPASIAL",
    warnaAksen: "#facc15"
  },
  {
    id: "logo-2",
    nama: "DESA MANDIRI",
    warnaAksen: "#38bdf8"
  },
  {
    id: "logo-3",
    nama: "RIMBA LESTARI",
    warnaAksen: "#22c55e"
  },
  {
    id: "logo-4",
    nama: "TITIK TAPAK ID",
    warnaAksen: "#a855f7"
  }
];

/**
 * Daftar Penandatangan Default pada Sertifikat (Diurutkan dari Posisi Tertinggi KKI Warsi)
 * 1. Direktur KKI Warsi (Tertinggi)
 * 2. Manajer Program KKI Warsi (Diksi Baku Bahasa Indonesia)
 * 3. Koordinator Proyek Kayan Mentarang KKI Warsi
 * 4. GIS dan IT KKI Warsi (Bebas simbol & sesuai aturan UI)
 * Masing-masing posisi dapat diubah dan diinput namanya langsung oleh pengguna/admin.
 */
export const DEFAULT_PENANDATANGAN_SERTIFIKAT: PenandatanganSertifikatItem[] = [
  {
    id: "sign-1",
    jabatan: "Direktur",
    instansi: "KKI Warsi",
    nama: "Adi Junedi"
  },
  {
    id: "sign-2",
    jabatan: "Manajer Program",
    instansi: "KKI Warsi",
    nama: "Yul Qari"
  },
  {
    id: "sign-3",
    jabatan: "Koordinator Proyek Kayan Mentarang",
    instansi: "KKI Warsi",
    nama: "Koordinator Proyek Kayan Mentarang"
  },
  {
    id: "sign-4",
    jabatan: "GIS dan IT",
    instansi: "KKI Warsi",
    nama: "Staf GIS dan IT KKI Warsi"
  }
];
