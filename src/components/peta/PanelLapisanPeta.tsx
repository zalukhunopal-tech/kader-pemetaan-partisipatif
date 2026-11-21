import React, { useState } from "react";
import { Eye, FileUp, Layers, X, MapPin, Trash2, Check } from "lucide-react";
import { AreaPetaOffline, BasemapType } from "../../types";
import { ringkasLabelCrs } from "../../lib/labelPeta";
import { URUTAN_BASEMAP, basemapTersedia } from "../../lib/petaOffline";

/** Nama peta dasar yang tampil di bilah judul peta dan daftar Lapisan */
export function namaBasemap(id: BasemapType): string {
  switch (id) {
    case "esri":
      return "Satelit Esri";
    case "google":
      return "Google Satelit";
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
}

function keteranganBasemap(id: BasemapType): string {
  switch (id) {
    case "esri":
      return "Citra Maxar resolusi tinggi";
    case "google":
      return "Citra satelit hybrid + label jalan";
    case "satelit":
      return "Sentinel-2 cloudless, 10 m";
    case "osm":
      return "Peta jalan terbuka global";
    case "topo":
      return "Kontur elevasi dan medan";
    default:
      return "Gaya kontur offline";
  }
}

/**
 * ATURAN BAKU PREVIEW PETA DASAR (WAJIB DIPERTAHANKAN PADA SETIAP REDESIGN):
 * Setiap pilihan peta dasar wajib menggunakan thumbnail potongan visual peta nyata
 * dari folder 'public/assets/basemaps/', BUKAN ikon grafis gradien abstrak atau emoji.
 */
export function pratinjauBasemap(id: BasemapType): string {
  const base = import.meta.env.BASE_URL;
  switch (id) {
    case "esri":
      return `${base}assets/basemaps/preview-esri.jpg`;
    case "google":
      return `${base}assets/basemaps/preview-google.jpg`;
    case "satelit":
      return `${base}assets/basemaps/preview-satelit.jpg`;
    case "osm":
      return `${base}assets/basemaps/preview-osm.png`;
    case "topo":
      return `${base}assets/basemaps/preview-topo.png`;
    case "taktis":
      return `${base}assets/basemaps/preview-taktis.svg`;
    default:
      return `${base}assets/basemaps/preview-esri.jpg`;
  }
}

/**
 * Fallback SVG inline (100% tersedia offline tanpa jaringan) bila aset gambar pratinjau
 * gagal dimuat atau cache browser terhapus saat perangkat offline.
 */
export function pratinjauBasemapFallback(id: BasemapType): string {
  const svg = (() => {
    switch (id) {
      case "google":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e4620"/><stop offset="55%" stop-color="#2e5e2e"/><stop offset="100%" stop-color="#17381a"/></linearGradient></defs><rect width="120" height="90" fill="url(#g)"/><path d="M0 62 Q40 44 82 58 T120 38" stroke="#f59e0b" stroke-width="3" fill="none" opacity="0.85"/><path d="M22 0 Q42 35 66 90" stroke="#e2e8f0" stroke-width="2" fill="none" opacity="0.7"/></svg>`;
      case "esri":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><defs><linearGradient id="e" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#12372a"/><stop offset="50%" stop-color="#1f4d36"/><stop offset="100%" stop-color="#0b241b"/></linearGradient></defs><rect width="120" height="90" fill="url(#e)"/><path d="M0 30 Q35 45 70 25 T120 50" stroke="#38bdf8" stroke-width="3.5" fill="none" opacity="0.55"/><circle cx="78" cy="58" r="18" fill="#166534" opacity="0.65"/></svg>`;
      case "satelit":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a4331"/><stop offset="100%" stop-color="#0f2d22"/></linearGradient></defs><rect width="120" height="90" fill="url(#s)"/><path d="M10 80 Q50 50 110 20" stroke="#4ade80" stroke-width="2" fill="none" opacity="0.45"/><path d="M0 40 Q55 60 120 42" stroke="#0ea5e9" stroke-width="2.5" fill="none" opacity="0.5"/></svg>`;
      case "osm":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#f2efe9"/><rect x="12" y="10" width="34" height="24" rx="4" fill="#cdebb0"/><rect x="74" y="48" width="38" height="32" rx="4" fill="#cdebb0"/><path d="M0 42 L120 34 M48 0 L62 90" stroke="#ffffff" stroke-width="6" fill="none"/><path d="M0 42 L120 34 M48 0 L62 90" stroke="#f59e0b" stroke-width="2.2" fill="none"/></svg>`;
      case "topo":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#eef3e6"/><path d="M-10 72 Q30 48 65 62 T130 40" stroke="#a3b18a" stroke-width="1.6" fill="none"/><path d="M-10 52 Q35 28 70 42 T130 20" stroke="#84996e" stroke-width="1.6" fill="none"/><path d="M-10 32 Q35 12 72 24 T130 6" stroke="#6b8057" stroke-width="1.6" fill="none"/></svg>`;
      default:
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#0f172a"/><path d="M0 68 Q40 46 80 62 T120 44" stroke="#334155" stroke-width="1.5" fill="none"/><path d="M0 42 Q40 24 80 38 T120 22" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.7"/></svg>`;
    }
  })();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface PanelLapisanPetaProps {
  basemap: BasemapType;
  jumlahObjek: number;
  tampilDaftarObjek: boolean;
  onPilihBasemap: (id: BasemapType) => void;
  onUnduhOffline?: () => void;
  onPilihBerkas: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAlihDaftarObjek: () => void;
  onTutup: () => void;
  areaOffline?: AreaPetaOffline[];
  petaKustomAktif?: AreaPetaOffline | null;
  onPilihPetaKustom?: (area: AreaPetaOffline) => void;
  onTutupPetaKustom?: () => void;
  onHapusAreaOffline?: (id: string) => void;
  center?: { lat: number; lng: number };
}

export const PanelLapisanPeta: React.FC<PanelLapisanPetaProps> = ({
  basemap,
  jumlahObjek,
  tampilDaftarObjek,
  onPilihBasemap,
  onPilihBerkas,
  onAlihDaftarObjek,
  onTutup,
  areaOffline = [],
  petaKustomAktif,
  onPilihPetaKustom,
  onTutupPetaKustom,
  onHapusAreaOffline,
  center
}) => {
  const [tabAktif, setTabAktif] = useState<"peta_dasar" | "lapisan_berkas" | "pustaka">("peta_dasar");

  const apakahDiDalamPeta = (area: AreaPetaOffline): boolean => {
    if (!center) return false;
    return (
      center.lat >= area.minLat &&
      center.lat <= area.maxLat &&
      center.lng >= area.minLng &&
      center.lng <= area.maxLng
    );
  };

  return (
    <div className="map-layers-popover avenza-layers-modal avenza-layer-studio-redesign">
      {/* HEADER POPOVER DENGAN TAB HORIZONTAL LEBAR */}
      <div className="map-popover-head">
        <div className="avz-lapisan-kepala">
          <Layers size={18} aria-hidden="true" />
          <span>Lapisan Peta</span>
        </div>
        <button type="button" className="btn-icon-close" onClick={onTutup} aria-label="Tutup Panel">
          <X size={16} />
        </button>
      </div>

      {/* HORIZONTAL TAB BAR DENGAN WHITE-SPACE NOWRAP & SATU KATA */}
      <div className="pustaka-tabs-header-bar">
        <button
          type="button"
          className={`pustaka-tab-nav-btn ${tabAktif === "peta_dasar" ? "active" : ""}`}
          onClick={() => setTabAktif("peta_dasar")}
          title="Peta dasar online"
        >
          Dasar
        </button>
        <button
          type="button"
          className={`pustaka-tab-nav-btn ${tabAktif === "lapisan_berkas" ? "active" : ""}`}
          onClick={() => setTabAktif("lapisan_berkas")}
          title="Lapisan berkas"
        >
          <span className="pustaka-tab-label-full">Berkas</span>
          <span className="pustaka-tab-label-short">Berkas</span>
        </button>
        <button
          type="button"
          className={`pustaka-tab-nav-btn ${tabAktif === "pustaka" ? "active" : ""}`}
          onClick={() => setTabAktif("pustaka")}
          title="Pustaka peta offline"
        >
          Pustaka ({areaOffline.length})
        </button>
      </div>

      {/* KONTEN TAB 1: PETA DASAR */}
      {tabAktif === "peta_dasar" && (
        <div className="pustaka-tab-content-panel">
          <p className="avz-lapisan-judul-seksi">Peta dasar online</p>
          <div className="map-basemap-grid avz-daftar-basemap" role="radiogroup" aria-label="Peta dasar">
            {URUTAN_BASEMAP.filter(basemapTersedia).map((id) => {
              const aktif = basemap === id && !petaKustomAktif;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={aktif}
                  className={`map-basemap-Option avz-basemap-baris ${aktif ? "active" : ""}`}
                  onClick={() => {
                    onTutupPetaKustom?.();
                    onPilihBasemap(id);
                  }}
                >
                  <span className={`avz-basemap-thumb thumb-${id}`} aria-hidden="true">
                    <img
                      src={pratinjauBasemap(id)}
                      alt=""
                      className="avz-basemap-thumb-img"
                      loading="eager"
                      decoding="async"
                      onError={(e) => {
                        const fallback = pratinjauBasemapFallback(id);
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                    />
                  </span>
                  <span className="avz-basemap-teks">
                    <strong>{namaBasemap(id)}</strong>
                    <small>{keteranganBasemap(id)}</small>
                  </span>
                  <span className={`avz-radio ${aktif ? "aktif" : ""}`} aria-hidden="true">
                    {aktif && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* KONTEN TAB 2: LAPISAN BERKAS */}
      {tabAktif === "lapisan_berkas" && (
        <div className="pustaka-tab-content-panel">
          <div className="map-popover-actions" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <label className="btn-outline-sm" style={{ width: "100%", justifyContent: "center", cursor: "pointer", whiteSpace: "nowrap" }}>
              <FileUp size={14} /> Impor GeoJSON / KML / GPX
              <input type="file" accept=".geojson,.json,.kml,.gpx" style={{ display: "none" }} onChange={onPilihBerkas} />
            </label>

            {jumlahObjek > 0 && (
              <button
                type="button"
                className="btn-outline-sm"
                style={{ width: "100%", justifyContent: "center", whiteSpace: "nowrap" }}
                onClick={() => {
                  onAlihDaftarObjek();
                  onTutup();
                }}
              >
                <Eye size={14} /> {tampilDaftarObjek ? "Sembunyikan" : "Lihat"} Objek Lapangan ({jumlahObjek})
              </button>
            )}
          </div>
        </div>
      )}

      {/* KONTEN TAB 3: PUSTAKA PETA OFFLINE */}
      {tabAktif === "pustaka" && (
        <div className="pustaka-tab-content-panel">
          <div className="pustaka-card-list-scroll">
            {areaOffline.map((item) => {
              const sedangAktif = petaKustomAktif?.id === item.id;
              const diDalam = apakahDiDalamPeta(item);

              return (
                <div key={item.id} className={`pustaka-offline-item-card ${sedangAktif ? "active-map" : ""}`}>
                  {/* BARIS ATAS: JUDUL & FORMAT BADGE */}
                  <div className="pustaka-card-top-flex">
                    <strong className="pustaka-card-title" title={item.namaArea}>
                      {item.namaArea}
                    </strong>
                    <span className="pustaka-format-chip">{item.jenisFile || "GeoPDF"}</span>
                  </div>

                  {/* BARIS TENGAH: METADATA PILLS HORIZONTAL */}
                  <div className="pustaka-card-meta-pills">
                    <span className="pustaka-meta-pill">{item.ukuranMb.toFixed(1).replace(".", ",")} MB</span>
                    {item.crs && (
                      <span className="pustaka-meta-pill crs-pill" title={item.crsDeskripsi || item.crs}>
                        {ringkasLabelCrs(item.crs, 20)}
                      </span>
                    )}
                    {diDalam ? (
                      <span className="pustaka-meta-pill on-map-pill">
                        <Check size={11} /> Di Dalam Peta
                      </span>
                    ) : item.jarakKm !== undefined && item.jarakKm > 0 ? (
                      <span className="pustaka-meta-pill dist-pill">{item.jarakKm.toFixed(1)} km</span>
                    ) : (
                      <span className="pustaka-meta-pill ready-pill">Tersimpan</span>
                    )}
                  </div>

                  {/* BARIS BAWAH: ACTION BUTTONS HORIZONTAL */}
                  <div className="pustaka-card-actions-bar">
                    <button
                      type="button"
                      className={`btn-pustaka-action ${sedangAktif ? "active" : ""}`}
                      onClick={() => {
                        if (sedangAktif) {
                          onTutupPetaKustom?.();
                        } else {
                          onPilihPetaKustom?.(item);
                        }
                      }}
                      title={sedangAktif ? "Tutup Lembar Peta" : "Buka Lembar Peta"}
                    >
                      <MapPin size={13} />
                      <span>{sedangAktif ? "Tutup" : "Buka"}</span>
                    </button>

                    {onHapusAreaOffline && (
                      <button
                        type="button"
                        className="btn-pustaka-action danger"
                        onClick={() => onHapusAreaOffline(item.id)}
                        title="Hapus peta dari perangkat"
                      >
                        <Trash2 size={13} />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {areaOffline.length === 0 && (
              <div className="pustaka-empty-notice">
                <p>Belum ada peta kerja offline yang disimpan.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
