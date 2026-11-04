import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import {
  bacaReferensiGeoPdf,
  validasiKontrolGeoPdf,
  selesaikanAffine2D,
  definisiEpsg,
  namaCrs,
  diDalamBatas,
  kalibrasiManualDuaTitik,
  buatTransformasi,
  pasangPolyfillPdfJs,
  imporGeoPdf
} from "./geoPdf";

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
    expect(ref.empatSudut!.length).toBe(4);
    expect(ref.formatGeoref).toBe("iso32000");
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
    expect(ref.empatSudut!.length).toBe(4);
    expect(ref.metodeTransformasi).toBe("afin-proyeksi");
  });

  it("mendukung format OGC TerraGo /LGIDict dengan matriks /CTM dan /Neatline", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]); // Halaman sampul tanpa georeferensi
    const petaPage = doc.addPage([500, 500]); // Halaman kedua berisi peta LGIDict
    petaPage.node.set(
      PDFName.of("LGIDict"),
      doc.context.obj({
        Type: "LGIDict",
        Version: "2.1",
        Description: "Peta Kehutanan TerraGo",
        Neatline: [0, 0, 500, 0, 500, 500, 0, 500],
        CTM: [10, 0, 0, 10, 541000, 315000],
        Projection: {
          ProjectionType: "UT",
          Zone: 50,
          Hemisphere: "N"
        }
      })
    );
    const ref = await bacaReferensiGeoPdf(await doc.save());
    expect(ref.formatGeoref).toBe("ogc-lgi");
    expect(ref.indeksHalaman).toBe(1);
    expect(ref.crs).toBe("EPSG:32650");
    expect(ref.minLng).toBeGreaterThan(117);
    expect(ref.minLat).toBeGreaterThan(2);
  });

  it("mendukung sistem koordinat nasional DGN95 / Indonesia TM-3 (EPSG:23830 s.d. EPSG:23845)", () => {
    expect(definisiEpsg(23837)).toBe("EPSG:23837");
    expect(namaCrs("EPSG:23837")).toContain("DGN95 / Indonesia TM-3");
  });

  it("mendukung kalibrasi manual 2 titik dan uji poligon diDalamBatas", () => {
    const georef = kalibrasiManualDuaTitik(600, 800, { lat: 2.9, lon: 117.3 }, { lat: 2.8, lon: 117.4 });
    const tx = buatTransformasi(georef.utama);
    expect(tx).not.toBeNull();
    const tengah = tx!.pdfKeGeo(300, 400);
    expect(tengah?.lat).toBeCloseTo(2.85, 4);
    expect(tengah?.lon).toBeCloseTo(117.35, 4);

    const batas = [
      { lat: 2.8, lon: 117.3 },
      { lat: 2.8, lon: 117.4 },
      { lat: 2.9, lon: 117.4 },
      { lat: 2.9, lon: 117.3 }
    ];
    expect(diDalamBatas({ lat: 2.85, lon: 117.35 }, batas)).toBe(true);
    expect(diDalamBatas({ lat: 3.1, lon: 117.35 }, batas)).toBe(false);
  });

  it("menolak PDF biasa tanpa mengarang lokasi", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    await expect(bacaReferensiGeoPdf(await doc.save())).rejects.toThrow(/viewport/);
  });

  it("menghitung transformasi Affine 2D untuk peta miring/rotasi", () => {
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
  it("memasang polyfill Map.getOrInsertComputed & WeakMap.getOrInsertComputed untuk WebView HP / PWA seluler", async () => {
    const mapProto = Map.prototype as unknown as Record<string, unknown>;
    const weakMapProto = WeakMap.prototype as unknown as Record<string, unknown>;
    delete mapProto.getOrInsertComputed;
    delete mapProto.getOrInsert;
    delete weakMapProto.getOrInsertComputed;
    delete weakMapProto.getOrInsert;

    pasangPolyfillPdfJs();

    const m = new Map<string, number[]>();
    const arr = (m as unknown as { getOrInsertComputed: (k: string, fn: () => number[]) => number[] }).getOrInsertComputed(
      "kunci",
      () => [1, 2]
    );
    arr.push(3);
    expect(m.get("kunci")).toEqual([1, 2, 3]);

    const wm = new WeakMap<object, { ok: boolean }>();
    const obj = {};
    const v = (
      wm as unknown as { getOrInsertComputed: (k: object, fn: () => { ok: boolean }) => { ok: boolean } }
    ).getOrInsertComputed(obj, () => ({ ok: true }));
    expect(v.ok).toBe(true);
    expect(wm.get(obj)).toEqual({ ok: true });

    // Pastikan imporGeoPdf berhasil meskipun di lingkungan tanpa Canvas 2D / Web Worker penuh
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
    const bytes = await doc.save();
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
    const hasil = await imporGeoPdf(blob);
    expect(hasil.minLat).toBe(-7);
    expect(hasil.maxLat).toBe(-6);
    expect(hasil.minLng).toBe(110);
    expect(hasil.maxLng).toBe(111);
    expect(hasil.dataUrl).toBeTruthy();
  });
});
