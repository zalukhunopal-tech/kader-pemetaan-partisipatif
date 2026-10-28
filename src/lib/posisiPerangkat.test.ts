import { describe, expect, it } from "vitest";
import { JARAK_BIDIKAN_DEKAT_M, kompasDariOrientasi, selisihArah, titikDariBidikan } from "./posisiPerangkat";
import { KoordinatTitik } from "../types";

describe("kompasDariOrientasi", () => {
  it("perangkat datar: alpha 0 menghadap utara; alpha bertambah berlawanan jarum jam (W3C)", () => {
    expect(kompasDariOrientasi(0, 0, 0)).toBeCloseTo(0, 5);
    expect(kompasDariOrientasi(90, 0, 0)).toBeCloseTo(270, 5); // tepi atas menghadap barat
    expect(kompasDariOrientasi(180, 0, 0)).toBeCloseTo(180, 5);
    expect(kompasDariOrientasi(270, 0, 0)).toBeCloseTo(90, 5);
  });

  it("perangkat tegak (kamera belakang): alpha 0 menghadap utara, alpha 90 barat", () => {
    expect(kompasDariOrientasi(0, 90, 0)).toBeCloseTo(0, 5);
    expect(kompasDariOrientasi(90, 90, 0)).toBeCloseTo(270, 5);
    expect(kompasDariOrientasi(180, 90, 0)).toBeCloseTo(180, 5);
  });

  it("hasil selalu dalam rentang 0..360", () => {
    for (let a = 0; a < 360; a += 17) {
      for (const [b, g] of [[0, 0], [90, 0], [45, 10], [80, -20]]) {
        const h = kompasDariOrientasi(a, b, g);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      }
    }
  });
});

describe("selisihArah", () => {
  it("bertanda: positif = target di kanan, negatif = di kiri", () => {
    expect(selisihArah(90, 0)).toBe(90);
    expect(selisihArah(0, 90)).toBe(-90);
    expect(selisihArah(45, 45)).toBe(0);
  });
  it("mengambil jalur terpendek melewati utara", () => {
    expect(selisihArah(10, 350)).toBe(20);
    expect(selisihArah(350, 10)).toBe(-20);
    expect(selisihArah(1, 359)).toBe(2);
    expect(selisihArah(359, 1)).toBe(-2);
  });
  it("selalu dalam -180..180", () => {
    for (let t = 0; t < 360; t += 23) {
      for (let p = 0; p < 360; p += 31) {
        const s = selisihArah(t, p);
        expect(s).toBeGreaterThanOrEqual(-180);
        expect(s).toBeLessThan(180 + 1e-9);
      }
    }
  });
});

describe("titikDariBidikan (T1)", () => {
  const SEKARANG = Date.parse("2026-10-28T08:00:00Z");
  const fix = (over: Partial<KoordinatTitik> = {}): KoordinatTitik => ({
    lat: -0.9,
    lng: 100.4,
    akurasi: 8,
    elevasi: 312,
    timestamp: new Date(SEKARANG - 5000).toISOString(),
    ...over
  });

  it("tanpa fix GPS: hanya koordinat (6 desimal) dan waktu, tanpa akurasi/elevasi karangan", () => {
    const t = titikDariBidikan({ lat: -0.9123456789, lng: 100.4123456789 }, null, SEKARANG);
    expect(t).toEqual({ lat: -0.912346, lng: 100.412346, timestamp: new Date(SEKARANG).toISOString() });
  });

  it("bidikan tepat di posisi GPS: akurasi dan elevasi dari GPS ikut", () => {
    const t = titikDariBidikan({ lat: -0.9, lng: 100.4 }, fix(), SEKARANG);
    expect(t.akurasi).toBe(8);
    expect(t.elevasi).toBe(312);
  });

  it("fix tanpa elevasi: elevasi tetap kosong", () => {
    const t = titikDariBidikan({ lat: -0.9, lng: 100.4 }, fix({ elevasi: undefined }), SEKARANG);
    expect(t.akurasi).toBe(8);
    expect("elevasi" in t).toBe(false);
  });

  it("bidikan jauh dari posisi GPS: nilai GPS tidak dibawa", () => {
    const jauh = { lat: -0.9 + 0.0005, lng: 100.4 }; // ±55 m
    const t = titikDariBidikan(jauh, fix(), SEKARANG);
    expect(t.akurasi).toBeUndefined();
    expect(t.elevasi).toBeUndefined();
  });

  it("jarak kecil lebih besar dari akurasi GPS: akurasi dinaikkan sebesar jarak", () => {
    const sepuluhMeter = { lat: -0.9 + 0.00009, lng: 100.4 }; // ±10 m
    const t = titikDariBidikan(sepuluhMeter, fix({ akurasi: 3 }), SEKARANG);
    expect(JARAK_BIDIKAN_DEKAT_M).toBeGreaterThan(10);
    expect(t.akurasi).toBeGreaterThan(9.5);
    expect(t.akurasi).toBeLessThan(10.5);
  });

  it("fix usang (lebih dari 60 detik) tidak dipakai", () => {
    const usang = fix({ timestamp: new Date(SEKARANG - 61_000).toISOString() });
    expect(titikDariBidikan({ lat: -0.9, lng: 100.4 }, usang, SEKARANG).akurasi).toBeUndefined();
  });

  it("fix tanpa waktu atau tanpa akurasi tidak dipakai", () => {
    expect(titikDariBidikan({ lat: -0.9, lng: 100.4 }, fix({ timestamp: undefined }), SEKARANG).akurasi).toBeUndefined();
    expect(titikDariBidikan({ lat: -0.9, lng: 100.4 }, fix({ akurasi: undefined }), SEKARANG).akurasi).toBeUndefined();
  });
});
