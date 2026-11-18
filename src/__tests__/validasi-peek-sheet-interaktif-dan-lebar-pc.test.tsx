// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { PeekSheetInteraktif } from "../components/peta/PeekSheetInteraktif";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Validasi PeekSheetInteraktif dan Lebar Layar PC", () => {
  it("merender peek sheet untuk draft pin dalam tahap ringkas dan menampilkan informasi dasar", () => {
    const handleGoTo = vi.fn();
    const handleBagikan = vi.fn();
    const handleForm = vi.fn();

    const html = renderToString(
      <PeekSheetInteraktif
        mode="draft_pin"
        titikDraft={[{ lat: 3.904544, lng: 115.986396 }]}
        lapisanAktif={{
          id: "l1",
          nama: "Lapisan Survei Desa",
          jumlahPeta: 1,
          createdAt: new Date().toISOString()
        }}
        onBukaFormLengkap={handleForm}
        onBukaDetailLengkap={handleForm}
        onTutup={vi.fn()}
        onGoTo={handleGoTo}
        onBagikan={handleBagikan}
      />
    );

    expect(html).toContain("Pin dijatuhkan");
    expect(html).toContain("3.904544, 115.986396");
    expect(html).toContain("Lapisan Survei Desa");
    expect(html).toContain("Navigasi");
    expect(html).toContain("Bagikan");
    expect(html).toContain("Simpan");
    expect(html).toContain("avz-peek-card");
    expect(html).toContain("tahap-ringkas");
  });

  it("merender tahap sedang menampilkan keterangan lainnya (koordinat presisi, elevasi, corak)", () => {
    const handleForm = vi.fn();

    const html = renderToString(
      <PeekSheetInteraktif
        mode="draft_pin"
        tahapAwal="sedang"
        titikDraft={[{ lat: 3.904544, lng: 115.986396, elevasi: 640.23 }]}
        lapisanAktif={{
          id: "l1",
          nama: "Lapisan 1",
          jumlahPeta: 1,
          createdAt: new Date().toISOString()
        }}
        onBukaFormLengkap={handleForm}
        onBukaDetailLengkap={handleForm}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
      />
    );

    expect(html).toContain("tahap-sedang");
    expect(html).toContain("Koordinat");
    expect(html).toContain("Corak");
    expect(html).toContain("Elevasi");
    expect(html).toContain("Skema atribut");
    expect(html).toContain("Kumpulkan data menggunakan atribut yang sudah dibuat");
  });

  it("merender peek sheet untuk objek terpilih jalur trek dan menampilkan tombol aksi yang sesuai", () => {
    const handleHapus = vi.fn();

    const html = renderToString(
      <PeekSheetInteraktif
        mode="objek_terpilih"
        objekTerpilih={{
          id: "trek-1",
          idKader: "kader-1",
          kategori: "Tanda Batas",
          judul: "Perjalanan dari Malinau ke Long Bawan",
          jenisGeometri: "line",
          koordinat: [
            { lat: 3.9, lng: 115.9 },
            { lat: 3.95, lng: 115.95 }
          ],
          panjangKm: 120.17,
          lapisanNama: "Lapisan 1",
          statusSinkron: "lokal",
          namaKader: "Kader Malinau",
          desaWilayah: "Long Bawan",
          deskripsi: "",
          luasHa: 0,
          updatedAt: new Date().toISOString(),
          riwayatPembaruan: [],
          createdAt: new Date().toISOString()
        }}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
        onHapus={handleHapus}
      />
    );

    expect(html).toContain("Perjalanan dari Malinau ke Long Bawan");
    expect(html).toContain("120,17 km");
    expect(html).toContain("Beri tahu");
    expect(html).toContain("Hapus");
  });

  it("memastikan aturan lebar PC pada CSS peta memenuhi layar interaktif", () => {
    const cssAvenza = readFileSync(resolve(__dirname, "../styles/petaAvenza.css"), "utf8");
    const cssApp = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

    // CSS avz-peek-card di PC memiliki max-width 1080px dan lebar fleksibel
    expect(cssAvenza).toContain(".avz-peta .avz-peek-card");
    expect(cssAvenza).toContain("max-width: 1080px !important");
    expect(cssAvenza).toContain(".avz-peek-detail-grid");
    expect(cssAvenza).toContain("grid-template-columns: repeat(2, 1fr) !important");

    // Perekaman jalur pada PC memiliki lebar memenuhi layar
    expect(cssAvenza).toContain(".avz-peta .recording-active-bar");
    expect(cssApp).toContain(".recording-active-bar");
    expect(cssApp).toContain("max-width: 1080px !important");
  });
});
