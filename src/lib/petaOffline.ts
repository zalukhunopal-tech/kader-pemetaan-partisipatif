import { AreaPetaOffline, BasemapType } from "../types";
import { kunciGoogle, tokenSesiGoogle } from "./googleTiles";

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
  /** Nama yang tampil di pilihan peta */
  nama: string;
  /** false bila sumber ini butuh kunci API yang belum dipasang (pilihan tidak ditampilkan) */
  tersedia: boolean;
  /** Sumber berkuota (berbayar di atas kuota gratis): hanya tile yang benar-benar tampil yang diminta */
  berkuota?: boolean;
  /** Teks hak cipta berubah menurut area yang tampil dan diambil dari penyedia (Google) */
  atribusiDinamis?: boolean;
  /** Catatan ketentuan yang perlu diketahui pemakai, mis. larangan menjiplak dari citra */
  catatanPakai?: string;
  /** Templat URL utama, dengan {z}, {x}, {y} */
  template: string;
  /** Templat cadangan yang dicoba bila templat utama terus gagal (mis. jalur layanan berubah) */
  templateCadangan?: string[];
  /** Atribusi yang WAJIB tampil di peta menurut lisensi/ketentuan penyedia */
  atribusi: string;
  /** Tautan ketentuan/lisensi penyedia */
  tautanLisensi: string;
  /** Ringkasan lisensi untuk pengguna */
  lisensi: string;
  /** Zoom tertinggi yang disediakan; di atasnya tile dari zoom ini diperbesar */
  zoomMaks: number;
  /** true bila pengunduhan massal untuk pemakaian offline diizinkan oleh penyedia */
  bolehUnduh: boolean;
  alasanTidakBoleh?: string;
  /** Perkiraan rata-rata ukuran satu tile (KB) untuk estimasi sebelum mengunduh */
  rataKbPerTile: number;
}

const env = import.meta.env;

/** Sentinel-2 cloudless 2016 dari EOX: CC BY 4.0, boleh dipakai komersial maupun non-komersial dengan atribusi */
const EOX_S2_2016 = [
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"
];

function sumberSatelit(): SumberTile {
  const kustom = env.VITE_TILE_URL_SATELIT;
  if (kustom) {
    return {
      nama: "Satelit",
      tersedia: true,
      template: kustom,
      atribusi: env.VITE_TILE_ATRIBUSI_SATELIT || "Sumber citra: penyedia tile milik organisasi",
      tautanLisensi: "",
      lisensi: "Ditentukan oleh penyedia tile yang Anda pasang.",
      zoomMaks: Number(env.VITE_TILE_ZOOM_MAKS_SATELIT) || 19,
      bolehUnduh: env.VITE_TILE_UNDUH_SATELIT === "true",
      alasanTidakBoleh: "Unduhan offline belum dinyatakan diizinkan untuk penyedia tile ini.",
      rataKbPerTile: 22
    };
  }
  return {
    nama: "Satelit Sentinel-2",
    tersedia: true,
    template: EOX_S2_2016[0],
    templateCadangan: EOX_S2_2016.slice(1),
    atribusi: "Sentinel-2 cloudless – s2maps.eu oleh EOX IT Services GmbH (data Copernicus Sentinel 2016 yang dimodifikasi)",
    tautanLisensi: "https://s2maps.eu",
    lisensi: "CC BY 4.0 (citra 2016, resolusi 10 m). Gratis dengan atribusi; layanan EOX hanya untuk dipakai online.",
    zoomMaks: 13,
    bolehUnduh: false,
    alasanTidakBoleh: "Layanan tile EOX diizinkan untuk dipakai langsung secara online, bukan untuk diunduh massal.",
    rataKbPerTile: 22
  };
}

const kunciEsri = (env.VITE_ESRI_API_KEY ?? "").trim();

/**
 * Esri World Imagery (citra resolusi tinggi Maxar/Vantor dan lainnya, sering < 1 m di Indonesia).
 * Legal lewat akun ArcGIS Location Platform: kuota gratis 2 juta tile basemap per bulan, wajib atribusi.
 */
function sumberEsri(): SumberTile {
  return {
    nama: "Satelit Esri",
    tersedia: kunciEsri !== "",
    berkuota: true,
    template: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(kunciEsri)}`,
    atribusi: "Powered by Esri | Sumber: Esri, Maxar, Earthstar Geographics, dan GIS User Community",
    tautanLisensi: "https://www.esri.com/en-us/legal/terms/full-master-agreement",
    lisensi: "Ketentuan Esri (akun ArcGIS Location Platform, gratis 2 juta tile/bulan). Hanya untuk dilihat online.",
    zoomMaks: 19,
    bolehUnduh: false,
    alasanTidakBoleh: "Ketentuan Esri melarang mengambil tile massal untuk offline di luar perangkat lunak Esri.",
    rataKbPerTile: 22
  };
}

/**
 * Citra satelit Google lewat Map Tiles API resmi (token sesi, lihat googleTiles.ts). Gratis 100.000
 * tile per bulan; wajib logo Google dan teks hak cipta dari Google; tidak boleh disimpan offline dan
 * tidak boleh dijiplak/didigitasi menjadi data baru.
 */
function sumberGoogle(): SumberTile {
  return {
    nama: "Satelit Google",
    tersedia: kunciGoogle() !== "",
    berkuota: true,
    atribusiDinamis: true,
    template: `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session={sesi}&key=${encodeURIComponent(kunciGoogle())}`,
    atribusi: "Google",
    tautanLisensi: "https://cloud.google.com/maps-platform/terms",
    lisensi:
      "Ketentuan Google Maps Platform (Map Tiles API, gratis 100.000 tile/bulan). Hanya untuk dilihat online, tidak boleh disimpan offline.",
    catatanPakai:
      "Ketentuan Google melarang menjiplak atau mendigitasi objek dari citra Google. Rekam lokasi dengan GPS di lapangan, atau pakai citra Sentinel-2/Esri untuk menggambar batas.",
    zoomMaks: 19,
    bolehUnduh: false,
    alasanTidakBoleh: "Ketentuan Google melarang menyimpan tile untuk pemakaian offline.",
    rataKbPerTile: 30
  };
}

/**
 * Sumber tile. Bawaan hanya memakai layanan gratis yang ketentuannya mengizinkan dipakai di aplikasi
 * dengan atribusi, dan semuanya untuk dilihat online. Untuk unduhan offline, pasang penyedia tile
 * yang lisensinya mengizinkan (mis. tile buatan sendiri dari data terbuka) lewat VITE_TILE_URL_* dan
 * nyatakan izinnya dengan VITE_TILE_UNDUH_*=true.
 */
export const SUMBER_TILE: Record<BasemapTile, SumberTile> = {
  satelit: sumberSatelit(),
  google: sumberGoogle(),
  esri: sumberEsri(),
  osm: {
    nama: "OpenStreetMap",
    tersedia: true,
    template: env.VITE_TILE_URL_OSM || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    atribusi: (env.VITE_TILE_URL_OSM && env.VITE_TILE_ATRIBUSI_OSM) || "© Kontributor OpenStreetMap",
    tautanLisensi: "https://www.openstreetmap.org/copyright",
    lisensi: "Data ODbL. Server tile OSM boleh dipakai untuk melihat peta dengan atribusi, tidak untuk diunduh massal.",
    zoomMaks: 19,
    bolehUnduh: env.VITE_TILE_UNDUH_OSM === "true",
    alasanTidakBoleh:
      "Kebijakan tile OpenStreetMap melarang pengunduhan massal dari tile.openstreetmap.org.",
    rataKbPerTile: 14
  },
  topo: {
    nama: "OpenTopoMap",
    tersedia: true,
    template: env.VITE_TILE_URL_TOPO || "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    atribusi: env.VITE_TILE_URL_TOPO
      ? env.VITE_TILE_ATRIBUSI_TOPO || "© Kontributor OpenStreetMap"
      : "Data peta: © Kontributor OpenStreetMap, SRTM | Gaya peta: © OpenTopoMap (CC-BY-SA)",
    tautanLisensi: "https://opentopomap.org/about",
    lisensi: "CC-BY-SA dengan atribusi. Untuk dilihat online; pemakaian besar perlu menghubungi OpenTopoMap.",
    zoomMaks: 17,
    bolehUnduh: env.VITE_TILE_UNDUH_TOPO === "true",
    alasanTidakBoleh:
      "Layanan OpenTopoMap publik tidak menjamin izin pengunduhan massal untuk pemakaian offline.",
    rataKbPerTile: 28
  }
};

export const NAMA_ENV_SUMBER: Record<BasemapTile, string> = {
  satelit: "SATELIT",
  google: "GOOGLE",
  esri: "ESRI",
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

/* ---------- Templat aktif dan cadangan ---------- */

const indeksTemplate: Partial<Record<BasemapTile, number>> = {};
const hitungGagal: Partial<Record<BasemapTile, { gagal: number; berhasil: number }>> = {};
/** Templat diganti bila tile beruntun gagal sebanyak ini tanpa satu pun berhasil (saat online) */
const BATAS_GAGAL_GANTI_TEMPLAT = 6;

const daftarTemplat = (b: BasemapTile) => [SUMBER_TILE[b].template, ...(SUMBER_TILE[b].templateCadangan ?? [])];

export function templateAktif(basemap: BasemapTile): string {
  const daftar = daftarTemplat(basemap);
  return daftar[Math.min(indeksTemplate[basemap] ?? 0, daftar.length - 1)];
}

/**
 * Dicatat oleh penggambar peta setiap kali tile selesai dimuat. Bila templat utama terus gagal
 * padahal online (mis. penyedia mengubah jalur layanan), templat cadangan dipakai. Mengembalikan
 * true bila templat berganti sehingga peta perlu digambar ulang.
 */
export function laporHasilTile(basemap: BasemapType, berhasil: boolean, online = typeof navigator === "undefined" || navigator.onLine): boolean {
  if (basemap === "taktis") return false;
  const c = (hitungGagal[basemap] ??= { gagal: 0, berhasil: 0 });
  if (berhasil) {
    c.berhasil++;
    c.gagal = 0;
    return false;
  }
  if (!online || c.berhasil > 0) return false;
  c.gagal++;
  const daftar = daftarTemplat(basemap);
  const i = indeksTemplate[basemap] ?? 0;
  if (c.gagal >= BATAS_GAGAL_GANTI_TEMPLAT && i < daftar.length - 1) {
    indeksTemplate[basemap] = i + 1;
    c.gagal = 0;
    return true;
  }
  return false;
}

/** Hanya untuk pengujian */
export function setelUlangTemplatUntukUji(): void {
  for (const k of Object.keys(indeksTemplate)) delete indeksTemplate[k as BasemapTile];
  for (const k of Object.keys(hitungGagal)) delete hitungGagal[k as BasemapTile];
}

export function urlTile(basemap: BasemapType, z: number, x: number, y: number): string | null {
  if (basemap === "taktis" || !SUMBER_TILE[basemap].tersedia) return null;
  let templat = templateAktif(basemap);
  if (templat.includes("{sesi}")) {
    const token = tokenSesiGoogle();
    if (!token) return null; // sesi sedang dibuat; peta digambar ulang setelah siap
    templat = templat.replace("{sesi}", encodeURIComponent(token));
  }
  return isiTemplateTile(templat, z, x, y);
}

/** Urutan pilihan peta dasar di menu Lapisan; sumber berkunci hanya muncul bila kuncinya dipasang */
export const URUTAN_BASEMAP: BasemapType[] = ["google", "esri", "satelit", "topo", "osm", "taktis"];

export const basemapTersedia = (b: BasemapType): boolean => b === "taktis" || SUMBER_TILE[b]?.tersedia === true;

/** Peta dasar awal: citra paling tajam yang tersedia (Google, lalu Esri, lalu Sentinel-2) */
export function basemapBawaan(): BasemapType {
  return (["google", "esri"] as const).find((b) => SUMBER_TILE[b].tersedia) ?? "satelit";
}

/** Zoom tile yang benar-benar diminta untuk zoom tampilan (tidak melebihi zoom maksimum penyedia) */
export function zoomSumber(basemap: BasemapType, zoomTampil: number): number {
  if (basemap === "taktis") return zoomTampil;
  // Zoom tampilan bisa pecahan (hasil cubit/roda); tile selalu diambil pada level bulat terdekat
  return Math.min(Math.round(zoomTampil), SUMBER_TILE[basemap].zoomMaks);
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
