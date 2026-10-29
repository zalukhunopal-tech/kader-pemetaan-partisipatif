import { AreaPetaOffline } from "../types";
import { hitungJarakMeter } from "./geoUtils";
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
 * Cari batas koordinat spasial (minLat, maxLat, minLng, maxLng) dari cuplikan teks header berkas.
 * Mendukung format string bounds MBTiles (west,south,east,north) dan GeoPDF / GPTS.
 */
export function ekstrakBatasDariTeks(teks: string): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  // Pola 1: MBTiles metadata "bounds", "-104.5,-1.2,100.5,1.5"
  const polaBounds = /bounds['"]?\s*[,:]\s*['"]?(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i;
  const matchBounds = teks.match(polaBounds);
  if (matchBounds) {
    const w = parseFloat(matchBounds[1]);
    const s = parseFloat(matchBounds[2]);
    const e = parseFloat(matchBounds[3]);
    const n = parseFloat(matchBounds[4]);
    if (w >= -180 && e <= 180 && s >= -90 && n <= 90 && w <= e && s <= n) {
      return { minLng: w, maxLng: e, minLat: s, maxLat: n };
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
        return {
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
          minLng: Math.min(...lngs),
          maxLng: Math.max(...lngs)
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
 * Membaca berkas peta dari perangkat (GeoPDF, GeoTIFF, MBTiles) dan menghasilkan metadata lengkap:
 * - Ukuran file (MB)
 * - Jarak referensi (km)
 * - Tipe file & thumbnail
 * - Estimasi koordinat batas wilayah (bounding box)
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

  // Baca sampel header berkas (maks 256 KB) untuk mendeteksi metadata koordinat
  let batas: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null = null;
  try {
    const potongan = file.slice(0, Math.min(file.size, 262144));
    const teksCuplikan = await potongan.text();
    batas = ekstrakBatasDariTeks(teksCuplikan);
  } catch {
    // Abaikan jika berkas biner tidak dapat di-parse sebagai teks
  }

  // Jika nama berkas merujuk pada wilayah Tanjung Selor / Bulungan, gunakan koordinat definitif
  if (!batas && /tanjung_selor|bulungan/i.test(file.name)) {
    batas = { minLat: 2.65, maxLat: 3.05, minLng: 117.15, maxLng: 117.65 };
  }

  // Jika batas tidak ditemukan di header, gunakan wilayah di sekitar posisi acuan
  if (!batas) {
    batas = {
      minLat: Number((posisiRef.lat - 0.02).toFixed(4)),
      maxLat: Number((posisiRef.lat + 0.02).toFixed(4)),
      minLng: Number((posisiRef.lng - 0.02).toFixed(4)),
      maxLng: Number((posisiRef.lng + 0.02).toFixed(4))
    };
  }

  const jarakKm = hitungJarakReferensiKm(posisiRef, batas);
  const jarakKmTeks = formatAngkaKoma(jarakKm, 1);

  return {
    namaArea: file.name,
    ukuranMb,
    ukuranMbTeks,
    jarakKm,
    jarakKmTeks,
    jenisFile,
    thumbnailType,
    minLat: batas.minLat,
    maxLat: batas.maxLat,
    minLng: batas.minLng,
    maxLng: batas.maxLng
  };
}
