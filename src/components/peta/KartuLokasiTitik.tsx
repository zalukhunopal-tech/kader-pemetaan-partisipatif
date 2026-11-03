import React, { useEffect, useState } from "react";
import { Copy, Crosshair, Keyboard, Loader2 } from "lucide-react";
import { KoordinatTitik } from "../../types";
import {
  DAFTAR_SISTEM_KOORDINAT,
  formatKoordinat,
  isianDariTitik,
  IsianKoordinatManual,
  parseIsianManual,
  sistemInput,
  SistemKoordinat
} from "../../lib/sistemKoordinat";
import { mutuGps, PemilihSistemKoordinat } from "./ChipKoordinatPeta";

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

const TEKS_MUTU = { baik: "Akurasi baik", sedang: "Akurasi sedang", lemah: "Akurasi lemah", kosong: "Tanpa data akurasi" } as const;

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
  const [disalin, setDisalin] = useState(false);
  const mode = sistemInput(sistem);

  // Sinkronkan isian manual ketika titik / sistem berubah (mis. setelah ukur GPS)
  useEffect(() => {
    if (titik) setIsian(isianDariTitik(titik.lat, titik.lng, sistem));
    setGalat("");
  }, [titik?.lat, titik?.lng, sistem]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!titik) {
    return <p className="field-error">Belum ada titik. Arahkan bidikan di peta lalu buka form lagi.</p>;
  }

  const f = formatKoordinat(titik.lat, titik.lng, sistem);
  const mutu = mutuGps(titik.akurasi);
  const info = DAFTAR_SISTEM_KOORDINAT.find((s) => s.id === sistem)!;

  const terapkan = () => {
    const h = parseIsianManual(isian, sistem);
    if ("galat" in h) {
      setGalat(h.galat);
      return;
    }
    onUbahKoordinat?.({ lat: h.lat, lng: h.lng, timestamp: new Date().toISOString() });
    setManual(false);
  };

  const label =
    mode === "DD"
      ? ["Lintang (desimal)", "Bujur (desimal)", "contoh 2.857472", "contoh 117.377476"]
      : mode === "UTM"
        ? ["Timur / Easting (m)", "Utara / Northing (m)", "contoh 541932", "contoh 315890"]
        : ["X (m)", "Y (m)", "contoh 381245.20", "contoh 1815890.10"];

  return (
    <div className="loc-card" data-gps={mutu}>
      <div className="loc-card-head">
        <span className="loc-card-icon" aria-hidden="true">
          <Crosshair size={18} />
        </span>
        <div className="loc-card-head-text">
          <strong>Koordinat Titik</strong>
          <small>{f.keterangan}</small>
        </div>
        <span className={`loc-accuracy loc-accuracy-${mutu}`} title={TEKS_MUTU[mutu]}>
          {titik.akurasi !== undefined ? `±${titik.akurasi.toFixed(titik.akurasi < 10 ? 1 : 0)} m` : "—"}
        </span>
      </div>

      <div className="loc-values">
        {f.baris.map((b) => (
          <div key={b.label} className="loc-value">
            <span className="loc-value-label">{b.label}</span>
            <span className="loc-value-num">{b.nilai}</span>
          </div>
        ))}
        <button
          type="button"
          className="loc-copy"
          aria-label="Salin koordinat"
          onClick={() => {
            void navigator.clipboard?.writeText(f.salin).then(() => {
              setDisalin(true);
              window.setTimeout(() => setDisalin(false), 1500);
            });
          }}
        >
          <Copy size={14} /> {disalin ? "Disalin" : "Salin"}
        </button>
      </div>

      <div className="loc-crs">
        <span className="loc-crs-label">Sistem koordinat</span>
        <PemilihSistemKoordinat nilai={sistem} onPilih={onGantiSistem} />
        <small className="loc-crs-hint">{info.nama} · {info.keterangan}</small>
      </div>

      <div className="loc-actions">
        {gpsSibuk ? (
          <button type="button" className="loc-action loc-action-busy" onClick={onBatalUkur}>
            <Loader2 size={16} className="spin" /> Mengukur · {sampel} sampel — Batalkan
          </button>
        ) : (
          <button type="button" className="loc-action loc-action-primary" onClick={onUkurGps}>
            <Crosshair size={16} /> Ukur GPS 10 detik
          </button>
        )}
        {onUbahKoordinat && (
          <button
            type="button"
            className={`loc-action ${manual ? "aktif" : ""}`}
            aria-expanded={manual}
            onClick={() => setManual((v) => !v)}
          >
            <Keyboard size={16} /> Ketik manual
          </button>
        )}
      </div>
      <p className="loc-help">Berdiri diam saat mengukur; titik rata-rata menggantikan posisi bidikan.</p>
      {infoAveraging && (
        <p className="loc-status" role="status">
          {infoAveraging}
        </p>
      )}
      {galatGps && (
        <p className="field-error" role="alert">
          {galatGps}
        </p>
      )}

      {manual && (
        <div className="loc-manual">
          {mode !== "DD" && (
            <label>
              Zona {mode === "UTM" ? "UTM" : "TM-3"}
              <input
                className="form-input"
                value={isian.zona}
                placeholder={mode === "UTM" ? "50N" : "50.1"}
                onChange={(e) => setIsian((s) => ({ ...s, zona: e.target.value.toUpperCase() }))}
              />
            </label>
          )}
          <div className="form-row-2">
            <label>
              {label[0]}
              <input
                className="form-input"
                inputMode="decimal"
                value={isian.a}
                placeholder={label[2]}
                onChange={(e) => setIsian((s) => ({ ...s, a: e.target.value }))}
              />
            </label>
            <label>
              {label[1]}
              <input
                className="form-input"
                inputMode="decimal"
                value={isian.b}
                placeholder={label[3]}
                onChange={(e) => setIsian((s) => ({ ...s, b: e.target.value }))}
              />
            </label>
          </div>
          {(sistem === "DMS" || sistem === "DDM") && (
            <small className="loc-help">Untuk kemudahan di HP, isian manual memakai derajat desimal. Gunakan tanda minus untuk LS / BB.</small>
          )}
          {galat && (
            <p className="field-error" role="alert">
              {galat}
            </p>
          )}
          <div className="loc-manual-actions">
            <button type="button" className="btn-outline-sm" onClick={() => setManual(false)}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={terapkan}>
              Pakai koordinat ini
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
