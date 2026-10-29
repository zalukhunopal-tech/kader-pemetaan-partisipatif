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
  const [lihatRiwayat, setLihatRiwayat] = useState(false);

  return (
    <div className="avenza-fullpage-overlay">
      {/* HEADER PEMBERITAHUAN */}
      <header className="avenza-subpage-header">
        <div className="avenza-subpage-left">
          <button type="button" className="avenza-back-btn" onClick={onTutup} title="Kembali">
            <ArrowLeft size={24} />
          </button>
          <h2>Pemberitahuan</h2>
        </div>

        <button type="button" className="avenza-history-toggle-btn" onClick={() => setLihatRiwayat((v) => !v)}>
          {lihatRiwayat ? "Tampilan Utama" : `Riwayat Notifikasi (${pengumumanList.length + tugasList.length})`}
        </button>
      </header>

      {!lihatRiwayat ? (
        /* TAMPILAN UTAMA PEMBERITAHUAN */
        <div className="avenza-empty-notification">
          <div className="avenza-empty-bell-wrap">
            <Bell size={76} strokeWidth={1.6} />
          </div>
          <h3>Tidak ada pemberitahuan baru</h3>
          <p>Pengumuman dan tugas hanya muncul dari perangkat ini; aplikasi belum menerimanya dari perangkat lain.</p>
        </div>
      ) : (
        /* RIWAYAT PENGUMUMAN & PENUGASAN SPASIAL KADER */
        <div className="page-container">
          {pengumumanList.length === 0 && tugasList.length === 0 ? (
            <div className="section-card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#f1f5f3",
                  color: "#64748b",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12
                }}
              >
                <Bell size={28} />
              </div>
              <h4 style={{ margin: "0 0 6px", fontSize: "1.05rem", color: "#1e293b" }}>Belum Ada Riwayat Notifikasi</h4>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Tidak ada pengumuman atau tugas pemetaan di perangkat ini.</p>
            </div>
          ) : (
            <>
              {pengumumanList.length > 0 && (
                <div className="section-card">
                  <h3>📢 Pengumuman ({pengumumanList.length})</h3>
                  <div className="announcement-list">
                    {pengumumanList.map((p) => (
                      <div key={p.id} className={`announcement-card ${p.penting ? "urgent" : ""}`}>
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
              )}

              {tugasList.length > 0 && (
                <div className="section-card">
                  <h3>🎯 Tugas ({tugasList.length})</h3>
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
                                : t.status === "menunggu_verifikasi"
                                  ? "status-lokal"
                                  : "status-tersinkron"
                            }`}
                          >
                            {t.status === "selesai"
                              ? "✓ Selesai"
                              : t.status === "menunggu_verifikasi"
                                ? "⏳ Menunggu Verifikasi"
                                : "⏳ Aktif"}
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
                              onBukaTargetDiPeta(t.koordinatAcuan.lat, t.koordinatAcuan.lng, t.judul);
                            }}
                          >
                            <MapPin size={14} /> Buka di Peta
                          </button>
                          {t.status === "aktif" && (
                            <button type="button" className="btn-outline-sm" onClick={() => onTandaiTugasSelesai(t.id)}>
                              <CheckCircle2 size={14} /> Ajukan Selesai
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
