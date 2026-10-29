import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AreaPetaOffline } from "../types";

type ModulPeta = typeof import("./petaOffline");

/** CacheStorage tiruan berbasis Map; opsi `galatPut` untuk meniru penyimpanan penuh */
function pasangCacheTiruan(galatPut?: () => Error) {
  const isi = new Map<string, Response>();
  const cache = {
    match: async (u: string) => isi.get(u)?.clone(),
    put: async (u: string, r: Response) => {
      if (galatPut) throw galatPut();
      isi.set(u, r);
    },
    delete: async (u: string) => isi.delete(u)
  };
  vi.stubGlobal("caches", { open: async () => cache });
  return isi;
}

const respons = (status: number, tipe = "image/png", ukuran = 100) =>
  new Response(status === 200 ? new Uint8Array(ukuran) : null, { status, headers: { "content-type": tipe } });

async function muat(): Promise<ModulPeta> {
  vi.resetModules(); // cache modul (janjiCache) dibuat ulang untuk tiap tes
  return import("./petaOffline");
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("geometri tile", () => {
  it("lngKeTileX / latKeTileY pada nilai acuan", async () => {
    const m = await muat();
    expect(m.lngKeTileX(-180, 5)).toBe(0);
    expect(m.lngKeTileX(0, 1)).toBe(1);
    expect(m.lngKeTileX(180, 0)).toBe(1);
    expect(m.latKeTileY(0, 1)).toBeCloseTo(1, 10);
    // Padang (-0.95, 100.35), nilai acuan dihitung terpisah dengan rumus slippy-map standar
    expect(m.lngKeTileX(100.35, 10)).toBeCloseTo(797.44, 2);
    expect(m.latKeTileY(-0.95, 10)).toBeCloseTo(514.7023, 3);
    expect(m.latKeTileY(-0.95, 12)).toBeCloseTo(2058.8094, 3);
  });

  it("lintang di luar batas Mercator dijepit, bukan menghasilkan Infinity/NaN", async () => {
    const m = await muat();
    expect(m.latKeTileY(90, 4)).toBeCloseTo(m.latKeTileY(85.0511, 4), 10);
    expect(Number.isFinite(m.latKeTileY(-90, 4))).toBe(true);
  });

  it("hitungJumlahTile sama dengan panjang daftarTile", async () => {
    const m = await muat();
    const kotak = { minLat: -1.0, maxLat: -0.9, minLng: 100.3, maxLng: 100.45 };
    const daftar = m.daftarTile(kotak, 10, 14);
    expect(daftar.length).toBe(m.hitungJumlahTile(kotak, 10, 14));
    expect(new Set(daftar.map((t) => `${t.z}/${t.x}/${t.y}`)).size).toBe(daftar.length);
    expect(daftar.every((t) => t.z >= 10 && t.z <= 14)).toBe(true);
  });

  it("jumlah tile bertambah ±4x tiap naik satu zoom", async () => {
    const m = await muat();
    const kotak = { minLat: -1.2, maxLat: -0.7, minLng: 100.1, maxLng: 100.7 };
    const a = m.hitungJumlahTile(kotak, 13, 13);
    const b = m.hitungJumlahTile(kotak, 14, 14);
    expect(b / a).toBeGreaterThan(3);
    expect(b / a).toBeLessThan(5);
  });

  it("kotak yang lebih kecil dari satu tile tetap memerlukan 1 tile per zoom", async () => {
    const m = await muat();
    expect(m.hitungJumlahTile({ minLat: -0.9501, maxLat: -0.95, minLng: 100.3501, maxLng: 100.35 }, 8, 10)).toBe(3);
  });

  it("seluruh dunia pada zoom 0..1 = 1 + 4 tile", async () => {
    const m = await muat();
    expect(m.hitungJumlahTile({ minLat: -85, maxLat: 85, minLng: -180, maxLng: 179.999 }, 0, 1)).toBe(5);
  });

  it("indeks tile tidak pernah keluar rentang 0..2^z-1", async () => {
    const m = await muat();
    for (const t of m.daftarTile({ minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 }, 0, 4)) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(2 ** t.z);
      expect(t.y).toBeLessThan(2 ** t.z);
    }
  });
});

describe("templat URL", () => {
  it("mengisi {z} {x} {y}", async () => {
    const m = await muat();
    expect(m.isiTemplateTile("https://t.example/{z}/{x}/{y}.png", 5, 7, 9)).toBe("https://t.example/5/7/9.png");
    expect(m.isiTemplateTile("https://t.example/{z}/{y}/{x}", 5, 7, 9)).toBe("https://t.example/5/9/7");
  });
  it("x diputar mengelilingi bumi; y di luar rentang = tidak ada tile", async () => {
    const m = await muat();
    expect(m.isiTemplateTile("{z}/{x}/{y}", 2, -1, 0)).toBe("2/3/0");
    expect(m.isiTemplateTile("{z}/{x}/{y}", 2, 5, 0)).toBe("2/1/0");
    expect(m.isiTemplateTile("{z}/{x}/{y}", 2, 0, -1)).toBeNull();
    expect(m.isiTemplateTile("{z}/{x}/{y}", 2, 0, 4)).toBeNull();
  });
  it("urlTile: peta taktis tidak punya tile; basemap lain menghasilkan URL tanpa sisa tanda kurung", async () => {
    const m = await muat();
    expect(m.urlTile("taktis", 3, 1, 1)).toBeNull();
    for (const b of ["satelit", "osm", "topo"] as const) {
      const u = m.urlTile(b, 3, 1, 1);
      expect(u).toMatch(/^https:\/\//);
      expect(u).not.toMatch(/[{}]/);
    }
  });
  it("tiga penyedia publik bawaan tidak boleh diunduh massal tanpa pernyataan lisensi", async () => {
    const m = await muat();
    for (const b of ["satelit", "osm", "topo"] as const) {
      expect(m.SUMBER_TILE[b].bolehUnduh).toBe(false);
      expect(m.SUMBER_TILE[b].alasanTidakBoleh).toBeTruthy();
    }
  });
  it("perkiraanUkuranMb mengikuti rata-rata KB per tile", async () => {
    const m = await muat();
    expect(m.perkiraanUkuranMb(1024, "osm")).toBeCloseTo(m.SUMBER_TILE.osm.rataKbPerTile, 10);
  });
});

describe("unduhanLayak", () => {
  const dasar = { tersimpan: 0, sudahAda: 0, gagal: 0, tidakAda: 0, byte: 0, dihentikan: false, kuotaPenuh: false, urlBaru: [] };
  it("menolak unduhan dihentikan, kuota penuh, atau tanpa tile sama sekali", async () => {
    const m = await muat();
    expect(m.unduhanLayak({ ...dasar, tersimpan: 50, dihentikan: true }, 100)).toBe(false);
    expect(m.unduhanLayak({ ...dasar, tersimpan: 50, kuotaPenuh: true }, 100)).toBe(false);
    expect(m.unduhanLayak({ ...dasar, tidakAda: 100 }, 100)).toBe(false);
  });
  it("batas galat sungguhan 5%; tile 'tidak ada' (404) tidak dihitung galat", async () => {
    const m = await muat();
    expect(m.unduhanLayak({ ...dasar, tersimpan: 95, gagal: 5 }, 100)).toBe(true);
    expect(m.unduhanLayak({ ...dasar, tersimpan: 94, gagal: 6 }, 100)).toBe(false);
    expect(m.unduhanLayak({ ...dasar, tersimpan: 90, tidakAda: 10 }, 100)).toBe(true);
  });
});

describe("unduhTile dengan Cache API tiruan", () => {
  const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://t.example/1/${i}/0.png`);

  it("menyimpan tile gambar, menghitung byte, lalu mengenali yang sudah ada", async () => {
    const isi = pasangCacheTiruan();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respons(200, "image/png", 250))
    );
    const m = await muat();
    const kemajuan = vi.fn();
    const h = await m.unduhTile(urls(6), { onKemajuan: kemajuan });
    expect(h).toMatchObject({ tersimpan: 6, sudahAda: 0, gagal: 0, tidakAda: 0, byte: 1500, dihentikan: false, kuotaPenuh: false });
    expect(h.urlBaru).toHaveLength(6);
    expect(isi.size).toBe(6);
    expect(kemajuan).toHaveBeenCalledTimes(6);
    expect(kemajuan).toHaveBeenLastCalledWith(6, 6, 0);

    const ulang = await m.unduhTile(urls(6));
    expect(ulang).toMatchObject({ tersimpan: 0, sudahAda: 6, byte: 1500 });
    expect(fetch).toHaveBeenCalledTimes(6); // tidak mengunduh ulang
  });

  it("404/410 = tidak ada (bukan galat); 403/500 dan balasan HTML = gagal; tidak ada yang disimpan", async () => {
    const isi = pasangCacheTiruan();
    const urutan = [respons(404), respons(410), respons(403), respons(500), respons(200, "text/html")];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => urutan[i++ % urutan.length])
    );
    const m = await muat();
    const h = await m.unduhTile(urls(5));
    expect(h.tidakAda).toBe(2);
    expect(h.gagal).toBe(3);
    expect(h.tersimpan).toBe(0);
    expect(isi.size).toBe(0);
  });

  it("galat jaringan dicoba sekali lagi; pulih pada percobaan kedua", async () => {
    pasangCacheTiruan();
    let panggilan = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        panggilan++;
        if (panggilan === 1) throw new TypeError("network");
        return respons(200);
      })
    );
    const m = await muat();
    const h = await m.unduhTile(urls(1));
    expect(h).toMatchObject({ tersimpan: 1, gagal: 0 });
    expect(panggilan).toBe(2);
  });

  it("galat jaringan terus-menerus = gagal setelah dua percobaan", async () => {
    pasangCacheTiruan();
    const f = vi.fn(async () => {
      throw new TypeError("network");
    });
    vi.stubGlobal("fetch", f);
    const m = await muat();
    const h = await m.unduhTile(urls(1));
    expect(h.gagal).toBe(1);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("pembatalan menghentikan unduhan dan menandai dihentikan", async () => {
    pasangCacheTiruan();
    const pengendali = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, opsi: { signal?: AbortSignal }) => {
        pengendali.abort();
        if (opsi.signal?.aborted) throw new DOMException("dibatalkan", "AbortError");
        return respons(200);
      })
    );
    const m = await muat();
    const h = await m.unduhTile(urls(20), { sinyal: pengendali.signal });
    expect(h.dihentikan).toBe(true);
    expect(m.unduhanLayak(h, 20)).toBe(false);
  });

  it("penyimpanan penuh (QuotaExceededError) menghentikan unduhan dan ditandai kuotaPenuh", async () => {
    pasangCacheTiruan(() => new DOMException("penuh", "QuotaExceededError"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respons(200))
    );
    const m = await muat();
    const h = await m.unduhTile(urls(30));
    expect(h.kuotaPenuh).toBe(true);
    expect(h.tersimpan).toBe(0);
    expect(m.unduhanLayak(h, 30)).toBe(false);
  });
});

describe("hapus tile area", () => {
  const area = (id: string, minLng: number, maxLng: number): AreaPetaOffline => ({
    id,
    namaArea: id,
    basemapId: "osm",
    minLat: -1,
    maxLat: -0.9,
    minLng,
    maxLng,
    zoomMin: 14,
    zoomMax: 14,
    jumlahTile: 0,
    ukuranMb: 0,
    diunduhPada: "2026-10-01T00:00:00Z",
    unduhanNyata: true,
    templateTile: "https://t.example/{z}/{x}/{y}.png"
  });

  it("urlTileArea kosong untuk area catatan (bukan unduhan nyata)", async () => {
    const m = await muat();
    expect(m.urlTileArea({ ...area("a", 100.3, 100.4), unduhanNyata: false })).toEqual([]);
    expect(m.urlTileArea({ ...area("a", 100.3, 100.4), templateTile: undefined })).toEqual([]);
  });

  it("tile yang juga dipakai area lain tidak ikut terhapus", async () => {
    const isi = pasangCacheTiruan();
    const m = await muat();
    const a = area("A", 100.3, 100.4);
    const b = area("B", 100.35, 100.45); // beririsan dengan A
    const urlA = m.urlTileArea(a);
    const urlB = m.urlTileArea(b);
    const bersama = urlA.filter((u) => urlB.includes(u));
    expect(bersama.length).toBeGreaterThan(0);
    expect(bersama.length).toBeLessThan(urlA.length);
    [...urlA, ...urlB].forEach((u) => isi.set(u, respons(200)));

    const terhapus = await m.hapusTileArea(a, [a, b]);
    expect(terhapus).toBe(urlA.length - bersama.length);
    bersama.forEach((u) => expect(isi.has(u)).toBe(true));
    urlA.filter((u) => !urlB.includes(u)).forEach((u) => expect(isi.has(u)).toBe(false));
  });

  it("tanpa Cache API: hapusTile aman dan mengembalikan 0", async () => {
    vi.stubGlobal("caches", undefined);
    const m = await muat();
    expect(m.penyimpananTileDidukung()).toBe(false);
    expect(await m.hapusTile(["https://t.example/1/1/1.png"])).toBe(0);
  });
});

describe("sumber peta gratis dan legal (bawaan tanpa konfigurasi)", () => {
  it("satelit bawaan = Sentinel-2 EOX 2016 dengan atribusi terbuka (zoom 13)", async () => {
    const m = await muat();
    const s = m.SUMBER_TILE.satelit;
    expect(s.template).toContain("s2cloudless-2016_3857");
    expect(s.lisensi).toMatch(/CC BY 4.0/);
    expect(s.zoomMaks).toBe(13);
    expect(s.templateCadangan?.length).toBeGreaterThan(0);
  });

  it("setiap sumber punya atribusi yang wajib tampil dan ringkasan lisensi", async () => {
    const m = await muat();
    for (const b of ["satelit", "osm", "topo"] as const) {
      expect(m.SUMBER_TILE[b].atribusi.length).toBeGreaterThan(10);
      expect(m.SUMBER_TILE[b].lisensi.length).toBeGreaterThan(10);
    }
    expect(m.SUMBER_TILE.osm.atribusi).toMatch(/OpenStreetMap/);
    expect(m.SUMBER_TILE.topo.atribusi).toMatch(/OpenTopoMap/);
  });

  it("tanpa kunci API: Satelit Google dan Esri khusus tidak muncul, peta awal Satelit Esri bawaan", async () => {
    vi.stubEnv("VITE_ESRI_API_KEY", "");
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const m = await muat();
    expect(m.basemapTersedia("google")).toBe(false);
    expect(m.basemapTersedia("esri")).toBe(false);
    expect(m.basemapBawaan()).toBe("satelit");
    expect(m.urlTile("google", 10, 1, 2)).toBeNull();
    expect(m.URUTAN_BASEMAP.filter(m.basemapTersedia)).toEqual(["satelit", "topo", "osm", "taktis"]);
    vi.unstubAllEnvs();
  });

  it("kunci API Esri: pilihan Satelit Esri terpisah dengan token, tidak boleh diunduh offline", async () => {
    vi.stubEnv("VITE_ESRI_API_KEY", "kunci-uji");
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const m = await muat();
    expect(m.SUMBER_TILE.esri.template).toMatch(/^https:\/\/ibasemaps-api\.arcgis\.com\/.*token=kunci-uji$/);
    expect(m.SUMBER_TILE.esri.atribusi).toMatch(/Powered by Esri/);
    expect(m.SUMBER_TILE.esri.bolehUnduh).toBe(false);
    expect(m.SUMBER_TILE.satelit.template).toMatch(/eox\.at/);
    expect(m.basemapBawaan()).toBe("esri");
    vi.unstubAllEnvs();
  });

  it("kunci API Google: Satelit Google jadi peta awal, wajib atribusi dinamis, tidak boleh offline atau dijiplak", async () => {
    vi.stubEnv("VITE_ESRI_API_KEY", "kunci-esri");
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "kunci-google");
    const m = await muat();
    const g = m.SUMBER_TILE.google;
    expect(g.tersedia).toBe(true);
    expect(g.template).toBe("https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session={sesi}&key=kunci-google");
    expect(g.atribusiDinamis).toBe(true);
    expect(g.bolehUnduh).toBe(false);
    expect(g.catatanPakai).toMatch(/menjiplak/);
    expect(m.basemapBawaan()).toBe("google");
    vi.unstubAllEnvs();
  });

  it("zoomSumber tidak melebihi zoom maksimum penyedia", async () => {
    const m = await muat();
    expect(m.zoomSumber("satelit", 17)).toBe(13);
    expect(m.zoomSumber("satelit", 22)).toBe(13);
    expect(m.zoomSumber("satelit", 12)).toBe(12);
    expect(m.zoomSumber("osm", 18)).toBe(18);
    expect(m.zoomSumber("taktis", 18)).toBe(18);
  });

  it("templat cadangan dipakai setelah 6 kegagalan beruntun saat online tanpa satu pun berhasil", async () => {
    const m = await muat();
    m.setelUlangTemplatUntukUji();
    const utama = m.templateAktif("satelit");
    for (let i = 0; i < 5; i++) expect(m.laporHasilTile("satelit", false, true)).toBe(false);
    expect(m.laporHasilTile("satelit", false, true)).toBe(true);
    expect(m.templateAktif("satelit")).not.toBe(utama);
    expect(m.urlTile("satelit", 10, 1, 2)).toMatch(/eox\.at\/.*\/g\/10\/2\/1\.jpg$/);
  });

  it("tidak berganti templat saat offline atau bila templat pernah berhasil", async () => {
    const m = await muat();
    m.setelUlangTemplatUntukUji();
    const utama = m.templateAktif("satelit");
    for (let i = 0; i < 10; i++) m.laporHasilTile("satelit", false, false);
    expect(m.templateAktif("satelit")).toBe(utama);
    m.laporHasilTile("satelit", true, true);
    for (let i = 0; i < 10; i++) m.laporHasilTile("satelit", false, true);
    expect(m.templateAktif("satelit")).toBe(utama);
  });
});
