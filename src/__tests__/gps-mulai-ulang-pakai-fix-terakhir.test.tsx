// @vitest-environment jsdom
// @ts-expect-error React act environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Bug: GPS dimulai ulang setiap kembali ke peta dan statusnya dikosongkan. Bila perangkat diam, pemantau
 * baru tidak kunjung menerima fix sehingga tombol "Posisi saya" mati dan titik tidak membawa akurasi.
 * Perbaikan: saat mulai, minta fix terakhir yang masih segar lewat getCurrentPosition (maximumAge 30 detik).
 */
describe("GPS dimulai ulang memakai fix terakhir yang masih segar", () => {
  let akar: Root | null = null;
  afterEach(() => {
    act(() => akar?.unmount());
    akar = null;
    vi.resetModules();
  });

  it("pemantau baru yang belum menerima fix tetap aktif dengan akurasi dari fix terakhir", async () => {
    const getCurrent = vi.fn((sukses: PositionCallback, _g: PositionErrorCallback, opsi?: PositionOptions) => {
      expect(opsi?.maximumAge).toBeGreaterThan(0);
      sukses({
        coords: { latitude: 3.8928, longitude: 115.7312, accuracy: 6, altitude: 812, altitudeAccuracy: null, heading: null, speed: null },
        timestamp: Date.now()
      } as unknown as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      // watchPosition tidak pernah memanggil balik: perangkat diam, tidak ada fix baru
      value: { watchPosition: vi.fn(() => 11), clearWatch: vi.fn(), getCurrentPosition: getCurrent }
    });
    const { usePosisiPerangkat } = await import("../lib/posisiPerangkat");
    let hasil: ReturnType<typeof usePosisiPerangkat> | null = null;
    const Uji = () => {
      hasil = usePosisiPerangkat();
      return null;
    };
    const wadah = document.createElement("div");
    akar = createRoot(wadah);
    act(() => akar!.render(<Uji />));
    expect(getCurrent).toHaveBeenCalled();
    expect(hasil!.statusGps).toBe("aktif");
    expect(hasil!.posisi?.akurasi).toBe(6);
    expect(hasil!.posisi?.elevasi).toBe(812);
  });
});
