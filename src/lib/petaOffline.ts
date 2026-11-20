import { AreaPetaOffline, BasemapType } from "../types";
import { kunciGoogle, tokenSesiGoogle } from "./googleTiles";
import { ambilTilePmtilesBlob, registrasiProtokolPmtiles } from "./pmtilesProtocol";
import { ambilTileMbtilesBlob, registrasiProtokolMbtiles } from "./mbtilesProtocol";

export { registrasiProtokolPmtiles, registrasiProtokolMbtiles };

/**
 * PETA OFFLINE
 * Tile peta yang diunduh disimpan di Cache API (satu cache khusus) dan dibaca lebih dulu
 * saat menggambar peta, sehingga area yang sudah diunduh tetap tampil tanpa internet.
 * Jumlah dan ukuran yang ditampilkan dihitung dari tile yang benar-benar tersimpan.
 */

export const NAMA_CACHE_TILE = "geokader-tiles-v1";
/** Batas tile per area agar unduhan tidak membebani penyedia tile maupun penyimpanan HP */
export const BATAS_TILE_PER_AREA = 6000;
/** Batas kapasitas penyimpanan cache tile otomatis saat browsing peta luring (4.000 tile / ±120 MB) */
export const BATAS_MAKS_AUTO_TILE_CACHE = 4000;

/** URL tile yang diunduh manual oleh pengguna agar tidak tergusur pembersihan LRU auto-cache */
const urlDilindungiOffline = new Set<string>();

let pembersihanLruBerjalan = false;
async function pantauDanPangkasCacheLru(cache: Cache) {
  if (pembersihanLruBerjalan) return;
  pembersihanLruBerjalan = true;
  try {
    const keys = await cache.keys();
    if (keys.length > BATAS_MAKS_AUTO_TILE_CACHE) {
      const kandidat = keys.filter((req) => !urlDilindungiOffline.has(req.url));
      const pangkas = Math.max(100, Math.floor(kandidat.length * 0.1));
      for (let i = 0; i < pangkas && i < kandidat.length; i++) {
        await cache.delete(kandidat[i]);
      }
    }
  } catch {
    // Abaikan jika browser tidak mendukung inspeksi keys
  } finally {
    pembersihanLruBerjalan = false;
  }
}

let counterAutoCache = 0;
async function simpanTileOtomatisKeCache(cache: Cache, url: string, blob: Blob, contentType: string) {
  try {
    await cache.put(url, new Response(blob.slice(0), { headers: { "content-type": contentType } }));
    counterAutoCache++;
    if (counterAutoCache % 50 === 0) {
      void pantauDanPangkasCacheLru(cache);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      void pantauDanPangkasCacheLru(cache);
    }
  }
}
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

const ESRI_WORLD_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_CADANGAN = [
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
];

const GOOGLE_HYBRID_TILES = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
const GOOGLE_CADANGAN = [
  "https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  "https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  "https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
];

function sumberSatelit(): SumberTile {
  const kustom = env.VITE_TILE_URL_SATELIT;
  const izinUnduh = !!kustom && env.VITE_TILE_UNDUH_SATELIT === "true";
  if (kustom) {
    return {
      nama: "Satelit Kustom",
      tersedia: true,
      template: kustom,
      atribusi: env.VITE_TILE_ATRIBUSI_SATELIT || "Penyedia tile citra satelit",
      tautanLisensi: "",
      lisensi: "Ditentukan oleh penyedia tile yang Anda pasang.",
      zoomMaks: Number(env.VITE_TILE_ZOOM_MAKS_SATELIT) || 19,
      bolehUnduh: izinUnduh,
      alasanTidakBoleh: "Unduhan offline belum dinyatakan diizinkan untuk penyedia tile ini.",
      rataKbPerTile: 25
    };
  }
  return {
    nama: "Citra Satelit Resolusi Tinggi",
    tersedia: true,
    template: ESRI_WORLD_IMAGERY,
    templateCadangan: [GOOGLE_HYBRID_TILES, ...ESRI_CADANGAN],
    atribusi: "Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USDA FSA, USGS",
    tautanLisensi: "https://www.esri.com/en-us/legal/terms/full-master-agreement",
    lisensi: "Citra satelit resolusi tinggi global (Esri World Imagery).",
    zoomMaks: 19,
    bolehUnduh: false,
    alasanTidakBoleh: "Tile publik Esri World Imagery untuk dilihat online; gunakan penyedia berlisensi untuk offline.",
    rataKbPerTile: 24
  };
}

const kunciEsri = (env.VITE_ESRI_API_KEY ?? "").trim();

/**
 * Esri World Imagery (citra resolusi tinggi Maxar/Vantor dan lainnya, sering < 1 m di Indonesia).
 * Legal lewat akun ArcGIS Location Platform: kuota gratis 2 juta tile basemap per bulan, wajib atribusi.
 */
function sumberEsri(): SumberTile {
  const templateUtama = kunciEsri
    ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(kunciEsri)}`
    : ESRI_WORLD_IMAGERY;

  return {
    nama: "Satelit Esri (HD)",
    tersedia: true,
    berkuota: !!kunciEsri,
    template: templateUtama,
    templateCadangan: ESRI_CADANGAN,
    atribusi: "Powered by Esri | Sumber: Esri, Maxar, Earthstar Geographics, dan GIS Community",
    tautanLisensi: "https://www.esri.com/en-us/legal/terms/full-master-agreement",
    lisensi: "Citra satelit resolusi tinggi Esri World Imagery (Maxar/Earthstar).",
    zoomMaks: 19,
    bolehUnduh: false,
    alasanTidakBoleh: "Ketentuan Esri melarang mengambil tile massal untuk offline di luar perangkat lunak Esri.",
    rataKbPerTile: 24
  };
}

/**
 * Citra satelit Google resolusi tinggi (hybrid dengan label jalan & batas wilayah yang jelas).
 */
function sumberGoogle(): SumberTile {
  const adaKunciResmi = kunciGoogle() !== "";
  const templateUtama = adaKunciResmi
    ? `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session={sesi}&key=${encodeURIComponent(kunciGoogle())}`
    : GOOGLE_HYBRID_TILES;

  return {
    nama: "Google Satelit (HD)",
    tersedia: true,
    berkuota: adaKunciResmi,
    atribusiDinamis: adaKunciResmi,
    template: templateUtama,
    templateCadangan: GOOGLE_CADANGAN,
    atribusi: "© Google, Maxar Technologies, CNES / Airbus",
    tautanLisensi: "https://cloud.google.com/maps-platform/terms",
    lisensi: "Citra satelit resolusi tinggi Google Hybrid.",
    zoomMaks: 20,
    bolehUnduh: false,
    alasanTidakBoleh: "Ketentuan Google melarang menyimpan tile untuk pemakaian offline.",
    catatanPakai: "Ketentuan Google melarang menjiplak atau mendigitasi objek dari citra Google.",
    rataKbPerTile: 28
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
    bolehUnduh: !!env.VITE_TILE_URL_OSM && env.VITE_TILE_UNDUH_OSM === "true",
    alasanTidakBoleh: "Kebijakan tile OpenStreetMap melarang pengunduhan massal dari tile.openstreetmap.org.",
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
    bolehUnduh: !!env.VITE_TILE_URL_TOPO && env.VITE_TILE_UNDUH_TOPO === "true",
    alasanTidakBoleh: "Layanan OpenTopoMap publik tidak menjamin izin pengunduhan massal untuk pemakaian offline.",
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
export function laporHasilTile(
  basemap: BasemapType,
  berhasil: boolean,
  online = typeof navigator === "undefined" || navigator.onLine
): boolean {
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

/** Urutan pilihan peta dasar di menu Lapisan (utamakan citra satelit resolusi tinggi) */
export const URUTAN_BASEMAP: BasemapType[] = ["esri", "google", "satelit", "osm", "topo", "taktis"];

export const basemapTersedia = (b: BasemapType): boolean => b === "taktis" || SUMBER_TILE[b]?.tersedia === true;

/** Peta dasar awal: Citra Satelit Esri resolusi tinggi (HD) */
export function basemapBawaan(): BasemapType {
  return "esri";
}

/** Zoom tile yang benar-benar diminta untuk zoom tampilan (tidak melebihi zoom maksimum penyedia) */
export function zoomSumber(basemap: BasemapType, zoomTampil: number): number {
  if (basemap === "taktis") return zoomTampil;
  // Zoom tampilan bisa pecahan (hasil cubit/roda); tile selalu diambil pada level bulat terdekat
  return Math.min(Math.round(zoomTampil), SUMBER_TILE[basemap].zoomMaks);
}

export const perkiraanUkuranMb = (jumlahTile: number, basemap: BasemapTile) => (jumlahTile * SUMBER_TILE[basemap].rataKbPerTile) / 1024;

/* ---------- Cache API ---------- */

export const penyimpananTileDidukung = () => typeof caches !== "undefined";

let janjiCache: Promise<Cache> | null = null;
const bukaCache = () => {
  if (!janjiCache) {
    janjiCache = caches.open(NAMA_CACHE_TILE).catch((err) => {
      janjiCache = null;
      throw err;
    });
  }
  return janjiCache;
};

/** Hanya untuk pengujian: menyetel ulang pegangan Cache API antar kasus uji */
export function setelUlangCacheUntukUji(): void {
  janjiCache = null;
  urlDilindungiOffline.clear();
}

function gambarDariUrl(src: string, cadangkanCors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cadangkanCors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("tile gagal dimuat"));
    img.src = src;
  });
}

/** Menentukan apakah sebuah AreaPetaOffline adalah peta berbasis tile offline (XYZ Tiles / PMTiles / MBTiles), bukan lembar GeoPDF/raster. */
export function adalahPetaTileOffline(peta?: AreaPetaOffline | null): boolean {
  if (!peta) return false;
  const tpl = (peta.templateTile || peta.petaKustomUrl || "").trim();
  if (tpl.startsWith("pmtiles://") || tpl.startsWith("mbtiles://")) return true;
  return Boolean((peta.unduhanNyata || peta.jenisFile === "XYZ Tiles") && peta.templateTile);
}

/**
 * Memilih sumber dan templat tile efektif yang mendukung fetch CORS untuk pengunduhan citra offline.
 * - Sumber Google tanpa kunci API (`mt*.google.com`) memblokir fetch CORS sehingga dialihkan ke Citra Satelit Esri HD
 *   yang mendukung CORS penuh agar unduhan citra offline selalu berhasil disimpan ke Cache API.
 * - Sumber dengan `{sesi}` (Google Tiles API resmi) mengisi token sesi aktif atau beralih ke Esri HD bila sesi belum siap.
 */
export function sumberUnduhOfflineEfektif(basemap: BasemapType): {
  nama: string;
  basemapEfektif: BasemapTile;
  template: string;
  templateCadangan: string[];
  zoomMaks: number;
  dialihkanDariGoogle: boolean;
} | null {
  if (basemap === "taktis") return null;
  const sumber = SUMBER_TILE[basemap];
  if (!sumber?.tersedia) return null;

  if (basemap === "google") {
    const tpl = templateAktif("google");
    if (tpl.includes("{sesi}")) {
      const token = tokenSesiGoogle();
      if (token) {
        return {
          nama: sumber.nama,
          basemapEfektif: "google",
          template: tpl.replace("{sesi}", encodeURIComponent(token)),
          templateCadangan: [ESRI_WORLD_IMAGERY, ...ESRI_CADANGAN],
          zoomMaks: sumber.zoomMaks,
          dialihkanDariGoogle: false
        };
      }
    }
    // mt*.google.com tidak menyediakan header CORS untuk Cache API -> pakai Esri World Imagery HD agar citra offline pasti tersimpan
    return {
      nama: "Citra Satelit HD (Esri World Imagery)",
      basemapEfektif: "esri",
      template: ESRI_WORLD_IMAGERY,
      templateCadangan: [...ESRI_CADANGAN],
      zoomMaks: SUMBER_TILE.esri.zoomMaks,
      dialihkanDariGoogle: true
    };
  }

  const aktif = templateAktif(basemap);
  const cadangan = (sumber.templateCadangan ?? []).filter((t) => !t.includes("google.com/vt/"));
  const daftarCadangan = [...cadangan];
  if ((basemap === "satelit" || basemap === "esri") && !daftarCadangan.includes(ESRI_WORLD_IMAGERY) && aktif !== ESRI_WORLD_IMAGERY) {
    daftarCadangan.unshift(ESRI_WORLD_IMAGERY);
  }
  return {
    nama: sumber.nama,
    basemapEfektif: basemap,
    template: aktif.includes("google.com/vt/") ? ESRI_WORLD_IMAGERY : aktif,
    templateCadangan: daftarCadangan,
    zoomMaks: sumber.zoomMaks,
    dialihkanDariGoogle: false
  };
}

/**
 * Memuat satu tile HANYA dari penyimpanan offline (PMTiles / MBTiles / Cache API) tanpa memicu jaringan.
 */
export async function muatGambarTileDariCache(url: string): Promise<HTMLImageElement | null> {
  if (url.startsWith("pmtiles://")) {
    const match = url.replace("pmtiles://", "").match(/^([^/]+)\/(\d+)\/(\d+)\/(\d+)/);
    if (match) {
      const blob = await ambilTilePmtilesBlob(match[1], +match[2], +match[3], +match[4]);
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        try {
          return await gambarDariUrl(blobUrl, false);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }
    }
    return null;
  }

  if (url.startsWith("mbtiles://")) {
    const match = url.replace("mbtiles://", "").match(/^([^/]+)\/(\d+)\/(\d+)\/(\d+)/);
    if (match) {
      const blob = await ambilTileMbtilesBlob(match[1], +match[2], +match[3], +match[4]);
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        try {
          return await gambarDariUrl(blobUrl, false);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }
    }
    return null;
  }

  if (penyimpananTileDidukung()) {
    try {
      const hit = await (await bukaCache()).match(url);
      if (hit) {
        const blob = await hit.blob();
        if (blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          try {
            return await gambarDariUrl(blobUrl, false);
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
        }
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Memuat satu tile: dari penyimpanan offline bila ada, selain itu dari jaringan (kecuali hanyaCache = true).
 */
export async function muatGambarTile(url: string, opsi?: { hanyaCache?: boolean }): Promise<HTMLImageElement> {
  const dariCache = await muatGambarTileDariCache(url);
  if (dariCache) return dariCache;

  if (url.startsWith("pmtiles://")) {
    throw new Error("Tile PMTiles tidak ditemukan");
  }
  if (url.startsWith("mbtiles://")) {
    throw new Error("Tile MBTiles tidak ditemukan");
  }
  if (opsi?.hanyaCache || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    throw new Error("Tile belum tersedia di cache offline");
  }

  // AUTO-CACHE TILE CITRA & PETA: jika online dan Cache API tersedia, unduh via fetch CORS lalu simpan otomatis
  if (penyimpananTileDidukung() && typeof fetch !== "undefined") {
    try {
      const resp = await fetch(url, { mode: "cors" });
      if (resp.ok) {
        const tipe = resp.headers.get("content-type") ?? "";
        if (tipe.startsWith("image/")) {
          const blob = await resp.blob();
          try {
            const cache = await bukaCache();
            void simpanTileOtomatisKeCache(cache, url, blob, tipe);
          } catch {
            // lanjut render jika cache gagal
          }
          const blobUrl = URL.createObjectURL(blob);
          try {
            return await gambarDariUrl(blobUrl, false);
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
        }
      }
    } catch {
      // jika fetch CORS gagal atau offline, lanjutkan ke pemuat Image standar
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
  /** Jika true, unduh ulang dari jaringan meski URL sudah ada di Cache API; hanya timpa bila unduhan sukses */
  paksaSegarkan?: boolean;
  /** Daftar URL cadangan per URL utama (disimpan di bawah kunci URL utama agar langsung terbaca saat offline) */
  pembuatUrlCadangan?: (url: string) => string[];
}

async function ambilSatuTile(
  cache: Cache,
  url: string,
  sinyal?: AbortSignal,
  paksaSegarkan = false,
  urlCadangan: string[] = []
): Promise<{ status: "baru" | "ada" | "gagal" | "tidakAda"; adaSebelumnya: boolean; byte: number }> {
  const hit = await cache.match(url);
  const adaSebelumnya = Boolean(hit);
  if (hit && !paksaSegarkan) {
    urlDilindungiOffline.add(url);
    return { status: "ada", adaSebelumnya: true, byte: (await hit.blob()).size };
  }
  const kandidatUrl = [url, ...urlCadangan.filter((u) => u && u !== url)];
  let semuaTidakAda = true;
  for (let idx = 0; idx < kandidatUrl.length; idx++) {
    const targetUrl = kandidatUrl[idx];
    const maksCoba = idx === 0 ? 2 : 1;
    for (let percobaan = 0; percobaan < maksCoba; percobaan++) {
      try {
        const resp = await fetch(targetUrl, { mode: "cors", signal: sinyal });
        if (resp.status === 404 || resp.status === 410) {
          break; // lanjut cek cadangan bila ada
        }
        semuaTidakAda = false;
        if (!resp.ok) break;
        const tipe = resp.headers.get("content-type") ?? "";
        if (!tipe.startsWith("image/")) break; // mis. halaman galat berformat HTML
        const blob = await resp.blob();
        if (blob.size === 0) break;
        // Simpan selalu di bawah kunci `url` utama agar muatGambarTile(url) langsung hit di mode offline
        await cache.put(url, new Response(blob, { headers: { "content-type": tipe } }));
        urlDilindungiOffline.add(url);
        return { status: "baru", adaSebelumnya, byte: blob.size };
      } catch (err) {
        if (sinyal?.aborted) throw err;
        if (err instanceof DOMException && err.name === "QuotaExceededError") throw err;
        semuaTidakAda = false;
        // galat jaringan: coba sekali lagi
      }
    }
  }
  return { status: semuaTidakAda ? "tidakAda" : "gagal", adaSebelumnya, byte: 0 };
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
        const cadangan = opsi.pembuatUrlCadangan ? opsi.pembuatUrlCadangan(url) : [];
        const r = await ambilSatuTile(cache, url, opsi.sinyal, Boolean(opsi.paksaSegarkan), cadangan);
        if (r.status === "baru") {
          hasil.tersimpan++;
          if (!r.adaSebelumnya) hasil.urlBaru.push(url);
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

/* ---------- Overlay Citra Offline Langsung di Peta Interaktif (Tanpa Lapisan Tersendiri) ---------- */

export const KUNCI_OVERLAY_OFFLINE = "geokader_overlay_offline_v1";

export interface CakupanOverlayOffline {
  id: string;
  basemapId: BasemapTile;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoomMin: number;
  zoomMax: number;
  templateTile: string;
  jumlahTile: number;
  ukuranMb: number;
  diunduhPada: string;
}

export function muatCakupanOverlayOffline(): CakupanOverlayOffline[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const mentah = localStorage.getItem(KUNCI_OVERLAY_OFFLINE);
    if (!mentah) return [];
    const arr = JSON.parse(mentah);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is CakupanOverlayOffline =>
        Boolean(x) &&
        typeof x.id === "string" &&
        typeof x.templateTile === "string" &&
        Number.isFinite(x.minLat) &&
        Number.isFinite(x.maxLat) &&
        Number.isFinite(x.minLng) &&
        Number.isFinite(x.maxLng)
    );
  } catch {
    return [];
  }
}

export function simpanCakupanOverlayOffline(cakupan: CakupanOverlayOffline): CakupanOverlayOffline[] {
  const lama = muatCakupanOverlayOffline().filter((x) => x.id !== cakupan.id);
  const baru = [cakupan, ...lama].slice(0, 24);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KUNCI_OVERLAY_OFFLINE, JSON.stringify(baru));
    } catch {
      // Abaikan jika localStorage penuh; tile tetap tersimpan aman di Cache API
    }
  }
  return baru;
}

export function gantiDaftarOverlayOffline(daftar: CakupanOverlayOffline[]): CakupanOverlayOffline[] {
  const bersih = daftar.slice(0, 24);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KUNCI_OVERLAY_OFFLINE, JSON.stringify(bersih));
    } catch {
      // Abaikan jika localStorage penuh; tile tetap tersimpan aman di Cache API
    }
  }
  return bersih;
}

export function cariOverlayOfflineDiTitik(
  lat: number,
  lng: number,
  daftar: CakupanOverlayOffline[] = muatCakupanOverlayOffline()
): CakupanOverlayOffline | undefined {
  return daftar.find((c) => lat >= c.minLat && lat <= c.maxLat && lng >= c.minLng && lng <= c.maxLng);
}

export function setelUlangOverlayOfflineUntukUji(): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(KUNCI_OVERLAY_OFFLINE);
    } catch {
      // Abaikan
    }
  }
}
