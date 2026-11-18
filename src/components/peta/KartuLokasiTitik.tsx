import React, { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Crosshair, Loader2 } from "lucide-react";
import { KoordinatTitik } from "../../types";
import { formatKoordinat, SistemKoordinat, uraikanTeksKoordinat } from "../../lib/sistemKoordinat";

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

/** Tiga sistem koordinat utama yang dapat diganti berurutan lewat tombol simbol atau swipe. */
export const SISTEM_SWIPE: SistemKoordinat[] = ["DD", "DMS", "UTM"];

const LABEL_SISTEM: Record<SistemKoordinat, string> = {
  DD: "DD",
  DMS: "DMS",
  DDM: "DDM",
  UTM: "UTM",
  TM3: "TM-3"
};

const CONTOH_SISTEM: Record<SistemKoordinat, string> = {
  DD: "Contoh: 2.857472, 117.377476",
  DMS: `Contoh: 2°51'26.9" LU, 117°22'38.9" BT`,
  DDM: "Contoh: 2°51.448' LU, 117°22.649' BT",
  UTM: "Contoh: UTM 50N 541982 315849",
  TM3: "Contoh: TM-3 50.1 381245 1815890"
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
  const [teksEdit, setTeksEdit] = useState("");
  const [sedangEdit, setSedangEdit] = useState(false);
  const [galatEdit, setGalatEdit] = useState("");
  const startXRef = useRef<number | null>(null);
  const lastSwipeMsRef = useRef<number>(0);

  const terformat = titik ? formatKoordinat(titik.lat, titik.lng, sistem) : null;
  const teksNilai = terformat ? terformat.salin : "";

  useEffect(() => {
    if (!sedangEdit) {
      setTeksEdit(teksNilai);
      setGalatEdit("");
    }
  }, [teksNilai, sedangEdit]);

  if (!titik) {
    return <p className="field-error">Belum ada titik.</p>;
  }

  const idxAktifRaw = SISTEM_SWIPE.indexOf(sistem);
  const idxAktif = idxAktifRaw >= 0 ? idxAktifRaw : 0;
  const sistemBerikut = SISTEM_SWIPE[(idxAktif + 1) % SISTEM_SWIPE.length];

  const geserSistem = (arah: 1 | -1) => {
    setSedangEdit(false);
    setGalatEdit("");
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

  const terapkanKoordinatLangsung = (teks: string, validasiAkhir: boolean) => {
    const hasil = uraikanTeksKoordinat(teks);
    if (!hasil) {
      if (validasiAkhir && teks.trim() !== teksNilai.trim()) {
        setGalatEdit(CONTOH_SISTEM[sistem]);
      }
      return false;
    }
    setGalatEdit("");
    onUbahKoordinat?.({ ...titik, lat: hasil.lat, lng: hasil.lng, akurasi: undefined });
    return true;
  };

  return (
    <div
      className="loc-card loc-card-field"
      role="region"
      aria-label={`Koordinat Titik (${LABEL_SISTEM[sistem]})`}
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).closest("input, button")) return;
        startXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => selesaiSentuh(e.changedTouches[0]?.clientX)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("input, button")) return;
        startXRef.current = e.clientX;
      }}
      onPointerUp={(e) => selesaiSentuh(e.clientX)}
    >
      <div className="loc-coord-label">
        <label htmlFor="input-koordinat-titik" className="loc-coord-label-text">
          Koordinat
        </label>
        <div className="loc-coord-row">
          <input
            id="input-koordinat-titik"
            type="text"
            className="form-input loc-coord-input"
            aria-label="Koordinat Titik"
            readOnly={!onUbahKoordinat}
            value={sedangEdit ? teksEdit : teksNilai}
            placeholder={CONTOH_SISTEM[sistem]}
            onFocus={() => {
              setSedangEdit(true);
              setTeksEdit(teksNilai);
            }}
            onChange={(e) => {
              const val = e.target.value;
              setTeksEdit(val);
              terapkanKoordinatLangsung(val, false);
            }}
            onBlur={() => {
              if (!terapkanKoordinatLangsung(teksEdit, true)) {
                setTeksEdit(teksNilai);
              }
              setSedangEdit(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (terapkanKoordinatLangsung(teksEdit, true)) {
                  setSedangEdit(false);
                  e.currentTarget.blur();
                }
              } else if (e.key === "ArrowLeft" && !sedangEdit) {
                e.preventDefault();
                geserSistem(-1);
              } else if (e.key === "ArrowRight" && !sedangEdit) {
                e.preventDefault();
                geserSistem(1);
              }
            }}
          />
          <button
            type="button"
            className="btn-media-simbol loc-action-simbol loc-format-btn"
            onClick={() => geserSistem(1)}
            aria-label={`Ganti format koordinat (${LABEL_SISTEM[sistem]})`}
            title={`Ganti format koordinat (${LABEL_SISTEM[sistem]} ke ${LABEL_SISTEM[sistemBerikut]})`}
          >
            <ArrowLeftRight size={20} />
          </button>
          {gpsSibuk ? (
            <button
              type="button"
              className="btn-media-simbol loc-action-simbol aktif"
              onClick={onBatalUkur}
              aria-label="Hentikan GPS"
              title={`Mengukur GPS (${sampel}/10)`}
            >
              <Loader2 size={20} className="spin" />
            </button>
          ) : (
            <button
              type="button"
              className="btn-media-simbol loc-action-simbol"
              onClick={onUkurGps}
              aria-label="Ukur GPS"
              title="Ukur ulang GPS rata-rata"
            >
              <Crosshair size={20} />
            </button>
          )}
        </div>
      </div>

      {gpsSibuk && (
        <span className="loc-hint" role="status">
          Mengukur GPS {sampel}/10…
        </span>
      )}
      {!gpsSibuk && infoAveraging && <span className="loc-hint">{infoAveraging}</span>}
      {(galatEdit || galatGps) && (
        <span className="field-error" role="alert">
          {galatEdit || galatGps}
        </span>
      )}
    </div>
  );
}
