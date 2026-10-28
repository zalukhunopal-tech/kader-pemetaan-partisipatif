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

// Akun Dummy Bawaan untuk Uji Coba Masuk (Kader & Admin)
export const AKUN_DEFAULT: AkunPengguna[] = [
  {
    idKader: "KDR-001",
    nama: "Budi Santoso",
    email: "kader@geokader.id",
    password: "kader123",
    peran: "kader",
    desaWilayah: "Desa Rimba Hijau",
    noHp: "081234567890",
    kelompokMasyarakat: "Kelompok Tani Hutan Harapan",
    namaOrganisasi: "Sertifikat Kader Pemetaan Partisipatif",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    idKader: "ADM-001",
    nama: "Siti Rahma",
    email: "admin@geokader.id",
    password: "admin123",
    peran: "admin",
    desaWilayah: "Kantor Balai Spasial",
    noHp: "081987654321",
    kelompokMasyarakat: "Tim Verifikasi & Data Spasial",
    namaOrganisasi: "Sertifikat Kader Pemetaan Partisipatif",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

export function muatSemuaAkun(): AkunPengguna[] {
  try {
    const raw = localStorage.getItem(KEY_ACCOUNTS);
    if (!raw) {
      simpanSemuaAkun(AKUN_DEFAULT);
      return AKUN_DEFAULT;
    }
    const accounts = JSON.parse(raw) as AkunPengguna[];
    
    // Pastikan akun dummy default selalu tersedia untuk testing
    let adaPerubahan = false;
    for (const def of AKUN_DEFAULT) {
      if (!accounts.some((a) => a.email.toLowerCase() === def.email.toLowerCase())) {
        accounts.push(def);
        adaPerubahan = true;
      }
    }
    if (adaPerubahan) {
      simpanSemuaAkun(accounts);
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
    const parsed = JSON.parse(raw) as AkunPengguna;
    if (
      !parsed.namaOrganisasi ||
      parsed.namaOrganisasi === "Konsorsium Pemetaan Partisipatif"
    ) {
      parsed.namaOrganisasi = "Sertifikat Kader Pemetaan Partisipatif";
    }
    if (parsed.nama === "Budi Santoso (Kader Lapangan)") {
      parsed.nama = "Budi Santoso";
    }
    return parsed;
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
    namaOrganisasi: "Sertifikat Kader Pemetaan Partisipatif",
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
