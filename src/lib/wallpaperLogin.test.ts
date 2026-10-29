import { describe, it, expect } from "vitest";
import { DAFTAR_WALLPAPER_LOGIN, hitungIndeksHari, dapatkanUrlWallpaperHarian } from "./wallpaperLogin";

describe("wallpaperLogin", () => {
  it("memiliki 21 data wallpaper lengkap dari folder Google Drive", () => {
    expect(DAFTAR_WALLPAPER_LOGIN).toHaveLength(21);
    for (let i = 0; i < 21; i++) {
      expect(DAFTAR_WALLPAPER_LOGIN[i].nomor).toBe(i + 1);
      expect(DAFTAR_WALLPAPER_LOGIN[i].nama).toBe(`${i + 1}.jpg`);
      expect(DAFTAR_WALLPAPER_LOGIN[i].driveId).toMatch(/^1[a-zA-Z0-9_-]{32}$/);
    }
  });

  it("menghitung indeks hari yang valid dalam rentang 0..20", () => {
    const d1 = new Date(2026, 0, 1);
    const d2 = new Date(2026, 0, 2);
    const d3 = new Date(2026, 5, 15);
    expect(hitungIndeksHari(d1)).toBeGreaterThanOrEqual(0);
    expect(hitungIndeksHari(d1)).toBeLessThan(21);
    expect(hitungIndeksHari(d2)).toBe((hitungIndeksHari(d1) + 1) % 21);
    expect(hitungIndeksHari(d3)).toBeGreaterThanOrEqual(0);
    expect(hitungIndeksHari(d3)).toBeLessThan(21);
  });

  it("menghasilkan URL CDN Google lh3 dengan lebar yang ditentukan", () => {
    const url = dapatkanUrlWallpaperHarian(new Date(2026, 0, 1), 600);
    expect(url).toMatch(/^https:\/\/lh3\.googleusercontent\.com\/d\/1[a-zA-Z0-9_-]{32}=w600$/);
  });
});
