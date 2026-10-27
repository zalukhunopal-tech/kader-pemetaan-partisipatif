import React, { useState } from "react";
import {
  DataSpasialItem,
  JenisGeometri,
  KaderAktifPresence,
  KategoriSurvei,
  KlaimUpahHOK,
  PengumumanBroadcast,
  ProfilKader,
  SertifikatKader,
  StatusSinkron,
  TugasPemetaan
} from "../types";
import {
  Check,
  Award,
  Banknote,
  Megaphone,
  PlusCircle,
  ShieldAlert,
  X,
  Users,
  MapPin,
  Edit3,
  Trash2,
  Battery,
  Radio,
  Eye,
  CheckCircle2,
  Clock,
  Send,
  Compass
} from "lucide-react";

interface AdminDashboardViewProps {
  dataSpasial: DataSpasialItem[];
  profilKader: ProfilKader;
  sertifikatList: SertifikatKader[];
  klaimUpahList: KlaimUpahHOK[];
  tugasList: TugasPemetaan[];
  kaderAktifList: KaderAktifPresence[];
  onVerifikasiData: (id: string, status: StatusSinkron, catatan?: string) => void;
  onUbahDataSpasial: (data: DataSpasialItem) => void;
  onHapusDataSpasial: (id: string) => void;
  onTerbitkanSertifikat: (sert: SertifikatKader) => void;
  onUpdateStatusKlaimHok: (
    id: string,
    status: KlaimUpahHOK["status"],
    catatanAdmin: string
  ) => void;
  onTambahPengumuman: (p: PengumumanBroadcast) => void;
  onTambahTugas: (t: TugasPemetaan) => void;
  onHapusTugas: (id: string) => void;
  onBalasPesanAdmin: (teks: string) => void;
  onFokusKePeta: (lat: number, lng: number, label: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  dataSpasial,
  profilKader,
  sertifikatList,
  klaimUpahList,
  tugasList,
  kaderAktifList,
  onVerifikasiData,
  onUbahDataSpasial,
  onHapusDataSpasial,
  onTerbitkanSertifikat,
  onUpdateStatusKlaimHok,
  onTambahPengumuman,
  onTambahTugas,
  onHapusTugas,
  onBalasPesanAdmin,
  onFokusKePeta
}) => {
  const [subTabAdmin, setSubTabAdmin] = useState<
    "kader_aktif" | "kelola_data" | "tugas_survei" | "sertifikat_hok"
  >("kader_aktif");

  // Modal Edit Data Spasial
  const [itemDiedit, setItemDiedit] = useState<DataSpasialItem | null>(null);

  // Form Tugas Spasial Baru
  const [judulTugas, setJudulTugas] = useState("");
  const [descTugas, setDescTugas] = useState("");
  const [wilayahTugas, setWilayahTugas] = useState("Blok Hutan Utara");
  const [geomTugas, setGeomTugas] = useState<JenisGeometri>("polygon");
  const [katTugas, setKatTugas] = useState<KategoriSurvei>("Wilayah Adat / Lahan");
  const [kuantitasTugas, setKuantitasTugas] = useState("Minimal 5,0 Ha Poligon");
  const [latTugas, setLatTugas] = useState("-0.9470");
  const [lngTugas, setLngTugas] = useState("100.4190");
  const [deadlineTugas, setDeadlineTugas] = useState("2026-11-20");

  // Form Pengumuman Baru
  const [judulAnn, setJudulAnn] = useState("");
  const [isiAnn, setIsiAnn] = useState("");
  const [katAnn, setKatAnn] =
    useState<PengumumanBroadcast["kategori"]>("Panduan Survei");

  // Form Penerbitan Sertifikat
  const [nomorSertBaru, setNomorSertBaru] = useState(
    `043/SERT-KPP/X/${new Date().getFullYear()}`
  );
  const [penandatangan, setPenandatangan] = useState("Ir. Hendra Wijaya, M.Sc.");

  // Balas cepat ke Kader
  const [balasanAdmin, setBalasanAdmin] = useState("");

  const handleBuatTugas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judulTugas.trim()) return;
    onTambahTugas({
      id: `TSK-${Date.now().toString().slice(-4)}`,
      judul: judulTugas.trim(),
      deskripsi: descTugas.trim() || "Penugasan survei lapangan dari Admin GIS.",
      targetWilayah: wilayahTugas,
      jenisTargetGeometri: geomTugas,
      kategoriTarget: katTugas,
      targetKuantitas: kuantitasTugas,
      batasWaktu: deadlineTugas,
      koordinatAcuan: {
        lat: Number(latTugas) || -0.947,
        lng: Number(lngTugas) || 100.419
      },
      status: "aktif",
      dibuatOleh: "Admin GIS Organisasi"
    });
    setJudulTugas("");
    setDescTugas("");
  };

  const handleBuatPengumuman = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judulAnn.trim() || !isiAnn.trim()) return;
    onTambahPengumuman({
      id: `ANN-${Date.now().toString().slice(-4)}`,
      judul: judulAnn.trim(),
      isi: isiAnn.trim(),
      kategori: katAnn,
      targetDesa: "Semua Wilayah",
      olehAdmin: "Admin GIS Organisasi",
      tanggal: new Date().toISOString().slice(0, 10),
      penting: true
    });
    setJudulAnn("");
    setIsiAnn("");
  };

  const handleSimpanEditData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDiedit) return;
    onUbahDataSpasial(itemDiedit);
    setItemDiedit(null);
  };

  const jumlahOnline = kaderAktifList.filter((k) => k.status !== "offline").length;

  return (
    <div className="page-container" style={{ gap: "14px" }}>
      {/* 1. HEADER PANEL ADMIN & SUB-NAVIGASI */}
      <div
        className="section-card"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          border: "1px solid #334155"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 99
                }}
              >
                ADMINISTRATOR GIS
              </span>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Koordinator Wilayah & Verifikasi Lapangan
              </span>
            </div>
            <h2 style={{ margin: "4px 0 2px", color: "#ffffff", fontSize: "1.35rem" }}>
              Panel Kendali Pemetaan Partisipatif
            </h2>
            <div style={{ fontSize: "0.82rem", color: "#38bdf8" }}>
              🟢 {jumlahOnline} Kader Terdeteksi Aktif di Lapangan • {dataSpasial.length} Data Spasial Masuk
            </div>
          </div>
        </div>

        {/* 4 TAB SUB-NAVIGASI ADMIN */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
            marginTop: 14
          }}
        >
          <button
            type="button"
            onClick={() => setSubTabAdmin("kader_aktif")}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: subTabAdmin === "kader_aktif" ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)",
              background: subTabAdmin === "kader_aktif" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.06)",
              color: "#ffffff",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            <Radio size={16} color="#38bdf8" /> Monitor Kader Aktif
          </button>

          <button
            type="button"
            onClick={() => setSubTabAdmin("kelola_data")}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: subTabAdmin === "kelola_data" ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)",
              background: subTabAdmin === "kelola_data" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.06)",
              color: "#ffffff",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            <Edit3 size={16} color="#38bdf8" /> Kelola & Ubah Data ({dataSpasial.length})
          </button>

          <button
            type="button"
            onClick={() => setSubTabAdmin("tugas_survei")}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: subTabAdmin === "tugas_survei" ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)",
              background: subTabAdmin === "tugas_survei" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.06)",
              color: "#ffffff",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            <PlusCircle size={16} color="#38bdf8" /> Masukkan Tugas Baru ({tugasList.length})
          </button>

          <button
            type="button"
            onClick={() => setSubTabAdmin("sertifikat_hok")}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: subTabAdmin === "sertifikat_hok" ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)",
              background: subTabAdmin === "sertifikat_hok" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.06)",
              color: "#ffffff",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            <Award size={16} color="#38bdf8" /> Sertifikat & 1 HOK
          </button>
        </div>
      </div>

      {/* 2. TAB A: MONITOR KADER AKTIF & LOKASI GPS (REQUESTED FITUR) */}
      {subTabAdmin === "kader_aktif" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* RADAR & MAP PRESENCE CANVAS */}
          <div className="section-card" style={{ padding: "16px 18px" }}>
            <div className="section-header-flex">
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
                  <MapPin size={20} color="#0284c7" /> Peta Lokasi Akun Kader Aktif di Lapangan
                </h3>
                <p className="text-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                  Pemantauan real-time koordinat GPS dan status pergerakan surveyor masyarakat
                </p>
              </div>
            </div>

            {/* PETA VISUAL SEBARAN KADER */}
            <div
              style={{
                marginTop: "12px",
                height: 280,
                borderRadius: "14px",
                position: "relative",
                overflow: "hidden",
                background: "linear-gradient(135deg, #092e20 0%, #064e3b 60%, #042f2e 100%)",
                border: "1px solid #059669",
                boxShadow: "inset 0 0 30px rgba(0,0,0,0.5)"
              }}
            >
              {/* Garis Grid Radar */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: "linear-gradient(rgba(52, 211, 153, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(52, 211, 153, 0.15) 1px, transparent 1px)",
                  backgroundSize: "40px 40px"
                }}
              />

              {/* Watermark Label Wilayah */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 14,
                  color: "#a7f3d0",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1
                }}
              >
                Wilayah Konservasi Desa Rimba Lestari
              </div>

              {/* Pin Koordinat Kader di Peta Visual */}
              {kaderAktifList.map((kader, idx) => {
                // Konversi lat/lng relatif ke posisi persentase radar peta
                const posX = 20 + ((kader.lng - 100.41) * 7000) % 70;
                const posY = 20 + ((Math.abs(kader.lat) - 0.94) * 5000) % 65;

                const isOnline = kader.status !== "offline";

                return (
                  <div
                    key={kader.idKader}
                    onClick={() => onFokusKePeta(kader.lat, kader.lng, kader.nama)}
                    style={{
                      position: "absolute",
                      left: `${posX}%`,
                      top: `${posY}%`,
                      transform: "translate(-50%, -50%)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      zIndex: 10
                    }}
                    title={`Klik untuk lihat di Peta: ${kader.nama} (${kader.lat}, ${kader.lng})`}
                  >
                    {/* Glowing pulse if active */}
                    {isOnline && (
                      <div
                        style={{
                          position: "absolute",
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: kader.status === "survei_aktif" ? "rgba(34, 197, 94, 0.4)" : "rgba(56, 189, 248, 0.4)",
                          animation: "pulse 2s infinite"
                        }}
                      />
                    )}

                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: kader.status === "survei_aktif" ? "#22c55e" : kader.status === "online" ? "#38bdf8" : "#94a3b8",
                        border: "2px solid #ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
                      }}
                    >
                      {idx + 1}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        background: "rgba(0, 0, 0, 0.75)",
                        color: "#ffffff",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        border: "1px solid rgba(255,255,255,0.2)"
                      }}
                    >
                      {kader.nama.split(" ")[0]}
                    </div>
                  </div>
                );
              })}

              {/* Legenda Peta Mini */}
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 12,
                  background: "rgba(0,0,0,0.7)",
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: "0.68rem",
                  color: "#e2e8f0",
                  display: "flex",
                  gap: 10
                }}
              >
                <span>🟢 Survei Aktif</span>
                <span>🔵 Online</span>
                <span>⚪ Standby/Offline</span>
              </div>
            </div>
          </div>

          {/* DAFTAR AKUN KADER AKTIF & DETAIL LOKASI */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 12px", fontSize: "1.05rem" }}>
              👥 Daftar Akun Kader Terdaftar & Lokasi Lapangan
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {kaderAktifList.map((k) => (
                <div
                  key={k.idKader}
                  style={{
                    background: "#f8faf9",
                    border: k.status === "survei_aktif" ? "1.5px solid #0d7344" : "1px solid #d5dcd8",
                    borderRadius: "14px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: k.status === "survei_aktif" ? "#22c55e" : k.status === "online" ? "#0284c7" : "#94a3b8"
                            }}
                          />
                          <strong style={{ fontSize: "0.95rem", color: "#181a19" }}>{k.nama}</strong>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                          {k.idKader} • {k.desaWilayah}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: k.status === "survei_aktif" ? "#dcfce7" : k.status === "online" ? "#e0f2fe" : "#f1f5f9",
                          color: k.status === "survei_aktif" ? "#166534" : k.status === "online" ? "#0369a1" : "#64748b"
                        }}
                      >
                        {k.status === "survei_aktif" ? "Survei Aktif" : k.status === "online" ? "Online" : "Offline"}
                      </span>
                    </div>

                    <div style={{ background: "#ffffff", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", marginTop: 8 }}>
                      <div style={{ fontSize: "0.75rem", color: "#0d7344", fontWeight: 600 }}>
                        📍 {k.aktivitasTerakhir}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#475569", fontFamily: "monospace", marginTop: 2 }}>
                        {k.lat.toFixed(5)}°, {k.lng.toFixed(5)}° (Akurasi: ±{k.akurasi}m)
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: "#64748b" }}>
                      <Battery size={13} color={k.baterai > 50 ? "#16a34a" : "#ca8a04"} />
                      <span>{k.baterai}% • {k.waktuUpdate}</span>
                    </div>

                    <button
                      type="button"
                      className="btn-outline-sm"
                      onClick={() => onFokusKePeta(k.lat, k.lng, k.nama)}
                      style={{ padding: "3px 8px", fontSize: "0.74rem" }}
                    >
                      <MapPin size={12} /> Buka Lokasi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB B: KELOLA & UBAH DATA SPASIAL (REQUESTED FITUR) */}
      {subTabAdmin === "kelola_data" && (
        <div className="section-card">
          <div className="section-header-flex">
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
                ✏️ Kelola & Ubah Data Lapangan Kader ({dataSpasial.length})
              </h3>
              <p className="text-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                Admin dapat menyunting judul, kategori, deskripsi, koordinat, memvalidasi atau menghapus data yang tidak sesuai.
              </p>
            </div>
          </div>

          {dataSpasial.length > 0 ? (
            <div className="table-responsive" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID & Kader</th>
                    <th>Kategori & Judul</th>
                    <th>Status</th>
                    <th>Tindakan Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {dataSpasial.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.namaKader}</strong>
                        <div className="text-xs text-muted">{d.id} • {d.createdAt.slice(0, 10)}</div>
                      </td>
                      <td>
                        <span className="badge-kategori">{d.kategori}</span>{" "}
                        <strong>{d.judul}</strong>
                        <div className="text-xs text-muted">{d.deskripsi}</div>
                      </td>
                      <td>
                        <span className={`badge-sync status-${d.statusSinkron}`}>
                          {d.statusSinkron.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn-outline-sm"
                            onClick={() => setItemDiedit(d)}
                            title="Ubah Data Spasial"
                          >
                            <Edit3 size={13} /> Edit Data
                          </button>
                          <button
                            type="button"
                            className="btn-primary-sm"
                            onClick={() => onVerifikasiData(d.id, "terverifikasi")}
                            title="Verifikasi Sah"
                          >
                            <Check size={13} /> Sah
                          </button>
                          <button
                            type="button"
                            className="btn-danger-sm"
                            onClick={() => onHapusDataSpasial(d.id)}
                            title="Hapus Data"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 16px", color: "#64748b" }}>
              Belum ada data lapangan yang direkam kader. Data baru akan otomatis muncul di sini untuk diperiksa admin.
            </div>
          )}
        </div>
      )}

      {/* MODAL EDIT DATA SPASIAL */}
      {itemDiedit && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 100
          }}
          onClick={() => setItemDiedit(null)}
        >
          <form
            onSubmit={handleSimpanEditData}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "20px",
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>✏️ Ubah Data Spasial: {itemDiedit.id}</h3>
              <button type="button" onClick={() => setItemDiedit(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label>Judul Objek / Temuan</label>
                <input
                  type="text"
                  className="form-input"
                  value={itemDiedit.judul}
                  onChange={(e) => setItemDiedit({ ...itemDiedit, judul: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div>
                  <label>Kategori</label>
                  <select
                    className="form-input"
                    value={itemDiedit.kategori}
                    onChange={(e) => setItemDiedit({ ...itemDiedit, kategori: e.target.value as KategoriSurvei })}
                  >
                    <option value="Flora">Flora</option>
                    <option value="Fauna">Fauna</option>
                    <option value="Mata Air">Mata Air</option>
                    <option value="Tanda Batas">Tanda Batas</option>
                    <option value="Ancaman / Temuan">Ancaman / Temuan</option>
                    <option value="Wilayah Adat / Lahan">Wilayah Adat / Lahan</option>
                  </select>
                </div>

                <div>
                  <label>Status Verifikasi</label>
                  <select
                    className="form-input"
                    value={itemDiedit.statusSinkron}
                    onChange={(e) => setItemDiedit({ ...itemDiedit, statusSinkron: e.target.value as StatusSinkron })}
                  >
                    <option value="lokal">Lokal (HP)</option>
                    <option value="tersinkron">Tersinkron GDrive</option>
                    <option value="terverifikasi">Terverifikasi Sah</option>
                    <option value="ditolak">Ditolak / Perlu Revisi</option>
                  </select>
                </div>
              </div>

              <div>
                <label>Deskripsi Lapangan</label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={itemDiedit.deskripsi}
                  onChange={(e) => setItemDiedit({ ...itemDiedit, deskripsi: e.target.value })}
                />
              </div>

              <div>
                <label>Catatan Verifikasi Admin (Untuk Kader)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Mis. Koordinat akurat dan foto jelas."
                  value={itemDiedit.catatanAdmin || ""}
                  onChange={(e) => setItemDiedit({ ...itemDiedit, catatanAdmin: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-outline-sm" onClick={() => setItemDiedit(null)}>
                Batal
              </button>
              <button type="submit" className="btn-primary-sm">
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. TAB C: MEMASUKKAN TUGAS BARU (REQUESTED FITUR) */}
      {subTabAdmin === "tugas_survei" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <form onSubmit={handleBuatTugas} className="section-card">
            <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
              🗺️ Masukkan Penugasan Pemetaan Baru untuk Kader
            </h3>
            <p className="text-muted" style={{ margin: "0 0 12px", fontSize: "0.82rem" }}>
              Tugas yang dibuat akan langsung dikirimkan ke aplikasi seluruh kader di wilayah target
            </p>

            <div className="form-row-2">
              <div>
                <label>Judul Penugasan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Pemetaan Pohon Pakan Satwa Sempadan Sungai"
                  value={judulTugas}
                  onChange={(e) => setJudulTugas(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Wilayah / Blok Target</label>
                <input
                  type="text"
                  className="form-input"
                  value={wilayahTugas}
                  onChange={(e) => setWilayahTugas(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row-3" style={{ marginTop: 8 }}>
              <div>
                <label>Jenis Geometri</label>
                <select
                  className="form-input"
                  value={geomTugas}
                  onChange={(e) => setGeomTugas(e.target.value as JenisGeometri)}
                >
                  <option value="point">Titik (Point)</option>
                  <option value="line">Jalur (Line)</option>
                  <option value="polygon">Poligon (Area)</option>
                </select>
              </div>
              <div>
                <label>Kategori Survei</label>
                <select
                  className="form-input"
                  value={katTugas}
                  onChange={(e) => setKatTugas(e.target.value as KategoriSurvei)}
                >
                  <option value="Flora">Flora</option>
                  <option value="Fauna">Fauna</option>
                  <option value="Mata Air">Mata Air</option>
                  <option value="Tanda Batas">Tanda Batas</option>
                  <option value="Wilayah Adat / Lahan">Wilayah Adat / Lahan</option>
                </select>
              </div>
              <div>
                <label>Target Kuantitas</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Mis. 50 Titik / 5 km / 5 Ha"
                  value={kuantitasTugas}
                  onChange={(e) => setKuantitasTugas(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-3" style={{ marginTop: 8 }}>
              <div>
                <label>Latitude Acuan Peta</label>
                <input
                  type="text"
                  className="form-input"
                  value={latTugas}
                  onChange={(e) => setLatTugas(e.target.value)}
                />
              </div>
              <div>
                <label>Longitude Acuan Peta</label>
                <input
                  type="text"
                  className="form-input"
                  value={lngTugas}
                  onChange={(e) => setLngTugas(e.target.value)}
                />
              </div>
              <div>
                <label>Batas Waktu Penyelesaian</label>
                <input
                  type="date"
                  className="form-input"
                  value={deadlineTugas}
                  onChange={(e) => setDeadlineTugas(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <label>Instruksi Detail untuk Kader</label>
              <textarea
                rows={2}
                className="form-input"
                placeholder="Jelaskan panduan teknis, jenis spesies pohon yang dicari, atau batas keliling lahan..."
                value={descTugas}
                onChange={(e) => setDescTugas(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <PlusCircle size={16} /> Publikasikan Tugas ke Peta Kader
            </button>
          </form>

          {/* DAFTAR TUGAS AKTIF */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "1.05rem" }}>
              📋 Daftar Penugasan Lapangan ({tugasList.length})
            </h3>
            {tugasList.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tugasList.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      background: "#f8faf9",
                      border: "1px solid #d5dcd8",
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="badge-kategori">{t.kategoriTarget}</span>
                        <strong style={{ fontSize: "0.95rem" }}>{t.judul}</strong>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 3 }}>
                        Target: <b>{t.targetKuantitas}</b> • Wilayah: {t.targetWilayah} • Batas: {t.batasWaktu}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#334155", marginTop: 2 }}>{t.deskripsi}</div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn-outline-sm"
                        onClick={() => onFokusKePeta(t.koordinatAcuan.lat, t.koordinatAcuan.lng, t.judul)}
                      >
                        <Compass size={13} /> Peta
                      </button>
                      <button
                        type="button"
                        className="btn-danger-sm"
                        onClick={() => onHapusTugas(t.id)}
                      >
                        <Trash2 size={13} /> Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                Belum ada tugas aktif. Masukkan tugas di formulir atas.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB D: SERTIFIKAT & 1 HOK */}
      {subTabAdmin === "sertifikat_hok" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* TERBITKAN SERTIFIKAT */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Award size={20} color="#0d7344" /> Penerbitan Sertifikat Resmi Kader
            </h3>
            <p className="text-muted" style={{ margin: "0 0 12px", fontSize: "0.82rem" }}>
              Terbitkan dan kirimkan sertifikat kompetensi digital resmi ke akun kader <b>{profilKader.nama}</b> ({profilKader.idKader})
            </p>

            <div className="form-row-2">
              <div>
                <label>Nomor Sertifikat</label>
                <input
                  type="text"
                  className="form-input"
                  value={nomorSertBaru}
                  onChange={(e) => setNomorSertBaru(e.target.value)}
                />
              </div>
              <div>
                <label>Pejabat Penandatangan</label>
                <input
                  type="text"
                  className="form-input"
                  value={penandatangan}
                  onChange={(e) => setPenandatangan(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 12, width: "100%" }}
              onClick={() =>
                onTerbitkanSertifikat({
                  id: `CERT-${Date.now().toString().slice(-4)}`,
                  nomorSertifikat: nomorSertBaru,
                  idKader: profilKader.idKader,
                  namaKader: profilKader.nama,
                  desaWilayah: profilKader.desaWilayah,
                  namaOrganisasi: profilKader.namaOrganisasi,
                  tanggalTerbit: new Date().toISOString().slice(0, 10),
                  alasanCapaian: "Menyelesaikan 1 Paket Capaian Survei & Pemetaan Partisipatif",
                  status: "diterbitkan",
                  ditandatanganiOleh: penandatangan,
                  jabatanPenandatangan: "Koordinator Program GIS & Pemetaan Partisipatif"
                })
              }
            >
              🏅 Sahkan & Terbitkan Sertifikat Resmi ke Akun Kader ({sertifikatList.length} Terbit)
            </button>
          </div>

          {/* PERSETUJUAN KLAIM UPAH 1 HOK */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Banknote size={20} color="#0d7344" /> Persetujuan Klaim Upah 1 HOK
            </h3>
            {klaimUpahList.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {klaimUpahList.map((k) => (
                  <div
                    key={k.id}
                    style={{
                      background: "#f8faf9",
                      border: "1px solid #d5dcd8",
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <strong>{k.namaKader} — Tiket {k.id} (1 HOK)</strong>
                      <div className="text-xs text-muted">{k.rincianBukti}</div>
                      <div className="text-xs text-emerald" style={{ marginTop: 2 }}>
                        Rp {k.nominalRupiah.toLocaleString("id-ID")} • Status: <b>{k.status.toUpperCase()}</b>
                      </div>
                    </div>
                    {k.status !== "dicairkan" && (
                      <button
                        type="button"
                        className="btn-primary-sm"
                        onClick={() => onUpdateStatusKlaimHok(k.id, "dicairkan", "Disetujui dan dicairkan oleh bendahara.")}
                      >
                        Cairkan Upah
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 20, color: "#64748b" }}>
                Belum ada pengajuan klaim 1 HOK dari kader.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
