import React from "react";
import { Download, Eye, FileUp, X } from "lucide-react";
import { BasemapType } from "../../types";
import { SUMBER_TILE, URUTAN_BASEMAP, basemapTersedia } from "../../lib/petaOffline";
import { statusGoogle } from "../../lib/googleTiles";

interface PanelLapisanPetaProps {
  basemap: BasemapType;
  jumlahObjek: number;
  tampilDaftarObjek: boolean;
  onPilihBasemap: (id: BasemapType) => void;
  onUnduhOffline: () => void;
  onPilihBerkas: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAlihDaftarObjek: () => void;
  onTutup: () => void;
}

/** Popover tombol Lapisan: pilihan peta dasar beserta lisensinya, unduh offline, impor berkas, daftar objek */
export const PanelLapisanPeta: React.FC<PanelLapisanPetaProps> = ({
  basemap,
  jumlahObjek,
  tampilDaftarObjek,
  onPilihBasemap,
  onUnduhOffline,
  onPilihBerkas,
  onAlihDaftarObjek,
  onTutup
}) => (
  <div className="map-layers-popover">
    <div className="map-popover-head">
      <strong>Peta</strong>
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
              onTutup();
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
