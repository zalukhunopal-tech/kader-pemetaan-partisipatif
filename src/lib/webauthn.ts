import { sha256 } from "@noble/hashes/sha2.js";

/**
 * SIDIK JARI / PENGENALAN WAJAH lewat WebAuthn dengan autentikator bawaan perangkat (sensor sidik
 * jari Android, Face ID/Touch ID, Windows Hello). Data biometrik tidak pernah keluar dari perangkat:
 * yang disimpan aplikasi hanya kunci publik, dan setiap pembukaan diverifikasi dengan memeriksa
 * tanda tangan atas tantangan acak baru. Fungsi di sini murni (tanpa penyimpanan) agar mudah diuji.
 */

export const ALG_ES256 = -7;
export const ALG_RS256 = -257;

const enc = new TextEncoder();

export function keBase64Url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function dariBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const isi = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(isi), (c) => c.charCodeAt(0));
}

/** Salinan ke ArrayBuffer baru (WebCrypto menolak tampilan dari realm/penyangga lain di beberapa browser) */
const keBuffer = (b: Uint8Array): ArrayBuffer => {
  const salinan = new Uint8Array(b.length);
  salinan.set(b);
  return salinan.buffer;
};

/** Tanda tangan ECDSA format DER (dari autentikator) menjadi r||s mentah (format WebCrypto) */
export function derKeMentah(der: Uint8Array, panjang = 32): Uint8Array | null {
  let i = 0;
  if (der[i++] !== 0x30) return null;
  let total = der[i++];
  if (total & 0x80) {
    const n = total & 0x7f;
    total = 0;
    for (let k = 0; k < n; k++) total = (total << 8) | der[i++];
  }
  if (i + total !== der.length) return null;
  const bilangan = (): Uint8Array | null => {
    if (der[i++] !== 0x02) return null;
    const l = der[i++];
    let v = der.slice(i, i + l);
    i += l;
    while (v.length > panjang && v[0] === 0) v = v.slice(1);
    if (v.length > panjang || v.length === 0) return null;
    const hasil = new Uint8Array(panjang);
    hasil.set(v, panjang - v.length);
    return hasil;
  };
  const r = bilangan();
  const s = bilangan();
  if (!r || !s || i !== der.length) return null;
  const hasil = new Uint8Array(panjang * 2);
  hasil.set(r, 0);
  hasil.set(s, panjang);
  return hasil;
}

export interface DataAsersi {
  kunciPublikSpki: Uint8Array;
  alg: number;
  /** Tantangan acak yang dikirim ke autentikator untuk pembukaan ini */
  tantangan: Uint8Array;
  /** Origin halaman yang meminta (mis. https://geokader.contoh.id) */
  asal: string;
  /** ID pihak penyandar = nama host halaman */
  rpId: string;
  dataKlienJson: Uint8Array;
  dataAutentikator: Uint8Array;
  tandaTangan: Uint8Array;
}

/**
 * Memeriksa jawaban autentikator: jenis dan tantangan cocok, origin dan host benar, pengguna
 * terverifikasi (UV: sidik jari/wajah/PIN perangkat, bukan sekadar sentuhan), dan tanda tangan sah.
 */
export async function verifikasiAsersi(d: DataAsersi): Promise<boolean> {
  try {
    const klien = JSON.parse(new TextDecoder().decode(d.dataKlienJson)) as { type?: string; challenge?: string; origin?: string };
    if (klien.type !== "webauthn.get") return false;
    if (klien.challenge !== keBase64Url(d.tantangan)) return false;
    if (klien.origin !== d.asal) return false;
    const ad = d.dataAutentikator;
    if (ad.length < 37) return false;
    const hashRp = sha256(enc.encode(d.rpId));
    for (let i = 0; i < 32; i++) if (ad[i] !== hashRp[i]) return false;
    const bendera = ad[32];
    if ((bendera & 0x01) === 0 || (bendera & 0x04) === 0) return false; // UP dan UV wajib
    const pesan = new Uint8Array(ad.length + 32);
    pesan.set(ad, 0);
    pesan.set(sha256(d.dataKlienJson), ad.length);
    const sub = globalThis.crypto?.subtle;
    if (!sub) return false;
    if (d.alg === ALG_ES256) {
      const mentah = derKeMentah(d.tandaTangan);
      if (!mentah) return false;
      const kunci = await sub.importKey("spki", keBuffer(d.kunciPublikSpki), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      return await sub.verify({ name: "ECDSA", hash: "SHA-256" }, kunci, keBuffer(mentah), keBuffer(pesan));
    }
    if (d.alg === ALG_RS256) {
      const kunci = await sub.importKey("spki", keBuffer(d.kunciPublikSpki), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
        "verify"
      ]);
      return await sub.verify("RSASSA-PKCS1-v1_5", kunci, keBuffer(d.tandaTangan), keBuffer(pesan));
    }
    return false;
  } catch {
    return false;
  }
}

/** Perangkat punya autentikator bawaan yang memverifikasi pengguna (sidik jari, wajah, atau kunci layar) */
export async function biometrikDidukung(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.isSecureContext || typeof PublicKeyCredential === "undefined") return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
