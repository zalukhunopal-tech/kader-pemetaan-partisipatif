import { hmac } from "@noble/hashes/hmac.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";

/**
 * KODE SEKALI PAKAI (TOTP, RFC 6238) untuk Google Authenticator dan aplikasi sejenis.
 * Memakai HMAC-SHA1, 6 digit, langkah 30 detik: satu-satunya kombinasi yang didukung semua aplikasi.
 * HMAC-SHA1 aman untuk dipakai di sini karena kode hanya berlaku 30 detik dan tidak bergantung
 * pada ketahanan SHA-1 terhadap tabrakan.
 */

export const PERIODE_TOTP_DETIK = 30;
export const DIGIT_TOTP = 6;
export const NAMA_PENERBIT_TOTP = "GeoKader";
const ALFABET_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/** Tanpa 0/O/1/I agar mudah dibaca dan diketik */
const ALFABET_PEMULIHAN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function acak(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/* ---------- Base32 (RFC 4648, tanpa padding) ---------- */

export function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let nilai = 0;
  let hasil = "";
  for (const byte of data) {
    nilai = (nilai << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      hasil += ALFABET_BASE32[(nilai >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) hasil += ALFABET_BASE32[(nilai << (5 - bits)) & 31];
  return hasil;
}

/** Mengembalikan null bila ada karakter di luar alfabet base32 (spasi, tanda hubung, dan padding diabaikan) */
export function base32Decode(teks: string): Uint8Array | null {
  const bersih = teks.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (!bersih) return null;
  let bits = 0;
  let nilai = 0;
  const keluar: number[] = [];
  for (const c of bersih) {
    const i = ALFABET_BASE32.indexOf(c);
    if (i < 0) return null;
    nilai = (nilai << 5) | i;
    bits += 5;
    if (bits >= 8) {
      keluar.push((nilai >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(keluar);
}

/* ---------- HOTP / TOTP ---------- */

function hotp(rahasia: Uint8Array, penghitung: number, digit = DIGIT_TOTP): string {
  const pesan = new Uint8Array(8);
  // penghitung 64-bit big-endian; langkah waktu cukup kecil untuk dipecah dua bagian 32-bit
  const tinggi = Math.floor(penghitung / 2 ** 32);
  const rendah = penghitung >>> 0;
  new DataView(pesan.buffer).setUint32(0, tinggi);
  new DataView(pesan.buffer).setUint32(4, rendah);
  const h = hmac(sha1, rahasia, pesan);
  const o = h[h.length - 1] & 15;
  const biner = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(biner % 10 ** digit).padStart(digit, "0");
}

/** Nomor langkah 30 detik sejak 1 Jan 1970 */
export const langkahWaktu = (sekarangMs: number = Date.now()): number => Math.floor(sekarangMs / 1000 / PERIODE_TOTP_DETIK);

/** Kode TOTP untuk rahasia (base32) pada waktu tertentu; null bila rahasia tidak sah */
export function hitungTotp(rahasiaBase32: string, sekarangMs: number = Date.now()): string | null {
  const rahasia = base32Decode(rahasiaBase32);
  if (!rahasia || rahasia.length === 0) return null;
  return hotp(rahasia, langkahWaktu(sekarangMs));
}

export interface HasilPeriksaTotp {
  ok: boolean;
  /** Langkah waktu yang cocok; simpan agar kode yang sama tidak bisa dipakai dua kali */
  langkah?: number;
}

/**
 * Memeriksa kode 6 digit. Menerima langkah sebelum dan sesudah (jendela ±1 = ±30 detik) untuk
 * selisih jam perangkat, tetapi menolak langkah yang sama atau lebih lama dari `langkahTerakhir`
 * (kode yang sudah dipakai tidak boleh dipakai ulang).
 */
export function periksaTotp(
  rahasiaBase32: string,
  kode: string,
  opsi: { sekarangMs?: number; jendela?: number; langkahTerakhir?: number } = {}
): HasilPeriksaTotp {
  const bersih = kode.replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${DIGIT_TOTP}}$`).test(bersih)) return { ok: false };
  const rahasia = base32Decode(rahasiaBase32);
  if (!rahasia || rahasia.length === 0) return { ok: false };
  const sekarang = langkahWaktu(opsi.sekarangMs);
  const jendela = opsi.jendela ?? 1;
  const terakhir = opsi.langkahTerakhir ?? -1;
  let cocok: number | undefined;
  for (let d = -jendela; d <= jendela; d++) {
    const langkah = sekarang + d;
    if (langkah <= terakhir) continue;
    // seluruh jendela selalu dihitung agar waktu respons tidak membocorkan langkah mana yang cocok
    if (hotp(rahasia, langkah) === bersih && cocok === undefined) cocok = langkah;
  }
  return cocok === undefined ? { ok: false } : { ok: true, langkah: cocok };
}

export function buatRahasiaTotp(): string {
  return base32Encode(acak(20)); // 160 bit, panjang yang dianjurkan RFC 4226
}

/** Tautan otpauth:// yang dibaca oleh QR di Google Authenticator */
export function uriOtpauth(email: string, rahasiaBase32: string): string {
  const label = encodeURIComponent(`${NAMA_PENERBIT_TOTP}:${email}`);
  const params = new URLSearchParams({
    secret: rahasiaBase32,
    issuer: NAMA_PENERBIT_TOTP,
    algorithm: "SHA1",
    digits: String(DIGIT_TOTP),
    period: String(PERIODE_TOTP_DETIK)
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Rahasia dalam kelompok 4 huruf agar mudah diketik manual */
export const rahasiaUntukTampil = (rahasiaBase32: string): string => rahasiaBase32.replace(/(.{4})/g, "$1 ").trim();

/* ---------- Kode pemulihan ---------- */

export const JUMLAH_KODE_PEMULIHAN = 8;

/** Bentuk XXXXX-XXXXX (10 karakter dari 32 huruf/angka = 50 bit) */
export function buatKodePemulihan(jumlah = JUMLAH_KODE_PEMULIHAN): string[] {
  return Array.from({ length: jumlah }, () => {
    const b = acak(10);
    const k = Array.from(b, (x) => ALFABET_PEMULIHAN[x % ALFABET_PEMULIHAN.length]).join("");
    return `${k.slice(0, 5)}-${k.slice(5)}`;
  });
}

export const normalisasiKodePemulihan = (kode: string): string => kode.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Bentuk yang mungkin kode pemulihan (bukan 6 digit saja) */
export const miripKodePemulihan = (kode: string): boolean => normalisasiKodePemulihan(kode).length === 10;

const enc = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** Hash kode pemulihan dengan garam akun; kode berentropi tinggi dan acak sehingga SHA-256 berlapis garam cukup */
export function hashKodePemulihan(kode: string, garamAkun: string): string {
  return hex(sha256(enc.encode(`${garamAkun}|${normalisasiKodePemulihan(kode)}`)));
}
