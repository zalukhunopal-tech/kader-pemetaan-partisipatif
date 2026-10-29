import { BasemapType } from "../types";

/**
 * Posisi peta terakhir (pusat, zoom, basemap, pitch, bearing). Disimpan setiap peta bergeser/diputar
 * dan saat aplikasi ditutup, lalu dipakai saat peta dibuka lagi, sehingga peta tidak kembali ke lokasi bawaan.
 */

export const KUNCI_POSISI_PETA = "geokader_posisi_peta_v1";
/** Dipakai hanya bila belum pernah ada posisi tersimpan dan GPS belum tersedia */
export const POSISI_AWAL_PETA = { lat: -0.9475, lng: 100.4192 };
export const ZOOM_MIN_PETA = 11;
export const ZOOM_MAKS_PETA = 19;
const BASEMAP_SAH: BasemapType[] = ["satelit", "google", "esri", "osm", "topo", "taktis"];

export interface PosisiPeta {
  lat: number;
  lng: number;
  zoom: number;
  basemap: BasemapType;
  pitch?: number;
  bearing?: number;
}

/** null bila belum ada atau isinya tidak sah (mis. rusak atau diubah manual) */
export function bacaPosisiPeta(): PosisiPeta | null {
  try {
    const p = JSON.parse(localStorage.getItem(KUNCI_POSISI_PETA) || "null") as Partial<PosisiPeta> | null;
    if (!p || typeof p.lat !== "number" || typeof p.lng !== "number" || typeof p.zoom !== "number") return null;
    if (!(Math.abs(p.lat) <= 85) || !(Math.abs(p.lng) <= 180) || !Number.isFinite(p.zoom)) return null;
    const hasil: PosisiPeta = {
      lat: p.lat,
      lng: p.lng,
      // zoom boleh pecahan (hasil cubit), cukup dua angka di belakang koma
      zoom: Math.min(ZOOM_MAKS_PETA, Math.max(ZOOM_MIN_PETA, Math.round(p.zoom * 100) / 100)),
      basemap: BASEMAP_SAH.includes(p.basemap as BasemapType) ? (p.basemap as BasemapType) : "satelit"
    };
    if (typeof p.pitch === "number" && Number.isFinite(p.pitch)) {
      hasil.pitch = Math.min(60, Math.max(0, Math.round(p.pitch)));
    }
    if (typeof p.bearing === "number" && Number.isFinite(p.bearing)) {
      const b = Math.round(p.bearing) % 360;
      hasil.bearing = b < 0 ? b + 360 : b;
    }
    return hasil;
  } catch {
    return null;
  }
}

export function simpanPosisiPeta(p: PosisiPeta): void {
  try {
    const data: Record<string, unknown> = {
      lat: Number(p.lat.toFixed(6)),
      lng: Number(p.lng.toFixed(6)),
      zoom: Number(p.zoom.toFixed(2)),
      basemap: p.basemap
    };
    if (typeof p.pitch === "number" && Number.isFinite(p.pitch) && Math.round(p.pitch) > 0) {
      data.pitch = Math.min(60, Math.max(0, Math.round(p.pitch)));
    }
    if (typeof p.bearing === "number" && Number.isFinite(p.bearing) && Math.round(p.bearing) !== 0) {
      const b = Math.round(p.bearing) % 360;
      data.bearing = b < 0 ? b + 360 : b;
    }
    localStorage.setItem(KUNCI_POSISI_PETA, JSON.stringify(data));
  } catch {
    // penyimpanan penuh atau tidak tersedia: posisi tidak diingat, peta tetap berfungsi
  }
}
