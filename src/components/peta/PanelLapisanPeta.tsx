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
  onUbahPitch?: (pitch: number) => void;
  onUbahBearing?: (bearing: number) => void;
  onReset3D?: () => void;
  onPilihBasemap: (id: BasemapType) => void;
  onUnduhOffline: () => void;
  onPilihBerkas: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAlihDaftarObjek: () => void;
  onTutup: () => void;
}

/** Popover tombol Lapisan: pilihan peta dasar beserta lisensinya, perspektif 3D & rotasi, unduh offline, impor berkas, daftar objek */
export const PanelLapisanPeta: React.FC<PanelLapisanPetaProps> = ({
  basemap,
  jumlahObjek,
  tampilDaftarObjek,
  pitch = 0,
  bearing = 0,
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

    {/* PENGATURAN PERSPEKTIF 3D & ROTASI PETA */}
    <div className="map-3d-section">
      <div className="map-3d-header">
        <strong>Perspektif 3D & Rotasi Peta</strong>
        {(pitch > 0 || bearing !== 0) && (
          <button type="button" className="map-3d-reset-btn" onClick={onReset3D} title="Kembalikan ke tampilan 2D dan arah Utara">
            Reset 2D
          </button>
        )}
      </div>

      <div className="map-3d-mode-toggles">
        <button
          type="button"
          className={`map-3d-mode-btn ${pitch === 0 ? "active" : ""}`}
          onClick={() => onUbahPitch?.(0)}
        >
          2D Datar
        </button>
        <button
          type="button"
          className={`map-3d-mode-btn ${pitch > 0 ? "active" : ""}`}
          onClick={() => onUbahPitch?.(pitch > 0 ? pitch : 45)}
        >
          🏔️ 3D Perspektif
        </button>
      </div>

      <div className="map-3d-slider-row">
        <label htmlFor="input-pitch-peta">
          <span>Kemiringan 3D (Pitch)</span>
          <strong>{pitch}°</strong>
        </label>
        <input
          id="input-pitch-peta"
          type="range"
          min={0}
          max={60}
          step={5}
          value={pitch}
          onChange={(e) => onUbahPitch?.(Number(e.target.value))}
          className="map-3d-slider"
        />
      </div>

      <div className="map-3d-slider-row">
        <label htmlFor="input-bearing-peta">
          <span>Rotasi Peta (Arah Hadap)</span>
          <strong>{bearing}°</strong>
        </label>
        <input
          id="input-bearing-peta"
          type="range"
          min={0}
          max={359}
          step={5}
          value={bearing}
          onChange={(e) => onUbahBearing?.(Number(e.target.value))}
          className="map-3d-slider"
        />
      </div>

      <div className="map-3d-quick-rotations">
        <button type="button" className={`quick-rot-btn ${bearing === 0 ? "active" : ""}`} onClick={() => onUbahBearing?.(0)}>
          Utara (0°)
        </button>
        <button type="button" className={`quick-rot-btn ${bearing === 90 ? "active" : ""}`} onClick={() => onUbahBearing?.(90)}>
          Timur (90°)
        </button>
        <button type="button" className={`quick-rot-btn ${bearing === 180 ? "active" : ""}`} onClick={() => onUbahBearing?.(180)}>
          Selatan (180°)
        </button>
        <button type="button" className={`quick-rot-btn ${bearing === 270 ? "active" : ""}`} onClick={() => onUbahBearing?.(270)}>
          Barat (270°)
        </button>
      </div>

      <p className="map-3d-hint">
        ✌️ <strong>Tips Gestur:</strong> Angkat/geser 2 jari ke atas untuk memiringkan peta 3D. Putar 2 jari pada layar untuk memutar arah peta.
      </p>
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
