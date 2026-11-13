import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

type TahapSheet = 25 | 55 | 92;
/** Dialog nonmodal: peta tetap bisa digeser; handle dapat dipakai lewat sentuhan maupun keyboard. */
export function BottomSheet({
  judul,
  onTutup,
  children,
  awal = 55,
  className = "",
  halaman = false,
  aksiKanan
}: {
  judul: string;
  onTutup: () => void;
  children: React.ReactNode;
  awal?: TahapSheet;
  className?: string;
  /** Tampil sebagai halaman penuh gaya Avenza Maps: tombol turun di kiri, judul, aksi di kanan */
  halaman?: boolean;
  aksiKanan?: React.ReactNode;
}) {
  const [tinggi, setTinggi] = useState<TahapSheet>(awal),
    id = useId(),
    ref = useRef<HTMLElement>(null);
  const poGeser = useRef(false);
  const awalGeser = useRef<number | null>(null),
    tutup = useRef(onTutup);
  useEffect(() => {
    tutup.current = onTutup;
  }, [onTutup]);
  useEffect(() => {
    const sebelum = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        tutup.current();
      }
    };
    const el = ref.current;
    el?.addEventListener("keydown", escape);
    return () => {
      el?.removeEventListener("keydown", escape);
      if (sebelum?.isConnected) sebelum.focus({ preventScroll: true });
    };
  }, []);
  const tahap: TahapSheet[] = [25, 55, 92];
  return (
    <section
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby={id}
      className={`field-sheet ${halaman ? "avz-halaman avz-halaman-form" : ""} ${className}`}
      style={{ "--sheet-size": `${tinggi}dvh` } as React.CSSProperties}
    >
      {halaman ? (
        <header className="avz-halaman-kepala field-sheet-header">
          <button type="button" className="avenza-head-btn btn-icon-close" aria-label="Tutup panel" onClick={onTutup}>
            <ChevronDown size={26} />
          </button>
          <h2 id={id}>{judul}</h2>
          {aksiKanan}
        </header>
      ) : (
        <>
          <div className="field-sheet-grip-row">
            <button
              type="button"
              className="field-sheet-grip"
              aria-label={`Tinggi panel ${tinggi} persen. Ketuk untuk mengubah tinggi.`}
              onPointerDown={(e) => {
                poGeser.current = false;
                awalGeser.current = e.clientY;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={(e) => {
                const dy = e.clientY - (awalGeser.current ?? e.clientY);
                awalGeser.current = null;
                poGeser.current = Math.abs(dy) > 25;
                if (Math.abs(dy) > 25) setTinggi(tahap[Math.max(0, Math.min(2, tahap.indexOf(tinggi) + (dy < 0 ? 1 : -1)))]);
              }}
              onPointerCancel={() => {
                awalGeser.current = null;
                poGeser.current = false;
              }}
              onClick={(e) => {
                if (e.detail === 0 || !poGeser.current) setTinggi(tahap[(tahap.indexOf(tinggi) + 1) % 3]);
                poGeser.current = false;
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  setTinggi(tahap[Math.max(0, Math.min(2, tahap.indexOf(tinggi) + (e.key === "ArrowUp" ? 1 : -1)))]);
                }
              }}
            >
              <span aria-hidden="true" />
            </button>
            <div className="field-sheet-stops">
              {tahap.map((t) => (
                <button type="button" key={t} aria-label={`Panel ${t} persen`} aria-pressed={tinggi === t} onClick={() => setTinggi(t)}>
                  {t}%
                </button>
              ))}
            </div>
          </div>
          <header className="field-sheet-header">
            <h3 id={id}>{judul}</h3>
            <button type="button" className="btn-icon-close" aria-label="Tutup panel" onClick={onTutup}>
              <X size={20} />
            </button>
          </header>
        </>
      )}
      <div className="field-sheet-body">{children}</div>
    </section>
  );
}
