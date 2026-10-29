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

  it("mendeteksi CRS dan menghitung bounding box otomatis saat berkas GeoTIFF diunggah", async () => {
    // Siapkan buffer GeoTIFF Little Endian (WGS 84 / UTM Zone 50N)
    const buf = new ArrayBuffer(512);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);
    u8[0] = 0x49;
    u8[1] = 0x49;
    view.setUint16(2, 42, true);
    view.setUint32(4, 8, true);
    view.setUint16(8, 5, true); // 5 tags

    let off = 10;
    // ImageWidth 1000
    view.setUint16(off, 256, true);
    view.setUint16(off + 2, 3, true);
    view.setUint32(off + 4, 1, true);
    view.setUint16(off + 8, 1000, true);

    // ImageLength 800
    off += 12;
    view.setUint16(off, 257, true);
    view.setUint16(off + 2, 3, true);
    view.setUint32(off + 4, 1, true);
    view.setUint16(off + 8, 800, true);

    // ModelPixelScaleTag (10 m/px)
    off += 12;
    view.setUint16(off, 33550, true);
    view.setUint16(off + 2, 12, true);
    view.setUint32(off + 4, 3, true);
    view.setUint32(off + 8, 200, true);
    view.setFloat64(200, 10.0, true);
    view.setFloat64(208, 10.0, true);
    view.setFloat64(216, 0.0, true);

    // ModelTiepointTag (Easting 540000, Northing 320000)
    off += 12;
    view.setUint16(off, 33922, true);
    view.setUint16(off + 2, 12, true);
    view.setUint32(off + 4, 6, true);
    view.setUint32(off + 8, 230, true);
    view.setFloat64(230, 0, true);
    view.setFloat64(238, 0, true);
    view.setFloat64(246, 0, true);
    view.setFloat64(254, 540000.0, true);
    view.setFloat64(262, 320000.0, true);
    view.setFloat64(270, 0, true);

    // GeoKeyDirectoryTag (EPSG:32650)
    off += 12;
    view.setUint16(off, 34735, true);
    view.setUint16(off + 2, 3, true);
    view.setUint32(off + 4, 8, true);
    view.setUint32(off + 8, 300, true);
    view.setUint16(300, 1, true);
    view.setUint16(302, 1, true);
    view.setUint16(304, 0, true);
    view.setUint16(306, 1, true);
    view.setUint16(308, 3072, true);
    view.setUint16(310, 0, true);
    view.setUint16(312, 1, true);
    view.setUint16(314, 32650, true);

    const file = new File([buf], "citra_satelit_tanjung_selor.tif", { type: "image/tiff" });
    const meta = await bacaMetadataBerkasPeta(file, { lat: 2.85, lng: 117.37 });

    expect(meta.sumberDeteksi).toBe("geotiff");
    expect(meta.crs).toContain("EPSG:32650");
    expect(meta.crs).toContain("UTM Zone 50N");
    expect(meta.minLat).toBeGreaterThan(2.7);
    expect(meta.maxLat).toBeLessThan(3.0);
    expect(meta.minLng).toBeGreaterThan(117.2);
    expect(meta.maxLng).toBeLessThan(117.6);
  });

  it("mendeteksi CRS dan menghitung bounding box otomatis saat berkas MBTiles diunggah", async () => {
    const buf = new ArrayBuffer(1024);
    const u8 = new Uint8Array(buf);
    const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
    for (let i = 0; i < magic.length; i++) u8[i] = magic[i];

    const teksMetadata = "INSERT INTO metadata VALUES('bounds','117.15,2.65,117.65,3.05');INSERT INTO metadata VALUES('name','Peta_Hutan_MBTiles');";
    for (let i = 0; i < teksMetadata.length; i++) u8[100 + i] = teksMetadata.charCodeAt(i);

    const file = new File([buf], "peta_kawasan.mbtiles", { type: "application/x-sqlite3" });
    const meta = await bacaMetadataBerkasPeta(file, { lat: 2.85, lng: 117.37 });

    expect(meta.sumberDeteksi).toBe("mbtiles");
    expect(meta.crs).toContain("EPSG:3857");
    expect(meta.minLng).toBe(117.15);
    expect(meta.minLat).toBe(2.65);
    expect(meta.maxLng).toBe(117.65);
    expect(meta.maxLat).toBe(3.05);
  });
});
