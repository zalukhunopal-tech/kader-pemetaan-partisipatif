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
    nama: "GEOKADER ID",
    warnaAksen: "#a855f7"
  }
];

/**
 * Daftar Penandatangan Default pada Sertifikat (Dapat Diatur, Ditambah, Diubah & Dihapus)
 */
export const DEFAULT_PENANDATANGAN_SERTIFIKAT: PenandatanganSertifikatItem[] = [
  {
    id: "sign-1",
    jabatan: "Koordinator Wilayah",
    instansi: "Balai Pemetaan Spasial Desa",
    nama: "Dr. Ir. Jonni Marwa, S.Hut., M.Si."
  },
  {
    id: "sign-2",
    jabatan: "Ketua Pelaksana",
    instansi: "Jaringan Kader Geospasial",
    nama: "Dr. Hj. Farah Diba, S.Hut., M.Si."
  },
  {
    id: "sign-3",
    jabatan: "Kepala Divisi Verifikasi",
    instansi: "Pusat Data Geospasial Komunitas",
    nama: "Dr. Ir. Rudi Hartono, S.Hut., M.Si."
  },
  {
    id: "sign-4",
    jabatan: "Ketua Umum",
    instansi: "Indonesia Mapping Community",
    nama: "Zulfikar Mardiyadi, S.Hut., M.Si."
  }
];
