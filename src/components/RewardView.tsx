import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DataSpasialItem,
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
  Lock
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
 * Komponen SVG Siluet Orang (Avatar Kader)
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

  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#262626");
  bg.addColorStop(1, "#171717");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "#f4b342";
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy + 50, 44, Math.PI * 1.12, Math.PI * 1.88, false);
  ctx.lineTo(cx + 38, y + h);
  ctx.lineTo(cx - 38, y + h);
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

  ctx.shadowColor = "rgba(0, 0, 0, 0.14)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#f4b342";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = "transparent";

  const pad = 7;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(ix, iy, iw, ih, 6);
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
    gambarSiluetOrangCanvas(ctx, ix, iy, iw, ih);
  }
  ctx.restore();

  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(ix, iy, iw, ih, 6);
  ctx.stroke();

  ctx.restore();
}

/**
 * Menggambar Logo Perisai Kader Pemetaan di Pojok Kiri Atas Sertifikat
 */
function gambarLogoPerisaiKiriAtas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) {
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.lineTo(42, -32);
  ctx.lineTo(42, 8);
  ctx.quadraticCurveTo(42, 42, 0, 58);
  ctx.quadraticCurveTo(-42, 42, -42, 8);
  ctx.lineTo(-42, -32);
  ctx.closePath();
  ctx.fillStyle = "#262626";
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "#f4b342";
  ctx.stroke();

  ctx.fillStyle = "#f4b342";
  ctx.fillRect(-35, -28, 70, 14);
  ctx.fillStyle = "#171717";
  ctx.font = "900 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("KADER PEMETAAN", 0, -18);

  ctx.strokeStyle = "#f4b342";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 12, 18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#f4b342";
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(5, 8);
  ctx.lineTo(17, 12);
  ctx.lineTo(5, 16);
  ctx.lineTo(0, 28);
  ctx.lineTo(-5, 16);
  ctx.lineTo(-17, 12);
  ctx.lineTo(-5, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Menggambar Ornamen Segitiga Geometris sesuai Referensi PDF Sertifikat
 */
function gambarOrnamenSegitigaReferensi(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number
) {
  ctx.save();

  ctx.fillStyle = "#f6eadb";
  ctx.beginPath();
  ctx.moveTo(0, 180);
  ctx.lineTo(680, 0);
  ctx.lineTo(910, 420);
  ctx.lineTo(240, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f2e2ce";
  ctx.beginPath();
  ctx.moveTo(680, 0);
  ctx.lineTo(1240, 0);
  ctx.lineTo(910, 420);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f7efe4";
  ctx.beginPath();
  ctx.moveTo(910, 420);
  ctx.lineTo(W, 240);
  ctx.lineTo(W, H);
  ctx.lineTo(240, H);
  ctx.closePath();
  ctx.fill();

  const gradGoldTop = ctx.createLinearGradient(640, 0, 1180, 290);
  gradGoldTop.addColorStop(0, "#f7c55f");
  gradGoldTop.addColorStop(1, "#f0a52b");
  ctx.fillStyle = gradGoldTop;
  ctx.beginPath();
  ctx.moveTo(640, 0);
  ctx.lineTo(1170, 0);
  ctx.lineTo(905, 275);
  ctx.closePath();
  ctx.fill();

  const gradDarkTop = ctx.createLinearGradient(1170, 0, W, 380);
  gradDarkTop.addColorStop(0, "#1f1f1f");
  gradDarkTop.addColorStop(1, "#383838");
  ctx.fillStyle = gradDarkTop;
  ctx.beginPath();
  ctx.moveTo(1170, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, 390);
  ctx.lineTo(1375, 205);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#262626";
  ctx.beginPath();
  ctx.moveTo(1170, 0);
  ctx.lineTo(1375, 205);
  ctx.lineTo(1038, 138);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f4b342";
  ctx.beginPath();
  ctx.moveTo(1375, 205);
  ctx.lineTo(W, 390);
  ctx.lineTo(1235, 345);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#242424";
  ctx.beginPath();
  ctx.moveTo(1395, 505);
  ctx.lineTo(1548, 352);
  ctx.lineTo(W, 410);
  ctx.lineTo(W, 650);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f4b342";
  ctx.beginPath();
  ctx.moveTo(1395, 505);
  ctx.lineTo(W, 650);
  ctx.lineTo(W, 910);
  ctx.lineTo(1245, 655);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#262626";
  ctx.beginPath();
  ctx.moveTo(W, 910);
  ctx.lineTo(W, H);
  ctx.lineTo(1465, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f4b342";
  ctx.beginPath();
  ctx.moveTo(0, H - 170);
  ctx.lineTo(170, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#262626";
  ctx.beginPath();
  ctx.moveTo(0, H - 170);
  ctx.lineTo(82, H - 88);
  ctx.lineTo(0, H - 5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(350, 0);
  ctx.lineTo(665, 315);
  ctx.lineTo(980, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(1090, 285);
  ctx.lineTo(1245, 440);
  ctx.lineTo(1400, 285);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = "#f4b342";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(575, 0);
  ctx.lineTo(905, 330);
  ctx.lineTo(1235, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(1090, 560);
  ctx.lineTo(1375, 845);
  ctx.lineTo(W, 560);
  ctx.stroke();

  const gambarChevronKembar = (cx: number, cy: number, warna: string) => {
    ctx.fillStyle = warna;
    for (let i = 0; i < 2; i++) {
      const ox = cx + i * 22;
      ctx.beginPath();
      ctx.moveTo(ox, cy);
      ctx.lineTo(ox + 16, cy);
      ctx.lineTo(ox + 8, cy + 13);
      ctx.closePath();
      ctx.fill();
    }
  };
  gambarChevronKembar(578, 108, "#262626");
  gambarChevronKembar(290, 650, "#f4b342");
  gambarChevronKembar(1110, 748, "#262626");

  ctx.restore();
}

/**
 * Menggambar Stempel & Tanda Tangan Resmi di Bagian Bawah Sertifikat (Sesuai Referensi PDF)
 */
function gambarStempelDanTandaTanganResmi(
  ctx: CanvasRenderingContext2D,
  cx: number,
  yTop: number,
  namaPenandatangan: string,
  jabatanPenandatangan: string
) {
  ctx.save();

  const stampX = cx - 85;
  const stampY = yTop + 62;
  ctx.save();
  ctx.translate(stampX, stampY);
  ctx.rotate(-0.18);
  ctx.strokeStyle = "rgba(55, 48, 163, 0.72)";
  ctx.fillStyle = "rgba(55, 48, 163, 0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 43, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("★ SERTIFIKAT KADER ★", 0, -25);
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.fillText("PEMETAAN PARTISIPATIF", 0, 31);
  ctx.font = "900 10px system-ui, sans-serif";
  ctx.fillText("TERVERIFIKASI", 0, 4);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 65, yTop + 74);
  ctx.bezierCurveTo(cx - 35, yTop + 15, cx - 5, yTop + 95, cx + 18, yTop + 32);
  ctx.bezierCurveTo(cx + 35, yTop - 5, cx + 55, yTop + 82, cx + 88, yTop + 44);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 50, yTop + 82);
  ctx.quadraticCurveTo(cx + 15, yTop + 66, cx + 105, yTop + 78);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#171717";
  ctx.font = "bold 25px system-ui, -apple-system, sans-serif";
  ctx.fillText(namaPenandatangan, cx, yTop + 122);

  const wSign = Math.max(260, ctx.measureText(namaPenandatangan).width + 36);
  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx - wSign / 2, yTop + 132);
  ctx.lineTo(cx + wSign / 2, yTop + 132);
  ctx.stroke();

  ctx.fillStyle = "#334155";
  ctx.font = "600 19px system-ui, -apple-system, sans-serif";
  ctx.fillText(jabatanPenandatangan, cx, yTop + 158);

  ctx.restore();
}

/**
 * Merender Sertifikat ke Canvas (1600 x 1131 px - A4 Landscape)
 * Mengacu pada Referensi PDF Sertifikat User:
 * - Desain geometris segitiga kuning-emas & hitam elegan di atas latar putih gading bersih
 * - Tanpa kartu capaian (tidak perlu dibuat capaian)
 * - Judul kegiatan/program: "Sertifikat Kader Pemetaan Partisipatif"
 */
function lukisSertifikatKeCanvas(
  canvas: HTMLCanvasElement,
  sert: SertifikatKader,
  fotoImg: HTMLImageElement | null
) {
  const W = 1600;
  const H = 1131;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fdfcf9";
  ctx.fillRect(0, 0, W, H);

  gambarOrnamenSegitigaReferensi(ctx, W, H);
  gambarLogoPerisaiKiriAtas(ctx, 118, 96);

  ctx.textAlign = "left";
  ctx.fillStyle = "#475569";
  ctx.font = "600 15px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText(`No. Sertifikat: ${sert.nomorSertifikat}`, 180, 96);
  ctx.fillText(`Tanggal: ${sert.tanggalTerbit}`, 180, 120);

  gambarBingkaiFotoKaderCanvas(ctx, 108, 220, 164, 212, fotoImg);

  const centerX = 690;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "900 84px Georgia, 'Times New Roman', serif";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#f4b342";
  ctx.strokeText("S E R T I F I K A T", centerX + 4, 264);
  ctx.fillStyle = "#222222";
  ctx.fillText("S E R T I F I K A T", centerX, 260);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#262626";
  ctx.font = "bold 30px Georgia, 'Times New Roman', serif";
  ctx.fillText("Diberikan Kepada", centerX, 345);

  const namaTampil = (sert.namaKader || "Kader Pemetaan").replace(
    /\s*\(Kader Lapangan\)/i,
    ""
  );
  let fontNama = 74;
  ctx.font = `italic bold ${fontNama}px 'Brush Script MT', 'Segoe Script', 'Snell Roundhand', Georgia, serif`;
  while (ctx.measureText(namaTampil).width > 820 && fontNama > 40) {
    fontNama -= 4;
    ctx.font = `italic bold ${fontNama}px 'Brush Script MT', 'Segoe Script', 'Snell Roundhand', Georgia, serif`;
  }
  ctx.fillStyle = "#171717";
  ctx.fillText(namaTampil, centerX, 465);

  const wNama = Math.min(820, Math.max(420, ctx.measureText(namaTampil).width + 80));
  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(centerX - wNama / 2, 488);
  ctx.lineTo(centerX + wNama / 2, 488);
  ctx.stroke();

  const judulProgram =
    !sert.namaOrganisasi ||
    sert.namaOrganisasi.toLowerCase().includes("konsorsium")
      ? "Sertifikat Kader Pemetaan Partisipatif"
      : sert.namaOrganisasi;

  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 31px Georgia, 'Times New Roman', serif";
  ctx.fillText("Sebagai Kader Pemetaan Partisipatif", centerX, 560);

  ctx.fillStyle = "#334155";
  ctx.font = "27px Georgia, 'Times New Roman', serif";
  ctx.fillText("Dalam Kegiatan", centerX, 608);

  ctx.fillStyle = "#111827";
  ctx.font = "bold 34px Georgia, 'Times New Roman', serif";
  ctx.fillText(judulProgram, centerX, 658);

  ctx.fillStyle = "#475569";
  ctx.font = "600 23px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `ID Kader: ${sert.idKader}   •   Wilayah: ${sert.desaWilayah}`,
    centerX,
    706
  );

  const namaPenandatangan = sert.ditandatanganiOleh || "Koordinator Program GIS";
  const jabatanPenandatangan =
    sert.jabatanPenandatangan || "Koordinator Pemetaan Partisipatif";

  gambarStempelDanTandaTanganResmi(
    ctx,
    centerX,
    775,
    namaPenandatangan,
    jabatanPenandatangan
  );
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
  const [fotoElement, setFotoElement] = useState<HTMLImageElement | null>(null);

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
        profil.namaOrganisasi || "Sertifikat Kader Pemetaan Partisipatif",
      tanggalTerbit: new Date().toISOString().slice(0, 10),
      alasanCapaian: "Sertifikat Kader Pemetaan Partisipatif",
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
        fotoElement
      );
    }
  }, [sertifikatTampil, fotoElement]);

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
              background: #fdfcf9;
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

      {/* 3. PREVIEW SERTIFIKAT BERGAMBAR + TOMBOL TAMBAH FOTO SERTIFIKAT */}
      <div className="section-card certificate-section-card">
        <div className="certificate-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={20} color="#0d7344" />
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Sertifikat</h3>
          </div>

          <div className="certificate-action-btns">
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
              className="btn-primary-sm"
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

        {/* KONTROL CEPAT ADMIN UNTUK MENGUBAH NAMA PENANDATANGAN SERTIFIKAT */}
        {peran === "admin" && (
          <div className="cert-admin-signer-box">
            <div className="cert-admin-signer-title">
              <PenTool size={15} color="#0284c7" />
              <strong>Penandatangan</strong>
            </div>
            <div className="form-row-2">
              <div>
                <label>Nama Pejabat</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nama penandatangan"
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
                <label>Jabatan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Jabatan penandatangan"
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
