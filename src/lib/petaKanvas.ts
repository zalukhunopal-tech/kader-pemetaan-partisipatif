import { DataSpasialItem, JenisGeometri, KategoriSurvei, KoordinatTitik } from "../types";
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
}

/** Menggambar semua lapisan di atas tile peta, berurutan dari bawah ke atas */
export function gambarLapisanPeta(ctx: CanvasRenderingContext2D, lapisan: LapisanPeta): void {
  const { W, H, zoom, keLayar, dataSpasial, idTerpilih, modeRekam, titikDraft, targetGoTo, gpsPos, kompasDerajat } = lapisan;

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
