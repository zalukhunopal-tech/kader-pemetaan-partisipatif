import { useCallback, useEffect, useRef, useState } from "react";
import { SIMPANGAN_HORIZONTAL_MAKS_PX, adalahGeserLurusVertikal } from "./geserTab";

export const AMBANG_TARIK_SEGARKAN_PX = 64;
export const MAKS_TARIK_VISUAL_PX = 104;

export interface OpsiTarikSegarkan {
  aktif: boolean;
  onSegarkan: () => void | Promise<void>;
  /** Durasi minimum animasi segarkan agar terasa halus (ms) */
  durasiMinMs?: number;
}

export interface HasilTarikSegarkan {
  jarakTarikPx: number;
  siapSegarkan: boolean;
  sedangMenyegarkan: boolean;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

/** Mengabaikan sentuhan yang dimulai di kanvas peta, modal, sheet bawah, atau kolom isian */
export function abaikanTarikSegarkanDari(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el) {
    if (el instanceof HTMLElement) {
      const tag = el.tagName;
      if (tag === "CANVAS" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (
        el.classList.contains("map-canvas-container") ||
        el.classList.contains("avz-peta") ||
        el.classList.contains("modal-backdrop") ||
        el.classList.contains("avz-peek-card") ||
        el.classList.contains("field-sheet") ||
        el.getAttribute("role") === "dialog"
      ) {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

/** Memastikan posisi scroll target dan dokumen berada di paling atas sebelum tarik-segarkan diizinkan */
function beradaDiPalingAtas(target: EventTarget | null): boolean {
  if (typeof window !== "undefined" && (window.scrollY || document.documentElement.scrollTop || 0) > 2) {
    return false;
  }
  let el = target instanceof Element ? target : null;
  while (el) {
    if (el instanceof HTMLElement && el.scrollTop > 2) {
      return false;
    }
    el = el.parentElement;
  }
  return true;
}

/**
 * Tarik ke bawah (pull-to-refresh) di dalam aplikasi tanpa memuat ulang browser:
 * - Tidak pernah keluar dari aplikasi atau memanggil window.location.reload().
 * - Mempertahankan tab dan tampilan layar aktif persis seperti sebelumnya.
 * - Tidak pernah mengunci ulang aplikasi ke layar buka kunci.
 */
export function useTarikSegarkan({
  aktif,
  onSegarkan,
  durasiMinMs = 360
}: OpsiTarikSegarkan): HasilTarikSegarkan {
  const [jarakTarikPx, setJarakTarikPx] = useState(0);
  const [sedangMenyegarkan, setSedangMenyegarkan] = useState(false);

  const awalRef = useRef<{ x: number; y: number; maksDx: number; aktif: boolean; dibatalkan: boolean } | null>(null);
  const jarakRef = useRef(0);
  const sedangRef = useRef(false);
  const timerSelesaiRef = useRef<number | null>(null);
  const onSegarkanRef = useRef(onSegarkan);
  onSegarkanRef.current = onSegarkan;

  useEffect(
    () => () => {
      if (timerSelesaiRef.current !== null) {
        window.clearTimeout(timerSelesaiRef.current);
        timerSelesaiRef.current = null;
      }
    },
    []
  );

  const resetTarik = useCallback(() => {
    awalRef.current = null;
    jarakRef.current = 0;
    setJarakTarikPx(0);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!aktif || sedangRef.current) return;
      if (e.touches.length !== 1 || !e.touches[0]) return;
      if (abaikanTarikSegarkanDari(e.target) || !beradaDiPalingAtas(e.target)) {
        awalRef.current = null;
        return;
      }
      awalRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        maksDx: 0,
        aktif: false,
        dibatalkan: false
      };
      jarakRef.current = 0;
    },
    [aktif]
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const awal = awalRef.current;
    if (!awal || awal.dibatalkan || sedangRef.current) return;
    if (e.touches.length !== 1 || !e.touches[0]) {
      resetTarik();
      return;
    }
    const dx = e.touches[0].clientX - awal.x;
    const dy = e.touches[0].clientY - awal.y;
    awal.maksDx = Math.max(awal.maksDx, Math.abs(dx));

    // Hanya merespons tarikan ke bawah (dy > 0) yang lurus vertikal
    if (dy <= 0) {
      if (awal.aktif) resetTarik();
      return;
    }
    if (awal.maksDx > SIMPANGAN_HORIZONTAL_MAKS_PX) {
      awal.dibatalkan = true;
      jarakRef.current = 0;
      setJarakTarikPx(0);
      return;
    }
    if (dy < 12) return;
    if (dy >= 24 && !adalahGeserLurusVertikal(dx, dy, awal.maksDx)) {
      awal.dibatalkan = true;
      jarakRef.current = 0;
      setJarakTarikPx(0);
      return;
    }

    awal.aktif = true;
    const visual = Math.min(MAKS_TARIK_VISUAL_PX, Math.round(dy * 0.6));
    jarakRef.current = visual;
    setJarakTarikPx(visual);
  }, [resetTarik]);

  const onTouchEnd = useCallback(() => {
    const awal = awalRef.current;
    const jarak = jarakRef.current;
    awalRef.current = null;

    if (!awal || awal.dibatalkan || !awal.aktif || sedangRef.current) {
      jarakRef.current = 0;
      setJarakTarikPx(0);
      return;
    }

    if (jarak < AMBANG_TARIK_SEGARKAN_PX) {
      jarakRef.current = 0;
      setJarakTarikPx(0);
      return;
    }

    // Picu penyegaran lembut di dalam aplikasi tanpa reload halaman & tanpa keluar/mengunci
    sedangRef.current = true;
    setSedangMenyegarkan(true);
    setJarakTarikPx(AMBANG_TARIK_SEGARKAN_PX);

    const mulai = Date.now();
    Promise.resolve()
      .then(() => onSegarkanRef.current())
      .catch(() => undefined)
      .finally(() => {
        const sisa = Math.max(0, durasiMinMs - (Date.now() - mulai));
        timerSelesaiRef.current = window.setTimeout(() => {
          timerSelesaiRef.current = null;
          sedangRef.current = false;
          jarakRef.current = 0;
          setSedangMenyegarkan(false);
          setJarakTarikPx(0);
        }, sisa);
      });
  }, [durasiMinMs]);

  return {
    jarakTarikPx,
    siapSegarkan: jarakTarikPx >= AMBANG_TARIK_SEGARKAN_PX,
    sedangMenyegarkan,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: resetTarik
  };
}
