import { AreaPetaOffline, BasemapType } from "../types";
import { hitungJarakMeter } from "./geoUtils";
import {
  BasemapTile,
  HasilUnduh,
  KotakWilayah,
  SUMBER_TILE,
  daftarTile,
  hapusTile,
  hitungJumlahTile,
  penyimpananTileDidukung,
  unduhTile,
  unduhanLayak,
  urlTile,
  urlTileArea
} from "./petaOffline";

export const KUNCI_AUTO_CACHE_PETA = "geokader_auto_cache_peta_v1";
export const LUAS_CACHE_OTOMATIS_KM = 1;
export const UMUR_MAKS_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
export const MAKS_SLOT_CACHE_OTOMATIS = 2;
export const JARAK_PINDAH_PERBARUI_METER = 450;
export const BATAS_TILE_AUTO_SLOT = 1400;

export interface SlotCachePetaOtomatis {
  id: string;
  basemap: BasemapTile;
  pusatLat: number;
  pusatLng: number;
  kotak: KotakWilayah;
  zoomMin: number;
  zoomMax: number;
  dibuatPada: number;
  urls: string[];
}

export interface ParameterAutoCache {
  basemap: BasemapType;
  lat: number;
  lng: number;
  online: boolean;
  areaOffline?: AreaPetaOffline[];
  sinyal?: AbortSignal;
  sekarangMs?: number;
}

export interface HasilAutoCache {
  status: "dilewati" | "segar" | "dipromosikan" | "diperbarui" | "dibatalkan" | "gagal";
  jumlahTile?: number;
  dihapus?: number;
  totalSlot?: number;
  hasilUnduh?: HasilUnduh;
}

/** Hitung kotak bujur sangkar berpusat di koordinat (bawaan 1 x 1 km) */
export function hitungKotakKm(lat: number, lng: number, sisiKm = LUAS_CACHE_OTOMATIS_KM): KotakWilayah {
  const setengahMeter = (sisiKm * 1000) / 2;
  const meterPerDerajatLat = 111320;
  const kosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dLat = setengahMeter / meterPerDerajatLat;
  const dLng = setengahMeter / (meterPerDerajatLat * kosLat);
  return {
    minLat: Math.max(-85, lat - dLat),
    maxLat: Math.min(85, lat + dLat),
    minLng: lng - dLng,
    maxLng: lng + dLng
  };
}

/** Memilih rentang zoom sampai ketelitian tertinggi penyedia tanpa melampaui batas aman memori seluler */
export function rentangZoomKetelitianTinggi(
  basemap: BasemapTile,
  kotak: KotakWilayah
): { zoomMin: number; zoomMax: number } {
  const zoomMax = SUMBER_TILE[basemap].zoomMaks;
  let zoomMin = Math.max(13, zoomMax - 5);
  while (zoomMin < zoomMax - 1 && hitungJumlahTile(kotak, zoomMin, zoomMax) > BATAS_TILE_AUTO_SLOT) {
    zoomMin++;
  }
  return { zoomMin, zoomMax };
}

export function slotMasihBerlaku(slot: SlotCachePetaOtomatis, sekarangMs = Date.now()): boolean {
  return sekarangMs - slot.dibuatPada < UMUR_MAKS_CACHE_MS;
}

export function muatSlotAutoCache(): SlotCachePetaOtomatis[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const mentah = localStorage.getItem(KUNCI_AUTO_CACHE_PETA);
    if (!mentah) return [];
    const data = JSON.parse(mentah);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (s): s is SlotCachePetaOtomatis =>
          Boolean(s) &&
          typeof s.id === "string" &&
          typeof s.basemap === "string" &&
          typeof s.pusatLat === "number" &&
          typeof s.pusatLng === "number" &&
          typeof s.dibuatPada === "number" &&
          Array.isArray(s.urls)
      )
      .slice(0, MAKS_SLOT_CACHE_OTOMATIS);
  } catch {
    return [];
  }
}

export function simpanSlotAutoCache(slots: SlotCachePetaOtomatis[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KUNCI_AUTO_CACHE_PETA, JSON.stringify(slots.slice(0, MAKS_SLOT_CACHE_OTOMATIS)));
  } catch {
    // Abaikan kuota localStorage penuh; tile tetap tersimpan di Cache API
  }
}

function kumpulkanUrlSlot(basemap: BasemapTile, kotak: KotakWilayah, zoomMin: number, zoomMax: number): string[] {
  const daftar = daftarTile(kotak, zoomMin, zoomMax);
  const unik = new Set<string>();
  for (const t of daftar) {
    const u = urlTile(basemap, t.z, t.x, t.y);
    if (u) unik.add(u);
  }
  return Array.from(unik);
}

/** Evaluasi apakah lokasi & basemap saat ini sudah tercakup cache < 30 hari atau perlu unduh baru */
export function perluPerbaruiCacheOtomatis(
  slots: SlotCachePetaOtomatis[],
  basemap: BasemapTile,
  lat: number,
  lng: number,
  sekarangMs = Date.now()
): boolean {
  const cocok = slots.find(
    (s) =>
      s.basemap === basemap &&
      hitungJarakMeter({ lat, lng }, { lat: s.pusatLat, lng: s.pusatLng }) < JARAK_PINDAH_PERBARUI_METER
  );
  if (!cocok) return true;
  return !slotMasihBerlaku(cocok, sekarangMs);
}

/**
 * Mengunduh cache tile 1 x 1 km ketelitian tinggi secara atomik:
 * 1. Unduh tile lokasi/periode baru terlebih dahulu sebelum menyentuh cache lama.
 * 2. Pertahankan maksimal 2 generasi cache (aktif + 1 cadangan) agar tidak memberatkan perangkat.
 * 3. Jika unduhan gagal/putus jaringan, gulung balik tile parsial baru tanpa menghapus cadangan lama.
 */
export async function jalankanAutoCache1Km(param: ParameterAutoCache): Promise<HasilAutoCache> {
  const { basemap, lat, lng, online, areaOffline = [], sinyal } = param;
  const sekarangMs = param.sekarangMs ?? Date.now();
  if (!online || basemap === "taktis" || !penyimpananTileDidukung()) {
    return { status: "dilewati" };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { status: "dilewati" };
  }

  const slots = muatSlotAutoCache();
  const indeksSegar = slots.findIndex(
    (s) =>
      s.basemap === basemap &&
      hitungJarakMeter({ lat, lng }, { lat: s.pusatLat, lng: s.pusatLng }) < JARAK_PINDAH_PERBARUI_METER &&
      slotMasihBerlaku(s, sekarangMs)
  );

  if (indeksSegar === 0) {
    return { status: "segar", totalSlot: slots.length };
  }
  if (indeksSegar > 0) {
    const dipromosikan = [slots[indeksSegar], ...slots.filter((_, i) => i !== indeksSegar)].slice(
      0,
      MAKS_SLOT_CACHE_OTOMATIS
    );
    simpanSlotAutoCache(dipromosikan);
    return { status: "dipromosikan", totalSlot: dipromosikan.length };
  }

  const kotak = hitungKotakKm(lat, lng, LUAS_CACHE_OTOMATIS_KM);
  const { zoomMin, zoomMax } = rentangZoomKetelitianTinggi(basemap, kotak);
  const urls = kumpulkanUrlSlot(basemap, kotak, zoomMin, zoomMax);
  if (urls.length === 0) return { status: "dilewati" };

  const adaKedaluwarsaDekat = slots.some(
    (s) =>
      s.basemap === basemap &&
      hitungJarakMeter({ lat, lng }, { lat: s.pusatLat, lng: s.pusatLng }) < JARAK_PINDAH_PERBARUI_METER &&
      !slotMasihBerlaku(s, sekarangMs)
  );

  // Tahap 1: Unduh citra baru dulu tanpa menghapus cache lama (aman terhadap jaringan nyasar)
  const hasilUnduh = await unduhTile(urls, {
    sinyal,
    paksaSegarkan: adaKedaluwarsaDekat
  });

  if (!unduhanLayak(hasilUnduh, urls.length)) {
    if (hasilUnduh.urlBaru.length > 0) {
      await hapusTile(hasilUnduh.urlBaru).catch(() => 0);
    }
    return {
      status: hasilUnduh.dihentikan ? "dibatalkan" : "gagal",
      hasilUnduh,
      totalSlot: slots.length
    };
  }

  // Tahap 2: Baru setelah unduhan sukses penuh, rotasi 2 slot dan bersihkan tile generasi ke-3+
  const slotBaru: SlotCachePetaOtomatis = {
    id: `auto-${basemap}-${sekarangMs}`,
    basemap,
    pusatLat: lat,
    pusatLng: lng,
    kotak,
    zoomMin,
    zoomMax,
    dibuatPada: sekarangMs,
    urls
  };

  // Saat menyegarkan area yang sama (>30 hari), perbarui slot kedaluwarsa di tempat agar cadangan lokasi lain tetap utuh
  const slotLamaDiganti = slots.filter(
    (s) =>
      s.basemap === basemap &&
      hitungJarakMeter({ lat, lng }, { lat: s.pusatLat, lng: s.pusatLng }) < 100 &&
      !slotMasihBerlaku(s, sekarangMs)
  );
  const sisaLain = slots.filter((s) => !slotLamaDiganti.some((g) => g.id === s.id));
  const gabungan = [slotBaru, ...sisaLain];
  const bertahan = gabungan.slice(0, MAKS_SLOT_CACHE_OTOMATIS);
  const tergusur = [...gabungan.slice(MAKS_SLOT_CACHE_OTOMATIS), ...slotLamaDiganti];

  const urlMasihDipakai = new Set<string>([
    ...bertahan.flatMap((s) => s.urls),
    ...areaOffline.flatMap((area) => urlTileArea(area))
  ]);
  const urlDihapus = Array.from(new Set(tergusur.flatMap((s) => s.urls))).filter((u) => !urlMasihDipakai.has(u));

  const jumlahDihapus = urlDihapus.length > 0 ? await hapusTile(urlDihapus).catch(() => 0) : 0;
  simpanSlotAutoCache(bertahan);

  return {
    status: "diperbarui",
    jumlahTile: urls.length,
    dihapus: jumlahDihapus,
    totalSlot: bertahan.length,
    hasilUnduh
  };
}
