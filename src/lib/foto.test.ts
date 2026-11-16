import { describe, expect, it } from "vitest";
import { hitungUkuranFoto, perkiraBytesDataUrl, susunBarisStampFoto } from "./foto";

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

describe("susunBarisStampFoto", () => {
  it("menyertakan koordinat, waktu pengambilan, serta label tematik bila ada", () => {
    const umum = susunBarisStampFoto({
      posisi: { lat: 2.857472, lng: 117.377476, akurasi: 5 },
      diambilPada: "2026-11-16T12:00:00.000Z",
      idKader: "KDR-1",
      desa: "Desa Contoh",
      stampVisual: true
    });
    expect(umum.some((b) => b.includes("2.85747"))).toBe(true);
    expect(umum.some((b) => b.includes("50N"))).toBe(true);
    expect(umum.some((b) => b.includes("2026"))).toBe(true);
    expect(umum.some((b) => b.startsWith("Tematik:"))).toBe(false);

    const tematik = susunBarisStampFoto({
      posisi: { lat: 2.857472, lng: 117.377476, akurasi: 5 },
      diambilPada: "2026-11-16T12:00:00.000Z",
      idKader: "KDR-1",
      desa: "Desa Contoh",
      tematik: "Kolam Flora",
      stampVisual: true
    });
    expect(tematik[tematik.length - 1]).toBe("Tematik: Kolam Flora");
  });
});
