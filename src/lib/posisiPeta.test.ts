// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { bacaPosisiPeta, KUNCI_POSISI_PETA, simpanPosisiPeta } from "./posisiPeta";

beforeEach(() => localStorage.clear());

describe("posisi peta terakhir", () => {
  it("belum pernah disimpan: null (peta memakai GPS pertama atau posisi awal)", () => {
    expect(bacaPosisiPeta()).toBeNull();
  });

  it("disimpan lalu dibaca kembali apa adanya (6 desimal)", () => {
    simpanPosisiPeta({ lat: -1.123456789, lng: 101.987654321, zoom: 17, basemap: "osm" });
    expect(bacaPosisiPeta()).toEqual({ lat: -1.123457, lng: 101.987654, zoom: 17, basemap: "osm" });
  });

  it("zoom dijepit ke rentang peta dan basemap tak dikenal kembali ke satelit", () => {
    localStorage.setItem(KUNCI_POSISI_PETA, JSON.stringify({ lat: -1, lng: 100, zoom: 25, basemap: "google" }));
    expect(bacaPosisiPeta()).toEqual({ lat: -1, lng: 100, zoom: 19, basemap: "satelit" });
    localStorage.setItem(KUNCI_POSISI_PETA, JSON.stringify({ lat: -1, lng: 100, zoom: 2, basemap: "topo" }));
    expect(bacaPosisiPeta()?.zoom).toBe(11);
  });

  it("isi rusak atau di luar rentang diabaikan", () => {
    for (const isi of ["{rusak", JSON.stringify({ lat: 95, lng: 100, zoom: 15 }), JSON.stringify({ lat: "x", lng: 1, zoom: 1 }), JSON.stringify({ lat: 1, lng: 200, zoom: 15 })]) {
      localStorage.setItem(KUNCI_POSISI_PETA, isi);
      expect(bacaPosisiPeta()).toBeNull();
    }
  });
});
