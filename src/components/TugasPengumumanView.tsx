import React from "react";
import { PengumumanBroadcast, TugasPemetaan } from "../types";
import { Bell, Calendar, CheckCircle2, Compass, MapPin, Target } from "lucide-react";

interface TugasPengumumanViewProps {
  pengumumanList: PengumumanBroadcast[];
  tugasList: TugasPemetaan[];
  onBukaTargetDiPeta: (lat: number, lng: number, label: string) => void;
  onTandaiTugasSelesai: (id: string) => void;
}

export const TugasPengumumanView: React.FC<TugasPengumumanViewProps> = ({
  pengumumanList,
  tugasList,
  onBukaTargetDiPeta,
  onTandaiTugasSelesai
}) => {
  return (
    <div className="page-container">
      {/* PENGUMUMAN BROADCAST DARI ADMIN */}
      <div className="section-card">
        <h3>
          <Bell size={18} /> Pengumuman ({pengumumanList.length})
        </h3>
        <div className="announcement-list">
          {pengumumanList.map((p) => (
            <div key={p.id} className={`announcement-card ${p.penting ? "urgent" : ""}`}>
              <div className="ann-header">
                <span className="badge-kategori">{p.kategori}</span>
                <span className="text-xs text-muted">
                  🎯 {p.targetDesa} • 📅 {p.tanggal} • Oleh: {p.olehAdmin}
                </span>
              </div>
              <h4>{p.judul}</h4>
              <p>{p.isi}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PENUGASAN SPASIAL SPESIFIK (TASK ASSIGNMENT) */}
      <div className="section-card">
        <h3>
          <Target size={18} /> Tugas ({tugasList.length})
        </h3>
        <p className="text-muted">
          Klik tombol <b>Buka Lokasi Acuan di Peta</b> untuk memusatkan peta satelit dan menyalakan garis penunjuk arah (Go-To Navigation)
          menuju lokasi tugas.
        </p>

        <div className="task-grid">
          {tugasList.map((t) => (
            <div key={t.id} className="task-card">
              <div className="task-top">
                <span className="badge-kategori">
                  {t.jenisTargetGeometri.toUpperCase()} • {t.kategoriTarget}
                </span>
                <span className={`badge-sync ${t.status === "selesai" ? "status-terverifikasi" : "status-tersinkron"}`}>
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
                  <Compass size={14} /> Target Capaian: <b>{t.targetKuantitas}</b>
                </div>
                <div>
                  <Calendar size={14} /> Batas Waktu: <b>{t.batasWaktu}</b>
                </div>
              </div>

              <div className="task-actions">
                <button
                  type="button"
                  className="btn-primary-sm"
                  onClick={() => onBukaTargetDiPeta(t.koordinatAcuan.lat, t.koordinatAcuan.lng, t.judul)}
                >
                  <MapPin size={14} /> Buka Lokasi Acuan di Peta
                </button>
                {t.status !== "selesai" && (
                  <button type="button" className="btn-outline-sm" onClick={() => onTandaiTugasSelesai(t.id)}>
                    <CheckCircle2 size={14} /> Tandai Selesai
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
