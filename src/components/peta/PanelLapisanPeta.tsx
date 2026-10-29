import React from "react";
import { Download, Eye, FileUp, X } from "lucide-react";
import { BasemapType } from "../../types";
import { SUMBER_TILE, URUTAN_BASEMAP, basemapTersedia } from "../../lib/petaOffline";
import { statusGoogle } from "../../lib/googleTiles";

interface PanelLapisanPetaProps {
  basemap: BasemapType;
  jumlahObjek: number;
  tampilDaftarObjek: boolean;
  pitch?: number;
  bearing?: number;
  modeIkutiKompas?: boolean;
  onAlihModeIkutiKompas?: () => void;
  onUbahPitch?: (pitch: number) => void;
  onUbahBearing?: (bearing: number) => void;
  onReset3D?: () => void;
  onPilihBasemap: (id: BasemapType) => void;
  onUnduhOffline: () => void;
  onPilihBerkas: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAlihDaftarObjek: () => void;
  onTutup: () => void;
}

function namaArahSingkat(deg: number): string {
  const norm = ((deg % 360) + 360) % 360;
  if (norm >= 337.5 || norm < 22.5) return "Utara (U)";
  if (norm < 67.5) return "Timur Laut (TL)";
  if (norm < 112.5) return "Timur (T)";
  if (norm < 157.5) return "Tenggara (TG)";
  if (norm < 202.5) return "Selatan (S)";
  if (norm < 247.5) return "Barat Daya (BD)";
  if (norm < 292.5) return "Barat (B)";
  return "Barat Laut (BL)";
}

/** Popover tombol Lapisan: pilihan peta dasar beserta lisensinya, perspektif 3D & rotasi, unduh offline, impor berkas, daftar objek */
export const PanelLapisanPeta: React.FC<PanelLapisanPetaProps> = ({
  basemap,
  jumlahObjek,
  tampilDaftarObjek,
  pitch = 0,
  bearing = 0,
  modeIkutiKompas = false,
  onAlihModeIkutiKompas,
  onUbahPitch,
  onUbahBearing,
  onReset3D,
  onPilihBasemap,
  onUnduhOffline,
  onPilihBerkas,
  onAlihDaftarObjek,
  onTutup
}) => (
  <div className="map-layers-popover">
    <div className="map-popover-head">
      <strong>Peta Dasar & Perspektif</strong>
      <button type="button" className="btn-icon-close" onClick={onTutup}>
        <X size={16} />
      </button>
    </div>

    <div className="map-basemap-grid">
      {URUTAN_BASEMAP.filter(basemapTersedia)
        .map((id) => ({
          id,
          label: id === "taktis" ? "🧭 Kontur" : `${id === "topo" ? "⛰️" : id === "osm" ? "🗺️" : "🛰️"} ${SUMBER_TILE[id].nama}`
        }))
        .map((b) => (
          <button
            key={b.id}
            type="button"
            className={`map-basemap-Option ${basemap === b.id ? "active" : ""}`}
            onClick={() => {
              onPilihBasemap(b.id);
            }}
          >
            {b.label}
          </button>
        ))}
    </div>
    {basemap !== "taktis" && (
      <p className="map-lisensi-info" id="info-lisensi-peta">
        <strong>Lisensi:</strong> {SUMBER_TILE[basemap].lisensi}
        {SUMBER_TILE[basemap].catatanPakai && <span className="map-catatan-pakai"> {SUMBER_TILE[basemap].catatanPakai}</span>}
        {basemap === "google" && statusGoogle().galat && (
          <span className="map-galat-sumber" role="alert">
            {" "}
            {statusGoogle().galat}
          </span>
        )}
      </p>
    )}

    {/* PENGATURAN PERSPEKTIF 3D & ROTASI PETA (AVENZA MAPS & GOOGLE EARTH STYLE) */}
    <div className="map-3d-section">
      <div className="map-3d-header">
        <strong>Navigasi 3D & Arah Peta</strong>
        {(pitch > 0 || bearing !== 0 || modeIkutiKompas) && (
          <button type="button" className="map-3d-reset-btn" onClick={onReset3D} title="Kembalikan ke tampilan 2D dan arah Utara">
            Reset 2D
          </button>
        )}
      </div>

      {/* KONTROL ROTASI & KOMPAS (AVENZA MAPS STYLE) */}
      <div className="map-3d-slider-row">
        <label htmlFor="input-bearing-peta">
          <span>Arah Hadap Peta (Rotasi)</span>
          <strong style={{ color: modeIkutiKompas ? "#10b981" : undefined }}>
            {bearing}° • {namaArahSingkat(bearing)}
          </strong>
        </label>
        <input
          id="input-bearing-peta"
          type="range"
          min={0}
          max={359}
          step={1}
          value={bearing}
          onChange={(e) => {
            onUbahBearing?.(Number(e.target.value));
          }}
          className="map-3d-slider"
        />
      </div>

      <div className="map-3d-quick-rotations">
        <button type="button" className={`quick-rot-btn ${bearing === 0 && !modeIkutiKompas ? "active" : ""}`} onClick={() => onUbahBearing?.(0)}>
          🧭 Utara (0°)
        </button>
        <button type="button" className={`quick-rot-btn ${bearing === 90 ? "active" : ""}`} onClick={() => onUbahBearing?.(90)}>
          ➡️ Timur (90°)
        </button>
        <button type="button" className={`quick-rot-btn ${bearing === 180 ? "active" : ""}`} onClick={() => onUbahBearing?.(180)}>
          ⬇️ Selatan (180°)
        </button>
        <button type="button" className={`quick-rot-btn ${bearing === 270 ? "active" : ""}`} onClick={() => onUbahBearing?.(270)}>
          ⬅️ Barat (270°)
        </button>
      </div>

      {onAlihModeIkutiKompas && (
        <button
          type="button"
          className={`btn-outline-sm compass-follow-toggle-btn ${modeIkutiKompas ? "active" : ""}`}
          onClick={onAlihModeIkutiKompas}
          title="Peta otomatis berputar mengikuti sensor kompas HP saat berjalan di lapangan (seperti Avenza Maps)"
        >
          🧭 {modeIkutiKompas ? "✓ Mode Kompas Sensor HP Aktif" : "Ikuti Sensor Kompas HP (Avenza Mode)"}
        </button>
      )}

      {/* KONTROL PERSPEKTIF 3D (GOOGLE EARTH STYLE) */}
      <div className="map-3d-slider-row" style={{ marginTop: 6 }}>
        <label htmlFor="input-pitch-peta">
          <span>Kemiringan 3D (Pitch)</span>
          <strong>{pitch}° {pitch === 0 ? "(2D Datar)" : pitch <= 30 ? "(Landai)" : pitch <= 45 ? "(3D Perspektif)" : "(Maksimal)"}</strong>
        </label>
        <input
          id="input-pitch-peta"
          type="range"
          min={0}
          max={60}
          step={2}
          value={pitch}
          onChange={(e) => onUbahPitch?.(Number(e.target.value))}
          className="map-3d-slider"
        />
      </div>

      <div className="map-3d-quick-rotations">
        <button type="button" className={`quick-rot-btn ${pitch === 0 ? "active" : ""}`} onClick={() => onUbahPitch?.(0)}>
          Datar 0°
        </button>
        <button type="button" className={`quick-rot-btn ${pitch === 25 ? "active" : ""}`} onClick={() => onUbahPitch?.(25)}>
          Landai 25°
        </button>
        <button type="button" className={`quick-rot-btn ${pitch === 45 ? "active" : ""}`} onClick={() => onUbahPitch?.(45)}>
          🏔️ 3D 45°
        </button>
        <button type="button" className={`quick-rot-btn ${pitch === 60 ? "active" : ""}`} onClick={() => onUbahPitch?.(60)}>
          Maks 60°
        </button>
      </div>

      <div className="map-3d-guide-card">
        <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
          <span>💡</span> <strong>Panduan Gestur Layar HP</strong>
        </div>
        <div>• <strong>Geser 2 Jari ke Atas/Bawah:</strong> Miringkan peta ke 3D horizon (Google Earth).</div>
        <div>• <strong>Putar 2 Jari Melingkar:</strong> Putar orientasi peta secara bebas (Avenza).</div>
        <div>• <strong>Cubit 2 Jari:</strong> Perbesar / perkecil peta.</div>
      </div>
    </div>

    <div className="map-popover-actions">
      <button
        type="button"
        className="btn-outline-sm"
        style={{ width: "100%" }}
        onClick={() => {
          onTutup();
          onUnduhOffline();
        }}
      >
        <Download size={14} /> Unduh Area Offline
      </button>

      <label className="btn-outline-sm" style={{ width: "100%", cursor: "pointer" }}>
        <FileUp size={14} /> Impor GeoJSON / KML / GPX
        <input type="file" accept=".geojson,.json,.kml,.gpx" style={{ display: "none" }} onChange={onPilihBerkas} />
      </label>

      {jumlahObjek > 0 && (
        <button
          type="button"
          className="btn-outline-sm"
          style={{ width: "100%" }}
          onClick={() => {
            onAlihDaftarObjek();
            onTutup();
          }}
        >
          <Eye size={14} /> {tampilDaftarObjek ? "Sembunyikan" : "Lihat"} Daftar Objek ({jumlahObjek})
        </button>
      )}
    </div>
  </div>
);
