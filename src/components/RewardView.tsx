import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DataSpasialItem,
  KlaimUpahHOK,
  PeranPengguna,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  TugasPemetaan
} from "../types";
import {
  hitungCapaianKader,
  hitungPeringkatGis20Level,
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
  Camera,
  UserCheck,
  Trash2,
  PenTool
} from "lucide-react";

interface RewardViewProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  peran?: PeranPengguna;
  sertifikatList: SertifikatKader[];
  klaimUpahList: KlaimUpahHOK[];
  pesanList?: PesanKomunikasi[];
  tugasList?: TugasPemetaan[];
  onUbahProfil: (p: ProfilKader) => void;
  onUbahPenandatanganSertifikat?: (nama: string, jabatan: string) => void;
  onAjukanKlaimUpah: (paketKe: number, rincian: string) => void;
}

/**
 * Komponen SVG Siluet Orang (Menggantikan ikon tanaman pada Avatar Kader)
 */
export const SiluetOrangSvg: React.FC<{ size?: number; warna?: string }> = ({
  size = 34,
  warna = "#fde68a"
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="32" cy="21" r="12" fill={warna} />
    <path
      d="M12 54C12 42.954 20.954 35 32 35C43.046 35 52 42.954 52 54V56H12V54Z"
      fill={warna}
    />
  </svg>
);

/**
 * Menggambar Siluet Orang di dalam Bingkai Foto pada Kanvas Sertifikat
 * ketika kader belum mengunggah foto.
 */
function gambarSiluetOrangCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Latar bingkai hijau zamrud gelap
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#064e3b");
  bg.addColorStop(1, "#022c22");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Kepala siluet orang
  ctx.fillStyle = "rgba(253, 230, 138, 0.85)";
  ctx.beginPath();
  ctx.arc(cx, cy - 22, 26, 0, Math.PI * 2);
  ctx.fill();

  // Bahu & badan siluet orang
  ctx.beginPath();
  ctx.arc(cx, cy + 58, 52, Math.PI * 1.12, Math.PI * 1.88, false);
  ctx.lineTo(cx + 46, y + h);
  ctx.lineTo(cx - 46, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Menggambar Bingkai Foto Kader (Passfoto Resmi) di atas Kanvas Sertifikat
 */
function gambarBingkaiFotoKaderCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fotoImg: HTMLImageElement | null
) {
  ctx.save();

  // Bayangan lembut
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  // Kotak luar emas
  ctx.fillStyle = "#042f2e";
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = "transparent";

  // Area dalam foto (clip)
  const pad = 8;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(ix, iy, iw, ih, 9);
  ctx.clip();

  if (fotoImg && fotoImg.complete && fotoImg.naturalWidth > 0) {
    // Hitung crop proporsional (object-fit: cover)
    const imgRatio = fotoImg.naturalWidth / fotoImg.naturalHeight;
    const boxRatio = iw / ih;
    let sx = 0;
    let sy = 0;
    let sw = fotoImg.naturalWidth;
    let sh = fotoImg.naturalHeight;

    if (imgRatio > boxRatio) {
      sw = fotoImg.naturalHeight * boxRatio;
      sx = (fotoImg.naturalWidth - sw) / 2;
    } else {
      sh = fotoImg.naturalWidth / boxRatio;
      sy = (fotoImg.naturalHeight - sh) / 2;
    }
    ctx.drawImage(fotoImg, sx, sy, sw, sh, ix, iy, iw, ih);
  } else {
    gambarSiluetOrangCanvas(ctx, ix, iy, iw, ih);
  }
  ctx.restore();

  // Garis aksen tipis di dalam foto
  ctx.strokeStyle = "rgba(253, 230, 138, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(ix, iy, iw, ih, 9);
  ctx.stroke();

  // Pita label bawah bingkai foto
  ctx.fillStyle = "#022c22";
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 14, y + h - 16, w - 28, 28, 8);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.fillText("FOTO KADER", x + w / 2, y + h + 3);

  ctx.restore();
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
 * Menggambar Kartu Visual Medali Capaian di dalam Sertifikat (Tanpa Level User)
 */
function gambarKartuMedaliCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  warnaAksen: string,
  simbol: "pin" | "route" | "poly",
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
  } else if (simbol === "route") {
    ctx.beginPath();
    ctx.arc(icX - 9, icY + 8, 4, 0, Math.PI * 2);
    ctx.arc(icX + 9, icY - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(icX - 6, icY + 6);
    ctx.quadraticCurveTo(icX, icY - 10, icX + 6, icY - 6);
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
 * (Tidak menuliskan level user, cukup SERTIFIKAT RESMI)
 */
function gambarSegelBintangEmas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
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
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.fillText("★ SERTIFIKAT ★", 0, -16);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 20px system-ui, sans-serif";
  ctx.fillText("RESMI", 0, 8);

  ctx.fillStyle = "#6ee7b7";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillText("KADER PEMETAAN", 0, 27);

  ctx.restore();
}

/**
 * Merender Sertifikat Bergambar & Clean ke Canvas (1600 x 1131 px - A4 Landscape)
 * - TIDAK menuliskan level user pada sertifikat (cukup Sertifikat saja)
 * - Menampilkan Foto Kader (atau Siluet Orang jika belum ada foto)
 * - Menampilkan Nama & Jabatan Penandatangan yang dapat diubah oleh Admin
 */
function lukisSertifikatKeCanvas(
  canvas: HTMLCanvasElement,
  sert: SertifikatKader,
  totalPoin: number,
  totalKm: number,
  totalHa: number,
  fotoImg: HTMLImageElement | null
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
  gambarEmblemKompasEmas(ctx, W / 2, 142);

  // 4. Judul Singkat & Bersih (Tanpa Menuliskan Level User)
  ctx.textAlign = "center";
  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    (sert.namaOrganisasi || "KONSORSIUM PEMETAAN PARTISIPATIF").toUpperCase(),
    W / 2,
    232
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px Georgia, 'Times New Roman', serif";
  ctx.fillText("SERTIFIKAT", W / 2, 300);

  ctx.fillStyle = "#6ee7b7";
  ctx.font = "600 18px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText(`NO. REG: ${sert.nomorSertifikat}`, W / 2, 336);

  // 5. BINGKAI FOTO KADER DI SISI KIRI ATAS NAMA PENERIMA
  gambarBingkaiFotoKaderCanvas(ctx, 145, 342, 158, 198, fotoImg);

  // 6. Nama Penerima (Besar & Menonjol)
  ctx.textAlign = "center";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "italic 22px Georgia, serif";
  ctx.fillText("Diberikan kepada:", W / 2, 396);

  const namaTampil = sert.namaKader || "Kader Pemetaan";
  let fontNama = 62;
  ctx.font = `bold ${fontNama}px Georgia, 'Times New Roman', serif`;
  while (ctx.measureText(namaTampil).width > 900 && fontNama > 34) {
    fontNama -= 4;
    ctx.font = `bold ${fontNama}px Georgia, 'Times New Roman', serif`;
  }
  ctx.fillStyle = "#fbbf24";
  ctx.fillText(namaTampil, W / 2, 472);

  // Garis aksen bawah nama
  const wNama = Math.min(860, Math.max(360, ctx.measureText(namaTampil).width + 60));
  ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - wNama / 2, 492);
  ctx.lineTo(W / 2 + wNama / 2, 492);
  ctx.stroke();

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `${sert.idKader}   •   Wilayah: ${sert.desaWilayah}`,
    W / 2,
    532
  );

  // 7. TIGA KARTU VISUAL CAPAIAN SURVEI (TANPA LEVEL USER)
  const cardW = 370;
  const cardH = 104;
  const gap = 34;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;
  const cardY = 582;

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
    "route",
    `${totalKm.toFixed(1)} km Jalur`,
    "Tracking Pemetaan"
  );

  gambarKartuMedaliCanvas(
    ctx,
    startX + (cardW + gap) * 2,
    cardY,
    cardW,
    cardH,
    "#38bdf8",
    "poly",
    `${totalHa.toFixed(1)} Ha Poligon`,
    "Pemetaan Wilayah"
  );

  // 8. Footer: Tanggal (Kiri), Segel Emas Bergambar (Tengah), Tanda Tangan (Kanan)
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
  ctx.fillText("Status: SERTIFIKAT RESMI", 130, yFoot + 84);

  // Tengah: Segel Pita Bintang Emas (Tanpa Level)
  gambarSegelBintangEmas(ctx, W / 2, yFoot + 30);

  // Kanan: Penandatangan Sertifikat
  const namaPenandatangan = sert.ditandatanganiOleh || "Koordinator Program GIS";
  const jabatanPenandatangan =
    sert.jabatanPenandatangan || "Koordinator Verifikasi Spasial";

  ctx.textAlign = "right";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText("DITANDATANGANI OLEH", W - 130, yFoot);

  ctx.fillStyle = "#fde68a";
  ctx.font = "italic 32px Georgia, serif";
  ctx.fillText(namaPenandatangan.split(",")[0], W - 145, yFoot + 46);

  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W - 510, yFoot + 62);
  ctx.lineTo(W - 130, yFoot + 62);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.fillText(namaPenandatangan, W - 130, yFoot + 92);

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "17px system-ui, sans-serif";
  ctx.fillText(jabatanPenandatangan, W - 130, yFoot + 118);
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

/**
 * Mengecilkan ukuran foto yang diunggah agar ringan disimpan di localStorage
 */
function kompresFotoKeDataUrl(file: File, maxDim = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file foto"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format gambar tidak valid"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const RewardView: React.FC<RewardViewProps> = ({
  dataSpasial,
  profil,
  peran = "kader",
  sertifikatList,
  klaimUpahList,
  pesanList = [],
  tugasList = [],
  onUbahProfil,
  onUbahPenandatanganSertifikat,
  onAjukanKlaimUpah
}) => {
  const certCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);
  const [bukaPengaturan, setBukaPengaturan] = useState(false);
  const [fotoElement, setFotoElement] = useState<HTMLImageElement | null>(null);

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

  const fotoSertifikatBase64 =
    sertifikatSaya?.fotoKaderBase64 || profil.fotoKaderBase64 || "";

  useEffect(() => {
    if (!fotoSertifikatBase64) {
      setFotoElement(null);
      return;
    }
    const img = new Image();
    img.onload = () => setFotoElement(img);
    img.onerror = () => setFotoElement(null);
    img.src = fotoSertifikatBase64;
  }, [fotoSertifikatBase64]);

  const sertifikatTampil: SertifikatKader = useMemo(() => {
    const namaPenandatangan =
      sertifikatSaya?.ditandatanganiOleh ||
      profil.namaPenandatanganSertifikat ||
      "Koordinator Program GIS";
    const jabatanPenandatangan =
      sertifikatSaya?.jabatanPenandatangan ||
      profil.jabatanPenandatanganSertifikat ||
      "Koordinator Verifikasi Spasial";

    if (sertifikatSaya) {
      return {
        ...sertifikatSaya,
        ditandatanganiOleh: namaPenandatangan,
        jabatanPenandatangan,
        fotoKaderBase64: fotoSertifikatBase64 || undefined
      };
    }
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
      ditandatanganiOleh: namaPenandatangan,
      jabatanPenandatangan,
      fotoKaderBase64: fotoSertifikatBase64 || undefined
    };
  }, [sertifikatSaya, profil, sudahTersertifikasi, fotoSertifikatBase64]);

  useEffect(() => {
    if (certCanvasRef.current) {
      lukisSertifikatKeCanvas(
        certCanvasRef.current,
        sertifikatTampil,
        totalPoin,
        totalKm,
        totalHa,
        fotoElement
      );
    }
  }, [sertifikatTampil, totalPoin, totalKm, totalHa, fotoElement]);

  const handlePilihFotoSertifikat = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await kompresFotoKeDataUrl(file, 480);
      onUbahProfil({ ...profil, fotoKaderBase64: dataUrl });
    } catch {
      alert("Gagal memuat foto. Silakan pilih file gambar lain.");
    } finally {
      e.target.value = "";
    }
  };

  const handleHapusFotoSertifikat = () => {
    onUbahProfil({ ...profil, fotoKaderBase64: undefined });
  };

  const handleUnduhSertifikatPng = () => {
    const canvas = certCanvasRef.current;
    if (!canvas) return;
    lukisSertifikatKeCanvas(
      canvas,
      sertifikatTampil,
      totalPoin,
      totalKm,
      totalHa,
      fotoElement
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
      totalPoin,
      totalKm,
      totalHa,
      fotoElement
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
      {/* INPUT FILE TERSEMBUNYI UNTUK FOTO KADER DI SERTIFIKAT */}
      <input
        ref={inputFotoRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePilihFotoSertifikat}
      />

      {/* 1. VISUAL HERO: AVATAR SILUET ORANG / FOTO KADER & PERINGKAT 20 LEVEL GIS */}
      <div className="section-card reward-gis-hero-card">
        {/* Baris Identitas Singkat dengan Avatar Siluet Orang (Bukan Tanaman) */}
        <div className="visual-profile-bar">
          <div className="visual-profile-left">
            <button
              type="button"
              className="visual-avatar-emblem avatar-silhouette-btn"
              onClick={() => inputFotoRef.current?.click()}
              title="Ketuk untuk mengunggah foto kader ke sertifikat"
            >
              {fotoSertifikatBase64 ? (
                <img
                  src={fotoSertifikatBase64}
                  alt={profil.nama}
                  className="visual-avatar-photo"
                />
              ) : (
                <SiluetOrangSvg size={34} warna="#fde68a" />
              )}
              <span className="visual-avatar-cam-badge">
                <Camera size={11} />
              </span>
            </button>
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
            title="Pengaturan Profil & Foto Sertifikat"
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

        {/* 5 IKON BADGE VISUAL SKOR XP */}
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

      {/* 3. PREVIEW SERTIFIKAT BERGAMBAR + TOMBOL TAMBAH FOTO SERTIFIKAT */}
      <div className="section-card certificate-section-card">
        <div className="certificate-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={20} color="#0d7344" />
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Sertifikat Kader</h3>
          </div>

          <div className="certificate-action-btns">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => inputFotoRef.current?.click()}
              title="Tambahkan atau ganti foto kader pada sertifikat"
            >
              <Camera size={14} /> {fotoSertifikatBase64 ? "Ganti Foto" : "+ Foto Sertifikat"}
            </button>
            {fotoSertifikatBase64 && (
              <button
                type="button"
                className="btn-outline-sm"
                onClick={handleHapusFotoSertifikat}
                title="Hapus foto dari sertifikat"
              >
                <Trash2 size={14} />
              </button>
            )}
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

        {/* KONTROL CEPAT ADMIN UNTUK MENGUBAH NAMA PENANDATANGAN SERTIFIKAT */}
        {peran === "admin" && (
          <div className="cert-admin-signer-box">
            <div className="cert-admin-signer-title">
              <PenTool size={15} color="#0284c7" />
              <strong>Pengaturan Penandatangan Sertifikat (Mode Admin)</strong>
            </div>
            <div className="form-row-2">
              <div>
                <label>Nama Pejabat Penandatangan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Dr. Budi Santoso, M.Sc"
                  value={sertifikatTampil.ditandatanganiOleh}
                  onChange={(e) => {
                    const namaBaru = e.target.value;
                    onUbahProfil({
                      ...profil,
                      namaPenandatanganSertifikat: namaBaru
                    });
                    onUbahPenandatanganSertifikat?.(
                      namaBaru,
                      sertifikatTampil.jabatanPenandatangan
                    );
                  }}
                />
              </div>
              <div>
                <label>Jabatan Penandatangan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Koordinator Program GIS"
                  value={sertifikatTampil.jabatanPenandatangan}
                  onChange={(e) => {
                    const jabatanBaru = e.target.value;
                    onUbahProfil({
                      ...profil,
                      jabatanPenandatanganSertifikat: jabatanBaru
                    });
                    onUbahPenandatanganSertifikat?.(
                      sertifikatTampil.ditandatanganiOleh,
                      jabatanBaru
                    );
                  }}
                />
              </div>
            </div>
          </div>
        )}
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

      {/* 5. DRAWER PENGATURAN IDENTITAS & FOTO SERTIFIKAT */}
      {bukaPengaturan && (
        <div className="section-card">
          <h4 style={{ margin: "0 0 10px", fontSize: "0.94rem", display: "flex", alignItems: "center", gap: 6 }}>
            <UserCheck size={16} color="#0d7344" /> Identitas & Foto Sertifikat
          </h4>
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

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() => inputFotoRef.current?.click()}
            >
              <Camera size={14} /> {fotoSertifikatBase64 ? "Ubah Foto Sertifikat" : "Pilih Foto untuk Sertifikat"}
            </button>
            {fotoSertifikatBase64 && (
              <button
                type="button"
                className="btn-outline-sm"
                onClick={handleHapusFotoSertifikat}
              >
                <Trash2 size={14} /> Hapus Foto
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
