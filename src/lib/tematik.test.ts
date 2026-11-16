import { describe, expect, it } from "vitest";
import { DataSpasialItem, LapisanSpasial } from "../types";
import {
  kumpulkanKolamTematik,
  objekCocokLapisan,
  selesaikanKolamTematik,
  sinkronkanLapisanDenganItem
} from "./tematik";

const contohItem = (overrides: Partial<DataSpasialItem>): DataSpasialItem => ({
  id: "SPS-1",
  idKader: "KDR-1",
  namaKader: "Kader Uji",
  desaWilayah: "Long Peso",
  jenisGeometri: "point",
  kategori: "Biodiversitas",
  judul: "Pohon Meranti",
  deskripsi: "",
  koordinat: [{ lat: 2.85, lng: 117.38 }],
  panjangKm: 0,
  luasHa: 0,
  statusSinkron: "lokal",
  createdAt: "2026-11-16T00:00:00Z",
  updatedAt: "2026-11-16T00:00:00Z",
  riwayatPembaruan: [],
  ...overrides
});

describe("tematik (Kolam Data Peta Tematik vs Non-Tematik)", () => {
  const lapisanAwal: LapisanSpasial[] = [
    {
      id: "LYR-1",
      nama: "Sebaran Satwa",
      jumlahPeta: 1,
      kategoriDefault: "Biodiversitas",
      adalahTematik: true,
      createdAt: "2026-11-16T00:00:00Z"
    }
  ];
  const dataAwal: DataSpasialItem[] = [
    contohItem({ id: "SPS-1", tematik: "Sebaran Satwa", kategori: "Biodiversitas" }),
    contohItem({ id: "SPS-2", tematik: undefined, kategori: "Mata Air", judul: "Mata Air Biasa" })
  ];

  it("mengosongkan pilihan tematik membuat data masuk sebagai peta biasa (non-tematik)", () => {
    const res = selesaikanKolamTematik({
      namaTematik: "   ",
      kategori: "Mata Air",
      lapisanList: lapisanAwal,
      dataSpasial: dataAwal
    });
    expect(res.tematik).toBeUndefined();
    expect(res.status).toBe("non_tematik");
    expect(res.dibuatTersendiri).toBe(false);
  });

  it("tematik sama dengan kategori yang sama akan dimasukkan ke dalam kolam data yang sama", () => {
    const res = selesaikanKolamTematik({
      namaTematik: "sebaran satwa",
      kategori: "Biodiversitas",
      lapisanList: lapisanAwal,
      dataSpasial: dataAwal
    });
    expect(res.tematik).toBe("Sebaran Satwa");
    expect(res.status).toBe("gabung_kolam");
    expect(res.dibuatTersendiri).toBe(false);

    const itemBaru = contohItem({ id: "SPS-3", tematik: res.tematik, kategori: "Biodiversitas" });
    const lyrUpdate = sinkronkanLapisanDenganItem(lapisanAwal, itemBaru, [itemBaru, ...dataAwal]);
    expect(lyrUpdate).toHaveLength(1);
    expect(lyrUpdate[0].jumlahPeta).toBe(2);
  });

  it("tematik sama tetapi kategori berbeda akan dibuatkan tematik tersendiri", () => {
    const res = selesaikanKolamTematik({
      namaTematik: "Sebaran Satwa",
      kategori: "Mata Air",
      lapisanList: lapisanAwal,
      dataSpasial: dataAwal
    });
    expect(res.status).toBe("tematik_tersendiri");
    expect(res.dibuatTersendiri).toBe(true);
    expect(res.kategoriKolamAsal).toBe("Biodiversitas");
    expect(res.tematik).toBe("Sebaran Satwa (Mata Air)");

    const itemTersendiri = contohItem({ id: "SPS-4", tematik: res.tematik, kategori: "Mata Air" });
    const lyrUpdate = sinkronkanLapisanDenganItem(lapisanAwal, itemTersendiri, [itemTersendiri, ...dataAwal]);
    expect(lyrUpdate.map((l) => l.nama)).toContain("Sebaran Satwa (Mata Air)");
    expect(kumpulkanKolamTematik(lyrUpdate, [itemTersendiri, ...dataAwal])).toHaveLength(2);
  });

  it("lapisan tematik hanya mencocokkan objek pada kolam tematiknya dan memisahkan data non-tematik", () => {
    expect(objekCocokLapisan(dataAwal[0], lapisanAwal[0])).toBe(true);
    expect(objekCocokLapisan(dataAwal[1], lapisanAwal[0])).toBe(false);
    // Data non-tematik berkategori Biodiversitas pun tidak masuk ke kolam tematik Sebaran Satwa
    const bioBiasa = contohItem({ id: "SPS-5", kategori: "Biodiversitas", tematik: undefined });
    expect(objekCocokLapisan(bioBiasa, lapisanAwal[0])).toBe(false);
  });
});
