// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  KUNCI_INVENTARIS_BUG,
  bacaInventarisBug,
  bersihkanBugSudahDiperbaiki,
  catatBugManual,
  catatBugOtomatis,
  eksporInventarisBugJson,
  eksporInventarisBugMarkdown,
  hapusCatatanBug,
  kosongkanInventarisBug,
  pasangPenangkapBugGlobal,
  resetCacheInventarisBugUntukUji,
  tandaiBugSudahDiperbaiki
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

  it("otomatis menghapus bug yang sudah diperbaiki (termasuk setState-in-render dan bug lama sebelum rilis perbaikan) dari daftar inventaris bug", () => {
    // Simulasikan bug lama (2026-11-17) dan bug setState-in-render yang masih tertinggal di localStorage perangkat
    const bugLamaDiStorage = [
      {
        id: "BUG-LAMA-001",
        sumber: "otomatis",
        judul: "Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() cal",
        deskripsi:
          "Warning: Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/setstate-in-render%s App App App",
        lokasi: "peta",
        perangkat: "375x667 (online)",
        waktuPertama: "2026-11-17T03:15:42.874Z",
        waktuTerakhir: "2026-11-17T03:15:42.874Z",
        jumlahKejadian: 1,
        status: "tercatat"
      }
    ];
    localStorage.setItem(KUNCI_INVENTARIS_BUG, JSON.stringify(bugLamaDiStorage));
    resetCacheInventarisBugUntukUji();

    // Saat bacaInventarisBug() atau bersihkanBugSudahDiperbaiki() dipanggil, bug yang sudah diperbaiki otomatis terhapus
    const daftarSetelahBaca = bacaInventarisBug();
    expect(daftarSetelahBaca).toEqual([]);
    expect(localStorage.getItem(KUNCI_INVENTARIS_BUG)).toBeNull();

    // Bila ada bug baru yang kemudian ditandai sudah diperbaiki, bug tersebut otomatis terhapus dari daftar
    const bugBaru = catatBugManual({
      judul: "Kendala sementara uji",
      deskripsi: "Bug ini akan ditandai sudah diperbaiki",
      lokasi: "Peta Interaktif"
    });
    expect(bacaInventarisBug()).toHaveLength(1);

    tandaiBugSudahDiperbaiki(bugBaru.id);
    expect(bacaInventarisBug()).toEqual([]);
    expect(bersihkanBugSudahDiperbaiki()).toBe(0);
  });
});
