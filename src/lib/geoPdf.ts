import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber } from "pdf-lib";

const nums = (a: PDFArray) => Array.from({ length: a.size() }, (_, i) => a.lookup(i, PDFNumber).asNumber());

/** ISO 32000 GEO viewport. Reject ambiguous/rotated/non-WGS84 sheets rather than inventing coordinates. */
export async function bacaReferensiGeoPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  if (page.getRotation().angle !== 0) throw new Error("Rotasi halaman PDF harus 0°. Ekspor ulang sebagai north-up.");
  const viewports = page.node.lookupMaybe(PDFName.of("VP"), PDFArray);
  if (!viewports || viewports.size() !== 1)
    throw new Error("GeoPDF harus memiliki satu viewport GEO pada halaman pertama. PDF biasa/multi-viewport perlu dikonversi di GIS.");
  const vp = viewports.lookup(0, PDFDict);
  const measure = vp.lookup(PDFName.of("Measure"), PDFDict);
  if (measure.lookup(PDFName.of("Subtype"), PDFName).asString() !== "/GEO") throw new Error("Viewport PDF bukan geospasial GEO.");
  const gcs = measure.lookup(PDFName.of("GCS"), PDFDict);
  const epsg = gcs.lookupMaybe(PDFName.of("EPSG"), PDFNumber)?.asNumber();
  if (epsg !== 4326) throw new Error("Saat ini GeoPDF harus menggunakan GCS EPSG:4326 (WGS84). Ekspor ulang melalui QGIS untuk CRS lain.");
  const gpts = nums(measure.lookup(PDFName.of("GPTS"), PDFArray));
  const lpts = nums(measure.lookup(PDFName.of("LPTS"), PDFArray));
  return { ...validasiKontrolGeoPdf(gpts, lpts), bbox: nums(vp.lookup(PDFName.of("BBox"), PDFArray)) };
}

export function validasiKontrolGeoPdf(gpts: number[], lpts: number[]) {
  if (gpts.length !== 8 || lpts.length !== 8 || ![...gpts, ...lpts].every(Number.isFinite))
    throw new Error("GeoPDF memerlukan empat pasangan titik kontrol yang valid.");
  const lat = gpts.filter((_, i) => i % 2 === 0),
    lng = gpts.filter((_, i) => i % 2 === 1);
  const minLat = Math.min(...lat),
    maxLat = Math.max(...lat),
    minLng = Math.min(...lng),
    maxLng = Math.max(...lng);
  if (minLat < -85 || maxLat > 85 || minLng < -180 || maxLng > 180 || minLat >= maxLat || minLng >= maxLng || maxLng - minLng > 180)
    throw new Error("Batas koordinat GeoPDF tidak valid atau melewati antimeridian.");
  const corners = new Set<string>();
  for (let i = 0; i < 4; i++) {
    const u = lpts[2 * i],
      v = lpts[2 * i + 1];
    corners.add(`${u},${v}`);
    if (
      ![0, 1].includes(u) ||
      ![0, 1].includes(v) ||
      Math.abs(lng[i] - (minLng + u * (maxLng - minLng))) > 1e-6 ||
      Math.abs(lat[i] - (minLat + v * (maxLat - minLat))) > 1e-6
    )
      throw new Error("GeoPDF miring/terdistorsi belum didukung. Ekspor lembar north-up dengan kontrol sudut penuh di GIS.");
  }
  if (corners.size !== 4) throw new Error("Titik kontrol GeoPDF berulang.");
  return { minLat, maxLat, minLng, maxLng };
}

export async function imporGeoPdf(file: File) {
  if (file.size > 80 * 1024 * 1024) throw new Error("GeoPDF maksimum 80 MB. Potong lembar besar di GIS sebelum impor.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ref = await bacaReferensiGeoPdf(bytes);
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
  const task = getDocument({ data: bytes.slice() });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, 4096 / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Kanvas tidak tersedia.");
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    if (ref.bbox.length !== 4 || !ref.bbox.every(Number.isFinite)) throw new Error("BBox GeoPDF tidak valid.");
    const r = [...viewport.convertToViewportPoint(ref.bbox[0], ref.bbox[1]), ...viewport.convertToViewportPoint(ref.bbox[2], ref.bbox[3])];
    const x = Math.min(r[0], r[2]),
      y = Math.min(r[1], r[3]),
      w = Math.abs(r[2] - r[0]),
      h = Math.abs(r[3] - r[1]);
    if (x < -1 || y < -1 || x + w > canvas.width + 1 || y + h > canvas.height + 1 || w < 1 || h < 1)
      throw new Error("Viewport GEO berada di luar halaman.");
    const crop = document.createElement("canvas");
    crop.width = Math.ceil(w);
    crop.height = Math.ceil(h);
    crop.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, crop.width, crop.height);
    return { ...ref, dataUrl: crop.toDataURL("image/png"), width: crop.width, height: crop.height };
  } finally {
    await task.destroy();
  }
}
