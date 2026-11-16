import React, { useMemo, useState } from "react";
import { AreaPetaOffline, DataSpasialItem } from "../types";
import { eksporKeCSV, eksporKeGPX } from "../lib/geoUtils";
import {
  eksporGeoJsonDenganOpsi,
  eksporKmlDenganOpsi,
  filterDataUntukEkspor,
  JenisDataEkspor,
  KonteksEkspor
} from "../lib/eksporFilter";
import { buatArsipZip, eksporPaketShapefile, eksporShpDenganOpsi } from "../lib/shapefile";
import {
  ArrowLeft,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Info,
  Layers,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Route,
  Send,
  Share,
  Share2,
  Tag,
  X
} from "lucide-react";
import { useTombolEsc } from "../lib/useTombolEsc";

type FormatEksporUser = ".geojson" | ".kml" | ".gpx" | ".csv" | ".shp";

interface PengaturanEksporViewProps {
  dataSpasial: DataSpasialItem[];
  areaOffline?: AreaPetaOffline[];
  konteksEkspor?: KonteksEkspor | null;
  onTutup: () => void;
}

interface PaketSiapBagikan {
  namaBerkas: string;
  mimeType: string;
  blob: Blob;
  ringkasTeks: string;
  isiTeks?: string;
  ukuranKb: number;
  jumlahObjek: number;
}

function unduhDariBlob(namaFile: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Form pengaturan ekspor lengkap berikut halaman bagikan multi-platform setelah berkas dibuat. */
export const PengaturanEksporView: React.FC<PengaturanEksporViewProps> = ({
  dataSpasial,
  areaOffline = [],
  konteksEkspor = null,
  onTutup
}) => {
  const [paketBagikan, setPaketBagikan] = useState<PaketSiapBagikan | null>(null);
  useTombolEsc(true, () => {
    if (paketBagikan) setPaketBagikan(null);
    else onTutup();
  });

  const [namaFile, setNamaFile] = useState("Lapisan 1");
  const adaKonteksTerpilih = Boolean(
    konteksEkspor?.petaDipilih?.length || konteksEkspor?.lapisanDipilih?.length || konteksEkspor?.fiturTerpilihIds?.length
  );
  const [jenisData, setJenisData] = useState<JenisDataEkspor>(() =>
    adaKonteksTerpilih ? "Semua fitur terpilih" : "Hanya lapisan"
  );
  const [formatFile, setFormatFile] = useState<FormatEksporUser>(".geojson");
  const [filterTematik, setFilterTematik] = useState<string>("");
  const [filterKategori, setFilterKategori] = useState<string>("");
  const [hanyaSkema, setHanyaSkema] = useState(false);
  const [sertakanFoto, setSertakanFoto] = useState(true);
  const [sertakanMemo, setSertakanMemo] = useState(true);
  const [sertakanTematik, setSertakanTematik] = useState(true);
  const [lintasanJadiGaris, setLintasanJadiGaris] = useState(true);
  const [tampilInfo, setTampilInfo] = useState(false);
  const [statusEkspor, setStatusEkspor] = useState<string>("");
  const [pesanBagikan, setPesanBagikan] = useState<string>("");

  const opsiTematik = useMemo(() => {
    const setNama = new Set<string>();
    dataSpasial.forEach((d) => {
      if (d.tematik?.trim()) setNama.add(d.tematik.trim());
    });
    return [...setNama].sort((a, b) => a.localeCompare(b, "id"));
  }, [dataSpasial]);

  const opsiKategori = useMemo(() => {
    const setKat = new Set<string>();
    dataSpasial.forEach((d) => {
      if (d.kategori) setKat.add(d.kategori);
    });
    return [...setKat].sort((a, b) => a.localeCompare(b, "id"));
  }, [dataSpasial]);

  const dataTersaring = useMemo(
    () =>
      filterDataUntukEkspor(dataSpasial, {
        jenisData,
        konteks: konteksEkspor ?? undefined,
        sertakanFoto,
        sertakanMemo,
        sertakanTematik,
        filterTematik,
        filterKategori
      }),
    [dataSpasial, jenisData, konteksEkspor, sertakanFoto, sertakanMemo, sertakanTematik, filterTematik, filterKategori]
  );

  const petaBatasEkspor = useMemo(
    () => (konteksEkspor?.petaDipilih?.length ? konteksEkspor.petaDipilih : areaOffline),
    [konteksEkspor, areaOffline]
  );

  const jumlahFitur = dataTersaring.length;
  const rincianGeometri = useMemo(() => {
    let titik = 0;
    let jalur = 0;
    let poligon = 0;
    for (const d of dataTersaring) {
      if (d.jenisGeometri === "point") titik++;
      else if (d.jenisGeometri === "line") jalur++;
      else poligon++;
    }
    return { titik, jalur, poligon };
  }, [dataTersaring]);

  const siapkanSumberEkspor = (): DataSpasialItem[] => {
    if (hanyaSkema) return [];
    if (!lintasanJadiGaris) return dataTersaring;
    return dataTersaring.map((d) => (d.jenisGeometri === "line" ? { ...d, koordinat: [...d.koordinat] } : d));
  };

  const handleEksporSekarang = () => {
    const namaBersih = (namaFile.trim() || "Lapisan_1").replace(/\s+/g, "_");
    const sertakanPeta = jenisData === "Lapisan dan peta";
    if (!hanyaSkema && dataTersaring.length === 0 && !(sertakanPeta && petaBatasEkspor.length > 0)) {
      setStatusEkspor("⚠️ Tidak ada objek yang cocok dengan cakupan ekspor.");
      return;
    }

    const sumberData = siapkanSumberEkspor();
    const petaUntukFile = hanyaSkema ? [] : petaBatasEkspor;

    let namaBerkas = `${namaBersih}.geojson`;
    let mimeType = "application/geo+json";
    let blob: Blob;
    let isiTeks: string | undefined;

    if (formatFile === ".kml") {
      namaBerkas = `${namaBersih}.kml`;
      mimeType = "application/vnd.google-earth.kml+xml";
      isiTeks = eksporKmlDenganOpsi(sumberData, petaUntukFile, sertakanPeta);
      blob = new Blob([isiTeks], { type: mimeType });
    } else if (formatFile === ".gpx") {
      namaBerkas = `${namaBersih}.gpx`;
      mimeType = "application/gpx+xml";
      isiTeks = eksporKeGPX(sumberData);
      blob = new Blob([isiTeks], { type: mimeType });
    } else if (formatFile === ".csv") {
      namaBerkas = `${namaBersih}.csv`;
      mimeType = "text/csv;charset=utf-8";
      isiTeks = eksporKeCSV(sumberData);
      blob = new Blob([isiTeks], { type: mimeType });
    } else if (formatFile === ".geojson") {
      namaBerkas = `${namaBersih}.geojson`;
      mimeType = "application/geo+json";
      isiTeks = eksporGeoJsonDenganOpsi(sumberData, petaUntukFile, sertakanPeta);
      blob = new Blob([isiTeks], { type: mimeType });
    } else {
      const hasilShp = eksporShpDenganOpsi(sumberData, petaUntukFile, sertakanPeta);
      namaBerkas = `${namaBersih}.shp`;
      mimeType = "application/octet-stream";
      blob = new Blob([new Uint8Array(hasilShp.shp)], { type: mimeType });
    }

    unduhDariBlob(namaBerkas, blob);
    setStatusEkspor(
      hanyaSkema
        ? `✓ Skema kosong berhasil diekspor ke ${namaBerkas}`
        : `✓ Berhasil mengekspor ${sumberData.length} objek ke ${namaBerkas}`
    );
    setPesanBagikan("");
    setPaketBagikan({
      namaBerkas,
      mimeType,
      blob,
      isiTeks,
      ukuranKb: Math.max(1, Math.round(blob.size / 1024)),
      jumlahObjek: sumberData.length,
      ringkasTeks: `Data survei Titik Tapak: ${namaBerkas} (${hanyaSkema ? "skema kosong" : `${sumberData.length} fitur`})`
    });
  };

  const handleUnduhPaketShpZip = () => {
    const namaBersih = (namaFile.trim() || "Lapisan_1").replace(/\s+/g, "_");
    const sertakanPeta = jenisData === "Lapisan dan peta";
    if (!hanyaSkema && dataTersaring.length === 0 && !(sertakanPeta && petaBatasEkspor.length > 0)) {
      setStatusEkspor("⚠️ Tidak ada objek yang cocok dengan cakupan ekspor.");
      return;
    }
    const sumberData = siapkanSumberEkspor();
    const petaUntukFile = hanyaSkema ? [] : petaBatasEkspor;
    const berkasPaket = eksporPaketShapefile(sumberData, namaBersih, petaUntukFile, sertakanPeta);
    const arsipZip = buatArsipZip(berkasPaket);
    const namaBerkas = `${namaBersih}_shp.zip`;
    const blob = new Blob([new Uint8Array(arsipZip)], { type: "application/zip" });
    unduhDariBlob(namaBerkas, blob);
    setStatusEkspor(`✓ Berhasil mengunduh paket Shapefile lengkap (${berkasPaket.length} berkas) ke ${namaBerkas}`);
    setPesanBagikan("");
    setPaketBagikan({
      namaBerkas,
      mimeType: "application/zip",
      blob,
      ukuranKb: Math.max(1, Math.round(blob.size / 1024)),
      jumlahObjek: sumberData.length,
      ringkasTeks: `Paket Shapefile Titik Tapak: ${namaBerkas} (${sumberData.length} fitur)`
    });
  };

  const bagikanViaSistem = async () => {
    if (!paketBagikan) return;
    try {
      const file = new File([paketBagikan.blob], paketBagikan.namaBerkas, { type: paketBagikan.mimeType });
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: paketBagikan.namaBerkas,
            text: paketBagikan.ringkasTeks
          });
          setPesanBagikan("✓ Berkas berhasil dikirim ke aplikasi tujuan.");
          return;
        }
        await navigator.share({
          title: paketBagikan.namaBerkas,
          text: paketBagikan.ringkasTeks
        });
        setPesanBagikan("✓ Informasi dibagikan. Berkas sudah tersimpan di folder Unduhan.");
        return;
      }
      setPesanBagikan("Peramban ini tidak mendukung dialog Share bawaan. Gunakan pilihan platform di bawah atau berkas yang baru diunduh.");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setPesanBagikan("Gagal membuka dialog bagikan sistem. Berkas sudah tersimpan di perangkat Anda.");
      }
    }
  };

  const bukaPlatformSosial = (url: string, namaPlatform: string) => {
    if (!paketBagikan) return;
    unduhDariBlob(paketBagikan.namaBerkas, paketBagikan.blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setPesanBagikan(`✓ ${paketBagikan.namaBerkas} sudah disiapkan dan diunduh untuk dilampirkan ke ${namaPlatform}.`);
  };

  const salinRingkasanAtauIsi = async () => {
    if (!paketBagikan) return;
    try {
      await navigator.clipboard.writeText(paketBagikan.isiTeks || paketBagikan.ringkasTeks);
      setPesanBagikan("✓ Data berhasil disalin ke papan klip.");
    } catch {
      setPesanBagikan("Gagal menyalin ke papan klip.");
    }
  };

  return (
    <div className="avenza-fullpage-overlay">
      {/* HEADER PENGATURAN EKSPOR */}
      <header className="avenza-subpage-header">
        <div className="avenza-subpage-left">
          <button type="button" className="avenza-back-btn" onClick={onTutup} title="Kembali">
            <ArrowLeft size={24} />
          </button>
          <h2>Pengaturan ekspor</h2>
        </div>

        <button type="button" className="avenza-info-btn" onClick={() => setTampilInfo((v) => !v)} title="Informasi Ekspor">
          <Info size={22} />
        </button>
      </header>

      {tampilInfo && (
        <div className="avenza-info-banner">
          Pilih nama berkas, cakupan data, format (<strong>.geojson</strong>, <strong>.kml</strong>, <strong>.gpx</strong>,{" "}
          <strong>.csv</strong>, <strong>.shp</strong>), lalu tekan tombol kirim di kanan bawah untuk mengunduh dan membagikan ke WhatsApp,
          Google Drive, Gmail, atau aplikasi lain.
        </div>
      )}

      {/* ISI PENGATURAN EKSPOR */}
      <div className="avenza-export-body">
        {/* BAGIAN 1: NAMA FILE */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Nama file</div>

          <div className="avenza-outlined-field">
            <span className="avenza-floating-label">Nama</span>
            <input type="text" value={namaFile} onChange={(e) => setNamaFile(e.target.value)} placeholder="Lapisan 1" />
          </div>
          <div className="avenza-field-helper">Ubah nama file yang diekspor</div>
        </section>

        <div className="avenza-section-divider" />

        {/* BAGIAN 2: JENIS DATA & PENYARINGAN */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Jenis data</div>

          <div className="avenza-outlined-field select-field">
            <span className="avenza-floating-label">Ekspor</span>
            <select value={jenisData} onChange={(e) => setJenisData(e.target.value as JenisDataEkspor)}>
              <option value="Hanya lapisan">Hanya lapisan</option>
              <option value="Lapisan dan peta">Lapisan dan peta</option>
              <option value="Semua fitur terpilih">Semua fitur terpilih</option>
            </select>
            <ChevronDown size={18} className="avenza-select-arrow" />
          </div>

          <div className="avenza-export-filter-row">
            <div className="avenza-outlined-field select-field">
              <span className="avenza-floating-label">Peta Tematik</span>
              <select aria-label="Filter peta tematik" value={filterTematik} onChange={(e) => setFilterTematik(e.target.value)}>
                <option value="">Semua data</option>
                <option value="__NON_TEMATIK__">Non-Tematik (Biasa)</option>
                {opsiTematik.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="avenza-select-arrow" />
            </div>

            <div className="avenza-outlined-field select-field">
              <span className="avenza-floating-label">Kategori</span>
              <select aria-label="Filter kategori" value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}>
                <option value="">Semua kategori</option>
                {opsiKategori.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="avenza-select-arrow" />
            </div>
          </div>
        </section>

        <div className="avenza-section-divider" />

        {/* BAGIAN 3: DATA UNTUK DIEKSPOR */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Data untuk diekspor</div>

          <div
            className="avenza-export-item clickable"
            onClick={() => {
              const urutan: FormatEksporUser[] = [".geojson", ".kml", ".gpx", ".csv", ".shp"];
              const idx = urutan.indexOf(formatFile);
              setFormatFile(urutan[(idx + 1) % urutan.length]);
            }}
          >
            <div className="avenza-export-icon">
              <FileText size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">{formatFile}</div>
              <div className="avenza-export-sub">Format berkas ekspor</div>
            </div>
          </div>

          <div className="avenza-format-chips" role="group" aria-label="Pilih format ekspor">
            {(
              [
                [".geojson", "GeoJSON (.geojson)"],
                [".kml", "KML (.kml)"],
                [".gpx", "GPX (.gpx)"],
                [".csv", "CSV (.csv)"],
                [".shp", "Shapefile (.shp)"]
              ] as const
            ).map(([fmt, label]) => (
              <button
                key={fmt}
                type="button"
                aria-pressed={formatFile === fmt}
                className={`avenza-format-chip ${formatFile === fmt ? "active" : ""}`}
                onClick={() => setFormatFile(fmt)}
              >
                {label}
              </button>
            ))}
          </div>

          {formatFile === ".shp" && (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn-outline-sm" onClick={handleUnduhPaketShpZip}>
                <Download size={14} /> Unduh Paket Lengkap SHP (.zip: .shp, .shx, .dbf, .prj)
              </button>
            </div>
          )}

          {/* Hanya skema (Toggle) */}
          <div className="avenza-export-item">
            <div className="avenza-export-icon">
              <Layers size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">Hanya skema</div>
              <div className="avenza-export-sub">Fitur tidak akan diekspor</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hanyaSkema}
              aria-label="Hanya skema"
              className={`avenza-switch ${hanyaSkema ? "on" : ""}`}
              onClick={() => setHanyaSkema((v) => !v)}
            >
              <span className="avenza-switch-thumb" />
            </button>
          </div>

          {/* Jumlah objek */}
          <div className="avenza-export-item">
            <div className="avenza-export-icon">
              <MapPin size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">{hanyaSkema ? "0 objek" : `${jumlahFitur} objek`}</div>
              <div className="avenza-export-sub">
                {hanyaSkema
                  ? "Hanya struktur kolom atribut yang diekspor"
                  : `${rincianGeometri.titik} titik · ${rincianGeometri.jalur} jalur · ${rincianGeometri.poligon} area${
                      jenisData === "Lapisan dan peta" ? ` · ${petaBatasEkspor.length} batas peta` : ""
                    }`}
              </div>
            </div>
          </div>
        </section>

        <div className="avenza-section-divider" />

        {/* BAGIAN 4: SERTAKAN DALAM EKSPOR */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Sertakan dalam ekspor</div>

          <div className="avenza-export-item">
            <div className="avenza-export-icon">
              <ImageIcon size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">Foto ditautkan</div>
              <div className="avenza-export-sub">{sertakanFoto ? "Sertakan foto bukti lapangan" : "Tanpa lampiran foto"}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sertakanFoto}
              aria-label="Foto ditautkan"
              className={`avenza-switch ${sertakanFoto ? "on" : ""}`}
              onClick={() => setSertakanFoto((v) => !v)}
            >
              <span className="avenza-switch-thumb" />
            </button>
          </div>

          <div className="avenza-export-item">
            <div className="avenza-export-icon">
              <Mic size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">Memo suara dan catatan</div>
              <div className="avenza-export-sub">{sertakanMemo ? "Sertakan metadata memo suara" : "Tanpa rekaman suara"}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sertakanMemo}
              aria-label="Memo suara dan catatan"
              className={`avenza-switch ${sertakanMemo ? "on" : ""}`}
              onClick={() => setSertakanMemo((v) => !v)}
            >
              <span className="avenza-switch-thumb" />
            </button>
          </div>

          <div className="avenza-export-item">
            <div className="avenza-export-icon">
              <Tag size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">Label peta tematik</div>
              <div className="avenza-export-sub">{sertakanTematik ? "Sertakan kolom nama kolam tematik" : "Tanpa label tematik"}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sertakanTematik}
              aria-label="Label peta tematik"
              className={`avenza-switch ${sertakanTematik ? "on" : ""}`}
              onClick={() => setSertakanTematik((v) => !v)}
            >
              <span className="avenza-switch-thumb" />
            </button>
          </div>
        </section>

        <div className="avenza-section-divider" />

        {/* BAGIAN 5: TAMBAHAN */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Tambahan</div>

          <div className="avenza-export-item">
            <div className="avenza-export-icon">
              <Route size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">Lintasan menjadi garis</div>
              <div className="avenza-export-sub">Ekspor lintasan tracking sebagai garis vektor</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={lintasanJadiGaris}
              aria-label="Lintasan menjadi garis"
              className={`avenza-switch ${lintasanJadiGaris ? "on" : ""}`}
              onClick={() => setLintasanJadiGaris((v) => !v)}
            >
              <span className="avenza-switch-thumb" />
            </button>
          </div>

          {statusEkspor && (
            <div className="avenza-export-sub" role="status" style={{ padding: "8px 16px", fontWeight: 700, color: "#0d7344" }}>
              {statusEkspor}
            </div>
          )}
        </section>
      </div>

      {/* FLOATING ACTION BUTTON EKSPOR ORANYE DI POJOK KANAN BAWAH */}
      <button type="button" className="avenza-fab-orange export-fab" onClick={handleEksporSekarang} title="Ekspor sekarang">
        <Share size={24} />
      </button>

      {/* BOTTOM SHEET HALAMAN BAGIKAN MULTI-PLATFORM SETELAH EKSPOR */}
      {paketBagikan && (
        <div className="modal-backdrop avz-share-backdrop" onClick={() => setPaketBagikan(null)}>
          <div
            className="avz-share-sheet"
            role="dialog"
            aria-label="Bagikan Data Ekspor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="avz-share-head">
              <strong>1 item siap dibagikan</strong>
              <button type="button" className="btn-icon-close" aria-label="Tutup bagikan" onClick={() => setPaketBagikan(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="avz-share-file-card">
              <div className="avz-share-file-icon">
                <FileText size={20} />
              </div>
              <div className="avz-share-file-meta">
                <strong>{paketBagikan.namaBerkas}</strong>
                <span>
                  {paketBagikan.ukuranKb} KB · {paketBagikan.jumlahObjek} fitur
                </span>
              </div>
            </div>

            <button type="button" className="btn-primary avz-share-native-btn" onClick={() => void bagikanViaSistem()}>
              <Share2 size={18} /> Bagikan via Aplikasi Perangkat (Share Sheet)
            </button>

            <div className="avz-share-grid" role="group" aria-label="Bagikan ke platform">
              <button
                type="button"
                className="avz-share-app"
                onClick={() =>
                  bukaPlatformSosial(`https://wa.me/?text=${encodeURIComponent(paketBagikan.ringkasTeks)}`, "WhatsApp")
                }
              >
                <span className="avz-share-app-ico wa">
                  <MessageCircle size={20} />
                </span>
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                className="avz-share-app"
                onClick={() => bukaPlatformSosial("https://drive.google.com/drive/my-drive", "Google Drive")}
              >
                <span className="avz-share-app-ico drive">
                  <HardDrive size={20} />
                </span>
                <span>Drive</span>
              </button>

              <button
                type="button"
                className="avz-share-app"
                onClick={() =>
                  bukaPlatformSosial(
                    `mailto:?subject=${encodeURIComponent(`Data Spasial: ${paketBagikan.namaBerkas}`)}&body=${encodeURIComponent(
                      paketBagikan.ringkasTeks
                    )}`,
                    "Gmail"
                  )
                }
              >
                <span className="avz-share-app-ico mail">
                  <Mail size={20} />
                </span>
                <span>Gmail</span>
              </button>

              <button
                type="button"
                className="avz-share-app"
                onClick={() =>
                  bukaPlatformSosial(
                    `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(
                      paketBagikan.ringkasTeks
                    )}`,
                    "Telegram"
                  )
                }
              >
                <span className="avz-share-app-ico tg">
                  <Send size={20} />
                </span>
                <span>Telegram</span>
              </button>

              <button
                type="button"
                className="avz-share-app"
                onClick={() => bukaPlatformSosial("https://onedrive.live.com/", "OneDrive")}
              >
                <span className="avz-share-app-ico cloud">
                  <Cloud size={20} />
                </span>
                <span>OneDrive</span>
              </button>

              <button type="button" className="avz-share-app" onClick={() => unduhDariBlob(paketBagikan.namaBerkas, paketBagikan.blob)}>
                <span className="avz-share-app-ico dl">
                  <Download size={20} />
                </span>
                <span>Simpan</span>
              </button>

              <button type="button" className="avz-share-app" onClick={() => void salinRingkasanAtauIsi()}>
                <span className="avz-share-app-ico cp">
                  <Copy size={20} />
                </span>
                <span>Salin</span>
              </button>
            </div>

            {pesanBagikan && (
              <p className="avz-share-msg" role="status">
                {pesanBagikan}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
