import React, { useState } from "react";
import { DataSpasialItem } from "../types";
import {
  eksporKeCSV,
  eksporKeGeoJSON,
  eksporKeGPX,
  eksporKeKML
} from "../lib/geoUtils";
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Info,
  Layers,
  MapPin,
  Share
} from "lucide-react";

interface PengaturanEksporViewProps {
  dataSpasial: DataSpasialItem[];
  onTutup: () => void;
}

function unduhBerkas(namaFile: string, isi: string, mimeType: string) {
  const blob = new Blob([isi], { type: mimeType });
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
  onTutup
}) => {
  const [namaFile, setNamaFile] = useState("Ekspor AM 2");
  const [jenisData, setJenisData] = useState("Hanya lapisan");
  const [formatFile, setFormatFile] = useState<".kml" | ".geojson" | ".gpx" | ".csv">(".kml");
  const [hanyaSkema, setHanyaSkema] = useState(false);
  const [sertakanFoto, setSertakanFoto] = useState(true);
  const [tampilInfo, setTampilInfo] = useState(false);

  // Total fitur riil sesuai data spasial lapangan
  const jumlahFitur = dataSpasial.length;

  const handleEksporSekarang = () => {
    const namaBersih = (namaFile.trim() || "Ekspor_AM_2").replace(/\s+/g, "_");
    const sumberData = hanyaSkema ? [] : dataSpasial;

    if (formatFile === ".kml") {
      unduhBerkas(
        `${namaBersih}.kml`,
        eksporKeKML(sumberData),
        "application/vnd.google-earth.kml+xml"
      );
    } else if (formatFile === ".geojson") {
      unduhBerkas(
        `${namaBersih}.geojson`,
        eksporKeGeoJSON(sumberData),
        "application/geo+json"
      );
    } else if (formatFile === ".gpx") {
      unduhBerkas(
        `${namaBersih}.gpx`,
        eksporKeGPX(sumberData),
        "application/gpx+xml"
      );
    } else {
      unduhBerkas(
        `${namaBersih}.csv`,
        eksporKeCSV(sumberData),
        "text/csv;charset=utf-8"
      );
    }
  };

  return (
    <div className="avenza-fullpage-overlay">
      {/* HEADER PENGATURAN EKSPOR */}
      <header className="avenza-subpage-header">
        <div className="avenza-subpage-left">
          <button
            type="button"
            className="avenza-back-btn"
            onClick={onTutup}
            title="Kembali"
          >
            <ArrowLeft size={24} />
          </button>
          <h2>Ekspor</h2>
        </div>

        <button
          type="button"
          className="avenza-info-btn"
          onClick={() => setTampilInfo((v) => !v)}
          title="Informasi Ekspor"
        >
          <Info size={22} />
        </button>
      </header>

      {tampilInfo && (
        <div className="avenza-info-banner">
          Ekspor lapisan spasial ke format standar GIS (<strong>.kml</strong>,{" "}
          <strong>.geojson</strong>, <strong>.gpx</strong>, atau <strong>.csv</strong>)
          agar siap dibuka di Avenza Maps, QGIS, Google Earth, atau diunggah ke Google Drive.
        </div>
      )}

      {/* ISI PENGATURAN EKSPOR SESUAI SCREENSHOT 4 */}
      <div className="avenza-export-body">
        {/* BAGIAN 1: NAMA FILE */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Nama file</div>

          <div className="avenza-outlined-field">
            <span className="avenza-floating-label">Nama</span>
            <input
              type="text"
              value={namaFile}
              onChange={(e) => setNamaFile(e.target.value)}
            />
          </div>
          <div className="avenza-field-helper">Ubah nama file yang diekspor</div>
        </section>

        <div className="avenza-section-divider" />

        {/* BAGIAN 2: JENIS DATA */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Jenis data</div>

          <div className="avenza-outlined-field select-field">
            <span className="avenza-floating-label">Ekspor</span>
            <select
              value={jenisData}
              onChange={(e) => setJenisData(e.target.value)}
            >
              <option value="Hanya lapisan">Hanya lapisan</option>
              <option value="Lapisan dan peta">Lapisan dan atribut lengkap</option>
              <option value="Semua fitur terpilih">Semua fitur terpilih</option>
            </select>
            <ChevronDown size={18} className="avenza-select-arrow" />
          </div>
        </section>

        <div className="avenza-section-divider" />

        {/* BAGIAN 3: DATA UNTUK DIEKSPOR */}
        <section className="avenza-export-section">
          <div className="avenza-section-title">Data untuk diekspor</div>

          {/* Format (.kml / .geojson / .gpx / .csv) */}
          <div
            className="avenza-export-item clickable"
            onClick={() => {
              const urutan: (".kml" | ".geojson" | ".gpx" | ".csv")[] = [
                ".kml",
                ".geojson",
                ".gpx",
                ".csv"
              ];
              const idx = urutan.indexOf(formatFile);
              setFormatFile(urutan[(idx + 1) % urutan.length]);
            }}
          >
            <div className="avenza-export-icon">
              <FileText size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">{formatFile}</div>
              <div className="avenza-export-sub">Format (Ketuk untuk ganti: .kml / .geojson / .gpx / .csv)</div>
            </div>
          </div>

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

          {/* 203 features */}
          <div className="avenza-export-item">
            <div className="avenza-export-icon">
              <MapPin size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">
                {hanyaSkema ? "0 features" : `${jumlahFitur} features`}
              </div>
              <div className="avenza-export-sub">
                Semua data yang dipilih akan diekspor
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
            onClick={() => setSertakanFoto((v) => !v)}
          >
            <div className="avenza-export-icon">
              <ImageIcon size={22} />
            </div>
            <div className="avenza-export-text">
              <div className="avenza-export-main">Foto ditautkan</div>
              <div className="avenza-export-sub">
                {sertakanFoto ? "Sertakan tautan foto dokumentasi lapangan" : "Tanpa lampiran foto"}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* FLOATING ACTION BUTTON EKSPOR ORANYE DI POJOK KANAN BAWAH */}
      <button
        type="button"
        className="avenza-fab-orange export-fab"
        onClick={handleEksporSekarang}
        title="Ekspor & Unduh File Sekarang"
      >
        <Share size={24} />
      </button>
    </div>
  );
};
