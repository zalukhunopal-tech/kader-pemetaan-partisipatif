import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  hitungSkalaRender,
  tentukanAnggaranResolusi,
  turunkanAnggaranResolusi
} from "../lib/geoPdf";

describe("Resolusi peta adaptif (tajam namun ringan)", () => {
  const pc = tentukanAnggaranResolusi({ seluler: false, memoriGb: 8, jumlahCpu: 16 });
  const hp = tentukanAnggaranResolusi({ seluler: true, memoriGb: 6, jumlahCpu: 8 });
  const hpRendah = tentukanAnggaranResolusi({ seluler: true, memoriGb: 2, jumlahCpu: 4 });

  it("anggaran menyesuaikan kemampuan perangkat dan selalu di atas batas lama 2048 px (kecuali HP lemah tetap lebih tinggi)", () => {
    expect(pc.sisiMaks).toBeGreaterThan(hp.sisiMaks);
    expect(hp.sisiMaks).toBeGreaterThan(hpRendah.sisiMaks);
    expect(hpRendah.sisiMaks).toBeGreaterThan(2048);
    // di bawah batas kanvas iOS (16,7 juta piksel) agar aman di HP
    expect(hp.pikselMaks).toBeLessThan(16_700_000);
    expect(hpRendah.pikselMaks).toBeLessThan(hp.pikselMaks);
  });

  it("skala render memenuhi batas sisi dan total piksel", () => {
    const skala = hitungSkalaRender(2000, 1000, hp);
    expect(2000 * skala).toBeLessThanOrEqual(hp.sisiMaks + 1);
    expect(2000 * skala * (1000 * skala)).toBeLessThan(hp.pikselMaks * 1.01);
    // lembar kecil dirender lebih besar (tajam), tapi dibatasi skala maksimum
    expect(hitungSkalaRender(100, 100, pc)).toBe(8);
    // area peta yang kecil di halaman besar tetap mendapat skala tinggi (bukan ikut ukuran halaman)
    expect(hitungSkalaRender(500, 400, hp)).toBeGreaterThan(hitungSkalaRender(2400, 3300, hp));
  });

  it("override hanya dapat menurunkan, tidak melampaui anggaran perangkat", () => {
    const kecil = tentukanAnggaranResolusi({ seluler: false }, 1024);
    expect(kecil.sisiMaks).toBe(1024);
    const besar = tentukanAnggaranResolusi({ seluler: false }, 99999);
    expect(besar.sisiMaks).toBe(pc.sisiMaks);
  });

  it("penurunan bertahap saat memori tidak cukup tetap memberi anggaran valid", () => {
    const turun = turunkanAnggaranResolusi(hp, 0.7);
    expect(turun.sisiMaks).toBeLessThan(hp.sisiMaks);
    expect(turun.pikselMaks).toBeLessThan(hp.pikselMaks);
    expect(turun.kualitasJpeg).toBeGreaterThanOrEqual(0.7);
    const terendah = turunkanAnggaranResolusi(hpRendah, 0.01);
    expect(terendah.sisiMaks).toBeGreaterThanOrEqual(512);
  });
});

describe("Menu aksi data admin di HP", () => {
  const sumber = readFileSync(resolve(__dirname, "../components/AdminDashboardView.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

  it("semua aksi tersedia di menu daftar (tinjau peta, edit, sah, minta revisi, hapus)", () => {
    for (const label of ["Tinjau peta", "Edit", "Sah", "Minta revisi", "Hapus"]) {
      expect(sumber).toMatch(new RegExp(`aksi-sheet-item[\\s\\S]{0,900}${label}`));
    }
    expect(sumber).toContain("aksi-data-trigger");
  });

  it("deretan tombol lama hanya disembunyikan di HP; desktop/tablet tidak berubah", () => {
    expect(sumber).toContain('className="aksi-data-desktop"');
    expect(css).toMatch(/\.aksi-data-trigger\s*\{\s*display:\s*none;/);
    expect(css).toMatch(/@media \(max-width: 640px\)\s*\{\s*\.aksi-data-desktop\s*\{\s*display:\s*none !important;/);
  });
});

describe("Hapus badge Posisi sekarang (Menghadap Utara) & pengambilan titik ramping sejajar di HP", () => {
  const sumberMap = readFileSync(resolve(__dirname, "../components/InteractiveMap.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

  it("tidak memunculkan tanda 'Posisi sekarang (Menghadap Utara)' namun fitur GPS bertahap tetap dipertahankan", () => {
    expect(sumberMap).not.toContain("Posisi sekarang (Menghadap Utara)");
    expect(sumberMap).toContain('setModeIkutiGps("posisi")');
    expect(sumberMap).toContain('setModeIkutiGps("kompas")');
    expect(sumberMap).toContain("setBearing(0)");
    expect(sumberMap).toContain("setModeIkutiKompas(true)");
  });

  it("pengambilan titik di HP merampingkan kartu dan menyejajarkan Di Tanda +, Di GPS Saya, dan Batal", () => {
    expect(sumberMap).toContain('className="field-resume-actions"');
    expect(css).toMatch(/\.field-resume-actions\s*\{\s*display:\s*contents;/);
    expect(css).toMatch(/\.field-resume-actions\s*\{[\s\S]*?flex-direction:\s*row !important;[\s\S]*?flex-wrap:\s*nowrap !important;/);
    expect(css).toMatch(/\.field-resume-draft button\s*\{[\s\S]*?min-height:\s*30px !important;/);
  });
});
