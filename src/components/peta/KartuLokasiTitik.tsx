import React, { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, Pencil } from "lucide-react";
import { KoordinatTitik } from "../../types";
import {
  formatKoordinat,
  isianDariTitik,
  IsianKoordinatManual,
  parseIsianManual,
  sistemInput,
  SistemKoordinat
} from "../../lib/sistemKoordinat";

interface KartuLokasiTitikProps {
  titik?: KoordinatTitik;
  sistem: SistemKoordinat;
  onGantiSistem: (s: SistemKoordinat) => void;
  onUbahKoordinat?: (t: KoordinatTitik) => void;
  gpsSibuk: boolean;
  sampel: number;
  onUkurGps: () => void;
  onBatalUkur: () => void;
  infoAveraging?: string;
  galatGps?: string;
}

/** Tiga sistem koordinat utama yang dapat di-swipe secara berurutan pada kartu titik. */
export const SISTEM_SWIPE: SistemKoordinat[] = ["DD", "DMS", "UTM"];

const LABEL_DOT: Record<SistemKoordinat, string> = {
  DD: "DD",
  DMS: "DMS",
  DDM: "DDM",
  UTM: "UTM",
  TM3: "TM-3"
};

export function KartuLokasiTitik({
  titik,
  sistem,
  onGantiSistem,
  onUbahKoordinat,
  gpsSibuk,
  sampel,
  onUkurGps,
  onBatalUkur,
  infoAveraging,
  galatGps
}: KartuLokasiTitikProps) {
  const [manual, setManual] = useState(false);
  const [isian, setIsian] = useState<IsianKoordinatManual>({ a: "", b: "", zona: "" });
  const [galat, setGalat] = useState("");
  const startXRef = useRef<number | null>(null);
  const lastSwipeMsRef = useRef<number>(0);
  const mode = sistemInput(sistem);

  useEffect(() => {
    if (titik) setIsian(isianDariTitik(titik.lat, titik.lng, sistem));
    setGalat("");
  }, [titik?.lat, titik?.lng, sistem]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!titik) {
    return <p className="field-error">Belum ada titik.</p>;
  }

  const terformat = formatKoordinat(titik.lat, titik.lng, sistem);
  const idxAktifRaw = SISTEM_SWIPE.indexOf(sistem);
  const idxAktif = idxAktifRaw >= 0 ? idxAktifRaw : 0;

  const geserSistem = (arah: 1 | -1) => {
    const selanjutnya = SISTEM_SWIPE[(idxAktif + arah + SISTEM_SWIPE.length) % SISTEM_SWIPE.length];
    onGantiSistem(selanjutnya);
  };

  const selesaiSentuh = (akhirX: number | undefined) => {
    const awalX = startXRef.current;
    startXRef.current = null;
    if (awalX === null || akhirX === undefined) return;
    const selisih = akhirX - awalX;
    if (Math.abs(selisih) >= 24) {
      const sekarang = Date.now();
      if (sekarang - lastSwipeMsRef.current < 150) return;
      lastSwipeMsRef.current = sekarang;
      geserSistem(selisih < 0 ? 1 : -1);
    }
  };

    const terapkan = () => {
    const hasil = parseIsianManual(isian, sistem);
    if (!hasil) {
      setGalat(
        mode === "DD"
          ? "Contoh: -2.5124, 102.9876"
          : mode === "UTM"
            ? "Contoh: 541982, 315849, zona 50N"
            : "Contoh: 2 51 26.2 LU, 117 22 38.9 BT"
      );
      return;
    }
    setGalat("");
    setManual(false);
    onUbahKoordinat?.({ ...titik, ...hasil, akurasi: undefined });
  };

  return (
    <div className="loc-card loc-card-compact">
      <div
        className="loc-swipe-box"
        role="region"
        aria-label={`Koordinat Titik (${LABEL_DOT[sistem]})`}
        tabIndex={0}
        onTouchStart={(e) => {
          startXRef.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => selesaiSentuh(e.changedTouches[0]?.clientX)}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          startXRef.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if ((e.target as HTMLElement).closest("button")) {
            startXRef.current = null;
            return;
          }
          selesaiSentuh(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            geserSistem(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            geserSistem(-1);
          }
        }}
      >
        <div className="loc-swipe-row">
          <span className="loc-swipe-badge" aria-hidden="true">
            {LABEL_DOT[sistem]}
          </span>
          <strong className="loc-swipe-value" title={terformat.ringkas}>
            {terformat.ringkas}
          </strong>
          <div className="loc-swipe-actions">
            {gpsSibuk ? (
              <button
                type="button"
                className="loc-mini-icon-btn aktif"
                onClick={onBatalUkur}
                aria-label="Hentikan GPS"
                title={`Mengukur GPS (${sampel}/10)`}
              >
                <Loader2 size={15} className="spin" />
              </button>
            ) : (
              <button
                type="button"
                className="loc-mini-icon-btn"
                onClick={onUkurGps}
                aria-label="Ukur GPS"
                title="Ukur GPS rata-rata"
              >
                <Crosshair size={15} />
              </button>
            )}
            {onUbahKoordinat && (
              <button
                type="button"
                className={`loc-mini-icon-btn ${manual ? "aktif" : ""}`}
                onClick={() => setManual((v) => !v)}
                aria-label="Ubah koordinat manual"
                title="Ubah manual"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="loc-swipe-dots" role="tablist" aria-label="Pilih format koordinat">
          {SISTEM_SWIPE.map((idSistem, idx) => (
            <button
              key={idSistem}
              type="button"
              role="tab"
              aria-selected={idx === idxAktif}
              aria-label={`Format ${idSistem}`}
              title={idSistem}
              className={`loc-swipe-dot ${idx === idxAktif ? "aktif" : ""}`}
              onClick={() => onGantiSistem(idSistem)}
            />
          ))}
        </div>
      </div>

      {gpsSibuk && (
        <span className="loc-hint" role="status">
          GPS {sampel}/10…
        </span>
      )}
      {!gpsSibuk && infoAveraging && <span className="loc-hint">{infoAveraging}</span>}
      {galatGps && (
        <span className="field-error" role="alert">
          {galatGps}
        </span>
      )}

      {manual && onUbahKoordinat && (
        <div className="loc-manual-grid">
          {(mode === "UTM" || mode === "TM3") && (
            <input
              aria-label="Zona"
              className="form-input"
              placeholder={mode === "UTM" ? "Zona (50N)" : "Zona TM-3"}
              value={isian.zona}
              onChange={(e) => setIsian((s) => ({ ...s, zona: e.target.value }))}
            />
          )}
          <input
            aria-label={mode === "UTM" ? "Timur" : mode === "TM3" ? "X" : "Lintang"}
            className="form-input"
            placeholder={mode === "UTM" ? "Timur (E)" : mode === "TM3" ? "Koordinat X" : "Lintang"}
            value={isian.a}
            onChange={(e) => setIsian((s) => ({ ...s, a: e.target.value }))}
          />
          <input
            aria-label={mode === "UTM" ? "Utara" : mode === "TM3" ? "Y" : "Bujur"}
            className="form-input"
            placeholder={mode === "UTM" ? "Utara (N)" : mode === "TM3" ? "Koordinat Y" : "Bujur"}
            value={isian.b}
            onChange={(e) => setIsian((s) => ({ ...s, b: e.target.value }))}
          />
          {galat && (
            <p className="field-error" role="alert">
              {galat}
            </p>
          )}
          <div className="loc-manual-aksi">
            <button type="button" className="btn-outline-sm" onClick={() => setManual(false)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={terapkan}>
              Terapkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
