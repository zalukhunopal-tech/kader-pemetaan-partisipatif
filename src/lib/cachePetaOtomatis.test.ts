import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hitungJarakMeter } from "./geoUtils";
import { NAMA_CACHE_TILE, SUMBER_TILE, daftarTile, muatCakupanOverlayOffline, templateAktif, urlTileArea } from "./petaOffline";
import {
  BATAS_TILE_AUTO_SLOT,
  KUNCI_AUTO_CACHE_PETA,
  LUAS_CACHE_OTOMATIS_KM,
  MAKS_SLOT_CACHE_OTOMATIS,
  TUNDA_UNDUH_OTOMATIS_MS,
  UMUR_MAKS_CACHE_MS,
  hitungKotakKm,
  jalankanAutoCache10Km,
  muatSlotAutoCache,
  perluPerbaruiCacheOtomatis,
  rentangZoomKetelitianTinggi,
  titikDiDalamKotak
} from "./cachePetaOtomatis";

const penyimpananGlobal = new Map<string, Map<string, Response>>();
const pastikanBucket = (nama: string) => {
  let bucket = penyimpananGlobal.get(nama);
  if (!bucket) {
    bucket = new Map();
    penyimpananGlobal.set(nama, bucket);
  }
  return bucket;
};
const cacheStorageMock = {
  open: vi.fn(async (nama: string) => ({
    match: async (url: string) => pastikanBucket(nama).get(url)?.clone(),
    put: async (url: string, resp: Response) => {
      pastikanBucket(nama).set(url, resp.clone());
    },
    delete: async (url: string) => pastikanBucket(nama).delete(url),
    keys: async () => Array.from(pastikanBucket(nama).keys()).map((url) => ({ url }) as Request)
  }))
};

function responGambar(label: string) {
  return new Response(new Blob([label], { type: "image/jpeg" }), {
    status: 200,
    headers: { "content-type": "image/jpeg" }
  });
}

describe("cachePetaOtomatis (otomatis 10x10 km, jeda 3 menit, tahan 30 hari, overlap sah, maks 3 kotak)", () => {
  let lsMap: Map<string, string>;

  beforeEach(() => {
    penyimpananGlobal.forEach((b) => b.clear());
    lsMap = new Map();
    vi.stubGlobal("caches", cacheStorageMock);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => lsMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        lsMap.set(k, v);
      },
      removeItem: (k: string) => {
        lsMap.delete(k);
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("menetapkan aturan baku 10 x 10 km, jeda 3 menit, batas 3 kotak persegi, dan masa simpan 30 hari", () => {
    expect(LUAS_CACHE_OTOMATIS_KM).toBe(10);
    expect(MAKS_SLOT_CACHE_OTOMATIS).toBe(3);
    expect(TUNDA_UNDUH_OTOMATIS_MS).toBe(3 * 60 * 1000);
    expect(UMUR_MAKS_CACHE_MS).toBe(30 * 24 * 60 * 60 * 1000);

    const k10 = hitungKotakKm(-6.2, 106.8);
    const tinggiM = hitungJarakMeter({ lat: k10.minLat, lng: 106.8 }, { lat: k10.maxLat, lng: 106.8 });
    const lebarM = hitungJarakMeter({ lat: -6.2, lng: k10.minLng }, { lat: -6.2, lng: k10.maxLng });
    expect(tinggiM).toBeGreaterThan(9800);
    expect(tinggiM).toBeLessThan(10200);
    expect(lebarM).toBeGreaterThan(9800);
    expect(lebarM).toBeLessThan(10200);

    const k1 = hitungKotakKm(-6.2, 106.8, 1);
    for (const bm of ["esri", "osm", "topo", "satelit"] as const) {
      const { zoomMin, zoomMax } = rentangZoomKetelitianTinggi(bm, k1);
      expect(zoomMax).toBe(SUMBER_TILE[bm].zoomMaks);
      expect(zoomMin).toBeLessThanOrEqual(zoomMax);
      expect(daftarTile(k1, zoomMin, zoomMax).length).toBeLessThanOrEqual(BATAS_TILE_AUTO_SLOT);
    }
  });

  it("memperbolehkan overlap 10x10 km, tidak menghapus citra < 30 hari sampai batas 3 kotak, dan menghapus kotak PALING LAMA saat kotak ke-4 diunduh", async () => {
    const fetchMock = vi.fn(async () => responGambar("citra-v1"));
    vi.stubGlobal("fetch", fetchMock);

    const t0 = 1_700_000_000_000;
    const progres: number[] = [];
    // Kotak 1 di pusat A (-6.2, 106.8) -> 10 x 10 km
    const h1 = await jalankanAutoCache10Km({
      basemap: "topo",
      lat: -6.2,
      lng: 106.8,
      online: true,
      sekarangMs: t0,
      onKemajuan: (selesai, total) => progres.push(Math.round((selesai / total) * 100))
    });
    expect(h1.status).toBe("diperbarui");
    expect(h1.totalSlot).toBe(1);
    expect(progres.length).toBeGreaterThan(0);

    const bucket = pastikanBucket(NAMA_CACHE_TILE);
    expect(bucket.size).toBe(h1.jumlahTile);
    expect(muatCakupanOverlayOffline()).toHaveLength(1);

    // Posisi masih di dalam kotak 1 (mis. geser 2 km) sebelum 30 hari -> tidak unduh ulang
    const panggilanSebelum = fetchMock.mock.calls.length;
    const hSegar = await jalankanAutoCache10Km({
      basemap: "topo",
      lat: -6.2 + 0.018,
      lng: 106.8,
      online: true,
      sekarangMs: t0 + 1000
    });
    expect(hSegar.status).toBe("segar");
    expect(fetchMock.mock.calls.length).toBe(panggilanSebelum);

    // Kotak 2: geser ~6 km ke timur (di luar batas 5 km kotak 1 -> kotak 2 10x10 km OVERLAP dengan kotak 1!)
    // Citra kotak 1 (< 30 hari) TIDAK boleh dihapus!
    const lat2 = -6.2;
    const lng2 = 106.8 + 0.055; // ~6.1 km ke timur
    const h2 = await jalankanAutoCache10Km({
      basemap: "topo",
      lat: lat2,
      lng: lng2,
      online: true,
      sekarangMs: t0 + 60_000
    });
    expect(h2.status).toBe("diperbarui");
    expect(h2.totalSlot).toBe(2);
    expect(h2.dihapus).toBe(0);

    const slotsSetelah2 = muatSlotAutoCache();
    expect(slotsSetelah2).toHaveLength(2);
    const kotak1 = slotsSetelah2.find((s) => s.dibuatPada === t0)!;
    const kotak2 = slotsSetelah2.find((s) => s.dibuatPada === t0 + 60_000)!;
    // Pastikan benar-benar terjadi overlap antara kotak 1 dan kotak 2
    expect(kotak2.kotak.minLng).toBeLessThan(kotak1.kotak.maxLng);
    expect(titikDiDalamKotak(lat2, lng2, kotak1.kotak)).toBe(false);
    expect(titikDiDalamKotak(lat2, lng2, kotak2.kotak)).toBe(true);

    // Kotak 3 di lokasi berbeda (~30 km selatan) -> kotak 1 & 2 (< 30 hari) tetap dipertahankan (total = 3 kotak)
    const h3 = await jalankanAutoCache10Km({
      basemap: "topo",
      lat: -6.5,
      lng: 106.8,
      online: true,
      sekarangMs: t0 + 120_000
    });
    expect(h3.status).toBe("diperbarui");
    expect(h3.totalSlot).toBe(MAKS_SLOT_CACHE_OTOMATIS);
    expect(h3.dihapus).toBe(0);
    const slotsSetelah3 = muatSlotAutoCache();
    expect(slotsSetelah3).toHaveLength(3);

    // Tambahkan area offline manual yang berbagi tile dengan kotak 1 agar tetap dilindungi
    const kotakManual = hitungKotakKm(-6.2, 106.8, 0.2);
    const areaManual = {
      id: "area-manual",
      namaArea: "Blok Manual",
      basemapId: "topo" as const,
      minLat: kotakManual.minLat,
      maxLat: kotakManual.maxLat,
      minLng: kotakManual.minLng,
      maxLng: kotakManual.maxLng,
      zoomMin: 14,
      zoomMax: 15,
      jumlahTile: 1,
      ukuranMb: 1,
      diunduhPada: new Date(t0).toISOString(),
      unduhanNyata: true,
      templateTile: templateAktif("topo")
    };
    const tileDilindungiManual = urlTileArea(areaManual)[0];
    expect(tileDilindungiManual).toBeDefined();

    // Uji gagal jaringan saat mencoba mengunduh kotak 4: seluruh 3 kotak lama HARUS tetap utuh!
    fetchMock.mockImplementation(async () => new Response("galat", { status: 503 }));
    const ukuranSebelumGagal = bucket.size;
    const hGagal = await jalankanAutoCache10Km({
      basemap: "topo",
      lat: -6.9,
      lng: 107.2,
      online: true,
      areaOffline: [areaManual],
      sekarangMs: t0 + 180_000
    });
    expect(hGagal.status).toBe("gagal");
    expect(bucket.size).toBe(ukuranSebelumGagal);
    expect(muatSlotAutoCache()).toHaveLength(3);

    // Cari tile yang beririsan (overlap) antara kotak 1 dan kotak 2 agar terbukti TIDAK ikut terhapus saat kotak 1 tergusur
    const setUrlKotak2 = new Set(kotak2.urls);
    const tileOverlap1Dan2 = kotak1.urls.find((u) => setUrlKotak2.has(u));
    expect(tileOverlap1Dan2).toBeDefined();

    // Jaringan pulih -> kotak 4 berhasil diunduh -> kotak 1 (PALING LAMA) dihapus agar tetap 3 kotak!
    fetchMock.mockImplementation(async () => responGambar("citra-loc4"));
    const h4 = await jalankanAutoCache10Km({
      basemap: "topo",
      lat: -6.9,
      lng: 107.2,
      online: true,
      areaOffline: [areaManual],
      sekarangMs: t0 + 240_000
    });
    expect(h4.status).toBe("diperbarui");
    expect(h4.totalSlot).toBe(MAKS_SLOT_CACHE_OTOMATIS);
    expect(h4.dihapus).toBeGreaterThan(0);

    const slotAkhir = muatSlotAutoCache();
    expect(slotAkhir).toHaveLength(3);
    // Urut terbaru -> kotak 4, kotak 3, kotak 2; kotak 1 (dibuatPada = t0) sudah dihapus
    expect(slotAkhir.map((s) => s.dibuatPada)).toEqual([t0 + 240_000, t0 + 120_000, t0 + 60_000]);
    expect(slotAkhir.some((s) => s.dibuatPada === t0)).toBe(false);
    // Tile overlap kotak 1 & 2 dan tile area manual tetap aman di Cache API!
    expect(bucket.has(tileOverlap1Dan2!)).toBe(true);
    expect(bucket.has(tileDilindungiManual)).toBe(true);
    expect(JSON.parse(lsMap.get(KUNCI_AUTO_CACHE_PETA) ?? "[]")).toHaveLength(3);
    expect(muatCakupanOverlayOffline()).toHaveLength(3);
  });

  it("otomatis menyegarkan citra saat berumur >= 30 hari dan mempertahankan citra lama bila penyegaran gagal", async () => {
    let versi = "citra-awal";
    const fetchMock = vi.fn(async () => responGambar(versi));
    vi.stubGlobal("fetch", fetchMock);

    const t0 = 1_700_000_000_000;
    await jalankanAutoCache10Km({ basemap: "topo", lat: -7.1, lng: 110.4, online: true, sekarangMs: t0 });
    const slots = muatSlotAutoCache();
    expect(perluPerbaruiCacheOtomatis(slots, "topo", -7.1, 110.4, t0 + UMUR_MAKS_CACHE_MS - 1000)).toBe(false);
    expect(perluPerbaruiCacheOtomatis(slots, "topo", -7.1, 110.4, t0 + UMUR_MAKS_CACHE_MS)).toBe(true);

    // Simulasikan jaringan nyasar setelah 30 hari: citra lama TIDAK boleh hilang!
    fetchMock.mockImplementation(async () => new Response("putus", { status: 500 }));
    const hGagal30 = await jalankanAutoCache10Km({
      basemap: "topo",
      lat: -7.1,
      lng: 110.4,
      online: true,
      sekarangMs: t0 + UMUR_MAKS_CACHE_MS + 5000
    });
    expect(hGagal30.status).toBe("gagal");
    const bucket = pastikanBucket(NAMA_CACHE_TILE);
    const sampleUrl = slots[0].urls[0];
    const respAwal = bucket.get(sampleUrl);
    expect(respAwal).toBeDefined();
    expect(await respAwal!.clone().text()).toBe("citra-awal");

    // Internet stabil kembali setelah 30 hari -> unduh ulang citra terbaru dan perbarui timestamp
    versi = "citra-hari-30";
    fetchMock.mockImplementation(async () => responGambar(versi));
    const tRefresh = t0 + UMUR_MAKS_CACHE_MS + 10_000;
    const hRefresh = await jalankanAutoCache10Km({
      basemap: "topo",
      lat: -7.1,
      lng: 110.4,
      online: true,
      sekarangMs: tRefresh
    });
    expect(hRefresh.status).toBe("diperbarui");
    expect(muatSlotAutoCache()[0].dibuatPada).toBe(tRefresh);
    expect(await bucket.get(sampleUrl)!.clone().text()).toBe("citra-hari-30");
  });
});
