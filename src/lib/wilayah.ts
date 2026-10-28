import { DataSpasialItem, WilayahAdministrasi } from "../types";

/**
 * Wilayah administrasi (provinsi, kabupaten/kota, kecamatan, kelurahan/desa) dan penamaan berkas di
 * Google Drive. Data masuk ke folder Provinsi/Kabupaten/Kecamatan/Desa dengan nama berkas
 * akun_data_bulan_tahun, mis. budi_sebaran_anggrek_november_2026. Code.gs memakai aturan yang sama.
 */

/** 38 provinsi Indonesia, urut kode Kemendagri */
export const DAFTAR_PROVINSI = [
  "Aceh",
  "Sumatera Utara",
  "Sumatera Barat",
  "Riau",
  "Jambi",
  "Sumatera Selatan",
  "Bengkulu",
  "Lampung",
  "Kepulauan Bangka Belitung",
  "Kepulauan Riau",
  "DKI Jakarta",
  "Jawa Barat",
  "Jawa Tengah",
  "DI Yogyakarta",
  "Jawa Timur",
  "Banten",
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Barat",
  "Kalimantan Tengah",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
  "Sulawesi Utara",
  "Sulawesi Tengah",
  "Sulawesi Selatan",
  "Sulawesi Tenggara",
  "Gorontalo",
  "Sulawesi Barat",
  "Maluku",
  "Maluku Utara",
  "Papua",
  "Papua Barat",
  "Papua Selatan",
  "Papua Tengah",
  "Papua Pegunungan",
  "Papua Barat Daya"
];

export const TINGKAT_WILAYAH: { kunci: keyof WilayahAdministrasi; label: string }[] = [
  { kunci: "provinsi", label: "Provinsi" },
  { kunci: "kabupaten", label: "Kabupaten/Kota" },
  { kunci: "kecamatan", label: "Kecamatan" },
  { kunci: "desa", label: "Kelurahan/Desa" }
];

export const WILAYAH_KOSONG: WilayahAdministrasi = { provinsi: "", kabupaten: "", kecamatan: "", desa: "" };

/** Nama folder di Drive untuk tingkat wilayah yang belum diisi */
export const BELUM_DIISI = "Wilayah_Belum_Diisi";

export const NAMA_BULAN = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember"
];

/** Spasi dirapikan dan garis miring (pemisah folder) diganti; huruf besar-kecil dibiarkan seperti diketik */
export function rapikanNamaWilayah(teks: string | undefined | null): string {
  const t = (teks ?? "")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return t === "-" ? "" : t;
}

export function rapikanWilayah(w: Partial<WilayahAdministrasi> | undefined | null): WilayahAdministrasi {
  return {
    provinsi: rapikanNamaWilayah(w?.provinsi),
    kabupaten: rapikanNamaWilayah(w?.kabupaten),
    kecamatan: rapikanNamaWilayah(w?.kecamatan),
    desa: rapikanNamaWilayah(w?.desa)
  };
}

export function wilayahLengkap(w: Partial<WilayahAdministrasi> | undefined | null): w is WilayahAdministrasi {
  const r = rapikanWilayah(w);
  return TINGKAT_WILAYAH.every((t) => r[t.kunci] !== "");
}

export const wilayahKosong = (w: Partial<WilayahAdministrasi> | undefined | null): boolean => {
  const r = rapikanWilayah(w);
  return TINGKAT_WILAYAH.every((t) => r[t.kunci] === "");
};

/** Folder tujuan di Drive dari provinsi sampai desa; tingkat yang kosong menjadi Wilayah_Belum_Diisi */
export function jalurFolder(w: Partial<WilayahAdministrasi> | undefined | null): string[] {
  const r = rapikanWilayah(w);
  return TINGKAT_WILAYAH.map((t) => r[t.kunci] || BELUM_DIISI);
}

export const teksWilayah = (w: Partial<WilayahAdministrasi> | undefined | null): string => jalurFolder(w).join(" › ");

/** Huruf kecil tanpa aksen; selain huruf dan angka menjadi garis bawah */
export function slugBerkas(teks: string | undefined | null, maks = 60): string {
  return (teks ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maks)
    .replace(/_+$/, "");
}

/**
 * Nama berkas di Drive: nama akun pembuat, nama data (judul objek, atau kategori bila kosong), bulan dan
 * tahun perekaman, mis. budi_sebaran_anggrek_november_2026. Objek dengan nama sama dari akun yang sama
 * pada bulan yang sama dikumpulkan dalam satu berkas.
 */
export function namaBerkasData(d: Pick<DataSpasialItem, "namaKader" | "judul" | "kategori" | "createdAt">): string {
  const waktu = new Date(d.createdAt);
  const t = Number.isNaN(waktu.getTime()) ? new Date() : waktu;
  const akun = slugBerkas(d.namaKader, 40) || "kader";
  const data = slugBerkas(d.judul) || slugBerkas(d.kategori, 40) || "data";
  return `${akun}_${data}_${NAMA_BULAN[t.getMonth()]}_${t.getFullYear()}`;
}

/**
 * Wilayah tujuan sebuah data: cap wilayah pada data bila lengkap, selain itu wilayah akun pembuatnya
 * saat ini (admin mungkin baru melengkapinya), dan nama desa lama sebagai cadangan terakhir.
 */
export function wilayahUntukData(
  d: Pick<DataSpasialItem, "wilayah" | "desaWilayah">,
  wilayahAkun?: Partial<WilayahAdministrasi> | null
): WilayahAdministrasi {
  const dasar = wilayahLengkap(d.wilayah) ? d.wilayah : wilayahAkun && !wilayahKosong(wilayahAkun) ? wilayahAkun : d.wilayah;
  const w = rapikanWilayah(dasar);
  return { ...w, desa: w.desa || rapikanNamaWilayah(d.desaWilayah) };
}
