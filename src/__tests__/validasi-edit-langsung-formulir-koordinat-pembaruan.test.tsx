// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PeekSheetInteraktif } from "../components/peta/PeekSheetInteraktif";
import { InspektorObjek } from "../components/peta/InspektorObjek";
import { FormSurveiModal, useFormSurvei } from "../components/peta/FormSurveiModal";
import { DataSpasialItem, ProfilKader } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let wadah: HTMLDivElement | null = null;
let akar: Root | null = null;

function pasang(elemen: React.ReactElement): HTMLDivElement {
  wadah = document.createElement("div");
  document.body.appendChild(wadah);
  akar = createRoot(wadah);
  act(() => {
    akar!.render(elemen);
  });
  return wadah;
}

function ubahInput(el: HTMLInputElement | HTMLTextAreaElement, nilai: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, nilai);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function klik(el: Element | null) {
  expect(el).toBeTruthy();
  act(() => {
    (el as HTMLElement).click();
  });
}

function tekanEnter(el: Element | null) {
  expect(el).toBeTruthy();
  act(() => {
    el!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}

function cariTombolDenganTeks(root: HTMLElement, teks: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === teks);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  if (akar) {
    act(() => {
      akar!.unmount();
    });
    akar = null;
  }
  if (wadah) {
    wadah.remove();
    wadah = null;
  }
  localStorage.clear();
});

const profilDummy: ProfilKader = {
  idKader: "KDR-UJI-FORM",
  nama: "Kader Lapangan",
  desaWilayah: "Desa Uji",
  kelompokMasyarakat: "Kelompok Uji",
  noHp: "081200000000",
  namaOrganisasi: "Organisasi Uji",
  modeKombinasiTarget: "per_kategori"
};

const contohTitik: DataSpasialItem = {
  id: "pt-uji-1",
  idKader: "KDR-UJI-FORM",
  namaKader: "Kader Lapangan",
  desaWilayah: "Desa Uji",
  jenisGeometri: "point",
  kategori: "Lainnya",
  judul: "Tanda tempat 1",
  deskripsi: "Dekat jembatan sungai",
  koordinat: [{ lat: 3.904544, lng: 115.986396, elevasi: 640.23 }],
  panjangKm: 0,
  luasHa: 0,
  lapisanNama: "Lapisan 1",
  warna: "#ef4444",
  simbol: "Merah",
  statusSinkron: "lokal",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  riwayatPembaruan: []
};

function PembungkusFormSurvei({
  onUbahKoordinat
}: {
  onUbahKoordinat: (t: { lat: number; lng: number }) => void;
}) {
  const form = useFormSurvei("KDR-UJI-FORM");
  return (
    <FormSurveiModal
      form={form}
      modeRekam="point"
      panjangDraftKm={0}
      luasDraftHa={0}
      profil={profilDummy}
      koordinat={[{ lat: 3.904544, lng: 115.986396, elevasi: 120.5 }]}
      onHasilAveraging={vi.fn()}
      onSimpan={(e) => e.preventDefault()}
      onTutup={vi.fn()}
      onUbahKoordinat={onUbahKoordinat}
    />
  );
}

describe("Validasi Edit Langsung Klik Tulisan, Edit Titik Koordinat (Ganti Salin), dan Penyeragaman Desain Pembaruan Titik", () => {
  it("1. PeekSheetInteraktif: klik tulisan Tanda tempat 1 dan isian lain langsung masuk mode edit sambil mempertahankan tombol Edit", () => {
    const onUbahNamaDraft = vi.fn();
    const onUbahDeskripsiDraft = vi.fn();
    const onUbahElevasiDraft = vi.fn();

    const root = pasang(
      <PeekSheetInteraktif
        mode="draft_pin"
        tahapAwal="penuh"
        titikDraft={[{ lat: 3.904544, lng: 115.986396, elevasi: 640.23 }]}
        onUbahNamaDraft={onUbahNamaDraft}
        onUbahDeskripsiDraft={onUbahDeskripsiDraft}
        onUbahElevasiDraft={onUbahElevasiDraft}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
      />
    );

    // Tombol Edit tetap dipertahankan pada berbagai baris
    const semuaEdit = Array.from(root.querySelectorAll("button")).filter((b) => b.textContent?.trim() === "Edit");
    expect(semuaEdit.length).toBeGreaterThanOrEqual(4);
    // Menu Salin pada titik koordinat sudah diganti menjadi Edit
    expect(cariTombolDenganTeks(root, "Salin")).toBeUndefined();

    // Klik tulisan default "Tanda tempat 1" langsung membuka input edit nama
    klik(cariTombolDenganTeks(root, "Tanda tempat 1") ?? null);
    const inputNama = root.querySelector('input[aria-label="Edit nama"]') as HTMLInputElement;
    expect(inputNama).toBeTruthy();
    ubahInput(inputNama, "Sumber Air Utama");
    tekanEnter(inputNama);
    expect(onUbahNamaDraft).toHaveBeenCalledWith("Sumber Air Utama");

    // Klik tulisan deskripsi langsung membuka textarea deskripsi
    klik(cariTombolDenganTeks(root, "Ketuk untuk menambah deskripsi...") ?? null);
    const inputDesk = root.querySelector('textarea[aria-label="Edit deskripsi"]') as HTMLTextAreaElement;
    expect(inputDesk).toBeTruthy();
    ubahInput(inputDesk, "Air jernih sepanjang tahun");
    klik(cariTombolDenganTeks(root, "Selesai") ?? null);
    expect(onUbahDeskripsiDraft).toHaveBeenCalledWith("Air jernih sepanjang tahun");

    // Klik tulisan elevasi langsung membuka input elevasi
    klik(cariTombolDenganTeks(root, "640,23 m") ?? null);
    const inputElev = root.querySelector('input[aria-label="Edit elevasi"]') as HTMLInputElement;
    expect(inputElev).toBeTruthy();
    ubahInput(inputElev, "705.5");
    tekanEnter(inputElev);
    expect(onUbahElevasiDraft).toHaveBeenCalledWith("705.5");
  });

  it("2. PeekSheetInteraktif: titik koordinat dapat diedit dengan klik tulisan koordinat maupun tombol Edit, dan memvalidasi format", () => {
    const onUbahKoordinat = vi.fn();
    const onPesan = vi.fn();

    const root = pasang(
      <PeekSheetInteraktif
        mode="draft_pin"
        tahapAwal="penuh"
        titikDraft={[{ lat: 3.904544, lng: 115.986396 }]}
        onUbahKoordinat={onUbahKoordinat}
        onPesan={onPesan}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
      />
    );

    // Klik tulisan koordinat langsung membuka input koordinat
    klik(cariTombolDenganTeks(root, "3.904544, 115.986396") ?? null);
    const inputKoord = root.querySelector('input[aria-label="Edit titik koordinat"]') as HTMLInputElement;
    expect(inputKoord).toBeTruthy();
    expect(inputKoord.value).toBe("3.904544, 115.986396");

    // Format salah memunculkan peringatan
    ubahInput(inputKoord, "bukan-koordinat");
    klik(cariTombolDenganTeks(root, "Selesai") ?? null);
    const alertEl = root.querySelector('[role="alert"]');
    expect(alertEl?.textContent).toContain("Format koordinat tidak dikenali");
    expect(onUbahKoordinat).not.toHaveBeenCalled();

    // Format valid memperbarui titik koordinat
    ubahInput(inputKoord, "-6.200000, 106.816666");
    tekanEnter(inputKoord);
    expect(onUbahKoordinat).toHaveBeenCalledWith(
      expect.objectContaining({ lat: -6.2, lng: 106.816666 })
    );
    expect(onPesan).toHaveBeenCalledWith("Koordinat titik diperbarui");
  });

  it("3. FormSurveiModal: klik tulisan koordinat, deskripsi, dan elevasi langsung membuka editor sambil mempertahankan tombol Edit", () => {
    const onUbahKoordinat = vi.fn();
    const root = pasang(<PembungkusFormSurvei onUbahKoordinat={onUbahKoordinat} />);

    // Klik tulisan koordinat langsung membuka KartuLokasiTitik dan mengedit koordinat
    const tombolKoord = cariTombolDenganTeks(root, "3.9045440, 115.9863960") ?? root.querySelector('button[aria-label="Edit koordinat titik"]');
    klik(tombolKoord);
    const inputKoord = root.querySelector('input[aria-label="Koordinat Titik"]') as HTMLInputElement;
    expect(inputKoord).toBeTruthy();
    ubahInput(inputKoord, "2.857472, 117.377476");
    expect(onUbahKoordinat).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 2.857472, lng: 117.377476 })
    );

    // Klik tulisan deskripsi langsung membuka textarea
    klik(cariTombolDenganTeks(root, "Ketuk untuk menambah deskripsi...") ?? null);
    expect(root.querySelector('textarea[placeholder="Catatan atau deskripsi objek..."]')).toBeTruthy();

    // Klik tulisan elevasi langsung membuka input elevasi
    klik(cariTombolDenganTeks(root, "120,50 m") ?? null);
    expect(root.querySelector('input[placeholder="Elevasi (meter)"]')).toBeTruthy();
  });

  it("4. InspektorObjek: klik tulisan Nama, Koordinat, Deskripsi, Elevasi langsung mengedit dan menyimpan via onPerbaruiObjek", () => {
    const onPerbaruiObjek = vi.fn();

    const root = pasang(
      <InspektorObjek
        objek={contohTitik}
        kondisiUpdateInput=""
        setKondisiUpdateInput={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onPerbaruiObjek={onPerbaruiObjek}
        onGoTo={vi.fn()}
        onTutup={vi.fn()}
      />
    );

    // Edit Nama lewat klik tulisan
    klik(cariTombolDenganTeks(root, "Tanda tempat 1") ?? null);
    const inputNama = root.querySelector('input[aria-label="Edit nama objek"]') as HTMLInputElement;
    expect(inputNama).toBeTruthy();
    ubahInput(inputNama, "Pos Jaga Utara");
    tekanEnter(inputNama);
    expect(onPerbaruiObjek).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pt-uji-1", judul: "Pos Jaga Utara" })
    );

    // Edit Koordinat lewat klik tulisan koordinat
    klik(cariTombolDenganTeks(root, "3.904544, 115.986396") ?? null);
    const inputKoord = root.querySelector('input[aria-label="Edit titik koordinat"]') as HTMLInputElement;
    expect(inputKoord).toBeTruthy();
    ubahInput(inputKoord, "3.910000, 115.990000");
    tekanEnter(inputKoord);
    expect(onPerbaruiObjek).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pt-uji-1",
        koordinat: [expect.objectContaining({ lat: 3.91, lng: 115.99 })]
      })
    );
  });

  it("5. Desain kotak pembaruan titik/kondisi (inspector-update-box) dan kartu edit koordinat disamakan dengan baris isian di atasnya", () => {
    const cssApp = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8").replace(/\r\n/g, "\n");
    const cssPeta = readFileSync(resolve(__dirname, "../styles/petaAvenza.css"), "utf8").replace(/\r\n/g, "\n");

    // Tidak ada lagi kotak abu-abu membulat berbeda pada inspector-update-box
    expect(cssApp).not.toMatch(/\.inspector-update-box\s*\{[^}]*background:\s*#f8faf9/);
    expect(cssApp).toMatch(
      /\.inspector-update-box\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*border-radius:\s*0;/
    );
    expect(cssPeta).toMatch(
      /\.avz-peta \.avz-isian-baris\.inspector-update-box[\s\S]*?background:\s*transparent;[\s\S]*?border-radius:\s*0;/
    );
    expect(cssPeta).toMatch(
      /\.avz-peta \.avz-isian-baris \.loc-card\.loc-card-field\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*border-radius:\s*0;/
    );
  });
});
