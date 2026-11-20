import { AreaPetaOffline, BasemapType } from "../types";
import {
  BasemapTile,
  CakupanOverlayOffline,
  HasilUnduh,
  KotakWilayah,
  SUMBER_TILE,
  TileXYZ,
  daftarTile,
  gantiDaftarOverlayOffline,
  hapusTile,
  hitungJumlahTile,
  isiTemplateTile,
  penyimpananTileDidukung,
  sumberUnduhOfflineEfektif,
  unduhTile,
  unduhanLayak,
  urlTileArea
} from "./petaOffline";

export const KUNCI_AUTO_CACHE_PETA = "geokader_auto_cache_peta_v1";
export const EVENT_OVERLAY_OFFLINE_DIPERBARUI = "geokader:overlay-offline-diperbarui";
/** Luas setiap kotak citra offline otomatis: 10 x 10 km persegi */
export const LUAS_CACHE_OTOMATIS_KM = 10;
/** Masa berlaku citra offline sebelum diperbarui otomatis: 30 hari */
export const UMUR_MAKS_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
/** Batas maksimal kotak citra offline tersimpan: 3 kotak persegi 10 x 10 km */
export const MAKS_SLOT_CACHE_OTOMATIS = 3;
/** Jeda tunggu 3 menit saat aplikasi dibuka agar posisi user menyesuaikan lokasi terkini */
export const TUNDA_UNDUH_OTOMATIS_MS = 3 * 60 * 1000;
export const ZOOM_MIN_AUTO_10KM = 10;
export const ZOOM_MAKS_AUTO_10KM = 20;
export const JARAK_PINDAH_PERBARUI_METER = 5000;
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
  templateTile?: string;
  ukuranMb?: number;
}

export interface ParameterAutoCache {
  basemap: BasemapType;
  lat: number;
  lng: number;
  online: boolean;
  areaOffline?: AreaPetaOffline[];
  sinyal?: AbortSignal;
  sekarangMs?: number;
  onKemajuan?: (selesai: number, total: number, gagal: number) => void;
}

export interface HasilAutoCache {
  status: "dilewati" | "segar" | "dipromosikan" | "diperbarui" | "dibatalkan" | "gagal";
  jumlahTile?: number;
  dihapus?: number;
  totalSlot?: number;
  hasilUnduh?: HasilUnduh;
  slotAktif?: SlotCachePetaOtomatis;
}

/** Hitung kotak bujur sangkar berpusat di koordinat (bawaan 10 x 10 km persegi) */
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

/** Memeriksa apakah koordinat berada di dalam batas kotak persegi citra offline */
export function titikDiDalamKotak(lat: number, lng: number, kotak: KotakWilayah): boolean {
  return lat >= kotak.minLat && lat <= kotak.maxLat && lng >= kotak.minLng && lng <= kotak.maxLng;
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

/**
 * Menyusun piramida tile untuk kotak 10 x 10 km berpusat di posisi user:
 * - 10 x 10 km penuh pada zoom 10..15 (orientasi & navigasi koridor luas)
 * - 4 x 4 km menengah pada zoom 16..17
 * - 1.5 x 1.5 km detail pada zoom 18
 * - 0.5 x 0.5 km presisi tinggi di pusat area pada zoom 19..20 (atau batas zoom penyedia)
 */
export function daftarTilePiramida10Km(latPusat: number, lngPusat: number, zoomMaksSumber: number): TileXYZ[] {
  const zMaxEfektif = Math.min(ZOOM_MAKS_AUTO_10KM, Math.max(15, zoomMaksSumber));
  const lapisan: { sisiKm: number; zMin: number; zMax: number }[] = [
    { sisiKm: LUAS_CACHE_OTOMATIS_KM, zMin: ZOOM_MIN_AUTO_10KM, zMax: Math.min(15, zMaxEfektif) },
    { sisiKm: 4, zMin: 16, zMax: Math.min(17, zMaxEfektif) },
    { sisiKm: 1.5, zMin: 18, zMax: Math.min(18, zMaxEfektif) },
    { sisiKm: 0.5, zMin: 19, zMax: zMaxEfektif }
  ];
  const hasil: TileXYZ[] = [];
  const dilihat = new Set<string>();
  for (const lap of lapisan) {
    if (lap.zMin > lap.zMax) continue;
    const kotak = hitungKotakKm(latPusat, lngPusat, lap.sisiKm);
    for (const t of daftarTile(kotak, lap.zMin, lap.zMax)) {
      const k = `${t.z}/${t.x}/${t.y}`;
      if (!dilihat.has(k)) {
        dilihat.add(k);
        hasil.push(t);
      }
    }
  }
  return hasil;
}

export function slotMasihBerlaku(slot: SlotCachePetaOtomatis, sekarangMs = Date.now()): boolean {
  return sekarangMs - slot.dibuatPada < UMUR_MAKS_CACHE_MS;
}

/** Menghitung sisa hari masa simpan (0..30 hari) sebuah kotak citra offline */
export function sisaHariSlot(slot: SlotCachePetaOtomatis, sekarangMs = Date.now()): number {
  const sisaMs = UMUR_MAKS_CACHE_MS - (sekarangMs - slot.dibuatPada);
  if (sisaMs <= 0) return 0;
  return Math.max(1, Math.ceil(sisaMs / (24 * 60 * 60 * 1000)));
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
          Boolean(s.kotak) &&
          typeof s.kotak.minLat === "number" &&
          typeof s.kotak.maxLat === "number" &&
          typeof s.kotak.minLng === "number" &&
          typeof s.kotak.maxLng === "number" &&
          Array.isArray(s.urls)
      )
      .sort((a, b) => b.dibuatPada - a.dibuatPada)
      .slice(0, MAKS_SLOT_CACHE_OTOMATIS);
  } catch {
    return [];
  }
}

function sinkronkanSlotKeOverlay(slots: SlotCachePetaOtomatis[]): void {
  const daftarOverlay: CakupanOverlayOffline[] = slots.map((s) => ({
    id: s.id,
    basemapId: s.basemap,
    minLat: s.kotak.minLat,
    maxLat: s.kotak.maxLat,
    minLng: s.kotak.minLng,
    maxLng: s.kotak.maxLng,
    zoomMin: s.zoomMin,
    zoomMax: s.zoomMax,
    templateTile: s.templateTile || SUMBER_TILE[s.basemap]?.template || "",
    jumlahTile: s.urls.length,
    ukuranMb: s.ukuranMb ?? Number(((s.urls.length * (SUMBER_TILE[s.basemap]?.rataKbPerTile ?? 20)) / 1000).toFixed(2)),
    diunduhPada: new Date(s.dibuatPada).toISOString()
  }));
  gantiDaftarOverlayOffline(daftarOverlay);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent(EVENT_OVERLAY_OFFLINE_DIPERBARUI));
    } catch {
      // Abaikan di lingkungan non-DOM
    }
  }
}

export function simpanSlotAutoCache(slots: SlotCachePetaOtomatis[]): void {
  const terurut = [...slots].sort((a, b) => b.dibuatPada - a.dibuatPada).slice(0, MAKS_SLOT_CACHE_OTOMATIS);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KUNCI_AUTO_CACHE_PETA, JSON.stringify(terurut));
    } catch {
      // Abaikan kuota localStorage penuh; tile tetap tersimpan di Cache API
    }
  }
  sinkronkanSlotKeOverlay(terurut);
}

function cocokBasemapSlot(slotBasemap: BasemapTile, basemap: BasemapType): boolean {
  const efektif = sumberUnduhOfflineEfektif(basemap)?.basemapEfektif;
  if (!efektif) return false;
  if (slotBasemap === efektif) return true;
  // Basemap citra satelit (Google/Esri/Satelit) berbagi cakupan citra offline yang sama
  const grupSatelit = new Set<BasemapTile>(["google", "esri", "satelit"]);
  return grupSatelit.has(slotBasemap) && grupSatelit.has(efektif);
}

/** Mencari kotak 10 x 10 km terbaru yang mencakup posisi user (diperbolehkan overlap antar kotak) */
export function cariSlotMencakup(
  slots: SlotCachePetaOtomatis[],
  basemap: BasemapType,
  lat: number,
  lng: number,
  hanyaYangBerlaku = false,
  sekarangMs = Date.now()
): SlotCachePetaOtomatis | undefined {
  const terurut = [...slots].sort((a, b) => b.dibuatPada - a.dibuatPada);
  return terurut.find(
    (s) =>
      cocokBasemapSlot(s.basemap, basemap) &&
      titikDiDalamKotak(lat, lng, s.kotak) &&
      (!hanyaYangBerlaku || slotMasihBerlaku(s, sekarangMs))
  );
}

/** Evaluasi apakah lokasi saat ini sudah tercakup kotak 10 x 10 km (< 30 hari) atau perlu diunduh */
export function perluPerbaruiCacheOtomatis(
  slots: SlotCachePetaOtomatis[],
  basemap: BasemapType,
  lat: number,
  lng: number,
  sekarangMs = Date.now()
): boolean {
  const aktif = cariSlotMencakup(slots, basemap, lat, lng, true, sekarangMs);
  return !aktif;
}

/**
 * Mengunduh citra offline otomatis 10 x 10 km persegi dengan aturan:
 * 1. Luas setiap kotak selalu 10 x 10 km berpusat di lokasi terkini user (overlap antar kotak diperbolehkan).
 * 2. Masa simpan 30 hari; citra sebelumnya yang belum 30 hari TIDAK dihapus selama jumlah kotak <= 3.
 * 3. Batas maksimal 3 kotak persegi; jika lebih dari 3, kotak yang PALING LAMA (dibuatPada terkecil) dihapus
 *    (tetap menjaga tile yang beririsan/overlap dengan 3 kotak yang bertahan).
 * 4. Atomik: jika unduhan gagal/putus jaringan, gulung balik tile baru tanpa menghapus citra lama.
 */
export async function jalankanAutoCache10Km(param: ParameterAutoCache): Promise<HasilAutoCache> {
  const { basemap, lat, lng, online, areaOffline = [], sinyal, onKemajuan } = param;
  const sekarangMs = param.sekarangMs ?? Date.now();
  if (!online || basemap === "taktis" || !penyimpananTileDidukung()) {
    return { status: "dilewati" };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { status: "dilewati" };
  }

  const sumberEfektif = sumberUnduhOfflineEfektif(basemap);
  if (!sumberEfektif) {
    return { status: "dilewati" };
  }

  let slots = muatSlotAutoCache();
  const slotSegar = cariSlotMencakup(slots, basemap, lat, lng, true, sekarangMs);
  if (slotSegar) {
    return { status: "segar", totalSlot: slots.length, slotAktif: slotSegar };
  }

  const kotak = hitungKotakKm(lat, lng, LUAS_CACHE_OTOMATIS_KM);
  const piramida = daftarTilePiramida10Km(lat, lng, sumberEfektif.zoomMaks);
  const urls: string[] = [];
  const cadanganPerUrl = new Map<string, string[]>();
  const dilihat = new Set<string>();
  for (const t of piramida) {
    const utama = isiTemplateTile(sumberEfektif.template, t.z, t.x, t.y);
    if (!utama || dilihat.has(utama)) continue;
    dilihat.add(utama);
    urls.push(utama);
    if (sumberEfektif.templateCadangan.length > 0) {
      const cad = sumberEfektif.templateCadangan
        .map((tpl) => isiTemplateTile(tpl, t.z, t.x, t.y))
        .filter((u): u is string => Boolean(u) && u !== utama);
      if (cad.length > 0) cadanganPerUrl.set(utama, cad);
    }
  }
  if (urls.length === 0) return { status: "dilewati" };

  // Cek apakah lokasi ini punya kotak kedaluwarsa (>= 30 hari) yang perlu disegarkan
  const slotKedaluwarsaDiLokasi = slots.filter(
    (s) => cocokBasemapSlot(s.basemap, basemap) && titikDiDalamKotak(lat, lng, s.kotak) && !slotMasihBerlaku(s, sekarangMs)
  );
  const adaKedaluwarsaDiLokasi = slotKedaluwarsaDiLokasi.length > 0;

  // Tahap 1: Unduh citra 10 x 10 km baru dulu tanpa menghapus citra lama (aman bila koneksi putus)
  let hasilUnduh = await unduhTile(urls, {
    sinyal,
    paksaSegarkan: adaKedaluwarsaDiLokasi,
    pembuatUrlCadangan: (u) => cadanganPerUrl.get(u) ?? [],
    onKemajuan
  });

  // Bila penyimpanan penuh dan sudah ada >= 3 kotak, hapus 1 kotak paling lama terlebih dahulu lalu coba unduh ulang
  if (hasilUnduh.kuotaPenuh && !hasilUnduh.dihentikan && slots.length >= MAKS_SLOT_CACHE_OTOMATIS) {
    if (hasilUnduh.urlBaru.length > 0) {
      await hapusTile(hasilUnduh.urlBaru).catch(() => 0);
    }
    const terurutLama = [...slots].sort((a, b) => a.dibuatPada - b.dibuatPada);
    const palingLama = terurutLama[0];
    const sisaSementara = slots.filter((s) => s.id !== palingLama.id);
    const dipakaiLain = new Set<string>([
      ...sisaSementara.flatMap((s) => s.urls),
      ...areaOffline.flatMap((area) => urlTileArea(area))
    ]);
    const hapusDulu = palingLama.urls.filter((u) => !dipakaiLain.has(u));
    if (hapusDulu.length > 0) {
      await hapusTile(hapusDulu).catch(() => 0);
    }
    slots = sisaSementara;
    simpanSlotAutoCache(slots);

    hasilUnduh = await unduhTile(urls, {
      sinyal,
      paksaSegarkan: adaKedaluwarsaDiLokasi,
      pembuatUrlCadangan: (u) => cadanganPerUrl.get(u) ?? [],
      onKemajuan
    });
  }

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

  // Tahap 2: Simpan kotak baru; citra < 30 hari tetap dipertahankan sampai batas 3 kotak.
  // Jika melebihi 3 kotak persegi, hapus kotak yang PALING LAMA (dibuatPada terkecil) tanpa merusak tile overlap.
  const zoomMaxTersimpan = Math.min(ZOOM_MAKS_AUTO_10KM, sumberEfektif.zoomMaks);
  const slotBaru: SlotCachePetaOtomatis = {
    id: `auto-${sumberEfektif.basemapEfektif}-${sekarangMs}`,
    basemap: sumberEfektif.basemapEfektif,
    pusatLat: lat,
    pusatLng: lng,
    kotak,
    zoomMin: ZOOM_MIN_AUTO_10KM,
    zoomMax: zoomMaxTersimpan,
    dibuatPada: sekarangMs,
    urls,
    templateTile: sumberEfektif.template,
    ukuranMb: Number((hasilUnduh.byte / 1_000_000).toFixed(2))
  };

  // Ganti kotak kedaluwarsa (>= 30 hari) di lokasi ini agar kotak valid lainnya tetap utuh
  const sisaAktif = slots.filter((s) => !slotKedaluwarsaDiLokasi.some((k) => k.id === s.id));
  const gabungan = [slotBaru, ...sisaAktif].sort((a, b) => b.dibuatPada - a.dibuatPada);
  const bertahan = gabungan.slice(0, MAKS_SLOT_CACHE_OTOMATIS);
  const tergusur = [...gabungan.slice(MAKS_SLOT_CACHE_OTOMATIS), ...slotKedaluwarsaDiLokasi];

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
    hasilUnduh,
    slotAktif: slotBaru
  };
}

/** Alias kompatibilitas untuk pemanggil lama */
export const jalankanAutoCache1Km = jalankanAutoCache10Km;
