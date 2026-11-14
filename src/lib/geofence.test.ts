import { describe, expect, it } from "vitest";
import { AreaPetaOffline } from "../types";
import { buatZonaGeofence, evaluasiGeofence, titikDiDalamBatasArea } from "./geofence";

const PETA_CONTOH: AreaPetaOffline = {
  id: "MAP-01",
  namaArea: "Blok Sungai Kayan Hulu",
  basemapId: "topo",
  minLat: 2.84,
  maxLat: 2.87,
  minLng: 117.36,
  maxLng: 117.4,
  zoomMin: 11,
  zoomMax: 16,
  jumlahTile: 0,
  ukuranMb: 4.5,
  diunduhPada: "2026-11-01T00:00:00Z"
};

describe("geofence", () => {
  it("mengenali titik di dalam dan di luar batas lembar peta", () => {
    expect(titikDiDalamBatasArea({ lat: 2.855, lng: 117.38 }, PETA_CONTOH)).toBe(true);
    expect(titikDiDalamBatasArea({ lat: 2.89, lng: 117.38 }, PETA_CONTOH)).toBe(false);
    expect(titikDiDalamBatasArea({ lat: 2.855, lng: 117.45 }, PETA_CONTOH)).toBe(false);
  });

  it("memprioritaskan peta kustom aktif saat membuat zona geofence", () => {
    const zona = buatZonaGeofence({
      petaKustomAktif: PETA_CONTOH,
      areaOffline: [],
      gpsPos: { lat: 2.855, lng: 117.38 },
      center: { lat: 2.855, lng: 117.38 }
    });
    expect(zona.sumber).toBe("peta");
    expect(zona.id).toBe("MAP-01");
    expect(evaluasiGeofence(zona, { lat: 2.855, lng: 117.38 }).diDalam).toBe(true);
    const luar = evaluasiGeofence(zona, { lat: 2.88, lng: 117.38 });
    expect(luar.diDalam).toBe(false);
    expect(luar.jarakDariTepiMeter).toBeGreaterThan(1000);
  });

  it("memakai radius default 500m saat tidak ada peta offline di posisi acuan", () => {
    const zona = buatZonaGeofence({
      petaKustomAktif: null,
      areaOffline: [],
      gpsPos: { lat: 2.85727, lng: 117.377476 },
      center: { lat: 2.85727, lng: 117.377476 },
      radiusDefaultMeter: 500
    });
    expect(zona.sumber).toBe("radius");
    expect(evaluasiGeofence(zona, { lat: 2.85727, lng: 117.377476 }).diDalam).toBe(true);
    // ~1.4 km keluar dari pusat
    const keluar = evaluasiGeofence(zona, { lat: 2.868, lng: 117.39 });
    expect(keluar.diDalam).toBe(false);
    expect(keluar.jarakPusatMeter).toBeGreaterThan(500);
  });
});
