import { useSyncExternalStore } from "react";

/**
 * PEMASANGAN APLIKASI (PWA)
 * Menangkap event `beforeinstallprompt` (Chrome, Edge, Samsung Internet, dan browser Android
 * berbasis Chromium) agar aplikasi bisa menampilkan tombol "Instal" sendiri. Safari iOS tidak punya
 * event ini; di sana pengguna diarahkan ke Bagikan > Tambahkan ke Layar Utama.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PlatformInstal = "ios" | "android" | "desktop";

export interface StatusInstal {
  /** Browser menyediakan dialog pemasangan bawaan yang bisa dipanggil tombol aplikasi */
  bisaPrompt: boolean;
  /** Aplikasi sedang berjalan sebagai aplikasi terpasang (bukan di tab browser) */
  terinstal: boolean;
  platform: PlatformInstal;
}

let promptTertunda: BeforeInstallPromptEvent | null = null;
let status: StatusInstal = { bisaPrompt: false, terinstal: false, platform: "desktop" };
const pendengar = new Set<() => void>();
let sudahDipasang = false;

function ubah(sebagian: Partial<StatusInstal>) {
  status = { ...status, ...sebagian };
  pendengar.forEach((p) => p());
}

export function deteksiPlatform(ua: string, platform = "", titikSentuh = 0): PlatformInstal {
  if (/iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && titikSentuh > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function berjalanTerpasang(): boolean {
  try {
    const nav = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  } catch {
    return false;
  }
}

/** Dipanggil sekali sedini mungkin (main.tsx), sebelum event pemasangan sempat terlewat */
export function pasangPendengarInstal(): void {
  if (sudahDipasang || typeof window === "undefined") return;
  sudahDipasang = true;
  status = {
    bisaPrompt: false,
    terinstal: berjalanTerpasang(),
    platform: deteksiPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
  };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // tampilkan tombol aplikasi sendiri, bukan bilah mini bawaan browser
    promptTertunda = e as BeforeInstallPromptEvent;
    ubah({ bisaPrompt: true });
  });
  window.addEventListener("appinstalled", () => {
    promptTertunda = null;
    ubah({ bisaPrompt: false, terinstal: true });
  });
  try {
    window.matchMedia("(display-mode: standalone)").addEventListener("change", (ev) => ubah({ terinstal: ev.matches }));
  } catch {
    // browser lama: status terpasang dibaca sekali saja
  }
}

/** Membuka dialog pemasangan bawaan browser bila tersedia */
export async function mintaInstal(): Promise<"diterima" | "ditolak" | "tidak_tersedia"> {
  const p = promptTertunda;
  if (!p) return "tidak_tersedia";
  promptTertunda = null; // event hanya bisa dipakai sekali
  ubah({ bisaPrompt: false });
  await p.prompt();
  const { outcome } = await p.userChoice;
  return outcome === "accepted" ? "diterima" : "ditolak";
}

const langganan = (fn: () => void) => {
  pendengar.add(fn);
  return () => {
    pendengar.delete(fn);
  };
};
const ambil = () => status;

export function useStatusInstal(): StatusInstal {
  return useSyncExternalStore(langganan, ambil, ambil);
}

/* ---------- Banner yang bisa ditutup ---------- */

const KUNCI_BANNER = "geokader_banner_instal_ditutup";
const JEDA_TAMPIL_ULANG_MS = 14 * 24 * 60 * 60 * 1000;

export function bannerInstalDitutup(sekarang = Date.now()): boolean {
  try {
    const t = Number(localStorage.getItem(KUNCI_BANNER) || 0);
    return t > 0 && sekarang - t < JEDA_TAMPIL_ULANG_MS;
  } catch {
    return false;
  }
}

export function tutupBannerInstal(sekarang = Date.now()): void {
  try {
    localStorage.setItem(KUNCI_BANNER, String(sekarang));
  } catch {
    // abaikan
  }
}
