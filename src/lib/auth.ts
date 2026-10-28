import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { PeranPengguna } from "../types";

/**
 * AUTENTIKASI SISI KLIEN
 * Akun tersimpan di perangkat ini saja (belum ada server). Kata sandi disimpan sebagai hash
 * PBKDF2-SHA256 dengan garam acak per akun dan tidak pernah ditulis ke sesi. Ini mengeraskan
 * penyimpanan lokal, tetapi bukan pengganti server: siapa pun yang bisa membuka dan mengubah
 * penyimpanan browser di perangkat tetap dapat melewatinya.
 */

export interface AkunPengguna {
  idKader: string;
  nama: string;
  email: string;
  peran: PeranPengguna;
  desaWilayah: string;
  noHp: string;
  kelompokMasyarakat: string;
  namaOrganisasi: string;
  createdAt: string;
  kataSandiHash: string; // base64
  garam: string; // base64
  iterasi: number;
  /** true bila sandi bawaan/sementara: pengguna wajib menggantinya sebelum masuk */
  wajibGantiSandi?: boolean;
  /** Sisa format lama (teks polos); dihapus oleh migrasiAkunLama */
  password?: string;
}

/** Data akun yang aman dibawa di sesi dan state aplikasi (tanpa hash atau sandi) */
export type AkunSesi = Omit<AkunPengguna, "kataSandiHash" | "garam" | "iterasi" | "password" | "wajibGantiSandi">;

const KEY_ACCOUNTS = "geokader_accounts_v5";
const KEY_SESSION = "geokader_current_session_v5";
const KEY_GAGAL = "geokader_login_gagal_v5";

export const ITERASI_PBKDF2 = 200_000;
/** Hanya untuk tes: menurunkan jumlah iterasi agar tes cepat. Jangan diubah di aplikasi. */
export const konfigUji = { iterasi: ITERASI_PBKDF2 };
export const MIN_PANJANG_SANDI = 8;
export const NAMA_ORGANISASI_BAWAAN = "Sertifikat Kader Pemetaan Partisipatif";

/** Akun uji hanya tersedia di build pengembangan, atau bila VITE_AKUN_UJI=true */
export const AKUN_UJI_AKTIF: boolean =
  import.meta.env.DEV === true || import.meta.env.VITE_AKUN_UJI === "true";

/* ---------- Penyimpanan ---------- */

export function muatSemuaAkun(): AkunPengguna[] {
  try {
    const raw = localStorage.getItem(KEY_ACCOUNTS);
    return raw ? (JSON.parse(raw) as AkunPengguna[]) : [];
  } catch {
    return [];
  }
}

export function simpanSemuaAkun(accounts: AkunPengguna[]): void {
  try {
    localStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
  } catch {
    // penyimpanan penuh atau tidak tersedia
  }
}

export const adaAdmin = (): boolean => muatSemuaAkun().some((a) => a.peran === "admin");

export const keSesi = (a: AkunSesi): AkunSesi => ({
  idKader: a.idKader,
  nama: a.nama,
  email: a.email,
  peran: a.peran,
  desaWilayah: a.desaWilayah,
  noHp: a.noHp,
  kelompokMasyarakat: a.kelompokMasyarakat,
  namaOrganisasi: a.namaOrganisasi,
  createdAt: a.createdAt
});

/**
 * Sesi dianggap sah hanya bila akunnya masih ada dan peran serta ID-nya sama dengan data akun.
 * Mengubah peran di sesi saja tidak lagi cukup untuk menjadi admin.
 */
export function muatSesiPengguna(): AkunSesi | null {
  try {
    const raw = localStorage.getItem(KEY_SESSION);
    if (!raw) return null;
    const sesi = JSON.parse(raw) as Partial<AkunSesi>;
    const akun = muatSemuaAkun().find((a) => a.email.toLowerCase() === String(sesi.email ?? "").toLowerCase());
    if (!akun || akun.idKader !== sesi.idKader || akun.peran !== sesi.peran || akun.wajibGantiSandi) {
      localStorage.removeItem(KEY_SESSION);
      return null;
    }
    return keSesi(akun);
  } catch {
    return null;
  }
}

export function simpanSesiPengguna(akun: AkunSesi | null): void {
  try {
    if (!akun) localStorage.removeItem(KEY_SESSION);
    else localStorage.setItem(KEY_SESSION, JSON.stringify(keSesi(akun)));
  } catch {
    // abaikan
  }
}

/* ---------- Hash kata sandi ---------- */

const enc = new TextEncoder();

const keBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const dariBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * PBKDF2-HMAC-SHA256. Memakai WebCrypto bila ada (konteks aman), selain itu pustaka murni JS.
 * Keduanya menghasilkan keluaran yang sama untuk masukan yang sama.
 */
export async function turunkanKunci(
  kataSandi: string,
  garam: Uint8Array,
  iterasi: number,
  paksaFallback = false
): Promise<Uint8Array> {
  const sandi = kataSandi.normalize("NFKC");
  const sub = paksaFallback ? undefined : globalThis.crypto?.subtle;
  if (sub) {
    const kunci = await sub.importKey("raw", enc.encode(sandi), "PBKDF2", false, ["deriveBits"]);
    const bits = await sub.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(garam), iterations: iterasi }, kunci, 256);
    return new Uint8Array(bits);
  }
  return pbkdf2Async(sha256, enc.encode(sandi), garam, { c: iterasi, dkLen: 32, asyncTick: 20 });
}

function acak(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export async function buatHashSandi(kataSandi: string, iterasi = konfigUji.iterasi) {
  const garam = acak(16);
  const hash = await turunkanKunci(kataSandi, garam, iterasi);
  return { kataSandiHash: keBase64(hash), garam: keBase64(garam), iterasi };
}

function samaWaktuTetap(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let selisih = 0;
  for (let i = 0; i < a.length; i++) selisih |= a[i] ^ b[i];
  return selisih === 0;
}

export async function cocokSandi(akun: AkunPengguna, kataSandi: string): Promise<boolean> {
  if (!akun.kataSandiHash || !akun.garam) return false;
  const hash = await turunkanKunci(kataSandi, dariBase64(akun.garam), akun.iterasi || konfigUji.iterasi);
  return samaWaktuTetap(hash, dariBase64(akun.kataSandiHash));
}

/** Aturan kata sandi: minimal 8 karakter, bukan nama/email, bukan sandi yang sangat umum */
export function validasiKataSandi(kataSandi: string, konteks: { nama?: string; email?: string } = {}): string | null {
  if (kataSandi.length < MIN_PANJANG_SANDI) return `Kata sandi minimal ${MIN_PANJANG_SANDI} karakter.`;
  if (/^(.)\1+$/.test(kataSandi)) return "Kata sandi tidak boleh berupa satu karakter yang diulang.";
  const kecil = kataSandi.toLowerCase();
  const umum = ["12345678", "123456789", "1234567890", "password", "kata sandi", "katasandi", "qwertyui", "kader123", "admin123", "geokader"];
  if (umum.some((u) => kecil === u || kecil.startsWith(u + "1"))) return "Kata sandi terlalu umum. Pilih yang lebih sulit ditebak.";
  const lokal = (konteks.email ?? "").split("@")[0].toLowerCase();
  if (lokal.length >= 4 && kecil.includes(lokal)) return "Kata sandi tidak boleh memuat bagian email.";
  const nama = (konteks.nama ?? "").trim().toLowerCase();
  if (nama.length >= 4 && kecil.replace(/\s+/g, "").includes(nama.replace(/\s+/g, ""))) return "Kata sandi tidak boleh memuat nama.";
  return null;
}

/* ---------- Pembatasan percobaan masuk ---------- */

interface CatatanGagal {
  [email: string]: { n: number; sampai: number };
}
const BATAS_GAGAL = 5;

function bacaGagal(): CatatanGagal {
  try {
    return JSON.parse(localStorage.getItem(KEY_GAGAL) || "{}") as CatatanGagal;
  } catch {
    return {};
  }
}
function tulisGagal(c: CatatanGagal) {
  try {
    localStorage.setItem(KEY_GAGAL, JSON.stringify(c));
  } catch {
    // abaikan
  }
}

/** Detik tersisa sebelum boleh mencoba lagi; 0 bila boleh */
export function detikTertahan(email: string, sekarang = Date.now()): number {
  const c = bacaGagal()[email.trim().toLowerCase()];
  return c && c.sampai > sekarang ? Math.ceil((c.sampai - sekarang) / 1000) : 0;
}

function catatGagal(email: string, sekarang = Date.now()) {
  const k = email.trim().toLowerCase();
  const semua = bacaGagal();
  const n = (semua[k]?.n ?? 0) + 1;
  // Setelah 5 kegagalan berturut-turut: tunggu 30 detik, lalu dua kali lipat tiap kegagalan, maksimum 10 menit
  const tunggu = n >= BATAS_GAGAL ? Math.min(600, 30 * 2 ** (n - BATAS_GAGAL)) * 1000 : 0;
  semua[k] = { n, sampai: sekarang + tunggu };
  tulisGagal(semua);
}

function hapusGagal(email: string) {
  const semua = bacaGagal();
  delete semua[email.trim().toLowerCase()];
  tulisGagal(semua);
}

/* ---------- Masuk, daftar, ganti dan atur ulang sandi ---------- */

export interface HasilAuth {
  sukses: boolean;
  pesan: string;
  akun?: AkunSesi;
  /** true bila sandi cocok tetapi harus diganti dulu (sandi bawaan atau sementara) */
  wajibGantiSandi?: boolean;
}

export async function autentikasiLogin(email: string, kataSandi: string): Promise<HasilAuth> {
  const emailBersih = email.trim().toLowerCase();
  const tunggu = detikTertahan(emailBersih);
  if (tunggu > 0) {
    return { sukses: false, pesan: `Terlalu banyak percobaan. Coba lagi dalam ${tunggu} detik.` };
  }
  const akun = muatSemuaAkun().find((a) => a.email.toLowerCase() === emailBersih);
  // Selalu lakukan hashing agar waktu respons tidak membedakan email yang ada dan tidak ada
  const cocok = akun ? await cocokSandi(akun, kataSandi) : (await turunkanKunci(kataSandi, acak(16), konfigUji.iterasi), false);
  if (!akun || !cocok) {
    catatGagal(emailBersih);
    return { sukses: false, pesan: "Email atau kata sandi salah." };
  }
  hapusGagal(emailBersih);
  if (akun.wajibGantiSandi) {
    return { sukses: false, wajibGantiSandi: true, pesan: "Kata sandi ini harus diganti sebelum Anda masuk." };
  }
  const sesi = keSesi(akun);
  simpanSesiPengguna(sesi);
  return { sukses: true, pesan: `Selamat datang, ${akun.nama}!`, akun: sesi };
}

interface DataDaftar {
  nama: string;
  email: string;
  kataSandi: string;
  desaWilayah: string;
  noHp: string;
  kelompokMasyarakat?: string;
}

async function buatAkun(data: DataDaftar, peran: PeranPengguna): Promise<HasilAuth> {
  const emailBersih = data.email.trim().toLowerCase();
  const accounts = muatSemuaAkun();
  if (accounts.some((a) => a.email.toLowerCase() === emailBersih)) {
    return { sukses: false, pesan: "Email sudah terdaftar. Silakan masuk menggunakan email tersebut." };
  }
  const galat = validasiKataSandi(data.kataSandi, { nama: data.nama, email: emailBersih });
  if (galat) return { sukses: false, pesan: galat };

  // ID kader menjadi kunci kepemilikan data, jadi harus unik di antara akun yang ada
  const awalan = peran === "admin" ? "ADM" : "KDR";
  let idKader = `${awalan}-${acak(6).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`;
  while (accounts.some((a) => a.idKader === idKader)) {
    idKader = `${awalan}-${acak(6).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`;
  }

  const akunBaru: AkunPengguna = {
    idKader,
    nama: data.nama.trim(),
    email: emailBersih,
    peran,
    desaWilayah: data.desaWilayah.trim() || "-",
    noHp: data.noHp.trim() || "-",
    kelompokMasyarakat: data.kelompokMasyarakat?.trim() || "-",
    namaOrganisasi: NAMA_ORGANISASI_BAWAAN,
    createdAt: new Date().toISOString(),
    ...(await buatHashSandi(data.kataSandi))
  };
  accounts.push(akunBaru);
  simpanSemuaAkun(accounts);
  const sesi = keSesi(akunBaru);
  simpanSesiPengguna(sesi);
  return { sukses: true, pesan: `Pendaftaran berhasil! Selamat bertugas, ${akunBaru.nama}.`, akun: sesi };
}

/** Pendaftaran mandiri selalu menghasilkan akun kader */
export const daftarAkunBaru = (data: DataDaftar) => buatAkun(data, "kader");

/**
 * Admin pertama di perangkat ini. Hanya diizinkan selama belum ada admin, dan bila
 * VITE_KODE_ADMIN diisi, kode aktivasi harus cocok (pencegah salah pakai, bukan rahasia:
 * nilainya ikut di aplikasi).
 */
export async function daftarAdminPertama(data: DataDaftar, kodeAktivasi = ""): Promise<HasilAuth> {
  if (adaAdmin()) {
    return { sukses: false, pesan: "Perangkat ini sudah memiliki Administrator. Minta admin untuk membuat akses." };
  }
  const kodeWajib = (import.meta.env.VITE_KODE_ADMIN ?? "").trim();
  if (kodeWajib && kodeAktivasi.trim() !== kodeWajib) {
    return { sukses: false, pesan: "Kode aktivasi administrator tidak cocok." };
  }
  return buatAkun(data, "admin");
}

export async function ubahKataSandi(email: string, sandiLama: string, sandiBaru: string): Promise<HasilAuth> {
  const emailBersih = email.trim().toLowerCase();
  const tunggu = detikTertahan(emailBersih);
  if (tunggu > 0) return { sukses: false, pesan: `Terlalu banyak percobaan. Coba lagi dalam ${tunggu} detik.` };
  const accounts = muatSemuaAkun();
  const idx = accounts.findIndex((a) => a.email.toLowerCase() === emailBersih);
  if (idx === -1 || !(await cocokSandi(accounts[idx], sandiLama))) {
    catatGagal(emailBersih);
    return { sukses: false, pesan: "Kata sandi saat ini salah." };
  }
  if (sandiBaru === sandiLama) return { sukses: false, pesan: "Kata sandi baru harus berbeda dari yang lama." };
  const galat = validasiKataSandi(sandiBaru, { nama: accounts[idx].nama, email: emailBersih });
  if (galat) return { sukses: false, pesan: galat };
  hapusGagal(emailBersih);
  accounts[idx] = { ...accounts[idx], ...(await buatHashSandi(sandiBaru)), wajibGantiSandi: false };
  delete accounts[idx].password;
  simpanSemuaAkun(accounts);
  return { sukses: true, pesan: "Kata sandi berhasil diganti." };
}

const ALFABET_SEMENTARA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function buatSandiSementara(panjang = 12): string {
  const b = acak(panjang);
  return Array.from(b, (x) => ALFABET_SEMENTARA[x % ALFABET_SEMENTARA.length]).join("");
}

/**
 * Admin mengatur ulang sandi akun lain (menggantikan "lupa sandi" tanpa verifikasi).
 * Mengembalikan sandi sementara yang hanya ditampilkan sekali; pemilik akun wajib menggantinya.
 */
export async function aturUlangSandiOlehAdmin(
  adminSesi: AkunSesi | null,
  emailTarget: string
): Promise<{ sukses: boolean; pesan: string; sandiSementara?: string }> {
  const akunAdmin = muatSemuaAkun().find((a) => a.email.toLowerCase() === (adminSesi?.email ?? "").toLowerCase());
  if (!adminSesi || !akunAdmin || akunAdmin.peran !== "admin" || akunAdmin.idKader !== adminSesi.idKader) {
    return { sukses: false, pesan: "Hanya administrator yang dapat mengatur ulang kata sandi." };
  }
  const accounts = muatSemuaAkun();
  const idx = accounts.findIndex((a) => a.email.toLowerCase() === emailTarget.trim().toLowerCase());
  if (idx === -1) return { sukses: false, pesan: "Akun tidak ditemukan." };
  if (accounts[idx].email.toLowerCase() === akunAdmin.email.toLowerCase()) {
    return { sukses: false, pesan: "Ganti kata sandi Anda sendiri lewat menu Kata sandi." };
  }
  const sandiSementara = buatSandiSementara();
  accounts[idx] = { ...accounts[idx], ...(await buatHashSandi(sandiSementara)), wajibGantiSandi: true };
  delete accounts[idx].password;
  simpanSemuaAkun(accounts);
  hapusGagal(emailTarget);
  return { sukses: true, pesan: `Sandi sementara untuk ${accounts[idx].nama} dibuat.`, sandiSementara };
}

/* ---------- Migrasi dan akun uji ---------- */

/** Ringkasan SHA-256 sandi bawaan lama; hanya untuk mengenali akun bawaan tanpa menyimpan sandinya di kode */
const DIGEST_SANDI_BAWAAN = new Set([
  "301d393f0dd2009a21bda0352166d522a46fd9a2e9597ec2fa3d05cb3836610b",
  "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
]);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/**
 * Mengubah akun format lama (sandi teks polos) menjadi hash, menghapus sandi dari sesi,
 * dan mewajibkan penggantian untuk akun yang masih memakai sandi bawaan lama.
 */
export async function migrasiAkunLama(): Promise<void> {
  const accounts = muatSemuaAkun();
  let berubah = false;
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    if (typeof a.password === "string" && a.password.length > 0) {
      const bawaan = DIGEST_SANDI_BAWAAN.has(hex(sha256(enc.encode(a.password))));
      accounts[i] = { ...a, ...(await buatHashSandi(a.password)), wajibGantiSandi: bawaan || a.wajibGantiSandi };
      delete accounts[i].password;
      berubah = true;
    } else if (a.password !== undefined) {
      delete accounts[i].password;
      berubah = true;
    }
  }
  if (berubah) simpanSemuaAkun(accounts);
  // Sesi lama menyimpan seluruh akun termasuk sandi: tulis ulang tanpa rahasia (atau hapus bila tidak sah)
  muatSesiPengguna();
  try {
    const raw = localStorage.getItem(KEY_SESSION);
    if (raw && /"password"|"kataSandiHash"/.test(raw)) {
      const sesi = muatSesiPengguna();
      if (sesi) localStorage.setItem(KEY_SESSION, JSON.stringify(sesi));
      else localStorage.removeItem(KEY_SESSION);
    }
  } catch {
    // abaikan
  }
}

/** Akun uji (kader dan admin) untuk pengembangan; tidak ada di build produksi */
export async function siapkanAkunUji(): Promise<void> {
  if (!AKUN_UJI_AKTIF) return;
  const uji = [
    { idKader: "KDR-001", nama: "Budi Santoso", email: "kader@geokader.id", kataSandi: "kader123", peran: "kader" as const, desaWilayah: "Desa Rimba Hijau", noHp: "081234567890", kelompokMasyarakat: "Kelompok Tani Hutan Harapan" },
    { idKader: "ADM-001", nama: "Siti Rahma", email: "admin@geokader.id", kataSandi: "admin123", peran: "admin" as const, desaWilayah: "Kantor Balai Spasial", noHp: "081987654321", kelompokMasyarakat: "Tim Verifikasi & Data Spasial" }
  ];
  const accounts = muatSemuaAkun();
  let berubah = false;
  for (const u of uji) {
    if (accounts.some((a) => a.email.toLowerCase() === u.email)) continue;
    const { kataSandi, ...profil } = u;
    accounts.push({
      ...profil,
      namaOrganisasi: NAMA_ORGANISASI_BAWAAN,
      createdAt: "2026-01-01T00:00:00.000Z",
      ...(await buatHashSandi(kataSandi, 1000)) // iterasi rendah: hanya untuk uji
    });
    berubah = true;
  }
  if (berubah) simpanSemuaAkun(accounts);
}

/** Dipanggil sekali sebelum aplikasi dirender */
export async function siapkanAutentikasi(): Promise<void> {
  await migrasiAkunLama();
  await siapkanAkunUji();
}
