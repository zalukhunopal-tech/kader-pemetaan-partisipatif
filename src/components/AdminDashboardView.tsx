import React, { useState } from "react";
import {
  DataSpasialItem,
  JenisGeometri,
  KaderAktifPresence,
  KategoriSurvei,
  PengumumanBroadcast,
  ProfilKader,
  SertifikatKader,
  StatusSinkron,
  TugasPemetaan
} from "../types";
import { adalahDataImpor, adalahDataSimulasi } from "../lib/geoUtils";
import { AkunSesi } from "../lib/auth";
import { AkunAdminPanel } from "./AkunAdminPanel";
import { CatatanPerangkat } from "./CatatanPerangkat";
import { buatId } from "../lib/id";
import { nomorSertifikatBerikut, ringkasanKader, siapkanSertifikat } from "../lib/sertifikat";
import { Check, Award, PlusCircle, X, MapPin, Edit3, Trash2, Battery, Radio, Compass, UserCog } from "lucide-react";

interface AdminDashboardViewProps {
  dataSpasial: DataSpasialItem[];
  profilKader: ProfilKader;
  sertifikatList: SertifikatKader[];
  tugasList: TugasPemetaan[];
  kaderAktifList: KaderAktifPresence[];
  sesiAdmin: AkunSesi | null;
  onVerifikasiData: (id: string, status: StatusSinkron, catatan?: string) => void;
  onUbahDataSpasial: (data: DataSpasialItem) => void;
  onHapusDataSpasial: (id: string) => void;
  onTerbitkanSertifikat: (sert: SertifikatKader) => void;
  onUbahPenandatanganSertifikat?: (nama: string, jabatan: string) => void;
  onTambahPengumuman: (p: PengumumanBroadcast) => void;
  onTambahTugas: (t: TugasPemetaan) => void;
  onVerifikasiTugas?: (id: string) => void;
  onHapusTugas: (id: string) => void;
  onBalasPesanAdmin: (teks: string) => void;
  onFokusKePeta: (lat: number, lng: number, label: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  dataSpasial,
  profilKader,
  sertifikatList,
  tugasList,
  kaderAktifList,
  sesiAdmin,
  onVerifikasiData,
  onUbahDataSpasial,
  onHapusDataSpasial,
  onTerbitkanSertifikat,
  onUbahPenandatanganSertifikat,
  onTambahPengumuman,
  onTambahTugas,
  onVerifikasiTugas,
  onHapusTugas,
  onFokusKePeta
}) => {
  const [subTabAdmin, setSubTabAdmin] = useState<"kader_aktif" | "kelola_data" | "tugas_survei" | "sertifikat" | "akun">("kader_aktif");

  const [itemDiedit, setItemDiedit] = useState<DataSpasialItem | null>(null);

  // Form Tugas Spasial Baru (tanpa data contoh)
  const [judulTugas, setJudulTugas] = useState("");
  const [descTugas, setDescTugas] = useState("");
  const [wilayahTugas, setWilayahTugas] = useState("");
  const [geomTugas, setGeomTugas] = useState<JenisGeometri>("polygon");
  const [katTugas, setKatTugas] = useState<KategoriSurvei>("Wilayah Adat / Lahan");
  const [kuantitasTugas, setKuantitasTugas] = useState("");
  const [latTugas, setLatTugas] = useState("-0.9470");
  const [lngTugas, setLngTugas] = useState("100.4190");
  const [deadlineTugas, setDeadlineTugas] = useState(new Date().toISOString().slice(0, 10));

  // Form Pengumuman Baru
  const [judulAnn, setJudulAnn] = useState("");
  const [isiAnn, setIsiAnn] = useState("");
  const [katAnn] = useState<PengumumanBroadcast["kategori"]>("Panduan Survei");

  // Form Penerbitan & Pengaturan Penandatangan Sertifikat
  // Nomor berikutnya mengikuti jumlah sertifikat yang sudah terbit; nomor yang diketik admin berlaku
  // sampai jumlah itu berubah (mis. setelah menerbitkan), lalu kembali ke nomor otomatis berikutnya
  const [nomorDiketik, setNomorDiketik] = useState<{ untukJumlah: number; nilai: string } | null>(null);
  const nomorSertBaru =
    nomorDiketik && nomorDiketik.untukJumlah === sertifikatList.length ? nomorDiketik.nilai : nomorSertifikatBerikut(sertifikatList);
  const setNomorSertBaru = (nilai: string) => setNomorDiketik({ untukJumlah: sertifikatList.length, nilai });
  const [pesanTerbit, setPesanTerbit] = useState<{ teks: string; ok: boolean } | null>(null);
  const [penandatangan, setPenandatangan] = useState(profilKader.namaPenandatanganSertifikat || "Koordinator Program GIS");
  const [jabatanPenandatangan, setJabatanPenandatangan] = useState(
    profilKader.jabatanPenandatanganSertifikat || "Koordinator Verifikasi Spasial"
  );

  const handleBuatTugas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judulTugas.trim()) return;
    onTambahTugas({
      id: buatId("TSK"),
      judul: judulTugas.trim(),
      deskripsi: descTugas.trim() || "Penugasan survei lapangan.",
      targetWilayah: wilayahTugas.trim() || "-",
      jenisTargetGeometri: geomTugas,
      kategoriTarget: katTugas,
      targetKuantitas: kuantitasTugas.trim() || "1 Paket",
      batasWaktu: deadlineTugas,
      koordinatAcuan: {
        lat: Number(latTugas) || -0.947,
        lng: Number(lngTugas) || 100.419
      },
      status: "aktif",
      dibuatOleh: "Admin GIS"
    });
    setJudulTugas("");
    setDescTugas("");
    setWilayahTugas("");
    setKuantitasTugas("");
  };

  const handleBuatPengumuman = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judulAnn.trim() || !isiAnn.trim()) return;
    onTambahPengumuman({
      id: buatId("ANN"),
      judul: judulAnn.trim(),
      isi: isiAnn.trim(),
      kategori: katAnn,
      targetDesa: "Semua Wilayah",
      olehAdmin: "Admin GIS",
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

  const jumlahKaderTercatat = new Set(dataSpasial.map((d) => d.idKader)).size;

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
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
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
            </div>
            <h2 style={{ margin: "6px 0 4px", color: "#ffffff", fontSize: "1.2rem", lineHeight: 1.3 }}>Kendali</h2>
            <div style={{ fontSize: "0.8rem", color: "#38bdf8", lineHeight: 1.4 }}>
              {jumlahKaderTercatat} kader • {dataSpasial.length} data di perangkat ini
            </div>
          </div>
        </div>

        {/* SUB-NAVIGASI ADMIN */}
        <nav className="admin-subnav" aria-label="Menu admin">
          {(
            [
              { id: "kader_aktif", label: "Monitor", Ikon: Radio },
              { id: "kelola_data", label: `Data (${dataSpasial.length})`, Ikon: Edit3 },
              { id: "tugas_survei", label: `Tugas (${tugasList.length})`, Ikon: PlusCircle },
              { id: "sertifikat", label: "Sertifikat", Ikon: Award },
              { id: "akun", label: "Akun", Ikon: UserCog }
            ] as const
          ).map(({ id, label, Ikon }) => (
            <button
              key={id}
              type="button"
              className={`admin-subnav-btn ${subTabAdmin === id ? "aktif" : ""}`}
              aria-pressed={subTabAdmin === id}
              onClick={() => setSubTabAdmin(id)}
            >
              <Ikon size={16} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {subTabAdmin === "akun" && <AkunAdminPanel sesiAdmin={sesiAdmin} dataSpasial={dataSpasial} sertifikatList={sertifikatList} />}

      {/* 2. TAB A: MONITOR KADER AKTIF */}
      {subTabAdmin === "kader_aktif" && (
        <div className="section-card">
          <h3 style={{ margin: "0 0 10px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={18} color="#0284c7" /> Monitor
          </h3>

          {kaderAktifList.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
              {kaderAktifList.map((k) => (
                <div
                  key={k.idKader}
                  style={{
                    background: "#f8faf9",
                    border: "1px solid #d5dcd8",
                    borderRadius: "14px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: "0.94rem" }}>{k.nama}</strong>
                      <div style={{ fontSize: "0.74rem", color: "#64748b" }}>
                        {k.idKader} • {k.desaWilayah}
                      </div>
                    </div>
                    <span className="badge-kategori">{k.status}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                      <Battery size={13} /> {k.baterai}% • {k.waktuUpdate}
                    </span>
                    <button type="button" className="btn-outline-sm" onClick={() => onFokusKePeta(k.lat, k.lng, k.nama)}>
                      <MapPin size={12} /> Peta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", background: "#f8faf9", borderRadius: 12 }}>
              Pemantauan posisi kader secara langsung belum tersedia. Setiap perangkat menyimpan datanya sendiri dan belum ada server yang
              menyatukannya, jadi posisi dan status kader di perangkat lain tidak terlihat di sini.
            </div>
          )}
        </div>
      )}

      {/* 3. TAB B: KELOLA DATA SPASIAL */}
      {subTabAdmin === "kelola_data" && (
        <div className="section-card">
          <h3 style={{ margin: "0 0 10px", fontSize: "1rem" }}>✏️ Data ({dataSpasial.length})</h3>
          <CatatanPerangkat style={{ marginBottom: 10 }}>
            Status verifikasi disimpan di perangkat ini. Data kader di perangkat lain baru bisa diverifikasi setelah masuk ke sini, misalnya
            lewat impor berkas atau pemakaian satu perangkat bersama.
          </CatatanPerangkat>

          {dataSpasial.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kader</th>
                    <th>Objek</th>
                    <th>Status</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {dataSpasial.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.namaKader}</strong>
                        <div className="text-xs text-muted">{d.id}</div>
                      </td>
                      <td>
                        <span className="badge-kategori">{d.kategori}</span>{" "}
                        {adalahDataImpor(d) && <span className="badge-kategori">IMPOR</span>}{" "}
                        {adalahDataSimulasi(d) && <span className="badge-kategori">SIMULASI</span>} <strong>{d.judul}</strong>
                      </td>
                      <td>
                        <span className={`badge-sync status-${d.statusSinkron}`} style={{ marginLeft: 0 }}>
                          {d.statusSinkron.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button type="button" className="btn-outline-sm" onClick={() => setItemDiedit(d)}>
                            <Edit3 size={13} /> Edit
                          </button>
                          <button type="button" className="btn-primary-sm" onClick={() => onVerifikasiData(d.id, "terverifikasi")}>
                            <Check size={13} /> Sah
                          </button>
                          <button type="button" className="btn-danger-sm" onClick={() => onHapusDataSpasial(d.id)}>
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
            <div style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", background: "#f8faf9", borderRadius: 12 }}>
              Belum ada data lapangan yang direkam.
            </div>
          )}
        </div>
      )}

      {/* MODAL EDIT DATA SPASIAL */}
      {itemDiedit && (
        <div className="modal-backdrop" onClick={() => setItemDiedit(null)}>
          <form onSubmit={handleSimpanEditData} className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Ubah Data: {itemDiedit.id}</h3>
              <button type="button" className="btn-icon-close" onClick={() => setItemDiedit(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-form">
              <div>
                <label>Judul Objek</label>
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
                    <option value="ditolak">Ditolak</option>
                  </select>
                </div>
              </div>

              <div>
                <label>Deskripsi</label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={itemDiedit.deskripsi}
                  onChange={(e) => setItemDiedit({ ...itemDiedit, deskripsi: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-outline-sm" onClick={() => setItemDiedit(null)}>
                Batal
              </button>
              <button type="submit" className="btn-primary-sm">
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. TAB C: TUGAS SURVEI */}
      {subTabAdmin === "tugas_survei" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <CatatanPerangkat>
            Tugas dan pengumuman hanya tersimpan di perangkat ini. Kader di perangkat lain belum menerimanya karena aplikasi belum memakai
            server.
          </CatatanPerangkat>
          <form onSubmit={handleBuatTugas} className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "1rem" }}>🗺️ Buat Tugas Pemetaan Baru</h3>

            <div className="form-row-2">
              <div>
                <label>Judul Penugasan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nama tugas survei"
                  value={judulTugas}
                  onChange={(e) => setJudulTugas(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Wilayah Target</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Blok / wilayah"
                  value={wilayahTugas}
                  onChange={(e) => setWilayahTugas(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row-3" style={{ marginTop: 8 }}>
              <div>
                <label>Jenis Geometri</label>
                <select className="form-input" value={geomTugas} onChange={(e) => setGeomTugas(e.target.value as JenisGeometri)}>
                  <option value="point">Titik (Point)</option>
                  <option value="line">Jalur (Line)</option>
                  <option value="polygon">Poligon (Area)</option>
                </select>
              </div>
              <div>
                <label>Kategori Survei</label>
                <select className="form-input" value={katTugas} onChange={(e) => setKatTugas(e.target.value as KategoriSurvei)}>
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
                  placeholder="50 Titik / 5 km / 5 Ha"
                  value={kuantitasTugas}
                  onChange={(e) => setKuantitasTugas(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-3" style={{ marginTop: 8 }}>
              <div>
                <label>Latitude</label>
                <input type="text" className="form-input" value={latTugas} onChange={(e) => setLatTugas(e.target.value)} />
              </div>
              <div>
                <label>Longitude</label>
                <input type="text" className="form-input" value={lngTugas} onChange={(e) => setLngTugas(e.target.value)} />
              </div>
              <div>
                <label>Batas Waktu</label>
                <input type="date" className="form-input" value={deadlineTugas} onChange={(e) => setDeadlineTugas(e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <label>Instruksi</label>
              <textarea
                rows={2}
                className="form-input"
                placeholder="Rincian tugas lapangan..."
                value={descTugas}
                onChange={(e) => setDescTugas(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: 12, width: "100%" }}>
              <PlusCircle size={16} /> Publikasikan Tugas
            </button>
          </form>

          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "1rem" }}>📋 Daftar Tugas ({tugasList.length})</h3>
            {tugasList.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tugasList.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      background: "#f8faf9",
                      border: "1px solid #d5dcd8",
                      borderRadius: 12,
                      padding: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10
                    }}
                  >
                    <div>
                      <span className="badge-kategori">{t.kategoriTarget}</span> <strong>{t.judul}</strong>{" "}
                      <span
                        className={`badge-sync ${
                          t.status === "selesai"
                            ? "status-terverifikasi"
                            : t.status === "menunggu_verifikasi"
                              ? "status-lokal"
                              : "status-tersinkron"
                        }`}
                      >
                        {t.status === "selesai" ? "SELESAI" : t.status === "menunggu_verifikasi" ? "MENUNGGU VERIF" : "AKTIF"}
                      </span>
                      <div className="text-xs text-muted">
                        {t.targetKuantitas} • {t.targetWilayah}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {t.status !== "selesai" && onVerifikasiTugas && (
                        <button
                          type="button"
                          className="btn-primary-sm"
                          onClick={() => onVerifikasiTugas(t.id)}
                          title="Sahkan penyelesaian tugas (+60 poin level)"
                        >
                          <Check size={13} /> Sahkan
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-outline-sm"
                        onClick={() => onFokusKePeta(t.koordinatAcuan.lat, t.koordinatAcuan.lng, t.judul)}
                      >
                        <Compass size={13} /> Peta
                      </button>
                      <button type="button" className="btn-danger-sm" onClick={() => onHapusTugas(t.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Belum ada tugas aktif.</div>
            )}
          </div>

          <form onSubmit={handleBuatPengumuman} className="section-card">
            <h3 style={{ margin: "0 0 8px", fontSize: "1rem" }}>📢 Buat Pengumuman</h3>
            <div className="form-row-2">
              <input
                type="text"
                className="form-input"
                placeholder="Judul pengumuman"
                value={judulAnn}
                onChange={(e) => setJudulAnn(e.target.value)}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Isi pesan"
                value={isiAnn}
                onChange={(e) => setIsiAnn(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-outline-sm" style={{ marginTop: 10 }}>
              Simpan Pengumuman
            </button>
          </form>
        </div>
      )}

      {/* 5. TAB D: SERTIFIKAT */}
      {subTabAdmin === "sertifikat" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Award size={18} color="#0d7344" /> Sertifikat
            </h3>

            <div className="form-row-3">
              <div>
                <label>Nomor sertifikat berikutnya</label>
                <input type="text" className="form-input" value={nomorSertBaru} onChange={(e) => setNomorSertBaru(e.target.value)} />
              </div>
              <div>
                <label>Nama Penandatangan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nama yang menandatangani sertifikat"
                  value={penandatangan}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPenandatangan(val);
                    onUbahPenandatanganSertifikat?.(val, jabatanPenandatangan);
                  }}
                />
              </div>
              <div>
                <label>Jabatan Penandatangan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Jabatan pejabat penandatangan"
                  value={jabatanPenandatangan}
                  onChange={(e) => {
                    const val = e.target.value;
                    setJabatanPenandatangan(val);
                    onUbahPenandatanganSertifikat?.(penandatangan, val);
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-outline"
                style={{ flex: "1 1 200px" }}
                onClick={() => onUbahPenandatanganSertifikat?.(penandatangan, jabatanPenandatangan)}
              >
                ✍️ Simpan Penandatangan
              </button>
            </div>

            <h4 style={{ margin: "16px 0 8px", fontSize: "0.92rem" }}>Kader dan capaian terverifikasi</h4>
            {pesanTerbit && (
              <div
                role="status"
                className="alert-banner-success"
                style={
                  pesanTerbit.ok
                    ? { margin: "0 0 8px" }
                    : { margin: "0 0 8px", background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" }
                }
              >
                {pesanTerbit.teks}
              </div>
            )}
            {ringkasanKader(dataSpasial, sertifikatList, profilKader.modeKombinasiTarget).length === 0 ? (
              <p className="text-muted" style={{ fontSize: "0.84rem", margin: 0 }}>
                Belum ada data kader. Sertifikat bisa diterbitkan setelah data kader diverifikasi.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="data-table" id="tabel-kader-sertifikat">
                  <thead>
                    <tr>
                      <th>Kader</th>
                      <th>Terverifikasi</th>
                      <th>Status</th>
                      <th>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ringkasanKader(dataSpasial, sertifikatList, profilKader.modeKombinasiTarget).map((k) => (
                      <tr key={k.idKader}>
                        <td>
                          <strong>{k.namaKader}</strong>
                          <div className="text-xs text-muted">
                            {k.idKader} • {k.desaWilayah}
                          </div>
                        </td>
                        <td className="text-xs">
                          {k.capaian.totalPoinTitik} titik • {k.capaian.totalTrackingKm.toFixed(1)} km •{" "}
                          {k.capaian.totalPoligonHa.toFixed(1)} Ha
                        </td>
                        <td>
                          <span
                            className={`badge-sync ${k.sudahTerbit ? "status-terverifikasi" : k.capaian.berhakSertifikat ? "status-tersinkron" : "status-lokal"}`}
                            style={{ marginLeft: 0 }}
                          >
                            {k.sudahTerbit ? "TERBIT" : k.capaian.berhakSertifikat ? "SIAP TERBIT" : "BELUM"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-primary-sm"
                            disabled={k.sudahTerbit || !k.capaian.berhakSertifikat}
                            title={
                              k.sudahTerbit
                                ? "Sertifikat sudah diterbitkan"
                                : k.capaian.berhakSertifikat
                                  ? "Terbitkan sertifikat untuk kader ini"
                                  : "Belum memenuhi satu paket capaian terverifikasi"
                            }
                            onClick={() => {
                              const hasil = siapkanSertifikat(k, nomorSertBaru, sertifikatList, {
                                namaOrganisasi: profilKader.namaOrganisasi,
                                ditandatanganiOleh: penandatangan,
                                jabatanPenandatangan,
                                fotoKaderBase64: k.idKader === profilKader.idKader ? profilKader.fotoKaderBase64 : undefined
                              });
                              setPesanTerbit({ teks: hasil.pesan, ok: hasil.ok });
                              if (hasil.ok && hasil.sertifikat) onTerbitkanSertifikat(hasil.sertifikat);
                            }}
                          >
                            <Award size={13} /> Terbitkan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sertifikatList.length > 0 && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {sertifikatList.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                      fontSize: "0.84rem"
                    }}
                  >
                    <div>
                      <strong>{s.nomorSertifikat}</strong> — {s.namaKader}
                      <div style={{ color: "#047857", fontSize: "0.78rem" }}>
                        Penandatangan: <strong>{s.ditandatanganiOleh}</strong> ({s.jabatanPenandatangan})
                      </div>
                    </div>
                    <span className="badge-sync status-terverifikasi">TERBIT</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
