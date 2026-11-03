// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import fs from "fs";
import path from "path";
import { KomunikasiView } from "../components/KomunikasiView";
import { PanelDataUserLevel } from "../components/PanelDataUserLevel";
import { ProfilKader, DataSpasialItem } from "../types";

const mockProfil: ProfilKader = {
  idKader: "KAD-BULUNGAN-01",
  nama: "Rian Hidayat",
  desaWilayah: "Tanjung Selor Hilir",
  kelompokMasyarakat: "Kader Konservasi Kayan",
  noHp: "081234567890",
  namaOrganisasi: "Komunitas Konservasi Kayan",
  modeKombinasiTarget: "per_kategori"
};

const mockItemSurvey: DataSpasialItem = {
  id: "DAT-001",
  idKader: "KAD-BULUNGAN-01",
  namaKader: "Rian Hidayat",
  desaWilayah: "Tanjung Selor Hilir",
  judul: "Pohon Ulin Tua",
  kategori: "Flora",
  jenisGeometri: "point",
  koordinat: [{ lat: 2.8571, lng: 117.3775, akurasi: 2.4 }],
  deskripsi: "Pohon ulin diameter 80cm",
  panjangKm: 0,
  luasHa: 0,
  riwayatPembaruan: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  statusSinkron: "tersinkron"
};

describe("Validasi Tata Letak Responsif: PC, Tablet & Mobile (Anti Empty Space & Anti Overlap)", () => {
  it("1. App.tsx tidak lagi memecah panel admin/sync menjadi gis-split-workspace 42% yang meninggalkan 58% layar hampa", () => {
    const appTsxPath = path.resolve(__dirname, "../App.tsx");
    const appCode = fs.readFileSync(appTsxPath, "utf8");

    // Pastikan <main className="app-main ..."> tidak mengandung pemecah 2-kolom sepihak
    expect(appCode).not.toContain('desktop && (tabAktif === "admin" || tabAktif === "data_sync") ? "gis-split-workspace" : ""');
  });

  it("2. app.css mendefinisikan kontainer terukur (.page-container & .section-card) dengan fluid sizing untuk PC, tablet, dan HP", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    // Cek kontainer utama
    expect(css).toContain("max-width: 1240px;");
    expect(css).toContain(".avenza-pustaka-container");
    expect(css).toContain("@media (min-width: 640px)");
    expect(css).toContain("@media (min-width: 1024px)");

    // Cek normalisasi card
    expect(css).toContain("border-radius: clamp(12px, 1.3vw, 16px);");
  });

  it("3. Pustaka peta otomatis beralih menjadi responsive card grid pada tablet & PC (>=768px)", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain("@media (min-width: 768px)");
    expect(css).toContain("repeat(auto-fill, minmax(340px, 1fr))");
  });

  it("4. DatabaseSync pipeline 3-tahap menumpuk vertikal dengan panah rotasi 90 derajat di mobile (<=520px) agar teks tidak tumpang tindih", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain("@media (max-width: 520px)");
    expect(css).toContain("transform: rotate(90deg);");
  });

  it("5. Subnav menu admin adaptif otomatis di mobile dan PC dengan auto-fit", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain("repeat(auto-fit, minmax(105px, 1fr))");
    expect(css).toContain("repeat(6, minmax(0, 1fr))");
  });

  it("6. Tab Reward Hero Grid responsif dengan auto-fit di mobile tanpa memotong angka atau label capaian", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain("repeat(auto-fit, minmax(130px, 1fr))");
  });

  it("7. PanelDataUserLevel kartu grid responsif (minmax 310px di tablet) dan pil metrik fleksibel tanpa overflow", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain("repeat(auto-fill, minmax(310px, 1fr))");

    // Render PanelDataUserLevel
    const html = renderToString(
      <PanelDataUserLevel
        dataSpasial={[mockItemSurvey]}
        profilSaya={mockProfil}
        peranPengguna="admin"
        onFokusPetaKader={() => {}}
      />
    );

    expect(html).toContain("panel-user-cards-grid");
    expect(html).toContain("kader-user-level-card");
    expect(html).toContain("Rian Hidayat");
  });

  it("8. KomunikasiView menggunakan wadah terpusat berukuran proporsional (max-width 1100px) di PC", () => {
    const html = renderToString(
      <KomunikasiView
        pesanList={[]}
        profil={mockProfil}
        peranPengguna="admin"
        onKirimPesan={() => {}}
        onLihatPinDiPeta={() => {}}
      />
    );

    expect(html).toContain("komunikasi-wrapper");
    expect(html).toContain("max-width:1100px");
  });
});
