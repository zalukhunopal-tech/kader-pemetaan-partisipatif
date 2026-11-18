// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PeekSheetInteraktif } from "../components/peta/PeekSheetInteraktif";
import { PanelPerekaman } from "../components/peta/PanelPerekaman";
import { PESAN_TEKAN_KEMBALI_LAGI } from "../lib/penjagaKembali";
import { DataSpasialItem } from "../types";
import { StatePerekamLatar } from "../lib/perekamLatar";

const AKAR = resolve(__dirname, "..");

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const contohArea: DataSpasialItem = {
  id: "area-1",
  idKader: "KDR-001",
  namaKader: "Kader Uji",
  desaWilayah: "Desa Rimba",
  kategori: "Tanda Batas",
  judul: "Area 1",
  deskripsi: "Area contoh",
  jenisGeometri: "polygon",
  koordinat: [
    { lat: 3.94, lng: 115.99 },
    { lat: 3.95, lng: 116.0 },
    { lat: 3.94, lng: 116.01 },
    { lat: 3.93, lng: 116.0 }
  ],
  panjangKm: 0,
  luasHa: 225,
  lapisanNama: "Lapisan 1",
  statusSinkron: "lokal",
  createdAt: "2026-11-19T07:08:00.000Z",
  updatedAt: "2026-11-19T07:08:00.000Z",
  riwayatPembaruan: []
};

const contohPoint: DataSpasialItem = {
  ...contohArea,
  id: "pt-1",
  judul: "Titik Mata Air",
  jenisGeometri: "point",
  koordinat: [{ lat: 3.904544, lng: 115.986396 }],
  luasHa: 0
};

describe("Validasi 7 Perbaikan Peta, Splash, Back, PeekSheet, Konversi Area, Verifikasi, dan TTD", () => {
  it("1. Bug titik oranye tidak tertinggal: petaKanvas melewati mode point dan InteractiveMap tidak memulihkan draft point", () => {
    const petaKanvas = readFileSync(resolve(AKAR, "lib/petaKanvas.ts"), "utf8").replace(/\r\n/g, "\n");
    const interactiveMap = readFileSync(resolve(AKAR, "components/InteractiveMap.tsx"), "utf8").replace(/\r\n/g, "\n");

    expect(petaKanvas).toContain('if (modeRekam && modeRekam !== "point" && titikDraft.length > 0)');
    expect(interactiveMap).toContain('if (form.rekaman?.jenis && form.rekaman.jenis !== "point")');
    expect(interactiveMap).toContain('if (modeRekam === "point") {\n      simpanGeometri(null, []);');
  });

  it("2. Logo Titik Tapak tampil satu kali tanpa garis putih di sekelilingnya", () => {
    const indexHtml = readFileSync(resolve(AKAR, "../index.html"), "utf8").replace(/\r\n/g, "\n");
    const layarPembuka = readFileSync(resolve(AKAR, "components/LayarPembukaTaka.tsx"), "utf8").replace(/\r\n/g, "\n");
    const genIcons = readFileSync(resolve(AKAR, "../scripts/generate-icons.mjs"), "utf8").replace(/\r\n/g, "\n");

    expect(indexHtml).not.toContain("initial-app-splash");
    expect(layarPembuka).toContain("display-mode: standalone");
    expect(layarPembuka).toContain("withBackground={false}");
    expect(genIcons).toContain('{ svg: maskableSvg, size: 512, out: "public/icon-512.png", transparent: false }');
  });

  it("3. Pengaman Back 2 kali untuk keluar dan Peta Interaktif sebagai default home terakhir", () => {
    const appSrc = readFileSync(resolve(AKAR, "App.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(PESAN_TEKAN_KEMBALI_LAGI.toLowerCase()).toContain("tekan back 2 kali untuk keluar");
    expect(appSrc).toContain('const bawaan: MenuTab = "peta"');
    expect(appSrc).toContain('if (tabAktif !== "peta") {\n      setTabAktif("peta");\n      return true;');
    expect(appSrc).toContain("pastikanRiwayatPenjaga()");
  });

  it("4. PeekSheetInteraktif menampilkan mode sederhana untuk Area/Point/Line dan mode detail lengkap dengan swipe dua arah", () => {
    // Mode ringkas Area: judul, luas (km2), perimeter (km), lapisan, tombol Beri tahu dan Hapus
    const htmlAreaRingkas = renderToString(
      <PeekSheetInteraktif
        mode="objek_terpilih"
        objekTerpilih={contohArea}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
        onHapus={vi.fn()}
      />
    );
    expect(htmlAreaRingkas).toContain("tahap-ringkas");
    expect(htmlAreaRingkas).toContain("Area 1");
    expect(htmlAreaRingkas).toContain("2,25 km²");
    expect(htmlAreaRingkas).toContain("Lapisan 1");
    expect(htmlAreaRingkas).toContain("Beri tahu");
    expect(htmlAreaRingkas).toContain("Hapus");

    // Mode detail Area (saat di-swipe ke atas): Area, Perimeter, Lapisan saat ini, Edit Lapisan, Foto, Deskripsi, Corak, Jingga area, Dibuat, Skema atribut
    const htmlAreaDetail = renderToString(
      <PeekSheetInteraktif
        mode="objek_terpilih"
        tahapAwal="penuh"
        objekTerpilih={contohArea}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
        onHapus={vi.fn()}
      />
    );
    expect(htmlAreaDetail).toContain("tahap-penuh");
    expect(htmlAreaDetail).toContain("Nama");
    expect(htmlAreaDetail).toContain("Area");
    expect(htmlAreaDetail).toContain("Perimeter");
    expect(htmlAreaDetail).toContain("Lapisan saat ini");
    expect(htmlAreaDetail).toContain("Edit Lapisan");
    expect(htmlAreaDetail).toContain("Foto");
    expect(htmlAreaDetail).toContain("Deskripsi");
    expect(htmlAreaDetail).toContain("Corak");
    expect(htmlAreaDetail).toContain("Jingga area");
    expect(htmlAreaDetail).toContain("Dibuat");
    expect(htmlAreaDetail).toContain("Skema atribut");
    expect(htmlAreaDetail).toContain("Ciutkan kartu ke mode ringkas");

    // Mode ringkas Point tersimpan: koordinat, Navigasi, Bagikan, Hapus
    const htmlPointRingkas = renderToString(
      <PeekSheetInteraktif
        mode="objek_terpilih"
        objekTerpilih={contohPoint}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
        onHapus={vi.fn()}
      />
    );
    expect(htmlPointRingkas).toContain("Titik Mata Air");
    expect(htmlPointRingkas).toContain("3.904544, 115.986396");
    expect(htmlPointRingkas).toContain("Navigasi");
    expect(htmlPointRingkas).toContain("Bagikan");
    expect(htmlPointRingkas).toContain("Hapus");
  });

  it("5. Fitur Gambar dan Ukur menyediakan konversi Line menjadi Area dan Area menjadi Line", () => {
    const mockState: StatePerekamLatar = {
      status: "dijeda",
      jenis: "line",
      titik: [
        { lat: 3.94, lng: 115.99 },
        { lat: 3.95, lng: 116.0 },
        { lat: 3.94, lng: 116.01 }
      ],
      mulaiPada: new Date().toISOString(),
      durasiTersimpanMs: 0,
      segmenMulaiMs: null,
      autoGpsAktif: false,
      redoVertex: [],
      posisiTerakhir: null,
      galat: null
    };

    const htmlLine = renderToString(
      <PanelPerekaman
        rekamLatar={mockState}
        modeRekam="line"
        modeGambarUkur={true}
        jumlahTitik={3}
        panjangDraftKm={5.65}
        luasDraftHa={0}
        detikTick={0}
        onTambahTitik={vi.fn()}
        onBukaPanel={vi.fn()}
        onSimpan={vi.fn()}
        onBatal={vi.fn()}
        onPilihJenisUkur={vi.fn()}
      />
    );
    expect(htmlLine).toContain("Jarak total: 5,65 km");
    expect(htmlLine).toContain("Segmen");
    expect(htmlLine).toContain("Konversi ke Area");
    expect(htmlLine).toContain('aria-label="Konversi ke area"');

    const htmlArea = renderToString(
      <PanelPerekaman
        rekamLatar={{ ...mockState, jenis: "polygon" }}
        modeRekam="polygon"
        modeGambarUkur={true}
        jumlahTitik={3}
        panjangDraftKm={5.65}
        luasDraftHa={199}
        detikTick={0}
        onTambahTitik={vi.fn()}
        onBukaPanel={vi.fn()}
        onSimpan={vi.fn()}
        onBatal={vi.fn()}
        onPilihJenisUkur={vi.fn()}
      />
    );
    expect(htmlArea).toContain("Area total: 1,99 km²");
    expect(htmlArea).toContain("Perimeter");
    expect(htmlArea).toContain("Jadi Garis");
    expect(htmlArea).toContain('aria-label="Konversi ke garis"');
  });

  it("6. Seluruh kata sahkan di UI telah diganti menjadi verifikasi", () => {
    const adminSrc = readFileSync(resolve(AKAR, "components/AdminDashboardView.tsx"), "utf8");
    const hokSrc = readFileSync(resolve(AKAR, "components/BukuHokPanel.tsx"), "utf8");
    const appSrc = readFileSync(resolve(AKAR, "App.tsx"), "utf8");

    expect(adminSrc).not.toMatch(/\bsahkan\b/i);
    expect(hokSrc).not.toMatch(/\bsahkan\b/i);
    expect(appSrc).not.toMatch(/\b(sahkan|disahkan|mengesahkan)\b/i);
    expect(adminSrc).toContain("Verifikasi");
    expect(hokSrc).toContain("Verifikasi sesi");
  });

  it("7. Menu input tanda tangan di AdminDashboardView dan RewardView seragam dan simetris", () => {
    const adminSrc = readFileSync(resolve(AKAR, "components/AdminDashboardView.tsx"), "utf8");
    const rewardSrc = readFileSync(resolve(AKAR, "components/RewardView.tsx"), "utf8");
    const appCss = readFileSync(resolve(AKAR, "styles/app.css"), "utf8");

    expect(adminSrc).toContain("admin-signer-fields");
    expect(adminSrc).toContain("admin-signer-ttd-row");
    expect(adminSrc).toContain("admin-signer-ttd-preview");
    expect(rewardSrc).toContain("cert-signer-fields-grid");
    expect(rewardSrc).toContain("cert-signer-action-group");
    expect(rewardSrc).toContain("admin-signer-ttd-row");
    expect(appCss).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(appCss).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
  });
});
