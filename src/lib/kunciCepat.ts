import { AkunPengguna, AkunSesi, konfigUji, muatSemuaAkun, perbaruiKunciCepatAkun, sisaMasaTotp, turunkanKunci } from "./auth";
import { aplikasiTerbuka, bukaAplikasi } from "./kunciAplikasi";
import { bukaGerbangAdmin } from "./gerbangAdmin";
import { ALG_ES256, ALG_RS256, bacaSignCount, dariBase64Url, keBase64Url, verifikasiAsersi } from "./webauthn";

/**
 * KUNCI CEPAT: PIN atau sidik jari / pengenalan wajah untuk membuka aplikasi yang terkunci.
 * Hanya berlaku selama kode Google Authenticator terakhir masih dalam masa 8 jam; setelah itu
 * (atau setelah PIN salah 5 kali) kode Authenticator wajib dimasukkan lagi.
 *
 * Tujuan pembukaan:
 * - "aplikasi": membuka aplikasi saja;
 * - "aplikasi+admin": membuka aplikasi dan, bila akunnya admin, juga mode admin;
 * - "admin": khusus akun admin (layar Mode Admin terkunci).
 */

export const PANJANG_PIN = 6;
export const BATAS_SALAH_PIN = 5;

export type TujuanBuka = "aplikasi" | "aplikasi+admin" | "admin";

export interface HasilKunci {
  sukses: boolean;
  pesan: string;
  /** true bila jalan selanjutnya adalah kode Google Authenticator (masa 8 jam habis atau PIN diblokir) */
  perluAuthenticator?: boolean;
}

const PESAN_MASA_HABIS = "Kode Google Authenticator sudah lebih dari 8 jam. Masukkan kode terbaru untuk melanjutkan.";

const keBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const dariBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function acak(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

function samaWaktuTetap(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let selisih = 0;
  for (let i = 0; i < a.length; i++) selisih |= a[i] ^ b[i];
  return selisih === 0;
}

/** Akun pemilik sesi menurut data akun terkini (peran/ID sesi dipalsukan = tidak ada) */
function akunSesi(sesi: AkunSesi | null): AkunPengguna | null {
  if (!sesi) return null;
  const akun = muatSemuaAkun().find((a) => a.email.toLowerCase() === sesi.email.trim().toLowerCase());
  return akun && akun.idKader === sesi.idKader && akun.totpRahasia && !akun.wajibGantiSandi ? akun : null;
}

export function metodeKunciCepat(email: string | undefined | null): { pin: boolean; biometrik: boolean } {
  const akun = muatSemuaAkun().find((a) => a.email.toLowerCase() === (email ?? "").trim().toLowerCase());
  return { pin: !!akun?.pinHash, biometrik: !!akun?.biometrik };
}

/** Aturan PIN: tepat 6 angka, bukan angka sama semua, bukan urutan, bukan pola yang sangat umum */
export function validasiPin(pin: string): string | null {
  if (!new RegExp(`^\\d{${PANJANG_PIN}}$`).test(pin)) return `PIN harus ${PANJANG_PIN} angka.`;
  if (/^(\d)\1+$/.test(pin)) return "PIN tidak boleh angka yang sama semua.";
  const naik = "0123456789012345"; // termasuk urutan yang melingkar, mis. 890123
  const turun = "9876543210987654";
  if (naik.includes(pin) || turun.includes(pin)) return "PIN tidak boleh angka berurutan.";
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return "PIN terlalu mudah ditebak (pola berulang).";
  if (/^(\d)\1(\d)\2(\d)\3$/.test(pin)) return "PIN terlalu mudah ditebak (pola berulang).";
  return null;
}

/** Perubahan PIN/biometrik hanya saat aplikasi terbuka dan Authenticator masih berlaku */
function bolehMengubah(sesi: AkunSesi | null): AkunPengguna | null {
  const akun = akunSesi(sesi);
  if (!akun || !aplikasiTerbuka(akun.email) || sisaMasaTotp(akun.email) <= 0) return null;
  return akun;
}

export async function aturPin(sesi: AkunSesi | null, pinBaru: string): Promise<HasilKunci> {
  const akun = bolehMengubah(sesi);
  if (!akun) return { sukses: false, pesan: "Buka aplikasi dan verifikasi Authenticator dulu.", perluAuthenticator: true };
  const galat = validasiPin(pinBaru);
  if (galat) return { sukses: false, pesan: galat };
  const garam = acak(16);
  const iterasi = konfigUji.iterasi;
  const hash = await turunkanKunci(pinBaru, garam, iterasi);
  perbaruiKunciCepatAkun(akun.email, { pinHash: keBase64(hash), pinGaram: keBase64(garam), pinIterasi: iterasi, pinGagal: 0 });
  return { sukses: true, pesan: "PIN disimpan." };
}

/** Akun boleh dibuka untuk tujuan ini? (mode admin hanya untuk akun yang perannya admin) */
function cekTujuan(akun: AkunPengguna, tujuan: TujuanBuka): string | null {
  if (tujuan === "admin" && akun.peran !== "admin") return "Akun ini tidak memiliki akses Administrator.";
  return null;
}

function bukaSesuaiTujuan(akun: AkunPengguna, tujuan: TujuanBuka): void {
  bukaAplikasi(akun.email);
  if (tujuan !== "aplikasi" && akun.peran === "admin") bukaGerbangAdmin(akun.email);
}

export async function bukaDenganPin(sesi: AkunSesi | null, pin: string, tujuan: TujuanBuka = "aplikasi"): Promise<HasilKunci> {
  const akun = akunSesi(sesi);
  if (!akun) return { sukses: false, pesan: "Sesi tidak sah. Keluar lalu masuk kembali." };
  const galatTujuan = cekTujuan(akun, tujuan);
  if (galatTujuan) return { sukses: false, pesan: galatTujuan };
  if (sisaMasaTotp(akun.email) <= 0) return { sukses: false, pesan: PESAN_MASA_HABIS, perluAuthenticator: true };
  if (!akun.pinHash || !akun.pinGaram) {
    return { sukses: false, pesan: "PIN belum dibuat. Masukkan kode Google Authenticator.", perluAuthenticator: true };
  }
  const hash = await turunkanKunci(pin, dariBase64(akun.pinGaram), akun.pinIterasi || konfigUji.iterasi);
  if (!samaWaktuTetap(hash, dariBase64(akun.pinHash))) {
    const gagal = (akun.pinGagal ?? 0) + 1;
    if (gagal >= BATAS_SALAH_PIN) {
      // PIN dinonaktifkan: hanya kode Authenticator yang bisa membuka, lalu buat PIN baru
      perbaruiKunciCepatAkun(akun.email, { pinHash: undefined, pinGaram: undefined, pinIterasi: undefined, pinGagal: undefined });
      return {
        sukses: false,
        pesan: `PIN salah ${BATAS_SALAH_PIN} kali dan dinonaktifkan. Masukkan kode Google Authenticator, lalu buat PIN baru.`,
        perluAuthenticator: true
      };
    }
    perbaruiKunciCepatAkun(akun.email, { pinGagal: gagal });
    return { sukses: false, pesan: `PIN salah. Sisa ${BATAS_SALAH_PIN - gagal} percobaan.` };
  }
  if (akun.pinGagal) perbaruiKunciCepatAkun(akun.email, { pinGagal: 0 });
  bukaSesuaiTujuan(akun, tujuan);
  return { sukses: true, pesan: "Aplikasi dibuka." };
}

/** Mengganti PIN dari menu Keamanan: PIN lama wajib benar (kesalahan ikut dihitung) */
export async function gantiPin(sesi: AkunSesi | null, pinLama: string, pinBaru: string): Promise<HasilKunci> {
  const akun = bolehMengubah(sesi);
  if (!akun) return { sukses: false, pesan: "Buka aplikasi dan verifikasi Authenticator dulu.", perluAuthenticator: true };
  const galat = validasiPin(pinBaru);
  if (galat) return { sukses: false, pesan: galat };
  if (pinLama === pinBaru) return { sukses: false, pesan: "PIN baru harus berbeda dari PIN lama." };
  const cek = await bukaDenganPin(sesi, pinLama, "aplikasi");
  if (!cek.sukses) return cek;
  return aturPin(sesi, pinBaru);
}

/* ---------- Sidik jari / pengenalan wajah (WebAuthn) ---------- */

/** Mendaftarkan sidik jari/wajah perangkat ini untuk akun sesi (memunculkan dialog sistem) */
export async function daftarkanBiometrik(sesi: AkunSesi | null): Promise<HasilKunci> {
  const akun = bolehMengubah(sesi);
  if (!akun) return { sukses: false, pesan: "Buka aplikasi dan verifikasi Authenticator dulu.", perluAuthenticator: true };
  if (typeof navigator === "undefined" || !navigator.credentials || typeof PublicKeyCredential === "undefined") {
    return { sukses: false, pesan: "Browser ini belum mendukung sidik jari/pengenalan wajah. Gunakan PIN." };
  }
  try {
    const kredensial = (await navigator.credentials.create({
      publicKey: {
        challenge: acak(32),
        rp: { name: "Titik Tapak" },
        user: { id: acak(16), name: akun.email, displayName: akun.nama },
        pubKeyCredParams: [
          { type: "public-key", alg: ALG_ES256 },
          { type: "public-key", alg: ALG_RS256 }
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60_000,
        attestation: "none"
      }
    })) as PublicKeyCredential | null;
    if (!kredensial) return { sukses: false, pesan: "Pendaftaran dibatalkan." };
    const resp = kredensial.response as AuthenticatorAttestationResponse;
    const spki = resp.getPublicKey?.();
    const alg = resp.getPublicKeyAlgorithm?.();
    if (!spki || (alg !== ALG_ES256 && alg !== ALG_RS256)) {
      return { sukses: false, pesan: "Browser ini belum bisa memakai sidik jari/wajah untuk Titik Tapak. Gunakan PIN." };
    }
    perbaruiKunciCepatAkun(akun.email, {
      biometrik: {
        idKredensial: keBase64Url(new Uint8Array(kredensial.rawId)),
        kunciPublik: keBase64(new Uint8Array(spki)),
        alg,
        dibuat: new Date().toISOString(),
        signCount: 0
      }
    });
    return { sukses: true, pesan: "Sidik jari / pengenalan wajah aktif." };
  } catch (err) {
    const nama = err instanceof DOMException ? err.name : "";
    if (nama === "NotAllowedError" || nama === "AbortError") return { sukses: false, pesan: "Pendaftaran dibatalkan atau waktu habis." };
    return { sukses: false, pesan: "Sidik jari/wajah tidak dapat didaftarkan di perangkat ini. Gunakan PIN." };
  }
}

export function hapusBiometrik(sesi: AkunSesi | null): HasilKunci {
  const akun = bolehMengubah(sesi);
  if (!akun) return { sukses: false, pesan: "Buka aplikasi dan verifikasi Authenticator dulu.", perluAuthenticator: true };
  if (!akun.pinHash) return { sukses: false, pesan: "Buat PIN dulu: harus ada minimal satu cara membuka aplikasi." };
  perbaruiKunciCepatAkun(akun.email, { biometrik: undefined });
  return { sukses: true, pesan: "Sidik jari / pengenalan wajah dimatikan." };
}

/** Membuka aplikasi dengan sidik jari/wajah: tantangan acak baru, tanda tangan & signCount diperiksa */
export async function bukaDenganBiometrik(sesi: AkunSesi | null, tujuan: TujuanBuka = "aplikasi"): Promise<HasilKunci> {
  const akun = akunSesi(sesi);
  if (!akun) return { sukses: false, pesan: "Sesi tidak sah. Keluar lalu masuk kembali." };
  const galatTujuan = cekTujuan(akun, tujuan);
  if (galatTujuan) return { sukses: false, pesan: galatTujuan };
  if (sisaMasaTotp(akun.email) <= 0) return { sukses: false, pesan: PESAN_MASA_HABIS, perluAuthenticator: true };
  const bio = akun.biometrik;
  if (!bio) return { sukses: false, pesan: "Sidik jari/wajah belum diaktifkan. Gunakan PIN." };
  if (typeof navigator === "undefined" || !navigator.credentials)
    return { sukses: false, pesan: "Browser ini tidak mendukung sidik jari/wajah." };
  const tantangan = acak(32);
  try {
    const asersi = (await navigator.credentials.get({
      publicKey: {
        challenge: tantangan,
        allowCredentials: [{ type: "public-key", id: dariBase64Url(bio.idKredensial), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60_000
      }
    })) as PublicKeyCredential | null;
    if (!asersi) return { sukses: false, pesan: "Dibatalkan." };
    const r = asersi.response as AuthenticatorAssertionResponse;
    const dataAutentikator = new Uint8Array(r.authenticatorData);
    const sah = await verifikasiAsersi({
      kunciPublikSpki: dariBase64(bio.kunciPublik),
      alg: bio.alg,
      tantangan,
      asal: window.location.origin,
      rpId: window.location.hostname,
      dataKlienJson: new Uint8Array(r.clientDataJSON),
      dataAutentikator,
      tandaTangan: new Uint8Array(r.signature),
      signCountTerakhir: bio.signCount
    });
    if (!sah) return { sukses: false, pesan: "Verifikasi sidik jari/wajah tidak sah. Gunakan PIN." };
    const signCountBaru = bacaSignCount(dataAutentikator);
    if (signCountBaru > (bio.signCount ?? 0)) {
      perbaruiKunciCepatAkun(akun.email, { biometrik: { ...bio, signCount: signCountBaru } });
    }
    bukaSesuaiTujuan(akun, tujuan);
    return { sukses: true, pesan: "Aplikasi dibuka." };
  } catch (err) {
    const nama = err instanceof DOMException ? err.name : "";
    if (nama === "NotAllowedError" || nama === "AbortError")
      return { sukses: false, pesan: "Dibatalkan atau waktu habis. Coba lagi atau gunakan PIN." };
    return { sukses: false, pesan: "Sidik jari/wajah tidak dapat dipakai sekarang. Gunakan PIN." };
  }
}
