import { describe, expect, it } from "vitest";
import { jarakDuaTitik, jepitZoom, langkahZoomRoda, pecahanDiLayar, pusatUntukJangkar, tengahDuaTitik, zoomCubit } from "./zoomPeta";

const W = 400;
const H = 700;

describe("zoom cubit", () => {
  it("jari menjauh memperbesar, mendekat memperkecil (dua kali jarak = satu level)", () => {
    expect(zoomCubit(15, 100, 200)).toBeCloseTo(16, 6);
    expect(zoomCubit(15, 200, 100)).toBeCloseTo(14, 6);
    expect(zoomCubit(15, 100, 100)).toBe(15);
  });

  it("dijepit ke rentang zoom peta dan aman untuk jarak nol", () => {
    expect(zoomCubit(18.5, 50, 400)).toBe(19);
    expect(zoomCubit(11.5, 400, 50)).toBe(11);
    expect(zoomCubit(15, 0, 100)).toBe(15);
    expect(jepitZoom(30)).toBe(19);
  });

  it("titik di bawah jari tetap di bawah jari setelah zoom", () => {
    const pusat = { lat: 2.855823, lng: 117.375968 };
    const jari = { x: 80, y: 520 };
    const jangkar = pecahanDiLayar(pusat, 15, jari, W, H);
    for (const zBaru of [11, 13.3, 16, 18.75]) {
      const pusatBaru = pusatUntukJangkar(jangkar, zBaru, jari, W, H);
      const lagi = pecahanDiLayar(pusatBaru, zBaru, jari, W, H);
      expect(lagi.fx).toBeCloseTo(jangkar.fx, 10);
      expect(lagi.fy).toBeCloseTo(jangkar.fy, 10);
    }
  });

  it("jari di tengah layar tidak menggeser pusat; dua jari yang bergeser ikut menggeser peta", () => {
    const pusat = { lat: -0.9475, lng: 100.4192 };
    const tengah = { x: W / 2, y: H / 2 };
    const p = pusatUntukJangkar(pecahanDiLayar(pusat, 15, tengah, W, H), 17, tengah, W, H);
    expect(p.lat).toBeCloseTo(pusat.lat, 9);
    expect(p.lng).toBeCloseTo(pusat.lng, 9);

    const geser = pusatUntukJangkar(pecahanDiLayar(pusat, 15, tengah, W, H), 15, { x: W / 2 + 256, y: H / 2 }, W, H);
    expect(geser.lng).toBeLessThan(pusat.lng); // jari ke kanan = peta bergeser ke kanan, pusat ke barat
  });

  it("lintang dijepit ±85°", () => {
    const p = pusatUntukJangkar({ fx: 0.5, fy: -0.5 }, 12, { x: W / 2, y: H / 2 }, W, H);
    expect(p.lat).toBe(85);
  });

  it("roda tetikus dan cubit trackpad", () => {
    expect(langkahZoomRoda(-120, 0, false)).toBeCloseTo(0.5, 6); // satu takik ke atas = perbesar setengah level
    expect(langkahZoomRoda(120, 0, false)).toBeCloseTo(-0.5, 6);
    expect(langkahZoomRoda(-10, 0, true)).toBeCloseTo(0.1, 6); // cubit trackpad (ctrlKey)
    expect(langkahZoomRoda(-3, 1, false)).toBeCloseTo(0.2, 6); // mode baris
    expect(langkahZoomRoda(-5000, 0, false)).toBe(1); // dibatasi satu level per event
  });

  it("jarak dan titik tengah dua jari", () => {
    expect(jarakDuaTitik({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(tengahDuaTitik({ x: 0, y: 10 }, { x: 20, y: 30 })).toEqual({ x: 10, y: 20 });
  });
});
