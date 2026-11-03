import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { bacaReferensiGeoPdf, validasiKontrolGeoPdf, selesaikanAffine2D } from "./geoPdf";

const gpts = [-7, 110, -6, 110, -6, 111, -7, 111];
const lpts = [0, 0, 0, 1, 1, 1, 1, 0];

describe("GeoPDF GEO", () => {
  it("membaca viewport di object stream PDF (bukan pencarian teks mentah)", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    page.node.set(
      PDFName.of("VP"),
      doc.context.obj([
        {
          Type: "Viewport",
          BBox: [50, 100, 550, 700],
          Measure: { Type: "Measure", Subtype: "GEO", GCS: { Type: "GEOGCS", EPSG: 4326 }, GPTS: gpts, LPTS: lpts }
        }
      ])
    );
    const ref = await bacaReferensiGeoPdf(await doc.save({ useObjectStreams: true }));
    expect(ref).toMatchObject({ minLat: -7, maxLat: -6, minLng: 110, maxLng: 111, bbox: [50, 100, 550, 700] });
    expect(ref.empatSudut).toBeDefined();
    expect(ref.empatSudut.length).toBe(4);
  });

  it("mendukung GeoPDF dengan proyeksi UTM Zone (EPSG:32650 Kalimantan Utara)", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    // Koordinat UTM Zone 50N untuk Tanjung Selor (sekitar X: 541000, Y: 315000)
    const utmGpts = [315000, 541000, 320000, 541000, 320000, 546000, 315000, 546000];
    page.node.set(
      PDFName.of("VP"),
      doc.context.obj([
        {
          Type: "Viewport",
          BBox: [0, 0, 600, 800],
          Measure: {
            Type: "Measure",
            Subtype: "GEO",
            PROJCS: { Type: "PROJCS", EPSG: 32650 },
            GPTS: utmGpts,
            LPTS: lpts
          }
        }
      ])
    );
    const ref = await bacaReferensiGeoPdf(await doc.save({ useObjectStreams: true }));
    expect(ref.crs).toBe("EPSG:32650");
    expect(ref.minLng).toBeGreaterThan(117);
    expect(ref.maxLng).toBeLessThan(118);
    expect(ref.minLat).toBeGreaterThan(2);
    expect(ref.maxLat).toBeLessThan(3.5);
    expect(ref.empatSudut.length).toBe(4);
  });

  it("menolak PDF biasa tanpa mengarang lokasi", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    await expect(bacaReferensiGeoPdf(await doc.save())).rejects.toThrow(/viewport/);
  });

  it("menghitung transformasi Affine 2D untuk peta miring/rotasi", () => {
    // 4 titik kontrol dengan rotasi 45 derajat
    const pts = [
      { u: 0, v: 0, x: 100, y: -1 },
      { u: 0, v: 1, x: 100.5, y: -0.5 },
      { u: 1, v: 1, x: 101, y: -1 },
      { u: 1, v: 0, x: 100.5, y: -1.5 }
    ];
    const affine = selesaikanAffine2D(pts);
    const center = affine.keGeo(0.5, 0.5);
    expect(center[0]).toBeCloseTo(100.5, 2);
    expect(center[1]).toBeCloseTo(-1.0, 2);
  });

  it("menolak kontrol berulang (degenerate) dan koordinat di luar bumi", () => {
    expect(() => validasiKontrolGeoPdf(Array(8).fill(0), lpts)).toThrow();
    expect(() => validasiKontrolGeoPdf([NaN, ...gpts.slice(1)], lpts)).toThrow();
    expect(() => validasiKontrolGeoPdf([-95, ...gpts.slice(1)], lpts)).toThrow();
  });
});
