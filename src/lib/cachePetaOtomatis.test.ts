import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hitungJarakMeter } from "./geoUtils";
import { NAMA_CACHE_TILE, SUMBER_TILE, daftarTile, templateAktif, urlTileArea } from "./petaOffline";
import {
  BATAS_TILE_AUTO_SLOT,
  KUNCI_AUTO_CACHE_PETA,
  MAKS_SLOT_CACHE_OTOMATIS,
  UMUR_MAKS_CACHE_MS,
  hitungKotakKm,
  jalankanAutoCache1Km,
  muatSlotAutoCache,
  perluPerbaruiCacheOtomatis,
  rentangZoomKetelitianTinggi
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

describe("cachePetaOtomatis (1x1 km ketelitian tinggi & cadangan 2 slot)", () => {
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

  it("menghitung kotak 1 x 1 km akurat dan memilih rentang zoom sampai ketelitian maks tanpa melampaui batas aman", () => {
    const k = hitungKotakKm(-6.2, 106.8, 1);
    const tinggiM = hitungJarakMeter({ lat: k.minLat, lng: 106.8 }, { lat: k.maxLat, lng: 106.8 });
    const lebarM = hitungJarakMeter({ lat: -6.2, lng: k.minLng }, { lat: -6.2, lng: k.maxLng });
    expect(tinggiM).toBeGreaterThan(980);
    expect(tinggiM).toBeLessThan(1020);
    expect(lebarM).toBeGreaterThan(980);
    expect(lebarM).toBeLessThan(1020);

    for (const bm of ["esri", "osm", "topo", "satelit"] as const) {
      const { zoomMin, zoomMax } = rentangZoomKetelitianTinggi(bm, k);
      expect(zoomMax).toBe(SUMBER_TILE[bm].zoomMaks);
      expect(zoomMin).toBeLessThanOrEqual(zoomMax);
      expect(daftarTile(k, zoomMin, zoomMax).length).toBeLessThanOrEqual(BATAS_TILE_AUTO_SLOT);
    }
  });

  it("menyimpan 2 generasi cache bergulir, memelihara area offline manual, dan menggulung balik aman saat jaringan nyasar", async () => {
    const fetchMock = vi.fn(async () => responGambar("citra-v1"));
    vi.stubGlobal("fetch", fetchMock);

    const t0 = 1_700_000_000_000;
    const h1 = await jalankanAutoCache1Km({
      basemap: "osm",
      lat: -6.2,
      lng: 106.8,
      online: true,
      sekarangMs: t0
    });
    expect(h1.status).toBe("diperbarui");
    expect(h1.totalSlot).toBe(1);

    const bucket = pastikanBucket(NAMA_CACHE_TILE);
    expect(bucket.size).toBe(h1.jumlahTile);

    // Panggil ulang di koordinat berdekatan (<450 m) sebelum 30 hari -> tidak unduh ulang
    const panggilanSebelum = fetchMock.mock.calls.length;
    const hSegar = await jalankanAutoCache1Km({
      basemap: "osm",
      lat: -6.2005,
      lng: 106.8005,
      online: true,
      sekarangMs: t0 + 1000
    });
    expect(hSegar.status).toBe("segar");
    expect(fetchMock.mock.calls.length).toBe(panggilanSebelum);

    // Pindah ke lokasi 2 (~10 km jauhnya) -> unduh lokasi 2 dan simpan lokasi 1 sebagai cadangan (2 slot)
    const h2 = await jalankanAutoCache1Km({
      basemap: "osm",
      lat: -6.3,
      lng: 106.9,
      online: true,
      sekarangMs: t0 + 60_000
    });
    expect(h2.status).toBe("diperbarui");
    expect(h2.totalSlot).toBe(MAKS_SLOT_CACHE_OTOMATIS);
    expect(h2.dihapus).toBe(0);

    const slotsSetelah2 = muatSlotAutoCache();
    expect(slotsSetelah2).toHaveLength(2);
    const urlSlot1 = slotsSetelah2[1].urls;
    const urlSlot2 = slotsSetelah2[0].urls;

    // Tambahkan simulasi area offline manual yang berbagi tile dengan slot 1
    const kotakManual = hitungKotakKm(-6.2, 106.8, 0.2);
    const areaManual = {
      id: "area-manual",
      namaArea: "Blok Manual",
      basemap: "osm" as const,
      basemapId: "osm" as const,
      minLat: kotakManual.minLat,
      maxLat: kotakManual.maxLat,
      minLng: kotakManual.minLng,
      maxLng: kotakManual.maxLng,
      zoomMin: slotsSetelah2[1].zoomMin,
      zoomMax: slotsSetelah2[1].zoomMax,
      jumlahTile: 1,
      ukuranMb: 1,
      diunduhPada: new Date(t0).toISOString(),
      unduhanNyata: true,
      templateTile: templateAktif("osm")
    };
    const tileDilindungiManual = urlTileArea(areaManual)[0];
    expect(tileDilindungiManual).toBeDefined();

    // Uji jaringan nyasar saat mencoba mengunduh lokasi 3: cache lokasi 1 & 2 HARUS tetap utuh!
    fetchMock.mockImplementation(async () => new Response("galat", { status: 503 }));
    const ukuranSebelumGagal = bucket.size;
    const hGagal = await jalankanAutoCache1Km({
      basemap: "osm",
      lat: -6.45,
      lng: 107.05,
      online: true,
      areaOffline: [areaManual],
      sekarangMs: t0 + 120_000
    });
    expect(hGagal.status).toBe("gagal");
    expect(bucket.size).toBe(ukuranSebelumGagal);
    expect(muatSlotAutoCache().map((s) => s.id)).toEqual(slotsSetelah2.map((s) => s.id));
    for (const u of [...urlSlot1, ...urlSlot2]) {
      expect(bucket.has(u)).toBe(true);
    }

    // Sekarang jaringan pulih dan lokasi 3 berhasil terunduh -> lokasi 1 (kecuali tile area manual) dihapus,
    // menyisakan slot 3 (aktif) + slot 2 (cadangan) = 2 slot
    fetchMock.mockImplementation(async () => responGambar("citra-loc3"));
    const h3 = await jalankanAutoCache1Km({
      basemap: "osm",
      lat: -6.45,
      lng: 107.05,
      online: true,
      areaOffline: [areaManual],
      sekarangMs: t0 + 180_000
    });
    expect(h3.status).toBe("diperbarui");
    expect(h3.totalSlot).toBe(MAKS_SLOT_CACHE_OTOMATIS);
    expect(h3.dihapus).toBeGreaterThan(0);

    const slotAkhir = muatSlotAutoCache();
    expect(slotAkhir).toHaveLength(2);
    expect(slotAkhir[0].pusatLat).toBeCloseTo(-6.45, 4);
    expect(slotAkhir[1].pusatLat).toBeCloseTo(-6.3, 4);
    expect(bucket.has(tileDilindungiManual)).toBe(true);
    expect(JSON.parse(lsMap.get(KUNCI_AUTO_CACHE_PETA) ?? "[]")).toHaveLength(2);

    // Pastikan tile khusus slot 2 masih aman
    expect(bucket.has(urlSlot2[0])).toBe(true);
  });

  it("otomatis menyegarkan citra saat berumur >= 30 hari dan mempertahankan citra lama bila penyegaran gagal", async () => {
    let versi = "citra-awal";
    const fetchMock = vi.fn(async () => responGambar(versi));
    vi.stubGlobal("fetch", fetchMock);

    const t0 = 1_700_000_000_000;
    await jalankanAutoCache1Km({ basemap: "topo", lat: -7.1, lng: 110.4, online: true, sekarangMs: t0 });
    const slots = muatSlotAutoCache();
    expect(perluPerbaruiCacheOtomatis(slots, "topo", -7.1, 110.4, t0 + UMUR_MAKS_CACHE_MS - 1000)).toBe(false);
    expect(perluPerbaruiCacheOtomatis(slots, "topo", -7.1, 110.4, t0 + UMUR_MAKS_CACHE_MS)).toBe(true);

    // Simulasikan jaringan nyasar setelah 30 hari: citra lama TIDAK boleh hilang!
    fetchMock.mockImplementation(async () => new Response("putus", { status: 500 }));
    const hGagal30 = await jalankanAutoCache1Km({
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
    const hRefresh = await jalankanAutoCache1Km({
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
