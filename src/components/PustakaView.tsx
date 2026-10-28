import React, { useState } from "react";
import { AreaPetaOffline, DataSpasialItem, LapisanSpasial } from "../types";
import { buatId } from "../lib/id";
import {
  ArrowUpDown,
  ChevronDown,
  Download,
  Filter,
  Layers,
  MoreHorizontal,
  Plus,
  Search,
  X
} from "lucide-react";

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

  const [bukaModalLapisanBaru, setBukaModalLapisanBaru] = useState(false);
  const [namaLapisanBaru, setNamaLapisanBaru] = useState("");

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
    .filter((l) =>
      kataKunci.trim() ? l.nama.toLowerCase().includes(kataKunci.toLowerCase()) : true
    )
    .sort((a, b) => {
      if (urutLapisan === "nama") return a.nama.localeCompare(b.nama);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const togglePilihId = (id: string) => {
    setIdTerpilih((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSimpanPetaBaru = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaPetaBaru.trim()) return;
    const itemBaru: AreaPetaOffline = {
      id: buatId("MAP-OFF"),
      namaArea: namaPetaBaru.trim(),
      basemapId: "topo",
      minLat: -0.958,
      maxLat: -0.932,
      minLng: 100.408,
      maxLng: 100.432,
      zoomMin: 13,
      zoomMax: 18,
      jumlahTile: 980,
      ukuranMb: Number(ukuranMbBaru.replace(",", ".")) || 10,
      jarakKm: Number(jarakKmBaru.replace(",", ".")) || 0,
      thumbnailType: "dem_atas",
      diunduhPada: new Date().toISOString(),
      jenisFile: "GeoPDF / GeoTIFF"
    };
    onTambahAreaOffline(itemBaru);
    setNamaPetaBaru("");
    setUkuranMbBaru("");
    setJarakKmBaru("");
    setBukaModalPetaBaru(false);
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
          <button
            type="button"
            className={`avenza-segment-btn ${subTab === "peta" ? "active" : ""}`}
            onClick={() => setSubTab("peta")}
          >
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
              <select
                className="avenza-pill-select"
                value={urutPeta}
                onChange={(e) => setUrutPeta(e.target.value as any)}
              >
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
                onChange={(e) => setUrutLapisan(e.target.value as any)}
              >
                <option value="terbaru">Terbaru</option>
                <option value="nama">Nama (A-Z)</option>
              </select>
              <ChevronDown size={15} className="avenza-pill-caret" />
            </div>
          )}

          <div className="avenza-pill-select-wrap">
            <Filter size={15} className="avenza-pill-icon" />
            <select
              className="avenza-pill-select"
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value as any)}
            >
              <option value="semua">Semua item</option>
              <option value="geopdf">GeoPDF / Peta</option>
              <option value="tiles">Peta Satelit</option>
            </select>
            <ChevronDown size={15} className="avenza-pill-caret" />
          </div>
        </div>

        <button
          type="button"
          className="avenza-search-icon-btn"
          onClick={() => setCariTerbuka((v) => !v)}
          title="Cari Peta atau Lapisan"
        >
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
            <button
              type="button"
              className="btn-outline-sm"
              onClick={onBukaPengaturanEkspor}
            >
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
              <svg
                className="avenza-basemap-svg"
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
              >
                <rect width="600" height="180" fill="#e2e6e3" />
                <path
                  d="M0,0 L280,0 C260,45 210,80 140,120 C90,148 40,165 0,180 Z"
                  fill="#b7d7a8"
                />
                <path
                  d="M0,0 L190,0 C175,35 130,65 80,95 C40,118 15,135 0,145 Z"
                  fill="#a3c995"
                />
                <path
                  d="M25,10 Q90,30 130,55 T230,25"
                  fill="none"
                  stroke="#cbe3be"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d="M75,180 C115,140 165,112 245,92 C310,76 355,65 375,58 L430,130 L405,180 Z"
                  fill="#7cc0f7"
                />
                <path
                  d="M440,105 L535,88 L535,62 L575,62 L575,95 L440,118 Z"
                  fill="#f3f5f4"
                />
                <path
                  d="M520,180 C535,155 565,145 600,140 L600,180 Z"
                  fill="#b7d7a8"
                />
              </svg>

              <button
                type="button"
                className="avenza-buka-peta-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onBukaPetaDasar();
                }}
              >
                Buka peta dasar
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

                <div className={`avenza-map-thumb thumb-${item.thumbnailType || "radar"}`}>
                  <svg viewBox="0 0 64 64" width="100%" height="100%">
                    <defs>
                      <radialGradient id="demGrad" cx="40%" cy="40%" r="70%">
                        <stop offset="0%" stopColor="#eab308" />
                        <stop offset="55%" stopColor="#84cc16" />
                        <stop offset="100%" stopColor="#15803d" />
                      </radialGradient>
                    </defs>
                    <rect width="64" height="64" fill="url(#demGrad)" />
                    <path
                      d="M8,12 Q28,24 22,44 T52,58"
                      stroke="#713f12"
                      strokeWidth="1.2"
                      fill="none"
                      opacity="0.65"
                    />
                  </svg>
                </div>

                <div className="avenza-map-info">
                  <div className="avenza-map-title">{item.namaArea}</div>
                  <div className="avenza-map-meta">
                    {item.unduhanNyata || item.jenisFile !== "XYZ Tiles"
                      ? `${formatAngkaIndo(item.ukuranMb)} MB`
                      : "Ukuran tidak diketahui"}{" "}
                    <span className="dot-sep">•</span>{" "}
                    {formatAngkaIndo(item.jarakKm ?? 0)} km
                    {item.unduhanNyata ? (
                      <>
                        {" "}<span className="dot-sep">•</span> {item.jumlahTile.toLocaleString("id-ID")} tile
                      </>
                    ) : (
                      <>
                        {" "}<span className="dot-sep">•</span> Catatan saja
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
                <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#e8f5ee", color: "#0d7344", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Layers size={28} />
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                  Pustaka Peta Kosong
                </h4>
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
                <div
                  key={lapisan.id}
                  className="avenza-layer-row"
                  onClick={onBukaPetaDasar}
                >
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
                      setMenuItemTerbuka(
                        menuItemTerbuka === lapisan.id ? null : lapisan.id
                      );
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
                <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#e8f5ee", color: "#0d7344", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Layers size={28} />
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                  Belum Ada Lapisan
                </h4>
                <p style={{ margin: "0 auto", fontSize: "0.84rem", color: "#64748b", maxWidth: 300 }}>
                  Gunakan tombol "Buat lapisan" atau "Impor" di kanan bawah.
                </p>
              </div>
            )}
          </div>

          <div className="avenza-fab-stack">
            <div className="avenza-fab-row">
              <span
                className="avenza-fab-label"
                onClick={() => setBukaModalLapisanBaru(true)}
              >
                Buat lapisan
              </span>
              <button
                type="button"
                className="avenza-fab-orange"
                onClick={() => setBukaModalLapisanBaru(true)}
                title="Buat Lapisan Baru"
              >
                <Layers size={22} />
              </button>
            </div>

            <div className="avenza-fab-row">
              <label className="avenza-fab-label" htmlFor="impor-lapisan-input">
                Impor
              </label>
              <label
                htmlFor="impor-lapisan-input"
                className="avenza-fab-orange"
                title="Impor File Lapisan (.kml, .geojson, .gpx)"
              >
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
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setBukaModalPetaBaru(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSimpanPetaBaru} className="modal-form">
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
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => setBukaModalPetaBaru(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary">
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
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setBukaModalLapisanBaru(false)}
              >
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
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => setBukaModalLapisanBaru(false)}
                >
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
    </div>
  );
};
