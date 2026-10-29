import { describe, it, expect } from "vitest";
import {
  formatAngkaKoma,
  deteksiJenisPeta,
  deteksiThumbnailPeta,
  ekstrakBatasDariTeks,
  hitungJarakReferensiKm,
  bacaMetadataBerkasPeta
} from "./metaPeta";

describe("metaPeta", () => {
  it("memformat angka dengan koma bahasa Indonesia", () => {
    expect(formatAngkaKoma(12.4)).toBe("12,4");
    expect(formatAngkaKoma(0)).toBe("0");
    expect(formatAngkaKoma(5.67, 1)).toBe("5,7");
  });

  it("mendeteksi jenis peta dari ekstensi berkas", () => {
    expect(deteksiJenisPeta("peta_desa.mbtiles")).toBe("MBTiles / KMZ");
    expect(deteksiJenisPeta("peta_hutan.kmz")).toBe("MBTiles / KMZ");
    expect(deteksiJenisPeta("peta_sungai.geopdf")).toBe("GeoPDF / GeoTIFF");
    expect(deteksiJenisPeta("citra_drone.tif")).toBe("GeoPDF / GeoTIFF");
    expect(deteksiJenisPeta("peta_kerja.pdf")).toBe("GeoPDF / GeoTIFF");
  });

  it("mendeteksi thumbnail berdasarkan jenis berkas", () => {
    expect(deteksiThumbnailPeta("peta.mbtiles")).toBe("vector");
    expect(deteksiThumbnailPeta("peta.geotiff")).toBe("dem_atas");
    expect(deteksiThumbnailPeta("peta.pdf")).toBe("radar");
  });

  it("mengekstrak bounds dari metadata MBTiles teks", () => {
    const contohTeks = `SQLite format 3... INSERT INTO metadata VALUES('bounds','100.12,-1.45,100.85,-0.92');`;
    const batas = ekstrakBatasDariTeks(contohTeks);
    expect(batas).not.toBeNull();
    expect(batas?.minLng).toBe(100.12);
    expect(batas?.minLat).toBe(-1.45);
    expect(batas?.maxLng).toBe(100.85);
    expect(batas?.maxLat).toBe(-0.92);
  });

  it("mengekstrak bounds dari format GeoPDF GPTS", () => {
    const contohGpts = `/GPTS [ -1.50 100.20 -1.20 100.60 ]`;
    const batas = ekstrakBatasDariTeks(contohGpts);
    expect(batas).not.toBeNull();
    expect(batas?.minLat).toBe(-1.5);
    expect(batas?.maxLat).toBe(-1.2);
    expect(batas?.minLng).toBe(100.2);
    expect(batas?.maxLng).toBe(100.6);
  });

  it("menghitung jarak 0 km jika pengguna berada di dalam batas peta", () => {
    const kotak = { minLat: -1.0, maxLat: -0.5, minLng: 100.0, maxLng: 101.0 };
    const pos = { lat: -0.7, lng: 100.5 };
    expect(hitungJarakReferensiKm(pos, kotak)).toBe(0);
  });

  it("menghitung jarak referensi jika pengguna berada di luar batas peta", () => {
    const kotak = { minLat: -1.0, maxLat: -0.9, minLng: 100.0, maxLng: 100.1 };
    const pos = { lat: 0.0, lng: 100.0 };
    const jarak = hitungJarakReferensiKm(pos, kotak);
    expect(jarak).toBeGreaterThan(90); // ~ 100 km
  });

  it("membaca metadata berkas File secara otomatis", async () => {
    const konten = new Uint8Array(1024 * 1024 * 3); // 3 MB
    const file = new File([konten], "Peta_Konservasi_2026.geopdf", { type: "application/pdf" });
    const meta = await bacaMetadataBerkasPeta(file, { lat: -0.945, lng: 100.42 });

    expect(meta.namaArea).toBe("Peta_Konservasi_2026.geopdf");
    expect(meta.ukuranMb).toBe(3);
    expect(meta.ukuranMbTeks).toBe("3");
    expect(meta.jenisFile).toBe("GeoPDF / GeoTIFF");
    expect(meta.jarakKm).toBe(0);
    expect(meta.jarakKmTeks).toBe("0");
  });
});
