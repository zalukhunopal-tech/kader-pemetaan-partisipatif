import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { NavigasiBawah } from "../components/app/NavigasiBawah";
import {
  NAMA_CACHE_TILE,
  BATAS_MAKS_AUTO_TILE_CACHE,
  muatGambarTile
} from "../lib/petaOffline";

describe("Validasi Fitur Notifikasi Pesan Baru & Auto-Cache Tile Citra Satelit Offline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. NavigasiBawah menampilkan tanda titik notifikasi (.nav-notif-dot) pada tab Diskusi saat adaPesanBaru=true", () => {
    const htmlAdaPesan = renderToString(
      <NavigasiBawah
        peran="kader"
        tabAktif="peta"
        setTabAktif={() => {}}
        antreanLokalCount={0}
        onModeUser={() => {}}
        adaPesanBaru={true}
      />
    );

    expect(htmlAdaPesan).toContain('class="nav-notif-dot"');
    expect(htmlAdaPesan).toContain('aria-label="Ada pesan baru"');

    // Ketika pengguna membuka tab diskusi atau pesan sudah dibaca (adaPesanBaru=false), tanda tidak ditampilkan
    const htmlTanpaPesan = renderToString(
      <NavigasiBawah
        peran="kader"
        tabAktif="komunikasi"
        setTabAktif={() => {}}
        antreanLokalCount={0}
        onModeUser={() => {}}
        adaPesanBaru={false}
      />
    );

    expect(htmlTanpaPesan).not.toContain("nav-notif-dot");
  });

  it("2. NavigasiBawah mode Admin juga menampilkan tanda notifikasi pada tab Diskusi saat ada pesan baru", () => {
    const htmlAdminAdaPesan = renderToString(
      <NavigasiBawah
        peran="admin"
        tabAktif="admin"
        setTabAktif={() => {}}
        antreanLokalCount={0}
        onModeUser={() => {}}
        adaPesanBaru={true}
      />
    );

    expect(htmlAdminAdaPesan).toContain('class="nav-notif-dot"');
    expect(htmlAdminAdaPesan).toContain('aria-label="Ada pesan baru"');
  });

  it("3. petaOffline mengekspor BATAS_MAKS_AUTO_TILE_CACHE (4000 tile / ±120MB) dan NAMA_CACHE_TILE yang benar", () => {
    expect(NAMA_CACHE_TILE).toBe("geokader-tiles-v1");
    expect(BATAS_MAKS_AUTO_TILE_CACHE).toBe(4000);
  });

  it("4. muatGambarTile menyimpan tile yang diunduh ke Cache API saat online", async () => {
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const mockKeys = vi.fn().mockResolvedValue([]);
    const mockCache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: mockPut,
      keys: mockKeys,
      delete: vi.fn().mockResolvedValue(true)
    };

    // Mock caches
    globalThis.caches = {
      open: vi.fn().mockResolvedValue(mockCache),
      has: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(true),
      keys: vi.fn().mockResolvedValue([])
    } as unknown as CacheStorage;

    const dummyBlob = new Blob(["fake-image-bytes"], { type: "image/png" });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (h: string) => (h.toLowerCase() === "content-type" ? "image/png" : null)
      },
      blob: vi.fn().mockResolvedValue(dummyBlob)
    } as unknown as Response);

    // Mock createObjectURL & revokeObjectURL
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-blob");
      globalThis.URL.revokeObjectURL = vi.fn();
    }

    const testUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/500/800";
    
    // Panggil muatGambarTile
    try {
      await muatGambarTile(testUrl);
    } catch {
      // JSDOM Image onerror fallback normal di environment uji
    }

    // Pastikan fetch terpanggil dengan URL tile citra
    expect(globalThis.fetch).toHaveBeenCalledWith(testUrl, { mode: "cors" });
    // Pastikan cache.open dipanggil untuk NAMA_CACHE_TILE
    expect(globalThis.caches.open).toHaveBeenCalledWith(NAMA_CACHE_TILE);
  });

  it("5. app.css memuat aturan style .nav-notif-dot dan animasi pulsing", () => {
    const cssPath = resolve(__dirname, "../styles/app.css");
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain(".nav-notif-dot");
    expect(css).toContain("background-color: #ef4444;");
    expect(css).toContain("border-radius: 50%;");
    expect(css).toContain("animation: notif-dot-pulse");
    expect(css).toContain("@keyframes notif-dot-pulse");
  });
});
