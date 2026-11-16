/**
 * Penjaga tombol Back (perangkat / browser / PWA) agar menekan Back 1 kali
 * menampilkan peringatan terlebih dahulu dan baru keluar pada tekanan ke-2
 * dalam jendela waktu singkat.
 */

export const BATAS_WAKTU_KEMBALI_MS = 2000;
export const KUNCI_STATE_PENJAGA = "__titikTapakPenjaga";
export const KUNCI_STATE_DASAR = "__titikTapakDasar";
export const PESAN_TEKAN_KEMBALI_LAGI = "Tekan kembali sekali lagi untuk keluar dari aplikasi.";

export interface OpsiPenjagaKembali {
  /** Tutup menu/modal/halaman anak teratas bila ada; kembalikan true jika ada yang ditutup */
  onTutupLapisanTeratas?: () => boolean;
  /** Dipanggil saat tekan Back ke-1 untuk memberi tahu pengguna menekan sekali lagi */
  onPeringatanKeluar: () => void;
  /** Jendela waktu menunggu tekan Back ke-2 dalam milidetik (default 2000 ms) */
  batasWaktuMs?: number;
}

function urlSaatIni(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function adalahObjekState(nilai: unknown): nilai is Record<string, unknown> {
  return typeof nilai === "object" && nilai !== null;
}

/**
 * Memastikan ada satu entri riwayat penjaga di atas entri dasar agar tekan Back ke-1
 * dapat dicegat oleh event `popstate` tanpa langsung menutup aplikasi.
 */
export function pastikanRiwayatPenjaga(): boolean {
  if (typeof window === "undefined" || !window.history) return false;
  try {
    const stateSekarang = window.history.state;
    if (adalahObjekState(stateSekarang) && stateSekarang[KUNCI_STATE_PENJAGA] === true) {
      return false;
    }
    const url = urlSaatIni();
    if (!adalahObjekState(stateSekarang) || stateSekarang[KUNCI_STATE_DASAR] !== true) {
      const dasar = { ...(adalahObjekState(stateSekarang) ? stateSekarang : {}), [KUNCI_STATE_DASAR]: true };
      window.history.replaceState(dasar, "", url);
    }
    window.history.pushState({ [KUNCI_STATE_PENJAGA]: true }, "", url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pasang pendengar global tombol Back (`popstate`).
 * Kembalikan fungsi pembersih untuk melepas pendengar dan timer.
 */
export function pasangPenjagaKembali(opsi: OpsiPenjagaKembali): () => void {
  if (typeof window === "undefined") return () => {};

  const batasWaktuMs = opsi.batasWaktuMs ?? BATAS_WAKTU_KEMBALI_MS;
  let siapKeluar = false;
  let timerReset: number | null = null;

  const batalkanSiapKeluar = () => {
    siapKeluar = false;
    if (timerReset !== null) {
      window.clearTimeout(timerReset);
      timerReset = null;
    }
  };

  pastikanRiwayatPenjaga();

  const tanganiPopState = (event: PopStateEvent) => {
    const stateSekarang = event.state;
    // Jika pengguna menekan Forward kembali ke entri penjaga, reset mode siap keluar
    if (adalahObjekState(stateSekarang) && stateSekarang[KUNCI_STATE_PENJAGA] === true) {
      batalkanSiapKeluar();
      return;
    }

    // Jika masih ada panel/menu/halaman anak yang terbuka, tutup terlebih dahulu
    if (opsi.onTutupLapisanTeratas?.()) {
      batalkanSiapKeluar();
      pastikanRiwayatPenjaga();
      return;
    }

    // Tekan Back ke-2 dalam batas waktu: biarkan browser keluar/kembali secara alami
    if (siapKeluar) {
      batalkanSiapKeluar();
      return;
    }

    // Tekan Back ke-1: aktifkan jendela siap keluar dan beri tahu pengguna.
    // Jangan dorong entri penjaga baru selama jendela ini agar Back ke-2 langsung keluar.
    siapKeluar = true;
    timerReset = window.setTimeout(() => {
      timerReset = null;
      siapKeluar = false;
      pastikanRiwayatPenjaga();
    }, batasWaktuMs);
    opsi.onPeringatanKeluar();
  };

  window.addEventListener("popstate", tanganiPopState);
  return () => {
    batalkanSiapKeluar();
    window.removeEventListener("popstate", tanganiPopState);
  };
}
