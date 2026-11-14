import { fraksiBarisGeografis } from "./rasterGeografis";
import { AreaPetaOffline, DataSpasialItem, JenisGeometri, KategoriSurvei, KoordinatTitik } from "../types";
import { StatePosisiPerangkat, StatusGps } from "./posisiPerangkat";

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
  Biodiversitas: "#10b981",
  Flora: "#10b981",
  Fauna: "#f59e0b",
  "Mata Air": "#38bdf8",
  "Tanda Batas": "#a855f7",
  "Ancaman / Temuan": "#ef4444",
  "Wilayah Adat / Lahan": "#fbbf24",
  "Sarana Desa": "#2563eb",
  "Situs Budaya": "#b45309",
  Lainnya: "#64748b"
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
  saatGambarSiap?: () => void;
  waktuMs?: number;
  statusGps?: StatusGps;
  bearingPeta?: number;
}

const cacheGambarPetaKustom = new Map<string, HTMLImageElement | "loading" | "error">();

/** Memuat gambar peta kustom (DataURL atau URL berkas statis) */
export function muatGambarPetaKustom(url: string, saatSelesai?: () => void): HTMLImageElement | null {
  const ada = cacheGambarPetaKustom.get(url);
  if (ada && ada !== "loading" && ada !== "error") {
    return ada;
  }
  if (!ada) {
    cacheGambarPetaKustom.set(url, "loading");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      cacheGambarPetaKustom.set(url, img);
      saatSelesai?.();
    };
    img.onerror = () => {
      cacheGambarPetaKustom.set(url, "error");
    };
    img.src = url;
  }
  return null;
}

/**
 * Menggambar lembar peta cetak / GeoPDF asli yang diunggah pengguna (Avenza Maps style).
 * Menampilkan berkas gambar peta otentik tanpa mengubah atau merekayasa konten peta.
 * Meja kerja netral abu-abu membatasi lembar peta secara terisolasi dari basemap online.
 */
export function gambarLembarPetaGeoPdf(
  ctx: CanvasRenderingContext2D,
  peta: AreaPetaOffline,
  keLayar: (lat: number, lng: number) => { x: number; y: number },
  zoom: number,
  W: number,
  H: number,
  saatGambarSiap?: () => void
): void {
  const pTL = keLayar(peta.maxLat, peta.minLng);
  const pBR = keLayar(peta.minLat, peta.maxLng);

  const x0 = Math.min(pTL.x, pBR.x);
  const y0 = Math.min(pTL.y, pBR.y);
  const mapW = Math.abs(pBR.x - pTL.x);
  const mapH = Math.abs(pBR.y - pTL.y);

  if (mapW < 6 || mapH < 6) return;

  if (peta.rasterGeoreferensi && peta.petaKustomDataUrl) {
    const img = muatGambarPetaKustom(peta.petaKustomDataUrl, saatGambarSiap);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, W, H);
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      const rentangLat = Math.abs(peta.maxLat - peta.minLat);
      if (rentangLat <= 2) {
        // Untuk peta lokal/desa/kecamatan (rentang <= 2°), selisih Mercator vs linear < 0.05 px:
        // gambar dalam 1 panggilan drawImage terakselerasi GPU agar 60fps mulus tanpa guncangan strip
        ctx.drawImage(img, x0, y0, mapW, mapH);
      } else {
        // Untuk peta skala regional luas (> 2°), bagi maksimal 24 pita (bukan ribuan baris 1px)
        const yMulai = Math.max(0, Math.floor(y0));
        const yAkhir = Math.min(H, Math.ceil(y0 + mapH));
        const langkah = Math.max(16, Math.ceil((yAkhir - yMulai) / 24));
        for (let y = yMulai; y < yAkhir; y += langkah) {
          const top = Math.max(y, y0);
          const bottom = Math.min(y + langkah, yAkhir, y0 + mapH);
          const sy = fraksiBarisGeografis((top - y0) / mapH, peta.minLat, peta.maxLat) * img.height;
          const ey = fraksiBarisGeografis((bottom - y0) / mapH, peta.minLat, peta.maxLat) * img.height;
          if (ey > sy) ctx.drawImage(img, 0, sy, img.width, ey - sy, x0, top, mapW, bottom - top);
        }
      }
    }
    return;
  }

  // Rasio lembar cetak A3 (lebar peta ~72%, margin kiri ~3.5%, margin atas ~12%, panel legenda kanan ~28%)
  const sheetMarginLeft = mapW * 0.035;
  const sheetMarginTop = mapH * 0.12;
  const sheetMarginBottom = mapH * 0.05;
  const sheetCollarRight = mapW * 0.38;

  const sheetX = x0 - sheetMarginLeft;
  const sheetY = y0 - sheetMarginTop;
  const sheetW = mapW + sheetMarginLeft + sheetCollarRight;
  const sheetH = mapH + sheetMarginTop + sheetMarginBottom;

  // 1. Meja kerja netral abu-abu terisolasi di luar lembar peta (Avenza grey desk backdrop)
  ctx.save();
  ctx.fillStyle = "#4a4d52";
  if (sheetX > 0) ctx.fillRect(0, 0, sheetX, H);
  if (sheetX + sheetW < W) ctx.fillRect(sheetX + sheetW, 0, W - (sheetX + sheetW), H);
  if (sheetY > 0) ctx.fillRect(sheetX, 0, sheetW, sheetY);
  if (sheetY + sheetH < H) ctx.fillRect(sheetX, sheetY + sheetH, sheetW, H - (sheetY + sheetH));
  ctx.restore();

  // 2. Kertas Lembar Peta Putih dengan Bayangan (Paper Drop Shadow)
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(sheetX, sheetY, sheetW, sheetH);
  ctx.restore();

  // 3. Tampilkan gambar lembar peta asli pengguna (otentik tanpa rekayasa bentuk buatan)
  const urlGambar = peta.petaKustomDataUrl || peta.petaKustomUrl;

  if (urlGambar) {
    const img = muatGambarPetaKustom(urlGambar, saatGambarSiap);
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sheetX, sheetY, sheetW, sheetH);
    }
  } else {
    // Tampilan netral jika dokumen murni koordinat tanpa raster
    ctx.save();
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(sheetX + 2, sheetY + 2, sheetW - 4, sheetH - 4);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, mapW, mapH);
    ctx.restore();
  }
}

/** Menggambar semua lapisan di atas tile peta, berurutan dari bawah ke atas */
/** Warna garis jalur dan area seperti di Avenza Maps */
export const WARNA_JALUR_AVENZA = "#f7861f";

/** Pin merah ala Avenza: ujung bawah tepat di titik (0,0) */
export function gambarPinMerah(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-3, -6, -10, -11, -10, -18);
  ctx.arc(0, -18, 10, Math.PI, 0, false);
  ctx.bezierCurveTo(10, -11, 3, -6, 0, 0);
  ctx.closePath();
  ctx.fillStyle = "#ee271e";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(120, 10, 10, 0.55)";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -18, 3.6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}

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
    petaKustomAktif,
    saatGambarSiap,
    waktuMs,
    statusGps,
    bearingPeta
  } = lapisan;

  // 1. Gambar Lembar Peta GeoPDF Georeferensi (Jika sedang membuka peta kustom/GeoPDF)
  if (petaKustomAktif) {
    gambarLembarPetaGeoPdf(ctx, petaKustomAktif, keLayar, zoom, W, H, saatGambarSiap);
  }

  // 4. Objek tersimpan (gaya Avenza Maps): titik = pin merah, jalur = garis oranye, area = garis oranye
  //    dengan isian tipis. Nama objek tidak ditulis di peta; objek terpilih diberi sudut seleksi.
  const sudutSeleksi = (cx: number, cy: number, r: number) => {
    const p = 7;
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 3;
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ]) {
      const x = cx + sx * r;
      const y = cy + sy * r;
      ctx.beginPath();
      ctx.moveTo(x, y - sy * p);
      ctx.lineTo(x, y);
      ctx.lineTo(x - sx * p, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  dataSpasial.forEach((item) => {
    const isSelected = idTerpilih === item.id;
    const garis = (tutup: boolean) => {
      ctx.beginPath();
      item.koordinat.forEach((k, idx) => {
        const p = keLayar(k.lat, k.lng);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (tutup) ctx.closePath();
    };

    if (item.jenisGeometri === "polygon" && item.koordinat.length >= 3) {
      ctx.save();
      garis(true);
      ctx.fillStyle = isSelected ? "rgba(247, 134, 31, 0.32)" : "rgba(247, 134, 31, 0.16)";
      ctx.fill();
      ctx.strokeStyle = WARNA_JALUR_AVENZA;
      ctx.lineWidth = isSelected ? 4.5 : 3;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    } else if (item.jenisGeometri === "line" && item.koordinat.length >= 2) {
      ctx.save();
      garis(false);
      ctx.strokeStyle = WARNA_JALUR_AVENZA;
      ctx.lineWidth = isSelected ? 5 : 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
    } else if (item.jenisGeometri === "point" && item.koordinat[0]) {
      const p = keLayar(item.koordinat[0].lat, item.koordinat[0].lng);
      ctx.save();
      ctx.translate(p.x, p.y);
      // Pin tetap tegak walau peta diputar
      if (bearingPeta) ctx.rotate((bearingPeta * Math.PI) / 180);
      gambarPinMerah(ctx);
      if (isSelected) sudutSeleksi(0, -14, 22);
      ctx.restore();
    }
  });

  // 5. Gambar Draft Sedang Direkam (Garis lurus solid tanpa titik-titik untuk jalur & poligon)
  if (modeRekam && titikDraft.length > 0) {
    ctx.save();
    if (titikDraft.length === 1) {
      // Jika baru ada 1 titik awal (belum membentuk garis), tandai lokasi awal
      const p = keLayar(titikDraft[0].lat, titikDraft[0].lng);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = WARNA_JALUR_AVENZA;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // 2 titik atau lebih: gambar garis lurus solid dan bersih (bukan rangkaian titik-titik)
      ctx.beginPath();
      titikDraft.forEach((k, idx) => {
        const p = keLayar(k.lat, k.lng);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (modeRekam === "polygon" && titikDraft.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = "rgba(247, 134, 31, 0.22)";
        ctx.fill();
      }
      ctx.strokeStyle = WARNA_JALUR_AVENZA;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      ctx.stroke();
    }
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

  // 7. Posisi GPS Biru & Animasi Denyut / Senter Arah (Pulsing Blue Dot + Flashlight Heading Beam)
  if (gpsPos) {
    const gpsPx = keLayar(gpsPos.lat, gpsPos.lng);
    const meterPerPiksel = (156543.03392 * Math.cos((gpsPos.lat * Math.PI) / 180)) / Math.pow(2, zoom);
    const radiusAkurasi = gpsPos.akurasi ? Math.min(240, Math.max(16, gpsPos.akurasi / meterPerPiksel)) : 16;
    const isStale = statusGps === "galat" || statusGps === "tidak_tersedia";

    // Indikator panah tepi layar (Off-Screen Edge Pointer)
    const padding = 20;
    const isOffScreen = gpsPx.x < 0 || gpsPx.x > W || gpsPx.y < 0 || gpsPx.y > H;
    if (isOffScreen) {
      ctx.save();
      const cx = W / 2;
      const cy = H / 2;
      const dx = gpsPx.x - cx;
      const dy = gpsPx.y - cy;
      const sudutKeGps = Math.atan2(dy, dx);
      const edgeX = Math.max(padding, Math.min(W - padding, cx + Math.cos(sudutKeGps) * (W / 2 - padding)));
      const edgeY = Math.max(padding, Math.min(H - padding, cy + Math.sin(sudutKeGps) * (H / 2 - padding)));
      ctx.translate(edgeX, edgeY);
      ctx.rotate(sudutKeGps);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fillStyle = isStale ? "#94a3b8" : "#0ea5e9";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    // 7.1 Lingkaran Akurasi Geografis (Physical Accuracy Halo)
    ctx.beginPath();
    ctx.arc(gpsPx.x, gpsPx.y, radiusAkurasi, 0, Math.PI * 2);
    ctx.fillStyle = isStale ? "rgba(148, 163, 184, 0.15)" : "rgba(14, 165, 233, 0.14)";
    ctx.fill();
    ctx.strokeStyle = isStale ? "rgba(148, 163, 184, 0.35)" : "rgba(14, 165, 233, 0.48)";
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // 7.2 Sinar Senter Arah Kompas (Directional Flashlight Beam Gradient)
    if (kompasDerajat !== undefined) {
      const sudut = ((kompasDerajat - 90) * Math.PI) / 180;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(gpsPx.x, gpsPx.y);
      ctx.arc(gpsPx.x, gpsPx.y, 34, sudut - 0.48, sudut + 0.48);
      ctx.closePath();
      if (!isStale && typeof ctx.createRadialGradient === "function") {
        try {
          const grad = ctx.createRadialGradient(gpsPx.x, gpsPx.y, 4, gpsPx.x, gpsPx.y, 46);
          if (grad && typeof grad.addColorStop === "function") {
            grad.addColorStop(0, "rgba(14, 165, 233, 0.58)");
            grad.addColorStop(0.55, "rgba(56, 189, 248, 0.24)");
            grad.addColorStop(1, "rgba(56, 189, 248, 0)");
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = "rgba(14, 165, 233, 0.5)";
          }
        } catch {
          ctx.fillStyle = "rgba(14, 165, 233, 0.5)";
        }
      } else {
        ctx.fillStyle = isStale ? "rgba(148, 163, 184, 0.25)" : "rgba(14, 165, 233, 0.5)";
      }
      ctx.fill();
      ctx.restore();
    }

    // 7.3 Gelombang Denyut Halus (Animated Pulse Ring) saat tidak stale
    if (!isStale) {
      const ms = waktuMs ?? Date.now();
      const fase = (ms % 2000) / 2000;
      const ease = 1 - Math.pow(1 - fase, 3);
      const pulseRadius = 7.5 + ease * 15;
      ctx.beginPath();
      ctx.arc(gpsPx.x, gpsPx.y, pulseRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(14, 165, 233, ${(1 - ease) * 0.45})`;
      ctx.fill();
    }

    // 7.4 Inti Titik Biru (Core Blue Puck) dengan Cincin Putih & Drop Shadow
    ctx.shadowColor = "rgba(15, 23, 42, 0.38)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1.5;

    ctx.beginPath();
    ctx.arc(gpsPx.x, gpsPx.y, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.beginPath();
    ctx.arc(gpsPx.x, gpsPx.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = isStale ? "#94a3b8" : "#0284c7";
    ctx.fill();

    ctx.restore();
  }
}
