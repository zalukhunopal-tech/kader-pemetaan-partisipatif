import { PeranPengguna } from "../types";

export interface AkunPengguna {
  idKader: string;
  nama: string;
  email: string;
  password: string;
  peran: PeranPengguna;
  desaWilayah: string;
  noHp: string;
  kelompokMasyarakat: string;
  namaOrganisasi: string;
  createdAt: string;
}

const KEY_ACCOUNTS = "geokader_accounts_v5";
const KEY_SESSION = "geokader_current_session_v5";

// Tidak ada akun contoh/dummy bawaan
export const AKUN_DEFAULT: AkunPengguna[] = [];

export function muatSemuaAkun(): AkunPengguna[] {
  try {
    const raw = localStorage.getItem(KEY_ACCOUNTS);
    if (!raw) return [];
    return JSON.parse(raw) as AkunPengguna[];
  } catch {
    return [];
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
      pesan: "Email belum terdaftar. Silakan buat akun baru pada tab Daftar Akun."
    };
  }

  if (akun.password !== kataSandi.trim()) {
    return {
      sukses: false,
      pesan: "Kata sandi salah. Gunakan opsi 'Lupa Kata Sandi' jika diperlukan."
    };
  }

  simpanSesiPengguna(akun);
  return {
    sukses: true,
    pesan: `Selamat datang, ${akun.nama}!`,
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
      pesan: "Email sudah terdaftar. Silakan masuk menggunakan email tersebut."
    };
  }

  const akunBaru: AkunPengguna = {
    idKader:
      data.peran === "admin"
        ? `ADM-${Date.now().toString().slice(-4)}`
        : `KDR-${Date.now().toString().slice(-4)}`,
    nama: data.nama.trim(),
    email: emailBersih,
    password: data.kataSandi.trim(),
    peran: data.peran,
    desaWilayah: data.desaWilayah.trim() || "-",
    noHp: data.noHp.trim() || "-",
    kelompokMasyarakat: data.kelompokMasyarakat?.trim() || "-",
    namaOrganisasi: "Konsorsium Pemetaan Partisipatif",
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
      pesan: "Email tidak ditemukan."
    };
  }

  accounts[index].password = kataSandiBaru.trim();
  simpanSemuaAkun(accounts);

  return {
    sukses: true,
    pesan: "Kata sandi berhasil diperbarui. Silakan masuk."
  };
}
