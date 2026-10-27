import { PeranPengguna } from "../types";

export interface AkunPengguna {
  idKader: string;
  nama: string;
  email: string;
  password: string; // Plaintext untuk mock/simulasi lokal yang aman di browser
  peran: PeranPengguna;
  desaWilayah: string;
  noHp: string;
  kelompokMasyarakat: string;
  namaOrganisasi: string;
  createdAt: string;
}

const KEY_ACCOUNTS = "geokader_accounts_v2";
const KEY_SESSION = "geokader_current_session_v2";

export const AKUN_DEFAULT: AkunPengguna[] = [
  {
    idKader: "ADM-2026-001",
    nama: "Ir. Hendra Wijaya, M.Sc.",
    email: "admin@geokader.id",
    password: "admin123",
    peran: "admin",
    desaWilayah: "Pusat Koordinasi GIS",
    noHp: "0811-2233-4455",
    kelompokMasyarakat: "Tim Verifikasi & GIS Organisasi",
    namaOrganisasi: "Konsorsium Pemetaan Partisipatif Nusantara",
    createdAt: "2026-10-01T08:00:00.000Z"
  },
  {
    idKader: "KDR-2026-014",
    nama: "Budi Santoso",
    email: "kader@geokader.id",
    password: "kader123",
    peran: "kader",
    desaWilayah: "Desa Rimba Lestari",
    noHp: "0812-3456-7890",
    kelompokMasyarakat: "Kelompok Tani Hutan (KTH) Mandiri",
    namaOrganisasi: "Konsorsium Pemetaan Partisipatif Nusantara",
    createdAt: "2026-10-15T08:00:00.000Z"
  }
];

export function muatSemuaAkun(): AkunPengguna[] {
  try {
    const raw = localStorage.getItem(KEY_ACCOUNTS);
    if (!raw) {
      localStorage.setItem(KEY_ACCOUNTS, JSON.stringify(AKUN_DEFAULT));
      return AKUN_DEFAULT;
    }
    const accounts = JSON.parse(raw) as AkunPengguna[];
    // Pastikan akun default selalu ada
    for (const def of AKUN_DEFAULT) {
      if (!accounts.some((a) => a.email.toLowerCase() === def.email.toLowerCase())) {
        accounts.push(def);
      }
    }
    return accounts;
  } catch {
    return AKUN_DEFAULT;
  }
}

export function simpanSemuaAkun(accounts: AkunPengguna[]): void {
  try {
    localStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
  } catch {
    // abaikan
  }
}

export function muatSesiPengguna(): AkunPengguna | null {
  try {
    const raw = localStorage.getItem(KEY_SESSION);
    if (!raw) return null;
    return JSON.parse(raw) as AkunPengguna;
  } catch {
    return null;
  }
}

export function simpanSesiPengguna(akun: AkunPengguna | null): void {
  try {
    if (!akun) {
      localStorage.removeItem(KEY_SESSION);
    } else {
      localStorage.setItem(KEY_SESSION, JSON.stringify(akun));
    }
  } catch {
    // abaikan
  }
}

export function autentikasiLogin(
  email: string,
  kataSandi: string
): { sukses: boolean; pesan: string; akun?: AkunPengguna } {
  const accounts = muatSemuaAkun();
  const emailBersih = email.trim().toLowerCase();
  const akun = accounts.find((a) => a.email.toLowerCase() === emailBersih);

  if (!akun) {
    return {
      sukses: false,
      pesan: "Email tidak terdaftar dalam sistem GeoKader. Silakan periksa kembali atau daftar akun baru."
    };
  }

  if (akun.password !== kataSandi.trim()) {
    return {
      sukses: false,
      pesan: "Kata sandi yang Anda masukkan salah. Gunakan opsi 'Lupa Kata Sandi' jika Anda lupa."
    };
  }

  simpanSesiPengguna(akun);
  return {
    sukses: true,
    pesan: `Selamat datang kembali, ${akun.nama}!`,
    akun
  };
}

export function daftarAkunBaru(data: {
  nama: string;
  email: string;
  kataSandi: string;
  peran: PeranPengguna;
  desaWilayah: string;
  noHp: string;
  kelompokMasyarakat?: string;
}): { sukses: boolean; pesan: string; akun?: AkunPengguna } {
  const accounts = muatSemuaAkun();
  const emailBersih = data.email.trim().toLowerCase();

  if (accounts.some((a) => a.email.toLowerCase() === emailBersih)) {
    return {
      sukses: false,
      pesan: "Email ini sudah terdaftar. Silakan masuk menggunakan email ini atau pilih Lupa Kata Sandi."
    };
  }

  const akunBaru: AkunPengguna = {
    idKader: data.peran === "admin" ? `ADM-${Date.now().toString().slice(-4)}` : `KDR-${Date.now().toString().slice(-4)}`,
    nama: data.nama.trim(),
    email: emailBersih,
    password: data.kataSandi.trim(),
    peran: data.peran,
    desaWilayah: data.desaWilayah.trim() || "Desa Rimba Lestari",
    noHp: data.noHp.trim() || "-",
    kelompokMasyarakat: data.kelompokMasyarakat?.trim() || "Kelompok Pemetaan Masyarakat",
    namaOrganisasi: "Konsorsium Pemetaan Partisipatif Nusantara",
    createdAt: new Date().toISOString()
  };

  accounts.push(akunBaru);
  simpanSemuaAkun(accounts);
  simpanSesiPengguna(akunBaru);

  return {
    sukses: true,
    pesan: `Pendaftaran berhasil! Selamat bertugas, ${akunBaru.nama}.`,
    akun: akunBaru
  };
}

export function resetKataSandi(
  email: string,
  kataSandiBaru: string
): { sukses: boolean; pesan: string } {
  const accounts = muatSemuaAkun();
  const emailBersih = email.trim().toLowerCase();
  const index = accounts.findIndex((a) => a.email.toLowerCase() === emailBersih);

  if (index === -1) {
    return {
      sukses: false,
      pesan: "Email tidak ditemukan di sistem. Pastikan alamat email benar."
    };
  }

  accounts[index].password = kataSandiBaru.trim();
  simpanSemuaAkun(accounts);

  return {
    sukses: true,
    pesan: "Kata sandi berhasil diperbarui! Silakan masuk menggunakan kata sandi baru Anda."
  };
}
