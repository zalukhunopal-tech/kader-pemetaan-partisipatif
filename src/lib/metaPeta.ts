import { AreaPetaOffline } from "../types";
import { hitungJarakMeter } from "./geoUtils";
import { parseGeoTiffBuffer, HasilDeteksiGeoTiff } from "./geoTiffParser";
import { parseMBTilesBuffer, HasilDeteksiMBTiles } from "./mbtilesParser";
import { bacaPosisiPeta, POSISI_AWAL_PETA } from "./posisiPeta";

export interface HasilMetadataPeta {
  namaArea: string;
  ukuranMb: number;
  ukuranMbTeks: string;
  jarakKm: number;
  jarakKmTeks: string;
  jenisFile: AreaPetaOffline["jenisFile"];
  thumbnailType: AreaPetaOffline["thumbnailType"];
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  crs?: string;
  crsDeskripsi?: string;
  pusatLat?: number;
  pusatLng?: number;
  rentangLat?: number;
  rentangLng?: number;
  lebarPixel?: number;
  tinggiPixel?: number;
  resolusiMeter?: number;
  sumberDeteksi: "geotiff" | "mbtiles" | "geopdf" | "teks" | "bawaan";
}

/** Format angka MB atau km dengan tanda koma (gaya bahasa Indonesia) */
export function formatAngkaKoma(nilai: number, digit = 1): string {
  return Number(nilai.toFixed(digit)).toString().replace(".", ",");
}

/** Deteksi format file peta berdasarkan ekstensi berkas */
export function deteksiJenisPeta(namaBerkas: string): "GeoPDF / GeoTIFF" | "MBTiles / KMZ" {
  if (/\.mbtiles$/i.test(namaBerkas) || /\.kmz$/i.test(namaBerkas)) {
    return "MBTiles / KMZ";
  }
  return "GeoPDF / GeoTIFF";
}

/** Tentukan tipe thumbnail visual kartu peta */
export function deteksiThumbnailPeta(namaBerkas: string): "vector" | "dem_atas" | "radar" | "geopdf_sheet" {
  if (/\.mbtiles$/i.test(namaBerkas)) return "vector";
  if (/\.(tif|tiff|geotiff)$/i.test(namaBerkas)) return "dem_atas";
  if (/\.geopdf$/i.test(namaBerkas) || /geopdf/i.test(namaBerkas) || /kawasan_hutan/i.test(namaBerkas)) return "geopdf_sheet";
  return "radar";
}

/**
 * Cari batas koordinat spasial (minLat, maxLat, minLng, maxLng) dan CRS dari cuplikan teks berkas.
 * Mendukung format string bounds MBTiles (west,south,east,north) dan GeoPDF / GPTS.
 */
export function ekstrakBatasDariTeks(teks: string): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  crs?: string;
} | null {
  // Pola 1: MBTiles metadata "bounds", "-104.5,-1.2,100.5,1.5"
  const polaBounds = /bounds['"]?\s*[,:]\s*['"]?(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i;
  const matchBounds = teks.match(polaBounds);
  if (matchBounds) {
    const w = parseFloat(matchBounds[1]);
    const s = parseFloat(matchBounds[2]);
    const e = parseFloat(matchBounds[3]);
    const n = parseFloat(matchBounds[4]);
    if (w >= -180 && e <= 180 && s >= -90 && n <= 90 && w <= e && s <= n) {
      return {
        minLng: w,
        maxLng: e,
        minLat: s,
        maxLat: n,
        crs: "EPSG:3857 / EPSG:4326 (WGS 84)"
      };
    }
  }

  // Pola 2: GeoPDF /GPTS [lat1 lng1 lat2 lng2 ...]
  const polaGpts = /\/GPTS\s*\[\s*([-\d\s.]+)\s*\]/i;
  const matchGpts = teks.match(polaGpts);
  if (matchGpts) {
    const angka = matchGpts[1]
      .trim()
      .split(/\s+/)
      .map(parseFloat)
      .filter((v) => !isNaN(v));
    if (angka.length >= 4) {
      const lats: number[] = [];
      const lngs: number[] = [];
      for (let i = 0; i < angka.length - 1; i += 2) {
        const lat = angka[i];
        const lng = angka[i + 1];
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          lats.push(lat);
          lngs.push(lng);
        }
      }
      if (lats.length >= 2 && lngs.length >= 2) {
        // Cek juga apakah ada indikasi CRS GeoPDF
        let crsGeoPdf = "WGS 84 (GeoPDF ISO 32000-2 / OGC)";
        if (/UTM\s*Zone\s*(\d+[NS]?)/i.test(teks)) {
          const zMatch = teks.match(/UTM\s*Zone\s*(\d+[NS]?)/i);
          crsGeoPdf = `WGS 84 / UTM Zone ${zMatch ? zMatch[1] : "50N"}`;
        }
        return {
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
          minLng: Math.min(...lngs),
          maxLng: Math.max(...lngs),
          crs: crsGeoPdf
        };
      }
    }
  }

  return null;
}

/**
 * Menghitung jarak referensi (dalam km) dari posisi pengguna atau acuan GPS ke area peta.
 * Jika pengguna berada di dalam area batas peta, jaraknya adalah 0 km.
 */
export function hitungJarakReferensiKm(
  posisiAcuan: { lat: number; lng: number } | null | undefined,
  kotak: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): number {
  if (!posisiAcuan) return 0;
  const diDalam =
    posisiAcuan.lat >= kotak.minLat &&
    posisiAcuan.lat <= kotak.maxLat &&
    posisiAcuan.lng >= kotak.minLng &&
    posisiAcuan.lng <= kotak.maxLng;

  if (diDalam) return 0;

  const pusat = {
    lat: (kotak.minLat + kotak.maxLat) / 2,
    lng: (kotak.minLng + kotak.maxLng) / 2
  };
  const jarakMeter = hitungJarakMeter(posisiAcuan, pusat);
  return Number((jarakMeter / 1000).toFixed(1));
}

/**
 * Membaca berkas peta dari perangkat (GeoTIFF, MBTiles, GeoPDF) dan melakukan:
 * 1. Deteksi otomatis Sistem Koordinat Referensi (CRS)
 * 2. Perhitungan otomatis batas koordinat spasial (Bounding Box: minLat, maxLat, minLng, maxLng)
 * 3. Ekstraksi ukuran file (MB), resolusi (meter/pixel), dan jarak acuan GPS pengguna
 */
export async function bacaMetadataBerkasPeta(
  file: File,
  posisiAcuan?: { lat: number; lng: number } | null
): Promise<HasilMetadataPeta> {
  const ukuranMb = Math.max(0.1, Number((file.size / (1024 * 1024)).toFixed(1)));
  const ukuranMbTeks = formatAngkaKoma(ukuranMb, 1);
  const jenisFile = deteksiJenisPeta(file.name);
  const thumbnailType = deteksiThumbnailPeta(file.name);

  // Posisi acuan dasar jika tidak disediakan: posisi tersimpan peta atau lokasi default
  const posisiRef = posisiAcuan || (typeof window !== "undefined" ? bacaPosisiPeta() : null) || POSISI_AWAL_PETA;

  let minLat: number | null = null;
  let maxLat: number | null = null;
  let minLng: number | null = null;
  let maxLng: number | null = null;
  let pusatLat: number | undefined = undefined;
  let pusatLng: number | undefined = undefined;
  let crs: string | undefined = undefined;
  let crsDeskripsi: string | undefined = undefined;
  let lebarPixel: number | undefined = undefined;
  let tinggiPixel: number | undefined = undefined;
  let resolusiMeter: number | undefined = undefined;
  let sumberDeteksi: HasilMetadataPeta["sumberDeteksi"] = "bawaan";

  const namaKecil = file.name.toLowerCase();
  const maxBacaBiner = Math.min(file.size, 1024 * 1024); // Maks 1 MB untuk deteksi metadata spasial

  // 1. Uji parsing biner GeoTIFF jika ekstensi tif/geotiff atau nama berkas relevan
  const isTiffCandidate = /\.(tif|tiff|geotiff)$/i.test(namaKecil);
  if (isTiffCandidate || file.size > 16) {
    try {
      const potongan = file.slice(0, maxBacaBiner);
      const buffer = await potongan.arrayBuffer();
      const deteksiTiff: HasilDeteksiGeoTiff | null = parseGeoTiffBuffer(buffer);
      if (deteksiTiff) {
        minLat = deteksiTiff.minLat;
        maxLat = deteksiTiff.maxLat;
        minLng = deteksiTiff.minLng;
        maxLng = deteksiTiff.maxLng;
        pusatLat = deteksiTiff.pusatLat;
        pusatLng = deteksiTiff.pusatLng;
        crs = deteksiTiff.crs;
        crsDeskripsi = deteksiTiff.crsDeskripsi;
        lebarPixel = deteksiTiff.lebarPixel;
        tinggiPixel = deteksiTiff.tinggiPixel;
        resolusiMeter = deteksiTiff.resolusiMeter;
        sumberDeteksi = "geotiff";
      }
    } catch {
      // Lanjut ke metode berikutnya jika buffer TIFF tidak valid
    }
  }

  // 2. Uji parsing biner MBTiles jika ekstensi mbtiles atau basis data SQLite
  if (!crs && (/\.mbtiles$/i.test(namaKecil) || file.size > 100)) {
    try {
      const potongan = file.slice(0, maxBacaBiner);
      const buffer = await potongan.arrayBuffer();
      const deteksiMb: HasilDeteksiMBTiles | null = parseMBTilesBuffer(buffer);
      if (deteksiMb) {
        minLat = deteksiMb.minLat;
        maxLat = deteksiMb.maxLat;
        minLng = deteksiMb.minLng;
        maxLng = deteksiMb.maxLng;
        pusatLat = deteksiMb.pusatLat;
        pusatLng = deteksiMb.pusatLng;
        crs = deteksiMb.crs;
        crsDeskripsi = deteksiMb.crsDeskripsi;
        sumberDeteksi = "mbtiles";
      }
    } catch {
      // Lanjut jika bukan format MBTiles SQLite
    }
  }

  // 3. Uji deteksi teks (GeoPDF / GPTS atau metadata teks)
  if (!crs || minLat === null) {
    try {
      const potongan = file.slice(0, Math.min(file.size, 262144));
      const teksCuplikan = await potongan.text();
      const hasilTeks = ekstrakBatasDariTeks(teksCuplikan);
      if (hasilTeks) {
        minLat = hasilTeks.minLat;
        maxLat = hasilTeks.maxLat;
        minLng = hasilTeks.minLng;
        maxLng = hasilTeks.maxLng;
        crs = hasilTeks.crs || "WGS 84 (GeoPDF)";
        crsDeskripsi = "Georeferensi Dokumen PDF Spasial (OGC GeoPDF)";
        sumberDeteksi = "geopdf";
      }
    } catch {
      // Abaikan jika berkas biner tidak dapat di-parse sebagai teks
    }
  }

  // 4. Fallback nama berkas Tanjung Selor / Bulungan
  if (minLat === null && /tanjung_selor|bulungan/i.test(file.name)) {
    minLat = 2.65;
    maxLat = 3.05;
    minLng = 117.15;
    maxLng = 117.65;
    crs = "EPSG:32650 (WGS 84 / UTM Zone 50N)";
    crsDeskripsi = "Wilayah Tugas Tanjung Selor, Bulungan (Zona UTM 50 Utara)";
    sumberDeteksi = "bawaan";
  }

  // 5. Fallback ke radius posisi acuan jika sama sekali tidak ada georeferensi di berkas
  if (minLat === null || maxLat === null || minLng === null || maxLng === null) {
    minLat = Number((posisiRef.lat - 0.02).toFixed(4));
    maxLat = Number((posisiRef.lat + 0.02).toFixed(4));
    minLng = Number((posisiRef.lng - 0.02).toFixed(4));
    maxLng = Number((posisiRef.lng + 0.02).toFixed(4));
    if (!crs) {
      crs = "EPSG:4326 (WGS 84)";
      crsDeskripsi = "Koordinat Acuan Lapangan (WGS 84)";
    }
    sumberDeteksi = "bawaan";
  }

  if (pusatLat === undefined || pusatLng === undefined) {
    pusatLat = Number(((minLat + maxLat) / 2).toFixed(7));
    pusatLng = Number(((minLng + maxLng) / 2).toFixed(7));
  }

  const kotakBatas = { minLat, maxLat, minLng, maxLng };
  const jarakKm = hitungJarakReferensiKm(posisiRef, kotakBatas);
  const jarakKmTeks = formatAngkaKoma(jarakKm, 1);
  const rentangLat = Number(Math.abs(maxLat - minLat).toFixed(4));
  const rentangLng = Number(Math.abs(maxLng - minLng).toFixed(4));

  return {
    namaArea: file.name,
    ukuranMb,
    ukuranMbTeks,
    jarakKm,
    jarakKmTeks,
    jenisFile,
    thumbnailType,
    minLat,
    maxLat,
    minLng,
    maxLng,
    pusatLat,
    pusatLng,
    rentangLat,
    rentangLng,
    crs,
    crsDeskripsi,
    lebarPixel,
    tinggiPixel,
    resolusiMeter,
    sumberDeteksi
  };
}
