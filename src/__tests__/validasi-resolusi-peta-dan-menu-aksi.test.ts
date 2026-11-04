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
    expect(2000 * skala * (1000 * skala)).toBeLessThanOrEqual(hp.pikselMaks * 1.01);
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

describe("Menu aksi data admin di PC/Tablet & HP", () => {
  const sumber = readFileSync(resolve(__dirname, "../components/AdminDashboardView.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

  it("semua aksi tersedia di menu daftar (tinjau peta, edit, sah, minta revisi, hapus)", () => {
    for (const label of ["Tinjau peta", "Edit", "Sah", "Minta revisi", "Hapus"]) {
      expect(sumber).toMatch(new RegExp(`aksi-sheet-item[\\s\\S]{0,900}${label}`));
    }
    expect(sumber).toContain("aksi-data-trigger");
  });

  it("PC/tablet dan HP sama-sama menggunakan tombol Aksi rapi dan menyembunyikan deretan tombol lama", () => {
    expect(sumber).toContain('className="aksi-data-desktop"');
    expect(css).toMatch(/\.aksi-data-desktop\s*\{\s*display:\s*none !important;/);
    expect(css).toMatch(/\.aksi-data-trigger\s*\{[\s\S]*?display:\s*inline-flex;/);
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

describe("Optimasi kelancaran peta (tidak berat/liar) & menu hapus pustaka tidak tersembunyi", () => {
  const sumberKanvas = readFileSync(resolve(__dirname, "../lib/petaKanvas.ts"), "utf8");
  const sumberMap = readFileSync(resolve(__dirname, "../components/InteractiveMap.tsx"), "utf8");
  const sumberPustaka = readFileSync(resolve(__dirname, "../components/PustakaView.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

  it("menggambar GeoPDF lokal dalam 1 panggilan drawImage tanpa ribuan strip per frame dan mengunci jangkar 2 jari sesuai rotasi", () => {
    expect(sumberKanvas).toContain("if (rentangLat <= 2)");
    expect(sumberKanvas).toContain("ctx.drawImage(img, x0, y0, mapW, mapH);");
    expect(sumberMap).toContain("if (canvas.width !== targetW || canvas.height !== targetH)");
    expect(sumberMap).toContain("ctx.setTransform(dpr, 0, 0, dpr, 0, 0)");
    expect(sumberMap).toContain("dxKini * Math.cos(radKini) - dyKini * Math.sin(radKini)");
  });

  it("menu opsi peta di Pustaka dapat membuka ke atas (buka-atas) dan ramping agar pilihan Hapus tidak tersembunyi di bawah", () => {
    expect(sumberPustaka).toContain("menuArahAtas");
    expect(sumberPustaka).toContain("buka-atas");
    expect(css).toMatch(/\.avenza-row-dropdown\.buka-atas[\s\S]*?bottom:\s*calc\(100% \+ 6px\) !important;/);
    expect(css).toMatch(/\.avenza-row-dropdown button\s*\{[\s\S]*?min-height:\s*36px !important;/);
  });
});

describe("Label menu satu baris (anti ke-enter), status level kader sejajar di HP, & kotak dialog InspektorObjek rapi", () => {
  const sumberLevel = readFileSync(resolve(__dirname, "../components/PanelDataUserLevel.tsx"), "utf8");
  const sumberInspektor = readFileSync(resolve(__dirname, "../components/peta/InspektorObjek.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

  it("mempersingkat label filter tier level dan menahan status level kader dalam 1 baris sejajar tanpa digeser ke bawah", () => {
    expect(sumberLevel).toContain("Pemula (1–5)");
    expect(sumberLevel).toContain("Pelaksana (6–10)");
    expect(sumberLevel).toContain("Utama (11–15)");
    expect(sumberLevel).toContain("Ahli (16–20)");
    expect(sumberLevel).toContain("Lvl {kader.level} • {tierRingkas}");
    expect(css).toMatch(/\.kader-card-top-row\s*\{[\s\S]*?flex-wrap:\s*nowrap;/);
    expect(css).toMatch(/text-overflow:\s*ellipsis;/);
  });

  it("menata ulang kotak dialog InspektorObjek untuk titik, jalur, dan poligon baik di PC/tablet maupun HP", () => {
    expect(sumberInspektor).toContain("awal={55}");
    expect(sumberInspektor).toContain("inspector-summary-strip");
    expect(sumberInspektor).toContain("inspector-badges-row");
    expect(css).toContain(".field-sheet.field-inspector-sheet");
    expect(css).toContain(".workspace-map .field-sheet.field-inspector-sheet");
  });
});

describe("Menu tindakan akun di Admin > Akun & penanda GPS tidak menutupi perekaman", () => {
  const sumberAkun = readFileSync(resolve(__dirname, "../components/AkunAdminPanel.tsx"), "utf8");
  const sumberRekam = readFileSync(resolve(__dirname, "../components/peta/PanelPerekaman.tsx"), "utf8");
  const sumberLatar = readFileSync(resolve(__dirname, "../lib/perekamLatar.ts"), "utf8");
  const css = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

  it("tindakan akun tersembunyi dalam tombol Aksi dan menyediakan fitur Hapus akun di menu pilihan", () => {
    expect(sumberAkun).toContain('className="btn-outline-sm aksi-data-trigger"');
    expect(sumberAkun).toContain("Hapus akun");
    expect(sumberAkun).toContain("hapusAkunOlehAdmin");
    expect(sumberAkun).toContain("aksi-sheet-hapus");
  });

  it("kalimat penanda izin GPS dipersingkat dan kotak kendali perekaman jalur/poligon tidak tertutupi", () => {
    expect(sumberLatar).toContain('"GPS belum diizinkan"');
    expect(sumberLatar).not.toContain("GPS perangkat belum diizinkan. Izinkan akses lokasi di pengaturan browser.");
    expect(sumberRekam).toContain("rec-error-alert");
    expect(sumberRekam).toContain("rec-error-dismiss");
    expect(css).toContain(".rec-error-alert");
    expect(css).toContain(".rec-error-dismiss");
  });
});

describe("Penyelarasan koordinat sejajar LU/BT, BottomSheet tanpa angka persentase, dan perbaikan overlap menu peta & lapisan", () => {
  const sumberChip = readFileSync(resolve(__dirname, "../components/peta/ChipKoordinatPeta.tsx"), "utf8");
  const sumberSheet = readFileSync(resolve(__dirname, "../components/peta/BottomSheet.tsx"), "utf8");
  const sumberLapisan = readFileSync(resolve(__dirname, "../components/peta/PanelLapisanPeta.tsx"), "utf8");
  const css = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

  it("titik koordinat LU dan BT sejajar horizontal membuat kotak chip telemetri memanjang rapi", () => {
    expect(css).toContain("flex-direction: row;");
    expect(css).toContain("font-size: 11.5px;");
    expect(sumberChip).toContain("coord-val-part");
  });

  it("angka persentase 25% 55% 92% dihapus dari header bottom sheet tanpa menghilangkan fungsi ukuran dan drag", () => {
    expect(css).toContain(".field-sheet-stops {\r\n  display: none !important;");
    expect(sumberSheet).toContain("setTinggi(tahap");
  });

  it("menu peta dan lapisan tidak overlap antara Lapisan Berkas dan Pustaka", () => {
    expect(css).toContain("width: 360px;");
    expect(css).toContain(".pustaka-tab-label-full");
    expect(css).toContain(".pustaka-tab-label-short");
    expect(sumberLapisan).toContain("pustaka-tab-label-full");
    expect(sumberLapisan).toContain("pustaka-tab-label-short");
  });
});

describe("Penyelarasan tool atas kiri (ChipKoordinatPeta) dan atas kanan (Layers/Kompas/Cari & Rail) sejajar dan anti-overlap", () => {
  const css = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

  it("1. Tool atas kiri dan atas kanan sejajar vertikal (top: 12px pada desktop dan top: 8px pada mobile)", () => {
    expect(css).toMatch(/\.coord-chip-wrap\s*\{[^}]*top:\s*12px;[^}]*left:\s*14px;/);
    expect(css).toMatch(/\.map-hud-pod\.top-right\s*\{[^}]*top:\s*12px;[^}]*right:\s*14px;/);
    expect(css).toMatch(/\.coord-chip-wrap\s*\{[^}]*top:\s*8px\s*!important;[^}]*left:\s*8px\s*!important;/);
    expect(css).toMatch(/\.map-hud-pod\.top-right\s*\{[^}]*top:\s*8px\s*!important;[^}]*right:\s*8px\s*!important;/);
  });

  it("2. Tool atas kanan (map-hud-pod) dan rail alat bawah kanan sejajar pada tepi kanan (right: 14px)", () => {
    expect(css).toMatch(/\.map-hud-pod\.top-right\s*\{[^}]*right:\s*14px;/);
    expect(css).toMatch(/\.map-tool-rail\s*\{[^}]*right:\s*14px;/);
    expect(css).toContain("right: 14px !important;");
  });

  it("3. Chip koordinat memiliki max-width aman agar tidak overlap secara horizontal dengan tool kanan", () => {
    expect(css).toContain("max-width: calc(100% - 76px);");
    expect(css).toContain("max-width: calc(100% - 56px) !important;");
  });

  it("4. Rail alat peta memiliki max-height dan overflow aman agar tidak menabrak tool pod atas kanan dan memberi space", () => {
    expect(css).toContain("max-height: calc(100% - 170px);");
    expect(css).toContain("overflow-y: auto;");
  });
});
