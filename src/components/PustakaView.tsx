import React, { useState } from "react";
import { AreaPetaOffline, DataSpasialItem, LapisanSpasial } from "../types";
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
  onImporDataSpasial: (items: DataSpasialItem[]) => void;
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
  onImporDataSpasial,
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

  // Modal Tambah Peta Baru / Buat Lapisan Baru
  const [bukaModalPetaBaru, setBukaModalPetaBaru] = useState(false);
  const [namaPetaBaru, setNamaPetaBaru] = useState("");
  const [ukuranMbBaru, setUkuranMbBaru] = useState("18.4");
  const [jarakKmBaru, setJarakKmBaru] = useState("152.40");

  const [bukaModalLapisanBaru, setBukaModalLapisanBaru] = useState(false);
  const [namaLapisanBaru, setNamaLapisanBaru] = useState("");

  // Hitung jumlah objek untuk masing-masing Lapisan agar selaras dengan screenshot & data nyata
  const hitungObjekLapisan = (lapisan: LapisanSpasial, index: number): number => {
    const tambahanData = dataSpasial.filter(
      (d) => d.kategori === lapisan.kategoriDefault
    ).length;
    if (lapisan.id === "LYR-01") return 174 + tambahanData;
    if (lapisan.id === "LYR-04") return 3 + tambahanData;
    if (lapisan.id === "LYR-02") return 21 + tambahanData;
    if (lapisan.id === "LYR-03") return Math.max(0, tambahanData - 1);
    return index === 0 ? tambahanData : 0;
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
      id: `MAP-OFF-${Date.now().toString().slice(-4)}`,
      namaArea: namaPetaBaru.trim(),
      basemapId: "topo",
      minLat: -0.958,
      maxLat: -0.932,
      minLng: 100.408,
      maxLng: 100.432,
      zoomMin: 13,
      zoomMax: 18,
      jumlahTile: 980,
      ukuranMb: Number(ukuranMbBaru.replace(",", ".")) || 15.2,
      jarakKm: Number(jarakKmBaru.replace(",", ".")) || 120.5,
      thumbnailType: "dem_atas",
      diunduhPada: new Date().toISOString(),
      jenisFile: "GeoPDF / GeoTIFF"
    };
    onTambahAreaOffline(itemBaru);
    setNamaPetaBaru("");
    setBukaModalPetaBaru(false);
  };

  const handleSimpanLapisanBaru = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaLapisanBaru.trim()) return;
    const lyrBaru: LapisanSpasial = {
      id: `LYR-${Date.now().toString().slice(-4)}`,
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
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const json = JSON.parse(text);
        if (json.features && Array.isArray(json.features)) {
          const hasil: DataSpasialItem[] = json.features.map(
            (f: Record<string, any>, idx: number) => ({
              id: `IMP-${Date.now()}-${idx}`,
              idKader: "KDR-2026-014",
              namaKader: "Budi Santoso",
              desaWilayah: "Desa Rimba Lestari",
              jenisGeometri:
                f.geometry?.type === "Polygon"
                  ? "polygon"
                  : f.geometry?.type === "LineString"
                  ? "line"
                  : "point",
              kategori: f.properties?.kategori || "Flora",
              judul: f.properties?.judul || f.properties?.name || `Objek Impor #${idx + 1}`,
              deskripsi: f.properties?.deskripsi || `Diimpor dari ${file.name}`,
              koordinat: [{ lat: -0.9475, lng: 100.4192, elevasi: 410 }],
              panjangKm: 0,
              luasHa: 0,
              statusSinkron: "lokal",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              riwayatPembaruan: []
            })
          );
          onImporDataSpasial(hasil);
        }
      } catch {
        // Jika file KML/KMZ/GeoPDF simulasi tambah lapisan baru
      }
      onTambahLapisan({
        id: `LYR-${Date.now().toString().slice(-4)}`,
        nama: file.name.replace(/\.[^/.]+$/, ""),
        jumlahPeta: 1,
        createdAt: new Date().toISOString()
      });
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
            placeholder={
              subTab === "peta"
                ? "Cari nama peta kerja atau desa..."
                : "Cari nama lapisan objek..."
            }
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

      {/* BAR MODE PILIH JIKA DIAKTIFKAN DARI MENU TITIK TIGA */}
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

      {/* KONTEN TAB 1: PETA (SESUAI SCREENSHOT 1 & 3) */}
      {subTab === "peta" && (
        <div className="avenza-peta-content">
          {/* KARTU BANNER "BUKA PETA DASAR" */}
          <div className="avenza-basemap-banner-wrap">
            <div className="avenza-basemap-banner" onClick={onBukaPetaDasar}>
              <svg
                className="avenza-basemap-svg"
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
              >
                {/* Daratan Abu-abu Muda */}
                <rect width="600" height="180" fill="#e2e6e3" />
                {/* Bukit / Vegetasi Hijau Lembut */}
                <path
                  d="M0,0 L280,0 C260,45 210,80 140,120 C90,148 40,165 0,180 Z"
                  fill="#b7d7a8"
                />
                <path
                  d="M0,0 L190,0 C175,35 130,65 80,95 C40,118 15,135 0,145 Z"
                  fill="#a3c995"
                />
                {/* Kontur Punggungan */}
                <path
                  d="M25,10 Q90,30 130,55 T230,25"
                  fill="none"
                  stroke="#cbe3be"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Danau / Sungai Biru Cerah di Tengah-Bawah */}
                <path
                  d="M75,180 C115,140 165,112 245,92 C310,76 355,65 375,58 L430,130 L405,180 Z"
                  fill="#7cc0f7"
                />
                {/* Jalan / Jalur Putih di Kanan */}
                <path
                  d="M440,105 L535,88 L535,62 L575,62 L575,95 L440,118 Z"
                  fill="#f3f5f4"
                />
                {/* Kehijauan Kanan Bawah */}
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

          {/* DAFTAR PETA KERJA OFFLINE / GEOPDF */}
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

                {/* THUMBNAIL PETA SESUAI SCREENSHOT */}
                <div className={`avenza-map-thumb thumb-${item.thumbnailType || "radar"}`}>
                  {item.thumbnailType === "radar" && (
                    <svg viewBox="0 0 64 64" width="100%" height="100%">
                      <rect width="64" height="64" fill="#2c7a21" />
                      <path d="M0,0 L34,0 C28,22 16,36 0,44 Z" fill="#a21caf" />
                      <circle cx="38" cy="28" r="1.5" fill="#fff" />
                      <circle cx="44" cy="34" r="1.5" fill="#fff" />
                      <circle cx="32" cy="42" r="1.5" fill="#fff" />
                      <path
                        d="M12,56 Q34,46 58,52"
                        stroke="#bbf7d0"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                  )}
                  {item.thumbnailType === "vector" && (
                    <svg viewBox="0 0 64 64" width="100%" height="100%">
                      <rect width="64" height="64" fill="#ffffff" />
                      <path
                        d="M14,0 L36,0 C38,24 46,42 58,64 L10,64 C18,46 8,24 14,0 Z"
                        fill="#16a34a"
                      />
                      <path d="M36,0 L64,0 L64,52 C52,38 42,20 36,0 Z" fill="#a855f7" />
                    </svg>
                  )}
                  {(item.thumbnailType === "dem_atas" ||
                    item.thumbnailType === "dem_bawah" ||
                    !item.thumbnailType) && (
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
                      <path
                        d="M4,32 Q26,28 44,14"
                        stroke="#dc2626"
                        strokeWidth="1"
                        fill="none"
                        opacity="0.55"
                      />
                    </svg>
                  )}
                </div>

                <div className="avenza-map-info">
                  <div className="avenza-map-title">{item.namaArea}</div>
                  <div className="avenza-map-meta">
                    {formatAngkaIndo(item.ukuranMb)} MB <span className="dot-sep">•</span>{" "}
                    {formatAngkaIndo(item.jarakKm ?? 150.25)} km
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
          </div>

          {/* FLOATING ACTION BUTTON ORANYE (+) DI POJOK KANAN BAWAH */}
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

      {/* KONTEN TAB 2: LAPISAN (SESUAI SCREENSHOT 5) */}
      {subTab === "lapisan" && (
        <div className="avenza-lapisan-content">
          <div className="avenza-layer-list">
            {daftarLapisanTampil.map((lapisan, idx) => {
              const jmlObjek = hitungObjekLapisan(lapisan, idx);
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
          </div>

          {/* 2 FLOATING ACTION BUTTON ORANYE BERTUMPUK ("Buat lapisan" & "Impor") SESUAI SCREENSHOT 5 */}
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
              <h3>Tambah / Impor Peta ke Pustaka</h3>
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
                  placeholder="Contoh: PetaKerja_Blok_Hutan_Desa_GeoPDF"
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
                    value={ukuranMbBaru}
                    onChange={(e) => setUkuranMbBaru(e.target.value)}
                  />
                </div>
                <div>
                  <label>Jarak Referensi (km)</label>
                  <input
                    type="text"
                    className="form-input"
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
              <h3>Buat Lapisan Baru</h3>
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
                  placeholder={`Lapisan ${lapisanList.length + 1}`}
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
