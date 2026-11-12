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
 * Kontrol peta gaya Avenza Maps:
 * - Bilah alat bawah selebar peta: Lokasi (GPS) → Titik → Jalur → Area, ikon dengan label.
 * - Pod zoom (+ / −) mengapung di kanan, tepat di atas bilah alat.
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
  const kelasGps = statusNav === "kompas" ? "active active-ctrl mode-kompas" : statusNav === "posisi" ? "active mode-posisi" : "";
  const labelGps = statusNav === "kompas" ? "Arah" : statusNav === "posisi" ? "Ikuti" : "Lokasi";

  return (
    <div className="map-tool-rail avz-toolbar" role="toolbar" aria-label="Kontrol peta dan alat survei" aria-orientation="horizontal">
      <div className="rail-group rail-zoom avz-zoom-pod">
        <button
          type="button"
          className="map-hud-btn map-ctrl-btn rail-btn"
          onClick={onZoomMasuk}
          title="Perbesar peta"
          aria-label="Perbesar peta"
        >
          <Plus size={20} />
        </button>
        <span className="avz-zoom-sekat" aria-hidden="true" />
        <button
          type="button"
          className="map-hud-btn map-ctrl-btn rail-btn"
          onClick={onZoomKeluar}
          title="Perkecil peta"
          aria-label="Perkecil peta"
        >
          <Minus size={20} />
        </button>
      </div>

      <div className="avz-toolbar-baris">
        <div className="rail-group rail-gps">
          <button
            type="button"
            className={`map-hud-btn map-ctrl-btn rail-btn rail-tool rail-gps-btn ${kelasGps}`}
            onClick={onGps}
            disabled={!gpsTersedia}
            title={gpsTersedia ? "1x: pusatkan ke posisi saya · 2x: peta ikuti arah" : "Menunggu posisi GPS"}
            aria-label="Posisi saya (mencari lokasi terkini)"
          >
            <span className="avz-ikon-wadah">
              <Navigation size={20} />
            </span>
            <span className="rail-tool-label">{labelGps}</span>
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
                <span className="avz-ikon-wadah">
                  <Ikon size={20} />
                  {aktif && jenis !== "point" && <span className="avz-rec-titik" aria-hidden="true" />}
                </span>
                <span className="rail-tool-label">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
