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
  Database,
  Image as ImageIcon,
  X,
  MapPin,
  ExternalLink
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

  // Modal Lightbox Preview Gambar
  const [previewFoto, setPreviewFoto] = useState<DataSpasialItem | null>(null);

  const jmlLokal = dataSpasial.filter((d) => d.statusSinkron === "lokal").length;
  const jmlTersinkron = dataSpasial.filter((d) => d.statusSinkron === "tersinkron").length;
  const jmlVerif = dataSpasial.filter((d) => d.statusSinkron === "terverifikasi").length;

  const dataTampil = dataSpasial.filter((d) =>
    filterStatus === "semua" ? true : d.statusSinkron === filterStatus
  );

  // Kumpulkan semua item yang memiliki foto
  const dataDenganFoto = dataSpasial.filter((d) => Boolean(d.fotoBase64 || d.driveFileUrl));

  const salinKodeGas = () => {
    navigator.clipboard.writeText(KODE_GOOGLE_APPS_SCRIPT);
    setTersalin(true);
    setTimeout(() => setTersalin(false), 2000);
  };

  return (
    <div className="page-container" style={{ gap: "14px" }}>
      {/* 1. RINGKASAN STATUS SINKRONISASI GOOGLE DRIVE */}
      <div className="section-card">
        <div className="section-header-flex">
          <div>
            <h2 style={{ fontSize: "1.25rem", margin: "0 0 4px" }}>
              ☁️ Sinkronisasi
            </h2>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.86rem" }}>
              Data tersimpan di perangkat lalu diunggah otomatis saat sinyal tersedia.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={sedangSinkron}
            onClick={onSinkronkanSekarang}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <CloudUpload size={17} />
            {sedangSinkron
              ? "Sedang Mengunggah..."
              : `Sinkronkan Sekarang (${jmlLokal} Antrean)`}
          </button>
        </div>

        {pesanSinkron && <div className="alert-banner-success" style={{ marginTop: 12 }}>{pesanSinkron}</div>}

        <div className="stat-grid-3" style={{ marginTop: 14 }}>
          <div
            className={`stat-box clickable ${filterStatus === "lokal" ? "active-border" : ""}`}
            onClick={() => setFilterStatus(filterStatus === "lokal" ? "semua" : "lokal")}
          >
            <span className="stat-label">📱 Tersimpan di HP (Lokal)</span>
            <strong className="stat-num text-amber">{jmlLokal} Data</strong>
            <small>Menunggu koneksi internet</small>
          </div>

          <div
            className={`stat-box clickable ${filterStatus === "tersinkron" ? "active-border" : ""}`}
            onClick={() => setFilterStatus(filterStatus === "tersinkron" ? "semua" : "tersinkron")}
          >
            <span className="stat-label">☁️ Tersinkron ke Drive</span>
            <strong className="stat-num text-sky">{jmlTersinkron} Data</strong>
            <small>Tersimpan di Master Sheets</small>
          </div>

          <div
            className={`stat-box clickable ${filterStatus === "terverifikasi" ? "active-border" : ""}`}
            onClick={() => setFilterStatus(filterStatus === "terverifikasi" ? "semua" : "terverifikasi")}
          >
            <span className="stat-label">✅ Terverifikasi Admin</span>
            <strong className="stat-num text-emerald">{jmlVerif} Data</strong>
            <small>Dihitung sah untuk Sertifikat</small>
          </div>
        </div>
      </div>

      {/* 2. PREVIEW GAMBAR & FOTO HASIL SURVEI (REQUESTED FITUR) */}
      <div className="section-card">
        <div className="section-header-flex">
          <div>
            <h3 style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8, fontSize: "1.05rem" }}>
              <ImageIcon size={20} color="#0d7344" /> Foto ({dataDenganFoto.length})
            </h3>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Dokumentasi foto survei lapangan
            </p>
          </div>
        </div>

        {dataDenganFoto.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "12px",
              marginTop: "14px"
            }}
          >
            {dataDenganFoto.map((item) => (
              <div
                key={item.id}
                onClick={() => setPreviewFoto(item)}
                style={{
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid #d5dcd8",
                  background: "#ffffff",
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                }}
              >
                <div style={{ width: "100%", height: 130, position: "relative", background: "#f1f5f3" }}>
                  <img
                    src={item.fotoBase64 || item.driveFileUrl}
                    alt={item.judul}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      bottom: 6,
                      left: 6,
                      background: "rgba(0,0,0,0.65)",
                      color: "#ffffff",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4
                    }}
                  >
                    {item.kategori}
                  </span>
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#181a19", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.judul}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 2 }}>
                    {item.namaKader} • {item.createdAt.slice(0, 10)}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 99,
                        background: item.statusSinkron === "tersinkron" ? "#e0f2fe" : item.statusSinkron === "terverifikasi" ? "#dcfce7" : "#fef3c7",
                        color: item.statusSinkron === "tersinkron" ? "#0284c7" : item.statusSinkron === "terverifikasi" ? "#166534" : "#b45309"
                      }}
                    >
                      {item.statusSinkron === "tersinkron" ? "☁️ GDrive" : item.statusSinkron === "terverifikasi" ? "✅ Verif" : "📱 HP"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: "28px 20px",
              textAlign: "center",
              background: "#f8faf9",
              border: "1.5px dashed #cbd5e1",
              borderRadius: "14px",
              marginTop: "12px"
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#e8f5ee", color: "#0d7344", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <ImageIcon size={24} />
            </div>
            <h5 style={{ margin: "0 0 6px", fontSize: "0.95rem", color: "#1e293b" }}>
              Belum Ada Foto Survei Lapangan
            </h5>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", maxWidth: 360, marginInline: "auto" }}>
              Ambil foto dokumentasi pohon, satwa, atau mata air saat merekam data di menu <b>Temukan (Peta)</b>. Foto akan otomatis tampil di sini dan siap disinkronkan ke Google Drive.
            </p>
          </div>
        )}
      </div>

      {/* 3. TABEL DATA SPASIAL HASIL SURVEI (TANPA DATA CONTOH) */}
      <div className="section-card">
        <div className="section-header-flex">
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
              📋 Data ({dataTampil.length})
            </h3>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Daftar objek spasial hasil perekaman
            </p>
          </div>

          {/* TOMBOL EKSPOR FILE SPASIAL STANDAR */}
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
              <Download size={13} /> GeoJSON
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
              <Download size={13} /> KML
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
              <Download size={13} /> CSV
            </button>
          </div>
        </div>

        {dataTampil.length > 0 ? (
          <div className="table-responsive" style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID & Waktu</th>
                  <th>Kategori & Geometri</th>
                  <th>Judul Objek</th>
                  <th>Foto</th>
                  <th>Status</th>
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
                      <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                        {d.jenisGeometri.toUpperCase()}
                      </div>
                    </td>
                    <td>
                      <strong>{d.judul}</strong>
                      <div className="text-xs text-muted">{d.deskripsi}</div>
                    </td>
                    <td>
                      {d.fotoBase64 || d.driveFileUrl ? (
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => setPreviewFoto(d)}
                          style={{ padding: "2px 8px", fontSize: "0.72rem" }}
                        >
                          📷 Lihat
                        </button>
                      ) : (
                        <span className="text-xs text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge-sync status-${d.statusSinkron}`}>
                        {d.statusSinkron === "lokal" && <Clock size={11} />}
                        {d.statusSinkron === "tersinkron" && <CloudUpload size={11} />}
                        {d.statusSinkron === "terverifikasi" && <CheckCircle2 size={11} />}
                        <span style={{ marginLeft: 3 }}>{d.statusSinkron.toUpperCase()}</span>
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
                        Peta
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", fontSize: "0.86rem" }}>
            Belum ada data spasial tersimpan. Buka menu <b>Temukan (Peta)</b> untuk mulai merekam titik, jejak langkah, atau poligon survei lapangan.
          </div>
        )}
      </div>

      {/* 4. MODAL LIGHTBOX PREVIEW GAMBAR */}
      {previewFoto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 100
          }}
          onClick={() => setPreviewFoto(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: 500,
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: "relative", width: "100%", maxHeight: 320, background: "#000" }}>
              <img
                src={previewFoto.fotoBase64 || previewFoto.driveFileUrl}
                alt={previewFoto.judul}
                style={{ width: "100%", height: "100%", maxHeight: 320, objectFit: "contain", display: "block" }}
              />
              <button
                type="button"
                onClick={() => setPreviewFoto(null)}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)",
                  color: "#ffffff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span className="badge-kategori">{previewFoto.kategori}</span>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{previewFoto.createdAt.slice(0, 10)}</span>
              </div>
              <h4 style={{ margin: "0 0 6px", fontSize: "1.1rem", color: "#181a19" }}>
                {previewFoto.judul}
              </h4>
              <p style={{ margin: "0 0 10px", fontSize: "0.84rem", color: "#475569" }}>
                {previewFoto.deskripsi || "Foto dokumentasi survei lapangan kader."}
              </p>

              {previewFoto.koordinat[0] && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "#0d7344", marginBottom: 14 }}>
                  <MapPin size={14} />
                  <span>
                    Lat: {previewFoto.koordinat[0].lat.toFixed(5)}°, Lng: {previewFoto.koordinat[0].lng.toFixed(5)}°
                  </span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                {previewFoto.koordinat[0] && (
                  <button
                    type="button"
                    className="btn-primary-sm"
                    onClick={() => {
                      onFokusKePeta(
                        previewFoto.koordinat[0].lat,
                        previewFoto.koordinat[0].lng,
                        previewFoto.judul
                      );
                      setPreviewFoto(null);
                    }}
                  >
                    Buka di Peta
                  </button>
                )}
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => setPreviewFoto(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. KONFIGURASI GOOGLE APPS SCRIPT WEB APP */}
      <div className="section-card">
        <div className="section-header-flex">
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <FolderGit2 size={18} color="#0d7344" /> Konfigurasi
            </h3>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Koneksikan ke Web App Google Apps Script organisasi Anda
            </p>
          </div>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => setTampilKodeGas((v) => !v)}
          >
            <FileCode2 size={14} /> {tampilKodeGas ? "Tutup Kode" : "Salin Code.gs"}
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
            <label>Folder Google Drive</label>
            <input
              type="text"
              className="form-input"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            />
          </div>
          <div>
            <label>Nama Tab Spreadsheet</label>
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
            Simpan Konfigurasi
          </button>
        </div>

        {tampilKodeGas && (
          <div className="code-box-wrapper" style={{ marginTop: 12 }}>
            <div className="code-box-header">
              <span>Backend Google Apps Script (Code.gs)</span>
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
