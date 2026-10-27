import React, { useState } from "react";
import { DataSpasialItem, KonfigurasiGDrive } from "../types";
import {
  eksporKeCSV,
  eksporKeGeoJSON,
  eksporKeGPX,
  eksporKeKML,
  keWKT
} from "../lib/geoUtils";
import { KODE_GOOGLE_APPS_SCRIPT } from "../lib/gdriveSync";
import {
  CloudUpload,
  CheckCircle2,
  Clock,
  Download,
  FileCode2,
  FolderGit2,
  Copy,
  Check,
  Database
} from "lucide-react";

interface DatabaseSyncViewProps {
  dataSpasial: DataSpasialItem[];
  konfigGDrive: KonfigurasiGDrive;
  sedangSinkron: boolean;
  pesanSinkron: string | null;
  onSinkronkanSekarang: () => void;
  onSimpanKonfigGDrive: (k: KonfigurasiGDrive) => void;
  onFokusKePeta: (lat: number, lng: number, label: string) => void;
}

function unduhBerkasTeks(namaFile: string, isi: string, mimeType: string) {
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

export const DatabaseSyncView: React.FC<DatabaseSyncViewProps> = ({
  dataSpasial,
  konfigGDrive,
  sedangSinkron,
  pesanSinkron,
  onSinkronkanSekarang,
  onSimpanKonfigGDrive,
  onFokusKePeta
}) => {
  const [webAppUrl, setWebAppUrl] = useState(konfigGDrive.webAppUrl);
  const [folderId, setFolderId] = useState(konfigGDrive.folderIdDatabase);
  const [sheetId, setSheetId] = useState(konfigGDrive.spreadsheetIdMaster);
  const [tampilKodeGas, setTampilKodeGas] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("semua");

  const jmlLokal = dataSpasial.filter((d) => d.statusSinkron === "lokal").length;
  const jmlTersinkron = dataSpasial.filter((d) => d.statusSinkron === "tersinkron").length;
  const jmlVerif = dataSpasial.filter((d) => d.statusSinkron === "terverifikasi").length;

  const dataTampil = dataSpasial.filter((d) =>
    filterStatus === "semua" ? true : d.statusSinkron === filterStatus
  );

  const salinKodeGas = () => {
    navigator.clipboard.writeText(KODE_GOOGLE_APPS_SCRIPT);
    setTersalin(true);
    setTimeout(() => setTersalin(false), 2000);
  };

  return (
    <div className="page-container">
      {/* RINGKASAN ANTREAN SINKRONISASI GOOGLE DRIVE */}
      <div className="section-card">
        <div className="section-header-flex">
          <div>
            <h2>☁️ Sinkronisasi Otomatis Database Google Drive & Sheets</h2>
            <p className="text-muted">
              Data lapangan disimpan di memori HP terlebih dahulu (Offline-First) dan diunggah ke
              struktur folder <code>Database_Pemetaan</code> saat terhubung ke internet.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={sedangSinkron}
            onClick={onSinkronkanSekarang}
          >
            <CloudUpload size={17} />
            {sedangSinkron
              ? "Sedang Mengunggah ke GDrive..."
              : `Sinkronkan ke GDrive (${jmlLokal} Antrean)`}
          </button>
        </div>

        {pesanSinkron && <div className="alert-banner-success">{pesanSinkron}</div>}

        <div className="stat-grid-3">
          <div
            className={`stat-box clickable ${filterStatus === "lokal" ? "active-border" : ""}`}
            onClick={() => setFilterStatus(filterStatus === "lokal" ? "semua" : "lokal")}
          >
            <span className="stat-label">📱 Tersimpan di HP (Belum Sinkron)</span>
            <strong className="stat-num text-amber">{jmlLokal} Data</strong>
            <small>Menunggu koneksi internet</small>
          </div>

          <div
            className={`stat-box clickable ${filterStatus === "tersinkron" ? "active-border" : ""}`}
            onClick={() =>
              setFilterStatus(filterStatus === "tersinkron" ? "semua" : "tersinkron")
            }
          >
            <span className="stat-label">☁️ Tersinkron ke Google Drive</span>
            <strong className="stat-num text-sky">{jmlTersinkron} Data</strong>
            <small>Masuk ke Master Sheets & Folder GIS</small>
          </div>

          <div
            className={`stat-box clickable ${
              filterStatus === "terverifikasi" ? "active-border" : ""
            }`}
            onClick={() =>
              setFilterStatus(filterStatus === "terverifikasi" ? "semua" : "terverifikasi")
            }
          >
            <span className="stat-label">✅ Terverifikasi Admin GIS</span>
            <strong className="stat-num text-emerald">{jmlVerif} Data</strong>
            <small>Dihitung sah untuk Sertifikat & HOK</small>
          </div>
        </div>

        {/* TOMBOL EKSPOR FILE SPASIAL STANDAR GIS (QGIS / ARCGIS / AVENZA) */}
        <div className="export-bar">
          <span>
            <Database size={15} /> <strong>Ekspor Langsung File Spasial & Tabel:</strong>
          </span>
          <div className="export-buttons">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() =>
                unduhBerkasTeks(
                  "Database_Pemetaan_Kader.geojson",
                  eksporKeGeoJSON(dataSpasial),
                  "application/geo+json"
                )
              }
            >
              <Download size={14} /> Unduh GeoJSON (.geojson)
            </button>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() =>
                unduhBerkasTeks(
                  "Database_Pemetaan_Kader.kml",
                  eksporKeKML(dataSpasial),
                  "application/vnd.google-earth.kml+xml"
                )
              }
            >
              <Download size={14} /> Unduh KML (.kml)
            </button>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() =>
                unduhBerkasTeks(
                  "Database_Pemetaan_Kader.gpx",
                  eksporKeGPX(dataSpasial),
                  "application/gpx+xml"
                )
              }
            >
              <Download size={14} /> Unduh GPX (.gpx)
            </button>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() =>
                unduhBerkasTeks(
                  "Master_Tabel_Pemetaan.csv",
                  eksporKeCSV(dataSpasial),
                  "text/csv;charset=utf-8"
                )
              }
            >
              <Download size={14} /> Tabel Master Sheets (.csv)
            </button>
          </div>
        </div>
      </div>

      {/* TABEL DAFTAR DATA SPASIAL & STATUS SINKRONISASI */}
      <div className="section-card">
        <h3>📋 Daftar Data Spasial Lapangan ({dataTampil.length})</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID & Waktu</th>
                <th>Geometri & Kategori</th>
                <th>Judul & Atribut Survei</th>
                <th>Ukuran / Koordinat WKT</th>
                <th>Status Sinkron</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dataTampil.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.id}</strong>
                    <div className="text-xs text-muted">{d.createdAt.slice(0, 10)}</div>
                  </td>
                  <td>
                    <span className="badge-kategori">{d.kategori}</span>
                    <div className="text-xs text-muted" style={{ marginTop: "4px" }}>
                      {d.jenisGeometri.toUpperCase()}
                    </div>
                  </td>
                  <td>
                    <strong>{d.judul}</strong>
                    {d.namaLokal && (
                      <div className="text-xs">
                        Lokal: <b>{d.namaLokal}</b>{" "}
                        {d.namaIlmiah ? `(${d.namaIlmiah})` : ""}
                      </div>
                    )}
                    <div className="text-xs text-muted">{d.deskripsi}</div>
                    {d.riwayatPembaruan.length > 0 && (
                      <div className="text-xs text-emerald">
                        ↻ {d.riwayatPembaruan.length}x Pembaruan Kondisi
                      </div>
                    )}
                  </td>
                  <td>
                    {d.jenisGeometri === "line" && <b>{d.panjangKm} km</b>}
                    {d.jenisGeometri === "polygon" && <b>{d.luasHa} Ha</b>}
                    {d.jenisGeometri === "point" && (
                      <span>Elev: {d.koordinat[0]?.elevasi ?? 400} mdpl</span>
                    )}
                    <div className="wkt-preview">{keWKT(d).slice(0, 38)}...</div>
                  </td>
                  <td>
                    <span className={`badge-sync status-${d.statusSinkron}`}>
                      {d.statusSinkron === "lokal" && (
                        <>
                          <Clock size={12} /> Tersimpan di HP
                        </>
                      )}
                      {d.statusSinkron === "tersinkron" && (
                        <>
                          <CloudUpload size={12} /> Tersinkron GDrive
                        </>
                      )}
                      {d.statusSinkron === "terverifikasi" && (
                        <>
                          <CheckCircle2 size={12} /> Terverifikasi Admin
                        </>
                      )}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-outline-sm"
                      onClick={() => {
                        if (d.koordinat[0]) {
                          onFokusKePeta(d.koordinat[0].lat, d.koordinat[0].lng, d.judul);
                        }
                      }}
                    >
                      Lihat di Peta
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* KONFIGURASI INTEGRASI GOOGLE DRIVE & KODE APPS SCRIPT */}
      <div className="section-card">
        <div className="section-header-flex">
          <div>
            <h3>
              <FolderGit2 size={18} /> Pengaturan Koneksi Google Drive & Sheets Organisasi
            </h3>
            <p className="text-muted">
              Struktur folder otomatis:{" "}
              <code>Google Drive &gt; Database_Pemetaan &gt; Data_Spasial &amp; Foto_Lapangan</code>
            </p>
          </div>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => setTampilKodeGas((v) => !v)}
          >
            <FileCode2 size={15} />{" "}
            {tampilKodeGas ? "Sembunyikan Kode Code.gs" : "Lihat / Salin Kode Google Apps Script"}
          </button>
        </div>

        <div className="form-row-3" style={{ marginTop: "12px" }}>
          <div>
            <label>URL Google Apps Script Web App</label>
            <input
              type="text"
              className="form-input"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={webAppUrl}
              onChange={(e) => setWebAppUrl(e.target.value)}
            />
          </div>
          <div>
            <label>Nama / ID Folder Induk Google Drive</label>
            <input
              type="text"
              className="form-input"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            />
          </div>
          <div>
            <label>Nama Tab Spreadsheet Master</label>
            <input
              type="text"
              className="form-input"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: "12px" }}>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() =>
              onSimpanKonfigGDrive({
                ...konfigGDrive,
                webAppUrl: webAppUrl.trim(),
                folderIdDatabase: folderId.trim() || "Database_Pemetaan",
                spreadsheetIdMaster: sheetId.trim() || "Master_Spasial"
              })
            }
          >
            Simpan Konfigurasi Google Drive
          </button>
        </div>

        {tampilKodeGas && (
          <div className="code-box-wrapper">
            <div className="code-box-header">
              <span>Kode Backend Google Apps Script (Code.gs)</span>
              <button type="button" className="btn-outline-sm" onClick={salinKodeGas}>
                {tersalin ? <Check size={14} /> : <Copy size={14} />}
                {tersalin ? "Tersalin!" : "Salin Kode"}
              </button>
            </div>
            <pre className="code-block">{KODE_GOOGLE_APPS_SCRIPT}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
