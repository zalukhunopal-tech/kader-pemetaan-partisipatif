// @vitest-environment jsdom
// @ts-expect-error React act environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardView } from "../components/AdminDashboardView";
import { ProfilKader } from "../types";

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

function klik(el: Element | null) {
  expect(el).toBeTruthy();
  act(() => {
    (el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  wadah = null;
  akar = null;
});

afterEach(() => {
  if (akar && wadah) {
    act(() => {
      akar?.unmount();
    });
    wadah.remove();
  }
});

describe("Pemilihan Tipe Data: Tersembunyi dengan Label Tipe Data, Penanda Warna Berbeda, dan Kembali Semula Saat Dipilih Dua Kali", () => {
  const profilAdmin: ProfilKader = {
    idKader: "ADM-001",
    nama: "Admin Wilayah",
    desaWilayah: "KKI Warsi",
    kelompokMasyarakat: "Staff Warsi",
    noHp: "08123456789",
    namaOrganisasi: "KKI Warsi",
    modeKombinasiTarget: "per_kategori"
  };

  it("1. Secara default pemilihan tipe data tersembunyi dengan label awal Tipe Data", () => {
    const dom = pasang(
      <AdminDashboardView
        dataSpasial={[]}
        profilKader={profilAdmin}
        sertifikatList={[]}
        tugasList={[]}
        kaderAktifList={[]}
        sesiAdmin={null}
        onVerifikasiData={vi.fn()}
        onUbahDataSpasial={vi.fn()}
        onHapusDataSpasial={vi.fn()}
        onTerbitkanSertifikat={vi.fn()}
        onTambahTugas={vi.fn()}
        onHapusTugas={vi.fn()}
        onBalasPesanAdmin={vi.fn()}
        onFokusKePeta={vi.fn()}
      />
    );

    // Buka sub-tab Tugas di admin
    const btnTabTugas = Array.from(dom.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Tugas"
    );
    klik(btnTabTugas || null);

    // Tombol label awal "Tipe Data" harus ada
    const tombolTipeData = dom.querySelector("#tombol-tipe-data");
    expect(tombolTipeData).toBeTruthy();
    expect(tombolTipeData?.textContent).toContain("Tipe Data");

    // Pilihan Point, Line, Polygon harus tersembunyi secara default
    expect(dom.querySelector("#tugas-geom-chip-point")).toBeNull();
    expect(dom.querySelector("#tugas-geom-chip-line")).toBeNull();
    expect(dom.querySelector("#tugas-geom-chip-polygon")).toBeNull();
  });

  it("2. Muncul tipe data apa saja yang mau dibuat formulirnya (Point, Line, Polygon) saat tombol Tipe Data diklik", () => {
    const dom = pasang(
      <AdminDashboardView
        dataSpasial={[]}
        profilKader={profilAdmin}
        sertifikatList={[]}
        tugasList={[]}
        kaderAktifList={[]}
        sesiAdmin={null}
        onVerifikasiData={vi.fn()}
        onUbahDataSpasial={vi.fn()}
        onHapusDataSpasial={vi.fn()}
        onTerbitkanSertifikat={vi.fn()}
        onTambahTugas={vi.fn()}
        onHapusTugas={vi.fn()}
        onBalasPesanAdmin={vi.fn()}
        onFokusKePeta={vi.fn()}
      />
    );

    const btnTabTugas = Array.from(dom.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Tugas"
    );
    klik(btnTabTugas || null);

    // Klik tombol "Tipe Data"
    const tombolTipeData = dom.querySelector("#tombol-tipe-data");
    klik(tombolTipeData);

    // Sekarang pilihan Point, Line, Polygon muncul untuk dibuat formulirnya
    const chipPoint = dom.querySelector("#tugas-geom-chip-point");
    const chipLine = dom.querySelector("#tugas-geom-chip-line");
    const chipPolygon = dom.querySelector("#tugas-geom-chip-polygon");

    expect(chipPoint).toBeTruthy();
    expect(chipLine).toBeTruthy();
    expect(chipPolygon).toBeTruthy();

    expect(chipPoint?.textContent).toContain("Point");
    expect(chipLine?.textContent).toContain("Line");
    expect(chipPolygon?.textContent).toContain("Polygon");
  });

  it("3. Memberi penanda warna yang berbeda ketika dipilih dan kembali seperti semula saat dipilih dua kali", () => {
    const dom = pasang(
      <AdminDashboardView
        dataSpasial={[]}
        profilKader={profilAdmin}
        sertifikatList={[]}
        tugasList={[]}
        kaderAktifList={[]}
        sesiAdmin={null}
        onVerifikasiData={vi.fn()}
        onUbahDataSpasial={vi.fn()}
        onHapusDataSpasial={vi.fn()}
        onTerbitkanSertifikat={vi.fn()}
        onTambahTugas={vi.fn()}
        onHapusTugas={vi.fn()}
        onBalasPesanAdmin={vi.fn()}
        onFokusKePeta={vi.fn()}
      />
    );

    const btnTabTugas = Array.from(dom.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Tugas"
    );
    klik(btnTabTugas || null);

    // Buka Tipe Data
    klik(dom.querySelector("#tombol-tipe-data"));

    const chipPoint = dom.querySelector("#tugas-geom-chip-point");
    const chipLine = dom.querySelector("#tugas-geom-chip-line");
    const chipPolygon = dom.querySelector("#tugas-geom-chip-polygon");

    // KLIK PERTAMA PADA POINT: Memilih Point dengan penanda warna berbeda (biru / terpilih-point)
    klik(chipPoint);
    expect(chipPoint?.className).toContain("terpilih-point");
    expect(chipPoint?.className).toContain("aktif");
    expect(chipPoint?.getAttribute("aria-pressed")).toBe("true");

    // KLIK PERTAMA PADA LINE: Memilih Line dengan penanda warna berbeda (oranye / terpilih-line)
    klik(chipLine);
    expect(chipLine?.className).toContain("terpilih-line");
    expect(chipLine?.className).toContain("aktif");
    expect(chipLine?.getAttribute("aria-pressed")).toBe("true");

    // KLIK PERTAMA PADA POLYGON: Memilih Polygon dengan penanda warna berbeda (zamrud / terpilih-polygon)
    klik(chipPolygon);
    expect(chipPolygon?.className).toContain("terpilih-polygon");
    expect(chipPolygon?.className).toContain("aktif");
    expect(chipPolygon?.getAttribute("aria-pressed")).toBe("true");

    // KLIK KEDUA PADA POINT (dipilih dua kali): kembali seperti semula (tidak terpilih / non-aktif)
    klik(chipPoint);
    expect(chipPoint?.className).not.toContain("aktif");
    expect(chipPoint?.className).not.toContain("terpilih-point");
    expect(chipPoint?.getAttribute("aria-pressed")).toBe("false");

    // KLIK KEDUA PADA LINE (dipilih dua kali): kembali seperti semula
    klik(chipLine);
    expect(chipLine?.className).not.toContain("aktif");
    expect(chipLine?.className).not.toContain("terpilih-line");
    expect(chipLine?.getAttribute("aria-pressed")).toBe("false");

    // KLIK KEDUA PADA POLYGON (dipilih dua kali): kembali seperti semula
    klik(chipPolygon);
    expect(chipPolygon?.className).not.toContain("aktif");
    expect(chipPolygon?.className).not.toContain("terpilih-polygon");
    expect(chipPolygon?.getAttribute("aria-pressed")).toBe("false");

    // Saat seluruh tipe batal dipilih, sistem kembali ke Mode Default Aktif
    expect(dom.textContent).toContain("Mode Default Aktif");
  });

  it("4. Tombol Tipe Data kembali tersembunyi seperti semula ketika diklik dua kali", () => {
    const dom = pasang(
      <AdminDashboardView
        dataSpasial={[]}
        profilKader={profilAdmin}
        sertifikatList={[]}
        tugasList={[]}
        kaderAktifList={[]}
        sesiAdmin={null}
        onVerifikasiData={vi.fn()}
        onUbahDataSpasial={vi.fn()}
        onHapusDataSpasial={vi.fn()}
        onTerbitkanSertifikat={vi.fn()}
        onTambahTugas={vi.fn()}
        onHapusTugas={vi.fn()}
        onBalasPesanAdmin={vi.fn()}
        onFokusKePeta={vi.fn()}
      />
    );

    const btnTabTugas = Array.from(dom.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Tugas"
    );
    klik(btnTabTugas || null);

    const tombolTipeData = dom.querySelector("#tombol-tipe-data");

    // Klik 1: Terbuka
    klik(tombolTipeData);
    expect(dom.querySelector("#tugas-geom-chip-point")).toBeTruthy();

    // Klik 2 (dipilih dua kali): Kembali seperti semula (tersembunyi)
    klik(tombolTipeData);
    expect(dom.querySelector("#tugas-geom-chip-point")).toBeNull();
  });
});
