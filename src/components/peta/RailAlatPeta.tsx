import React from "react";
import { MapPin, Minus, Navigation, Plus, Route, Hexagon } from "lucide-react";
import { JenisGeometri } from "../../types";

interface RailAlatPetaProps {
  modeRekam: JenisGeometri | null;
  gpsTersedia: boolean;
  ikutiKompas?: boolean;
  modeIkutiGps?: "mati" | "posisi" | "kompas";
  onGps: () => void;
  onZoomMasuk: () => void;
  onZoomKeluar: () => void;
  onPilihAlat: (jenis: JenisGeometri) => void;
  /** Ketuk alat yang sedang aktif (mis. membuka kembali form titik) */
  onAlatAktif?: (jenis: JenisGeometri) => void;
}

const ALAT: { jenis: JenisGeometri; label: string; judul: string; Ikon: typeof MapPin }[] = [
  { jenis: "point", label: "Titik", judul: "Ambil titik lokasi (isi form)", Ikon: MapPin },
  { jenis: "line", label: "Jalur", judul: "Rekam jalur / tracking GPS", Ikon: Route },
  { jenis: "polygon", label: "Area", judul: "Buat poligon area", Ikon: Hexagon }
];

/**
 * Satu rail kontrol vertikal di kanan bawah peta:
 * GPS → Zoom (+ / −) → alat survei (Titik, Jalur, Area).
 * Semua tombol ≥ 48 px agar mudah dijangkau ibu jari dan tetap terbaca di bawah sinar matahari.
 */
export function RailAlatPeta({
  modeRekam,
  gpsTersedia,
  ikutiKompas,
  modeIkutiGps,
  onGps,
  onZoomMasuk,
  onZoomKeluar,
  onPilihAlat,
  onAlatAktif
}: RailAlatPetaProps) {
  const statusNav = modeIkutiGps ?? (ikutiKompas ? "kompas" : "mati");
  const kelasGps = statusNav === "kompas"
    ? "active active-ctrl mode-kompas"
    : statusNav === "posisi"
    ? "active mode-posisi"
    : "";

  return (
    <div className="map-hud-pod bottom-right map-tool-rail" role="toolbar" aria-label="Kontrol peta dan alat survei" aria-orientation="vertical">
      <div className="rail-group rail-gps">
        <button
          type="button"
          className={`map-hud-btn map-ctrl-btn rail-btn rail-gps-btn ${kelasGps}`}
          onClick={onGps}
          disabled={!gpsTersedia}
          style={gpsTersedia ? undefined : { opacity: 0.45 }}
          title={gpsTersedia ? "1x: pusatkan ke posisi saya · 2x: peta ikuti arah" : "Menunggu posisi GPS"}
          aria-label="Posisi saya (mencari lokasi terkini)"
        >
          <Navigation size={18} />
        </button>
      </div>

      <span className="rail-divider" aria-hidden="true" />

      <div className="rail-group rail-zoom">
        <button type="button" className="map-hud-btn map-ctrl-btn rail-btn" onClick={onZoomMasuk} title="Perbesar peta" aria-label="Perbesar peta">
          <Plus size={20} />
        </button>
        <button type="button" className="map-hud-btn map-ctrl-btn rail-btn" onClick={onZoomKeluar} title="Perkecil peta" aria-label="Perkecil peta">
          <Minus size={20} />
        </button>
      </div>

      <span className="rail-divider" aria-hidden="true" />

      <div className="rail-group rail-tools">
        {ALAT.map(({ jenis, label, judul, Ikon }) => {
          const aktif = modeRekam === jenis;
          const terkunci = Boolean(modeRekam) && !aktif;
          return (
            <button
              key={jenis}
              type="button"
              className={`map-hud-btn map-ctrl-btn rail-btn rail-tool rail-tool-${jenis} ${aktif ? "active" : ""}`}
              aria-pressed={aktif}
              disabled={terkunci}
              title={terkunci ? "Selesaikan atau batalkan rekaman yang sedang berjalan" : judul}
              onClick={() => (aktif ? onAlatAktif?.(jenis) : onPilihAlat(jenis))}
            >
              <Ikon size={18} />
              <span className="rail-tool-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
