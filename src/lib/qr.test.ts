import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { matriksQr, payloadVerifikasi } from "./qr";

const sertifikat = { nomorSertifikat: "0001/SKPP-GIS/WILAYAH/X/2026", idKader: "KDR-7a3f9c01d2e4", tanggalTerbit: "2026-10-28" };

/** Merender matriks seperti di kanvas sertifikat: zona tenang 4 modul, latar putih, modul hitam */
function rasterkan(payload: string, pikselPerModul = 5) {
  const m = matriksQr(payload);
  const n = m.length;
  const total = (n + 8) * pikselPerModul;
  const data = new Uint8ClampedArray(total * total * 4).fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue;
      for (let dy = 0; dy < pikselPerModul; dy++) {
        for (let dx = 0; dx < pikselPerModul; dx++) {
          const i = (((r + 4) * pikselPerModul + dy) * total + (c + 4) * pikselPerModul + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, lebar: total, tinggi: total };
}

describe("payloadVerifikasi", () => {
  it("tanpa URL verifikasi: teks bertanda GEOKADER", () => {
    expect(payloadVerifikasi(sertifikat, undefined)).toBe("GEOKADER|0001/SKPP-GIS/WILAYAH/X/2026|KDR-7a3f9c01d2e4|2026-10-28");
  });
  it("dengan URL verifikasi: tautan dengan parameter yang di-encode", () => {
    expect(payloadVerifikasi(sertifikat, "https://sertifikat.contoh.id/cek")).toBe(
      "https://sertifikat.contoh.id/cek?no=0001%2FSKPP-GIS%2FWILAYAH%2FX%2F2026&id=KDR-7a3f9c01d2e4"
    );
    expect(payloadVerifikasi(sertifikat, "https://x.id/cek?v=1")).toContain("?v=1&no=");
  });
});

describe("kode QR sertifikat", () => {
  it("dapat dipindai dan isinya sama dengan payload (teks)", () => {
    const payload = payloadVerifikasi(sertifikat, undefined);
    const { data, lebar, tinggi } = rasterkan(payload);
    const hasil = jsQR(data, lebar, tinggi);
    expect(hasil?.data).toBe(payload);
  });
  it("dapat dipindai dan isinya sama dengan payload (tautan panjang)", () => {
    const payload = payloadVerifikasi(sertifikat, "https://sertifikat.contoh.id/verifikasi");
    const { data, lebar, tinggi } = rasterkan(payload, 4);
    expect(jsQR(data, lebar, tinggi)?.data).toBe(payload);
  });
  it("payload berbeda menghasilkan pola berbeda", () => {
    const a = JSON.stringify(matriksQr("GEOKADER|1"));
    const b = JSON.stringify(matriksQr("GEOKADER|2"));
    expect(a).not.toBe(b);
  });
  it("matriks persegi dengan tiga pola sudut (finder) di pojok kiri atas, kanan atas, kiri bawah", () => {
    const m = matriksQr("uji");
    const n = m.length;
    expect(m.every((baris) => baris.length === n)).toBe(true);
    expect([m[0][0], m[0][n - 1], m[n - 1][0], m[n - 1][n - 1]]).toEqual([true, true, true, false]);
  });
});
