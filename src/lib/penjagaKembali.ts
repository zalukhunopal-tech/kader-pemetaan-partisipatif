/**
 * Penjaga tombol Back (perangkat / browser / Android PWA) agar menekan Back 1 kali
 * menutup panel aktif atau menampilkan peringatan terlebih dahulu, dan baru keluar
 * pada tekanan Back ke-2 dalam jendela waktu singkat.
 *
 * Penting untuk Chromium / Android WebAPK:
 * `history.pushState` sebelum adanya aktivasi pengguna membuat entri dasar ditandai
 * skippable oleh History Manipulation Intervention sehingga tombol Back perangkat keras
 * langsung keluar dari aplikasi. Karena itu entri penjaga hanya dipasang saat/setelah
 * ada interaksi nyata pengguna.
 */

export const BATAS_WAKTU_KEMBALI_MS = 2500;
export const KUNCI_STATE_PENJAGA = "__titikTapakPenjaga";
export const KUNCI_STATE_DASAR = "__titikTapakDasar";
export const PESAN_TEKAN_KEMBALI_LAGI = "Tekan back 2 kali untuk keluar dari aplikasi.";

export interface OpsiPenjagaKembali {
  /** Tutup menu/modal/halaman anak teratas bila ada; kembalikan true jika ada yang ditutup */
  onTutupLapisanTeratas?: () => boolean;
  /** Dipanggil saat tekan Back ke-1 untuk memberi tahu pengguna menekan sekali lagi */
  onPeringatanKeluar: () => void;
  /** Jendela waktu menunggu tekan Back ke-2 dalam milidetik (default 2000 ms) */
  batasWaktuMs?: number;
}

const tumpukanPenutup: (() => boolean)[] = [];

/**
 * Mendaftarkan penutup lapisan anak (modal/panel) secara LIFO untuk ditangani saat tombol Back ditekan.
 */
export function daftarkanPenutupLapisan(penutup: () => boolean): () => void {
  tumpukanPenutup.push(penutup);
  return () => {
    const idx = tumpukanPenutup.lastIndexOf(penutup);
    if (idx !== -1) tumpukanPenutup.splice(idx, 1);
  };
}

export function panggilPenutupLapisanTeratas(): boolean {
  for (let i = tumpukanPenutup.length - 1; i >= 0; i--) {
    if (tumpukanPenutup[i]()) return true;
  }
  return false;
}

function urlSaatIni(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function adalahObjekState(nilai: unknown): nilai is Record<string, unknown> {
  return typeof nilai === "object" && nilai !== null;
}

export function userSudahAktif(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean; isActive: boolean } }).userActivation;
  if (!ua) return true;
  return Boolean(ua.hasBeenActive || ua.isActive);
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
 * Pasang pendengar global tombol Back (`popstate`) dengan penjaga aktivasi pengguna.
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

  const sinkronkanPenjagaJikaAktif = () => {
    if (siapKeluar) return;
    if (userSudahAktif()) {
      pastikanRiwayatPenjaga();
    }
  };

  // Pasang langsung hanya jika browser melaporkan sesi sudah pernah beraktivasi pengguna
  sinkronkanPenjagaJikaAktif();

  const saatInteraksi = () => {
    if (siapKeluar) return;
    // Tunggu microtask bila handler event berjalan tepat sebelum bit userActivation menyala, lalu pasang penjaga
    if (userSudahAktif()) {
      pastikanRiwayatPenjaga();
    } else {
      window.setTimeout(sinkronkanPenjagaJikaAktif, 0);
    }
  };

  const acaraInteraksi: (keyof WindowEventMap)[] = ["pointerdown", "touchstart", "pointerup", "touchend", "click", "keydown"];
  for (const ev of acaraInteraksi) {
    window.addEventListener(ev, saatInteraksi, { capture: true, passive: true });
  }

  const tanganiPopState = (event: PopStateEvent) => {
    const stateSekarang = event.state;
    // Jika pengguna menekan Forward kembali ke entri penjaga, reset mode siap keluar
    if (adalahObjekState(stateSekarang) && stateSekarang[KUNCI_STATE_PENJAGA] === true) {
      batalkanSiapKeluar();
      return;
    }

    // Tutup panel/modal aktif atau kembali ke Peta Interaktif (home) terlebih dahulu
    if (panggilPenutupLapisanTeratas() || opsi.onTutupLapisanTeratas?.()) {
      batalkanSiapKeluar();
      pastikanRiwayatPenjaga();
      return;
    }

    // Tekan Back ke-2 dalam batas waktu: biarkan browser keluar/kembali secara alami
    if (siapKeluar) {
      batalkanSiapKeluar();
      return;
    }

    // Tekan Back ke-1 di Peta Interaktif (home): aktifkan jendela siap keluar dan beri tahu pengguna.
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
    for (const ev of acaraInteraksi) {
      window.removeEventListener(ev, saatInteraksi, { capture: true });
    }
  };
}
