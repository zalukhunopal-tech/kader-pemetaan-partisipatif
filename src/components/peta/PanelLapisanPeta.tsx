import React from "react";
import { BottomSheet } from "./BottomSheet";
import { Download, Eye, FileUp, Layers } from "lucide-react";
import { AreaPetaOffline, BasemapType } from "../../types";
import { URUTAN_BASEMAP, basemapTersedia } from "../../lib/petaOffline";

interface PanelLapisanPetaProps {
  basemap: BasemapType;
  jumlahObjek: number;
  tampilDaftarObjek: boolean;
  areaOffline?: AreaPetaOffline[];
  petaKustomAktif?: AreaPetaOffline | null;
  onPilihBasemap: (id: BasemapType) => void;
  onPilihPetaKustom?: (area: AreaPetaOffline) => void;
  onTutupPetaKustom?: () => void;
  onUnduhOffline: () => void;
  onPilihBerkas: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAlihDaftarObjek: () => void;
  onTutup: () => void;
}

/** Popover tombol Lapisan yang disederhanakan: pilihan peta dasar resolusi tinggi dan alat peta cepat */
export const PanelLapisanPeta: React.FC<PanelLapisanPetaProps> = ({
  basemap,
  jumlahObjek,
  tampilDaftarObjek,
  areaOffline = [],
  petaKustomAktif = null,
  onPilihBasemap,
  onPilihPetaKustom,
  onTutupPetaKustom,
  onUnduhOffline,
  onPilihBerkas,
  onAlihDaftarObjek,
  onTutup
}) => {
  const getBasemapBadge = (id: BasemapType) => {
    switch (id) {
      case "esri":
        return "Satelit Esri HD";
      case "google":
        return "Google Satelit HD";
      case "satelit":
        return "Citra Satelit";
      case "osm":
        return "Peta Jalan (OSM)";
      case "topo":
        return "Topografi";
      case "taktis":
        return "Kontur Taktis";
      default:
        return id;
    }
  };

  const getBasemapIcon = (id: BasemapType) => {
    switch (id) {
      case "esri":
      case "google":
      case "satelit":
        return "🛰️";
      case "topo":
        return "⛰️";
      case "osm":
        return "🗺️";
      case "taktis":
        return "🧭";
      default:
        return "📍";
    }
  };

  return (
    <BottomSheet judul="Pilihan Lapisan & Peta Dasar" onTutup={onTutup} className="field-layers-sheet">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: 6 }}>
          Peta Dasar Satelit / Vektor
        </div>
        <div className="map-basemap-grid" style={{ gridTemplateColumns: "1fr", gap: 6 }}>
          {URUTAN_BASEMAP.filter(basemapTersedia).map((id) => {
            const aktif = !petaKustomAktif && basemap === id;
            return (
              <button
                key={id}
                type="button"
                className={`map-basemap-Option ${aktif ? "active" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 10,
                  textAlign: "left"
                }}
                onClick={() => {
                  if (petaKustomAktif) onTutupPetaKustom?.();
                  onPilihBasemap(id);
                  onTutup();
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.1rem" }}>{getBasemapIcon(id)}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{getBasemapBadge(id)}</div>
                    <small style={{ opacity: 0.8, fontSize: "0.7rem", display: "block" }}>
                      {id === "esri"
                        ? "Resolusi tinggi Maxar, tajam & detail"
                        : id === "google"
                          ? "Citra satelit hybrid + label jalan"
                          : id === "osm"
                            ? "Peta jalan terbuka global"
                            : id === "topo"
                              ? "Kontur elevasi dan medan"
                              : "Gaya kontur offline"}
                    </small>
                  </div>
                </div>
                {aktif && <span style={{ color: "#10b981", fontWeight: 800, fontSize: "0.85rem" }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {areaOffline.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: 6 }}>
            Lembar Peta Kustom (GeoPDF / MBTiles)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {areaOffline.map((area) => {
              const aktif = petaKustomAktif?.id === area.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  className={`map-basemap-Option ${aktif ? "active" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 10,
                    textAlign: "left"
                  }}
                  onClick={() => {
                    onPilihPetaKustom?.(area);
                    onTutup();
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Layers size={18} style={{ color: "var(--brand-primary, #059669)" }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{area.namaArea}</div>
                      <small style={{ opacity: 0.8, fontSize: "0.7rem", display: "block" }}>
                        {area.jenisFile?.toUpperCase() || "PETA"} • {area.ukuranMb ? `${area.ukuranMb.toFixed(1)} MB` : "Tersimpan"}
                      </small>
                    </div>
                  </div>
                  {aktif && <span style={{ color: "#10b981", fontWeight: 800, fontSize: "0.85rem" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="map-popover-actions" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          type="button"
          className="btn-outline-sm"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => {
            onTutup();
            onUnduhOffline();
          }}
        >
          <Download size={14} /> Unduh Area Offline
        </button>

        <label className="btn-outline-sm" style={{ width: "100%", justifyContent: "center", cursor: "pointer" }}>
          <FileUp size={14} /> Impor GeoJSON / KML / GPX
          <input type="file" accept=".geojson,.json,.kml,.gpx" style={{ display: "none" }} onChange={onPilihBerkas} />
        </label>

        {jumlahObjek > 0 && (
          <button
            type="button"
            className="btn-outline-sm"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => {
              onAlihDaftarObjek();
              onTutup();
            }}
          >
            <Eye size={14} /> {tampilDaftarObjek ? "Sembunyikan" : "Lihat"} Daftar Objek ({jumlahObjek})
          </button>
        )}
      </div>
    </BottomSheet>
  );
};
