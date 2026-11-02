import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buatZipLokal } from "./cadangan";
describe("cadangan ZIP lokal", () => {
  it("membuat arsip Unicode untuk pemeriksaan ZIP independen", () => {
    const zip = buatZipLokal([
      { nama: "catatan.json", isi: JSON.stringify({ nama: "Hutan keramat 🌳", foto: "data:image/jpeg;base64,QQ==" }) },
      { nama: "kosong.txt", isi: "" }
    ]);
    writeFileSync("/tmp/titik-tapak-cadangan-test.zip", zip);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(new DataView(zip.buffer).getUint32(zip.length - 22, true)).toBe(0x06054b50);
  });
});
