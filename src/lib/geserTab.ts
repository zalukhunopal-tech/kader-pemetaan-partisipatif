/**
 * Geser (swipe) kiri/kanan untuk berpindah tab. Fungsi murni agar mudah diuji; App hanya
 * meneruskan titik awal/akhir sentuhan.
 */

export const JARAK_GESER_MIN_PX = 70;
export const WAKTU_GESER_MAKS_MS = 700;
/** Rasio minimum gerak lurus horizontal (|dx| / |dy| >= 3.0 -> sudut maks ~18,4°) */
export const RASIO_LURUS_HORIZONTAL = 3.0;
/** Simpangan vertikal maksimum selama geser horizontal agar gestur melengkung/miring ditolak */
export const SIMPANGAN_VERTIKAL_MAKS_PX = 36;
/** Rasio minimum gerak lurus vertikal (|dy| / |dx| >= 2.5 -> sudut maks ~21,8°) */
export const RASIO_LURUS_VERTIKAL = 2.5;
/** Simpangan horizontal maksimum selama geser vertikal */
export const SIMPANGAN_HORIZONTAL_MAKS_PX = 32;

export interface Sentuhan {
  x: number;
  y: number;
  t: number;
  /** Simpangan maksimum sumbu silang selama gerakan berlangsung (opsional, untuk mendeteksi sapuan melengkung) */
  maksSimpanganY?: number;
}

/** Memeriksa apakah perpindahan (dx, dy) merupakan sapuan horizontal yang benar-benar lurus */
export function adalahGeserLurusHorizontal(dx: number, dy: number, maksSimpanganY?: number): boolean {
  const absX = Math.abs(dx);
  const absY = Math.max(Math.abs(dy), maksSimpanganY ?? 0);
  if (absY > SIMPANGAN_VERTIKAL_MAKS_PX) return false;
  if (absX < absY * RASIO_LURUS_HORIZONTAL) return false;
  return true;
}

/** Memeriksa apakah perpindahan (dx, dy) merupakan sapuan vertikal yang benar-benar lurus */
export function adalahGeserLurusVertikal(dx: number, dy: number, maksSimpanganX?: number): boolean {
  const absX = Math.max(Math.abs(dx), maksSimpanganX ?? 0);
  const absY = Math.abs(dy);
  if (absX > SIMPANGAN_HORIZONTAL_MAKS_PX) return false;
  if (absY < absX * RASIO_LURUS_VERTIKAL) return false;
  return true;
}

/** -1 = ke tab sebelumnya (geser ke kanan), 1 = tab berikutnya (geser ke kiri), 0 = bukan geser tab */
export function arahGeser(awal: Sentuhan, akhir: Sentuhan): -1 | 0 | 1 {
  const dx = akhir.x - awal.x;
  const dy = akhir.y - awal.y;
  if (akhir.t - awal.t > WAKTU_GESER_MAKS_MS) return 0;
  if (Math.abs(dx) < JARAK_GESER_MIN_PX) return 0;
  // Hanya aktif ketika geser benar-benar lurus mendatar (bukan miring/diagonal atau melengkung)
  const maksY = Math.max(awal.maksSimpanganY ?? 0, akhir.maksSimpanganY ?? 0);
  if (!adalahGeserLurusHorizontal(dx, dy, maksY)) return 0;
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
      if (
        el.classList.contains("map-canvas-container") ||
        el.classList.contains("modal-backdrop") ||
        el.classList.contains("avz-halaman") ||
        el.classList.contains("avz-peek-card") ||
        el.classList.contains("field-sheet") ||
        el.getAttribute("role") === "dialog"
      ) {
        return true;
      }
      if (el.scrollWidth > el.clientWidth + 2) {
        const ox = getComputedStyle(el).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}
