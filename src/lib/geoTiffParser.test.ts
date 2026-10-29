import { describe, expect, it } from "vitest";
import { parseGeoTiffBuffer } from "./geoTiffParser";

describe("geoTiffParser", () => {
  it("mengembalikan null jika buffer terlalu kecil atau bukan tanda tangan TIFF", () => {
    expect(parseGeoTiffBuffer(new Uint8Array(8))).toBeNull();
    const acak = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(parseGeoTiffBuffer(acak)).toBeNull();
  });

  it("mendeteksi GeoTIFF UTM Zone 50N (EPSG:32650) Tanjung Selor dan menghitung bounding box otomatis", () => {
    // Bangun buffer Little-Endian valid dengan tag GeoTIFF
    const buf = new ArrayBuffer(512);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);

    // Header: 'II' (Intel Little Endian), magic 42, IFD at offset 8
    u8[0] = 0x49;
    u8[1] = 0x49;
    view.setUint16(2, 42, true);
    view.setUint32(4, 8, true);

    // IFD at offset 8: 5 tags
    view.setUint16(8, 5, true);

    // Tag 0: ImageWidth (256, SHORT, 1, 1000)
    let off = 10;
    view.setUint16(off, 256, true);
    view.setUint16(off + 2, 3, true);
    view.setUint32(off + 4, 1, true);
    view.setUint16(off + 8, 1000, true);

    // Tag 1: ImageLength (257, SHORT, 1, 800)
    off += 12;
    view.setUint16(off, 257, true);
    view.setUint16(off + 2, 3, true);
    view.setUint32(off + 4, 1, true);
    view.setUint16(off + 8, 800, true);

    // Tag 2: ModelPixelScaleTag (33550, DOUBLE, 3, offset 200)
    // Resolusi: 10 meter/pixel
    off += 12;
    view.setUint16(off, 33550, true);
    view.setUint16(off + 2, 12, true);
    view.setUint32(off + 4, 3, true);
    view.setUint32(off + 8, 200, true);
    view.setFloat64(200, 10.0, true);
    view.setFloat64(208, 10.0, true);
    view.setFloat64(216, 0.0, true);

    // Tag 3: ModelTiepointTag (33922, DOUBLE, 6, offset 230)
    // Sudut kiri atas: Easting 540000, Northing 320000 (Tanjung Selor UTM Zone 50N)
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

    // Tag 4: GeoKeyDirectoryTag (34735, SHORT, 8, offset 300)
    off += 12;
    view.setUint16(off, 34735, true);
    view.setUint16(off + 2, 3, true);
    view.setUint32(off + 4, 8, true);
    view.setUint32(off + 8, 300, true);

    // Header GeoKey: version 1, rev 1, minor 0, numKeys 1
    view.setUint16(300, 1, true);
    view.setUint16(302, 1, true);
    view.setUint16(304, 0, true);
    view.setUint16(306, 1, true);

    // Key: ProjectedCSTypeGeoKey (3072) = 32650 (WGS 84 / UTM Zone 50N)
    view.setUint16(308, 3072, true);
    view.setUint16(310, 0, true);
    view.setUint16(312, 1, true);
    view.setUint16(314, 32650, true);

    const hasil = parseGeoTiffBuffer(buf);
    expect(hasil).not.toBeNull();
    expect(hasil?.crs).toContain("EPSG:32650");
    expect(hasil?.crs).toContain("UTM Zone 50N");
    expect(hasil?.lebarPixel).toBe(1000);
    expect(hasil?.tinggiPixel).toBe(800);
    expect(hasil?.resolusiMeter).toBe(10);

    // Koordinat harus terkonversi otomatis ke derajat lintang/bujur Tanjung Selor (~2.8°–2.9° N, ~117.3°–117.4° E)
    expect(hasil?.minLat).toBeGreaterThan(2.7);
    expect(hasil?.maxLat).toBeLessThan(3.0);
    expect(hasil?.minLng).toBeGreaterThan(117.2);
    expect(hasil?.maxLng).toBeLessThan(117.6);
  });

  it("mendeteksi GeoTIFF Geographic WGS 84 (EPSG:4326)", () => {
    const buf = new ArrayBuffer(512);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);

    u8[0] = 0x49;
    u8[1] = 0x49;
    view.setUint16(2, 42, true);
    view.setUint32(4, 8, true);

    view.setUint16(8, 4, true);

    // Width & Height
    let off = 10;
    view.setUint16(off, 256, true);
    view.setUint16(off + 2, 3, true);
    view.setUint32(off + 4, 1, true);
    view.setUint16(off + 8, 500, true);

    off += 12;
    view.setUint16(off, 257, true);
    view.setUint16(off + 2, 3, true);
    view.setUint32(off + 4, 1, true);
    view.setUint16(off + 8, 400, true);

    // ModelPixelScaleTag (0.001 derajat per pixel)
    off += 12;
    view.setUint16(off, 33550, true);
    view.setUint16(off + 2, 12, true);
    view.setUint32(off + 4, 3, true);
    view.setUint32(off + 8, 200, true);
    view.setFloat64(200, 0.001, true);
    view.setFloat64(208, 0.001, true);
    view.setFloat64(216, 0.0, true);

    // ModelTiepointTag (Top-Left: 117.2, 2.9)
    off += 12;
    view.setUint16(off, 33922, true);
    view.setUint16(off + 2, 12, true);
    view.setUint32(off + 4, 6, true);
    view.setUint32(off + 8, 230, true);
    view.setFloat64(230, 0, true);
    view.setFloat64(238, 0, true);
    view.setFloat64(246, 0, true);
    view.setFloat64(254, 117.2, true);
    view.setFloat64(262, 2.9, true);
    view.setFloat64(270, 0, true);

    const hasil = parseGeoTiffBuffer(buf);
    expect(hasil).not.toBeNull();
    expect(hasil?.crs).toContain("WGS 84");
    expect(hasil?.minLng).toBeCloseTo(117.2, 3);
    expect(hasil?.maxLng).toBeCloseTo(117.7, 3);
    expect(hasil?.maxLat).toBeCloseTo(2.9, 3);
    expect(hasil?.minLat).toBeCloseTo(2.5, 3);
  });
});
