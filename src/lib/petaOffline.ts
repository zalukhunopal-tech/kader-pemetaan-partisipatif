import { AreaPetaOffline, BasemapType } from "../types";

/**
 * PETA OFFLINE
 * Tile peta yang diunduh disimpan di Cache API (satu cache khusus) dan dibaca lebih dulu
 * saat menggambar peta, sehingga area yang sudah diunduh tetap tampil tanpa internet.
 * Jumlah dan ukuran yang ditampilkan dihitung dari tile yang benar-benar tersimpan.
 */

export const NAMA_CACHE_TILE = "geokader-tiles-v1";
/** Batas tile per area agar unduhan tidak membebani penyedia tile maupun penyimpanan HP */
export const BATAS_TILE_PER_AREA = 2500;
/** Batas kegagalan: lebih dari ini dianggap unduhan gagal dan dibatalkan */
const BATAS_GAGAL_PERSEN = 5;
const PARALEL_UNDUH = 4;

export type BasemapTile = Exclude<BasemapType, "taktis">;

export interface SumberTile {
  template: string;
  /** true bila pengunduhan massal untuk pemakaian offline diizinkan oleh penyedia */
  bolehUnduh: boolean;
  alasanTidakBoleh?: string;
  /** Perkiraan rata-rata ukuran satu tile (KB) untuk estimasi sebelum mengunduh */
  rataKbPerTile: number;
}

const env = import.meta.env;

/**
 * Sumber tile. Tiga layanan publik bawaan hanya untuk dilihat online. Untuk unduhan offline,
 * pasang penyedia tile yang lisensinya mengizinkan (mis. server tile sendiri) lewat
 * VITE_TILE_URL_* dan nyatakan izinnya dengan VITE_TILE_UNDUH_*=true.
 */
export const SUMBER_TILE: Record<BasemapTile, SumberTile> = {
  satelit: {
    template:
      env.VITE_TILE_URL_SATELIT ||
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    bolehUnduh: env.VITE_TILE_UNDUH_SATELIT === "true",
    alasanTidakBoleh:
      "Layanan citra publik bawaan tidak menjamin izin menyimpan tile untuk dipakai offline.",
    rataKbPerTile: 22
  },
  osm: {
    template: env.VITE_TILE_URL_OSM || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    bolehUnduh: env.VITE_TILE_UNDUH_OSM === "true",
    alasanTidakBoleh:
      "Kebijakan tile OpenStreetMap melarang pengunduhan massal dari tile.openstreetmap.org.",
    rataKbPerTile: 14
  },
  topo: {
    template: env.VITE_TILE_URL_TOPO || "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    bolehUnduh: env.VITE_TILE_UNDUH_TOPO === "true",
    alasanTidakBoleh:
      "Layanan OpenTopoMap publik tidak menjamin izin pengunduhan massal untuk pemakaian offline.",
    rataKbPerTile: 28
  }
};

export const NAMA_ENV_SUMBER: Record<BasemapTile, string> = {
  satelit: "SATELIT",
  osm: "OSM",
  topo: "TOPO"
};

/* ---------- Geometri tile ---------- */

export interface KotakWilayah {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface TileXYZ {
  z: number;
  x: number;
  y: number;
}

export const lngKeTileX = (lng: number, z: number) => ((lng + 180) / 360) * Math.pow(2, z);

export const latKeTileY = (lat: number, z: number) => {
  const rad = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
};

function rentangTile(kotak: KotakWilayah, z: number) {
  const maks = Math.pow(2, z) - 1;
  const x0 = Math.max(0, Math.min(maks, Math.floor(lngKeTileX(kotak.minLng, z))));
  const x1 = Math.max(0, Math.min(maks, Math.floor(lngKeTileX(kotak.maxLng, z))));
  const y0 = Math.max(0, Math.min(maks, Math.floor(latKeTileY(kotak.maxLat, z))));
  const y1 = Math.max(0, Math.min(maks, Math.floor(latKeTileY(kotak.minLat, z))));
  return { x0, x1, y0, y1 };
}

/** Jumlah tile yang menutupi kotak wilayah pada rentang zoom (tanpa membuat daftarnya) */
export function hitungJumlahTile(kotak: KotakWilayah, zoomMin: number, zoomMax: number): number {
  let total = 0;
  for (let z = zoomMin; z <= zoomMax; z++) {
    const { x0, x1, y0, y1 } = rentangTile(kotak, z);
    total += (x1 - x0 + 1) * (y1 - y0 + 1);
  }
  return total;
}

export function daftarTile(kotak: KotakWilayah, zoomMin: number, zoomMax: number): TileXYZ[] {
  const hasil: TileXYZ[] = [];
  for (let z = zoomMin; z <= zoomMax; z++) {
    const { x0, x1, y0, y1 } = rentangTile(kotak, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) hasil.push({ z, x, y });
  }
  return hasil;
}

/** Mengisi {z}, {x}, {y} pada templat URL; x diputar di sekitar bumi, y di luar rentang = tidak ada tile */
export function isiTemplateTile(template: string, z: number, x: number, y: number): string | null {
  const maks = Math.pow(2, z);
  if (y < 0 || y >= maks) return null;
  const xNorm = ((x % maks) + maks) % maks;
  return template.replace("{z}", String(z)).replace("{x}", String(xNorm)).replace("{y}", String(y));
}

export function urlTile(basemap: BasemapType, z: number, x: number, y: number): string | null {
  if (basemap === "taktis") return null;
  return isiTemplateTile(SUMBER_TILE[basemap].template, z, x, y);
}

export const perkiraanUkuranMb = (jumlahTile: number, basemap: BasemapTile) =>
  (jumlahTile * SUMBER_TILE[basemap].rataKbPerTile) / 1024;

/* ---------- Cache API ---------- */

export const penyimpananTileDidukung = () => typeof caches !== "undefined";

let janjiCache: Promise<Cache> | null = null;
const bukaCache = () => (janjiCache ??= caches.open(NAMA_CACHE_TILE));

function gambarDariUrl(src: string, cadangkanCors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cadangkanCors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("tile gagal dimuat"));
    img.src = src;
  });
}

/**
 * Memuat satu tile: dari penyimpanan offline bila ada, selain itu dari jaringan.
 */
export async function muatGambarTile(url: string): Promise<HTMLImageElement> {
  if (penyimpananTileDidukung()) {
    try {
      const hit = await (await bukaCache()).match(url);
      if (hit) {
        const blobUrl = URL.createObjectURL(await hit.blob());
        try {
          return await gambarDariUrl(blobUrl, false);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }
    } catch {
      // cache tidak terbaca: lanjut ke jaringan
    }
  }
  return gambarDariUrl(url, true);
}

export interface HasilUnduh {
  tersimpan: number;
  sudahAda: number;
  /** Galat sungguhan: jaringan putus, ditolak (403/429), galat server, atau balasan bukan gambar */
  gagal: number;
  /** Tile yang memang tidak ada di penyedia (404/410), mis. di tepi cakupan; bukan kegagalan */
  tidakAda: number;
  byte: number;
  dihentikan: boolean;
  kuotaPenuh: boolean;
  /** URL yang baru ditulis pada unduhan ini (untuk pembatalan/rollback) */
  urlBaru: string[];
}

export interface OpsiUnduh {
  sinyal?: AbortSignal;
  onKemajuan?: (selesai: number, total: number, gagal: number) => void;
}

async function ambilSatuTile(
  cache: Cache,
  url: string,
  sinyal?: AbortSignal
): Promise<{ status: "baru" | "ada" | "gagal" | "tidakAda"; byte: number }> {
  const hit = await cache.match(url);
  if (hit) return { status: "ada", byte: (await hit.blob()).size };
  for (let percobaan = 0; percobaan < 2; percobaan++) {
    try {
      const resp = await fetch(url, { mode: "cors", signal: sinyal });
      if (resp.status === 404 || resp.status === 410) return { status: "tidakAda", byte: 0 };
      if (!resp.ok) return { status: "gagal", byte: 0 };
      const tipe = resp.headers.get("content-type") ?? "";
      if (!tipe.startsWith("image/")) return { status: "gagal", byte: 0 }; // mis. halaman galat berformat HTML
      const blob = await resp.blob();
      await cache.put(url, new Response(blob, { headers: { "content-type": tipe } }));
      return { status: "baru", byte: blob.size };
    } catch (err) {
      if (sinyal?.aborted) throw err;
      if (err instanceof DOMException && err.name === "QuotaExceededError") throw err;
      // galat jaringan: coba sekali lagi
    }
  }
  return { status: "gagal", byte: 0 };
}

/** Mengunduh daftar URL tile ke penyimpanan offline dengan beberapa permintaan paralel */
export async function unduhTile(daftarUrl: string[], opsi: OpsiUnduh = {}): Promise<HasilUnduh> {
  const hasil: HasilUnduh = {
    tersimpan: 0,
    sudahAda: 0,
    gagal: 0,
    tidakAda: 0,
    byte: 0,
    dihentikan: false,
    kuotaPenuh: false,
    urlBaru: []
  };
  const cache = await bukaCache();
  let indeks = 0;
  let selesai = 0;
  const total = daftarUrl.length;

  async function pekerja() {
    while (indeks < total && !hasil.dihentikan && !hasil.kuotaPenuh) {
      const url = daftarUrl[indeks++];
      try {
        const r = await ambilSatuTile(cache, url, opsi.sinyal);
        if (r.status === "baru") {
          hasil.tersimpan++;
          hasil.urlBaru.push(url);
        } else if (r.status === "ada") hasil.sudahAda++;
        else if (r.status === "tidakAda") hasil.tidakAda++;
        else hasil.gagal++;
        hasil.byte += r.byte;
      } catch (err) {
        if (opsi.sinyal?.aborted) hasil.dihentikan = true;
        else if (err instanceof DOMException && err.name === "QuotaExceededError") hasil.kuotaPenuh = true;
        else hasil.gagal++;
      }
      selesai++;
      opsi.onKemajuan?.(selesai, total, hasil.gagal);
    }
  }

  await Promise.all(Array.from({ length: Math.min(PARALEL_UNDUH, total) }, pekerja));
  if (!hasil.dihentikan && !hasil.kuotaPenuh && typeof navigator !== "undefined") {
    void navigator.storage?.persist?.().catch(() => undefined);
  }
  return hasil;
}

/** Apakah hasil unduhan layak disimpan sebagai area: ada tile, dan galat sungguhan di bawah batas */
export function unduhanLayak(h: HasilUnduh, total: number): boolean {
  if (h.dihentikan || h.kuotaPenuh) return false;
  if (h.tersimpan + h.sudahAda === 0) return false;
  return (h.gagal / Math.max(1, total)) * 100 <= BATAS_GAGAL_PERSEN;
}

export async function hapusTile(daftarUrl: string[]): Promise<number> {
  if (!penyimpananTileDidukung() || daftarUrl.length === 0) return 0;
  const cache = await bukaCache();
  let terhapus = 0;
  for (const url of daftarUrl) {
    if (await cache.delete(url)) terhapus++;
  }
  return terhapus;
}

export function urlTileArea(area: AreaPetaOffline): string[] {
  if (!area.unduhanNyata || !area.templateTile) return [];
  const hasil: string[] = [];
  for (const t of daftarTile(area, area.zoomMin, area.zoomMax)) {
    const u = isiTemplateTile(area.templateTile, t.z, t.x, t.y);
    if (u) hasil.push(u);
  }
  return hasil;
}

/** Menghapus tile sebuah area, kecuali tile yang juga dipakai area unduhan lain */
export async function hapusTileArea(area: AreaPetaOffline, semuaArea: AreaPetaOffline[]): Promise<number> {
  const dipakaiLain = new Set<string>();
  for (const a of semuaArea) {
    if (a.id !== area.id) urlTileArea(a).forEach((u) => dipakaiLain.add(u));
  }
  return hapusTile(urlTileArea(area).filter((u) => !dipakaiLain.has(u)));
}

export async function ukuranPenyimpanan(): Promise<{ pakaiMb: number; kuotaMb: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e || e.usage === undefined || e.quota === undefined) return null;
    return { pakaiMb: e.usage / 1_000_000, kuotaMb: e.quota / 1_000_000 };
  } catch {
    return null;
  }
}
