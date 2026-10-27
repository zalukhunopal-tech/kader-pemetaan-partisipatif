import React, { useRef } from "react";
import {
  DataSpasialItem,
  KlaimUpahHOK,
  ProfilKader,
  SertifikatKader
} from "../types";
import {
  hitungCapaianKader,
  TARGET_POLIGON_HA,
  TARGET_TITIK,
  TARGET_TRACKING_KM
} from "../lib/rewardEngine";
import { Award, Banknote, CheckCircle, Download, Sparkles, ShieldCheck } from "lucide-react";

interface RewardViewProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  sertifikatList: SertifikatKader[];
  klaimUpahList: KlaimUpahHOK[];
  onUbahProfil: (p: ProfilKader) => void;
  onAjukanKlaimUpah: (paketKe: number, rincian: string) => void;
}

export const RewardView: React.FC<RewardViewProps> = ({
  dataSpasial,
  profil,
  sertifikatList,
  klaimUpahList,
  onUbahProfil,
  onAjukanKlaimUpah
}) => {
  const certCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const capaian = hitungCapaianKader(dataSpasial, profil, false);
  const sertifikatSaya = sertifikatList.find((s) => s.idKader === profil.idKader);

  // Unduh Sertifikat Digital Resmi sebagai PNG Resolusi Tinggi
  const unduhSertifikatGambar = (sert: SertifikatKader) => {
    const canvas = certCanvasRef.current || document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 840;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Latar belakang elegan hijau zamrud gelap + bingkai emas
    const bg = ctx.createLinearGradient(0, 0, 1200, 840);
    bg.addColorStop(0, "#042f2e");
    bg.addColorStop(0.5, "#064e3b");
    bg.addColorStop(1, "#022c22");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 840);

    // Bingkai Ornamen Emas
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, 1128, 768);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, 1100, 740);

    // Header Organisasi
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sert.namaOrganisasi.toUpperCase(), 600, 130);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 46px Georgia, serif";
    ctx.fillText("SERTIFIKAT KADER PEMETAAN PARTISIPATIF", 600, 195);

    ctx.fillStyle = "#a7f3d0";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText(`Nomor Sertifikat: ${sert.nomorSertifikat}`, 600, 235);

    // Penerima
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("Diberikan sebagai penghargaan dan pengesahan kompetensi kepada:", 600, 305);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillText(sert.namaKader, 600, 365);

    ctx.fillStyle = "#6ee7b7";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText(`ID Kader: ${sert.idKader} • Wilayah: ${sert.desaWilayah}`, 600, 405);

    // Deskripsi Capaian
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(
      "Atas dedikasi dalam survei keanekaragaman hayati dan pemetaan wilayah partisipatif masyarakat",
      600,
      470
    );
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 21px system-ui, sans-serif";
    ctx.fillText(`Capaian Terverifikasi: ${sert.alasanCapaian}`, 600, 510);

    // Tanggal & Tanda Tangan
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText(`Diterbitkan pada: ${sert.tanggalTerbit}`, 600, 610);

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(450, 700);
    ctx.lineTo(750, 700);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText(sert.ditandatanganiOleh, 600, 730);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(sert.jabatanPenandatangan, 600, 758);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sertifikat_Kader_${sert.namaKader.replace(/\s+/g, "_")}.png`;
    a.click();
  };

  return (
    <div className="page-container">
      {/* HEADER LENCANA & RINGKASAN CAPAIAN KADER */}
      <div className="section-card reward-hero">
        <div className="reward-hero-left">
          <div className="kader-badge-avatar">
            <Award size={34} />
          </div>
          <div>
            <div className="badge-row">
              <span className="kader-id-pill">{profil.idKader}</span>
              {capaian.berhakSertifikat && (
                <span className="certified-pill">
                  <ShieldCheck size={14} /> Kader Pemetaan Tersertifikasi
                </span>
              )}
            </div>
            <h2>{profil.nama}</h2>
            <p className="text-muted">
              {profil.desaWilayah} • {profil.kelompokMasyarakat}
            </p>
          </div>
        </div>

        <div className="reward-hero-stats">
          <div className="hero-stat-item">
            <span>Total Paket Capaian</span>
            <strong>{capaian.totalPaketSelesai} Paket</strong>
            <small>Target ke-1: Sertifikat</small>
          </div>
          <div className="hero-stat-item">
            <span>Hak Upah Kerja (1 HOK)</span>
            <strong>{capaian.jumlahHakUpahHok} HOK</strong>
            <small>
              Rp {(capaian.jumlahHakUpahHok * profil.tarifHokRupiah).toLocaleString("id-ID")}
            </small>
          </div>
        </div>
      </div>

      {/* 3 BILAH PROGRES TARGET CAPAIAN SESUAI PRD BAB 3.3 */}
      <div className="section-card">
        <h3>🎯 Progres 1 Paket Capaian (Pilih Salah Satu Target Penuh)</h3>
        <p className="text-muted">
          Sesuai aturan program: menyelesaikan <b>50 Titik Koordinat</b> ATAU{" "}
          <b>5,0 km Tracking Perjalanan</b> ATAU <b>5,0 Ha Pemetaan Poligon</b> dihitung sebagai{" "}
          <b>1 Paket Capaian</b>.
        </p>

        <div className="progress-bars-stack">
          {/* 1. Progres Titik */}
          <div className="milestone-box">
            <div className="milestone-head">
              <div>
                <strong>1. Progres Titik Koordinat & Pembaruan Objek</strong>
                <div className="text-xs text-muted">
                  {capaian.jumlahTitik} titik baru + {capaian.jumlahPembaruan} pembaruan kondisi
                </div>
              </div>
              <span className="milestone-counter">
                {capaian.totalPoinTitik} / {TARGET_TITIK} Titik ({capaian.paketDariTitik}x Paket)
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill emerald"
                style={{ width: `${Math.min(100, (capaian.totalPoinTitik / TARGET_TITIK) * 100)}%` }}
              />
            </div>
          </div>

          {/* 2. Progres Tracking */}
          <div className="milestone-box">
            <div className="milestone-head">
              <div>
                <strong>2. Progres Tracking Perjalanan Survei (Line)</strong>
                <div className="text-xs text-muted">
                  Akumulasi panjang jejak langkah GPS kader di lapangan
                </div>
              </div>
              <span className="milestone-counter">
                {capaian.totalTrackingKm} / {TARGET_TRACKING_KM.toFixed(1)} km (
                {capaian.paketDariTracking}x Paket)
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill sky"
                style={{
                  width: `${Math.min(100, (capaian.totalTrackingKm / TARGET_TRACKING_KM) * 100)}%`
                }}
              />
            </div>
          </div>

          {/* 3. Progres Poligon */}
          <div className="milestone-box">
            <div className="milestone-head">
              <div>
                <strong>3. Progres Pemetaan Poligon Wilayah (Area)</strong>
                <div className="text-xs text-muted">
                  Akumulasi luas poligon lahan, hutan adat, atau kebun masyarakat
                </div>
              </div>
              <span className="milestone-counter">
                {capaian.totalPoligonHa} / {TARGET_POLIGON_HA.toFixed(1)} Ha (
                {capaian.paketDariPoligon}x Paket)
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill amber"
                style={{
                  width: `${Math.min(100, (capaian.totalPoligonHa / TARGET_POLIGON_HA) * 100)}%`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SERTIFIKAT KADER PEMETAAN (CAPAIAN PERTAMA / 1x TARGET) */}
      <div className="section-card">
        <h3>🏅 Tahap 1: Sertifikat Kader Pemetaan (Syarat: 1x Paket Capaian)</h3>
        {sertifikatSaya ? (
          <div className="certificate-preview-box">
            <div className="cert-inner">
              <div className="cert-org">{sertifikatSaya.namaOrganisasi}</div>
              <h4>SERTIFIKAT KADER PEMETAAN PARTISIPATIF</h4>
              <div className="cert-no">Nomor: {sertifikatSaya.nomorSertifikat}</div>
              <p>Diberikan kepada:</p>
              <div className="cert-recipient">{sertifikatSaya.namaKader}</div>
              <div className="cert-sub">
                {sertifikatSaya.desaWilayah} • {sertifikatSaya.alasanCapaian}
              </div>
              <div className="cert-footer">
                <span>Tanggal: {sertifikatSaya.tanggalTerbit}</span>
                <span>
                  Ditandatangani: <b>{sertifikatSaya.ditandatanganiOleh}</b>
                </span>
              </div>
            </div>
            <div style={{ marginTop: "12px", display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => unduhSertifikatGambar(sertifikatSaya)}
              >
                <Download size={16} /> Unduh Sertifikat Resmi (.PNG Resolusi Tinggi)
              </button>
            </div>
            <canvas ref={certCanvasRef} style={{ display: "none" }} />
          </div>
        ) : (
          <div className="empty-box">
            Selesaikan minimal 1 Paket Capaian (50 Titik / 5 km Tracking / 5 Ha Poligon) untuk
            menerima Sertifikat Kader Pemetaan resmi dari organisasi.
          </div>
        )}
      </div>

      {/* KLAIM UPAH HARIAN 1 HARI KERJA (SETIAP 2x PAKET CAPAIAN) */}
      <div className="section-card">
        <div className="section-header-flex">
          <div>
            <h3>
              <Banknote size={18} /> Tahap Berikutnya: Upah Harian 1 Hari Kerja / 1 HOK (Setiap 2x
              Paket Capaian)
            </h3>
            <p className="text-muted">
              Setiap menyelesaikan 2 Paket Capaian, kader berhak mengajukan klaim{" "}
              <b>1 Hari Orang Kerja (Rp {profil.tarifHokRupiah.toLocaleString("id-ID")})</b>.
            </p>
          </div>
          {capaian.jumlahHakUpahHok > klaimUpahList.length && (
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                onAjukanKlaimUpah(
                  (klaimUpahList.length + 1) * 2,
                  `Capaian ${capaian.totalPoinTitik} titik, ${capaian.totalTrackingKm} km tracking, ${capaian.totalPoligonHa} Ha poligon`
                )
              }
            >
              <Sparkles size={16} /> Ajukan Klaim Upah 1 HOK Baru
            </button>
          )}
        </div>

        <div className="hok-list">
          {klaimUpahList.map((k) => (
            <div key={k.id} className="hok-item">
              <div>
                <strong>
                  Tiket {k.id} — Siklus Paket Ke-{k.paketKe} ({k.jumlahHok} Hari Kerja / HOK)
                </strong>
                <div className="text-xs text-muted">{k.rincianBukti}</div>
                {k.catatanAdmin && (
                  <div className="text-xs text-emerald" style={{ marginTop: "4px" }}>
                    Catatan Admin: {k.catatanAdmin}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="hok-nominal">
                  Rp {k.nominalRupiah.toLocaleString("id-ID")}
                </div>
                <span className={`badge-sync status-${k.status}`}>
                  <CheckCircle size={12} /> {k.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PENGATURAN PARAMETER SKEMA REWARD & PROFIL KADER (JAWABAN FLEKSIBEL PRD BAB 6) */}
      <div className="section-card">
        <h3>⚙️ Pengaturan Profil Kader & Skema Perhitungan Insentif</h3>
        <div className="form-row-3">
          <div>
            <label>Nama Kader Pemetaan</label>
            <input
              type="text"
              className="form-input"
              value={profil.nama}
              onChange={(e) => onUbahProfil({ ...profil, nama: e.target.value })}
            />
          </div>
          <div>
            <label>Desa / Wilayah Kerja</label>
            <input
              type="text"
              className="form-input"
              value={profil.desaWilayah}
              onChange={(e) => onUbahProfil({ ...profil, desaWilayah: e.target.value })}
            />
          </div>
          <div>
            <label>Nama Organisasi Penerbit Sertifikat</label>
            <input
              type="text"
              className="form-input"
              value={profil.namaOrganisasi}
              onChange={(e) => onUbahProfil({ ...profil, namaOrganisasi: e.target.value })}
            />
          </div>
        </div>

        <div className="form-row-2" style={{ marginTop: "12px" }}>
          <div>
            <label>Aturan Siklus 2x Target untuk Upah 1 HOK</label>
            <select
              className="form-input"
              value={profil.modePerhitunganUpah}
              onChange={(e) =>
                onUbahProfil({
                  ...profil,
                  modePerhitunganUpah: e.target.value as ProfilKader["modePerhitunganUpah"]
                })
              }
            >
              <option value="kumulatif">
                Kumulatif (Target ke-1 Sertifikat, tambah 1x jadi 2x langsung dapat 1 HOK)
              </option>
              <option value="reset_setelah_sertifikat">
                Mulai dari Nol setelah Sertifikat (Sertifikat di ke-1, lalu +2x target baru untuk 1
                HOK)
              </option>
            </select>
          </div>
          <div>
            <label>Aturan Kombinasi Progres Antar-Kategori</label>
            <select
              className="form-input"
              value={profil.modeKombinasiTarget}
              onChange={(e) =>
                onUbahProfil({
                  ...profil,
                  modeKombinasiTarget: e.target.value as ProfilKader["modeKombinasiTarget"]
                })
              }
            >
              <option value="per_kategori">
                Penuh per Kategori (Harus genap 50 titik ATAU 5 km ATAU 5 Ha)
              </option>
              <option value="gabungan_proporsional">
                Gabungan Proporsional (Mis. 25 titik [50%] + 2,5 km [50%] = 1 Paket Capaian)
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
