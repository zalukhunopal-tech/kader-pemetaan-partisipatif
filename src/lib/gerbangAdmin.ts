import { buatGerbangMemori } from "./gerbangMemori";

/**
 * GERBANG ADMIN (lapis pengaman kedua untuk akun admin)
 *
 * Sesi login tersimpan di perangkat, tetapi kewenangan admin TIDAK ikut tersimpan: gerbang ini hanya
 * hidup di memori halaman. Gerbang dibuka oleh verifikasi identitas (kode Google Authenticator, atau
 * PIN/sidik jari/wajah selama kode Authenticator terakhir masih dalam masa berlaku 8 jam) dan
 * otomatis terkunci saat:
 * - halaman dimuat ulang atau aplikasi dibuka lagi,
 * - tidak ada aktivitas selama BATAS_DIAM_MS,
 * - admin beralih ke Mode User, keluar, atau akun lain masuk.
 * Setiap aksi admin memeriksa gerbang ini di samping data akun, sehingga mengubah penyimpanan
 * perangkat saja tidak memberi akses admin.
 */

export const BATAS_DIAM_MS = 15 * 60 * 1000;

const gerbang = buatGerbangMemori(BATAS_DIAM_MS);

/** Dipakai oleh auth.ts dan kunciCepat.ts setelah identitas admin terverifikasi; jangan dipanggil dari tempat lain */
export const bukaGerbangAdmin = (email: string, sekarang = Date.now()): void => gerbang.buka(email, sekarang);
export const kunciGerbangAdmin = (): void => gerbang.kunci();
export const gerbangAdminTerbuka = (email: string | undefined | null, sekarang = Date.now()): boolean =>
  gerbang.terbuka(email, sekarang);
export const catatAktivitasAdmin = (sekarang = Date.now()): void => gerbang.catatAktivitas(sekarang);
export const sisaWaktuGerbang = (sekarang = Date.now()): number => gerbang.sisaWaktu(sekarang);
export const useVersiGerbangAdmin = (): number => gerbang.useVersi();
