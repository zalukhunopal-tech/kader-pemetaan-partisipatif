/**
 * Geser (swipe) kiri/kanan untuk berpindah tab. Fungsi murni agar mudah diuji; App hanya
 * meneruskan titik awal/akhir sentuhan.
 */

export const JARAK_GESER_MIN_PX = 70;
export const WAKTU_GESER_MAKS_MS = 700;

export interface Sentuhan {
  x: number;
  y: number;
  t: number;
}

/** -1 = ke tab sebelumnya (geser ke kanan), 1 = tab berikutnya (geser ke kiri), 0 = bukan geser tab */
export function arahGeser(awal: Sentuhan, akhir: Sentuhan): -1 | 0 | 1 {
  const dx = akhir.x - awal.x;
  const dy = akhir.y - awal.y;
  if (akhir.t - awal.t > WAKTU_GESER_MAKS_MS) return 0;
  if (Math.abs(dx) < JARAK_GESER_MIN_PX) return 0;
  // harus jelas mendatar, supaya gulir naik-turun tidak dianggap pindah tab
  if (Math.abs(dx) < Math.abs(dy) * 1.8) return 0;
  return dx < 0 ? 1 : -1;
}

/** Tab tujuan; tidak berputar dari ujung ke ujung */
export function tabTujuan<T>(urutan: readonly T[], aktif: T, arah: -1 | 0 | 1): T {
  const i = urutan.indexOf(aktif);
  if (arah === 0 || i === -1) return aktif;
  const j = i + arah;
  return j < 0 || j >= urutan.length ? aktif : urutan[j];
}

/**
 * Sentuhan yang dimulai di elemen ini tidak dipakai untuk pindah tab: peta (geser = menggeser peta),
 * isian teks, penggeser, modal, dan elemen yang bisa digulir mendatar.
 */
export function abaikanGeserDari(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el) {
    if (el instanceof HTMLElement) {
      if (el.dataset.tanpaGeser !== undefined) return true;
      const tag = el.tagName;
      if (tag === "CANVAS" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.classList.contains("map-canvas-container") || el.classList.contains("modal-backdrop")) return true;
      if (el.scrollWidth > el.clientWidth + 2) {
        const ox = getComputedStyle(el).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}
