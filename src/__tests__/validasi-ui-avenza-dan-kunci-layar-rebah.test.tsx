// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { formatArahKardinal } from "../components/InteractiveMap";
import { kunciOrientasiLayar } from "../lib/posisiPerangkat";

describe("Validasi Desain UI Avenza Maps & Anti Layar Rebah", () => {
  it("1. formatArahKardinal: menghasilkan format derajat dan arah kardinal adaptif (mis. 359° U, 280° B, 270° B sesuai video)", () => {
    expect(formatArahKardinal(0)).toBe("0° U");
    expect(formatArahKardinal(359)).toBe("359° U");
    expect(formatArahKardinal(280)).toBe("280° B");
    expect(formatArahKardinal(270)).toBe("270° B");
    expect(formatArahKardinal(90)).toBe("90° T");
    expect(formatArahKardinal(180)).toBe("180° S");
    expect(formatArahKardinal(45)).toBe("45° TL");
    expect(formatArahKardinal(135)).toBe("135° TG");
    expect(formatArahKardinal(225)).toBe("225° BD");
    expect(formatArahKardinal(315)).toBe("315° BL");
  });

  it("2. kunciOrientasiLayar: memanggil screen.orientation.lock('portrait') dengan aman", () => {
    const lockSpy = vi.fn().mockReturnValue(Promise.resolve());
    const origScreen = window.screen;
    try {
      Object.defineProperty(window, "screen", {
        value: {
          orientation: {
            lock: lockSpy
          }
        },
        configurable: true,
        writable: true
      });

      kunciOrientasiLayar();
      expect(lockSpy).toHaveBeenCalledWith("portrait");
    } finally {
      Object.defineProperty(window, "screen", {
        value: origScreen,
        configurable: true,
        writable: true
      });
    }
  });

  it("3. Konfigurasi PWA & Meta: orientation di-lock ke portrait untuk mencegah layar berputar saat HP direbahkan", () => {
    const viteConfig = fs.readFileSync(path.resolve(__dirname, "../../vite.config.ts"), "utf-8");
    expect(viteConfig).toMatch(/orientation:\s*"portrait"/);

    const indexHtml = fs.readFileSync(path.resolve(__dirname, "../../index.html"), "utf-8");
    expect(indexHtml).toContain('<meta name="screen-orientation" content="portrait" />');
    expect(indexHtml).toContain('<meta name="x5-orientation" content="portrait" />');
  });

  it("4. Komponen & Elemen UI Avenza Maps di InteractiveMap.tsx tersedia lengkap", () => {
    const mapCode = fs.readFileSync(path.resolve(__dirname, "../components/InteractiveMap.tsx"), "utf-8");

    // Reticle bidikan lingkaran target presisi
    expect(mapCode).toContain("avz-reticle-circle");

    // Tombol cepat peta dasar & panah navigasi
    expect(mapCode).toContain("avz-quick-basemap-btn");
    expect(mapCode).toContain("avz-nav-arrow-btn");

    // FAB Pin besar kanan bawah
    expect(mapCode).toContain("avz-fab-pin");

    // Bilah bawah mengambang (ruler, live coords, layers)
    expect(mapCode).toContain("avz-bottom-pill-bar");

    // Popover menu alat 8-fitur
    expect(mapCode).toContain("avz-tool-popup-menu");
    expect(mapCode).toContain("Gambar dan Ukur");
    expect(mapCode).toContain("Rekam Jalur GPS");
    expect(mapCode).toContain("Bernavigasi ke Tujuan");
    expect(mapCode).toContain("Cari Menurut Koordinat");
    expect(mapCode).toContain("Rata-rata Plot GPS");
    expect(mapCode).toContain("Monitor Geofences");
    expect(mapCode).toContain("Lihat di Google Maps");
    expect(mapCode).toContain("Tandai Foto");

    // Bottom sheet salin format koordinat (WGS84, DMS, DDM, UTM, TM-3)
    expect(mapCode).toContain("avz-coord-modal");
    expect(mapCode).toContain("daftarFormatSalin");

    // Drawer GPS 3-tab (Lokasi, Pelacakan, Navigasi)
    expect(mapCode).toContain("avz-gps-drawer");
    expect(mapCode).toContain("avz-compass-rose-svg");
    expect(mapCode).toContain("Arah ke Atas");
    expect(mapCode).toContain("Orientasi peta");

    // Modal informasi peta
    expect(mapCode).toContain("avz-map-info-modal");
  });
});
