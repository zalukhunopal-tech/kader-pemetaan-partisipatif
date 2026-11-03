import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFString } from "pdf-lib";
import proj4 from "proj4";

const nums = (a: PDFArray) => Array.from({ length: a.size() }, (_, i) => a.lookup(i, PDFNumber).asNumber());

/**
 * Daftarkan proyeksi koordinat ke proj4 bila belum tersedia di defs bawaan.
 * Mendukung EPSG umum Indonesia: UTM Zone 46N-54N, 46S-54S, DGN95, SRGI2013, Web Mercator, WGS84.
 */
export function daftarkanCrsProj4(kodeOrWkt: string | number): string {
  if (typeof kodeOrWkt === "number") {
    const epsgNum = kodeOrWkt;
    const defKey = `EPSG:${epsgNum}`;
    if (proj4.defs(defKey)) return defKey;

    if (epsgNum >= 32601 && epsgNum <= 32660) {
      // UTM Zone North
      const zone = epsgNum - 32600;
      proj4.defs(defKey, `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`);
    } else if (epsgNum >= 32701 && epsgNum <= 32760) {
      // UTM Zone South
      const zone = epsgNum - 32700;
      proj4.defs(defKey, `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`);
    } else if (epsgNum === 4755) {
      // DGN95 Geografis
      proj4.defs(defKey, `+proj=longlat +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +no_defs`);
    } else if (epsgNum === 9489) {
      // SRGI2013 Geografis
      proj4.defs(defKey, `+proj=longlat +ellps=GRS80 +no_defs`);
    } else if (epsgNum === 3857) {
      proj4.defs(defKey, `+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs`);
    } else if (epsgNum === 4326) {
      proj4.defs(defKey, `+proj=longlat +datum=WGS84 +no_defs`);
    }
    return defKey;
  }

  const str = kodeOrWkt.trim();
  if (str.toUpperCase().startsWith("EPSG:")) {
    const num = parseInt(str.split(":")[1], 10);
    if (!isNaN(num)) return daftarkanCrsProj4(num);
  }

  // Jika berupa WKT (Well-Known Text)
  if (str.includes("PROJCS") || str.includes("GEOGCS")) {
    const customKey = `CUSTOM_WKT_${Math.abs(hashString(str))}`;
    if (!proj4.defs(customKey)) {
      proj4.defs(customKey, str);
    }
    return customKey;
  }

  return "EPSG:4326";
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export interface ReferensiGeoPdf {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  pusatLat: number;
  pusatLng: number;
  bbox: number[];
  crs: string;
  crsDeskripsi: string;
  empatSudut: [number, number][]; // [[nwLng, nwLat], [neLng, neLat], [seLng, seLat], [swLng, swLat]]
  rotasiDerajat?: number;
}

/**
 * Menyelesaikan transformasi Affine 2D menggunakan metode Least-Squares
 * dari koordinat lembar PDF / normalized LPTS (u, v) ke koordinat geografis WGS84 (lng, lat).
 * Menghasilkan model transformasi untuk sudut miring/rotasi secara presisi.
 */
export function selesaikanAffine2D(
  pts: { u: number; v: number; x: number; y: number }[]
): {
  keGeo: (u: number, v: number) => [number, number];
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
} {
  const N = pts.length;
  if (N < 3) {
    throw new Error("Dibutuhkan minimal 3 pasangan titik kontrol untuk affine transformation.");
  }

  // Normal Equation: (M^T M) * params = M^T * Targets
  let sumU2 = 0,
    sumUV = 0,
    sumU = 0,
    sumV2 = 0,
    sumV = 0;
  let sumUX = 0,
    sumVX = 0,
    sumX = 0;
  let sumUY = 0,
    sumVY = 0,
    sumY = 0;

  for (const p of pts) {
    sumU2 += p.u * p.u;
    sumUV += p.u * p.v;
    sumU += p.u;
    sumV2 += p.v * p.v;
    sumV += p.v;

    sumUX += p.u * p.x;
    sumVX += p.v * p.x;
    sumX += p.x;

    sumUY += p.u * p.y;
    sumVY += p.v * p.y;
    sumY += p.y;
  }

  // Inversi matriks 3x3 simetris [ [sumU2, sumUV, sumU], [sumUV, sumV2, sumV], [sumU, sumV, N] ]
  const det =
    sumU2 * (sumV2 * N - sumV * sumV) -
    sumUV * (sumUV * N - sumU * sumV) +
    sumU * (sumUV * sumV - sumU * sumV2);

  if (Math.abs(det) < 1e-12) {
    // Fallback interpolasi linear aksis-terjajar bila determinan kolinear
    const minU = Math.min(...pts.map((p) => p.u));
    const maxU = Math.max(...pts.map((p) => p.u));
    const minV = Math.min(...pts.map((p) => p.v));
    const maxV = Math.max(...pts.map((p) => p.v));
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));

    const du = maxU - minU || 1;
    const dv = maxV - minV || 1;
    const a = (maxX - minX) / du;
    const c = minX - a * minU;
    const e = (maxY - minY) / dv;
    const f = minY - e * minV;

    return {
      keGeo: (u, v) => [a * u + c, e * v + f],
      a,
      b: 0,
      c,
      d: 0,
      e,
      f
    };
  }

  const inv00 = (sumV2 * N - sumV * sumV) / det;
  const inv01 = (sumU * sumV - sumUV * N) / det;
  const inv02 = (sumUV * sumV - sumU * sumV2) / det;

  const inv10 = inv01;
  const inv11 = (sumU2 * N - sumU * sumU) / det;
  const inv12 = (sumU * sumUV - sumU2 * sumV) / det;

  const inv20 = inv02;
  const inv21 = inv12;
  const inv22 = (sumU2 * sumV2 - sumUV * sumUV) / det;

  // Parameter lng: x = a*u + b*v + c
  const a = inv00 * sumUX + inv01 * sumVX + inv02 * sumX;
  const b = inv10 * sumUX + inv11 * sumVX + inv12 * sumX;
  const c = inv20 * sumUX + inv21 * sumVX + inv22 * sumX;

  // Parameter lat: y = d*u + e*v + f
  const d = inv00 * sumUY + inv01 * sumVY + inv02 * sumY;
  const e = inv10 * sumUY + inv11 * sumVY + inv12 * sumY;
  const f = inv20 * sumUY + inv21 * sumVY + inv22 * sumY;

  return {
    keGeo: (u: number, v: number) => [a * u + b * v + c, d * u + e * v + f],
    a,
    b,
    c,
    d,
    e,
    f
  };
}

/**
 * ISO 32000 & TerraGo GeoPDF Reader dengan dukungan multi-CRS dan rotasi/kemiringan penuh.
 */
export async function bacaReferensiGeoPdf(bytes: Uint8Array): Promise<ReferensiGeoPdf> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const rotasi = page.getRotation().angle || 0;

  // 1. Coba baca ISO 32000 Viewport GEO (/VP)
  const viewports = page.node.lookupMaybe(PDFName.of("VP"), PDFArray);
  if (viewports && viewports.size() >= 1) {
    for (let vpIdx = 0; vpIdx < viewports.size(); vpIdx++) {
      const vp = viewports.lookup(vpIdx, PDFDict);
      const measure = vp.lookupMaybe(PDFName.of("Measure"), PDFDict);
      if (!measure) continue;

      const subtype = measure.lookupMaybe(PDFName.of("Subtype"), PDFName)?.asString();
      if (subtype !== "/GEO") continue;

      // Ekstraksi CRS / Proyeksi
      let crsKey = "EPSG:4326";
      let crsNama = "EPSG:4326 (WGS 84)";

      const gcs = measure.lookupMaybe(PDFName.of("GCS"), PDFDict);
      const projcs = measure.lookupMaybe(PDFName.of("PROJCS"), PDFDict);
      const wktStr = measure.lookupMaybe(PDFName.of("WKT"), PDFString)?.asString();

      if (wktStr) {
        crsKey = daftarkanCrsProj4(wktStr);
        crsNama = `GeoPDF WKT (${crsKey})`;
      } else if (projcs) {
        const epsg = projcs.lookupMaybe(PDFName.of("EPSG"), PDFNumber)?.asNumber();
        if (epsg) {
          crsKey = daftarkanCrsProj4(epsg);
          crsNama = `EPSG:${epsg}`;
        }
      } else if (gcs) {
        const epsg = gcs.lookupMaybe(PDFName.of("EPSG"), PDFNumber)?.asNumber();
        if (epsg) {
          crsKey = daftarkanCrsProj4(epsg);
          crsNama = `EPSG:${epsg}`;
        }
      }

      const gptsArr = measure.lookupMaybe(PDFName.of("GPTS"), PDFArray);
      const lptsArr = measure.lookupMaybe(PDFName.of("LPTS"), PDFArray);

      if (!gptsArr || !lptsArr) continue;
      const gpts = nums(gptsArr);
      const lpts = nums(lptsArr);

      if (gpts.length < 6 || lpts.length < 6 || gpts.length !== lpts.length) {
        throw new Error("GeoPDF memerlukan pasangan titik kontrol yang valid (minimal 3 pasang).");
      }

      const bboxRaw = vp.lookupMaybe(PDFName.of("BBox"), PDFArray);
      const bbox = bboxRaw ? nums(bboxRaw) : [0, 0, page.getWidth(), page.getHeight()];

      return prosesKontrolGeoPdf(gpts, lpts, bbox, crsKey, crsNama, rotasi);
    }
  }

  // 2. Coba baca format TerraGo OGC (/LGIDict)
  const lgiDict = page.node.lookupMaybe(PDFName.of("LGIDict"), PDFDict);
  if (lgiDict) {
    // TerraGo structure: /Registration dictionary/array
    const reg = lgiDict.lookupMaybe(PDFName.of("Registration"), PDFArray);
    if (reg && reg.size() >= 4) {
      // Pasangan titik registrasi TerraGo
      const gpts: number[] = [];
      const lpts: number[] = [];
      for (let i = 0; i < reg.size(); i++) {
        const pair = reg.lookupMaybe(i, PDFArray);
        if (pair && pair.size() >= 4) {
          lpts.push(pair.lookup(0, PDFNumber).asNumber(), pair.lookup(1, PDFNumber).asNumber());
          gpts.push(pair.lookup(2, PDFNumber).asNumber(), pair.lookup(3, PDFNumber).asNumber());
        }
      }
      if (gpts.length >= 6) {
        const bbox = [0, 0, page.getWidth(), page.getHeight()];
        return prosesKontrolGeoPdf(gpts, lpts, bbox, "EPSG:4326", "TerraGo GeoPDF (EPSG:4326)", rotasi);
      }
    }
  }

  throw new Error("GeoPDF harus memiliki viewport GEO atau metadata georeferensi yang valid. Gunakan kalibrasi manual jika ini dokumen PDF cetak biasa.");
}

/**
 * Menghitung koordinat quad 4-sudut (empatSudut) dan bounding box geografis WGS84
 * dari pasangan GPTS dan LPTS dengan transformasi Affine 2D Least-Squares.
 */
function prosesKontrolGeoPdf(
  gpts: number[],
  lpts: number[],
  bbox: number[],
  crsKey: string,
  crsNama: string,
  rotasiDerajat = 0
): ReferensiGeoPdf {
  const pasanganTitik: { u: number; v: number; x: number; y: number }[] = [];
  const jumlahTitik = gpts.length / 2;

  // Standar ISO 32000 GEO: GPTS = [lat0, lng0, lat1, lng1, ...] atau [y0, x0, y1, x1, ...]
  // LPTS = [u0, v0, u1, v1, ...] dalam rentang 0-1 (normalized) atau koordinat titik BBox
  for (let i = 0; i < jumlahTitik; i++) {
    const rawY = gpts[2 * i];
    const rawX = gpts[2 * i + 1];
    const u = lpts[2 * i];
    const v = lpts[2 * i + 1];

    if (!Number.isFinite(rawY) || !Number.isFinite(rawX) || !Number.isFinite(u) || !Number.isFinite(v)) {
      throw new Error("Pasangan koordinat GeoPDF memuat nilai non-numerik (NaN/Infinity).");
    }

    // Proyeksikan dari CRS asal ke WGS84 (lng, lat)
    let lng = rawX;
    let lat = rawY;

    if (crsKey !== "EPSG:4326") {
      try {
        const out = proj4(crsKey, "EPSG:4326", [rawX, rawY]);
        lng = out[0];
        lat = out[1];
      } catch {
        // Coba periksa apakah koordinat dibalik (yaitu rawY adalah easting/x dan rawX adalah northing/y)
        try {
          const out = proj4(crsKey, "EPSG:4326", [rawY, rawX]);
          lng = out[0];
          lat = out[1];
        } catch {
          lng = rawX;
          lat = rawY;
        }
      }
    } else {
      // Jika EPSG:4326, validasi apakah rawY = lat (-90 s/d 90) dan rawX = lng (-180 s/d 180)
      if (Math.abs(rawY) > 90 && Math.abs(rawX) <= 90) {
        lat = rawX;
        lng = rawY;
      }
    }

    pasanganTitik.push({ u, v, x: lng, y: lat });
  }

  // Hitung model affine Least-Squares
  const model = selesaikanAffine2D(pasanganTitik);

  // Evaluasi 4 sudut lembar viewport:
  // NW (0, 1), NE (1, 1), SE (1, 0), SW (0, 0)
  const nw = model.keGeo(0, 1);
  const ne = model.keGeo(1, 1);
  const se = model.keGeo(1, 0);
  const sw = model.keGeo(0, 0);

  const empatSudut: [number, number][] = [
    [Number(nw[0].toFixed(6)), Number(nw[1].toFixed(6))],
    [Number(ne[0].toFixed(6)), Number(ne[1].toFixed(6))],
    [Number(se[0].toFixed(6)), Number(se[1].toFixed(6))],
    [Number(sw[0].toFixed(6)), Number(sw[1].toFixed(6))]
  ];

  const semuaLng = [nw[0], ne[0], se[0], sw[0]];
  const semuaLat = [nw[1], ne[1], se[1], sw[1]];

  const minLng = Number(Math.min(...semuaLng).toFixed(6));
  const maxLng = Number(Math.max(...semuaLng).toFixed(6));
  const minLat = Number(Math.min(...semuaLat).toFixed(6));
  const maxLat = Number(Math.max(...semuaLat).toFixed(6));

  if (minLat < -85 || maxLat > 85 || minLng < -180 || maxLng > 180 || minLat >= maxLat || minLng >= maxLng) {
    throw new Error("Batas koordinat GeoPDF di luar batas bumi atau tidak konsisten.");
  }

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    pusatLat: Number(((minLat + maxLat) / 2).toFixed(6)),
    pusatLng: Number(((minLng + maxLng) / 2).toFixed(6)),
    bbox,
    crs: crsKey,
    crsDeskripsi: crsNama,
    empatSudut,
    rotasiDerajat
  };
}

/**
 * Validasi titik kontrol untuk kompatibilitas fungsi validator sebelumnya.
 */
export function validasiKontrolGeoPdf(gpts: number[], lpts: number[], strict = false) {
  if (gpts.length !== 8 || lpts.length !== 8 || ![...gpts, ...lpts].every(Number.isFinite)) {
    throw new Error("GeoPDF memerlukan empat pasangan titik kontrol yang valid.");
  }
  const lat = gpts.filter((_, i) => i % 2 === 0);
  const lng = gpts.filter((_, i) => i % 2 === 1);
  const minLat = Math.min(...lat);
  const maxLat = Math.max(...lat);
  const minLng = Math.min(...lng);
  const maxLng = Math.max(...lng);

  if (minLat < -85 || maxLat > 85 || minLng < -180 || maxLng > 180 || minLat >= maxLat || minLng >= maxLng || maxLng - minLng > 180) {
    throw new Error("Batas koordinat GeoPDF tidak valid atau melewati antimeridian.");
  }

  if (strict) {
    for (let i = 0; i < 4; i++) {
      const u = lpts[2 * i];
      const v = lpts[2 * i + 1];
      if (
        ![0, 1].includes(u) ||
        ![0, 1].includes(v) ||
        Math.abs(lng[i] - (minLng + u * (maxLng - minLng))) > 1e-6 ||
        Math.abs(lat[i] - (minLat + v * (maxLat - minLat))) > 1e-6
      ) {
        throw new Error("GeoPDF miring/terdistorsi belum didukung dalam mode strict.");
      }
    }
  }

  // Pastikan titik kontrol tidak degenerate
  const unik = new Set(gpts.map((v, i) => (i % 2 === 0 ? `${v},${gpts[i + 1]}` : null)).filter(Boolean));
  if (unik.size < 3) {
    throw new Error("Titik kontrol GeoPDF berulang atau kurang dari 3 titik unik.");
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Impor berkas GeoPDF dengan rendering resolusi tinggi tanpa blur base64,
 * menghasilkan Blob URL terkelola dan metadata spasial 4-sudut (Avenza Maps standard).
 */
export async function imporGeoPdf(file: File) {
  if (file.size > 100 * 1024 * 1024) {
    throw new Error("GeoPDF maksimum 100 MB. Potong lembar besar di GIS sebelum impor.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ref = await bacaReferensiGeoPdf(bytes);

  // Render halaman pertama PDF menggunakan PDF.js
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;

  const task = getDocument({ data: bytes.slice() });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });

    // Resolusi tinggi: batasi sisi terpanjang 4096 px agar tajam tanpa blur
    const scale = Math.min(3, 4096 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Kanvas tidak tersedia di peramban ini.");

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;

    let finalCanvas = canvas;

    // Jika memiliki BBox spesifik yang lebih kecil dari ukuran halaman, potong ke viewport
    if (ref.bbox && ref.bbox.length === 4 && ref.bbox.every(Number.isFinite)) {
      const r = [
        ...viewport.convertToViewportPoint(ref.bbox[0], ref.bbox[1]),
        ...viewport.convertToViewportPoint(ref.bbox[2], ref.bbox[3])
      ];
      const x = Math.min(r[0], r[2]);
      const y = Math.min(r[1], r[3]);
      const w = Math.abs(r[2] - r[0]);
      const h = Math.abs(r[3] - r[1]);

      if (w >= 10 && h >= 10 && x >= -2 && y >= -2 && x + w <= canvas.width + 2 && y + h <= canvas.height + 2) {
        const crop = document.createElement("canvas");
        crop.width = Math.ceil(w);
        crop.height = Math.ceil(h);
        crop.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, crop.width, crop.height);
        finalCanvas = crop;
      }
    }

    // Buat Blob PNG dan URL Blob objek
    const blob = await new Promise<Blob>((resolve, reject) => {
      finalCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat Blob peta."))), "image/png");
    });

    const blobUrl = URL.createObjectURL(blob);

    return {
      ...ref,
      dataUrl: blobUrl, // Blob URL yang hemat memori
      blobUrl,
      width: finalCanvas.width,
      height: finalCanvas.height
    };
  } finally {
    await task.destroy();
  }
}
