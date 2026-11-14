import { describe, expect, it } from "vitest";
import { DataSpasialItem } from "../types";
import {
  buatArsipZip,
  eksporKeSHP,
  eksporPaketShapefile,
  eksporShpDenganOpsi,
  WGS84_PRJ
} from "./shapefile";

const CONTOH_DATA: DataSpasialItem[] = [
  {
    id: "PT-01",
    idKader: "KDR-01",
    namaKader: "Budi",
    desaWilayah: "Desa A",
    judul: "Pohon Ulin",
    kategori: "Biodiversitas",
    jenisGeometri: "point",
    koordinat: [{ lat: 2.85, lng: 117.37 }],
    panjangKm: 0,
    luasHa: 0,
    deskripsi: "Tegakan utama",
    createdAt: "2026-11-14T09:00:00.000Z",
    updatedAt: "2026-11-14T09:00:00.000Z",
    riwayatPembaruan: [],
    statusSinkron: "tersinkron"
  },
  {
    id: "LN-01",
    idKader: "KDR-01",
    namaKader: "Budi",
    desaWilayah: "Desa A",
    judul: "Jalur Patroli",
    kategori: "Sarana Desa",
    jenisGeometri: "line",
    koordinat: [
      { lat: 2.85, lng: 117.37 },
      { lat: 2.86, lng: 117.38 }
    ],
    panjangKm: 1.56,
    luasHa: 0,
    deskripsi: "Rute patroli",
    createdAt: "2026-11-14T09:30:00.000Z",
    updatedAt: "2026-11-14T09:30:00.000Z",
    riwayatPembaruan: [],
    statusSinkron: "tersinkron"
  },
  {
    id: "PL-01",
    idKader: "KDR-01",
    namaKader: "Budi",
    desaWilayah: "Desa A",
    judul: "Blok Hutan Lindung",
    kategori: "Tanda Batas",
    jenisGeometri: "polygon",
    koordinat: [
      { lat: 2.84, lng: 117.36 },
      { lat: 2.84, lng: 117.38 },
      { lat: 2.86, lng: 117.38 },
      { lat: 2.86, lng: 117.36 }
    ],
    panjangKm: 0,
    luasHa: 492,
    deskripsi: "Batas desa",
    createdAt: "2026-11-14T10:00:00.000Z",
    updatedAt: "2026-11-14T10:00:00.000Z",
    riwayatPembaruan: [],
    statusSinkron: "tersinkron"
  }
];

describe("Shapefile (.shp/.shx/.dbf/.prj & ZIP)", () => {
  it("menghasilkan berkas biner Point SHP dengan header ESRI 9994 dan koordinat X/Y akurat", () => {
    const shp = eksporKeSHP(CONTOH_DATA, "point");
    const dv = new DataView(shp.buffer, shp.byteOffset, shp.byteLength);
    expect(dv.getInt32(0, false)).toBe(9994);
    expect(dv.getInt32(24, false) * 2).toBe(shp.byteLength);
    expect(dv.getInt32(28, true)).toBe(1000);
    expect(dv.getInt32(32, true)).toBe(1); // Point
    expect(dv.getFloat64(36, true)).toBeCloseTo(117.37, 5);
    expect(dv.getFloat64(44, true)).toBeCloseTo(2.85, 5);
    // Record 1 di offset 100
    expect(dv.getInt32(100, false)).toBe(1);
    expect(dv.getInt32(108, true)).toBe(1);
    expect(dv.getFloat64(112, true)).toBeCloseTo(117.37, 5);
    expect(dv.getFloat64(120, true)).toBeCloseTo(2.85, 5);
  });

  it("menghasilkan PolyLine dan Polygon tertutup sesuai standar Shapefile serta batas peta opsional", () => {
    const garis = eksporKeSHP(CONTOH_DATA, "line");
    const dvGaris = new DataView(garis.buffer);
    expect(dvGaris.getInt32(32, true)).toBe(3);
    expect(dvGaris.getInt32(100 + 8 + 40, true)).toBe(2);

    const hasilPoly = eksporShpDenganOpsi(
      [CONTOH_DATA[2]],
      [{ id: "P-1", namaArea: "Peta Kerja", basemapId: "esri", minLat: 2.8, maxLat: 2.9, minLng: 117.3, maxLng: 117.4, zoomMin: 12, zoomMax: 15, ukuranMb: 5, diunduhPada: "2026-11-14", jumlahTile: 10 }],
      true,
      "polygon"
    );
    const dvPoly = new DataView(hasilPoly.shp.buffer);
    expect(hasilPoly.jumlahFitur).toBe(2);
    expect(dvPoly.getInt32(32, true)).toBe(5);
    expect(new TextDecoder().decode(hasilPoly.prj)).toBe(WGS84_PRJ);
    // SHX berisi 100 byte header + 2 * 8 byte record
    expect(hasilPoly.shx.byteLength).toBe(116);
    // DBF dimulai byte 0x03 dan diakhiri EOF 0x1A
    expect(hasilPoly.dbf[0]).toBe(0x03);
    expect(hasilPoly.dbf[hasilPoly.dbf.length - 1]).toBe(0x1a);
  });

  it("membuat paket ZIP lengkap untuk campuran point, line, dan polygon", () => {
    const berkas = eksporPaketShapefile(CONTOH_DATA, "Survei Kampung");
    expect(berkas.map((b) => b.nama)).toEqual([
      "Survei_Kampung_titik.shp",
      "Survei_Kampung_titik.shx",
      "Survei_Kampung_titik.dbf",
      "Survei_Kampung_titik.prj",
      "Survei_Kampung_jalur.shp",
      "Survei_Kampung_jalur.shx",
      "Survei_Kampung_jalur.dbf",
      "Survei_Kampung_jalur.prj",
      "Survei_Kampung_area.shp",
      "Survei_Kampung_area.shx",
      "Survei_Kampung_area.dbf",
      "Survei_Kampung_area.prj"
    ]);
    const zip = buatArsipZip(berkas);
    const dvZip = new DataView(zip.buffer);
    // Signature Local File Header PK\x03\x04 dan EOCD PK\x05\x06 di ekor
    expect(dvZip.getUint32(0, true)).toBe(0x04034b50);
    expect(dvZip.getUint32(zip.byteLength - 22, true)).toBe(0x06054b50);
  });
});
