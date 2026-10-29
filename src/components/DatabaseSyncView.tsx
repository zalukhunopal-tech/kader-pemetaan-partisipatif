import React, { useState } from "react";
import { DataSpasialItem } from "../types";
import { eksporKeCSV, eksporKeGeoJSON, eksporKeKML } from "../lib/geoUtils";
import { gdriveTerpasang, tujuanDrive } from "../lib/gdriveSync";
import { muatSemuaAkun } from "../lib/auth";
import { teksWilayah, wilayahLengkap } from "../lib/wilayah";
import { CloudUpload, CheckCircle2, Clock, Download, Folder, Image as ImageIcon, X, MapPin, Copy, Check, FileCode, ExternalLink } from "lucide-react";
import { KODE_APPS_SCRIPT, MANIFES_APPS_SCRIPT } from "../lib/skripAppsScript";

interface DatabaseSyncViewProps {
  dataSpasial: DataSpasialItem[];
  terakhirSinkron?: string;
  sedangSinkron: boolean;
  pesanSinkron: string | null;
  pesanSinkronGagal: boolean;
  sedangOnline: boolean;
  onSinkronkanSekarang: () => void;
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
  terakhirSinkron,
  sedangSinkron,
  pesanSinkron,
  pesanSinkronGagal,
  sedangOnline,
  onSinkronkanSekarang,
  onFokusKePeta
}) => {
  const [filterStatus, setFilterStatus] = useState<string>("semua");

  // Modal Lightbox Preview Gambar
  const [previewFoto, setPreviewFoto] = useState<DataSpasialItem | null>(null);

  // Modal Panduan & Salin Skrip Apps Script
  const [bukaPanduanScript, setBukaPanduanScript] = useState<boolean>(false);
  const [salinCodeGs, setSalinCodeGs] = useState<boolean>(false);
  const [salinManifest, setSalinManifest] = useState<boolean>(false);
  const [tabPanduan, setTabPanduan] = useState<"code" | "manifest">("code");

  const jmlLokal = dataSpasial.filter((d) => d.statusSinkron === "lokal").length;
  const sudahTersambung = gdriveTerpasang();
  const jmlTersinkron = dataSpasial.filter((d) => d.statusSinkron === "tersinkron").length;
  const jmlVerif = dataSpasial.filter((d) => d.statusSinkron === "terverifikasi").length;

  const dataTampil = dataSpasial.filter((d) => (filterStatus === "semua" ? true : d.statusSinkron === filterStatus));

  // Kumpulkan semua item yang memiliki foto
  const dataDenganFoto = dataSpasial.filter((d) => Boolean(d.fotoBase64 || d.driveFileUrl));

  // Folder wilayah dan nama berkas tujuan di Drive, dari wilayah akun pembuat (diisi admin)
  const wilayahPerAkun = new Map(muatSemuaAkun().map((a) => [a.idKader, a.wilayah]));
  const tujuan = (d: DataSpasialItem) => tujuanDrive(d, (id) => wilayahPerAkun.get(id));
  const antreanTanpaWilayah = dataSpasial.filter((d) => d.statusSinkron === "lokal" && !wilayahLengkap(tujuan(d).wilayah)).length;

  return (
    <div className="page-container" style={{ gap: "14px" }}>
      {/* 1. RINGKASAN STATUS SINKRONISASI GOOGLE DRIVE */}
      <div className="section-card">
        <div className="section-header-flex">
          <div>
            <h2 style={{ fontSize: "1.25rem", margin: "0 0 4px" }}>☁️ Sinkronisasi</h2>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.86rem" }}>
              Data tersimpan di HP lalu diunggah otomatis ke Google Drive saat ada internet, ke folder Provinsi › Kabupaten/Kota › Kecamatan
              › Kelurahan/Desa milik akun pembuatnya.
              {terakhirSinkron ? ` Terakhir berhasil: ${terakhirSinkron}.` : ""}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={sedangSinkron || !sudahTersambung || !sedangOnline}
            onClick={onSinkronkanSekarang}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <CloudUpload size={17} />
            {sedangSinkron ? "Sedang Mengunggah..." : `Sinkronkan Sekarang (${jmlLokal} Antrean)`}
          </button>
        </div>

        {!sudahTersambung && (
          <div
            id="gdrive-belum-aktif"
            className="alert-banner-success"
            style={{
              marginTop: 12,
              background: "#fef3c7",
              borderColor: "#f59e0b",
              color: "#92400e",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px"
            }}
          >
            <div>
              Unggahan ke Google Drive belum aktif di aplikasi ini. Data tetap aman di HP; hubungi admin.
            </div>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => setBukaPanduanScript(true)}
              style={{
                fontSize: "0.8rem",
                padding: "5px 11px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "#ffffff",
                borderColor: "#d97706",
                color: "#92400e",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              <FileCode size={14} />
              Lihat & Salin File Code.gs
            </button>
          </div>
        )}
        {sudahTersambung && (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setBukaPanduanScript(true)}
              style={{
                fontSize: "0.8rem",
                color: "#059669",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: 0,
                textDecoration: "underline"
              }}
            >
              <FileCode size={13} />
              Lihat Skrip Apps Script (Code.gs)
            </button>
          </div>
        )}
        {antreanTanpaWilayah > 0 && (
          <div
            id="peringatan-wilayah"
            className="alert-banner-success"
            style={{ marginTop: 12, background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}
          >
            {antreanTanpaWilayah} data belum punya wilayah lengkap dan akan masuk folder Wilayah_Belum_Diisi. Admin dapat melengkapi wilayah
            akun di Admin › Akun.
          </div>
        )}
        {sudahTersambung && !sedangOnline && (
          <div className="alert-banner-success" style={{ marginTop: 12, background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}>
            Sedang offline. Antrean akan diunggah setelah koneksi kembali.
          </div>
        )}
        {pesanSinkron && (
          <div
            className="alert-banner-success"
            style={
              pesanSinkronGagal ? { marginTop: 12, background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" } : { marginTop: 12 }
            }
          >
            {pesanSinkron}
          </div>
        )}

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
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      color: "#181a19",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
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
                        background:
                          item.statusSinkron === "tersinkron" ? "#e0f2fe" : item.statusSinkron === "terverifikasi" ? "#dcfce7" : "#fef3c7",
                        color:
                          item.statusSinkron === "tersinkron" ? "#0284c7" : item.statusSinkron === "terverifikasi" ? "#166534" : "#b45309"
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
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#e8f5ee",
                color: "#0d7344",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10
              }}
            >
              <ImageIcon size={24} />
            </div>
            <h5 style={{ margin: "0 0 6px", fontSize: "0.95rem", color: "#1e293b" }}>Belum Ada Foto Survei Lapangan</h5>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", maxWidth: 360, marginInline: "auto" }}>
              Ambil foto dokumentasi pohon, satwa, atau mata air saat merekam data di menu <b>Temukan (Peta)</b>. Foto akan otomatis tampil
              di sini dan siap disinkronkan ke Google Drive.
            </p>
          </div>
        )}
      </div>

      {/* 3. TABEL DATA SPASIAL HASIL SURVEI (TANPA DATA CONTOH) */}
      <div className="section-card">
        <div className="section-header-flex">
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>📋 Data ({dataTampil.length})</h3>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Daftar objek spasial hasil perekaman
            </p>
          </div>

          {/* TOMBOL EKSPOR FILE SPASIAL STANDAR */}
          <div className="export-buttons">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => unduhBerkasTeks("Database_Pemetaan_Kader.geojson", eksporKeGeoJSON(dataSpasial), "application/geo+json")}
            >
              <Download size={13} /> GeoJSON
            </button>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() =>
                unduhBerkasTeks("Database_Pemetaan_Kader.kml", eksporKeKML(dataSpasial), "application/vnd.google-earth.kml+xml")
              }
            >
              <Download size={13} /> KML
            </button>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => unduhBerkasTeks("Master_Tabel_Pemetaan.csv", eksporKeCSV(dataSpasial), "text/csv;charset=utf-8")}
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
                      <div className="text-xs text-muted tujuan-drive" title="Folder dan nama berkas di Google Drive">
                        <Folder size={11} /> {teksWilayah(tujuan(d).wilayah)} / {tujuan(d).namaBerkas}
                      </div>
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
            Belum ada data spasial tersimpan. Buka menu <b>Temukan (Peta)</b> untuk mulai merekam titik, jejak langkah, atau poligon survei
            lapangan.
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
              <h4 style={{ margin: "0 0 6px", fontSize: "1.1rem", color: "#181a19" }}>{previewFoto.judul}</h4>
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
                      onFokusKePeta(previewFoto.koordinat[0].lat, previewFoto.koordinat[0].lng, previewFoto.judul);
                      setPreviewFoto(null);
                    }}
                  >
                    Buka di Peta
                  </button>
                )}
                <button type="button" className="btn-outline-sm" onClick={() => setPreviewFoto(null)}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Panduan & Salin Skrip Google Apps Script (Code.gs) */}
      {bukaPanduanScript && (
        <div
          className="modal-backdrop"
          onClick={() => setBukaPanduanScript(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)"
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "#d1fae5", padding: "7px", borderRadius: "8px", color: "#065f46", display: "flex" }}>
                  <FileCode size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#0f172a" }}>Skrip Google Apps Script (Code.gs)</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    Berkas di proyek: <code>apps-script/Code.gs</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBukaPanduanScript(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "18px 20px", overflowY: "auto", fontSize: "0.88rem", color: "#334155" }}>
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "10px", padding: "12px 14px", marginBottom: "14px" }}>
                <strong style={{ color: "#065f46", display: "block", marginBottom: "4px" }}>💡 Panduan Singkat Pemasangan:</strong>
                <ol style={{ margin: 0, paddingLeft: "18px", lineHeight: "1.6", color: "#047857", fontSize: "0.84rem" }}>
                  <li>
                    Buka <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", fontWeight: 600, color: "#047857" }}>script.google.com</a> dengan akun Google Anda, buat <b>Proyek baru</b>.
                  </li>
                  <li>Klik tombol hijau <b>Salin Seluruh Kode</b> di bawah, lalu tempel ke file <code>Code.gs</code> di Apps Script.</li>
                  <li>Pilih fungsi <b>pasangTitikTapak</b> (atau <code>pasangGeoKader</code>) lalu klik <b>Jalankan</b> (izinkan akses Drive).</li>
                  <li>Klik <b>Terapkan &gt; Deployment baru &gt; Aplikasi web</b> (Akses: <i>Siapa saja</i>). Salin URL <code>/exec</code> dan token dari log.</li>
                </ol>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
                <button
                  type="button"
                  onClick={() => setTabPanduan("code")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: tabPanduan === "code" ? "#0d7344" : "#f1f5f9",
                    color: tabPanduan === "code" ? "#ffffff" : "#475569"
                  }}
                >
                  📄 File: apps-script/Code.gs
                </button>
                <button
                  type="button"
                  onClick={() => setTabPanduan("manifest")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: tabPanduan === "manifest" ? "#0d7344" : "#f1f5f9",
                    color: tabPanduan === "manifest" ? "#ffffff" : "#475569"
                  }}
                >
                  ⚙️ File: apps-script/appsscript.json
                </button>
              </div>

              {/* Actions & Code Box */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  {tabPanduan === "code" ? "Skrip penerima data Titik Tapak (400 baris)" : "Manifes zona waktu Asia/Jakarta"}
                </span>
                <button
                  type="button"
                  className="btn-primary-sm"
                  onClick={() => {
                    const teks = tabPanduan === "code" ? KODE_APPS_SCRIPT : MANIFES_APPS_SCRIPT;
                    navigator.clipboard.writeText(teks);
                    if (tabPanduan === "code") {
                      setSalinCodeGs(true);
                      setTimeout(() => setSalinCodeGs(false), 2000);
                    } else {
                      setSalinManifest(true);
                      setTimeout(() => setSalinManifest(false), 2000);
                    }
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", padding: "6px 12px" }}
                >
                  {(tabPanduan === "code" ? salinCodeGs : salinManifest) ? (
                    <>
                      <Check size={14} /> Berhasil Disalin!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Salin Seluruh Kode
                    </>
                  )}
                </button>
              </div>

              <pre
                style={{
                  background: "#0f172a",
                  color: "#e2e8f0",
                  padding: "14px",
                  borderRadius: "8px",
                  fontSize: "0.78rem",
                  lineHeight: "1.5",
                  maxHeight: "320px",
                  overflowY: "auto",
                  margin: 0,
                  fontFamily: "monospace"
                }}
              >
                <code>{tabPanduan === "code" ? KODE_APPS_SCRIPT : MANIFES_APPS_SCRIPT}</code>
              </pre>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc"
              }}
            >
              <a
                href="https://script.google.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.84rem", color: "#0d7344", fontWeight: 600 }}
              >
                Buka script.google.com <ExternalLink size={13} />
              </a>
              <button type="button" className="btn-outline-sm" onClick={() => setBukaPanduanScript(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
