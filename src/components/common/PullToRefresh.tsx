import React, { useState, useRef, useCallback } from "react";
import { ArrowDown, Check, Loader2 } from "lucide-react";
import { adalahGeserLurusVertikal, SIMPANGAN_HORIZONTAL_MAKS_PX } from "../../lib/geserTab";

export interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
  disabled?: boolean;
  pullText?: string;
  releaseText?: string;
  refreshingText?: string;
  completeText?: string;
  className?: string;
}

const THRESHOLD = 60;
const MAX_PULL = 90;

/**
 * Komponen wrapper Pull-to-Refresh untuk menyegarkan data otomatis
 * dengan menarik layar ke bawah di HP maupun desktop PC.
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  pullText = "Tarik ke bawah untuk menyegarkan",
  releaseText = "Lepaskan untuk menyegarkan",
  refreshingText = "Menyegarkan data…",
  completeText = "Data berhasil diperbarui",
  className = ""
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [sedangMenyegarkan, setSedangMenyegarkan] = useState(false);
  const [sudahSelesai, setSudahSelesai] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const maksDxRef = useRef<number>(0);
  const isDraggingRef = useRef(false);

  const cekBisaTarik = useCallback(() => {
    if (disabled || sedangMenyegarkan) return false;
    const el = containerRef.current;
    if (!el) return window.scrollY <= 2;
    // Cek scroll container lokal maupun scroll halaman window
    return el.scrollTop <= 2 && window.scrollY <= 2;
  }, [disabled, sedangMenyegarkan]);

  const batalTarik = () => {
    isDraggingRef.current = false;
    startXRef.current = null;
    startYRef.current = null;
    maksDxRef.current = 0;
    setPullDistance(0);
  };

  // Touch handlers (hanya aktif ketika tarikan lurus ke bawah)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (cekBisaTarik() && e.touches.length === 1 && e.touches[0]) {
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      maksDxRef.current = 0;
      isDraggingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || startYRef.current === null || startXRef.current === null || sedangMenyegarkan) return;
    if (e.touches.length !== 1 || !e.touches[0]) {
      batalTarik();
      return;
    }
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;
    maksDxRef.current = Math.max(maksDxRef.current, Math.abs(dx));

    if (maksDxRef.current > SIMPANGAN_HORIZONTAL_MAKS_PX || (Math.hypot(dx, dy) >= 12 && !adalahGeserLurusVertikal(dx, dy, maksDxRef.current))) {
      batalTarik();
      return;
    }

    if (dy > 0 && cekBisaTarik()) {
      // Damping resistance
      const damped = Math.min(MAX_PULL, Math.pow(dy, 0.78) * 1.8);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startXRef.current = null;
    startYRef.current = null;
    maksDxRef.current = 0;

    if (pullDistance >= THRESHOLD && !sedangMenyegarkan) {
      await picuRefresh();
    } else {
      setPullDistance(0);
    }
  };

  // Pointer drag for PC/Desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && cekBisaTarik()) {
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      maksDxRef.current = 0;
      isDraggingRef.current = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || startYRef.current === null || startXRef.current === null || sedangMenyegarkan) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    maksDxRef.current = Math.max(maksDxRef.current, Math.abs(dx));

    if (maksDxRef.current > SIMPANGAN_HORIZONTAL_MAKS_PX || (Math.hypot(dx, dy) >= 12 && !adalahGeserLurusVertikal(dx, dy, maksDxRef.current))) {
      batalTarik();
      return;
    }

    if (dy > 0 && cekBisaTarik()) {
      const damped = Math.min(MAX_PULL, Math.pow(dy, 0.78) * 1.8);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const handleMouseUp = async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startXRef.current = null;
    startYRef.current = null;
    maksDxRef.current = 0;

    if (pullDistance >= THRESHOLD && !sedangMenyegarkan) {
      await picuRefresh();
    } else {
      setPullDistance(0);
    }
  };

  const picuRefresh = async () => {
    setSedangMenyegarkan(true);
    setPullDistance(THRESHOLD);

    try {
      await onRefresh();
      setSudahSelesai(true);
      setTimeout(() => {
        setSudahSelesai(false);
        setSedangMenyegarkan(false);
        setPullDistance(0);
      }, 500);
    } catch {
      setSedangMenyegarkan(false);
      setPullDistance(0);
    }
  };

  // Persentase tarikan (0 - 100%)
  const rasio = Math.min(1, pullDistance / THRESHOLD);
  const tampilBadge = pullDistance > 8 || sedangMenyegarkan || sudahSelesai;

  return (
    <div
      ref={containerRef}
      className={`ptr-wrapper ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100%"
      }}
    >
      {/* Indikator Floating Pull to Refresh */}
      {tampilBadge && (
        <div
          className={`ptr-indicator ${sedangMenyegarkan ? "menyegarkan" : ""} ${sudahSelesai ? "selesai" : ""}`}
          role="status"
          aria-live="polite"
          style={{
            transform: `translate(-50%, ${Math.min(pullDistance, THRESHOLD)}px)`
          }}
        >
          {sedangMenyegarkan ? (
            <>
              <Loader2 size={16} className="ptr-spin" aria-hidden="true" />
              <span>{refreshingText}</span>
            </>
          ) : sudahSelesai ? (
            <>
              <Check size={16} color="#0d7344" aria-hidden="true" />
              <span>{completeText}</span>
            </>
          ) : (
            <>
              <ArrowDown
                size={16}
                style={{
                  transform: `rotate(${rasio >= 1 ? 180 : rasio * 180}deg)`,
                  transition: "transform 140ms ease"
                }}
                aria-hidden="true"
              />
              <span>{rasio >= 1 ? releaseText : pullText}</span>
            </>
          )}
        </div>
      )}

      {/* Konten Halaman */}
      <div
        className="ptr-content"
        style={{
          transform: pullDistance > 0 && !sedangMenyegarkan ? `translateY(${pullDistance * 0.35}px)` : undefined,
          transition: isDraggingRef.current ? "none" : "transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1)"
        }}
      >
        {children}
      </div>
    </div>
  );
};
