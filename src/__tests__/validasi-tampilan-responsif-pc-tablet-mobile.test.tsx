// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import fs from "fs";
import path from "path";
import { KomunikasiView } from "../components/KomunikasiView";
import { PanelDataUserLevel } from "../components/PanelDataUserLevel";
import { RewardView } from "../components/RewardView";
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

    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain(".reward-hero-card.reward-hero-card-wide");
    expect(css).toContain("grid-column: 1 / -1;");
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

  it("9. Pustaka segmented control dan menu pencarian diperpanjang di PC (max-width 760px/880px) tanpa mengubah ukuran mobile (340px)", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain(".avenza-segmented-control");
    expect(css).toContain("max-width: 760px;");
    expect(css).toContain("max-width: 880px;");
    expect(css).toContain(".avenza-search-bar");
    expect(css).toContain("max-width: 340px;");
  });

  it("10. Fitur HOK dihapus sepenuhnya dari tab sertifikat (RewardView)", () => {
    const rewardTsxPath = path.resolve(__dirname, "../components/RewardView.tsx");
    const rewardCode = fs.readFileSync(rewardTsxPath, "utf8");

    expect(rewardCode).not.toContain("BukuHokPanel");

    const html = renderToString(
      <RewardView
        dataSpasial={[mockItemSurvey]}
        profil={mockProfil}
        peran="admin"
        sertifikatList={[]}
        pesanList={[]}
        tugasList={[]}
        onUbahProfil={() => {}}
      />
    );

    expect(html).not.toContain("buku-hok");
    expect(html).not.toContain("Insentif HOK");
  });

  it("11. Peta interaktif pilihan lapisan diperkecil proporsional (max-width 320px) dan popover koordinat anti-overlap", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain(".avenza-layers-modal");
    expect(css).toContain("max-width: 320px;");
    expect(css).toContain(".coord-crs-popover");
    expect(css).toContain("z-index: 50;");
  });

  it("12. Bagian level kader di Data User & Level Kader tidak overlap kotak (border-radius 8px, white-space nowrap)", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain(".kader-tier-badge");
    expect(css).toContain("border-radius: 8px;");
    expect(css).toContain("white-space: nowrap;");
  });

  it("13. View kolom/grid di pustaka ditengahkan (justify-content: center) dan kartu tertata rapi", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain(".pustaka-field .pustaka-grid");
    expect(css).toContain("justify-content: center;");
    expect(css).toContain(".pustaka-field .pustaka-grid .avenza-map-row");
    expect(css).toContain("display: flex;");
    expect(css).toContain("flex-direction: column;");
  });

  it("14. Pustaka view list & kolom ke tengah semua, hilangkan kotak overlap pada pilihan peta/lapisan, dan form kader anti-overlap", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    // View list ditengahkan
    expect(css).toContain(".pustaka-field .avenza-map-list:not(.pustaka-grid)");
    expect(css).toContain("align-items: center;");

    // Pilihan peta & lapisan tidak memiliki kotak outline tambahan / overlap saat dipilih
    expect(css).toContain(".avenza-segment-btn:focus");
    expect(css).toContain("outline: none !important;");

    // Form kader (HOK) menggunakan flex-wrap responsif anti-overlap
    expect(css).toContain(".hok-inputs-flex");
    expect(css).toContain("flex-wrap: wrap;");
    expect(css).toContain(".admin-subnav-btn");
  });

  it("15. Pustaka pill terbaru dan semua item terstruktur rapi dengan ikon absolut, space tipis anti-mentok, dan tombol segmen rapi dalam bingkai", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    // Segmented control button tidak menonjol keluar dan memiliki concentric border-radius
    expect(css).toContain(".avenza-segmented-control");
    expect(css).toContain(".avenza-segment-btn.active");
    expect(css).toContain("border-radius: 8px;");

    // Pill Terbaru & Semua item memiliki padding terstruktur dan posisi ikon absolut
    expect(css).toContain(".avenza-pill-select-wrap");
    expect(css).toContain("padding: 0 28px 0 32px;");
    expect(css).toContain(".avenza-pill-icon");
    expect(css).toContain("position: absolute;");
    expect(css).toContain("left: 10px;");
    expect(css).toContain(".avenza-pill-caret");
    expect(css).toContain("right: 10px;");

    // Space tipis anti-mentok untuk baris filter dan search bar
    expect(css).toContain(".avenza-filter-row");
    expect(css).toContain("padding: 8px 14px 10px;");
    expect(css).toContain("width: calc(100% - 28px);");
  });

  it("16. Pustaka semua mode view ditengahkan, menu admin subnav anti-overlap, dan CSS brace seimbang", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    // Verifikasi CSS brace balance = 0 (tidak ada unclosed media query yang mematikan style PC)
    let balance = 0;
    for (const char of css) {
      if (char === "{") balance++;
      if (char === "}") balance--;
    }
    expect(balance).toBe(0);

    // Pustaka mode grid/kolom ditengahkan secara rapi menggunakan auto-fit
    expect(css).toContain(".pustaka-field .pustaka-grid");
    expect(css).toContain("repeat(auto-fit, minmax(210px, 260px))");
    expect(css).toContain("justify-content: center;");

    // Menu admin subnav User & Level dan Data anti-overlap (min-width: 0 dan overflow: hidden)
    expect(css).toContain(".admin-subnav-btn");
    expect(css).toContain("min-width: 0;");
    expect(css).toContain("overflow: hidden;");
    expect(css).not.toContain("min-width: max-content;");

    // Data User & Level Kader kartu memiliki styling lengkap (border-radius 18px & shadow)
    expect(css).toContain(".kader-user-level-card");
    expect(css).toContain("border-radius: 18px;");
  });

  it("17. Revisi responsif diskusi mobile anti-overlap, peta HUD/rail mobile kompak, pustaka segmented bebas double-box, dan filter/kolom centered", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    // 1. Tab diskusi label responsif dan grid 1fr 1fr di mobile
    expect(css).toContain(".seg-label-desktop");
    expect(css).toContain(".seg-label-mobile");
    expect(css).toContain("grid-template-columns: 1fr 1fr;");

    // 2. Peta interaktif HUD pod dan rail kompak di mobile
    expect(css).toContain(".map-hud-pod.top-right");
    expect(css).toContain("max-height: calc(100vh - 210px) !important;");

    // 3. Pustaka segmented control seamless anti double-box
    expect(css).toContain(".pustaka-field .avenza-segmented-control");
    expect(css).toContain("overflow: hidden;");
    expect(css).toContain("min-height: 0 !important;");

    // 4. Pustaka filter row mobile 1 baris kompak
    expect(css).toContain(".avenza-pills-left");
    expect(css).toContain("flex-wrap: nowrap !important;");
    expect(css).toContain("flex: 1 1 0 !important;");

    // 5. Pustaka mode kolom/grid selalu ke tengah di mobile dan PC
    expect(css).toContain(".pustaka-field .pustaka-grid .avenza-map-row");
    expect(css).toContain("max-width: 270px;");
    expect(css).toContain("margin: 0 auto;");
  });

  it("18. PanelDataUserLevel kartu kader mobile anti-overlap dari kotak aplikasi", () => {
    const cssPath = path.resolve(__dirname, "../styles/app.css");
    const css = fs.readFileSync(cssPath, "utf8");

    // Grid kolom menggunakan minmax(0, 1fr) agar tidak meluber keluar kotak aplikasi
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");

    // Kartu kader memiliki lebar 100%, overflow hidden, dan min-width: 0
    expect(css).toContain(".kader-user-level-card {");
    expect(css).toContain("max-width: 100%;");
    expect(css).toContain("overflow: hidden;");

    // Strip metrik tidak memaksakan lebar di mobile
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");

    // Profil wrap dan nama kader terpotong rapi dengan ellipsis jika nama panjang
    expect(css).toContain("text-overflow: ellipsis;");
    expect(css).toContain(".kader-tier-badge {");
  });
});
