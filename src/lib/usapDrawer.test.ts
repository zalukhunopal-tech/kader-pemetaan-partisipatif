import { describe, expect, it } from "vitest";
import {
  hitungGayaSeretTerbuka,
  hitungGayaSeretTutupKeBuka,
  hitungKecepatanVertikal,
  tahapBerikutnyaTerbuka,
  tahapDariTarikanTutup
} from "./usapDrawer";

describe("usapDrawer — gestur swipe halus & bertahap", () => {
  it("menolak tarikan terlalu kecil dan mempertahankan status tutup agar memantul balik", () => {
    expect(tahapDariTarikanTutup(10, 0.1)).toBe("tutup");
    expect(tahapDariTarikanTutup(22, 0.25)).toBe("tutup");
  });

  it("membuka drawer secara bertahap sesuai jarak tarikan dan kecepatan", () => {
    expect(tahapDariTarikanTutup(48, 0.2)).toBe("ringkas");
    expect(tahapDariTarikanTutup(80, 0.65)).toBe("ringkas");
    expect(tahapDariTarikanTutup(145, 0.4)).toBe("sedang");
    expect(tahapDariTarikanTutup(90, 1.05)).toBe("sedang");
    expect(tahapDariTarikanTutup(260, 0.5)).toBe("penuh");
    expect(tahapDariTarikanTutup(100, 1.8)).toBe("penuh");
  });

  it("berpindah tahap secara bertahap saat kepala drawer digeser naik atau turun", () => {
    // Naik bertahap: ringkas -> sedang -> penuh
    expect(tahapBerikutnyaTerbuka("ringkas", -60, -0.3)).toBe("sedang");
    expect(tahapBerikutnyaTerbuka("ringkas", -200, -0.5)).toBe("penuh");
    expect(tahapBerikutnyaTerbuka("sedang", -60, -0.3)).toBe("penuh");
    expect(tahapBerikutnyaTerbuka("penuh", -80, -0.4)).toBe("penuh");

    // Turun bertahap terkendali: penuh -> sedang -> ringkas -> tutup
    expect(tahapBerikutnyaTerbuka("penuh", 70, 0.3)).toBe("sedang");
    expect(tahapBerikutnyaTerbuka("sedang", 70, 0.3)).toBe("ringkas");
    expect(tahapBerikutnyaTerbuka("ringkas", 45, 0.25)).toBe("tutup");

    // Sentakan cepat / tarikan dalam langsung menutup penuh
    expect(tahapBerikutnyaTerbuka("penuh", 210, 0.5)).toBe("tutup");
    expect(tahapBerikutnyaTerbuka("sedang", 85, 1.2)).toBe("tutup");
  });

  it("menghitung kecepatan vertikal dengan penyebut minimum aman", () => {
    const cepat = hitungKecepatanVertikal({ y: 500, waktuMs: 100 }, { y: 400, waktuMs: 104 });
    expect(cepat).toBeCloseTo(-100 / 24, 3);

    const normal = hitungKecepatanVertikal({ y: 500, waktuMs: 100 }, { y: 400, waktuMs: 200 });
    expect(normal).toBeCloseTo(-1, 3);
  });

  it("menghitung posisi translateY, tinggi dinamis, dan opasitas latar secara progresif saat diseret", () => {
    // Baru ditarik 40px dari tutup (tinggi panel ringkas 300px) -> masih mengintip 40px dari bawah
    const awal = hitungGayaSeretTutupKeBuka(40, 300, 780);
    expect(awal.translateYPx).toBe(260);
    expect(awal.heightPx).toBeNull();
    expect(awal.backdropAlpha).toBeGreaterThan(0);

    // Tarikan melewati tinggi dasar (420px > 300px) -> tinggi tumbuh halus ke atas mengikuti jari
    const lanjut = hitungGayaSeretTutupKeBuka(420, 300, 780);
    expect(lanjut.translateYPx).toBe(0);
    expect(lanjut.heightPx).toBe(420);
    expect(lanjut.backdropAlpha).toBe(0.24);

    // Seret turun dari drawer terbuka -> turun 1:1 dan meredupkan backdrop
    const turun = hitungGayaSeretTerbuka(120, "sedang", 480, 780);
    expect(turun.translateYPx).toBe(120);
    expect(turun.heightPx).toBeNull();
    expect(turun.backdropAlpha).toBeLessThan(0.24);

    // Seret naik dari tahap ringkas -> memanjang bertahap ke atas
    const naik = hitungGayaSeretTerbuka(-110, "ringkas", 300, 780);
    expect(naik.translateYPx).toBe(0);
    expect(naik.heightPx).toBe(410);
  });
});
