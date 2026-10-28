import { useSyncExternalStore } from "react";

/**
 * Gerbang yang hanya hidup di memori halaman: terbuka untuk satu email, otomatis tertutup setelah
 * diam terlalu lama, dan selalu tertutup lagi saat halaman dimuat ulang (memori kosong). Dipakai
 * untuk kunci aplikasi (PIN/sidik jari) dan gerbang mode admin.
 */
export interface GerbangMemori {
  buka(email: string, sekarang?: number): void;
  kunci(): void;
  /** true bila terbuka untuk email ini dan belum melewati batas diam (menutup sendiri bila sudah lewat) */
  terbuka(email: string | undefined | null, sekarang?: number): boolean;
  /** Aktivitas pengguna memperpanjang batas diam */
  catatAktivitas(sekarang?: number): void;
  /** Sisa waktu sebelum tertutup karena diam (ms); 0 bila tertutup */
  sisaWaktu(sekarang?: number): number;
  /** Membuat komponen digambar ulang setiap kali gerbang dibuka atau ditutup */
  useVersi(): number;
}

export function buatGerbangMemori(batasDiamMs: number): GerbangMemori {
  let state: { email: string; terakhirAktif: number } | null = null;
  let versi = 0;
  const pendengar = new Set<() => void>();
  const beritahu = () => {
    versi++;
    pendengar.forEach((p) => p());
  };
  const langganan = (fn: () => void) => {
    pendengar.add(fn);
    return () => {
      pendengar.delete(fn);
    };
  };
  const ambilVersi = () => versi;

  return {
    buka(email, sekarang = Date.now()) {
      state = { email: email.trim().toLowerCase(), terakhirAktif: sekarang };
      beritahu();
    },
    kunci() {
      if (!state) return;
      state = null;
      beritahu();
    },
    terbuka(email, sekarang = Date.now()) {
      if (!state || !email) return false;
      if (sekarang - state.terakhirAktif > batasDiamMs || sekarang < state.terakhirAktif) {
        state = null; // diam terlalu lama, atau jam perangkat dimundurkan
        beritahu();
        return false;
      }
      return state.email === email.trim().toLowerCase();
    },
    catatAktivitas(sekarang = Date.now()) {
      if (state && sekarang - state.terakhirAktif <= batasDiamMs && sekarang >= state.terakhirAktif) state.terakhirAktif = sekarang;
    },
    sisaWaktu(sekarang = Date.now()) {
      if (!state) return 0;
      return Math.max(0, batasDiamMs - (sekarang - state.terakhirAktif));
    },
    useVersi() {
      return useSyncExternalStore(langganan, ambilVersi, ambilVersi);
    }
  };
}
