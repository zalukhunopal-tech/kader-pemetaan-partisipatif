import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Satellite } from "lucide-react";
import { DAFTAR_SISTEM_KOORDINAT, formatKoordinat, SistemKoordinat } from "../../lib/sistemKoordinat";

/** Kelas mutu sinyal GPS berdasarkan akurasi horizontal (meter). */
export function mutuGps(akurasi?: number): "baik" | "sedang" | "lemah" | "kosong" {
  if (akurasi === undefined || !Number.isFinite(akurasi)) return "kosong";
  if (akurasi < 10) return "baik";
  if (akurasi <= 25) return "sedang";
  return "lemah";
}

/* ------------------------------------------------------------------ */
/* Pemilih sistem koordinat (segmented chips)                           */
/* ------------------------------------------------------------------ */

interface PemilihSistemProps {
  nilai: SistemKoordinat;
  onPilih: (s: SistemKoordinat) => void;
  /** "chip" = baris ringkas (di form), "daftar" = kartu dengan contoh & keterangan (popover peta) */
  varian?: "chip" | "daftar";
}

export function PemilihSistemKoordinat({ nilai, onPilih, varian = "chip" }: PemilihSistemProps) {
  if (varian === "chip") {
    return (
      <div className="crs-chip-row" role="radiogroup" aria-label="Sistem koordinat">
        {DAFTAR_SISTEM_KOORDINAT.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={nilai === s.id}
            className={`crs-chip ${nilai === s.id ? "aktif" : ""}`}
            title={`${s.nama} · ${s.keterangan}`}
            onClick={() => onPilih(s.id)}
          >
            {s.singkat}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="crs-list" role="radiogroup" aria-label="Sistem koordinat">
      {DAFTAR_SISTEM_KOORDINAT.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={nilai === s.id}
          className={`crs-list-item ${nilai === s.id ? "aktif" : ""}`}
          onClick={() => onPilih(s.id)}
        >
          <span className="crs-list-badge">{s.singkat}</span>
          <span className="crs-list-text">
            <strong>{s.nama}</strong>
            <small>{s.keterangan}</small>
            <code>{s.contoh}</code>
          </span>
          {nilai === s.id && <Check size={18} className="crs-list-check" />}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chip koordinat mengapung di peta                                     */
/* ------------------------------------------------------------------ */

interface ChipKoordinatPetaProps {
  posisi: { lat: number; lng: number; akurasi?: number } | null;
  teksMenunggu: string;
  sistem: SistemKoordinat;
  onGantiSistem: (s: SistemKoordinat) => void;
  onSalin: (teks: string) => void;
  /** Teks durasi perekaman jalur/poligon, tampil sebagai badge REC */
  rekam?: string | null;
}

export function ChipKoordinatPeta({ posisi, teksMenunggu, sistem, onGantiSistem, onSalin, rekam }: ChipKoordinatPetaProps) {
  const [bukaPilih, setBukaPilih] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);
  const mutu = mutuGps(posisi?.akurasi);
  const f = posisi ? formatKoordinat(posisi.lat, posisi.lng, sistem) : null;
  const info = DAFTAR_SISTEM_KOORDINAT.find((s) => s.id === sistem)!;

  useEffect(() => {
    if (!bukaPilih) return;
    const tutup = (e: PointerEvent) => {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setBukaPilih(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setBukaPilih(false);
    document.addEventListener("pointerdown", tutup);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", tutup);
      document.removeEventListener("keydown", esc);
    };
  }, [bukaPilih]);

  return (
    <div className="coord-chip-wrap" ref={wadah} data-gps={mutu}>
      <div className="coord-chip">
        <button
          type="button"
          className="coord-chip-main"
          disabled={!f}
          onClick={() => f && onSalin(f.salin)}
          title={f ? "Ketuk untuk menyalin koordinat" : "Menunggu sinyal GPS"}
          aria-label={f ? `Koordinat ${f.ringkas}. Ketuk untuk menyalin` : teksMenunggu}
        >
          <span className="coord-chip-top">
            <span className="coord-chip-dot" aria-hidden="true" />
            <span className="coord-chip-label">
              {mutu === "kosong" ? "Mencari GPS" : `GPS ±${Math.round(posisi!.akurasi!)} m`}
            </span>
            {f && <span className="coord-chip-meta">{f.keterangan}</span>}
          </span>
          {f ? (
            <span className="coord-chip-values field-telemetry-coordinate">
              <span>{f.baris[0].nilai}</span>
              <span>{f.baris[1].nilai}</span>
            </span>
          ) : (
            <span className="coord-chip-values coord-chip-waiting">
              <Satellite size={13} /> {teksMenunggu}
            </span>
          )}
          {f && <Copy size={12} className="coord-chip-copy" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="coord-chip-crs"
          aria-haspopup="true"
          aria-expanded={bukaPilih}
          aria-label={`Sistem koordinat: ${info.nama}. Ketuk untuk mengganti`}
          onClick={() => setBukaPilih((v) => !v)}
        >
          {info.singkat}
          <ChevronDown size={12} />
        </button>
      </div>
      {rekam && <span className="coord-chip-rec">● REC {rekam}</span>}

      {bukaPilih && (
        <div className="coord-crs-popover" role="dialog" aria-label="Pilih sistem koordinat">
          <div className="coord-crs-popover-head">
            <strong>Sistem Koordinat</strong>
            <small>Berlaku untuk tampilan peta & form titik</small>
          </div>
          <PemilihSistemKoordinat
            varian="daftar"
            nilai={sistem}
            onPilih={(s) => {
              onGantiSistem(s);
              setBukaPilih(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
