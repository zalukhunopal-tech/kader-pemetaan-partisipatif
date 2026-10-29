import { describe, expect, it } from "vitest";
import { parseMBTilesBuffer, tileKeBujur, tileKeLintang } from "./mbtilesParser";

describe("mbtilesParser", () => {
  it("mengembalikan null jika bukan berkas SQLite 3 MBTiles", () => {
    expect(parseMBTilesBuffer(new Uint8Array(50))).toBeNull();
    const palsu = new Uint8Array(120);
    palsu[0] = 0x50; // bukan 'SQLite format 3'
    expect(parseMBTilesBuffer(palsu)).toBeNull();
  });

  it("mendeteksi MBTiles dan mengekstrak bounds, center, serta sistem proyeksi otomatis", () => {
    const buf = new ArrayBuffer(2048);
    const u8 = new Uint8Array(buf);

    // Tulis SQLite header "SQLite format 3\0"
    const header = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
    for (let i = 0; i < header.length; i++) {
      u8[i] = header[i];
    }

    // Tulis simulasi rekaman tabel metadata MBTiles
    const teksMetadata = [
      "CREATE TABLE metadata (name text, value text);",
      "INSERT INTO metadata VALUES('name','Peta_Hutan_Tanjung_Selor_2026');",
      "INSERT INTO metadata VALUES('bounds','117.1500,2.6500,117.6500,3.0500');",
      "INSERT INTO metadata VALUES('center','117.4000,2.8500,13');",
      "INSERT INTO metadata VALUES('minzoom','10');",
      "INSERT INTO metadata VALUES('maxzoom','16');",
      "INSERT INTO metadata VALUES('format','pbf');"
    ].join("");

    for (let i = 0; i < teksMetadata.length; i++) {
      u8[100 + i] = teksMetadata.charCodeAt(i);
    }

    const hasil = parseMBTilesBuffer(buf);
    expect(hasil).not.toBeNull();
    expect(hasil?.namaArea).toBe("Peta_Hutan_Tanjung_Selor_2026");
    expect(hasil?.crs).toContain("EPSG:3857");
    expect(hasil?.crs).toContain("EPSG:4326");
    expect(hasil?.minLng).toBe(117.15);
    expect(hasil?.minLat).toBe(2.65);
    expect(hasil?.maxLng).toBe(117.65);
    expect(hasil?.maxLat).toBe(3.05);
    expect(hasil?.pusatLng).toBe(117.4);
    expect(hasil?.pusatLat).toBe(2.85);
    expect(hasil?.zoomMin).toBe(10);
    expect(hasil?.zoomMax).toBe(16);
    expect(hasil?.format).toBe("pbf");
  });

  it("konversi tileKeBujur dan tileKeLintang menghitung koordinat geografis WGS84", () => {
    // Zoom 0 tile 0,0: bujur -180, lintang ~85.051
    expect(tileKeBujur(0, 0)).toBe(-180);
    expect(tileKeBujur(1, 0)).toBe(180);
    expect(tileKeLintang(0, 0)).toBeCloseTo(85.051, 2);
  });
});
