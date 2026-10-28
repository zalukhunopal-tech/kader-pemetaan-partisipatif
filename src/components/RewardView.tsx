import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DataSpasialItem,
  KlaimUpahHOK,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  TugasPemetaan
} from "../types";
import {
  hitungCapaianKader,
  hitungPeringkatGis20Level,
  HasilPeringkatGis20,
  TARGET_POLIGON_HA,
  TARGET_TITIK,
  TARGET_TRACKING_KM
} from "../lib/rewardEngine";
import {
  Award,
  Banknote,
  Download,
  ShieldCheck,
  Sparkles,
  Settings,
  Printer,
  Layers,
  MessageSquare,
  CheckCircle2,
  Database,
  Camera
} from "lucide-react";

interface RewardViewProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  sertifikatList: SertifikatKader[];
  klaimUpahList: KlaimUpahHOK[];
  pesanList?: PesanKomunikasi[];
  tugasList?: TugasPemetaan[];
  onUbahProfil: (p: ProfilKader) => void;
  onAjukanKlaimUpah: (paketKe: number, rincian: string) => void;
}

/**
 * Menggambar emblem Kompas & Mahkota Daun Emas di atas Kanvas Sertifikat
 */
function gambarEmblemKompasEmas(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.translate(cx, cy);

  // Lingkaran cahaya luar
  const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 62);
  glow.addColorStop(0, "rgba(251, 191, 36, 0.35)");
  glow.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();

  // Rangkaian daun (Laurel Wreath) kiri & kanan
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 2, 48, Math.PI * 0.2, Math.PI * 0.8, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 2, 48, Math.PI * 1.2, Math.PI * 1.8, false);
  ctx.stroke();

  // Lingkaran kompas
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fillStyle = "#042f2e";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fbbf24";
  ctx.stroke();

  // Bintang kompas 4 arah utama
  const pts = [
    [0, -30, 7, -7, 0, 0],
    [30, 0, 7, 7, 0, 0],
    [0, 30, -7, 7, 0, 0],
    [-30, 0, -7, -7, 0, 0]
  ];
  ctx.fillStyle = "#fbbf24";
  pts.forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
  });

  ctx.fillStyle = "#fde68a";
  pts.forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(-x2, y2);
    ctx.closePath();
    ctx.fill();
  });

  // Titik permata tengah
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}

/**
 * Menggambar Kartu Visual Medali Capaian di dalam Sertifikat
 */
function gambarKartuMedaliCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  warnaAksen: string,
  simbol: "pin" | "shield" | "poly",
  nilaiUtama: string,
  labelBawah: string
) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.strokeStyle = warnaAksen;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 20);
  ctx.fill();
  ctx.stroke();

  // Lingkaran ikon kiri
  const icX = x + 52;
  const icY = y + h / 2;
  ctx.beginPath();
  ctx.arc(icX, icY, 28, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(251, 191, 36, 0.16)";
  ctx.fill();
  ctx.strokeStyle = warnaAksen;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Gambar vektor di dalam lingkaran
  ctx.fillStyle = warnaAksen;
  ctx.strokeStyle = warnaAksen;
  ctx.lineWidth = 2.5;
  if (simbol === "pin") {
    ctx.beginPath();
    ctx.arc(icX, icY - 5, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(icX - 7, icY - 2);
    ctx.lineTo(icX, icY + 13);
    ctx.lineTo(icX + 7, icY - 2);
    ctx.stroke();
  } else if (simbol === "shield") {
    ctx.beginPath();
    ctx.moveTo(icX, icY - 14);
    ctx.lineTo(icX + 12, icY - 8);
    ctx.lineTo(icX + 10, icY + 6);
    ctx.lineTo(icX, icY + 15);
    ctx.lineTo(icX - 10, icY + 6);
    ctx.lineTo(icX - 12, icY - 8);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(icX - 10, icY - 8);
    ctx.lineTo(icX + 10, icY - 11);
    ctx.lineTo(icX + 13, icY + 9);
    ctx.lineTo(icX - 8, icY + 11);
    ctx.closePath();
    ctx.stroke();
  }

  // Teks Nilai & Label
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(nilaiUtama, x + 94, y + h / 2 - 4);

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "600 16px system-ui, -apple-system, sans-serif";
  ctx.fillText(labelBawah, x + 94, y + h / 2 + 22);
  ctx.restore();
}

/**
 * Menggambar Segel Pita Bintang Emas di Bawah Tengah Sertifikat
 */
function gambarSegelBintangEmas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  levelGis: number
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Pita bawah kiri & kanan
  ctx.fillStyle = "#d97706";
  ctx.beginPath();
  ctx.moveTo(-36, 40);
  ctx.lineTo(-58, 108);
  ctx.lineTo(-32, 94);
  ctx.lineTo(-14, 114);
  ctx.lineTo(-8, 45);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(36, 40);
  ctx.lineTo(58, 108);
  ctx.lineTo(32, 94);
  ctx.lineTo(14, 114);
  ctx.lineTo(8, 45);
  ctx.closePath();
  ctx.fill();

  // Gerigi segel emas (24 sudut)
  const spikes = 24;
  const outerR = 76;
  const innerR = 68;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / spikes;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const sealGrad = ctx.createRadialGradient(0, -15, 10, 0, 0, outerR);
  sealGrad.addColorStop(0, "#fde68a");
  sealGrad.addColorStop(0.6, "#fbbf24");
  sealGrad.addColorStop(1, "#b45309");
  ctx.fillStyle = sealGrad;
  ctx.fill();

  // Lingkaran dalam hijau gelap
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.fillStyle = "#022c22";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#fde68a";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText("★ GIS VERIFIED ★", 0, -16);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 22px system-ui, sans-serif";
  ctx.fillText(`LV. ${levelGis}`, 0, 10);

  ctx.fillStyle = "#6ee7b7";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillText("KADER NUSANTARA", 0, 29);

  ctx.restore();
}

/**
 * Merender Sertifikat Bergambar & Clean ke Canvas (1600 x 1131 px - A4 Landscape)
 * Dijamin 100% identik di Layar PC, Layar HP, Cetak PDF, dan Unduh PNG
 */
function lukisSertifikatKeCanvas(
  canvas: HTMLCanvasElement,
  sert: SertifikatKader,
  peringkat: HasilPeringkatGis20,
  totalPoin: number,
  totalKm: number,
  totalHa: number
) {
  const W = 1600;
  const H = 1131;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  // 1. Latar Belakang Hijau Zamrud Gelap + Kontur Topografi Artistik
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#022c22");
  bg.addColorStop(0.5, "#064e3b");
  bg.addColorStop(1, "#022019");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ilustrasi Garis Kontur Peta di Sudut Latar Belakang
  ctx.save();
  ctx.strokeStyle = "rgba(52, 211, 153, 0.07)";
  ctx.lineWidth = 2;
  for (let r = 80; r <= 520; r += 45) {
    ctx.beginPath();
    ctx.arc(120, 120, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W - 120, H - 120, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Bingkai Emas Ganda Modern
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 7;
  ctx.strokeRect(42, 42, W - 84, H - 84);

  ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, W - 120, H - 120);

  // Ornamen Sudut Emas
  const sudut = [
    [42, 42, 1, 1],
    [W - 42, 42, -1, 1],
    [42, H - 42, 1, -1],
    [W - 42, H - 42, -1, -1]
  ];
  ctx.fillStyle = "#fbbf24";
  sudut.forEach(([sx, sy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + dx * 48, sy);
    ctx.lineTo(sx + dx * 48, sy + dy * 10);
    ctx.lineTo(sx + dx * 10, sy + dy * 10);
    ctx.lineTo(sx + dx * 10, sy + dy * 48);
    ctx.lineTo(sx, sy + dy * 48);
    ctx.closePath();
    ctx.fill();
  });

  // 3. Emblem Kompas Emas di Tengah Atas
  gambarEmblemKompasEmas(ctx, W / 2, 145);

  // 4. Judul Singkat & Bersih
  ctx.textAlign = "center";
  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    (sert.namaOrganisasi || "KONSORSIUM PEMETAAN PARTISIPATIF").toUpperCase(),
    W / 2,
    235
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px Georgia, 'Times New Roman', serif";
  ctx.fillText("SERTIFIKAT KOMPETENSI GIS", W / 2, 302);

  ctx.fillStyle = "#6ee7b7";
  ctx.font = "600 18px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText(`NO. REG: ${sert.nomorSertifikat}`, W / 2, 338);

  // 5. Nama Penerima (Besar & Menonjol)
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "italic 22px Georgia, serif";
  ctx.fillText("Diberikan kepada:", W / 2, 398);

  const namaTampil = sert.namaKader || "Kader Pemetaan";
  let fontNama = 64;
  ctx.font = `bold ${fontNama}px Georgia, 'Times New Roman', serif`;
  while (ctx.measureText(namaTampil).width > 1240 && fontNama > 36) {
    fontNama -= 4;
    ctx.font = `bold ${fontNama}px Georgia, 'Times New Roman', serif`;
  }
  ctx.fillStyle = "#fbbf24";
  ctx.fillText(namaTampil, W / 2, 476);

  // Garis aksen bawah nama
  const wNama = Math.min(960, Math.max(380, ctx.measureText(namaTampil).width + 60));
  ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - wNama / 2, 496);
  ctx.lineTo(W / 2 + wNama / 2, 496);
  ctx.stroke();

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `${sert.idKader}   •   Wilayah: ${sert.desaWilayah}`,
    W / 2,
    535
  );

  // 6. TIGA KARTU VISUAL BERGAMBAR (MENGGANTIKAN KALIMAT PANJANG)
  const cardW = 370;
  const cardH = 104;
  const gap = 34;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;
  const cardY = 578;

  gambarKartuMedaliCanvas(
    ctx,
    startX,
    cardY,
    cardW,
    cardH,
    "#34d399",
    "pin",
    `${totalPoin} Titik Lokasi`,
    "Survei Koordinat GPS"
  );

  gambarKartuMedaliCanvas(
    ctx,
    startX + cardW + gap,
    cardY,
    cardW,
    cardH,
    "#fbbf24",
    "shield",
    `Level ${peringkat.levelSaatIni.level} / 20`,
    peringkat.levelSaatIni.namaLevel
  );

  gambarKartuMedaliCanvas(
    ctx,
    startX + (cardW + gap) * 2,
    cardY,
    cardW,
    cardH,
    "#38bdf8",
    "poly",
    `${totalKm.toFixed(1)} km • ${totalHa.toFixed(1)} Ha`,
    "Jalur & Poligon Wilayah"
  );

  // 7. Footer: Tanggal (Kiri), Segel Emas Bergambar (Tengah), Tanda Tangan (Kanan)
  const yFoot = 835;

  // Kiri
  ctx.textAlign = "left";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText("TANGGAL DITERBITKAN", 130, yFoot);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillText(sert.tanggalTerbit, 130, yFoot + 36);

  ctx.strokeStyle = "rgba(251, 191, 36, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(130, yFoot + 54);
  ctx.lineTo(460, yFoot + 54);
  ctx.stroke();

  ctx.fillStyle = "#6ee7b7";
  ctx.font = "bold 18px ui-monospace, monospace";
  ctx.fillText(`Skor Kompetensi: ${peringkat.skorTotal} XP`, 130, yFoot + 84);

  // Tengah: Segel Pita Bintang Emas
  gambarSegelBintangEmas(ctx, W / 2, yFoot + 30, peringkat.levelSaatIni.level);

  // Kanan
  ctx.textAlign = "right";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText("PENGESAHAN RESMI", W - 130, yFoot);

  ctx.fillStyle = "#fde68a";
  ctx.font = "italic 34px Georgia, serif";
  ctx.fillText(sert.ditandatanganiOleh.split(",")[0], W - 145, yFoot + 46);

  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W - 490, yFoot + 62);
  ctx.lineTo(W - 130, yFoot + 62);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.fillText(sert.ditandatanganiOleh, W - 130, yFoot + 92);

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "17px system-ui, sans-serif";
  ctx.fillText(sert.jabatanPenandatangan, W - 130, yFoot + 118);
}

/**
 * Komponen Cincin Progres SVG Visual (Minimal Teks, Kaya Grafis)
 */
const CincinProgresSvg: React.FC<{
  persen: number;
  warna: string;
  ikon: React.ReactNode;
  nilai: string;
  label: string;
}> = ({ persen, warna, ikon, nilai, label }) => {
  const r = 34;
  const keliling = 2 * Math.PI * r;
  const offset = keliling - (Math.min(100, Math.max(0, persen)) / 100) * keliling;

  return (
    <div className="visual-ring-card">
      <div className="visual-ring-svg-wrap">
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="7"
          />
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke={warna}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={keliling}
            strokeDashoffset={offset}
            transform="rotate(-90 42 42)"
          />
        </svg>
        <div className="visual-ring-center-icon" style={{ color: warna }}>
          {ikon}
        </div>
      </div>
      <div className="visual-ring-info">
        <strong className="visual-ring-val">{nilai}</strong>
        <span className="visual-ring-lbl">{label}</span>
      </div>
    </div>
  );
};

export const RewardView: React.FC<RewardViewProps> = ({
  dataSpasial,
  profil,
  sertifikatList,
  klaimUpahList,
  pesanList = [],
  tugasList = [],
  onUbahProfil,
  onAjukanKlaimUpah
}) => {
  const certCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bukaPengaturan, setBukaPengaturan] = useState(false);

  const capaian = useMemo(
    () => hitungCapaianKader(dataSpasial, profil, false),
    [dataSpasial, profil]
  );

  const peringkatGis = useMemo(
    () => hitungPeringkatGis20Level(dataSpasial, profil, pesanList, tugasList),
    [dataSpasial, profil, pesanList, tugasList]
  );

  const sertifikatSaya = sertifikatList.find((s) => s.idKader === profil.idKader);

  const totalPoin = capaian.totalPoinTitik;
  const totalKm = capaian.totalTrackingKm;
  const totalHa = capaian.totalPoligonHa;
  const sudahTersertifikasi = Boolean(sertifikatSaya) || capaian.berhakSertifikat;

  const sertifikatTampil: SertifikatKader = useMemo(() => {
    if (sertifikatSaya) return sertifikatSaya;
    return {
      id: `CERT-${profil.idKader}`,
      nomorSertifikat: `001/SERT-KPP/${new Date().getFullYear()}`,
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      namaOrganisasi:
        profil.namaOrganisasi || "Konsorsium Pemetaan Partisipatif",
      tanggalTerbit: new Date().toISOString().slice(0, 10),
      alasanCapaian: "Kompetensi Survei & Pemetaan Partisipatif",
      status: sudahTersertifikasi ? "diterbitkan" : "menunggu_admin",
      ditandatanganiOleh: "Koordinator Program GIS",
      jabatanPenandatangan: "Koordinator Verifikasi Spasial"
    };
  }, [sertifikatSaya, profil, sudahTersertifikasi]);

  useEffect(() => {
    if (certCanvasRef.current) {
      lukisSertifikatKeCanvas(
        certCanvasRef.current,
        sertifikatTampil,
        peringkatGis,
        totalPoin,
        totalKm,
        totalHa
      );
    }
  }, [sertifikatTampil, peringkatGis, totalPoin, totalKm, totalHa]);

  const handleUnduhSertifikatPng = () => {
    const canvas = certCanvasRef.current;
    if (!canvas) return;
    lukisSertifikatKeCanvas(
      canvas,
      sertifikatTampil,
      peringkatGis,
      totalPoin,
      totalKm,
      totalHa
    );
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sertifikat_${sertifikatTampil.namaKader.replace(/\s+/g, "_")}.png`;
    a.click();
  };

  const handleCetakSertifikat = () => {
    const canvas = certCanvasRef.current;
    if (!canvas) return;
    lukisSertifikatKeCanvas(
      canvas,
      sertifikatTampil,
      peringkatGis,
      totalPoin,
      totalKm,
      totalHa
    );
    const dataUrl = canvas.toDataURL("image/png");

    const win = window.open("", "_blank");
    if (!win) {
      window.print();
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Cetak Sertifikat - ${sertifikatTampil.namaKader}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              height: 100%;
              background: #022c22;
              display: flex;
              align-items: center;
              justify-content: center;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            img {
              width: 100%;
              height: 100%;
              max-width: 297mm;
              max-height: 210mm;
              object-fit: contain;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="Sertifikat" onload="setTimeout(() => { window.print(); }, 250);" />
        </body>
      </html>
    `);
    win.document.close();
  };

  const {
    levelSaatIni,
    levelBerikutnya,
    jumlahLevelDiBawah,
    jumlahLevelKeAtas,
    skorTotal,
    persenProgresLevel,
    rincianSkor
  } = peringkatGis;

  return (
    <div className="page-container reward-page-clean">
      {/* 1. VISUAL HERO: PERINGKAT 20 LEVEL GIS (GAMBAR & GRAFIK VISUAL, MINIM TEKS) */}
      <div className="section-card reward-gis-hero-card">
        {/* Baris Identitas Singkat */}
        <div className="visual-profile-bar">
          <div className="visual-profile-left">
            <div className="visual-avatar-emblem">
              <span>{levelSaatIni.ikon}</span>
            </div>
            <div>
              <div className="visual-profile-badges">
                <span className="visual-pill-id">{profil.idKader}</span>
                {sudahTersertifikasi && (
                  <span className="visual-pill-verified">
                    <ShieldCheck size={12} /> Tersertifikasi
                  </span>
                )}
              </div>
              <h2 className="visual-profile-name">{profil.nama}</h2>
              <span className="visual-profile-loc">{profil.desaWilayah}</span>
            </div>
          </div>

          <button
            type="button"
            className="visual-icon-gear-btn"
            onClick={() => setBukaPengaturan((v) => !v)}
            title="Pengaturan Profil"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* 3 KARTU ILUSTRASI VISUAL LEVEL: DI BAWAH — LEVEL SAAT INI — KE ATAS */}
        <div className="visual-level-trio">
          {/* Kiri: Level di Bawah */}
          <div className="visual-step-box down">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" fill="rgba(52, 211, 153, 0.15)" stroke="#34d399" strokeWidth="2" />
              <path d="M16 22L24 30L32 22" stroke="#6ee7b7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18 15H30" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <strong className="visual-step-num">{jumlahLevelDiBawah}</strong>
            <span className="visual-step-lbl">Level di Bawah</span>
          </div>

          {/* Tengah: Medali Utama Level Saat Ini */}
          <div className="visual-current-level-center">
            <div className="visual-medal-svg-wrap">
              <svg width="96" height="96" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="goldMedal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fde68a" />
                    <stop offset="50%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                </defs>
                {/* Cincin Progres Level */}
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="rgba(2, 44, 34, 0.7)"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="url(#goldMedal)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={
                    2 * Math.PI * 44 * (1 - persenProgresLevel / 100)
                  }
                  transform="rotate(-90 50 50)"
                />
                {/* Lencana Dalam */}
                <circle cx="50" cy="50" r="34" fill="url(#goldMedal)" />
                <text
                  x="50"
                  y="46"
                  textAnchor="middle"
                  fill="#022c22"
                  fontSize="12"
                  fontWeight="900"
                >
                  LEVEL
                </text>
                <text
                  x="50"
                  y="68"
                  textAnchor="middle"
                  fill="#022c22"
                  fontSize="24"
                  fontWeight="900"
                >
                  {levelSaatIni.level}
                </text>
              </svg>
            </div>
            <div className="visual-current-level-title">{levelSaatIni.namaLevel}</div>
            <div className="visual-current-xp-pill">
              ⚡ {skorTotal} XP{" "}
              {levelBerikutnya ? `• ${persenProgresLevel}% ke Lv.${levelBerikutnya.level}` : "• MAX"}
            </div>
          </div>

          {/* Kanan: Level ke Atas */}
          <div className="visual-step-box up">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" fill="rgba(251, 191, 36, 0.16)" stroke="#fbbf24" strokeWidth="2" />
              <path d="M16 26L24 18L32 26" stroke="#fde68a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18 33H30" stroke="#fde68a" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <strong className="visual-step-num">{jumlahLevelKeAtas}</strong>
            <span className="visual-step-lbl">Level ke Atas</span>
          </div>
        </div>

        {/* 5 IKON BADGE VISUAL SKOR XP (TANPA KALIMAT PANJANG) */}
        <div className="visual-xp-badges-row">
          <div className="visual-xp-mini">
            <Database size={16} />
            <strong>+{rincianSkor.skorVolumeData}</strong>
            <span>Data</span>
          </div>
          <div className="visual-xp-mini">
            <Layers size={16} />
            <strong>+{rincianSkor.skorVariasiData}</strong>
            <span>Variasi</span>
          </div>
          <div className="visual-xp-mini">
            <MessageSquare size={16} />
            <strong>+{rincianSkor.skorDiskusi}</strong>
            <span>Diskusi</span>
          </div>
          <div className="visual-xp-mini">
            <Camera size={16} />
            <strong>+{rincianSkor.skorKualitasData}</strong>
            <span>Kualitas</span>
          </div>
          <div className="visual-xp-mini">
            <CheckCircle2 size={16} />
            <strong>+{rincianSkor.skorTugas}</strong>
            <span>Tugas</span>
          </div>
        </div>
      </div>

      {/* 2. GRAFIK CINCIN VISUAL: CAPAIAN SPASIAL (TITIK, JALUR, POLIGON) */}
      <div className="visual-rings-grid">
        <CincinProgresSvg
          persen={(totalPoin / TARGET_TITIK) * 100}
          warna="#0d7344"
          nilai={`${totalPoin}/${TARGET_TITIK}`}
          label="Titik Lokasi"
          ikon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          }
        />

        <CincinProgresSvg
          persen={(totalKm / TARGET_TRACKING_KM) * 100}
          warna="#0284c7"
          nilai={`${totalKm.toFixed(1)}/${TARGET_TRACKING_KM} km`}
          label="Jalur Tracking"
          ikon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="6" r="3" />
              <path d="M8.5 16.5C11 14 10 10 15.5 7.5" strokeDasharray="3 2" />
            </svg>
          }
        />

        <CincinProgresSvg
          persen={(totalHa / TARGET_POLIGON_HA) * 100}
          warna="#d97706"
          nilai={`${totalHa.toFixed(1)}/${TARGET_POLIGON_HA} Ha`}
          label="Luas Poligon"
          ikon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="12 3 21 8 18 19 6 19 3 8" />
            </svg>
          }
        />
      </div>

      {/* 3. PREVIEW SERTIFIKAT BERGAMBAR (100% IDENTIK DI PC, HP & CETAK) */}
      <div className="section-card certificate-section-card">
        <div className="certificate-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={20} color="#0d7344" />
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Piagam Sertifikat Kader</h3>
          </div>

          <div className="certificate-action-btns">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={handleCetakSertifikat}
            >
              <Printer size={14} /> Cetak PDF
            </button>
            <button
              type="button"
              className="btn-primary-sm"
              onClick={handleUnduhSertifikatPng}
            >
              <Download size={14} /> Unduh PNG
            </button>
          </div>
        </div>

        <div className="certificate-canvas-stage" id="certificate-print-area">
          <canvas
            ref={certCanvasRef}
            className="certificate-wysiwyg-canvas"
            aria-label={`Sertifikat ${sertifikatTampil.namaKader}`}
          />
        </div>
      </div>

      {/* 4. VOUCHER VISUAL INSENTIF 1 HOK */}
      <div className="section-card visual-hok-voucher">
        <div className="visual-hok-left">
          <div className="visual-hok-svg-box">
            <Banknote size={26} color="#0d7344" />
          </div>
          <div>
            <div className="visual-hok-title">Insentif Kerja 1 HOK</div>
            <strong className="visual-hok-price">
              Rp {profil.tarifHokRupiah.toLocaleString("id-ID")}
            </strong>
          </div>
        </div>

        <div className="visual-hok-right">
          {capaian.jumlahHakUpahHok > klaimUpahList.length ? (
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() =>
                onAjukanKlaimUpah(
                  (klaimUpahList.length + 1) * 2,
                  `${capaian.totalPoinTitik} titik, ${capaian.totalTrackingKm.toFixed(1)} km, ${capaian.totalPoligonHa.toFixed(1)} Ha`
                )
              }
            >
              <Sparkles size={14} /> Klaim 1 HOK
            </button>
          ) : (
            <span className="visual-hok-badge">
              {capaian.totalPaketSelesai} / 2 Paket
            </span>
          )}
        </div>
      </div>

      {klaimUpahList.length > 0 && (
        <div className="hok-list">
          {klaimUpahList.map((k) => (
            <div key={k.id} className="hok-item">
              <strong>Tiket {k.id} (1 HOK)</strong>
              <span className={`badge-sync status-${k.status}`}>
                Rp {k.nominalRupiah.toLocaleString("id-ID")} • {k.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 5. MODAL/DRAWER PENGATURAN PROFIL (DISEMBUNYIKAN KECUALI DIKLIK IKON RODA GIGI) */}
      {bukaPengaturan && (
        <div className="section-card">
          <h4 style={{ margin: "0 0 10px", fontSize: "0.94rem" }}>⚙️ Identitas Sertifikat</h4>
          <div className="form-row-3">
            <div>
              <label>Nama di Sertifikat</label>
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
              <label>Organisasi</label>
              <input
                type="text"
                className="form-input"
                value={profil.namaOrganisasi}
                onChange={(e) => onUbahProfil({ ...profil, namaOrganisasi: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
