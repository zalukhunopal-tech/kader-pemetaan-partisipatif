import { useSyncExternalStore } from "react";

/**
 * GERBANG ADMIN (lapis pengaman kedua untuk akun admin)
 *
 * Sesi login tersimpan di perangkat, tetapi kewenangan admin TIDAK ikut tersimpan: gerbang ini hanya
 * hidup di memori halaman. Gerbang dibuka oleh verifikasi Google Authenticator (saat login admin atau
 * saat masuk kembali ke mode admin) dan otomatis terkunci saat:
 * - halaman dimuat ulang atau aplikasi dibuka lagi,
 * - tidak ada aktivitas selama BATAS_DIAM_MS,
 * - admin beralih ke Mode User, keluar, atau akun lain masuk.
 * Setiap aksi admin memeriksa gerbang ini di samping data akun, sehingga mengubah penyimpanan
 * perangkat saja tidak memberi akses admin.
 */

export const BATAS_DIAM_MS = 15 * 60 * 1000;

interface StateGerbang {
  email: string;
  terakhirAktif: number;
}

let state: StateGerbang | null = null;
let versi = 0;
const pendengar = new Set<() => void>();

function beritahu() {
  versi++;
  pendengar.forEach((p) => p());
}

/** Dipakai oleh auth.ts setelah kode Authenticator admin terverifikasi; jangan dipanggil dari tempat lain */
export function bukaGerbangAdmin(email: string, sekarang = Date.now()): void {
  state = { email: email.trim().toLowerCase(), terakhirAktif: sekarang };
  beritahu();
}

export function kunciGerbangAdmin(): void {
  if (!state) return;
  state = null;
  beritahu();
}

/** true bila gerbang terbuka untuk email ini dan belum melewati batas diam (mengunci bila sudah lewat) */
export function gerbangAdminTerbuka(email: string | undefined | null, sekarang = Date.now()): boolean {
  if (!state || !email) return false;
  if (sekarang - state.terakhirAktif > BATAS_DIAM_MS) {
    state = null;
    beritahu();
    return false;
  }
  return state.email === email.trim().toLowerCase();
}

/** Aktivitas pengguna di mode admin memperpanjang batas diam */
export function catatAktivitasAdmin(sekarang = Date.now()): void {
  if (state && sekarang - state.terakhirAktif <= BATAS_DIAM_MS) state.terakhirAktif = sekarang;
}

/** Sisa waktu sebelum terkunci karena diam (ms); 0 bila terkunci */
export function sisaWaktuGerbang(sekarang = Date.now()): number {
  if (!state) return 0;
  return Math.max(0, BATAS_DIAM_MS - (sekarang - state.terakhirAktif));
}

const langganan = (fn: () => void) => {
  pendengar.add(fn);
  return () => {
    pendengar.delete(fn);
  };
};
const ambilVersi = () => versi;

/** Membuat komponen digambar ulang setiap kali gerbang dibuka atau dikunci */
export function useVersiGerbangAdmin(): number {
  return useSyncExternalStore(langganan, ambilVersi, ambilVersi);
}
