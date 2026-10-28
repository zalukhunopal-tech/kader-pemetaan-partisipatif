// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ModulGoogle = typeof import("./googleTiles");

async function muat(): Promise<ModulGoogle> {
  vi.resetModules();
  const m = await import("./googleTiles");
  m.setelUlangGoogleUntukUji();
  return m;
}

const balasan = (status: number, isi: unknown) =>
  new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "kunci-google-123456");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sesi Map Tiles API Google", () => {
  it("membuat sesi satelit berbahasa Indonesia dengan POST resmi, lalu token dipakai ulang", async () => {
    const m = await muat();
    const ambil = vi.fn(async () => balasan(200, { session: "TOKEN-A", expiry: "4102444800", tileWidth: 256 }));
    await m.buatSesiGoogle(ambil as unknown as typeof fetch, 1_700_000_000_000);
    const [url, opsi] = ambil.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://tile.googleapis.com/v1/createSession?key=kunci-google-123456");
    expect(opsi.method).toBe("POST");
    expect(JSON.parse(String(opsi.body))).toEqual({ mapType: "satellite", language: "id-ID", region: "ID" });
    expect(m.tokenSesiGoogle(1_700_000_000_000)).toBe("TOKEN-A");
    expect(m.statusGoogle()).toEqual({ siap: true, galat: null });
  });

  it("token tersimpan dipakai lagi setelah aplikasi dibuka ulang, kecuali sudah hampir kedaluwarsa", async () => {
    const m = await muat();
    await m.buatSesiGoogle((async () => balasan(200, { session: "TOKEN-B", expiry: "2000000000" })) as unknown as typeof fetch);
    vi.resetModules(); // seperti aplikasi dibuka ulang: memori kosong, localStorage tetap
    const segar = await import("./googleTiles");
    expect(segar.tokenSesiGoogle(1_900_000_000_000)).toBe("TOKEN-B");
    // lima menit sebelum kedaluwarsa dianggap habis
    vi.stubGlobal("fetch", vi.fn(async () => balasan(200, { session: "TOKEN-C", expiry: "2100000000" })));
    expect(segar.tokenSesiGoogle(2_000_000_000_000 - 60_000)).toBeNull();
  });

  it("galat API diterjemahkan menjadi pesan yang bisa ditindaklanjuti", async () => {
    const m = await muat();
    await m.buatSesiGoogle((async () =>
      balasan(400, { error: { code: 400, message: "API key not valid. Please pass a valid API key." } })) as unknown as typeof fetch);
    expect(m.statusGoogle()).toEqual({ siap: false, galat: "Kunci API Google tidak valid." });
    expect(m.pesanGalatGoogle(403, { error: { message: "This API method requires billing to be enabled." } })).toMatch(/penagihan/);
    expect(m.pesanGalatGoogle(403, null)).toMatch(/belum diaktifkan/);
    expect(m.pesanGalatGoogle(429, null)).toMatch(/Kuota/);
  });

  it("tanpa kunci API tidak ada permintaan ke Google", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const m = await muat();
    const ambil = vi.fn();
    vi.stubGlobal("fetch", ambil);
    expect(m.tokenSesiGoogle()).toBeNull();
    await m.buatSesiGoogle(ambil as unknown as typeof fetch);
    expect(ambil).not.toHaveBeenCalled();
  });

  it("hak cipta diambil dari endpoint viewport untuk area yang tampil", async () => {
    const m = await muat();
    await m.buatSesiGoogle((async () => balasan(200, { session: "TOKEN-D", expiry: "4102444800" })) as unknown as typeof fetch);
    const ambil = vi.fn(async () => balasan(200, { copyright: "Imagery ©2026 Airbus, CNES / Airbus, Maxar Technologies" }));
    const teks = await m.ambilAtribusiGoogle({ utara: 2.9, selatan: 2.8, timur: 117.4, barat: 117.3 }, 15.4, ambil as unknown as typeof fetch);
    expect(teks).toBe("Imagery ©2026 Airbus, CNES / Airbus, Maxar Technologies");
    const url = new URL((ambil.mock.calls[0] as unknown as [string])[0]);
    expect(url.origin + url.pathname).toBe("https://tile.googleapis.com/tile/v1/viewport");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      session: "TOKEN-D",
      key: "kunci-google-123456",
      zoom: "15",
      north: "2.900000",
      south: "2.800000",
      east: "117.400000",
      west: "117.300000"
    });
  });
});
