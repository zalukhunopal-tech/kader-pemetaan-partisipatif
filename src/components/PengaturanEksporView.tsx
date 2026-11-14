import React, { useMemo, useState } from "react";
import { AreaPetaOffline, DataSpasialItem } from "../types";
import { eksporGeoJsonDenganOpsi, eksporKmlDenganOpsi, filterDataUntukEkspor, JenisDataEkspor, KonteksEkspor } from "../lib/eksporFilter";
import { buatArsipZip, eksporPaketShapefile, eksporShpDenganOpsi } from "../lib/shapefile";
import { ArrowLeft, ChevronDown, Download, FileText, Image as ImageIcon, Info, Layers, MapPin, Share } from "lucide-react";
import { useTombolEsc } from "../lib/useTombolEsc";

type FormatEksporUser = ".geojson" | ".kml" | ".shp";

interface PengaturanEksporViewProps {
  dataSpasial: DataSpasialItem[];
  areaOffline?: AreaPetaOffline[];
  konteksEkspor?: KonteksEkspor | null;
  onTutup: () => void;
}

function unduhBerkas(namaFile: string, isi: string | Uint8Array, mimeType: string) {
  const muatan: BlobPart = typeof isi === "string" ? isi : new Uint8Array(isi);
  const blob = new Blob([muatan], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const PengaturanEksporView: React.FC<PengaturanEksporViewProps> = ({
  dataSpasial,
  areaOffline = [],
  konteksEkspor = null,
  onTutup
}) => {
  useTombolEsc(true, onTutup);
  const [namaFile, setNamaFile] = useState("Ekspor AM 2");
  const adaKonteksTerpilih = Boolean(
    konteksEkspor?.petaDipilih?.length || konteksEkspor?.lapisanDipilih?.length || konteksEkspor?.fiturTerpilihIds?.length
  );
  const [jenisData, setJenisData] = useState<JenisDataEkspor>(() =>
    adaKonteksTerpilih ? "Semua fitur terpilih" : "Hanya lapisan"
  );
  const [formatFile, setFormatFile] = useState<FormatEksporUser>(".geojson");
  const [hanyaSkema, setHanyaSkema] = useState(false);
  const [sertakanFoto, setSertakanFoto] = useState(true);
  const [tampilInfo, setTampilInfo] = useState(false);
  const [statusEkspor, setStatusEkspor] = useState<string>("");

  const dataTersaring = useMemo(
    () => filterDataUntukEkspor(dataSpasial, { jenisData, konteks: konteksEkspor ?? undefined, sertakanFoto }),
    [dataSpasial, jenisData, konteksEkspor, sertakanFoto]
  );
  const petaBatasEkspor = useMemo(
    () => (konteksEkspor?.petaDipilih?.length ? konteksEkspor.petaDipilih : areaOffline),
    [konteksEkspor, areaOffline]
  );
  const jumlahFitur = dataTersaring.length;

  const handleEksporSekarang = () => {
    const namaBersih = (namaFile.trim() || "Ekspor_AM_2").replace(/\s+/g, "_");
    const sertakanPeta = jenisData === "Lapisan dan peta";
    if (!hanyaSkema && dataTersaring.length === 0 && !(sertakanPeta && petaBatasEkspor.length > 0)) {
      setStatusEkspor("⚠️ Tidak ada objek yang cocok dengan cakupan ekspor.");
      return;
    }

    const sumberData = hanyaSkema ? [] : dataTersaring;
    const petaUntukFile = hanyaSkema ? [] : petaBatasEkspor;

    if (formatFile === ".kml") {
      unduhBerkas(
        `${namaBersih}.kml`,
        eksporKmlDenganOpsi(sumberData, petaUntukFile, sertakanPeta),
        "application/vnd.google-earth.kml+xml"
      );
      setStatusEkspor(
        hanyaSkema
          ? `✓ Skema kosong berhasil diekspor ke ${namaBersih}.kml`
          : `✓ Berhasil mengekspor ${sumberData.length} objek ke ${namaBersih}.kml`
      );
    } else if (formatFile === ".geojson") {
      unduhBerkas(
        `${namaBersih}.geojson`,
        eksporGeoJsonDenganOpsi(sumberData, petaUntukFile, sertakanPeta),
        "application/geo+json"
      );
      setStatusEkspor(
        hanyaSkema
          ? `✓ Skema kosong berhasil diekspor ke ${namaBersih}.geojson`
          : `✓ Berhasil mengekspor ${sumberData.length} objek ke ${namaBersih}.geojson`
      );
    } else {
      const hasilShp = eksporShpDenganOpsi(sumberData, petaUntukFile, sertakanPeta);
      unduhBerkas(`${namaBersih}.shp`, hasilShp.shp, "application/octet-stream");
      setStatusEkspor(
        hanyaSkema
          ? `✓ Skema kosong SHP diekspor ke ${namaBersih}.shp`
          : `✓ Berhasil mengekspor ${hasilShp.jumlahFitur} fitur (${hasilShp.jenisGeometri}) ke ${namaBersih}.shp`
      );
    }
  };

  const handleUnduhPaketShpZip = () => {
    const namaBersih = (namaFile.trim() || "Ekspor_AM_2").replace(/\s+/g, "_");
    const sertakanPeta = jenisData === "Lapisan dan peta";
    if (!hanyaSkema && dataTersaring.length === 0 && !(sertakanPeta && petaBatasEkspor.length > 0)) {
      setStatusEkspor("⚠️ Tidak ada objek yang cocok dengan cakupan ekspor.");
      return;
    }
    const sumberData = hanyaSkema ? [] : dataTersaring;
    const petaUntukFile = hanyaSkema ? [] : petaBatasEkspor;
    const berkasPaket = eksporPaketShapefile(sumberData, namaBersih, petaUntukFile, sertakanPeta);
    const arsipZip = buatArsipZip(berkasPaket);
    unduhBerkas(`${namaBersih}_shp.zip`, arsipZip, "application/zip");
    setStatusEkspor(`✓ Berhasil mengunduh paket Shapefile lengkap (${berkasPaket.length} berkas) ke ${namaBersih}_shp.zip`);
  };

  return (
    <div className="avenza-fullpage-overlay">
      {/* HEADER PENGATURAN EKSPOR */}
      <header className="avenza-subpage-header">
        <div className="avenza-subpage-left">
          <button type="button" className="avenza-back-btn" onClick={onTutup} title="Kembali">
            <ArrowLeft size={24} />
          </button>
          <h2>Ekspor</h2>
        </div>

        <button type="button" className="avenza-info-btn" onClick={() => setTampilInfo((v) => !v)} title="Informasi Ekspor">
          <Info size={22} />
        </button>
      </header>

      {tampilInfo && (
        <div className="avenza-info-banner">
          Ekspor lapisan spasial ke format standar GIS (<strong>.geojson</strong>, <strong>.kml</strong>, atau <strong>.shp</strong>)
          agar siap dibuka di QGIS, Avenza Maps, Google Earth, atau ArcGIS.
        </div>
      )}

      {/* ISI PENGATURAN EKSPOR */}
      <div className="avenza-export-body">
        {/* BAGIAN 1: NAMA FILE */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Nama file</div>

          <div className="avenza-outlined-field">
            <span className="avenza-floating-label">Nama</span>
            <input type="text" value={namaFile} onChange={(e) => setNamaFile(e.target.value)} />
          </div>
          <div className="avenza-field-helper">Ubah nama file yang diekspor</div>
        </section>

        <div className="avenza-section-divider" />

        {/* BAGIAN 2: JENIS DATA */}
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
        </section>

        <div className="avenza-section-divider" />

        {/* BAGIAN 3: DATA UNTUK DIEKSPOR */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Data untuk diekspor</div>

          {/* Format (.geojson / .kml / .shp) */}
          <div
            className="avenza-export-item clickable"
            onClick={() => {
              const urutan: FormatEksporUser[] = [".geojson", ".kml", ".shp"];
              const idx = urutan.indexOf(formatFile);
              setFormatFile(urutan[(idx + 1) % urutan.length]);
            }}
          >
            <div className="avenza-export-icon">
              <FileText size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">{formatFile}</div>
              <div className="avenza-export-sub">Format (Ketuk untuk ganti: .geojson / .kml / .shp)</div>
            </div>
          </div>

          <div className="avenza-format-chips" role="group" aria-label="Pilih format ekspor">
            {(
              [
                [".geojson", "GeoJSON (.geojson)"],
                [".kml", "KML (.kml)"],
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
              className={`avenza-switch ${hanyaSkema ? "on" : ""}`}
              onClick={() => setHanyaSkema((v) => !v)}
            >
              <span className="avenza-switch-thumb" />
            </button>
          </div>

          {/* jumlah objek */}
          <div className="avenza-export-item">
            <div className="avenza-export-icon">
              <MapPin size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">{hanyaSkema ? "0 objek" : `${jumlahFitur} objek`}</div>
              <div className="avenza-export-sub">
                {konteksEkspor?.sumberLabel
                  ? `${konteksEkspor.sumberLabel}${jenisData === "Lapisan dan peta" ? " (termasuk batas peta)" : ""}`
                  : jenisData === "Lapisan dan peta"
                    ? `Semua lapisan dan ${petaBatasEkspor.length} batas peta akan diekspor`
                    : "Semua data yang dipilih akan diekspor"}
              </div>
            </div>
          </div>
        </section>

        <div className="avenza-section-divider" />

        {/* BAGIAN 4: SERTAKAN DALAM EKSPOR */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Sertakan dalam ekspor</div>

          <div
            className="avenza-export-item clickable"
            role="switch"
            tabIndex={0}
            aria-checked={sertakanFoto}
            onClick={() => setSertakanFoto((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setSertakanFoto((v) => !v);
              }
            }}
          >
            <div className="avenza-export-icon">
              <ImageIcon size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">Foto ditautkan</div>
              <div className="avenza-export-sub">{sertakanFoto ? "Sertakan tautan foto dokumentasi lapangan" : "Tanpa lampiran foto"}</div>
            </div>
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
    </div>
  );
};
