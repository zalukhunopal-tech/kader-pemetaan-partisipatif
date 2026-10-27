import React, { useState } from "react";
import {
  DataSpasialItem,
  JenisGeometri,
  KategoriSurvei,
  KlaimUpahHOK,
  PengumumanBroadcast,
  ProfilKader,
  SertifikatKader,
  StatusSinkron,
  TugasPemetaan
} from "../types";
import { Check, Award, Banknote, Megaphone, PlusCircle, ShieldAlert, X } from "lucide-react";

interface AdminDashboardViewProps {
  dataSpasial: DataSpasialItem[];
  profilKader: ProfilKader;
  sertifikatList: SertifikatKader[];
  klaimUpahList: KlaimUpahHOK[];
  onVerifikasiData: (id: string, status: StatusSinkron, catatan?: string) => void;
  onTerbitkanSertifikat: (sert: SertifikatKader) => void;
  onUpdateStatusKlaimHok: (
    id: string,
    status: KlaimUpahHOK["status"],
    catatanAdmin: string
  ) => void;
  onTambahPengumuman: (p: PengumumanBroadcast) => void;
  onTambahTugas: (t: TugasPemetaan) => void;
  onBalasPesanAdmin: (teks: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  dataSpasial,
  profilKader,
  sertifikatList,
  klaimUpahList,
  onVerifikasiData,
  onTerbitkanSertifikat,
  onUpdateStatusKlaimHok,
  onTambahPengumuman,
  onTambahTugas,
  onBalasPesanAdmin
}) => {
  // Form Pengumuman Baru
  const [judulAnn, setJudulAnn] = useState("");
  const [isiAnn, setIsiAnn] = useState("");
  const [katAnn, setKatAnn] =
    useState<PengumumanBroadcast["kategori"]>("Panduan Survei");

  // Form Tugas Spasial Baru
  const [judulTugas, setJudulTugas] = useState("");
  const [descTugas, setDescTugas] = useState("");
  const [wilayahTugas, setWilayahTugas] = useState("Blok Hutan Utara");
  const [geomTugas, setGeomTugas] = useState<JenisGeometri>("polygon");
  const [katTugas, setKatTugas] = useState<KategoriSurvei>("Wilayah Adat / Lahan");
  const [kuantitasTugas, setKuantitasTugas] = useState("Minimal 5,0 Ha Poligon");

  // Form Penerbitan Sertifikat
  const [nomorSertBaru, setNomorSertBaru] = useState(
    `043/SERT-KPP/X/${new Date().getFullYear()}`
  );
  const [penandatangan, setPenandatangan] = useState("Ir. Hendra Wijaya, M.Sc.");

  // Balas cepat ke Kader
  const [balasanAdmin, setBalasanAdmin] = useState("");

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
      batasWaktu: "2026-11-20",
      koordinatAcuan: { lat: -0.9465, lng: 100.4205 },
      status: "aktif",
      dibuatOleh: "Admin GIS Organisasi"
    });
    setJudulTugas("");
    setDescTugas("");
  };

  return (
    <div className="page-container">
      {/* 1. VERIFIKASI DATA SPASIAL KADER DI GOOGLE DRIVE */}
      <div className="section-card">
        <h3>🛡️ Panel Verifikasi Data Spasial Masuk (Anti-Duplikat & Validasi Klaim)</h3>
        <p className="text-muted">
          Periksa keabsahan titik koordinat, jalur tracking, dan poligon wilayah yang disinkronkan
          kader sebelum disahkan untuk perhitungan Sertifikat dan Upah 1 HOK.
        </p>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID & Kader</th>
                <th>Geometri & Objek</th>
                <th>Kuantitas Spasial</th>
                <th>Status Saat Ini</th>
                <th>Tindakan Verifikasi Admin</th>
              </tr>
            </thead>
            <tbody>
              {dataSpasial.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.namaKader}</strong>
                    <div className="text-xs text-muted">
                      {d.id} • {d.desaWilayah}
                    </div>
                  </td>
                  <td>
                    <span className="badge-kategori">{d.kategori}</span>{" "}
                    <strong>{d.judul}</strong>
                    <div className="text-xs text-muted">{d.deskripsi}</div>
                  </td>
                  <td>
                    {d.jenisGeometri === "point" && "1 Titik Koordinat"}
                    {d.jenisGeometri === "line" && `${d.panjangKm} km Tracking`}
                    {d.jenisGeometri === "polygon" && `${d.luasHa} Ha Poligon`}
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
                        className="btn-primary-sm"
                        onClick={() => onVerifikasiData(d.id, "terverifikasi")}
                      >
                        <Check size={14} /> Verifikasi Sah
                      </button>
                      <button
                        type="button"
                        className="btn-danger-sm"
                        onClick={() =>
                          onVerifikasiData(
                            d.id,
                            "ditolak",
                            "Mohon lengkapi foto atau perbaiki akurasi titik GPS"
                          )
                        }
                      >
                        <X size={14} /> Revisi
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. PERSETUJUAN KLAIM UPAH HARIAN (1 HOK) & PENERBITAN SERTIFIKAT */}
      <div className="form-row-2">
        <div className="section-card">
          <h3>
            <Banknote size={18} /> Persetujuan & Pencairan Klaim Upah 1 HOK
          </h3>
          <div className="hok-list">
            {klaimUpahList.map((k) => (
              <div key={k.id} className="hok-item">
                <div>
                  <strong>
                    {k.namaKader} — Paket Ke-{k.paketKe} ({k.jumlahHok} HOK)
                  </strong>
                  <div className="text-xs text-muted">{k.rincianBukti}</div>
                  <div className="text-xs text-emerald">
                    Nominal: Rp {k.nominalRupiah.toLocaleString("id-ID")} ({k.status})
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="btn-primary-sm"
                    onClick={() =>
                      onUpdateStatusKlaimHok(
                        k.id,
                        "dicairkan",
                        "Telah dicairkan oleh bendahara program ke rekening/tunai kader."
                      )
                    }
                  >
                    Cairkan 1 HOK
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <h3>
            <Award size={18} /> Terbitkan & Kirim Sertifikat Kader Pemetaan
          </h3>
          <p className="text-muted">
            Kirimkan sertifikat digital resmi ke akun kader <b>{profilKader.nama}</b> (
            {profilKader.idKader}).
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
            style={{ marginTop: "10px", width: "100%" }}
            onClick={() =>
              onTerbitkanSertifikat({
                id: `CERT-${Date.now().toString().slice(-4)}`,
                nomorSertifikat: nomorSertBaru,
                idKader: profilKader.idKader,
                namaKader: profilKader.nama,
                desaWilayah: profilKader.desaWilayah,
                namaOrganisasi: profilKader.namaOrganisasi,
                tanggalTerbit: new Date().toISOString().slice(0, 10),
                alasanCapaian: "Menyelesaikan Paket Capaian Survei & Pemetaan Partisipatif",
                status: "diterbitkan",
                ditandatanganiOleh: penandatangan,
                jabatanPenandatangan: "Koordinator Program GIS & Pemetaan Partisipatif"
              })
            }
          >
            🏅 Terbitkan & Kirim Sertifikat ke Akun Kader ({sertifikatList.length} Terbit)
          </button>
        </div>
      </div>

      {/* 3. KIRIM PENGUMUMAN BROADCAST & PENUGASAN SPASIAL BARU */}
      <div className="form-row-2">
        <form onSubmit={handleBuatPengumuman} className="section-card">
          <h3>
            <Megaphone size={18} /> Kirim Pengumuman Broadcast ke Kader
          </h3>
          <div>
            <label>Kategori Pengumuman</label>
            <select
              className="form-input"
              value={katAnn}
              onChange={(e) =>
                setKatAnn(e.target.value as PengumumanBroadcast["kategori"])
              }
            >
              <option value="Panduan Survei">📘 Panduan Survei</option>
              <option value="Info Umum">📢 Info Umum</option>
              <option value="Peringatan Cuaca">⛈️ Peringatan Cuaca</option>
              <option value="Jadwal Kumpul">🗓️ Jadwal Kumpul Kader</option>
            </select>
          </div>
          <div style={{ marginTop: "8px" }}>
            <label>Judul Pengumuman</label>
            <input
              type="text"
              className="form-input"
              placeholder="Contoh: Jadwal Verifikasi Peta Desa Bulan November"
              value={judulAnn}
              onChange={(e) => setJudulAnn(e.target.value)}
            />
          </div>
          <div style={{ marginTop: "8px" }}>
            <label>Isi Pengumuman</label>
            <textarea
              rows={2}
              className="form-input"
              placeholder="Tulis instruksi lengkap untuk seluruh kader..."
              value={isiAnn}
              onChange={(e) => setIsiAnn(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: "10px", width: "100%" }}
          >
            <PlusCircle size={15} /> Siarkan Pengumuman
          </button>
        </form>

        <form onSubmit={handleBuatTugas} className="section-card">
          <h3>🗺️ Buat Penugasan Spasial Baru ke Peta Kader</h3>
          <div className="form-row-2">
            <div>
              <label>Judul Penugasan</label>
              <input
                type="text"
                className="form-input"
                placeholder="Mis. Petakan Mata Air Hulu"
                value={judulTugas}
                onChange={(e) => setJudulTugas(e.target.value)}
              />
            </div>
            <div>
              <label>Wilayah / Blok Target</label>
              <input
                type="text"
                className="form-input"
                value={wilayahTugas}
                onChange={(e) => setWilayahTugas(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-3" style={{ marginTop: "8px" }}>
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
              <label>Kategori</label>
              <select
                className="form-input"
                value={katTugas}
                onChange={(e) => setKatTugas(e.target.value as KategoriSurvei)}
              >
                <option value="Wilayah Adat / Lahan">Wilayah Adat / Lahan</option>
                <option value="Flora">Flora</option>
                <option value="Fauna">Fauna</option>
                <option value="Mata Air">Mata Air</option>
                <option value="Tanda Batas">Tanda Batas</option>
              </select>
            </div>
            <div>
              <label>Target Kuantitas</label>
              <input
                type="text"
                className="form-input"
                value={kuantitasTugas}
                onChange={(e) => setKuantitasTugas(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: "8px" }}>
            <label>Instruksi Lapangan</label>
            <input
              type="text"
              className="form-input"
              placeholder="Detail instruksi pengambilan titik/poligon..."
              value={descTugas}
              onChange={(e) => setDescTugas(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: "10px", width: "100%" }}
          >
            <PlusCircle size={15} /> Kirim Tugas ke Aplikasi Kader
          </button>
        </form>
      </div>

      {/* 4. BALAS CEPAT HELPDESK KADER */}
      <div className="section-card">
        <h3>
          <ShieldAlert size={18} /> Balas Cepat Saluran Tanya Admin (Helpdesk)
        </h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Ketik balasan resmi dari Admin GIS ke kotak masuk kader..."
            value={balasanAdmin}
            onChange={(e) => setBalasanAdmin(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (!balasanAdmin.trim()) return;
              onBalasPesanAdmin(balasanAdmin.trim());
              setBalasanAdmin("");
            }}
          >
            Kirim Balasan Admin
          </button>
        </div>
      </div>
    </div>
  );
};
