import React, { useState } from "react";
import { PengumumanBroadcast, TugasPemetaan } from "../types";
import { ArrowLeft, Bell, Calendar, CheckCircle2, MapPin } from "lucide-react";

interface PemberitahuanViewProps {
  pengumumanList: PengumumanBroadcast[];
  tugasList: TugasPemetaan[];
  onTutup: () => void;
  onBukaTargetDiPeta: (lat: number, lng: number, label: string) => void;
  onTandaiTugasSelesai: (id: string) => void;
}

export const PemberitahuanView: React.FC<PemberitahuanViewProps> = ({
  pengumumanList,
  tugasList,
  onTutup,
  onBukaTargetDiPeta,
  onTandaiTugasSelesai
}) => {
  // Default tampilkan layar Pemberitahuan bersih sesuai Screenshot 2, dengan tombol untuk melihat riwayat tugas/info lapangan
  const [lihatRiwayat, setLihatRiwayat] = useState(false);

  return (
    <div className="avenza-fullpage-overlay">
      {/* HEADER PEMBERITAHUAN SESUAI SCREENSHOT 2 */}
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
          <h2>Pemberitahuan</h2>
        </div>

        <button
          type="button"
          className="avenza-history-toggle-btn"
          onClick={() => setLihatRiwayat((v) => !v)}
        >
          {lihatRiwayat
            ? "Tampilan Utama"
            : `Tugas & Info (${pengumumanList.length + tugasList.length})`}
        </button>
      </header>

      {!lihatRiwayat ? (
        /* TAMPILAN UTAMA PEMBERITAHUAN PERSIS SCREENSHOT 2 */
        <div className="avenza-empty-notification">
          <div className="avenza-empty-bell-wrap">
            <Bell size={76} strokeWidth={1.6} />
          </div>
          <h3>Tidak ada pemberitahuan baru</h3>
          <p>Kami akan memberi tahu Anda ketika ada sesuatu yang baru.</p>
        </div>
      ) : (
        /* RIWAYAT PENGUMUMAN & PENUGASAN SPASIAL KADER */
        <div className="page-container">
          <div className="section-card">
            <h3>📢 Pengumuman Lapangan ({pengumumanList.length})</h3>
            <div className="announcement-list">
              {pengumumanList.map((p) => (
                <div
                  key={p.id}
                  className={`announcement-card ${p.penting ? "urgent" : ""}`}
                >
                  <div className="ann-header">
                    <span className="badge-kategori">{p.kategori}</span>
                    <span className="text-xs text-muted">
                      🎯 {p.targetDesa} • 📅 {p.tanggal}
                    </span>
                  </div>
                  <h4>{p.judul}</h4>
                  <p>{p.isi}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card">
            <h3>🎯 Penugasan Survei & Pemetaan ({tugasList.length})</h3>
            <div className="task-grid">
              {tugasList.map((t) => (
                <div key={t.id} className="task-card">
                  <div className="task-top">
                    <span className="badge-kategori">
                      {t.jenisTargetGeometri.toUpperCase()} • {t.kategoriTarget}
                    </span>
                    <span
                      className={`badge-sync ${
                        t.status === "selesai"
                          ? "status-terverifikasi"
                          : "status-tersinkron"
                      }`}
                    >
                      {t.status === "selesai" ? "✓ Selesai" : "⏳ Aktif"}
                    </span>
                  </div>
                  <h4>{t.judul}</h4>
                  <p className="text-muted">{t.deskripsi}</p>
                  <div className="task-meta">
                    <div>
                      <MapPin size={14} /> Wilayah: <b>{t.targetWilayah}</b>
                    </div>
                    <div>
                      <Calendar size={14} /> Batas Waktu: <b>{t.batasWaktu}</b>
                    </div>
                  </div>
                  <div className="task-actions">
                    <button
                      type="button"
                      className="btn-primary-sm"
                      onClick={() => {
                        onTutup();
                        onBukaTargetDiPeta(
                          t.koordinatAcuan.lat,
                          t.koordinatAcuan.lng,
                          t.judul
                        );
                      }}
                    >
                      <MapPin size={14} /> Buka di Peta
                    </button>
                    {t.status !== "selesai" && (
                      <button
                        type="button"
                        className="btn-outline-sm"
                        onClick={() => onTandaiTugasSelesai(t.id)}
                      >
                        <CheckCircle2 size={14} /> Selesai
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
