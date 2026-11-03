import { describe, expect, it } from "vitest";
import { konversiUTM } from "./geoUtils";
import {
  dariTm3,
  dariUtm,
  formatKoordinat,
  isianDariTitik,
  keTm3,
  keUtm,
  parseIsianManual,
  zonaTm3
} from "./sistemKoordinat";

const SELOR = { lat: 2.857472, lng: 117.377476 };

describe("sistem koordinat", () => {
  it("UTM sama dengan implementasi geoUtils dan bolak-balik presisi milimeter", () => {
    const a = keUtm(SELOR.lat, SELOR.lng)!;
    const b = konversiUTM(SELOR.lat, SELOR.lng)!;
    expect(a.zona).toBe("50N");
    expect(Math.round(a.x)).toBe(b.timur);
    expect(Math.round(a.y)).toBe(b.utara);
    const balik = dariUtm(a.x, a.y, a.zona)!;
    expect(balik.lat).toBeCloseTo(SELOR.lat, 7);
    expect(balik.lng).toBeCloseTo(SELOR.lng, 7);
  });

  it("UTM belahan selatan bolak-balik", () => {
    const h = keUtm(-6.1754, 106.8272)!;
    expect(h.zona).toBe("48S");
    const balik = dariUtm(h.x, h.y, "48S")!;
    expect(balik.lat).toBeCloseTo(-6.1754, 7);
    expect(balik.lng).toBeCloseTo(106.8272, 7);
  });

  it("zona TM-3 Indonesia mengikuti penomoran BPN", () => {
    expect(zonaTm3(117.37)?.kode).toBe("50.2");
    expect(zonaTm3(115.0)?.kode).toBe("50.1");
    expect(zonaTm3(95)?.kode).toBe("46.2");
    expect(zonaTm3(106.8)?.kode).toBe("48.2");
    expect(zonaTm3(140)?.kode).toBe("54.1");
    expect(zonaTm3(80)).toBeNull();
  });

  it("TM-3: titik di bujur tengah memiliki X = 200000 dan bolak-balik presisi", () => {
    const tengah = keTm3(0, 118.5)!;
    expect(tengah.x).toBeCloseTo(200000, 3);
    expect(tengah.y).toBeCloseTo(1500000, 3);
    const h = keTm3(SELOR.lat, SELOR.lng)!;
    const balik = dariTm3(h.x, h.y, h.zona)!;
    expect(balik.lat).toBeCloseTo(SELOR.lat, 7);
    expect(balik.lng).toBeCloseTo(SELOR.lng, 7);
  });

  it("format terstruktur untuk tiap sistem", () => {
    expect(formatKoordinat(SELOR.lat, SELOR.lng, "DD").baris[0].nilai).toBe("2.857472° LU");
    expect(formatKoordinat(SELOR.lat, SELOR.lng, "DMS").baris[0].nilai).toBe("2°51'26.9\" LU");
    expect(formatKoordinat(SELOR.lat, SELOR.lng, "DDM").baris[1].nilai).toBe("117°22.649' BT");
    expect(formatKoordinat(SELOR.lat, SELOR.lng, "UTM").keterangan).toContain("50N");
    expect(formatKoordinat(SELOR.lat, SELOR.lng, "TM3").keterangan).toContain("50.2");
    expect(formatKoordinat(-6.2, 106.8, "DMS").baris[0].nilai).toContain("LS");
    // di luar Indonesia TM-3 kembali ke WGS 84 tanpa galat
    expect(formatKoordinat(48.85, 2.35, "TM3").keterangan).toContain("luar zona");
  });

  it("input manual: DD, UTM, TM-3 dan validasi", () => {
    for (const s of ["DD", "UTM", "TM3"] as const) {
      const isian = isianDariTitik(SELOR.lat, SELOR.lng, s);
      const h = parseIsianManual(isian, s);
      expect("lat" in h).toBe(true);
      if ("lat" in h) {
        expect(h.lat).toBeCloseTo(SELOR.lat, 4);
        expect(h.lng).toBeCloseTo(SELOR.lng, 4);
      }
    }
    expect(parseIsianManual({ a: "95", b: "117", zona: "" }, "DD")).toHaveProperty("galat");
    expect(parseIsianManual({ a: "abc", b: "117", zona: "" }, "DD")).toHaveProperty("galat");
    expect(parseIsianManual({ a: "541000", b: "315000", zona: "99X" }, "UTM")).toHaveProperty("galat");
    expect(parseIsianManual({ a: "2,8575", b: "117,3775", zona: "" }, "DMS")).toMatchObject({ lat: 2.8575, lng: 117.3775 });
  });
});
