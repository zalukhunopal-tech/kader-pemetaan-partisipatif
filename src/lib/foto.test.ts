import { describe, expect, it } from "vitest";
import { hitungUkuranFoto, perkiraBytesDataUrl } from "./foto";

describe("hitungUkuranFoto", () => {
  it("mengecilkan sisi terpanjang sambil menjaga rasio", () => {
    expect(hitungUkuranFoto(4000, 3000, 1280)).toEqual({ lebar: 1280, tinggi: 960 });
    expect(hitungUkuranFoto(3000, 4000, 1280)).toEqual({ lebar: 960, tinggi: 1280 });
  });
  it("tidak memperbesar gambar yang sudah kecil", () => {
    expect(hitungUkuranFoto(800, 600, 1280)).toEqual({ lebar: 800, tinggi: 600 });
  });
  it("tidak pernah menghasilkan sisi nol, juga untuk masukan tak sah", () => {
    expect(hitungUkuranFoto(10000, 1, 1280)).toEqual({ lebar: 1280, tinggi: 1 });
    expect(hitungUkuranFoto(0, 0)).toEqual({ lebar: 1, tinggi: 1 });
    expect(hitungUkuranFoto(NaN, 5)).toEqual({ lebar: 1, tinggi: 1 });
  });
});

describe("perkiraBytesDataUrl", () => {
  it("menghitung ukuran biner dari base64 termasuk padding", () => {
    expect(perkiraBytesDataUrl("data:image/jpeg;base64," + btoa("abc"))).toBe(3);
    expect(perkiraBytesDataUrl("data:image/jpeg;base64," + btoa("abcd"))).toBe(4);
    expect(perkiraBytesDataUrl("data:image/jpeg;base64," + btoa("ab"))).toBe(2);
  });
  it("0 untuk teks yang bukan data URL", () => {
    expect(perkiraBytesDataUrl("bukan data url")).toBe(0);
  });
});
