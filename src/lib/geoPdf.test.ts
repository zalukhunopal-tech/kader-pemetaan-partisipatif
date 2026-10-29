import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { bacaReferensiGeoPdf, validasiKontrolGeoPdf } from "./geoPdf";

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
    expect(ref).toEqual({ minLat: -7, maxLat: -6, minLng: 110, maxLng: 111, bbox: [50, 100, 550, 700] });
  });
  it("menolak PDF biasa tanpa mengarang lokasi", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    await expect(bacaReferensiGeoPdf(await doc.save())).rejects.toThrow(/viewport/);
  });
  it("menolak sudut miring dan kontrol berulang", () => {
    expect(() => validasiKontrolGeoPdf([-7, 110.1, ...gpts.slice(2)], lpts)).toThrow(/miring/);
    expect(() => validasiKontrolGeoPdf(Array(8).fill(0), lpts)).toThrow();
  });
  it("menolak nilai tidak valid dan koordinat di luar bumi", () => {
    expect(() => validasiKontrolGeoPdf([NaN, ...gpts.slice(1)], lpts)).toThrow();
    expect(() => validasiKontrolGeoPdf([-95, ...gpts.slice(1)], lpts)).toThrow();
  });
});
