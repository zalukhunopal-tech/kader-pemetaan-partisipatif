import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DataSpasialItem,
  LogoSertifikatItem,
  PenandatanganSertifikatItem,
  PeranPengguna,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  TugasPemetaan
} from "../types";
import {
  DAFTAR_20_LEVEL_GIS,
  hitungCapaianKader,
  hitungPeringkatGis20Level,
  TARGET_POLIGON_HA,
  TARGET_TITIK,
  TARGET_TRACKING_KM
} from "../lib/rewardEngine";
import {
  Award,
  Download,
  ShieldCheck,
  Settings,
  Printer,
  Camera,
  UserCheck,
  Trash2,
  PenTool,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Image as ImageIcon,
  FileText
} from "lucide-react";

interface RewardViewProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  peran?: PeranPengguna;
  sertifikatList: SertifikatKader[];
  pesanList?: PesanKomunikasi[];
  tugasList?: TugasPemetaan[];
  onUbahProfil: (p: ProfilKader) => void;
  onUbahPenandatanganSertifikat?: (nama: string, jabatan: string) => void;
}

/**
 * Daftar Logo Default pada Header Sertifikat (Dapat Diatur, Ditambah, Diubah & Dihapus)
 */
export const DEFAULT_LOGO_SERTIFIKAT: LogoSertifikatItem[] = [
  {
    id: "logo-1",
    nama: "BALAI SPASIAL",
    warnaAksen: "#facc15"
  },
  {
    id: "logo-2",
    nama: "DESA MANDIRI",
    warnaAksen: "#38bdf8"
  },
  {
    id: "logo-3",
    nama: "RIMBA LESTARI",
    warnaAksen: "#22c55e"
  },
  {
    id: "logo-4",
    nama: "GEOKADER ID",
    warnaAksen: "#a855f7"
  }
];

/**
 * Daftar Penandatangan Default pada Sertifikat (Dapat Diatur, Ditambah, Diubah & Dihapus)
 */
export const DEFAULT_PENANDATANGAN_SERTIFIKAT: PenandatanganSertifikatItem[] = [
  {
    id: "sign-1",
    jabatan: "Koordinator Wilayah",
    instansi: "Balai Pemetaan Spasial Desa",
    nama: "Dr. Ir. Jonni Marwa, S.Hut., M.Si."
  },
  {
    id: "sign-2",
    jabatan: "Ketua Pelaksana",
    instansi: "Jaringan Kader Geospasial",
    nama: "Dr. Hj. Farah Diba, S.Hut., M.Si."
  },
  {
    id: "sign-3",
    jabatan: "Kepala Divisi Verifikasi",
    instansi: "Pusat Data Geospasial Komunitas",
    nama: "Dr. Ir. Rudi Hartono, S.Hut., M.Si."
  },
  {
    id: "sign-4",
    jabatan: "Ketua Umum",
    instansi: "Indonesia Mapping Community",
    nama: "Zulfikar Mardiyadi, S.Hut., M.Si."
  }
];

/**
 * Komponen SVG Siluet Orang bergaya WhatsApp Default Avatar
 */
export const SiluetOrangSvg: React.FC<{ size?: number; warna?: string }> = ({
  size = 38
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <clipPath id="waAvatarClip">
        <circle cx="32" cy="32" r="30" />
      </clipPath>
    </defs>
    {/* Latar abu-biru khas avatar kosong WhatsApp */}
    <circle cx="32" cy="32" r="30" fill="#6b7c85" />
    <g clipPath="url(#waAvatarClip)">
      {/* Kepala bulat halus khas WhatsApp */}
      <circle cx="32" cy="23" r="11.5" fill="#cfd8dc" />
      {/* Bahu melengkung kubah khas WhatsApp */}
      <path
        d="M10 58C10 44.5 19.5 38 32 38C44.5 38 54 44.5 54 58V64H10V58Z"
        fill="#cfd8dc"
      />
    </g>
  </svg>
);

/**
 * Komponen SVG Gambar Kunci (Gembok Level Terkunci)
 */
const KunciLevelSvg: React.FC<{ size?: number; warna?: string }> = ({
  size = 28,
  warna = "#fbbf24"
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect
      x="10"
      y="21"
      width="28"
      height="21"
      rx="5"
      fill="rgba(2, 44, 34, 0.85)"
      stroke={warna}
      strokeWidth="3"
    />
    <path
      d="M16 21V15C16 10.5817 19.5817 7 24 7C28.4183 7 32 10.5817 32 15V21"
      stroke={warna}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <circle cx="24" cy="30" r="3" fill={warna} />
    <path
      d="M24 33V36"
      stroke={warna}
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Menggambar Siluet Orang bergaya WhatsApp di dalam Bingkai Passfoto Sertifikat
 * ketika kader belum mengunggah foto.
 */
function gambarSiluetWhatsAppCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Latar belakang abu-slate khas WhatsApp default profile
  ctx.fillStyle = "#6b7c85";
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;

  // Lingkaran halus di tengah seperti ikon kontak WhatsApp
  ctx.fillStyle = "#5c6d75";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.44, 0, Math.PI * 2);
  ctx.fill();

  // Kepala bulat putih-abu khas WhatsApp
  const headR = w * 0.21;
  ctx.fillStyle = "#dfe5e7";
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.11, headR, 0, Math.PI * 2);
  ctx.fill();

  // Bahu kubah mulus khas WhatsApp
  const shoulderW = w * 0.42;
  const shoulderTopY = cy + h * 0.08;
  const shoulderBottomY = y + h;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, shoulderBottomY);
  ctx.quadraticCurveTo(
    cx - shoulderW,
    shoulderTopY,
    cx,
    shoulderTopY
  );
  ctx.quadraticCurveTo(
    cx + shoulderW,
    shoulderTopY,
    cx + shoulderW,
    shoulderBottomY
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Menggambar Passfoto Kader di Tengah Bawah Sertifikat (dengan 4 Siku Sudut seperti Referensi)
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

  const pad = 6;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;

  // Bayangan lembut di belakang foto
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(ix, iy, iw, ih);
  ctx.shadowColor = "transparent";

  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();

  if (fotoImg && fotoImg.complete && fotoImg.naturalWidth > 0) {
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
    gambarSiluetWhatsAppCanvas(ctx, ix, iy, iw, ih);
  }
  ctx.restore();

  // Garis tepi tipis foto
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(ix, iy, iw, ih);

  // 4 Siku Sudut Biru Navy (Corner Brackets) persis seperti pada Referensi Foto
  const cornerLen = 22;
  ctx.strokeStyle = "#1e3a8a";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "square";

  // Kiri Atas
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLen, y);
  ctx.stroke();

  // Kanan Atas
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cornerLen);
  ctx.stroke();

  // Kiri Bawah
  ctx.beginPath();
  ctx.moveTo(x, y + h - cornerLen);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + cornerLen, y + h);
  ctx.stroke();

  // Kanan Bawah
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cornerLen);
  ctx.stroke();

  ctx.restore();
}

/**
 * Menggambar Barisan Logo di dalam Header V-Chevron Biru Navy (Sesuai Referensi)
 */
function gambarDeretanLogoHeader(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  yCenter: number,
  logos: LogoSertifikatItem[],
  logoImagesMap: Record<string, HTMLImageElement>
) {
  if (!logos.length) return;
  ctx.save();

  const radius = 37;
  const gap = 26;
  const totalW = logos.length * (radius * 2) + (logos.length - 1) * gap;
  let startX = centerX - totalW / 2 + radius;

  const paletWarna = ["#eab308", "#f8fafc", "#16a34a", "#06b6d4", "#f97316"];

  logos.forEach((logo, idx) => {
    const cx = startX + idx * (radius * 2 + gap);
    const cy = yCenter;
    const warna = logo.warnaAksen || paletWarna[idx % paletWarna.length];
    const img = logoImagesMap[logo.id];

    // Lingkaran luar emblem
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = warna;
    ctx.stroke();
    ctx.restore();

    if (img && img.complete && img.naturalWidth > 0) {
      // Gambar logo yang diunggah user
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        img,
        cx - (radius - 4),
        cy - (radius - 4),
        (radius - 4) * 2,
        (radius - 4) * 2
      );
      ctx.restore();
    } else {
      // Emblem vektor organisasi otomatis jika belum unggah gambar
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 5, 0, Math.PI * 2);
      ctx.fillStyle = idx % 2 === 0 ? "#0f172a" : "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = warna;
      ctx.stroke();

      // Ornamen bintang/kompas kecil di tengah logo
      ctx.fillStyle = warna;
      ctx.beginPath();
      ctx.arc(cx, cy - 3, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = idx % 2 === 0 ? "#0f172a" : "#ffffff";
      ctx.font = "900 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      const inisial = (logo.nama || "GIS")
        .split(/\s+/)
        .map((k) => k[0] || "")
        .join("")
        .slice(0, 3)
        .toUpperCase();
      ctx.fillText(inisial, cx, cy);

      // Teks nama pendek di bagian bawah lingkaran logo
      ctx.fillStyle = idx % 2 === 0 ? "#fde68a" : "#1e293b";
      ctx.font = "bold 7.5px system-ui, sans-serif";
      ctx.fillText((logo.nama || " MITRA ").slice(0, 12).toUpperCase(), cx, cy + 18);
      ctx.restore();
    }
  });

  ctx.restore();
}

/**
 * Menggambar QR Code Verifikasi di Sisi Kanan Sertifikat (Sesuai Referensi)
 */
function gambarQrCodeVerifikasi(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seedStr: string
) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - 8, y - 8, size + 16, size + 16);
  ctx.strokeRect(x - 8, y - 8, size + 16, size + 16);

  const cells = 21;
  const cellSize = size / cells;

  // Hash sederhana dari nomor sertifikat agar pola QR konsisten
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinderPattern = (r: number, c: number) => {
    const inTopLeft = r < 7 && c < 7;
    const inTopRight = r < 7 && c >= cells - 7;
    const inBottomLeft = r >= cells - 7 && c < 7;
    return inTopLeft || inTopRight || inBottomLeft;
  };

  const drawFinder = (r0: number, c0: number) => {
    ctx.fillStyle = "#111827";
    ctx.fillRect(x + c0 * cellSize, y + r0 * cellSize, 7 * cellSize, 7 * cellSize);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
      x + (c0 + 1) * cellSize,
      y + (r0 + 1) * cellSize,
      5 * cellSize,
      5 * cellSize
    );
    ctx.fillStyle = "#111827";
    ctx.fillRect(
      x + (c0 + 2) * cellSize,
      y + (r0 + 2) * cellSize,
      3 * cellSize,
      3 * cellSize
    );
  };

  drawFinder(0, 0);
  drawFinder(0, cells - 7);
  drawFinder(cells - 7, 0);

  ctx.fillStyle = "#111827";
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (isFinderPattern(r, c)) continue;
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) {
          ctx.fillRect(
            x + c * cellSize,
            y + r * cellSize,
            cellSize + 0.4,
            cellSize + 0.4
          );
        }
        continue;
      }
      const v = Math.abs(Math.sin(r * 13.37 + c * 7.91 + (hash & 0xffff))) * 100;
      if (v > 47) {
        ctx.fillRect(
          x + c * cellSize,
          y + r * cellSize,
          cellSize + 0.4,
          cellSize + 0.4
        );
      }
    }
  }

  ctx.restore();
}

/**
 * Menggambar Blok Penandatangan (Jabatan, Instansi, Stempel + Tanda Tangan, Nama)
 * seperti pada Referensi Sertifikat
 */
function gambarSatuBlokPenandatangan(
  ctx: CanvasRenderingContext2D,
  cx: number,
  yTop: number,
  item: PenandatanganSertifikatItem,
  idx: number,
  ttdImg?: HTMLImageElement
) {
  ctx.save();
  ctx.textAlign = "center";

  // 1. Jabatan & Instansi di atas
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
  ctx.fillText(item.jabatan || "Pejabat Penandatangan", cx, yTop);

  ctx.fillStyle = "#334155";
  ctx.font = "600 16px system-ui, -apple-system, sans-serif";
  ctx.fillText(item.instansi || "", cx, yTop + 23);

  // 2. Stempel Resmi Melingkar di Kiri-Tengah Blok
  const stampX = cx - 34;
  const stampY = yTop + 76;
  ctx.save();
  ctx.translate(stampX, stampY);
  ctx.rotate(-0.14 + idx * 0.05);
  ctx.strokeStyle = "rgba(67, 56, 202, 0.58)";
  ctx.fillStyle = "rgba(67, 56, 202, 0.58)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 41, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.stroke();

  const labelStempel = (item.instansi || "VERIFIKASI SPASIAL")
    .toUpperCase()
    .slice(0, 22);
  ctx.font = "bold 7.5px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`★ ${labelStempel} ★`, 0, -24);
  ctx.fillText("TERVERIFIKASI RESMI", 0, 29);
  ctx.font = "900 8.5px system-ui, sans-serif";
  ctx.fillText("GEOKADER", 0, 3);
  ctx.restore();

  // 3. Tanda Tangan (Gambar Unggahan atau Garis Penandatangan Fisik)
  if (ttdImg && ttdImg.complete && ttdImg.naturalWidth > 0) {
    const maxW = 160;
    const maxH = 82;
    const scale = Math.min(maxW / ttdImg.naturalWidth, maxH / ttdImg.naturalHeight);
    const dw = ttdImg.naturalWidth * scale;
    const dh = ttdImg.naturalHeight * scale;
    ctx.drawImage(ttdImg, cx - dw / 2, yTop + 34 + (maxH - dh) / 2, dw, dh);
  } else {
    // Garis penandatangan fisik resmi jika belum ada tanda tangan digital yang diunggah
    ctx.save();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - 65, yTop + 96);
    ctx.lineTo(cx + 65, yTop + 96);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Nama Lengkap & Gelar Penandatangan di Bawah
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 17.5px system-ui, -apple-system, sans-serif";
  ctx.fillText(item.nama || "Pejabat Verifikasi", cx, yTop + 142);

  ctx.restore();
}

/**
 * Format Tanggal Indonesia (mis. 2026-10-28 -> 28 Oktober 2026)
 */
function formatTanggalSertifikatIndo(isoDate: string): string {
  const bulanIndo = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ];
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    const thn = parts[0];
    const blnIdx = parseInt(parts[1], 10) - 1;
    const tgl = parseInt(parts[2], 10);
    if (!isNaN(blnIdx) && blnIdx >= 0 && blnIdx < 12 && !isNaN(tgl)) {
      return `${tgl} ${bulanIndo[blnIdx]} ${thn}`;
    }
  }
  return isoDate;
}

/**
 * Merender Sertifikat ke Canvas (1600 x 1131 px - A4 Landscape)
 * Mengacu langsung pada Gambar Referensi Sertifikat Baru:
 * - Header V-Chevron Biru Navy Tua + Pita Emas Metalik + Sayap Perak
 * - Deretan Logo di dalam V-Chevron (bisa diatur/ditambah)
 * - Teks bebas redundansi kata
 * - QR Code di sisi kanan
 * - Passfoto 3x4 di tengah bawah (dengan siluet WhatsApp jika belum ada foto)
 * - Barisan Penandatangan di sisi kiri & kanan foto (bisa diatur/ditambah)
 */
function lukisSertifikatKeCanvas(
  canvas: HTMLCanvasElement,
  sert: SertifikatKader,
  fotoImg: HTMLImageElement | null,
  logoImagesMap: Record<string, HTMLImageElement>,
  ttdImagesMap: Record<string, HTMLImageElement>
) {
  const W = 1600;
  const H = 1131;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  // 1. Margin Luar Abu-Perak Halus (seperti bingkai luar pada gambar referensi)
  const outerGrad = ctx.createLinearGradient(0, 0, W, H);
  outerGrad.addColorStop(0, "#cbd5e1");
  outerGrad.addColorStop(0.5, "#e2e8f0");
  outerGrad.addColorStop(1, "#cbd5e1");
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, W, H);

  const margin = 30;
  const innerX = margin;
  const innerY = margin;
  const innerW = W - margin * 2;
  const innerH = H - margin * 2;

  // 2. Latar Dalam Putih-Perak Bersih
  const bodyGrad = ctx.createLinearGradient(0, innerY + 200, 0, H - margin);
  bodyGrad.addColorStop(0, "#e5eaf0");
  bodyGrad.addColorStop(0.32, "#f8fafc");
  bodyGrad.addColorStop(1, "#ffffff");
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(innerX, innerY, innerW, innerH);

  // 3. Sayap Segitiga Abu-Perak di Kiri & Kanan Bawah Header (sesuai referensi)
  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();

  ctx.fillStyle = "#cfd8e3";
  ctx.beginPath();
  ctx.moveTo(innerX, innerY + 150);
  ctx.lineTo(W / 2, innerY + 318);
  ctx.lineTo(innerX, innerY + 465);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(innerX + innerW, innerY + 150);
  ctx.lineTo(W / 2, innerY + 318);
  ctx.lineTo(innerX + innerW, innerY + 465);
  ctx.closePath();
  ctx.fill();

  // 4. Pita V-Chevron Emas Metalik di Bawah Header Biru
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  const goldRibbonGrad = ctx.createLinearGradient(innerX, 0, innerX + innerW, 0);
  goldRibbonGrad.addColorStop(0, "#c8a95b");
  goldRibbonGrad.addColorStop(0.3, "#e5ca82");
  goldRibbonGrad.addColorStop(0.5, "#b38e3d");
  goldRibbonGrad.addColorStop(0.7, "#e5ca82");
  goldRibbonGrad.addColorStop(1, "#c09e4e");
  ctx.fillStyle = goldRibbonGrad;
  ctx.beginPath();
  ctx.moveTo(innerX, innerY + 146);
  ctx.lineTo(W / 2, innerY + 324);
  ctx.lineTo(innerX + innerW, innerY + 146);
  ctx.lineTo(innerX + innerW, innerY + 184);
  ctx.lineTo(W / 2, innerY + 344);
  ctx.lineTo(innerX, innerY + 184);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 5. Header V-Chevron Biru Navy Tua (Royal Navy Blue seperti referensi)
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;

  const navyGrad = ctx.createLinearGradient(0, innerY, 0, innerY + 324);
  navyGrad.addColorStop(0, "#003f7a");
  navyGrad.addColorStop(0.55, "#002855");
  navyGrad.addColorStop(1, "#001433");
  ctx.fillStyle = navyGrad;
  ctx.beginPath();
  ctx.moveTo(innerX, innerY);
  ctx.lineTo(innerX + innerW, innerY);
  ctx.lineTo(innerX + innerW, innerY + 150);
  ctx.lineTo(W / 2, innerY + 320);
  ctx.lineTo(innerX, innerY + 150);
  ctx.closePath();
  ctx.fill();

  // Aksen lipatan biru gelap di sisi kiri & kanan bawah header navy
  ctx.fillStyle = "rgba(0, 12, 34, 0.55)";
  ctx.beginPath();
  ctx.moveTo(innerX, innerY + 112);
  ctx.lineTo(W / 2, innerY + 320);
  ctx.lineTo(innerX, innerY + 150);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(innerX + innerW, innerY + 112);
  ctx.lineTo(W / 2, innerY + 320);
  ctx.lineTo(innerX + innerW, innerY + 150);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore(); // end clip inner rect

  // 6. Garis Bingkai Emas Metalik Mengelilingi Sertifikat
  ctx.strokeStyle = "#bfa054";
  ctx.lineWidth = 4;
  ctx.strokeRect(innerX, innerY, innerW, innerH);

  // 7. Judul Utama 2 Baris di dalam Header Navy (Bebas Redundansi Kata)
  const centerX = W / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#e2e8f0";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  ctx.font = "400 44px Georgia, 'Times New Roman', serif";
  ctx.fillText("S E R T I F I K A T   P E N G H A R G A A N", centerX, innerY + 76);

  ctx.font = "400 46px Georgia, 'Times New Roman', serif";
  ctx.fillText("P E M E T A A N   W I L A Y A H   P A R T I S I P A T I F", centerX, innerY + 136);
  ctx.restore();

  // 8. Barisan Logo di dalam Bagian Bawah V-Chevron Biru Navy
  // Hanya digambar jika logo sudah dimasukkan/diunggah berkas gambarnya oleh admin
  const logosDenganGambar = (sert.logoSertifikatList || []).filter(
    (l) => Boolean(l.imageBase64)
  );
  if (logosDenganGambar.length > 0) {
    gambarDeretanLogoHeader(
      ctx,
      centerX,
      innerY + 216,
      logosDenganGambar,
      logoImagesMap
    );
  }

  // 9. Teks "Diberikan Kepada"
  ctx.textAlign = "center";
  ctx.fillStyle = "#111827";
  ctx.font = "italic bold 27px Georgia, 'Times New Roman', serif";
  ctx.fillText("D i b e r i k a n   K e p a d a", centerX, 430);

  // 10. Nama Penerima + Garis Bawah Emas-Zaitun + Nomor Sertifikat di Bawah Garis
  const namaBersih = (sert.namaKader || "Kader Spasial").replace(
    /\s*\(Kader Lapangan\)/i,
    ""
  );
  let fontNama = 46;
  ctx.font = `bold ${fontNama}px Georgia, 'Times New Roman', serif`;
  while (ctx.measureText(namaBersih).width > 960 && fontNama > 28) {
    fontNama -= 2;
    ctx.font = `bold ${fontNama}px Georgia, 'Times New Roman', serif`;
  }
  ctx.fillStyle = "#111827";
  ctx.fillText(namaBersih, centerX, 518);

  const wLine = Math.min(980, Math.max(580, ctx.measureText(namaBersih).width + 130));
  ctx.strokeStyle = "#8c783c";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(centerX - wLine / 2, 534);
  ctx.lineTo(centerX + wLine / 2, 534);
  ctx.stroke();

  // Nomor Sertifikat tepat di bawah garis nama (seperti referensi)
  ctx.fillStyle = "#0f172a";
  ctx.font = "italic bold 22px Georgia, 'Times New Roman', serif";
  ctx.fillText(`Nomor: ${sert.nomorSertifikat}`, centerX, 568);

  // 11. Deskripsi Peran & Tema Kegiatan (Dapat Diubah oleh Admin)
  const peranTeks = "Sebagai Kader Desa";
  const temaRaw =
    sert.temaKegiatanSertifikat?.trim() ||
    "Inventarisasi dan Verifikasi Data Geospasial Wilayah Desa Rimba Hijau";

  const temaKegiatan =
    temaRaw.startsWith('"') && temaRaw.endsWith('"')
      ? temaRaw
      : `"${temaRaw}"`;

  ctx.fillStyle = "#111827";
  ctx.font = "600 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(peranTeks, centerX, 636);

  // Ukuran font adaptif untuk tema kegiatan agar tidak pernah overflow
  let fontTema = 28;
  ctx.font = `500 ${fontTema}px system-ui, -apple-system, sans-serif`;
  const maxW = 1250;
  while (ctx.measureText(temaKegiatan).width > maxW && fontTema > 14) {
    fontTema -= 1;
    ctx.font = `500 ${fontTema}px system-ui, -apple-system, sans-serif`;
  }
  ctx.fillText(temaKegiatan, centerX, 678);

  ctx.font = "500 24px system-ui, -apple-system, sans-serif";
  ctx.fillText(formatTanggalSertifikatIndo(sert.tanggalTerbit), centerX, 742);

  // 12. QR Code Verifikasi di Sisi Kanan (Hanya dibuat jika logo ATAU tanda tangan sudah dimasukkan)
  const adaLogoDimasukkan = (sert.logoSertifikatList || []).some((l) =>
    Boolean(l.imageBase64)
  );
  const adaTtdDimasukkan = (sert.penandatanganList || []).some((p) =>
    Boolean(p.tandaTanganBase64)
  );
  const tampilkanBarcode = adaLogoDimasukkan || adaTtdDimasukkan;

  if (tampilkanBarcode) {
    gambarQrCodeVerifikasi(
      ctx,
      W - 235,
      545,
      132,
      `${sert.nomorSertifikat}-${sert.idKader}-${sert.namaKader}`
    );
  }

  // 13. Passfoto 3x4 di Tengah Bawah (atau Siluet WhatsApp jika belum ada foto)
  const photoW = 136;
  const photoH = 182;
  const photoX = centerX - photoW / 2;
  const photoY = 826;
  gambarBingkaiFotoKaderCanvas(ctx, photoX, photoY, photoW, photoH, fotoImg);

  // 14. Barisan Penandatangan di Kiri & Kanan Passfoto
  const signers =
    sert.penandatanganList && sert.penandatanganList.length > 0
      ? sert.penandatanganList
      : DEFAULT_PENANDATANGAN_SERTIFIKAT;

  const ySignTop = 852;
  const leftCount = Math.ceil(signers.length / 2);
  const leftSigners = signers.slice(0, leftCount);
  const rightSigners = signers.slice(leftCount);

  // Area kiri: antara x = 75 s/d photoX - 30
  const leftAreaStart = 75;
  const leftAreaEnd = photoX - 25;
  const leftAreaW = leftAreaEnd - leftAreaStart;

  leftSigners.forEach((sig, i) => {
    const cx =
      leftAreaStart + ((i + 0.5) / Math.max(1, leftSigners.length)) * leftAreaW;
    gambarSatuBlokPenandatangan(
      ctx,
      cx,
      ySignTop,
      sig,
      i,
      ttdImagesMap[sig.id]
    );
  });

  // Area kanan: antara photoX + photoW + 25 s/d W - 75
  const rightAreaStart = photoX + photoW + 25;
  const rightAreaEnd = W - 75;
  const rightAreaW = rightAreaEnd - rightAreaStart;

  rightSigners.forEach((sig, i) => {
    const cx =
      rightAreaStart + ((i + 0.5) / Math.max(1, rightSigners.length)) * rightAreaW;
    gambarSatuBlokPenandatangan(
      ctx,
      cx,
      ySignTop,
      sig,
      i + leftCount,
      ttdImagesMap[sig.id]
    );
  });
}

/**
 * Komponen Cincin Progres SVG Visual
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
  pesanList = [],
  tugasList = [],
  onUbahProfil,
  onUbahPenandatanganSertifikat
}) => {
  const certCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);
  const [bukaPengaturan, setBukaPengaturan] = useState(false);
  const [bukaAturSertifikat, setBukaAturSertifikat] = useState(false);
  const [fotoElement, setFotoElement] = useState<HTMLImageElement | null>(null);
  const [logoImagesMap, setLogoImagesMap] = useState<Record<string, HTMLImageElement>>({});
  const [ttdImagesMap, setTtdImagesMap] = useState<Record<string, HTMLImageElement>>({});

  const capaian = useMemo(
    () => hitungCapaianKader(dataSpasial, profil, false),
    [dataSpasial, profil]
  );

  const peringkatGis = useMemo(
    () => hitungPeringkatGis20Level(dataSpasial, profil, pesanList, tugasList),
    [dataSpasial, profil, pesanList, tugasList]
  );

  const { levelSaatIni, persenProgresLevel } = peringkatGis;

  // State navigasi level ke kiri / ke kanan (1 s/d 20)
  const [nomorLevelDilihat, setNomorLevelDilihat] = useState<number>(
    levelSaatIni.level
  );

  useEffect(() => {
    setNomorLevelDilihat(levelSaatIni.level);
  }, [levelSaatIni.level]);

  const infoLevelDilihat =
    DAFTAR_20_LEVEL_GIS.find((l) => l.level === nomorLevelDilihat) || levelSaatIni;
  const apakahLevelTerkunci = nomorLevelDilihat > levelSaatIni.level;

  const levelKiri =
    nomorLevelDilihat > 1
      ? DAFTAR_20_LEVEL_GIS.find((l) => l.level === nomorLevelDilihat - 1) || null
      : null;
  const levelKanan =
    nomorLevelDilihat < DAFTAR_20_LEVEL_GIS.length
      ? DAFTAR_20_LEVEL_GIS.find((l) => l.level === nomorLevelDilihat + 1) || null
      : null;

  const sertifikatSaya = sertifikatList.find((s) => s.idKader === profil.idKader);

  const totalPoin = capaian.totalPoinTitik;
  const totalKm = capaian.totalTrackingKm;
  const totalHa = capaian.totalPoligonHa;
  const sudahTersertifikasi = Boolean(sertifikatSaya) || capaian.berhakSertifikat;

  const fotoSertifikatBase64 =
    sertifikatSaya?.fotoKaderBase64 || profil.fotoKaderBase64 || "";

  const logoListAktif: LogoSertifikatItem[] = useMemo(() => {
    if (profil.logoSertifikatList) {
      return profil.logoSertifikatList;
    }
    if (sertifikatSaya?.logoSertifikatList) {
      return sertifikatSaya.logoSertifikatList;
    }
    return [];
  }, [profil.logoSertifikatList, sertifikatSaya?.logoSertifikatList]);

  const temaKegiatanAktif =
    profil.temaKegiatanSertifikat ??
    sertifikatSaya?.temaKegiatanSertifikat ??
    "Inventarisasi dan Verifikasi Data Geospasial Wilayah Desa Rimba Hijau";

  const handleUbahTemaKegiatan = (teks: string) => {
    onUbahProfil({
      ...profil,
      temaKegiatanSertifikat: teks
    });
  };

  const penandatanganListAktif: PenandatanganSertifikatItem[] = useMemo(() => {
    if (profil.penandatanganList && profil.penandatanganList.length > 0) {
      return profil.penandatanganList;
    }
    if (
      sertifikatSaya?.penandatanganList &&
      sertifikatSaya.penandatanganList.length > 0
    ) {
      return sertifikatSaya.penandatanganList;
    }
    return DEFAULT_PENANDATANGAN_SERTIFIKAT;
  }, [profil.penandatanganList, sertifikatSaya?.penandatanganList]);

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

  // Muat gambar logo custom ke HTMLImageElement
  useEffect(() => {
    let aktif = true;
    const mapBaru: Record<string, HTMLImageElement> = {};
    const denganGambar = logoListAktif.filter((l) => Boolean(l.imageBase64));
    if (denganGambar.length === 0) {
      setLogoImagesMap({});
      return;
    }
    let selesai = 0;
    denganGambar.forEach((l) => {
      const img = new Image();
      img.onload = () => {
        mapBaru[l.id] = img;
        selesai++;
        if (aktif && selesai === denganGambar.length) {
          setLogoImagesMap({ ...mapBaru });
        }
      };
      img.onerror = () => {
        selesai++;
        if (aktif && selesai === denganGambar.length) {
          setLogoImagesMap({ ...mapBaru });
        }
      };
      img.src = l.imageBase64!;
    });
    return () => {
      aktif = false;
    };
  }, [logoListAktif]);

  // Muat gambar tanda tangan custom ke HTMLImageElement
  useEffect(() => {
    let aktif = true;
    const mapBaru: Record<string, HTMLImageElement> = {};
    const denganGambar = penandatanganListAktif.filter((p) =>
      Boolean(p.tandaTanganBase64)
    );
    if (denganGambar.length === 0) {
      setTtdImagesMap({});
      return;
    }
    let selesai = 0;
    denganGambar.forEach((p) => {
      const img = new Image();
      img.onload = () => {
        mapBaru[p.id] = img;
        selesai++;
        if (aktif && selesai === denganGambar.length) {
          setTtdImagesMap({ ...mapBaru });
        }
      };
      img.onerror = () => {
        selesai++;
        if (aktif && selesai === denganGambar.length) {
          setTtdImagesMap({ ...mapBaru });
        }
      };
      img.src = p.tandaTanganBase64!;
    });
    return () => {
      aktif = false;
    };
  }, [penandatanganListAktif]);

  const sertifikatTampil: SertifikatKader = useMemo(() => {
    const pejabatUtama = penandatanganListAktif[0];
    const namaPenandatangan =
      pejabatUtama?.nama ||
      sertifikatSaya?.ditandatanganiOleh ||
      profil.namaPenandatanganSertifikat ||
      "Dr. Ir. Jonni Marwa, S.Hut., M.Si.";
    const jabatanPenandatangan =
      pejabatUtama?.jabatan ||
      sertifikatSaya?.jabatanPenandatangan ||
      profil.jabatanPenandatanganSertifikat ||
      "Koordinator Wilayah";

    if (sertifikatSaya) {
      return {
        ...sertifikatSaya,
        ditandatanganiOleh: namaPenandatangan,
        jabatanPenandatangan,
        fotoKaderBase64: fotoSertifikatBase64 || undefined,
        logoSertifikatList: logoListAktif,
        penandatanganList: penandatanganListAktif,
        temaKegiatanSertifikat: temaKegiatanAktif
      };
    }
    return {
      id: `CERT-${profil.idKader}`,
      nomorSertifikat: `0115/SKPP-GIS/WILAYAH/X/${new Date().getFullYear()}`,
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      namaOrganisasi:
        profil.namaOrganisasi || "Sertifikat Kader Pemetaan Partisipatif",
      tanggalTerbit: new Date().toISOString().slice(0, 10),
      alasanCapaian: "Dedikasi Survei Spasial Desa",
      status: sudahTersertifikasi ? "diterbitkan" : "menunggu_admin",
      ditandatanganiOleh: namaPenandatangan,
      jabatanPenandatangan,
      fotoKaderBase64: fotoSertifikatBase64 || undefined,
      logoSertifikatList: logoListAktif,
      penandatanganList: penandatanganListAktif,
      temaKegiatanSertifikat: temaKegiatanAktif
    };
  }, [
    sertifikatSaya,
    profil,
    sudahTersertifikasi,
    fotoSertifikatBase64,
    logoListAktif,
    penandatanganListAktif,
    temaKegiatanAktif
  ]);

  useEffect(() => {
    if (certCanvasRef.current) {
      lukisSertifikatKeCanvas(
        certCanvasRef.current,
        sertifikatTampil,
        fotoElement,
        logoImagesMap,
        ttdImagesMap
      );
    }
  }, [sertifikatTampil, fotoElement, logoImagesMap, ttdImagesMap]);

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

  // Handler Kelola Logo Sertifikat
  const handleTambahLogo = () => {
    const warnaPalet = ["#eab308", "#38bdf8", "#22c55e", "#a855f7", "#f97316"];
    const itemBaru: LogoSertifikatItem = {
      id: `logo-${Date.now()}`,
      nama: `Logo Mitra ${logoListAktif.length + 1}`,
      warnaAksen: warnaPalet[logoListAktif.length % warnaPalet.length]
    };
    onUbahProfil({
      ...profil,
      logoSertifikatList: [...logoListAktif, itemBaru]
    });
  };

  const handleUbahLogo = (
    id: string,
    patch: Partial<LogoSertifikatItem>
  ) => {
    const baru = logoListAktif.map((l) => (l.id === id ? { ...l, ...patch } : l));
    onUbahProfil({ ...profil, logoSertifikatList: baru });
  };

  const handleUnggahGambarLogo = async (id: string, file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await kompresFotoKeDataUrl(file, 260);
      handleUbahLogo(id, { imageBase64: dataUrl });
    } catch {
      alert("Gagal memuat gambar logo.");
    }
  };

  const handleHapusLogo = (id: string) => {
    const baru = logoListAktif.filter((l) => l.id !== id);
    onUbahProfil({ ...profil, logoSertifikatList: baru });
  };

  // Handler Kelola Penandatangan Sertifikat
  const handleTambahPenandatangan = () => {
    const itemBaru: PenandatanganSertifikatItem = {
      id: `sign-${Date.now()}`,
      jabatan: "Koordinator Lapangan",
      instansi: profil.desaWilayah || "Lembaga Pemetaan Desa",
      nama: "Nama Pejabat, S.Hut., M.Si."
    };
    const baru = [...penandatanganListAktif, itemBaru];
    onUbahProfil({
      ...profil,
      penandatanganList: baru
    });
  };

  const handleUbahPenandatanganItem = (
    id: string,
    patch: Partial<PenandatanganSertifikatItem>
  ) => {
    const baru = penandatanganListAktif.map((p) =>
      p.id === id ? { ...p, ...patch } : p
    );
    onUbahProfil({
      ...profil,
      penandatanganList: baru,
      namaPenandatanganSertifikat: baru[0]?.nama,
      jabatanPenandatanganSertifikat: baru[0]?.jabatan
    });
    if (baru[0]) {
      onUbahPenandatanganSertifikat?.(baru[0].nama, baru[0].jabatan);
    }
  };

  const handleUnggahGambarTtd = async (id: string, file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await kompresFotoKeDataUrl(file, 360);
      handleUbahPenandatanganItem(id, { tandaTanganBase64: dataUrl });
    } catch {
      alert("Gagal memuat gambar tanda tangan.");
    }
  };

  const handleHapusPenandatangan = (id: string) => {
    if (penandatanganListAktif.length <= 1) return;
    const baru = penandatanganListAktif.filter((p) => p.id !== id);
    onUbahProfil({
      ...profil,
      penandatanganList: baru
    });
  };

  const handleUnduhSertifikatPng = () => {
    const canvas = certCanvasRef.current;
    if (!canvas) return;
    lukisSertifikatKeCanvas(
      canvas,
      sertifikatTampil,
      fotoElement,
      logoImagesMap,
      ttdImagesMap
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
      fotoElement,
      logoImagesMap,
      ttdImagesMap
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
              background: #cbd5e1;
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

      {/* 1. KARTU LEVEL KADER (GESER KIRI / KANAN DENGAN IKON KUNCI UNTUK LEVEL BELUM TERBUKA, TANPA XP) */}
      <div className="section-card reward-gis-hero-card">
        <div className="visual-profile-bar">
          <div className="visual-profile-left">
            <button
              type="button"
              className="visual-avatar-emblem avatar-silhouette-btn"
              onClick={() => inputFotoRef.current?.click()}
              title="Unggah foto kader"
            >
              {fotoSertifikatBase64 ? (
                <img
                  src={fotoSertifikatBase64}
                  alt={profil.nama}
                  className="visual-avatar-photo"
                />
              ) : (
                <SiluetOrangSvg size={38} />
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
            title="Profil"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* NAVIGASI LEVEL KE KIRI & KE KANAN DENGAN GAMBAR KUNCI UNTUK LEVEL DI ATASNYA */}
        <div className="visual-level-carousel">
          {/* TOMBOL LEVEL KIRI */}
          <button
            type="button"
            className={`visual-level-side-btn ${!levelKiri ? "disabled" : ""}`}
            disabled={!levelKiri}
            onClick={() =>
              levelKiri && setNomorLevelDilihat(levelKiri.level)
            }
            title={levelKiri ? `Lihat Level ${levelKiri.level}` : "Level Awal"}
          >
            <ChevronLeft size={20} className="side-arrow-icon" />
            {levelKiri ? (
              <div className="side-level-badge">
                {levelKiri.level > levelSaatIni.level ? (
                  <KunciLevelSvg size={26} warna="#94a3b8" />
                ) : (
                  <span className="side-level-unlocked-num">
                    Lv.{levelKiri.level}
                  </span>
                )}
                <span className="side-level-caption">
                  {levelKiri.level > levelSaatIni.level
                    ? "Terkunci"
                    : `Level ${levelKiri.level}`}
                </span>
              </div>
            ) : (
              <div className="side-level-badge muted">
                <span className="side-level-caption">Awal</span>
              </div>
            )}
          </button>

          {/* MEDALI TENGAH: TERBUKA JIKA <= LEVEL SAAT INI, GAMBAR KUNCI JIKA BELUM NAIK LEVEL */}
          <div className="visual-current-level-center">
            {apakahLevelTerkunci ? (
              <>
                <div className="visual-medal-svg-wrap locked-medal">
                  <svg width="96" height="96" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      fill="rgba(2, 44, 34, 0.8)"
                      stroke="rgba(148, 163, 184, 0.35)"
                      strokeWidth="5"
                      strokeDasharray="6 5"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="34"
                      fill="rgba(15, 23, 42, 0.75)"
                      stroke="#fbbf24"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="locked-medal-center-icon">
                    <KunciLevelSvg size={40} warna="#fbbf24" />
                  </div>
                </div>
                <div className="visual-current-level-title locked-title">
                  <Lock size={14} /> Level {infoLevelDilihat.level} Terkunci
                </div>
                <button
                  type="button"
                  className="visual-current-status-pill locked-pill"
                  onClick={() => setNomorLevelDilihat(levelSaatIni.level)}
                >
                  Belum terbuka • Kembali ke Level {levelSaatIni.level}
                </button>
              </>
            ) : (
              <>
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
                      {infoLevelDilihat.level}
                    </text>
                  </svg>
                </div>
                <div className="visual-current-level-title">
                  {infoLevelDilihat.namaLevel}
                </div>
                <div className="visual-current-status-pill">
                  {infoLevelDilihat.level === levelSaatIni.level
                    ? `Level Aktif • Progres ${persenProgresLevel}%`
                    : "Level Telah Terbuka"}
                </div>
              </>
            )}
          </div>

          {/* TOMBOL LEVEL KANAN (DIBERI GAMBAR KUNCI JIKA BELUM NAIK LEVEL) */}
          <button
            type="button"
            className={`visual-level-side-btn ${!levelKanan ? "disabled" : ""}`}
            disabled={!levelKanan}
            onClick={() =>
              levelKanan && setNomorLevelDilihat(levelKanan.level)
            }
            title={
              levelKanan
                ? levelKanan.level > levelSaatIni.level
                  ? `Level ${levelKanan.level} Terkunci`
                  : `Lihat Level ${levelKanan.level}`
                : "Level Puncak"
            }
          >
            {levelKanan ? (
              <div className="side-level-badge">
                {levelKanan.level > levelSaatIni.level ? (
                  <KunciLevelSvg size={28} warna="#fbbf24" />
                ) : (
                  <span className="side-level-unlocked-num">
                    Lv.{levelKanan.level}
                  </span>
                )}
                <span className="side-level-caption">
                  {levelKanan.level > levelSaatIni.level
                    ? `Lv.${levelKanan.level} Terkunci`
                    : `Level ${levelKanan.level}`}
                </span>
              </div>
            ) : (
              <div className="side-level-badge muted">
                <span className="side-level-caption">Puncak</span>
              </div>
            )}
            <ChevronRight size={20} className="side-arrow-icon" />
          </button>
        </div>
      </div>

      {/* 2. GRAFIK CINCIN VISUAL: CAPAIAN SPASIAL (TITIK, JALUR, POLIGON) */}
      <div className="visual-rings-grid">
        <CincinProgresSvg
          persen={(totalPoin / TARGET_TITIK) * 100}
          warna="#0d7344"
          nilai={`${totalPoin}/${TARGET_TITIK}`}
          label="Titik"
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
          label="Jalur"
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
          label="Poligon"
          ikon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="12 3 21 8 18 19 6 19 3 8" />
            </svg>
          }
        />
      </div>

      {/* 3. PREVIEW SERTIFIKAT BERGAMBAR + TOMBOL ATUR FOTO, LOGO & TANDA TANGAN */}
      <div className="section-card certificate-section-card">
        <div className="certificate-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={20} color="#0d7344" />
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Sertifikat</h3>
          </div>

          <div className="certificate-action-btns">
            {peran === "admin" && (
              <button
                type="button"
                className="btn-outline-sm cert-admin-btn"
                onClick={() => setBukaAturSertifikat((v) => !v)}
                title="Atur Logo, Tanda Tangan, dan Tema Sertifikat (Khusus Admin)"
              >
                <PenTool size={14} /> {bukaAturSertifikat ? "Tutup Editor" : "Atur Logo & TTD"}
              </button>
            )}
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => inputFotoRef.current?.click()}
              title="Foto Sertifikat"
            >
              <Camera size={14} /> {fotoSertifikatBase64 ? "Ganti Foto" : "+ Foto"}
            </button>
            {fotoSertifikatBase64 && (
              <button
                type="button"
                className="btn-outline-sm"
                onClick={handleHapusFotoSertifikat}
                title="Hapus Foto"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              className="btn-outline-sm"
              onClick={handleCetakSertifikat}
            >
              <Printer size={14} /> Cetak
            </button>
            <button
              type="button"
              className="btn-primary-sm btn-unduh-sertifikat"
              onClick={handleUnduhSertifikatPng}
            >
              <Download size={14} /> Unduh
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

        {/* PANEL ATUR & TAMBAH LOGO, TTD, SERTA TEMA SERTIFIKAT (KHUSUS ADMIN) */}
        {peran === "admin" && bukaAturSertifikat && (
          <div className="cert-customizer-panel">
            <div className="cert-admin-banner-info">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="badge-admin-only">Khusus Admin</span>
                <strong>Pengaturan Tampilan Sertifikat Resmi</strong>
              </div>
              <small style={{ color: "#64748b" }}>
                Pengaturan logo, tanda tangan pejabat, dan teks tema kegiatan hanya dapat diakses dan diubah oleh akun Administrator.
              </small>
            </div>

            {/* A. TEMA / DESKRIPSI KEGIATAN DI BAWAH 'SEBAGAI KADER DESA' (KHUSUS ADMIN) */}
            <div className="cert-customizer-section">
              <div className="cert-customizer-head">
                <div className="cert-admin-signer-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={15} color="#0d7344" />
                  <strong>Teks Kegiatan (Di Bawah 'Sebagai Kader Desa')</strong>
                </div>
              </div>
              <div className="cert-theme-input-box">
                <input
                  type="text"
                  className="form-input"
                  placeholder='Contoh: "Inventarisasi dan Verifikasi Data Geospasial Wilayah Desa Rimba Hijau"'
                  value={temaKegiatanAktif}
                  onChange={(e) => handleUbahTemaKegiatan(e.target.value)}
                />
                <small style={{ color: "#64748b" }}>
                  Teks ini dicetak tepat di baris bawah <em>"Sebagai Kader Desa"</em> pada sertifikat. Font otomatis menyesuaikan panjang kalimat agar proporsional di PC maupun HP.
                </small>
              </div>
            </div>

            {/* B. PENGATURAN & TAMBAH LOGO SERTIFIKAT */}
            <div className="cert-customizer-section" style={{ marginTop: 12 }}>
              <div className="cert-customizer-head">
                <div className="cert-admin-signer-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <ImageIcon size={15} color="#0284c7" />
                  <strong>Logo Header ({logoListAktif.length})</strong>
                </div>
                <button
                  type="button"
                  className="btn-primary-sm"
                  onClick={handleTambahLogo}
                >
                  <Plus size={13} /> Tambah Logo
                </button>
              </div>

              {logoListAktif.length === 0 ? (
                <div className="cert-empty-hint">
                  Belum ada logo yang dimasukkan. Klik <strong>+ Tambah Logo</strong> lalu unggah file gambar logo agar ditampilkan pada header sertifikat dan mengaktifkan kode QR verifikasi.
                </div>
              ) : (
                <div className="cert-logo-editor-grid">
                  {logoListAktif.map((logo, idx) => (
                    <div key={logo.id} className="cert-logo-editor-item">
                      <div className="cert-logo-preview-thumb">
                        {logo.imageBase64 ? (
                          <img src={logo.imageBase64} alt={logo.nama} />
                        ) : (
                          <span>{(logo.nama || `L${idx + 1}`).slice(0, 3).toUpperCase()}</span>
                        )}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nama/Instansi Logo"
                        value={logo.nama}
                        onChange={(e) =>
                          handleUbahLogo(logo.id, { nama: e.target.value })
                        }
                      />
                      <label
                        className="btn-outline-sm"
                        style={{ margin: 0, cursor: "pointer", whiteSpace: "nowrap" }}
                        title="Unggah Gambar Logo"
                      >
                        <ImageIcon size={13} /> Gambar
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            handleUnggahGambarLogo(logo.id, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-danger-sm"
                        onClick={() => handleHapusLogo(logo.id)}
                        title="Hapus Logo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* C. PENGATURAN & TAMBAH TANDA TANGAN PEJABAT */}
            <div className="cert-customizer-section" style={{ marginTop: 12 }}>
              <div className="cert-customizer-head">
                <div className="cert-admin-signer-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <PenTool size={15} color="#0284c7" />
                  <strong>Tanda Tangan Pejabat ({penandatanganListAktif.length})</strong>
                </div>
                <button
                  type="button"
                  className="btn-primary-sm"
                  onClick={handleTambahPenandatangan}
                >
                  <Plus size={13} /> Tambah Penandatangan
                </button>
              </div>

              <div className="cert-signer-editor-list">
                {penandatanganListAktif.map((sig, idx) => (
                  <div key={sig.id} className="cert-signer-editor-card">
                    <div className="cert-signer-card-top">
                      <strong>Penandatangan #{idx + 1}</strong>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <label
                          className="btn-outline-sm"
                          style={{ margin: 0, cursor: "pointer", whiteSpace: "nowrap" }}
                          title="Unggah Gambar Tanda Tangan / Stempel"
                        >
                          <PenTool size={12} />{" "}
                          {sig.tandaTanganBase64 ? "Ganti TTD" : "Unggah TTD"}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              handleUnggahGambarTtd(sig.id, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {sig.tandaTanganBase64 && (
                          <button
                            type="button"
                            className="btn-outline-sm"
                            onClick={() =>
                              handleUbahPenandatanganItem(sig.id, {
                                tandaTanganBase64: undefined
                              })
                            }
                            title="Hapus gambar TTD"
                          >
                            Hapus TTD
                          </button>
                        )}
                        {penandatanganListAktif.length > 1 && (
                          <button
                            type="button"
                            className="btn-danger-sm"
                            onClick={() => handleHapusPenandatangan(sig.id)}
                            title="Hapus Penandatangan"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="form-row-3">
                      <div>
                        <label>Jabatan</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Mis. Dekan / Ketua Umum"
                          value={sig.jabatan}
                          onChange={(e) =>
                            handleUbahPenandatanganItem(sig.id, {
                              jabatan: e.target.value
                            })
                          }
                        />
                      </div>
                      <div>
                        <label>Instansi / Lembaga</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Mis. Indonesia Mapping Community"
                          value={sig.instansi}
                          onChange={(e) =>
                            handleUbahPenandatanganItem(sig.id, {
                              instansi: e.target.value
                            })
                          }
                        />
                      </div>
                      <div>
                        <label>Nama & Gelar</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nama lengkap & gelar"
                          value={sig.nama}
                          onChange={(e) =>
                            handleUbahPenandatanganItem(sig.id, {
                              nama: e.target.value
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. DRAWER PENGATURAN PROFIL */}
      {bukaPengaturan && (
        <div className="section-card">
          <h4 style={{ margin: "0 0 10px", fontSize: "0.94rem", display: "flex", alignItems: "center", gap: 6 }}>
            <UserCheck size={16} color="#0d7344" /> Profil
          </h4>
          <div className="form-row-3">
            <div>
              <label>Nama</label>
              <input
                type="text"
                className="form-input"
                value={profil.nama}
                onChange={(e) => onUbahProfil({ ...profil, nama: e.target.value })}
              />
            </div>
            <div>
              <label>Wilayah</label>
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
              <Camera size={14} /> {fotoSertifikatBase64 ? "Ubah Foto" : "Pilih Foto"}
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
