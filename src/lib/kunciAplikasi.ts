import { buatGerbangMemori } from "./gerbangMemori";

/**
 * KUNCI APLIKASI (layar PIN / sidik jari / pengenalan wajah)
 *
 * Sesi login tersimpan di perangkat, tetapi status "terbuka" hanya di memori: setiap kali aplikasi
 * dibuka ulang, dan setelah BATAS_DIAM_APLIKASI_MS tanpa aktivitas, aplikasi terkunci dan harus
 * dibuka dengan PIN atau sidik jari/wajah. Kode Google Authenticator tetap diminta lagi bila
 * verifikasi terakhir sudah lebih dari 8 jam (lihat MASA_BERLAKU_TOTP_MS di auth.ts).
 */

export const BATAS_DIAM_APLIKASI_MS = 15 * 60 * 1000;

const gerbang = buatGerbangMemori(BATAS_DIAM_APLIKASI_MS);

/** Dipakai oleh auth.ts dan kunciCepat.ts setelah identitas terverifikasi */
export const bukaAplikasi = (email: string, sekarang = Date.now()): void => gerbang.buka(email, sekarang);
export const kunciAplikasi = (): void => gerbang.kunci();
export const aplikasiTerbuka = (email: string | undefined | null, sekarang = Date.now()): boolean =>
  gerbang.terbuka(email, sekarang);
export const catatAktivitasAplikasi = (sekarang = Date.now()): void => gerbang.catatAktivitas(sekarang);
export const useVersiKunciAplikasi = (): number => gerbang.useVersi();
