// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bacaInventarisBug,
  catatBugManual,
  catatBugOtomatis,
  eksporInventarisBugJson,
  eksporInventarisBugMarkdown,
  hapusCatatanBug,
  kosongkanInventarisBug,
  pasangPenangkapBugGlobal,
  resetCacheInventarisBugUntukUji
} from "./inventarisBug";

describe("inventarisBug — penangkap otomatis, catat manual, & ekspor perbaikan", () => {
  beforeEach(() => {
    localStorage.clear();
    resetCacheInventarisBugUntukUji();
  });

  it("mencatat bug otomatis, menggabungkan duplikasi kejadian, dan menyensor token/kredensial", () => {
    catatBugOtomatis({
      judul: "Gagal sync Bearer abcdef.123456.xyz",
      deskripsi: "Token gho_RahasiaBanget123 dan AIzaSyA1234567890ABCD mengalami timeout",
      lokasi: "Sinkronisasi"
    });
    catatBugOtomatis({
      judul: "Gagal sync Bearer abcdef.123456.xyz",
      deskripsi: "Timeout ulang",
      lokasi: "Sinkronisasi"
    });

    const daftar = bacaInventarisBug();
    expect(daftar).toHaveLength(1);
    expect(daftar[0].sumber).toBe("otomatis");
    expect(daftar[0].jumlahKejadian).toBe(2);
    expect(daftar[0].judul).not.toContain("abcdef");
    expect(daftar[0].judul).toContain("[DISENSOR]");
    expect(eksporInventarisBugJson()).toContain("Sinkronisasi");
  });

  it("mencatat laporan bug manual, menghapus satuan, dan mengekspor laporan markdown", () => {
    expect(() => catatBugManual({ judul: "Uji", deskripsi: "   " })).toThrow();

    const bug = catatBugManual({
      judul: "Tombol kompas kurang responsif",
      deskripsi: "Saat diketuk di sudut kanan bawah terasa berat",
      lokasi: "Peta Interaktif",
      pengguna: "Kader Adi"
    });
    expect(bug.sumber).toBe("manual");
    expect(bacaInventarisBug()).toHaveLength(1);

    const md = eksporInventarisBugMarkdown();
    expect(md).toContain("Tombol kompas kurang responsif");
    expect(md).toContain("Peta Interaktif");
    expect(md).toContain("Manual");

    hapusCatatanBug(bug.id);
    expect(bacaInventarisBug()).toHaveLength(0);
  });

  it("memasang penangkap global window error, unhandledrejection, dan console.error (tanpa loop / abaikan ResizeObserver)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lepas = pasangPenangkapBugGlobal(() => ({ lokasi: "peta", pengguna: "Nopal" }));
    try {
      // Abaikan peringatan ResizeObserver yang jinak
      window.dispatchEvent(new ErrorEvent("error", { message: "ResizeObserver loop completed with undelivered notifications." }));
      expect(bacaInventarisBug()).toHaveLength(0);

      // Tangkap error runtime nyata
      window.dispatchEvent(
        new ErrorEvent("error", { message: "Cannot read properties of undefined", filename: "peta.ts", lineno: 42, colno: 8 })
      );
      console.error("Kesalahan asinkron peta");

      const daftar = bacaInventarisBug();
      expect(daftar.length).toBeGreaterThanOrEqual(2);
      expect(daftar[0].lokasi).toBe("peta");
      expect(daftar[0].pengguna).toBe("Nopal");
    } finally {
      lepas();
      errSpy.mockRestore();
      kosongkanInventarisBug();
    }
  });
});
