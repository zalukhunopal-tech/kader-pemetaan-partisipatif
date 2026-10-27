import React, { useRef, useState } from "react";
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
import {
  Award,
  Banknote,
  CheckCircle2,
  Download,
  MapPin,
  Footprints,
  Maximize2,
  ShieldCheck,
  Sparkles,
  Settings,
  Check,
  FileCheck,
  QrCode,
  Shield,
  Star
} from "lucide-react";

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
  const [bukaPengaturan, setBukaPengaturan] = useState(false);
  const capaian = hitungCapaianKader(dataSpasial, profil, false);
  const sertifikatSaya = sertifikatList.find((s) => s.idKader === profil.idKader);

  const totalPoin = capaian.totalPoinTitik;
  const totalKm = capaian.totalTrackingKm;
  const totalHa = capaian.totalPoligonHa;

  const sudahTersertifikasi = Boolean(sertifikatSaya) || capaian.berhakSertifikat;

  // Level Kader berdasarkan total capaian
  let levelKader = 1;
  let namaLevel = "Perintis Konservasi";
  if (totalPoin >= 50 || totalKm >= 5 || totalHa >= 5) {
    levelKader = 3;
    namaLevel = "Kader Tersertifikasi";
  } else if (totalPoin >= 20 || totalKm >= 2 || totalHa >= 2) {
    levelKader = 2;
    namaLevel = "Surveyor Lapangan";
  }
  if (totalPoin >= 100 || totalKm >= 10 || totalHa >= 10) {
    levelKader = 4;
    namaLevel = "Master GIS Nusantara";
  }

  // Unduh Gambar Sertifikat Digital Resolusi Tinggi (1200 x 840 px)
  const unduhSertifikatGambar = (sert: SertifikatKader) => {
    const canvas = certCanvasRef.current || document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 840;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Latar Belakang Hijau Zamrud Tua Mewah
    const bg = ctx.createLinearGradient(0, 0, 1200, 840);
    bg.addColorStop(0, "#022c22");
    bg.addColorStop(0.5, "#064e3b");
    bg.addColorStop(1, "#042f2e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 840);

    // Bingkai Ornamen Emas Ganda
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, 1128, 768);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, 1104, 744);

    // Header Organisasi
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`★  ${sert.namaOrganisasi.toUpperCase()}  ★`, 600, 115);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px Georgia, serif";
    ctx.fillText("SERTIFIKAT KADER PEMETAAN", 600, 175);

    ctx.fillStyle = "#6ee7b7";
    ctx.font = "15px monospace";
    ctx.fillText(`NO. REGISTER: ${sert.nomorSertifikat}`, 600, 210);

    // Garis Pemisah Emas
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(500, 235);
    ctx.lineTo(700, 235);
    ctx.stroke();

    // Diberikan kepada
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "17px system-ui, sans-serif";
    ctx.fillText("Diberikan sebagai pengakuan kompetensi resmi kepada:", 600, 290);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillText(sert.namaKader, 600, 350);

    ctx.fillStyle = "#a7f3d0";
    ctx.font = "bold 19px system-ui, sans-serif";
    ctx.fillText(`${sert.desaWilayah} • ID: ${sert.idKader}`, 600, 395);

    // Stempel Grafis Emas
    ctx.save();
    ctx.translate(600, 500);
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(251, 191, 36, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("KOMPETENSI TERVERIFIKASI", 0, -6);
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("GIS & MAPPING NUSANTARA", 0, 14);
    ctx.restore();

    // Deskripsi Capaian
    ctx.fillStyle = "#f8fafc";
    ctx.font = "19px system-ui, sans-serif";
    ctx.fillText(`Kriteria: ${sert.alasanCapaian}`, 600, 610);

    // Footer & Tanda Tangan
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "15px system-ui, sans-serif";
    ctx.fillText(`Diterbitkan pada: ${sert.tanggalTerbit}`, 380, 715);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillText(sert.ditandatanganiOleh, 820, 705);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(sert.jabatanPenandatangan, 820, 730);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sertifikat_${sert.namaKader.replace(/\s+/g, "_")}.png`;
    a.click();
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "960px",
        margin: "0 auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}
    >
      {/* 1. HERO CARD: PROFIL KADER & TINGKAT KOMPETENSI */}
      <div
        style={{
          background: "linear-gradient(135deg, #064e3b 0%, #042f2e 50%, #022c22 100%)",
          borderRadius: "18px",
          padding: "20px 22px",
          color: "#ffffff",
          border: "1.5px solid #059669",
          boxShadow: "0 8px 24px rgba(6, 78, 59, 0.25)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px"
          }}
        >
          {/* Identitas Kader */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1e293b",
                boxShadow: "0 4px 14px rgba(251, 191, 36, 0.35)",
                flexShrink: 0
              }}
            >
              <Award size={36} strokeWidth={2.4} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: 4 }}>
                <span
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid #10b981",
                    color: "#6ee7b7",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700
                  }}
                >
                  {profil.idKader}
                </span>

                <span
                  style={{
                    background: sudahTersertifikasi ? "#fbbf24" : "rgba(255,255,255,0.16)",
                    color: sudahTersertifikasi ? "#1e293b" : "#e2e8f0",
                    padding: "2px 10px",
                    borderRadius: 99,
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <ShieldCheck size={13} /> {namaLevel}
                </span>
              </div>

              <h2 style={{ margin: "0 0 3px", fontSize: "1.35rem", fontWeight: 800, color: "#ffffff" }}>
                {profil.nama}
              </h2>
              <div style={{ fontSize: "0.82rem", color: "#a7f3d0" }}>
                {profil.desaWilayah} • {profil.kelompokMasyarakat}
              </div>
            </div>
          </div>

          {/* Tombol Pengaturan Profil */}
          <button
            type="button"
            onClick={() => setBukaPengaturan((v) => !v)}
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              padding: "7px 14px",
              borderRadius: "10px",
              fontSize: "0.8rem",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer"
            }}
          >
            <Settings size={14} /> Pengaturan Profil
          </button>
        </div>

        {/* 4 MEDALI TINGKAT KOMPETENSI (RESPONSIF) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "10px",
            marginTop: "18px"
          }}
        >
          {[
            { level: 1, medal: "🥉", label: "Perintis", target: "1 - 19 Titik", color: "#fef08a" },
            { level: 2, medal: "🥈", label: "Surveyor", target: "20 - 49 Titik / 2 km", color: "#e2e8f0" },
            { level: 3, medal: "🥇", label: "Tersertifikasi", target: "50 Titik / 5 km / 5 Ha", color: "#fbbf24" },
            { level: 4, medal: "💎", label: "Master GIS", target: "100 Titik / 10 km", color: "#67e8f9" }
          ].map((item) => {
            const isActive = levelKader >= item.level;
            const isCurrent = levelKader === item.level;

            return (
              <div
                key={item.level}
                style={{
                  background: isCurrent
                    ? "linear-gradient(135deg, rgba(251, 191, 36, 0.22), rgba(217, 119, 6, 0.28))"
                    : isActive
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(255, 255, 255, 0.05)",
                  border: isCurrent
                    ? "2px solid #fbbf24"
                    : isActive
                    ? "1px solid #34d399"
                    : "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "12px",
                  padding: "10px 8px",
                  textAlign: "center",
                  boxShadow: isCurrent ? "0 0 16px rgba(251, 191, 36, 0.3)" : "none"
                }}
              >
                <div style={{ fontSize: "1.6rem", lineHeight: 1 }}>{item.medal}</div>
                <div style={{ fontWeight: 800, fontSize: "0.82rem", color: item.color, marginTop: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#cbd5e1", marginTop: 2 }}>
                  {item.target}
                </div>
                {isActive && (
                  <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                    <span style={{ background: "#059669", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: "0.62rem", fontWeight: 700 }}>
                      ✓ Terbuka
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. INFOGRAFIS 3 KARTU TARGET SPASIAL DENGAN IKON BESAR */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "18px 20px",
          border: "1px solid #d5dcd8",
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "#181a19" }}>
            <span>🎯</span> Progres Capaian Lapangan
          </h3>
          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
            Target: 50 Titik ATAU 5 km ATAU 5 Ha
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px"
          }}
        >
          {/* 1. Titik Koordinat */}
          <div
            style={{
              background: "#f0fdf4",
              border: "1.5px solid #86efac",
              borderRadius: "14px",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "12px",
                background: "#0d7344",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <MapPin size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.9rem", color: "#14532d" }}>Titik Koordinat</strong>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0d7344" }}>
                  {totalPoin} / {TARGET_TITIK}
                </span>
              </div>
              <div style={{ height: 8, background: "#dcfce7", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    background: "#0d7344",
                    width: `${Math.min(100, (totalPoin / TARGET_TITIK) * 100)}%`,
                    borderRadius: 99,
                    transition: "width 0.3s"
                  }}
                />
              </div>
            </div>
          </div>

          {/* 2. Tracking Line */}
          <div
            style={{
              background: "#f0f9ff",
              border: "1.5px solid #7dd3fc",
              borderRadius: "14px",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "12px",
                background: "#0284c7",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Footprints size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.9rem", color: "#0369a1" }}>Jejak Tracking</strong>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0284c7" }}>
                  {totalKm.toFixed(1)} / {TARGET_TRACKING_KM.toFixed(1)} km
                </span>
              </div>
              <div style={{ height: 8, background: "#e0f2fe", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    background: "#0284c7",
                    width: `${Math.min(100, (totalKm / TARGET_TRACKING_KM) * 100)}%`,
                    borderRadius: 99,
                    transition: "width 0.3s"
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3. Poligon Area */}
          <div
            style={{
              background: "#fffbeb",
              border: "1.5px solid #fde68a",
              borderRadius: "14px",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "12px",
                background: "#d97706",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Maximize2 size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.9rem", color: "#92400e" }}>Poligon Wilayah</strong>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#d97706" }}>
                  {totalHa.toFixed(1)} / {TARGET_POLIGON_HA.toFixed(1)} Ha
                </span>
              </div>
              <div style={{ height: 8, background: "#fef3c7", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    background: "#d97706",
                    width: `${Math.min(100, (totalHa / TARGET_POLIGON_HA) * 100)}%`,
                    borderRadius: 99,
                    transition: "width 0.3s"
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PIAGAM SERTIFIKAT GRAFIS RESMI (DESAIN MEWAH PROPORSIONAL) */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "18px 20px",
          border: "1px solid #d5dcd8",
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "#181a19" }}>
              <Award size={20} color="#0d7344" /> Piagam Sertifikat Resmi
            </h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
              Sertifikat kompetensi survei & pemetaan partisipatif berstandar digital
            </p>
          </div>

          {sertifikatSaya && (
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() => unduhSertifikatGambar(sertifikatSaya)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} /> Unduh Piagam (.PNG)
            </button>
          )}
        </div>

        {sertifikatSaya ? (
          <div
            style={{
              position: "relative",
              borderRadius: "18px",
              padding: "28px 24px",
              background: "linear-gradient(135deg, #022c22 0%, #064e3b 55%, #042f2e 100%)",
              border: "3.5px double #fbbf24",
              boxShadow: "0 10px 30px rgba(6, 78, 59, 0.3)",
              color: "#ffffff",
              textAlign: "center"
            }}
          >
            {/* Header Instansi */}
            <div style={{ color: "#fbbf24", letterSpacing: 2, fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase" }}>
              ★  {sertifikatSaya.namaOrganisasi}  ★
            </div>

            <h4
              style={{
                margin: "12px 0 4px",
                fontSize: "1.35rem",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: 0.5,
                fontFamily: "Georgia, serif"
              }}
            >
              SERTIFIKAT KADER PEMETAAN
            </h4>

            <div style={{ fontSize: "0.74rem", color: "#6ee7b7", fontFamily: "monospace" }}>
              NO. REGISTER: {sertifikatSaya.nomorSertifikat}
            </div>

            <div style={{ margin: "16px auto 12px", width: 48, height: 2, background: "#fbbf24" }} />

            <div style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>Diberikan kepada:</div>
            <div
              style={{
                fontSize: "1.65rem",
                fontWeight: 800,
                color: "#fbbf24",
                margin: "4px 0",
                fontFamily: "Georgia, serif"
              }}
            >
              {sertifikatSaya.namaKader}
            </div>
            <div style={{ fontSize: "0.86rem", color: "#a7f3d0" }}>
              {sertifikatSaya.desaWilayah}
            </div>

            {/* Stempel & QR Badge Tengah */}
            <div
              style={{
                margin: "20px auto 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(251, 191, 36, 0.12)",
                border: "1.5px solid #fbbf24",
                borderRadius: 99,
                padding: "6px 20px"
              }}
            >
              <ShieldCheck size={20} color="#fbbf24" />
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fbbf24" }}>
                {sertifikatSaya.alasanCapaian}
              </span>
            </div>

            {/* Footer Penandatangan */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid rgba(251, 191, 36, 0.25)",
                fontSize: "0.78rem"
              }}
            >
              <div style={{ textAlign: "left", color: "#94a3b8" }}>
                Tanggal: <b>{sertifikatSaya.tanggalTerbit}</b>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#ffffff", fontWeight: 700 }}>{sertifikatSaya.ditandatanganiOleh}</div>
                <div style={{ color: "#94a3b8", fontSize: "0.72rem" }}>{sertifikatSaya.jabatanPenandatangan}</div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "36px 20px",
              textAlign: "center",
              background: "#f8faf9",
              border: "1.5px dashed #cbd5e1",
              borderRadius: "14px"
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                background: "#fef3c7",
                color: "#d97706",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10
              }}
            >
              <FileCheck size={28} />
            </div>
            <h5 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#1e293b", fontWeight: 700 }}>
              Sertifikat Belum Diterbitkan
            </h5>
            <p style={{ margin: 0, fontSize: "0.84rem", color: "#64748b", maxWidth: 380, marginInline: "auto", lineHeight: 1.5 }}>
              Selesaikan minimal 1 target capaian (50 Titik / 5 km Tracking / 5 Ha Poligon). Admin akan memverifikasi hasil survei dan piagam resmi Anda akan langsung tampil di sini.
            </p>
          </div>
        )}
        <canvas ref={certCanvasRef} style={{ display: "none" }} />
      </div>

      {/* 4. TIKET INSENTIF HOK (VOUCHER DESIGN) */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "18px 20px",
          border: "1px solid #d5dcd8",
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "#181a19" }}>
              <Banknote size={20} color="#0d7344" /> Tiket Insentif Harian (1 HOK)
            </h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
              Hak upah kerja Rp {profil.tarifHokRupiah.toLocaleString("id-ID")} setiap menyelesaikan 2x paket capaian
            </p>
          </div>

          {capaian.jumlahHakUpahHok > klaimUpahList.length && (
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() =>
                onAjukanKlaimUpah(
                  (klaimUpahList.length + 1) * 2,
                  `Capaian ${capaian.totalPoinTitik} titik, ${capaian.totalTrackingKm.toFixed(1)} km, ${capaian.totalPoligonHa.toFixed(1)} Ha`
                )
              }
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <Sparkles size={14} /> Klaim 1 HOK
            </button>
          )}
        </div>

        {klaimUpahList.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {klaimUpahList.map((k) => (
              <div
                key={k.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  border: "1.5px solid #e2e8f0",
                  flexWrap: "wrap",
                  gap: 10
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>
                    Tiket {k.id} • Paket Ke-{k.paketKe} (1 HOK)
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "#64748b" }}>{k.rincianBukti}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#0d7344" }}>
                    Rp {k.nominalRupiah.toLocaleString("id-ID")}
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 99,
                      background: k.status === "dicairkan" ? "#dcfce7" : "#fef3c7",
                      color: k.status === "dicairkan" ? "#166534" : "#b45309"
                    }}
                  >
                    {k.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "18px", textAlign: "center", color: "#64748b", fontSize: "0.84rem" }}>
            Belum ada klaim 1 HOK. Kumpulkan data survei untuk mengajukan insentif kerja.
          </div>
        )}
      </div>

      {/* 5. DRAWER UBAH IDENTITAS KADER */}
      {bukaPengaturan && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "18px 20px",
            border: "1px solid #d5dcd8",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
          }}
        >
          <h4 style={{ margin: "0 0 12px", fontSize: "0.96rem", color: "#181a19" }}>
            ⚙️ Ubah Identitas Profil Kader
          </h4>
          <div className="form-row-3">
            <div>
              <label>Nama Lengkap</label>
              <input
                type="text"
                className="form-input"
                value={profil.nama}
                onChange={(e) => onUbahProfil({ ...profil, nama: e.target.value })}
              />
            </div>
            <div>
              <label>Desa / Wilayah</label>
              <input
                type="text"
                className="form-input"
                value={profil.desaWilayah}
                onChange={(e) => onUbahProfil({ ...profil, desaWilayah: e.target.value })}
              />
            </div>
            <div>
              <label>Kelompok / KTH</label>
              <input
                type="text"
                className="form-input"
                value={profil.kelompokMasyarakat}
                onChange={(e) => onUbahProfil({ ...profil, kelompokMasyarakat: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
