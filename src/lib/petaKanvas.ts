import { AreaPetaOffline, DataSpasialItem, JenisGeometri, KategoriSurvei, KoordinatTitik } from "../types";
import { StatePosisiPerangkat } from "./posisiPerangkat";

/**
 * Matematika tile Web Mercator, teks status sensor, dan penggambar lapisan peta di atas tile
 * (kisi, objek tersimpan, rekaman berjalan, garis Go-To, posisi GPS, bidikan tengah).
 */

export const TILE_SIZE = 256;

export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

export function tileXToLng(tx: number, zoom: number): number {
  return (tx / Math.pow(2, zoom)) * 360 - 180;
}

export function tileYToLat(ty: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * ty) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function teksStatusGps(p: StatePosisiPerangkat, simulasi: boolean): { teks: string; peringatan: boolean } {
  if (simulasi) return { teks: "SIMULASI", peringatan: true };
  switch (p.statusGps) {
    case "aktif":
      return p.posisi?.akurasi !== undefined && p.posisi.akurasi > 50
        ? { teks: `±${Math.round(p.posisi.akurasi)} m (lemah)`, peringatan: true }
        : { teks: `±${p.posisi?.akurasi ?? "?"} m`, peringatan: false };
    case "ditolak":
      return { teks: "GPS ditolak", peringatan: true };
    case "tidak_tersedia":
      return { teks: "GPS tidak tersedia", peringatan: true };
    case "galat":
      return { teks: "Sinyal GPS hilang", peringatan: true };
    default:
      return { teks: "Mencari GPS…", peringatan: true };
  }
}

export function teksStatusKompas(p: StatePosisiPerangkat): { teks: string; peringatan: boolean; perluKetuk: boolean } {
  switch (p.statusKompas) {
    case "perlu_izin":
      return { teks: "Aktifkan kompas", peringatan: true, perluKetuk: true };
    case "ditolak":
      return { teks: "Kompas ditolak", peringatan: true, perluKetuk: false };
    case "tidak_tersedia":
      return { teks: "Kompas tidak tersedia", peringatan: true, perluKetuk: false };
    default:
      return { teks: "Kompas…", peringatan: false, perluKetuk: false };
  }
}

export const WARNA_KATEGORI: Record<KategoriSurvei, string> = {
  Flora: "#10b981",
  Fauna: "#f59e0b",
  "Mata Air": "#38bdf8",
  "Tanda Batas": "#a855f7",
  "Ancaman / Temuan": "#ef4444",
  "Wilayah Adat / Lahan": "#fbbf24"
};

export interface LapisanPeta {
  /** Lebar dan tinggi kanvas dalam piksel CSS */
  W: number;
  H: number;
  zoom: number;
  /** Posisi layar sebuah koordinat pada tampilan peta saat ini */
  keLayar: (lat: number, lng: number) => { x: number; y: number };
  dataSpasial: DataSpasialItem[];
  idTerpilih?: string;
  modeRekam: JenisGeometri | null;
  titikDraft: KoordinatTitik[];
  targetGoTo: { lat: number; lng: number } | null;
  gpsPos: KoordinatTitik | null;
  kompasDerajat?: number;
  petaKustomAktif?: AreaPetaOffline | null;
}

/**
 * Menggambar lembar peta cetak / GeoPDF georeferensi lengkap (Avenza Maps style).
 * Termasuk bingkai A3, margin tepi kertas, judul pita hijau, garis batas ungu
 * Kecamatan Tanjung Selor, aliran Sungai Kayan, zona fungsi kawasan hutan (HL, HPT, APL),
 * titik pemukiman, dan panel legenda di samping.
 */
export function gambarLembarPetaGeoPdf(
  ctx: CanvasRenderingContext2D,
  peta: AreaPetaOffline,
  keLayar: (lat: number, lng: number) => { x: number; y: number },
  zoom: number,
  W: number,
  H: number
): void {
  const pTL = keLayar(peta.maxLat, peta.minLng);
  const pBR = keLayar(peta.minLat, peta.maxLng);

  const x0 = Math.min(pTL.x, pBR.x);
  const y0 = Math.min(pTL.y, pBR.y);
  const mapW = Math.abs(pBR.x - pTL.x);
  const mapH = Math.abs(pBR.y - pTL.y);

  if (mapW < 6 || mapH < 6) return;

  // Dimensi margin lembar cetak A3 (kiri, atas untuk judul pita hijau, kanan untuk legenda/kolom info)
  const marginLeft = Math.max(16, Math.min(60, mapW * 0.05));
  const marginTop = Math.max(48, Math.min(110, mapH * 0.14));
  const marginBottom = Math.max(24, Math.min(64, mapH * 0.06));
  const collarW = Math.max(140, Math.min(420, mapW * 0.42));

  const sheetX = x0 - marginLeft;
  const sheetY = y0 - marginTop;
  const sheetW = mapW + marginLeft + collarW;
  const sheetH = mapH + marginTop + marginBottom;

  // 1. Tampilan meja kerja netral di luar lembar peta saat diperkecil (Avenza grey desk backdrop)
  if (sheetX > 0 || sheetY > 0 || sheetX + sheetW < W || sheetY + sheetH < H) {
    ctx.save();
    ctx.fillStyle = "#595c62";
    if (sheetX > 0) ctx.fillRect(0, 0, sheetX, H);
    if (sheetX + sheetW < W) ctx.fillRect(sheetX + sheetW, 0, W - (sheetX + sheetW), H);
    if (sheetY > 0) ctx.fillRect(sheetX, 0, sheetW, sheetY);
    if (sheetY + sheetH < H) ctx.fillRect(sheetX, sheetY + sheetH, sheetW, H - (sheetY + sheetH));
    ctx.restore();
  }

  // 2. Kertas Lembar Peta Putih dengan Bayangan (Paper Drop Shadow)
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(sheetX, sheetY, sheetW, sheetH);
  ctx.restore();

  // 3. Pita Judul Atas Hijau Tua Khas Peta Kehutanan
  const bannerH = marginTop - 10;
  ctx.save();
  ctx.fillStyle = "#144e2b";
  ctx.fillRect(sheetX + 6, sheetY + 6, sheetW - 12, bannerH);

  // Logo pohon kehutanan di kiri pita judul
  const badgeX = sheetX + 24;
  const badgeY = sheetY + 6 + bannerH / 2;
  const badgeR = Math.min(14, bannerH * 0.36);
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Teks Judul Peta
  ctx.fillStyle = "#ffffff";
  const titleSize = Math.max(9, Math.min(20, bannerH * 0.42));
  ctx.font = `bold ${titleSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "left";
  const judulBersih = peta.namaArea.replace(/_/g, " ").replace(/\.geopdf/i, "");
  ctx.fillText(judulBersih.toUpperCase().slice(0, 42), sheetX + 46, sheetY + 6 + bannerH * 0.48);

  ctx.font = `${Math.max(7, Math.min(12, bannerH * 0.25))}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "#bbf7d0";
  ctx.fillText("KECAMATAN TANJUNG SELOR • KABUPATEN BULUNGAN • PROVINSI KALIMANTAN UTARA", sheetX + 46, sheetY + 6 + bannerH * 0.82);

  // Metadata kanan pita judul
  ctx.textAlign = "right";
  ctx.fillStyle = "#fef08a";
  ctx.font = `bold ${Math.max(7, Math.min(12, bannerH * 0.28))}px system-ui, -apple-system, sans-serif`;
  ctx.fillText("SK MENLHK • SKALA 1 : 50.000 / A3", sheetX + sheetW - 16, sheetY + 6 + bannerH * 0.64);
  ctx.restore();

  // 4. Area Peta Utama (Di dalam Garis Batas Peta / Neatline)
  ctx.save();
  // Latar dasar relief topografi peta
  ctx.fillStyle = "#f6f5ed";
  ctx.fillRect(x0, y0, mapW, mapH);

  // Batasi gambar fitur ke area peta
  ctx.beginPath();
  ctx.rect(x0, y0, mapW, mapH);
  ctx.clip();

  // Zona Fungsi Kawasan Hutan (HL, HPT, APL)
  // Zona APL (Areal Penggunaan Lain - Kuning Muda)
  const aplPoly = [
    { lat: 2.92, lng: 117.26 },
    { lat: 2.94, lng: 117.38 },
    { lat: 2.87, lng: 117.44 },
    { lat: 2.80, lng: 117.43 },
    { lat: 2.78, lng: 117.34 },
    { lat: 2.82, lng: 117.26 }
  ];
  ctx.beginPath();
  aplPoly.forEach((k, idx) => {
    const pt = keLayar(k.lat, k.lng);
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(254, 240, 138, 0.55)";
  ctx.fill();
  ctx.strokeStyle = "#eab308";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Zona HPT (Hutan Produksi Tetap - Hijau Muda)
  const hptPoly = [
    { lat: 2.80, lng: 117.34 },
    { lat: 2.80, lng: 117.43 },
    { lat: 2.73, lng: 117.44 },
    { lat: 2.68, lng: 117.36 },
    { lat: 2.72, lng: 117.32 }
  ];
  ctx.beginPath();
  hptPoly.forEach((k, idx) => {
    const pt = keLayar(k.lat, k.lng);
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(74, 222, 128, 0.45)";
  ctx.fill();
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Zona HL (Hutan Lindung - Hijau Hutan Pekat)
  const hlPoly = [
    { lat: 2.73, lng: 117.32 },
    { lat: 2.73, lng: 117.44 },
    { lat: 2.66, lng: 117.44 },
    { lat: 2.66, lng: 117.30 }
  ];
  ctx.beginPath();
  hlPoly.forEach((k, idx) => {
    const pt = keLayar(k.lat, k.lng);
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(34, 197, 94, 0.55)";
  ctx.fill();
  ctx.strokeStyle = "#15803d";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Aliran Sungai Kayan (Biru Meandering)
  const sungaiKayan = [
    { lat: 2.70, lng: 117.18 },
    { lat: 2.74, lng: 117.21 },
    { lat: 2.78, lng: 117.25 },
    { lat: 2.82, lng: 117.30 },
    { lat: 2.852, lng: 117.365 },
    { lat: 2.859, lng: 117.378 },
    { lat: 2.868, lng: 117.395 },
    { lat: 2.89, lng: 117.44 },
    { lat: 2.92, lng: 117.51 },
    { lat: 2.96, lng: 117.60 }
  ];
  ctx.beginPath();
  sungaiKayan.forEach((k, idx) => {
    const pt = keLayar(k.lat, k.lng);
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = Math.max(3, Math.min(14, (zoom - 10) * 2.5 + 4));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Label Sungai Kayan
  const pSungai1 = keLayar(2.76, 117.23);
  const pSungai2 = keLayar(2.87, 117.40);
  ctx.fillStyle = "#0284c7";
  ctx.font = `italic bold ${Math.max(9, Math.min(14, zoom - 2))}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("SUNGAI KAYAN", pSungai1.x, pSungai1.y);
  ctx.fillText("S. KAYAN", pSungai2.x, pSungai2.y);

  // Batas Administrasi Kecamatan Tanjung Selor (Garis Ungu Tebal khas Avenza)
  const batasTanjungSelor = [
    { lat: 2.98, lng: 117.26 },
    { lat: 2.96, lng: 117.33 },
    { lat: 2.92, lng: 117.39 },
    { lat: 2.93, lng: 117.45 },
    { lat: 2.88, lng: 117.44 },
    { lat: 2.82, lng: 117.46 },
    { lat: 2.76, lng: 117.38 },
    { lat: 2.72, lng: 117.34 },
    { lat: 2.70, lng: 117.30 },
    { lat: 2.73, lng: 117.24 },
    { lat: 2.79, lng: 117.22 },
    { lat: 2.85, lng: 117.26 },
    { lat: 2.91, lng: 117.24 },
    { lat: 2.98, lng: 117.26 }
  ];
  ctx.beginPath();
  batasTanjungSelor.forEach((k, idx) => {
    const pt = keLayar(k.lat, k.lng);
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.strokeStyle = "#9333ea";
  ctx.lineWidth = Math.max(2.5, Math.min(5, (zoom - 10) * 0.8 + 2.5));
  ctx.stroke();

  // Batas Desa / Kelurahan (Garis Merah Bata Halus)
  const batasDesa1 = [
    { lat: 2.859, lng: 117.378 },
    { lat: 2.84, lng: 117.40 },
    { lat: 2.81, lng: 117.41 },
    { lat: 2.76, lng: 117.38 }
  ];
  ctx.beginPath();
  batasDesa1.forEach((k, idx) => {
    const pt = keLayar(k.lat, k.lng);
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Kotak Pusat Kota Tanjung Selor Hilir (Kotak Hijau A + Bintang Merah)
  const pKotaA = keLayar(2.857134, 117.377556);
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pKotaA.x - 28, pKotaA.y - 20, 56, 40);
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(pKotaA.x - 10, pKotaA.y - 4, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Label Pemukiman & Desa
  const pemukiman = [
    { nama: "TANJUNG SELOR HILIR", lat: 2.859, lng: 117.378, sub: "Kelurahan" },
    { nama: "TANJUNG SELOR HULU", lat: 2.835, lng: 117.362, sub: "Kelurahan" },
    { nama: "TANJUNG SELOR TIMUR", lat: 2.868, lng: 117.425, sub: "Kelurahan" },
    { nama: "GUNUNG SERIANG", lat: 2.795, lng: 117.310, sub: "Desa" },
    { nama: "BUMI RAHAYU", lat: 2.818, lng: 117.438, sub: "Desa" },
    { nama: "GUNUNG SARI", lat: 2.788, lng: 117.460, sub: "Desa" }
  ];

  pemukiman.forEach((desa) => {
    const pt = keLayar(desa.lat, desa.lng);
    ctx.fillStyle = "#1e293b";
    ctx.font = `bold ${Math.max(9, Math.min(13, zoom - 3))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(desa.nama, pt.x, pt.y - 6);
    ctx.fillStyle = "#64748b";
    ctx.font = `${Math.max(8, Math.min(10, zoom - 5))}px system-ui, sans-serif`;
    ctx.fillText(desa.sub, pt.x, pt.y + 7);
  });

  ctx.restore(); // Lepas clip area peta

  // 5. Bingkai Ganda Hitam Peta (Neatline Peta A3)
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, mapW, mapH);
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, mapW + 8, mapH + 8);

  // Tanda Grid Koordinat (Graticule ticks)
  ctx.fillStyle = "#000000";
  ctx.font = "8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("117°20'0\"E", x0 + mapW * 0.3, y0 - 6);
  ctx.fillText("117°30'0\"E", x0 + mapW * 0.7, y0 - 6);
  ctx.textAlign = "right";
  ctx.fillText("2°50'0\"N", x0 - 6, y0 + mapH * 0.4);
  ctx.fillText("2°45'0\"N", x0 - 6, y0 + mapH * 0.7);
  ctx.restore();

  // 6. Kolom Panel Legenda dan Peta Situasi (Sisi Kanan Lembar A3)
  const panelX = x0 + mapW + 8;
  const panelY = y0;
  const panelW = collarW - 14;
  const panelH = mapH;

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  // Inset Peta Situasi
  const insetH = Math.min(110, panelH * 0.28);
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(panelX + 6, panelY + 6, panelW - 12, insetH);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(panelX + 6, panelY + 6, panelW - 12, insetH);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("PETA SITUASI", panelX + 12, panelY + 18);

  // Kotak mini Kalimantan Utara di inset
  ctx.strokeStyle = "#9333ea";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(panelX + (panelW - 12) * 0.35, panelY + 28, (panelW - 12) * 0.3, insetH * 0.55);

  // Komposisi Fungsi Kawasan
  const kompoY = panelY + insetH + 16;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.fillText("KOMPOSISI FUNGSI KAWASAN", panelX + 10, kompoY);

  const legendaList = [
    { label: "Hutan Lindung (HL)", warna: "#22c55e", luas: "14.210 Ha" },
    { label: "Hutan Produksi Tetap (HPT)", warna: "#4ade80", luas: "19.780 Ha" },
    { label: "Areal Penggunaan Lain (APL)", warna: "#fef08a", luas: "49.520 Ha" }
  ];

  legendaList.forEach((item, idx) => {
    const itemY = kompoY + 12 + idx * 16;
    ctx.fillStyle = item.warna;
    ctx.fillRect(panelX + 10, itemY, 14, 10);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(panelX + 10, itemY, 14, 10);

    ctx.fillStyle = "#334155";
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillText(item.label, panelX + 30, itemY + 8);
    ctx.textAlign = "right";
    ctx.fillText(item.luas, panelX + panelW - 10, itemY + 8);
    ctx.textAlign = "left";
  });

  // Legenda Batas & Sungai
  const garisY = kompoY + 68;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.fillText("LEGENDA", panelX + 10, garisY);

  // Garis Ungu Batas Kecamatan
  ctx.strokeStyle = "#9333ea";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(panelX + 10, garisY + 14);
  ctx.lineTo(panelX + 26, garisY + 14);
  ctx.stroke();
  ctx.fillStyle = "#334155";
  ctx.font = "8px system-ui, sans-serif";
  ctx.fillText("Batas Kecamatan", panelX + 32, garisY + 17);

  // Garis Merah Batas Desa
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(panelX + 10, garisY + 28);
  ctx.lineTo(panelX + 26, garisY + 28);
  ctx.stroke();
  ctx.fillStyle = "#334155";
  ctx.fillText("Batas Desa/Kelurahan", panelX + 32, garisY + 31);

  // Aliran Sungai Biru
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(panelX + 10, garisY + 42);
  ctx.lineTo(panelX + 26, garisY + 42);
  ctx.stroke();
  ctx.fillStyle = "#334155";
  ctx.fillText("Sungai Kayan", panelX + 32, garisY + 45);

  // Sumber Data & Sistem Koordinat
  const sumberY = garisY + 62;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.fillText("SUMBER DATA & SISTEM KOORDINAT", panelX + 10, sumberY);
  ctx.fillStyle = "#64748b";
  ctx.font = "7.5px system-ui, sans-serif";
  ctx.fillText("Datum: WGS 1984 | Proyeksi: UTM Zona 50N", panelX + 10, sumberY + 12);
  ctx.fillText("Sumber: SK MenLHK & Pemkab Bulungan", panelX + 10, sumberY + 22);

  ctx.restore();
}

/** Menggambar semua lapisan di atas tile peta, berurutan dari bawah ke atas */
export function gambarLapisanPeta(ctx: CanvasRenderingContext2D, lapisan: LapisanPeta): void {
  const {
    W,
    H,
    zoom,
    keLayar,
    dataSpasial,
    idTerpilih,
    modeRekam,
    titikDraft,
    targetGoTo,
    gpsPos,
    kompasDerajat,
    petaKustomAktif
  } = lapisan;

  // 1. Gambar Lembar Peta GeoPDF Georeferensi (Jika sedang membuka peta kustom/GeoPDF)
  if (petaKustomAktif) {
    gambarLembarPetaGeoPdf(ctx, petaKustomAktif, keLayar, zoom, W, H);
  }

  // 3. Kisi Koordinat Halus (Tanpa label contoh/dummy)
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  const stepGrid = 128;
  for (let gx = (W / 2) % stepGrid; gx < W; gx += stepGrid) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  for (let gy = (H / 2) % stepGrid; gy < H; gy += stepGrid) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Gambar Objek Spasial yang Sudah Tersimpan
  dataSpasial.forEach((item) => {
    const color = WARNA_KATEGORI[item.kategori] || "#10b981";
    const isSelected = idTerpilih === item.id;

    if (item.jenisGeometri === "polygon" && item.koordinat.length >= 3) {
      ctx.save();
      ctx.beginPath();
      item.koordinat.forEach((k, idx) => {
        const p = keLayar(k.lat, k.lng);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = isSelected ? "rgba(251, 191, 36, 0.38)" : "rgba(16, 185, 129, 0.24)";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#fbbf24" : color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      const avgLat = item.koordinat.reduce((a, b) => a + b.lat, 0) / item.koordinat.length;
      const avgLng = item.koordinat.reduce((a, b) => a + b.lng, 0) / item.koordinat.length;
      const centerPoly = keLayar(avgLat, avgLng);
      ctx.fillStyle = "rgba(6, 20, 17, 0.85)";
      ctx.fillRect(centerPoly.x - 58, centerPoly.y - 18, 116, 32);
      ctx.strokeStyle = color;
      ctx.strokeRect(centerPoly.x - 58, centerPoly.y - 18, 116, 32);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(item.judul.slice(0, 18), centerPoly.x, centerPoly.y - 4);
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(`${item.luasHa} Ha`, centerPoly.x, centerPoly.y + 10);
      ctx.restore();
    } else if (item.jenisGeometri === "line" && item.koordinat.length >= 2) {
      ctx.save();
      ctx.beginPath();
      item.koordinat.forEach((k, idx) => {
        const p = keLayar(k.lat, k.lng);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = isSelected ? "#fbbf24" : "#38bdf8";
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const mid = item.koordinat[Math.floor(item.koordinat.length / 2)];
      const mp = keLayar(mid.lat, mid.lng);
      ctx.fillStyle = "rgba(6, 20, 17, 0.88)";
      ctx.fillRect(mp.x - 42, mp.y - 12, 84, 22);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${item.panjangKm} km`, mp.x, mp.y + 3);
      ctx.restore();
    } else if (item.jenisGeometri === "point" && item.koordinat[0]) {
      const p = keLayar(item.koordinat[0].lat, item.koordinat[0].lng);
      ctx.save();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(251, 191, 36, 0.35)";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "rgba(6, 20, 17, 0.82)";
      const label = item.namaLokal || item.judul.slice(0, 16);
      const tw = ctx.measureText(label).width + 12;
      ctx.fillRect(p.x - tw / 2, p.y + 12, tw, 18);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, p.x, p.y + 24);
      ctx.restore();
    }
  });

  // 5. Gambar Draft Sedang Direkam
  if (modeRekam && titikDraft.length > 0) {
    ctx.save();
    ctx.beginPath();
    titikDraft.forEach((k, idx) => {
      const p = keLayar(k.lat, k.lng);
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    if (modeRekam === "polygon" && titikDraft.length >= 3) {
      ctx.closePath();
      ctx.fillStyle = "rgba(251, 191, 36, 0.28)";
      ctx.fill();
    }
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.stroke();

    titikDraft.forEach((k, idx) => {
      const p = keLayar(k.lat, k.lng);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = idx === titikDraft.length - 1 ? "#ef4444" : "#fbbf24";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.restore();
  }

  // 6. Garis Navigasi Go-To
  if (targetGoTo && gpsPos) {
    const fromP = keLayar(gpsPos.lat, gpsPos.lng);
    const toP = keLayar(targetGoTo.lat, targetGoTo.lng);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(fromP.x, fromP.y);
    ctx.lineTo(toP.x, toP.y);
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.restore();
  }

  // 7. Posisi GPS Biru (hanya bila perangkat sudah memberi posisi)
  if (gpsPos) {
    const gpsPx = keLayar(gpsPos.lat, gpsPos.lng);
    // Lingkaran akurasi digambar sesuai skala peta (meter per piksel pada zoom ini)
    const meterPerPiksel = (156543.03392 * Math.cos((gpsPos.lat * Math.PI) / 180)) / Math.pow(2, zoom);
    const radiusAkurasi = gpsPos.akurasi ? Math.min(240, Math.max(16, gpsPos.akurasi / meterPerPiksel)) : 16;
    ctx.save();
    ctx.beginPath();
    ctx.arc(gpsPx.x, gpsPx.y, radiusAkurasi, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(56, 189, 248, 0.22)";
    ctx.fill();
    if (kompasDerajat !== undefined) {
      const sudut = ((kompasDerajat - 90) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(gpsPx.x, gpsPx.y);
      ctx.arc(gpsPx.x, gpsPx.y, 34, sudut - 0.45, sudut + 0.45);
      ctx.closePath();
      ctx.fillStyle = "rgba(14, 165, 233, 0.5)";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(gpsPx.x, gpsPx.y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = "#0ea5e9";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.restore();
  }

  // 8. Bidikan Tengah (Crosshair)
  ctx.save();
  const cx = W / 2;
  const cy = H / 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy);
  ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy);
  ctx.lineTo(cx + 18, cy);
  ctx.moveTo(cx, cy - 18);
  ctx.lineTo(cx, cy - 5);
  ctx.moveTo(cx, cy + 5);
  ctx.lineTo(cx, cy + 18);
  ctx.stroke();
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
