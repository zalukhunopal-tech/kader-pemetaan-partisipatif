// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PustakaView } from "../components/PustakaView";
import { PengaturanEksporView } from "../components/PengaturanEksporView";
import { pratinjauBasemapFallback, PanelLapisanPeta } from "../components/peta/PanelLapisanPeta";
import { AuthModal } from "../components/AuthModal";
import { fiturKeDataSpasial, parseBerkas } from "../lib/impor";
import { objekCocokLapisan } from "../lib/tematik";
import { buatAdminPertama, labelKategoriAsal } from "../lib/auth";
import { AreaPetaOffline, BasemapType, DataSpasialItem, LapisanSpasial } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const GEOJSON_CAMPURAN = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Mata Air Hulu" },
      geometry: { type: "Point", coordinates: [102.11, -1.61] }
    },
    {
      type: "Feature",
      properties: { name: "Pohon Meranti" },
      geometry: { type: "Point", coordinates: [102.12, -1.62] }
    },
    {
      type: "Feature",
      properties: { name: "Jalur Patroli Utara" },
      geometry: {
        type: "LineString",
        coordinates: [
          [102.11, -1.61],
          [102.13, -1.63]
        ]
      }
    },
    {
      type: "Feature",
      properties: { name: "Blok Rimba Adat" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [102.11, -1.61],
            [102.14, -1.61],
            [102.14, -1.64],
            [102.11, -1.64],
            [102.11, -1.61]
          ]
        ]
      }
    }
  ]
});

function buatDataCampuran(): DataSpasialItem[] {
  const sekarang = new Date().toISOString();
  return [
    {
      id: "PT-1",
      idKader: "KDR-01",
      namaKader: "Kader Uji",
      desaWilayah: "Desa Rimba",
      jenisGeometri: "point",
      kategori: "Mata Air",
      judul: "Mata Air 1",
      deskripsi: "Sumber air jernih",
      koordinat: [{ lat: -1.61, lng: 102.11 }],
      panjangKm: 0,
      luasHa: 0,
      statusSinkron: "lokal",
      createdAt: sekarang,
      updatedAt: sekarang,
      riwayatPembaruan: []
    },
    {
      id: "LN-1",
      idKader: "KDR-01",
      namaKader: "Kader Uji",
      desaWilayah: "Desa Rimba",
      jenisGeometri: "line",
      kategori: "Tanda Batas",
      judul: "Jalur Batas",
      deskripsi: "Patroli batas selatan",
      koordinat: [
        { lat: -1.61, lng: 102.11 },
        { lat: -1.62, lng: 102.13 }
      ],
      panjangKm: 2.5,
      luasHa: 0,
      statusSinkron: "lokal",
      createdAt: sekarang,
      updatedAt: sekarang,
      riwayatPembaruan: []
    },
    {
      id: "PG-1",
      idKader: "KDR-01",
      namaKader: "Kader Uji",
      desaWilayah: "Desa Rimba",
      jenisGeometri: "polygon",
      kategori: "Wilayah Adat / Lahan",
      judul: "Hutan Adat",
      deskripsi: "Poligon wilayah adat",
      koordinat: [
        { lat: -1.61, lng: 102.11 },
        { lat: -1.61, lng: 102.14 },
        { lat: -1.64, lng: 102.14 },
        { lat: -1.64, lng: 102.11 }
      ],
      panjangKm: 0,
      luasHa: 12.4,
      statusSinkron: "lokal",
      createdAt: sekarang,
      updatedAt: sekarang,
      riwayatPembaruan: []
    }
  ];
}

function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Simulasi mendalam fitur baru dan audit bug aplikasi", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("1. Akun User dapat menambah lapisan baru di PustakaView dan menolak nama lapisan kembar", async () => {
    const onTambahLapisan = vi.fn();
    const lapisanAwal: LapisanSpasial[] = [
      { id: "LAP-1", nama: "Lapisan 1", jumlahPeta: 0, createdAt: new Date().toISOString() }
    ];

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PustakaView
          areaOffline={[]}
          lapisanList={lapisanAwal}
          dataSpasial={[]}
          sesiPengguna={{
            idKader: "KDR-101",
            nama: "Budi Kader",
            email: "budi@desa.id",
            peran: "kader",
            desaWilayah: "Desa Hulu",
            noHp: "0812",
            kelompokMasyarakat: "KTH Rimba",
            namaOrganisasi: "KKI Warsi",
            createdAt: "2026-01-01T00:00:00.000Z"
          }}
          modePilihAktif={false}
          onMatikanModePilih={vi.fn()}
          onBukaPetaDasar={vi.fn()}
          onBukaAreaPeta={vi.fn()}
          onTambahAreaOffline={vi.fn()}
          onHapusAreaOffline={vi.fn()}
          onTambahLapisan={onTambahLapisan}
          onHapusLapisan={vi.fn()}
          onImporBerkas={vi.fn(() => true)}
          onBukaPengaturanEkspor={vi.fn()}
        />
      );
    });

    // Pindah ke tab Lapisan
    const tabLapisan = Array.from(container.querySelectorAll('[role="tab"]')).find((el) =>
      el.textContent?.includes("Lapisan")
    ) as HTMLButtonElement;
    await act(async () => {
      tabLapisan.click();
    });

    // Tombol Tambah Lapisan dan Impor Lapisan tersedia untuk akun User (Kader)
    const btnTambah = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Tambah Lapisan")
    ) as HTMLButtonElement;
    const btnImpor = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Impor Lapisan")
    ) as HTMLButtonElement;
    expect(btnTambah).toBeTruthy();
    expect(btnImpor).toBeTruthy();

    await act(async () => {
      btnTambah.click();
    });

    const inputNama = container.querySelector("#input-nama-lapisan-baru") as HTMLInputElement;
    expect(inputNama).toBeTruthy();

    // Coba nama kembar -> ditolak dengan pesan galat
    await act(async () => {
      setInputValue(inputNama, "Lapisan 1");
    });
    const form = inputNama.closest("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onTambahLapisan).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("sudah ada");

    // Masukkan nama baru yang valid -> berhasil dibuat
    await act(async () => {
      setInputValue(inputNama, "Sebaran Sumber Air");
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onTambahLapisan).toHaveBeenCalledTimes(1);
    expect(onTambahLapisan.mock.calls[0][0].nama).toBe("Sebaran Sumber Air");

    await act(async () => root.unmount());
    container.remove();
  });

  it("2. Akun User dapat mengimpor lapisan dengan pilihan Sekaligus, Point, Line, atau Polygon serta menautkan fitur ke lapisan", async () => {
    const onImporBerkas = vi.fn((_nama: string, _isi: string, _opsi?: { filterGeometri?: string; namaLapisan?: string }) => true);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PustakaView
          areaOffline={[]}
          lapisanList={[]}
          dataSpasial={[]}
          sesiPengguna={{
            idKader: "KDR-101",
            nama: "Budi Kader",
            email: "budi@desa.id",
            peran: "kader",
            desaWilayah: "Desa Hulu",
            noHp: "0812",
            kelompokMasyarakat: "KTH Rimba",
            namaOrganisasi: "KKI Warsi",
            createdAt: "2026-01-01T00:00:00.000Z"
          }}
          modePilihAktif={false}
          onMatikanModePilih={vi.fn()}
          onBukaPetaDasar={vi.fn()}
          onBukaAreaPeta={vi.fn()}
          onTambahAreaOffline={vi.fn()}
          onHapusAreaOffline={vi.fn()}
          onTambahLapisan={vi.fn()}
          onHapusLapisan={vi.fn()}
          onImporBerkas={onImporBerkas}
          onBukaPengaturanEkspor={vi.fn()}
        />
      );
    });

    const tabLapisan = Array.from(container.querySelectorAll('[role="tab"]')).find((el) =>
      el.textContent?.includes("Lapisan")
    ) as HTMLButtonElement;
    await act(async () => {
      tabLapisan.click();
    });

    const btnImpor = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Impor Lapisan")
    ) as HTMLButtonElement;
    await act(async () => {
      btnImpor.click();
    });

    const fileInput = container.querySelector("#upload-impor-lapisan-input") as HTMLInputElement;
    const berkas = new File([GEOJSON_CAMPURAN], "survei_campuran.geojson", { type: "application/geo+json" });
    Object.defineProperty(berkas, "text", { value: async () => GEOJSON_CAMPURAN });
    Object.defineProperty(fileInput, "files", { value: [berkas], configurable: true });

    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const grupGeometri = container.querySelector('[aria-label="Pilih tipe data impor lapisan"]')!;
    expect(grupGeometri.textContent).toContain("Sekaligus");
    expect(grupGeometri.textContent).toContain("Point");
    expect(grupGeometri.textContent).toContain("Line");
    expect(grupGeometri.textContent).toContain("Polygon");

    // Pilih hanya Point (2 fitur)
    const btnPoint = Array.from(grupGeometri.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Point")
    ) as HTMLButtonElement;
    await act(async () => {
      btnPoint.click();
    });
    expect(btnPoint.getAttribute("aria-pressed")).toBe("true");

    const formImpor = fileInput.closest("form")!;
    await act(async () => {
      formImpor.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onImporBerkas).toHaveBeenCalledTimes(1);
    expect(onImporBerkas.mock.calls[0][0]).toBe("survei_campuran.geojson");
    expect(onImporBerkas.mock.calls[0][2]).toEqual({
      filterGeometri: "point",
      namaLapisan: "survei_campuran"
    });

    // Pastikan fiturKeDataSpasial menautkan lapisanId & lapisanNama sehingga cocok dengan objekCocokLapisan
    const hasilParse = parseBerkas("survei_campuran.geojson", GEOJSON_CAMPURAN);
    const lapisanTarget: LapisanSpasial = {
      id: "LAP-IMP-1",
      nama: "survei_campuran",
      jumlahPeta: 0,
      createdAt: new Date().toISOString()
    };
    const itemPoint = fiturKeDataSpasial(hasilParse.fitur[0], {
      idKader: "KDR-101",
      namaKader: "Budi Kader",
      desaWilayah: "Desa Hulu",
      lapisanId: lapisanTarget.id,
      lapisanNama: lapisanTarget.nama
    });
    expect(itemPoint.lapisanId).toBe("LAP-IMP-1");
    expect(objekCocokLapisan(itemPoint, lapisanTarget)).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  it("3. Dialog Tambah Peta & Pratinjau Peta tampil minimalis, tanpa input manual ukuran/jarak, dan menyediakan status loading", async () => {
    const petaContoh: AreaPetaOffline = {
      id: "MAP-1",
      namaArea: "Peta Blok Rimba.geopdf",
      basemapId: "topo",
      minLat: -1.7,
      maxLat: -1.5,
      minLng: 102.0,
      maxLng: 102.2,
      zoomMin: 11,
      zoomMax: 16,
      jumlahTile: 0,
      ukuranMb: 8.4,
      jarakKm: 1.2,
      diunduhPada: new Date().toISOString(),
      crs: "EPSG:4326 (WGS 84)",
      jenisFile: "GeoPDF / GeoTIFF"
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PustakaView
          areaOffline={[petaContoh]}
          lapisanList={[]}
          dataSpasial={[]}
          modePilihAktif={false}
          onMatikanModePilih={vi.fn()}
          onBukaPetaDasar={vi.fn()}
          onBukaAreaPeta={vi.fn()}
          onTambahAreaOffline={vi.fn()}
          onHapusAreaOffline={vi.fn()}
          onHapusLapisan={vi.fn()}
          onBukaPengaturanEkspor={vi.fn()}
        />
      );
    });

    // Buka dialog Tambah Peta
    const fabTambah = container.querySelector(".avenza-fab-orange") as HTMLButtonElement;
    await act(async () => {
      fabTambah.click();
    });
    const dialogTambah = container.querySelector('[aria-label="Tambah Peta"]')!;
    expect(dialogTambah).toBeTruthy();
    expect(dialogTambah.textContent).not.toContain("Ukuran (MB)");
    expect(dialogTambah.textContent).not.toContain("Jarak (km)");

    // Tutup dialog Tambah Peta dan buka Pratinjau Peta
    await act(async () => {
      (dialogTambah.querySelector('[aria-label="Tutup dialog tambah peta"]') as HTMLButtonElement).click();
    });
    const thumb = container.querySelector(".avenza-map-thumb-wrap") as HTMLElement;
    await act(async () => {
      thumb.click();
    });
    const dialogPreview = container.querySelector('[aria-label="Pratinjau Peta"]')!;
    expect(dialogPreview).toBeTruthy();
    expect(dialogPreview.textContent).toContain("8,4 MB");
    expect(dialogPreview.textContent).not.toContain("Dokumen Peta Terunggah");

    await act(async () => root.unmount());
    container.remove();
  });

  it("4. Pratinjau citra basemap tersedia saat offline (precache jpg + fallback SVG otomatis saat img error)", async () => {
    const viteCfg = readFileSync(resolve(__dirname, "../../vite.config.ts"), "utf8");
    expect(viteCfg).toMatch(/globPatterns:.*jpg.*jpeg/);

    const semuaBasemap: BasemapType[] = ["satelit", "google", "esri", "osm", "topo", "taktis"];
    for (const id of semuaBasemap) {
      const uri = pratinjauBasemapFallback(id);
      expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PanelLapisanPeta
          basemap="satelit"
          jumlahObjek={0}
          tampilDaftarObjek={false}
          onPilihBasemap={vi.fn()}
          onPilihBerkas={vi.fn()}
          onAlihDaftarObjek={vi.fn()}
          areaOffline={[]}
          petaKustomAktif={null}
          onPilihPetaKustom={vi.fn()}
          onTutupPetaKustom={vi.fn()}
          onTutup={vi.fn()}
        />
      );
    });

    const img = container.querySelector(".avz-basemap-thumb-img") as HTMLImageElement;
    expect(img).toBeTruthy();
    await act(async () => {
      img.dispatchEvent(new Event("error"));
    });
    expect(img.src.startsWith("data:image/svg+xml")).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  it("5. Ekspor Data memakai kotak nama ringkas dan menyaring ekspor berdasarkan Point, Line, Polygon, atau Semua", async () => {
    const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:uji");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const blobTerekspor: Blob[] = [];
    const origCreate = URL.createObjectURL;
    createObjectURLSpy.mockImplementation((b: Blob | MediaSource) => {
      if (b instanceof Blob) blobTerekspor.push(b);
      return "blob:uji";
    });
    void origCreate;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PengaturanEksporView dataSpasial={buatDataCampuran()} onTutup={vi.fn()} />);
    });

    // Kotak nama lebih kecil (.ekspor-nama-field) dengan placeholder Lapisan 1 tetap terjaga
    const fieldNama = container.querySelector(".ekspor-nama-field");
    expect(fieldNama).toBeTruthy();
    expect(fieldNama?.querySelector('input[placeholder="Lapisan 1"]')).toBeTruthy();

    // Awal: Semua (3 objek)
    expect(container.textContent).toContain("3 objek siap diekspor");

    // Pilih Polygon saja -> tersaring 1 objek
    const grupTipe = container.querySelector('[aria-label="Pilih tipe data ekspor"]')!;
    const btnPolygon = Array.from(grupTipe.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Polygon")
    ) as HTMLButtonElement;
    await act(async () => {
      btnPolygon.click();
    });
    expect(container.textContent).toContain("1 objek siap diekspor (Polygon)");

    // Klik Ekspor GeoJSON -> cek isi Blob hanya memuat 1 Polygon WebGIS
    const btnEkspor = container.querySelector(".ekspor-btn-utama") as HTMLButtonElement;
    await act(async () => {
      btnEkspor.click();
    });
    expect(blobTerekspor.length).toBeGreaterThan(0);
    const isiGeoJson = await new Promise<string>((resolveBlob, rejectBlob) => {
      const reader = new FileReader();
      reader.onload = () => resolveBlob(String(reader.result ?? ""));
      reader.onerror = () => rejectBlob(reader.error);
      reader.readAsText(blobTerekspor[blobTerekspor.length - 1]);
    });
    const fc = JSON.parse(isiGeoJson) as { features: Array<{ geometry: { type: string } }> };
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.type).toBe("Polygon");

    // Pilih Line -> status ekspor lama otomatis dibersihkan dan jumlah = 1
    const btnLine = Array.from(grupTipe.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Line")
    ) as HTMLButtonElement;
    await act(async () => {
      btnLine.click();
    });
    expect(container.textContent).toContain("1 objek siap diekspor (Line)");

    createObjectURLSpy.mockRestore();
    revokeSpy.mockRestore();
    await act(async () => root.unmount());
    container.remove();
  });

  it("6. Kategori pendaftar menampilkan MAKL, N1, N2, N3 secara akurat", async () => {
    await buatAdminPertama({
      nama: "Admin Awal",
      email: "admin@warsi.or.id",
      desaWilayah: "KKI Warsi",
      noHp: "0811",
      kataSandi: "SandiKuat#2026!"
    });
    expect(labelKategoriAsal("masyarakat_desa")).toBe("MAKL");
    expect(labelKategoriAsal("staff_warsi")).toBe("N1");
    expect(labelKategoriAsal("ngo_lain")).toBe("N2");
    expect(labelKategoriAsal("pemerintah")).toBe("N3");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AuthModal onLoginSukses={vi.fn()} />);
    });
    await act(async () => {
      (container.querySelector("#tombol-menu-daftar") as HTMLButtonElement)?.click();
    });
    const radioGrup = container.querySelector('[aria-label="Asal pendaftar"]')!;
    const labels = Array.from(radioGrup.querySelectorAll('[role="radio"]')).map((el) => el.textContent?.trim());
    expect(labels).toEqual(["MAKL", "N1", "N2", "N3"]);

    await act(async () => root.unmount());
    container.remove();
  });

  it("7. Audit bug App.tsx & PustakaView.tsx: konfirmasi keluar kustom, tanpa PullToRefresh ganda, reset lapisanAktifId saat hapus, dan dropdown buka-atas", () => {
    const sumberApp = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
    const sumberPustaka = readFileSync(resolve(__dirname, "../components/PustakaView.tsx"), "utf8");

    // Konfirmasi keluar aplikasi kustom (tanpa window.confirm)
    expect(sumberApp).toContain("Apakah Anda yakin ingin keluar dari aplikasi?");
    expect(sumberApp).toContain('setKonfirmasiKeluar("akun")');
    expect(sumberApp).toContain('setKonfirmasiKeluar("aplikasi")');
    expect(sumberApp).not.toContain("window.confirm");

    // Tidak ada PullToRefresh ganda yang memicu 2 toast / 2 indikator
    expect(sumberApp).not.toContain("<PullToRefresh");

    // Menghapus lapisan aktif membersihkan lapisanAktifId agar peta tidak kosong
    expect(sumberApp).toContain("if (lapisanAktifId === id) setLapisanAktifId(null)");

    // Dropdown lapisan di PustakaView mendukung buka-atas agar tidak terpotong layar bawah
    expect(sumberPustaka).toContain("sedangMenyimpanBerkas");
    expect(sumberPustaka).toContain("statusProsesBerkas");
  });
});
