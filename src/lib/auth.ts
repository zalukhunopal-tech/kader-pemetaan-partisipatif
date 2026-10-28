import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { PeranPengguna } from "../types";
import {
  buatKodePemulihan,
  buatRahasiaTotp,
  hashKodePemulihan,
  miripKodePemulihan,
  periksaTotp,
  uriOtpauth
} from "./totp";
import { bukaGerbangAdmin, gerbangAdminTerbuka, kunciGerbangAdmin } from "./gerbangAdmin";
import { aplikasiTerbuka, bukaAplikasi, kunciAplikasi } from "./kunciAplikasi";

/**
 * AUTENTIKASI SISI KLIEN
 * Akun tersimpan di perangkat ini saja (belum ada server). Kata sandi disimpan sebagai hash
 * PBKDF2-SHA256 dengan garam acak per akun dan tidak pernah ditulis ke sesi. Ini mengeraskan
 * penyimpanan lokal, tetapi bukan pengganti server: siapa pun yang bisa membuka dan mengubah
 * penyimpanan browser di perangkat tetap dapat melewatinya.
 *
 * Tidak ada pendaftaran mandiri: akun dibuat oleh admin (sandi sementara yang wajib diganti), kecuali
 * Administrator pertama di perangkat baru. Setiap akun wajib memakai Google Authenticator (TOTP) di
 * samping sandi. Rahasia TOTP tersimpan di perangkat yang sama dengan akunnya, jadi lapisan ini
 * menahan orang yang hanya tahu sandi, bukan orang yang dapat membaca penyimpanan perangkat.
 *
 * Kode Authenticator berlaku 8 jam per sesi di perangkat ini (MASA_BERLAKU_TOTP_MS). Selama itu,
 * aplikasi yang terkunci (dibuka ulang atau diam 15 menit) dibuka dengan PIN atau sidik jari/wajah
 * (kunciCepat.ts); setelah 8 jam, kode Authenticator diminta lagi.
 */

/** Sidik jari / pengenalan wajah lewat WebAuthn (autentikator bawaan perangkat); hanya kunci publik yang disimpan */
export interface DataBiometrik {
  /** ID kredensial (base64url) */
  idKredensial: string;
  /** Kunci publik SPKI (base64) */
  kunciPublik: string;
  /** Algoritme COSE: -7 (ES256) atau -257 (RS256) */
  alg: number;
  dibuat: string;
}

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
  /** Rahasia TOTP (base32). Kosong = Authenticator belum didaftarkan, dan akun belum bisa masuk */
  totpRahasia?: string;
  /** Langkah waktu TOTP terakhir yang terpakai, supaya kode yang sama tidak bisa dipakai dua kali */
  totpLangkahTerakhir?: number;
  /** Hash kode pemulihan sekali pakai yang belum terpakai */
  kodePemulihanHash?: string[];
  /** PIN buka cepat di perangkat ini (hash PBKDF2 dengan garam tersendiri, tidak pernah teks polos) */
  pinHash?: string;
  pinGaram?: string;
  pinIterasi?: number;
  /** PIN salah berturut-turut; PIN dinonaktifkan setelah batasnya */
  pinGagal?: number;
  biometrik?: DataBiometrik;
  /** Sisa format lama (teks polos); dihapus oleh migrasiAkunLama */
  password?: string;
}

/** Data akun yang aman dibawa di sesi dan state aplikasi (tanpa hash atau sandi) */
export type AkunSesi = Omit<
  AkunPengguna,
  | "kataSandiHash"
  | "garam"
  | "iterasi"
  | "password"
  | "wajibGantiSandi"
  | "totpRahasia"
  | "totpLangkahTerakhir"
  | "kodePemulihanHash"
  | "pinHash"
  | "pinGaram"
  | "pinIterasi"
  | "pinGagal"
  | "biometrik"
>;

/** Data kunci cepat (PIN dan biometrik) yang boleh diubah oleh kunciCepat.ts */
export type DataKunciCepat = Pick<AkunPengguna, "pinHash" | "pinGaram" | "pinIterasi" | "pinGagal" | "biometrik">;
export const TANPA_KUNCI_CEPAT: DataKunciCepat = {
  pinHash: undefined,
  pinGaram: undefined,
  pinIterasi: undefined,
  pinGagal: undefined,
  biometrik: undefined
};

const KEY_ACCOUNTS = "geokader_accounts_v5";
const KEY_SESSION = "geokader_current_session_v5";
const KEY_GAGAL = "geokader_login_gagal_v5";
const KEY_VERIFIKASI_TOTP = "geokader_verifikasi_totp_v1";

/** Lama kode Google Authenticator berlaku setelah diverifikasi di perangkat ini */
export const MASA_BERLAKU_TOTP_MS = 8 * 60 * 60 * 1000;

export const ITERASI_PBKDF2 = 200_000;
/** Hanya untuk tes: menurunkan jumlah iterasi agar tes cepat. Jangan diubah di aplikasi. */
export const konfigUji = { iterasi: ITERASI_PBKDF2 };
export const MIN_PANJANG_SANDI = 8;
export const NAMA_ORGANISASI_BAWAAN = "Sertifikat Kader Pemetaan Partisipatif";

/** Akun uji dinonaktifkan untuk aplikasi produksi/publikasi (hanya aktif di lingkungan pengujian unit vitest) */
export const AKUN_UJI_AKTIF: boolean = import.meta.env.MODE === "test";

/** Rahasia TOTP tetap untuk akun uji, supaya kartu cepat-masuk bisa menghitung kodenya sendiri. Hanya di build uji. */
export const RAHASIA_TOTP_UJI = "KRSXG5DSNFXGOIDUN5ZGK43FMQQHEZLB";

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
    if (!akun || akun.idKader !== sesi.idKader || akun.peran !== sesi.peran || akun.wajibGantiSandi || !akun.totpRahasia) {
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
    if (!akun) {
      // Keluar mengakhiri masa berlaku kode Authenticator: masuk berikutnya meminta kode lagi
      localStorage.removeItem(KEY_SESSION);
      localStorage.removeItem(KEY_VERIFIKASI_TOTP);
      kunciAplikasi();
    } else localStorage.setItem(KEY_SESSION, JSON.stringify(keSesi(akun)));
  } catch {
    // abaikan
  }
}

/* ---------- Masa berlaku kode Authenticator (8 jam) ---------- */

function catatVerifikasiTotp(email: string, sekarang = Date.now()): void {
  try {
    localStorage.setItem(KEY_VERIFIKASI_TOTP, JSON.stringify({ email: email.trim().toLowerCase(), pada: sekarang }));
  } catch {
    // tidak tersimpan: PIN/sidik jari tidak bisa dipakai, kode Authenticator diminta setiap kali terkunci
  }
}

/** Sisa masa berlaku verifikasi Authenticator (ms) untuk email ini; 0 bila habis atau belum ada */
export function sisaMasaTotp(email: string | undefined | null, sekarang = Date.now()): number {
  if (!email) return 0;
  try {
    const v = JSON.parse(localStorage.getItem(KEY_VERIFIKASI_TOTP) || "null") as { email?: string; pada?: number } | null;
    if (!v || v.email !== email.trim().toLowerCase() || typeof v.pada !== "number") return 0;
    const umur = sekarang - v.pada;
    // jam yang dimundurkan (umur negatif) dianggap habis
    return umur < 0 || umur >= MASA_BERLAKU_TOTP_MS ? 0 : MASA_BERLAKU_TOTP_MS - umur;
  } catch {
    return 0;
  }
}

/** Saat (ms) masa berlaku verifikasi Authenticator untuk email ini berakhir; null bila belum ada */
export function waktuHabisTotp(email: string | undefined | null): number | null {
  if (!email) return null;
  try {
    const v = JSON.parse(localStorage.getItem(KEY_VERIFIKASI_TOTP) || "null") as { email?: string; pada?: number } | null;
    if (!v || v.email !== email.trim().toLowerCase() || typeof v.pada !== "number") return null;
    return v.pada + MASA_BERLAKU_TOTP_MS;
  } catch {
    return null;
  }
}

/** Identitas baru saja dibuktikan dengan kode Authenticator: mulai masa 8 jam dan buka kunci aplikasi */
function tandaiTerverifikasi(email: string): void {
  catatVerifikasiTotp(email);
  bukaAplikasi(email);
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

/* ---------- Masuk, pembuatan akun, ganti dan atur ulang sandi ---------- */

export interface HasilAuth {
  sukses: boolean;
  pesan: string;
  akun?: AkunSesi;
  /** true bila sandi cocok tetapi harus diganti dulu (sandi bawaan atau sementara) */
  wajibGantiSandi?: boolean;
  /** true bila sandi cocok dan akun sudah memakai Authenticator: minta kode 6 digit atau kode pemulihan */
  perluKodeTotp?: boolean;
  /** true bila sandi cocok tetapi Authenticator belum didaftarkan: akun wajib mendaftarkannya dulu */
  perluDaftarTotp?: boolean;
  /** Sisa kode pemulihan setelah satu kode dipakai untuk masuk */
  sisaKodePemulihan?: number;
}

const PESAN_KODE_SALAH = "Kode salah atau sudah kedaluwarsa. Periksa jam HP Anda lalu coba kode terbaru.";

function simpanPerubahanAkun(email: string, perubahan: Partial<AkunPengguna>): void {
  const accounts = muatSemuaAkun();
  const idx = accounts.findIndex((a) => a.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return;
  accounts[idx] = { ...accounts[idx], ...perubahan };
  simpanSemuaAkun(accounts);
}

/** Memeriksa kode 6 digit TOTP atau satu kode pemulihan; mengembalikan perubahan akun bila cocok */
function periksaKodeMasuk(
  akun: AkunPengguna,
  kode: string
): { ok: boolean; perubahan?: Partial<AkunPengguna>; pemulihan?: boolean; sisa?: number } {
  if (miripKodePemulihan(kode)) {
    const h = hashKodePemulihan(kode, akun.garam);
    const daftar = akun.kodePemulihanHash ?? [];
    if (!daftar.includes(h)) return { ok: false };
    const sisa = daftar.filter((x) => x !== h);
    return { ok: true, perubahan: { kodePemulihanHash: sisa }, pemulihan: true, sisa: sisa.length };
  }
  const r = periksaTotp(akun.totpRahasia ?? "", kode, { langkahTerakhir: akun.totpLangkahTerakhir });
  return r.ok ? { ok: true, perubahan: { totpLangkahTerakhir: r.langkah } } : { ok: false };
}

/**
 * Masuk dalam dua langkah, dipanggil dua kali dengan sandi yang sama:
 * 1. tanpa `kode`: sandi diperiksa, lalu hasilnya meminta kode (perluKodeTotp) atau pendaftaran
 *    Authenticator (perluDaftarTotp). Belum ada sesi yang dibuat.
 * 2. dengan `kode`: sandi dan kode diperiksa, baru sesi dibuat.
 */
export async function autentikasiLogin(email: string, kataSandi: string, kode = ""): Promise<HasilAuth> {
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
  if (akun.wajibGantiSandi) {
    return { sukses: false, wajibGantiSandi: true, pesan: "Kata sandi ini harus diganti sebelum Anda masuk." };
  }
  if (!akun.totpRahasia) {
    return {
      sukses: false,
      perluDaftarTotp: true,
      pesan: "Akun ini wajib memakai Google Authenticator. Daftarkan sekarang untuk melanjutkan."
    };
  }
  if (!kode.trim()) {
    return { sukses: false, perluKodeTotp: true, pesan: "Masukkan kode 6 digit dari Google Authenticator." };
  }
  const hasil = periksaKodeMasuk(akun, kode);
  if (!hasil.ok) {
    catatGagal(emailBersih);
    return { sukses: false, perluKodeTotp: true, pesan: PESAN_KODE_SALAH };
  }
  hapusGagal(emailBersih);
  if (hasil.perubahan) simpanPerubahanAkun(emailBersih, hasil.perubahan);
  const sesi = keSesi(akun);
  simpanSesiPengguna(sesi);
  tandaiTerverifikasi(akun.email);
  // Kewenangan admin hanya dari verifikasi kode barusan, tidak dari sesi yang tersimpan
  if (akun.peran === "admin") bukaGerbangAdmin(akun.email);
  else kunciGerbangAdmin();
  return {
    sukses: true,
    pesan: hasil.pemulihan
      ? `Selamat datang, ${akun.nama}! Kode pemulihan dipakai; sisa ${hasil.sisa}.`
      : `Selamat datang, ${akun.nama}!`,
    akun: sesi,
    sisaKodePemulihan: hasil.pemulihan ? hasil.sisa : undefined
  };
}

interface DataAkunBaru {
  nama: string;
  email: string;
  desaWilayah: string;
  noHp: string;
  kelompokMasyarakat?: string;
}
interface DataDaftar extends DataAkunBaru {
  kataSandi: string;
}

const EMAIL_SAH = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Membuat akun tanpa sesi dan tanpa Authenticator; sandi baru ditulis sebagai hash */
async function buatAkun(
  data: DataAkunBaru,
  kataSandi: string,
  peran: PeranPengguna,
  opsi: { wajibGantiSandi?: boolean } = {}
): Promise<{ sukses: boolean; pesan: string; akun?: AkunPengguna }> {
  const emailBersih = data.email.trim().toLowerCase();
  if (!data.nama.trim()) return { sukses: false, pesan: "Nama lengkap wajib diisi." };
  if (!EMAIL_SAH.test(emailBersih)) return { sukses: false, pesan: "Alamat email tidak valid." };
  const accounts = muatSemuaAkun();
  if (accounts.some((a) => a.email.toLowerCase() === emailBersih)) {
    return { sukses: false, pesan: "Email sudah terdaftar." };
  }
  if (!opsi.wajibGantiSandi) {
    const galat = validasiKataSandi(kataSandi, { nama: data.nama, email: emailBersih });
    if (galat) return { sukses: false, pesan: galat };
  }

  // ID kader menjadi kunci kepemilikan data, jadi harus unik di antara akun yang ada
  const awalan = peran === "admin" ? "ADM" : "KDR";
  const idBaru = () => `${awalan}-${acak(6).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`;
  let idKader = idBaru();
  while (accounts.some((a) => a.idKader === idKader)) idKader = idBaru();

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
    ...(await buatHashSandi(kataSandi)),
    ...(opsi.wajibGantiSandi ? { wajibGantiSandi: true } : {})
  };
  accounts.push(akunBaru);
  simpanSemuaAkun(accounts);
  return { sukses: true, pesan: "Akun dibuat.", akun: akunBaru };
}

/**
 * Administrator pertama di perangkat baru. Hanya diizinkan selama belum ada admin, dan bila
 * VITE_KODE_ADMIN diisi, kode aktivasi harus cocok (pencegah salah pakai, bukan rahasia:
 * nilainya ikut di aplikasi). Akun belum bisa masuk sebelum mendaftarkan Authenticator.
 */
export async function buatAdminPertama(data: DataDaftar, kodeAktivasi = ""): Promise<HasilAuth> {
  if (adaAdmin()) {
    return { sukses: false, pesan: "Perangkat ini sudah memiliki Administrator. Minta admin untuk membuatkan akun." };
  }
  const kodeWajib = (import.meta.env.VITE_KODE_ADMIN ?? "").trim();
  if (kodeWajib && kodeAktivasi.trim() !== kodeWajib) {
    return { sukses: false, pesan: "Kode aktivasi administrator tidak cocok." };
  }
  const { sukses, pesan } = await buatAkun(data, data.kataSandi, "admin");
  return { sukses, pesan: sukses ? "Administrator dibuat. Lanjutkan dengan mendaftarkan Google Authenticator." : pesan, perluDaftarTotp: sukses };
}

/**
 * Pemeriksaan dua lapis untuk setiap aksi admin:
 * 1. sesi harus cocok dengan akun admin yang masih ada di data akun (peran dan ID sama), dan
 * 2. gerbang admin di memori harus terbuka (identitas diverifikasi di halaman ini dan belum diam terlalu lama),
 *    aplikasi tidak sedang terkunci, dan kode Authenticator terakhir masih dalam masa berlaku 8 jam.
 */
function adminSah(adminSesi: AkunSesi | null): AkunPengguna | null {
  const akunAdmin = muatSemuaAkun().find((a) => a.email.toLowerCase() === (adminSesi?.email ?? "").toLowerCase());
  if (!adminSesi || !akunAdmin || akunAdmin.peran !== "admin" || akunAdmin.idKader !== adminSesi.idKader) return null;
  if (!akunAdmin.totpRahasia || !gerbangAdminTerbuka(akunAdmin.email)) return null;
  if (!aplikasiTerbuka(akunAdmin.email) || sisaMasaTotp(akunAdmin.email) <= 0) return null;
  return akunAdmin;
}

/** Untuk lapisan aplikasi: sesi admin yang sah menurut data akun TERKINI dan gerbang admin yang terbuka */
export function aksesAdminSah(adminSesi: AkunSesi | null): boolean {
  if (!adminSesi) return false;
  const terkini = muatSesiPengguna(); // dibaca ulang dari penyimpanan, bukan dari state aplikasi
  if (!terkini || terkini.email.toLowerCase() !== adminSesi.email.toLowerCase() || terkini.idKader !== adminSesi.idKader) return false;
  return adminSah(terkini) !== null;
}

export interface OpsiVerifikasi {
  /** true: buka juga gerbang admin bila akunnya admin (layar kunci saat sedang di mode admin) */
  bukaAdmin?: boolean;
}

/**
 * Verifikasi ulang dengan kode Google Authenticator atau kode pemulihan untuk sesi yang sedang
 * berjalan: dipakai layar kunci setelah masa 8 jam habis, saat PIN terlupa/terblokir, atau untuk
 * membuka mode admin. Berhasil = masa berlaku 8 jam dimulai lagi dan aplikasi terbuka.
 */
export function verifikasiKodeAuthenticator(
  sesi: AkunSesi | null,
  kode: string,
  opsi: OpsiVerifikasi = {}
): { sukses: boolean; pesan: string } {
  const emailBersih = (sesi?.email ?? "").trim().toLowerCase();
  const tunggu = detikTertahan(emailBersih);
  if (tunggu > 0) return { sukses: false, pesan: `Terlalu banyak percobaan. Coba lagi dalam ${tunggu} detik.` };
  const akun = muatSemuaAkun().find((a) => a.email.toLowerCase() === emailBersih);
  if (!sesi || !akun || akun.idKader !== sesi.idKader || !akun.totpRahasia) {
    return { sukses: false, pesan: "Sesi tidak sah. Keluar lalu masuk kembali." };
  }
  if (!kode.trim()) return { sukses: false, pesan: "Masukkan kode dari Google Authenticator atau kode pemulihan." };
  const hasil = periksaKodeMasuk(akun, kode);
  if (!hasil.ok) {
    catatGagal(emailBersih);
    return { sukses: false, pesan: PESAN_KODE_SALAH };
  }
  hapusGagal(emailBersih);
  if (hasil.perubahan) simpanPerubahanAkun(emailBersih, hasil.perubahan);
  tandaiTerverifikasi(akun.email);
  if (opsi.bukaAdmin && akun.peran === "admin") bukaGerbangAdmin(akun.email);
  return {
    sukses: true,
    pesan: hasil.pemulihan
      ? `Terverifikasi dengan kode pemulihan; sisa ${hasil.sisa}.`
      : "Terverifikasi. Kode Authenticator berlaku 8 jam di perangkat ini."
  };
}

/**
 * Membuka kembali gerbang admin (setelah terkunci karena diam, muat ulang, atau Mode User) dengan kode
 * Google Authenticator atau kode pemulihan. Hanya untuk akun yang perannya admin di data akun.
 */
export function bukaGerbangAdminDenganKode(adminSesi: AkunSesi | null, kode: string): { sukses: boolean; pesan: string } {
  const emailBersih = (adminSesi?.email ?? "").trim().toLowerCase();
  const tunggu = detikTertahan(emailBersih);
  if (tunggu > 0) return { sukses: false, pesan: `Terlalu banyak percobaan. Coba lagi dalam ${tunggu} detik.` };
  const akun = muatSemuaAkun().find((a) => a.email.toLowerCase() === emailBersih);
  if (!adminSesi || !akun || akun.peran !== "admin" || akun.idKader !== adminSesi.idKader || !akun.totpRahasia) {
    return { sukses: false, pesan: "Akun ini tidak memiliki akses Administrator." };
  }
  const r = verifikasiKodeAuthenticator(adminSesi, kode, { bukaAdmin: true });
  if (!r.sukses) return r;
  return {
    sukses: true,
    pesan: r.pesan.startsWith("Terverifikasi dengan kode pemulihan")
      ? r.pesan.replace("Terverifikasi", "Mode admin dibuka")
      : "Mode admin dibuka."
  };
}

/** Untuk kunciCepat.ts: menyimpan perubahan PIN/biometrik pada akun di perangkat ini */
export function perbaruiKunciCepatAkun(email: string, perubahan: Partial<DataKunciCepat>): void {
  simpanPerubahanAkun(email, perubahan);
}

/**
 * Admin membuat akun user (kader) atau admin lain. Tidak ada pendaftaran mandiri.
 * Sandi sementara hanya ditampilkan sekali; pemilik akun wajib menggantinya dan mendaftarkan
 * Google Authenticator saat pertama masuk.
 */
export async function buatAkunOlehAdmin(
  adminSesi: AkunSesi | null,
  data: DataAkunBaru & { peran?: PeranPengguna }
): Promise<{ sukses: boolean; pesan: string; sandiSementara?: string; akun?: AkunSesi }> {
  if (!adminSah(adminSesi)) return { sukses: false, pesan: "Hanya administrator dengan mode admin terbuka yang dapat membuat akun." };
  const sandiSementara = buatSandiSementara();
  const r = await buatAkun(data, sandiSementara, data.peran === "admin" ? "admin" : "kader", { wajibGantiSandi: true });
  if (!r.sukses || !r.akun) return { sukses: false, pesan: r.pesan };
  return {
    sukses: true,
    pesan: `Akun untuk ${r.akun.nama} dibuat.`,
    sandiSementara,
    akun: keSesi(r.akun)
  };
}

/* ---------- Pendaftaran Google Authenticator ---------- */

async function periksaSandiUntukTotp(
  email: string,
  kataSandi: string
): Promise<{ akun?: AkunPengguna; galat?: string }> {
  const emailBersih = email.trim().toLowerCase();
  const tunggu = detikTertahan(emailBersih);
  if (tunggu > 0) return { galat: `Terlalu banyak percobaan. Coba lagi dalam ${tunggu} detik.` };
  const akun = muatSemuaAkun().find((a) => a.email.toLowerCase() === emailBersih);
  if (!akun || !(await cocokSandi(akun, kataSandi))) {
    catatGagal(emailBersih);
    return { galat: "Email atau kata sandi salah." };
  }
  if (akun.wajibGantiSandi) return { galat: "Ganti kata sandi sementara dulu sebelum mendaftarkan Authenticator." };
  if (akun.totpRahasia) return { galat: "Authenticator sudah terdaftar. Minta admin mengatur ulang bila ponsel hilang." };
  return { akun };
}

/** Langkah 1: buat rahasia baru dan tautan QR. Belum disimpan sampai kode pertama terbukti benar. */
export async function mulaiPendaftaranTotp(
  email: string,
  kataSandi: string
): Promise<{ sukses: boolean; pesan: string; rahasia?: string; uri?: string }> {
  const { akun, galat } = await periksaSandiUntukTotp(email, kataSandi);
  if (!akun) return { sukses: false, pesan: galat ?? "Gagal." };
  const rahasia = buatRahasiaTotp();
  return { sukses: true, pesan: "Pindai kode QR dengan Google Authenticator.", rahasia, uri: uriOtpauth(akun.email, rahasia) };
}

/**
 * Langkah 2: simpan rahasia setelah pengguna mengetik kode pertama dari aplikasinya, dan buat
 * kode pemulihan (ditampilkan sekali). Sesi belum dibuat: layar pemanggil menyimpannya setelah
 * kode pemulihan diakui telah disimpan.
 */
export async function selesaikanPendaftaranTotp(
  email: string,
  kataSandi: string,
  rahasia: string,
  kode: string
): Promise<HasilAuth & { kodePemulihan?: string[] }> {
  const { akun, galat } = await periksaSandiUntukTotp(email, kataSandi);
  if (!akun) return { sukses: false, pesan: galat ?? "Gagal." };
  const r = periksaTotp(rahasia, kode);
  if (!r.ok) {
    catatGagal(akun.email);
    return { sukses: false, pesan: PESAN_KODE_SALAH };
  }
  hapusGagal(akun.email);
  tandaiTerverifikasi(akun.email);
  if (akun.peran === "admin") bukaGerbangAdmin(akun.email);
  else kunciGerbangAdmin();
  const kodePemulihan = buatKodePemulihan();
  simpanPerubahanAkun(akun.email, {
    totpRahasia: rahasia,
    totpLangkahTerakhir: r.langkah,
    kodePemulihanHash: kodePemulihan.map((k) => hashKodePemulihan(k, akun.garam))
  });
  return { sukses: true, pesan: "Google Authenticator aktif.", akun: keSesi(akun), kodePemulihan };
}

/**
 * Admin menghapus Authenticator akun lain (ponsel hilang). Pemilik akun mendaftarkan yang baru saat
 * masuk berikutnya, setelah memasukkan sandinya. Tidak berlaku untuk akun admin itu sendiri.
 */
export function aturUlangAuthenticatorOlehAdmin(
  adminSesi: AkunSesi | null,
  emailTarget: string
): { sukses: boolean; pesan: string } {
  const akunAdmin = adminSah(adminSesi);
  if (!akunAdmin) return { sukses: false, pesan: "Hanya administrator yang dapat mengatur ulang Authenticator." };
  const target = muatSemuaAkun().find((a) => a.email.toLowerCase() === emailTarget.trim().toLowerCase());
  if (!target) return { sukses: false, pesan: "Akun tidak ditemukan." };
  if (target.email.toLowerCase() === akunAdmin.email.toLowerCase()) {
    return { sukses: false, pesan: "Authenticator Anda sendiri hanya bisa diatur ulang oleh admin lain." };
  }
  // PIN dan sidik jari ikut dihapus: pemilik membuat yang baru setelah memasang Authenticator lagi
  simpanPerubahanAkun(target.email, {
    totpRahasia: undefined,
    totpLangkahTerakhir: undefined,
    kodePemulihanHash: undefined,
    ...TANPA_KUNCI_CEPAT
  });
  hapusGagal(target.email);
  return { sukses: true, pesan: `Authenticator ${target.nama} dihapus. Ia mendaftarkan yang baru saat masuk berikutnya.` };
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
  const akunAdmin = adminSah(adminSesi);
  if (!akunAdmin) return { sukses: false, pesan: "Hanya administrator yang dapat mengatur ulang kata sandi." };
  const accounts = muatSemuaAkun();
  const idx = accounts.findIndex((a) => a.email.toLowerCase() === emailTarget.trim().toLowerCase());
  if (idx === -1) return { sukses: false, pesan: "Akun tidak ditemukan." };
  if (accounts[idx].email.toLowerCase() === akunAdmin.email.toLowerCase()) {
    return { sukses: false, pesan: "Ganti kata sandi Anda sendiri lewat menu Kata sandi." };
  }
  const sandiSementara = buatSandiSementara();
  accounts[idx] = { ...accounts[idx], ...(await buatHashSandi(sandiSementara)), ...TANPA_KUNCI_CEPAT, wajibGantiSandi: true };
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
      ...(await buatHashSandi(kataSandi, 1000)), // iterasi rendah: hanya untuk uji
      totpRahasia: RAHASIA_TOTP_UJI,
      kodePemulihanHash: []
    });
    berubah = true;
  }
  if (berubah) simpanSemuaAkun(accounts);
}

/** Hanya build uji: mengizinkan akun uji masuk berulang dalam satu langkah 30 detik (kode uji dihitung otomatis) */
export function setelUlangLangkahUji(email: string): void {
  if (!AKUN_UJI_AKTIF) return;
  simpanPerubahanAkun(email, { totpLangkahTerakhir: undefined });
}

/** Dipanggil sekali sebelum aplikasi dirender */
export async function siapkanAutentikasi(): Promise<void> {
  await migrasiAkunLama();
  // Pembersihan akun dummy bawaan uji dari penyimpanan lokal untuk kesiapan publikasi
  try {
    const accounts = muatSemuaAkun();
    const akunBersih = accounts.filter(
      (a) =>
        !(
          (a.email.toLowerCase() === "kader@geokader.id" && a.idKader === "KDR-001") ||
          (a.email.toLowerCase() === "admin@geokader.id" && (a.idKader === "ADM-001" || a.totpRahasia === RAHASIA_TOTP_UJI))
        )
    );
    if (akunBersih.length !== accounts.length) {
      simpanSemuaAkun(akunBersih);
      const sesi = muatSesiPengguna();
      if (sesi && (sesi.email.toLowerCase() === "kader@geokader.id" || sesi.email.toLowerCase() === "admin@geokader.id")) {
        localStorage.removeItem(KEY_SESSION);
      }
    }
  } catch {
    // abaikan jika gagal
  }
}
