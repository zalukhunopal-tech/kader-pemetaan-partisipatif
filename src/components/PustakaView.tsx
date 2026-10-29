import React, { useState } from "react";
import { AreaPetaOffline, DataSpasialItem, LapisanSpasial } from "../types";
import { buatId } from "../lib/id";
import { LatarPetaDasar } from "./LatarPetaDasar";
import { AlertOctagon, AlertTriangle, ArrowUpDown, Check, ChevronDown, Download, Eye, FileText, FileUp, Filter, Layers, Map as MapIcon, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { bacaMetadataBerkasPeta, HasilMetadataPeta } from "../lib/metaPeta";

interface PustakaViewProps {
  areaOffline: AreaPetaOffline[];
  lapisanList: LapisanSpasial[];
  dataSpasial: DataSpasialItem[];
  modePilihAktif: boolean;
  onMatikanModePilih: () => void;
  onBukaPetaDasar: () => void;
  onBukaAreaPeta: (area: AreaPetaOffline) => void;
  onTambahAreaOffline: (area: AreaPetaOffline) => void;
  onHapusAreaOffline: (id: string) => void;
  onTambahLapisan: (lapisan: LapisanSpasial) => void;
  onHapusLapisan: (id: string) => void;
  onImporBerkas: (namaBerkas: string, isi: string) => boolean;
  onBukaPengaturanEkspor: () => void;
}

/**
 * Komponen thumbnail netral dokumen peta georeferensi.
 */
export const ThumbnailDokumenPeta: React.FC<{ size?: number }> = ({ size = 52 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "8px",
      background: "#f1f5f9",
      border: "1px solid #cbd5e1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#059669",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      flexShrink: 0
    }}
    aria-label="Dokumen Lembar Peta"
  >
    <MapIcon size={Math.round(size * 0.46)} />
  </div>
);

export const PustakaView: React.FC<PustakaViewProps> = ({
  areaOffline,
  lapisanList,
  dataSpasial,
  modePilihAktif,
  onMatikanModePilih,
  onBukaPetaDasar,
  onBukaAreaPeta,
  onTambahAreaOffline,
  onHapusAreaOffline,
  onTambahLapisan,
  onHapusLapisan,
  onImporBerkas,
  onBukaPengaturanEkspor
}) => {
  const [subTab, setSubTab] = useState<"peta" | "lapisan">("peta");
  const [urutPeta, setUrutPeta] = useState<"baru_dilihat" | "nama" | "ukuran">("baru_dilihat");
  const [urutLapisan, setUrutLapisan] = useState<"terbaru" | "nama">("terbaru");
  const [filterItem, setFilterItem] = useState<"semua" | "geopdf" | "tiles">("semua");
  const [cariTerbuka, setCariTerbuka] = useState(false);
  const [kataKunci, setKataKunci] = useState("");
  const [idTerpilih, setIdTerpilih] = useState<string[]>([]);
  const [menuItemTerbuka, setMenuItemTerbuka] = useState<string | null>(null);

  // Modal Tambah Peta Baru / Buat Lapisan Baru (tanpa nilai contoh)
  const [bukaModalPetaBaru, setBukaModalPetaBaru] = useState(false);
  const [namaPetaBaru, setNamaPetaBaru] = useState("");
  const [ukuranMbBaru, setUkuranMbBaru] = useState("");
  const [jarakKmBaru, setJarakKmBaru] = useState("");
  const [metadataPetaBaru, setMetadataPetaBaru] = useState<HasilMetadataPeta | null>(null);
  const [petaKustomDataUrlBaru, setPetaKustomDataUrlBaru] = useState<string | undefined>(undefined);
  const [sedangMemprosesBerkas, setSedangMemprosesBerkas] = useState(false);

  const [galatImpor, setGalatImpor] = useState("");
  const [rasterGeoreferensi, setRasterGeoreferensi] = useState(false);

  const [bukaModalLapisanBaru, setBukaModalLapisanBaru] = useState(false);
  const [namaLapisanBaru, setNamaLapisanBaru] = useState("");
  const [petaPratinjauAktif, setPetaPratinjauAktif] = useState<AreaPetaOffline | null>(null);

  const hitungObjekLapisan = (lapisan: LapisanSpasial): number => {
    return dataSpasial.filter((d) => d.kategori === lapisan.kategoriDefault).length;
  };

  const daftarPetaTampil = areaOffline
    .filter((a) => {
      if (kataKunci.trim() && !a.namaArea.toLowerCase().includes(kataKunci.toLowerCase())) {
        return false;
      }
      if (filterItem === "geopdf") return a.jenisFile === "GeoPDF / GeoTIFF";
      if (filterItem === "tiles") return a.jenisFile === "XYZ Tiles";
      return true;
    })
    .sort((a, b) => {
      if (urutPeta === "nama") return a.namaArea.localeCompare(b.namaArea);
      if (urutPeta === "ukuran") return b.ukuranMb - a.ukuranMb;
      return new Date(b.diunduhPada).getTime() - new Date(a.diunduhPada).getTime();
    });

  const daftarLapisanTampil = lapisanList
    .filter((l) => (kataKunci.trim() ? l.nama.toLowerCase().includes(kataKunci.toLowerCase()) : true))
    .sort((a, b) => {
      if (urutLapisan === "nama") return a.nama.localeCompare(b.nama);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const togglePilihId = (id: string) => {
    setIdTerpilih((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handlePilihBerkasPeta = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setSedangMemprosesBerkas(true);

    setGalatImpor("");
    setMetadataPetaBaru(null);
    setPetaKustomDataUrlBaru(undefined);
    setRasterGeoreferensi(false);
    try {
      if (!/\.(pdf|geopdf)$/i.test(file.name))
        throw new Error(
          "Impor raster saat ini mendukung GeoPDF EPSG:4326. Untuk data vektor gunakan Impor Lapisan (GeoJSON/KML/GPX). Konversi GeoTIFF/MBTiles ke GeoPDF melalui GIS terlebih dahulu."
        );
      const { imporGeoPdf } = await import("../lib/geoPdf");
      const hasil = await imporGeoPdf(file);
      const ukuranMb = file.size / (1024 * 1024);
      const meta: HasilMetadataPeta = {
        ...hasil,
        namaArea: file.name,
        ukuranMb,
        ukuranMbTeks: ukuranMb.toFixed(1).replace(".", ","),
        jarakKm: 0,
        jarakKmTeks: "0",
        jenisFile: "GeoPDF / GeoTIFF",
        thumbnailType: "geopdf_sheet",
        sumberDeteksi: "geopdf",
        crs: "EPSG:4326 (WGS 84)",
        lebarPixel: hasil.width,
        tinggiPixel: hasil.height
      };
      setMetadataPetaBaru(meta);
      setNamaPetaBaru(meta.namaArea);
      setUkuranMbBaru(meta.ukuranMbTeks);
      setJarakKmBaru("0");
      setPetaKustomDataUrlBaru(hasil.dataUrl);
      setRasterGeoreferensi(true);
    } catch (err) {
      setGalatImpor(err instanceof Error ? err.message : "Berkas peta gagal dibaca.");
    } finally {
      setSedangMemprosesBerkas(false);
      input.value = "";
    }
  };

  const handleSimpanPetaBaru = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaPetaBaru.trim() || !metadataPetaBaru || !petaKustomDataUrlBaru || sedangMemprosesBerkas || galatImpor) return;
    const itemBaru: AreaPetaOffline = {
      id: buatId("MAP-OFF"),
      namaArea: namaPetaBaru.trim(),
      basemapId: "topo",
      minLat: metadataPetaBaru.minLat,
      maxLat: metadataPetaBaru.maxLat,
      minLng: metadataPetaBaru.minLng,
      maxLng: metadataPetaBaru.maxLng,
      zoomMin: 11,
      zoomMax: 18,
      jumlahTile: 0,
      rasterGeoreferensi,
      ukuranMb: metadataPetaBaru.ukuranMb,
      jarakKm: Number(jarakKmBaru.replace(",", ".")) || 0,
      thumbnailType: metadataPetaBaru?.thumbnailType ?? "geopdf_sheet",
      petaKustomDataUrl: petaKustomDataUrlBaru,
      diunduhPada: new Date().toISOString(),
      jenisFile: metadataPetaBaru?.jenisFile ?? "GeoPDF / GeoTIFF",
      crs: metadataPetaBaru.crs,
      crsDeskripsi: metadataPetaBaru?.crsDeskripsi,
      pusatLat: metadataPetaBaru?.pusatLat,
      pusatLng: metadataPetaBaru?.pusatLng,
      lebarPixel: metadataPetaBaru?.lebarPixel,
      tinggiPixel: metadataPetaBaru?.tinggiPixel,
      resolusiMeter: metadataPetaBaru?.resolusiMeter,
      unduhanNyata: true,
      statusTeks: "Pada peta"
    };
    onTambahAreaOffline(itemBaru);
    setNamaPetaBaru("");
    setUkuranMbBaru("");
    setJarakKmBaru("");
    setPetaKustomDataUrlBaru(undefined);
    setMetadataPetaBaru(null);
    setBukaModalPetaBaru(false);
    // Tampilkan pratinjau peta setelah berhasil di-upload ke aplikasi
    setPetaPratinjauAktif(itemBaru);
  };

  const handleSimpanLapisanBaru = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaLapisanBaru.trim()) return;
    const lyrBaru: LapisanSpasial = {
      id: buatId("LYR"),
      nama: namaLapisanBaru.trim(),
      jumlahPeta: 1,
      kategoriDefault: "Flora",
      createdAt: new Date().toISOString()
    };
    onTambahLapisan(lyrBaru);
    setNamaLapisanBaru("");
    setBukaModalLapisanBaru(false);
  };

  const handleImporFileLapisan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Lapisan dicatat hanya bila isi berkas benar-benar terbaca dan berisi objek
      if (onImporBerkas(file.name, String(reader.result || ""))) {
        onTambahLapisan({
          id: buatId("LYR"),
          nama: file.name.replace(/\.[^/.]+$/, ""),
          jumlahPeta: 1,
          createdAt: new Date().toISOString()
        });
      }
      input.value = "";
    };
    reader.onerror = () => {
      onImporBerkas(file.name, "");
      input.value = "";
    };
    reader.readAsText(file);
  };

  const formatAngkaIndo = (num: number) => num.toString().replace(".", ",");

  return (
    <div className="avenza-pustaka-container">
      {/* SEGMENTED PILL TABS: PETA | LAPISAN */}
      <div className="avenza-segmented-wrap">
        <div className="avenza-segmented-control">
          <button type="button" className={`avenza-segment-btn ${subTab === "peta" ? "active" : ""}`} onClick={() => setSubTab("peta")}>
            Peta
          </button>
          <button
            type="button"
            className={`avenza-segment-btn ${subTab === "lapisan" ? "active" : ""}`}
            onClick={() => setSubTab("lapisan")}
          >
            Lapisan
          </button>
        </div>
      </div>

      {/* BARIS FILTER, SORT & PENCARIAN */}
      <div className="avenza-filter-row">
        <div className="avenza-pills-left">
          {subTab === "peta" ? (
            <div className="avenza-pill-select-wrap">
              <ArrowUpDown size={15} className="avenza-pill-icon" />
              <select className="avenza-pill-select" value={urutPeta} onChange={(e) => setUrutPeta(e.target.value as typeof urutPeta)}>
                <option value="baru_dilihat">Baru dilihat</option>
                <option value="nama">Nama (A-Z)</option>
                <option value="ukuran">Ukuran File</option>
              </select>
              <ChevronDown size={15} className="avenza-pill-caret" />
            </div>
          ) : (
            <div className="avenza-pill-select-wrap">
              <ArrowUpDown size={15} className="avenza-pill-icon" />
              <select
                className="avenza-pill-select"
                value={urutLapisan}
                onChange={(e) => setUrutLapisan(e.target.value as typeof urutLapisan)}
              >
                <option value="terbaru">Terbaru</option>
                <option value="nama">Nama (A-Z)</option>
              </select>
              <ChevronDown size={15} className="avenza-pill-caret" />
            </div>
          )}

          <div className="avenza-pill-select-wrap">
            <Filter size={15} className="avenza-pill-icon" />
            <select className="avenza-pill-select" value={filterItem} onChange={(e) => setFilterItem(e.target.value as typeof filterItem)}>
              <option value="semua">Semua item</option>
              <option value="geopdf">GeoPDF / Peta</option>
              <option value="tiles">Peta Satelit</option>
            </select>
            <ChevronDown size={15} className="avenza-pill-caret" />
          </div>
        </div>

        <button type="button" className="avenza-search-icon-btn" onClick={() => setCariTerbuka((v) => !v)} title="Cari Peta atau Lapisan">
          <Search size={21} />
        </button>
      </div>

      {/* KOTAK PENCARIAN JIKA DIAKTIFKAN */}
      {cariTerbuka && (
        <div className="avenza-search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder={subTab === "peta" ? "Cari nama peta..." : "Cari nama lapisan..."}
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
          />
          {kataKunci && (
            <button type="button" onClick={() => setKataKunci("")}>
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* BAR MODE PILIH */}
      {modePilihAktif && (
        <div className="avenza-selection-banner">
          <span>{idTerpilih.length} item dipilih</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn-outline-sm" onClick={onBukaPengaturanEkspor}>
              Ekspor Pilihan
            </button>
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() => {
                setIdTerpilih([]);
                onMatikanModePilih();
              }}
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* KONTEN TAB 1: PETA */}
      {subTab === "peta" && (
        <div className="avenza-peta-content">
          <div className="avenza-basemap-banner-wrap">
            <div className="avenza-basemap-banner" onClick={onBukaPetaDasar}>
              <LatarPetaDasar />

              <button
                type="button"
                className="avenza-buka-peta-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onBukaPetaDasar();
                }}
              >
                <MapIcon size={17} aria-hidden="true" /> Buka peta dasar
              </button>
            </div>
          </div>

          <div className="avenza-map-list">
            {daftarPetaTampil.map((item) => (
              <div
                key={item.id}
                className="avenza-map-row"
                onClick={() => {
                  if (modePilihAktif) {
                    togglePilihId(item.id);
                  } else {
                    onBukaAreaPeta(item);
                  }
                }}
              >
                {modePilihAktif && (
                  <input
                    type="checkbox"
                    checked={idTerpilih.includes(item.id)}
                    onChange={() => togglePilihId(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="avenza-row-checkbox"
                  />
                )}

                <div
                  className="avenza-map-thumb-wrap"
                  onClick={(e) => {
                    if (!modePilihAktif) {
                      e.stopPropagation();
                      setPetaPratinjauAktif(item);
                    }
                  }}
                  title="Lihat Pratinjau Lembar Peta"
                >
                  {item.thumbnailUrl || item.thumbnailDataUrl || item.petaKustomUrl || item.petaKustomDataUrl ? (
                    <img
                      src={item.thumbnailUrl || item.thumbnailDataUrl || item.petaKustomUrl || item.petaKustomDataUrl}
                      alt={item.namaArea}
                      className="avenza-real-thumb-img"
                      width={52}
                      height={52}
                      loading="lazy"
                    />
                  ) : (
                    <ThumbnailDokumenPeta size={52} />
                  )}
                </div>

                <div className="avenza-map-info">
                  <div className="avenza-map-title">{item.namaArea}</div>
                  <div className="avenza-map-meta">
                    {formatAngkaIndo(item.ukuranMb)} MB <span className="dot-sep">•</span>{" "}
                    <span className="text-emerald" style={{ fontWeight: 600 }}>
                      {item.statusTeks || (item.unduhanNyata ? "Pada peta" : "Catatan saja")}
                    </span>
                    {item.jarakKm !== undefined && item.jarakKm > 0 && (
                      <>
                        {" "}
                        <span className="dot-sep">•</span> {formatAngkaIndo(item.jarakKm)} km
                      </>
                    )}
                    {item.crs && (
                      <>
                        {" "}
                        <span className="dot-sep">•</span>{" "}
                        <span className="avenza-crs-badge" title={item.crsDeskripsi || item.crs}>
                          {item.crs.replace(/\s*\(.*\)$/, "")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div
                  className="avenza-map-more-wrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuItemTerbuka(menuItemTerbuka === item.id ? null : item.id);
                  }}
                >
                  <button type="button" className="avenza-more-dots-btn" title="Opsi Peta">
                    <MoreHorizontal size={20} />
                  </button>

                  {menuItemTerbuka === item.id && (
                    <div className="avenza-row-dropdown">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuItemTerbuka(null);
                          setPetaPratinjauAktif(item);
                        }}
                      >
                        Pratinjau Lembar Peta
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuItemTerbuka(null);
                          onBukaAreaPeta(item);
                        }}
                      >
                        Buka di Peta Survei
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuItemTerbuka(null);
                          onBukaPengaturanEkspor();
                        }}
                      >
                        Ekspor Peta / Lapisan
                      </button>
                      <button
                        type="button"
                        className="danger-text"
                        onClick={() => {
                          setMenuItemTerbuka(null);
                          onHapusAreaOffline(item.id);
                        }}
                      >
                        Hapus dari Pustaka
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {daftarPetaTampil.length === 0 && (
              <div style={{ textAlign: "center", padding: "36px 20px 80px", color: "#64748b" }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    background: "#e8f5ee",
                    color: "#0d7344",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10
                  }}
                >
                  <Layers size={28} />
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Pustaka Peta Kosong</h4>
                <p style={{ margin: "0 auto 14px", fontSize: "0.84rem", color: "#64748b", maxWidth: 320 }}>
                  Ketuk tombol (+) di kanan bawah untuk mengimpor peta kerja atau buka peta dasar.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            className="avenza-fab-orange single-fab"
            onClick={() => setBukaModalPetaBaru(true)}
            title="Tambah / Impor Peta Kerja Baru"
          >
            <Plus size={28} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {/* KONTEN TAB 2: LAPISAN */}
      {subTab === "lapisan" && (
        <div className="avenza-lapisan-content">
          <div className="avenza-layer-list">
            {daftarLapisanTampil.map((lapisan) => {
              const jmlObjek = hitungObjekLapisan(lapisan);
              return (
                <div key={lapisan.id} className="avenza-layer-row" onClick={onBukaPetaDasar}>
                  <div className="avenza-layer-icon-box">
                    <Layers size={24} />
                  </div>

                  <div className="avenza-layer-info">
                    <div className="avenza-layer-title">{lapisan.nama}</div>
                    <div className="avenza-layer-meta">
                      {lapisan.jumlahPeta} Peta
                      {jmlObjek > 0 && (
                        <>
                          {" "}
                          <span className="dot-sep">•</span> Objek {jmlObjek}
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className="avenza-map-more-wrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuItemTerbuka(menuItemTerbuka === lapisan.id ? null : lapisan.id);
                    }}
                  >
                    <button type="button" className="avenza-more-dots-btn" title="Opsi Lapisan">
                      <MoreHorizontal size={20} />
                    </button>

                    {menuItemTerbuka === lapisan.id && (
                      <div className="avenza-row-dropdown">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuItemTerbuka(null);
                            onBukaPetaDasar();
                          }}
                        >
                          Lihat Objek di Peta
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuItemTerbuka(null);
                            onBukaPengaturanEkspor();
                          }}
                        >
                          Pengaturan Ekspor (.kml / .geojson)
                        </button>
                        <button
                          type="button"
                          className="danger-text"
                          onClick={() => {
                            setMenuItemTerbuka(null);
                            onHapusLapisan(lapisan.id);
                          }}
                        >
                          Hapus Lapisan
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {daftarLapisanTampil.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    background: "#e8f5ee",
                    color: "#0d7344",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10
                  }}
                >
                  <Layers size={28} />
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Belum Ada Lapisan</h4>
                <p style={{ margin: "0 auto", fontSize: "0.84rem", color: "#64748b", maxWidth: 300 }}>
                  Gunakan tombol "Buat lapisan" atau "Impor" di kanan bawah.
                </p>
              </div>
            )}
          </div>

          <div className="avenza-fab-stack">
            <div className="avenza-fab-row">
              <span className="avenza-fab-label" onClick={() => setBukaModalLapisanBaru(true)}>
                Buat lapisan
              </span>
              <button type="button" className="avenza-fab-orange" onClick={() => setBukaModalLapisanBaru(true)} title="Buat Lapisan Baru">
                <Layers size={22} />
              </button>
            </div>

            <div className="avenza-fab-row">
              <label className="avenza-fab-label" htmlFor="impor-lapisan-input">
                Impor
              </label>
              <label htmlFor="impor-lapisan-input" className="avenza-fab-orange" title="Impor File Lapisan (.kml, .geojson, .gpx)">
                <Download size={22} />
                <input
                  id="impor-lapisan-input"
                  type="file"
                  accept=".geojson,.json,.kml,.gpx"
                  style={{ display: "none" }}
                  onChange={handleImporFileLapisan}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PETA KERJA BARU */}
      {bukaModalPetaBaru && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Peta</h3>
              <button type="button" className="btn-icon-close" onClick={() => setBukaModalPetaBaru(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSimpanPetaBaru} className="modal-form">
              {/* UPLOAD BERKAS PETA DARI PERANGKAT */}
              <div className="peta-upload-container">
                <label className="peta-upload-dropzone" htmlFor="upload-peta-input">
                  <input
                    id="upload-peta-input"
                    type="file"
                    accept=".pdf,.geopdf"
                    style={{ display: "none" }}
                    onChange={handlePilihBerkasPeta}
                  />
                  <div className="peta-upload-icon-wrap">
                    <FileUp size={24} />
                  </div>
                  <div className="peta-upload-text-wrap">
                    <strong>Pilih Berkas Peta dari Perangkat</strong>
                    <span>GeoPDF WGS84 / EPSG:4326, halaman pertama, north-up. Maksimum 80 MB.</span>
                  </div>
                  <span className="peta-upload-btn-chip">Pilih Berkas</span>
                </label>
                {sedangMemprosesBerkas && (
                  <div className="peta-upload-status loading">
                    <span>Mendeteksi sistem koordinat (CRS) & menghitung bounding box otomatis…</span>
                  </div>
                )}
                {!sedangMemprosesBerkas && metadataPetaBaru && (
                  <div className="peta-upload-status success">
                    <Check size={14} /> Berkas dipilih: <b>{metadataPetaBaru.namaArea}</b> ({metadataPetaBaru.ukuranMbTeks} MB • Jarak{" "}
                    {metadataPetaBaru.jarakKmTeks} km)
                  </div>
                )}
              </div>

              {galatImpor && (
                <p role="alert" style={{ color: "#b42318" }}>
                  {galatImpor}
                </p>
              )}
              {/* CARD DETEKSI OTOMATIS CRS & BOUNDING BOX */}
              {metadataPetaBaru && (
                <div className="avenza-spatial-meta-card">
                  <div className="avenza-spatial-header">
                    <span className="avenza-spatial-title">🌐 Sistem Koordinat (CRS) & Bounding Box</span>
                    <span className="avenza-spatial-badge">
                      <Check size={12} /> Terisi Otomatis
                    </span>
                  </div>
                  <div className="avenza-spatial-grid">
                    <div className="avenza-spatial-item full-width">
                      <span className="spatial-label">Sistem Koordinat Acuan (CRS):</span>
                      <strong className="spatial-value crs-name">{metadataPetaBaru.crs || "EPSG:4326 (WGS 84)"}</strong>
                      {metadataPetaBaru.crsDeskripsi && <span className="spatial-desc">{metadataPetaBaru.crsDeskripsi}</span>}
                    </div>
                    <div className="avenza-spatial-item">
                      <span className="spatial-label">Batas Lintang (Lat):</span>
                      <span className="spatial-value">
                        {metadataPetaBaru.minLat.toFixed(4)}° s/d {metadataPetaBaru.maxLat.toFixed(4)}°
                      </span>
                    </div>
                    <div className="avenza-spatial-item">
                      <span className="spatial-label">Batas Bujur (Lng):</span>
                      <span className="spatial-value">
                        {metadataPetaBaru.minLng.toFixed(4)}° s/d {metadataPetaBaru.maxLng.toFixed(4)}°
                      </span>
                    </div>
                    {metadataPetaBaru.pusatLat !== undefined && metadataPetaBaru.pusatLng !== undefined && (
                      <div className="avenza-spatial-item">
                        <span className="spatial-label">Titik Pusat Referensi:</span>
                        <span className="spatial-value">
                          {metadataPetaBaru.pusatLat.toFixed(4)}°, {metadataPetaBaru.pusatLng.toFixed(4)}°
                        </span>
                      </div>
                    )}
                    <div className="avenza-spatial-item">
                      <span className="spatial-label">Metode Deteksi Otomatis:</span>
                      <span className="spatial-value text-emerald font-semibold">
                        {metadataPetaBaru.sumberDeteksi === "geotiff" && "Header Biner GeoTIFF (Tag 33550 & 33922)"}
                        {metadataPetaBaru.sumberDeteksi === "mbtiles" && "SQLite MBTiles Metadata (EPSG:3857/4326)"}
                        {metadataPetaBaru.sumberDeteksi === "geopdf" && "Struktur Vektor GeoPDF /GPTS"}
                        {metadataPetaBaru.sumberDeteksi === "teks" && "Ekstraksi Metadata String"}
                        {metadataPetaBaru.sumberDeteksi === "bawaan" && "Koordinat Definitif Wilayah"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* PENGINGAT KETIKA DATA TERLALU BESAR */}
              {metadataPetaBaru && (() => {
                const mb = Number(ukuranMbBaru.replace(",", ".")) || metadataPetaBaru.ukuranMb;
                if (mb > 100) {
                  return (
                    <div className="peta-warning-banner danger">
                      <AlertOctagon size={22} className="warning-banner-icon" />
                      <div className="warning-banner-content">
                        <strong>🚨 Perhatian: Ukuran Berkas Sangat Besar ({metadataPetaBaru.ukuranMbTeks} MB)</strong>
                        <p>
                          Ukuran berkas melebihi 100 MB. Berkas sebesar ini berisiko membebani memori ponsel atau membuat peramban melambat saat membuka lembar peta di lapangan. Disarankan mengompresi gambar atau menggunakan format MBTiles.
                        </p>
                      </div>
                    </div>
                  );
                }
                if (mb > 50) {
                  return (
                    <div className="peta-warning-banner caution">
                      <AlertTriangle size={22} className="warning-banner-icon" />
                      <div className="warning-banner-content">
                        <strong>⚠️ Pengingat: Ukuran Berkas Cukup Besar ({metadataPetaBaru.ukuranMbTeks} MB)</strong>
                        <p>
                          Berkas di atas 50 MB memerlukan kapasitas memori cache lebih banyak di HP. Pastikan sisa penyimpanan ponsel Anda mencukupi agar render peta tetap cepat secara offline.
                        </p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="peta-size-optimal-badge">
                    <Check size={14} className="text-emerald" />
                    <span>Ukuran berkas optimal untuk perangkat seluler ({metadataPetaBaru.ukuranMbTeks} MB)</span>
                  </div>
                );
              })()}
              <div>
                <label>Nama File Peta Kerja (GeoPDF / GeoTIFF / MBTiles)</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Masukkan nama peta kerja"
                  value={namaPetaBaru}
                  onChange={(e) => setNamaPetaBaru(e.target.value)}
                />
              </div>
              <div className="form-row-2">
                <div>
                  <label>Ukuran File (MB)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0"
                    value={ukuranMbBaru}
                    onChange={(e) => setUkuranMbBaru(e.target.value)}
                  />
                </div>
                <div>
                  <label>Jarak Referensi (km)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0"
                    value={jarakKmBaru}
                    onChange={(e) => setJarakKmBaru(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline-sm" onClick={() => setBukaModalPetaBaru(false)}>
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!metadataPetaBaru || !petaKustomDataUrlBaru || sedangMemprosesBerkas || !!galatImpor}
                >
                  Simpan ke Pustaka Peta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BUAT LAPISAN SPASIAL BARU */}
      {bukaModalLapisanBaru && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Lapisan</h3>
              <button type="button" className="btn-icon-close" onClick={() => setBukaModalLapisanBaru(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSimpanLapisanBaru} className="modal-form">
              <div>
                <label>Nama Lapisan</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Masukkan nama lapisan"
                  value={namaLapisanBaru}
                  onChange={(e) => setNamaLapisanBaru(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline-sm" onClick={() => setBukaModalLapisanBaru(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  Buat Lapisan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL PRATINJAU LEMBAR PETA SETELAH DI-UPLOAD KE APLIKASI */}
      {petaPratinjauAktif && (
        <div className="modal-backdrop" onClick={() => setPetaPratinjauAktif(null)}>
          <div className="modal-card avenza-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="avenza-preview-modal-head">
                <Eye size={20} className="text-emerald" />
                <h3 className="avenza-preview-modal-title">Pratinjau Lembar Peta</h3>
              </div>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setPetaPratinjauAktif(null)}
                title="Tutup Pratinjau"
              >
                <X size={18} />
              </button>
            </div>

            <div className="avenza-preview-modal-body">
              {/* VIEWPORT LEMBAR PETA OTENTIK */}
              <div className="avenza-preview-stage">
                {petaPratinjauAktif.petaKustomDataUrl || petaPratinjauAktif.petaKustomUrl || petaPratinjauAktif.thumbnailUrl ? (
                  <img
                    src={
                      petaPratinjauAktif.petaKustomDataUrl ||
                      petaPratinjauAktif.petaKustomUrl ||
                      petaPratinjauAktif.thumbnailUrl
                    }
                    alt={petaPratinjauAktif.namaArea}
                    className="avenza-preview-stage-img"
                  />
                ) : (
                  <div className="avenza-preview-placeholder">
                    <MapIcon size={48} className="text-emerald" />
                    <span>Lembar Dokumen Peta</span>
                  </div>
                )}
                <div className="avenza-preview-stage-badge">
                  <Check size={12} /> Dokumen Peta Terunggah
                </div>
              </div>

              {/* INFORMASI SPASIAL LENGKAP */}
              <div className="avenza-preview-info-card">
                <div className="avenza-preview-map-name">{petaPratinjauAktif.namaArea}</div>

                <div className="avenza-preview-meta-row">
                  <span className="meta-badge-crs">
                    {petaPratinjauAktif.crs || "EPSG:4326 (WGS 84)"}
                  </span>
                  <span className="meta-text-size">
                    {formatAngkaIndo(petaPratinjauAktif.ukuranMb)} MB
                  </span>
                  <span className="meta-text-status text-emerald font-semibold">
                    ● {petaPratinjauAktif.statusTeks || "Pada peta"}
                  </span>
                  {petaPratinjauAktif.jarakKm !== undefined && petaPratinjauAktif.jarakKm > 0 && (
                    <span className="meta-text-distance">
                      Jarak: {formatAngkaIndo(petaPratinjauAktif.jarakKm)} km
                    </span>
                  )}
                </div>

                <div className="avenza-preview-spatial-grid">
                  <div className="spatial-grid-item">
                    <span className="spatial-grid-label">Batas Lintang (Lat):</span>
                    <span className="spatial-grid-val">
                      {petaPratinjauAktif.minLat.toFixed(4)}° s/d {petaPratinjauAktif.maxLat.toFixed(4)}°
                    </span>
                  </div>
                  <div className="spatial-grid-item">
                    <span className="spatial-grid-label">Batas Bujur (Lng):</span>
                    <span className="spatial-grid-val">
                      {petaPratinjauAktif.minLng.toFixed(4)}° s/d {petaPratinjauAktif.maxLng.toFixed(4)}°
                    </span>
                  </div>
                  {petaPratinjauAktif.pusatLat !== undefined && petaPratinjauAktif.pusatLng !== undefined && (
                    <div className="spatial-grid-item">
                      <span className="spatial-grid-label">Titik Pusat:</span>
                      <span className="spatial-grid-val">
                        {petaPratinjauAktif.pusatLat.toFixed(4)}°, {petaPratinjauAktif.pusatLng.toFixed(4)}°
                      </span>
                    </div>
                  )}
                  {petaPratinjauAktif.crsDeskripsi && (
                    <div className="spatial-grid-item full-width">
                      <span className="spatial-grid-label">Deskripsi Proyeksi:</span>
                      <span className="spatial-grid-val">{petaPratinjauAktif.crsDeskripsi}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer avenza-preview-modal-footer">
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => setPetaPratinjauAktif(null)}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const target = petaPratinjauAktif;
                  setPetaPratinjauAktif(null);
                  onBukaAreaPeta(target);
                }}
              >
                <MapIcon size={16} /> Buka di Peta Survei
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
