import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, MapPin, Satellite, Search, Target, X } from "lucide-react";
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
/* Chip koordinat mengapung di peta dengan integrasi pencarian titik  */
/* ------------------------------------------------------------------ */

export interface SaranObjekPeta {
  id: string;
  judul: string;
  jenisGeometri: string;
  koordinat?: { lat: number; lng: number }[];
}

interface ChipKoordinatPetaProps {
  posisi: { lat: number; lng: number; akurasi?: number } | null;
  teksMenunggu: string;
  sistem: SistemKoordinat;
  onGantiSistem: (s: SistemKoordinat) => void;
  onSalin: (teks: string) => void;
  /** Teks durasi perekaman jalur/poligon, tampil sebagai badge REC */
  rekam?: string | null;
  /** Mode pencarian koordinat langsung di dalam chip */
  modeCari?: boolean;
  nilaiCariInput?: string;
  onUbahCariInput?: (nilai: string) => void;
  onSubmitCari?: (e?: React.FormEvent) => void;
  onTutupCari?: () => void;
  galatCari?: string;
  /** Titik koordinat hasil pencarian yang sedang dipilih (menimpa tampilan sementara) */
  koordinatDipilih?: { lat: number; lng: number; label?: string } | null;
  onPulihkanKoordinat?: () => void;
  /** Saran objek saat pengguna mengetik nama objek */
  daftarObjekSaran?: SaranObjekPeta[];
  onPilihObjekSaran?: (objek: SaranObjekPeta) => void;
}

export function ChipKoordinatPeta({
  posisi,
  teksMenunggu,
  sistem,
  onGantiSistem,
  onSalin,
  rekam,
  modeCari = false,
  nilaiCariInput = "",
  onUbahCariInput,
  onSubmitCari,
  onTutupCari,
  galatCari = "",
  koordinatDipilih = null,
  onPulihkanKoordinat,
  daftarObjekSaran = [],
  onPilihObjekSaran
}: ChipKoordinatPetaProps) {
  const [bukaPilih, setBukaPilih] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);
  const posisiAktif = koordinatDipilih ? { lat: koordinatDipilih.lat, lng: koordinatDipilih.lng, akurasi: undefined } : posisi;
  const mutu = koordinatDipilih ? "baik" : mutuGps(posisi?.akurasi);
  const f = posisiAktif ? formatKoordinat(posisiAktif.lat, posisiAktif.lng, sistem) : null;
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
      {modeCari ? (
        /* MODE INPUT PENCARIAN KOORDINAT DI TEMPAT CHIP */
        <div className="coord-chip mode-cari">
          <form
            className="coord-chip-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitCari?.(e);
            }}
          >
            <Search size={15} className="coord-chip-search-icon" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              className="coord-chip-search-input"
              aria-label="Titik koordinat atau nama objek"
              placeholder="Contoh: 2.857270, 117.377476"
              value={nilaiCariInput}
              onChange={(e) => onUbahCariInput?.(e.target.value)}
            />
            <button type="submit" className="coord-chip-search-submit">
              Cari
            </button>
            <button
              type="button"
              className="coord-chip-search-close"
              onClick={onTutupCari}
              title="Tutup pencarian"
              aria-label="Tutup pencarian peta"
            >
              <X size={15} />
            </button>
          </form>
        </div>
      ) : (
        /* MODE TELEMETRI CHIP KOORDINAT NORMAL */
        <div className="coord-chip">
          <button
            type="button"
            className="coord-chip-main"
            disabled={!f}
            onClick={() => f && onSalin(f.salin)}
            title={
              koordinatDipilih
                ? "Titik koordinat dipilih. Ketuk untuk menyalin, geser peta untuk pulih ke posisi GPS."
                : f
                ? "Ketuk untuk menyalin koordinat"
                : "Menunggu sinyal GPS"
            }
            aria-label={
              koordinatDipilih
                ? `Titik dipilih: ${f?.ringkas ?? ""}. Ketuk untuk menyalin.`
                : f
                ? `Koordinat ${f.ringkas}. Ketuk untuk menyalin`
                : teksMenunggu
            }
          >
            <span className="coord-chip-top">
              <span className="coord-chip-dot" aria-hidden="true" />
              {koordinatDipilih ? (
                <span className="coord-chip-selected-badge">
                  <Target size={11} aria-hidden="true" />
                  <span>{koordinatDipilih.label || "Titik Dipilih"}</span>
                  {onPulihkanKoordinat && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="coord-chip-pulihkan-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPulihkanKoordinat();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          onPulihkanKoordinat();
                        }
                      }}
                      title="Pulihkan ke koordinat posisi GPS terkini"
                      aria-label="Pulihkan ke koordinat posisi sekarang"
                    >
                      <X size={10} />
                    </span>
                  )}
                </span>
              ) : (
                <span className="coord-chip-label">
                  {mutu === "kosong" ? "Mencari GPS" : `GPS ±${Math.round(posisi!.akurasi!)} m`}
                </span>
              )}
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
      )}

      {galatCari && <div className="coord-chip-galat" role="alert">{galatCari}</div>}

      {/* DROPDOWN SARAN OBJEK SPASIAL SAAT PENCARIAN AKTIF */}
      {modeCari && daftarObjekSaran && daftarObjekSaran.length > 0 && (
        <div className="coord-chip-saran-box" role="listbox" aria-label="Saran objek peta">
          {daftarObjekSaran.map((obj) => (
            <button
              type="button"
              key={obj.id}
              className="coord-chip-saran-item"
              onClick={() => onPilihObjekSaran?.(obj)}
            >
              <MapPin size={13} aria-hidden="true" />
              <span>{obj.judul}</span>
              <small>{obj.jenisGeometri === "point" ? "Titik" : obj.jenisGeometri === "line" ? "Jalur" : "Area"}</small>
            </button>
          ))}
        </div>
      )}

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
