import { describe, expect, it } from "vitest";
import {
  BELUM_DIISI,
  DAFTAR_PROVINSI,
  jalurFolder,
  namaBerkasData,
  rapikanWilayah,
  slugBerkas,
  teksWilayah,
  wilayahKosong,
  wilayahLengkap,
  wilayahUntukData
} from "./wilayah";

const JAMBI = { provinsi: "Jambi", kabupaten: "Kabupaten Merangin", kecamatan: "Bangko", desa: "Rantau Panjang" };
const data = (o: Partial<{ namaKader: string; judul: string; kategori: string; createdAt: string }> = {}) =>
  ({ namaKader: "Budi", judul: "Sebaran Anggrek", kategori: "Flora", createdAt: "2026-11-14T03:00:00Z", ...o }) as Parameters<
    typeof namaBerkasData
  >[0];

describe("nama berkas di Google Drive", () => {
  it("akun_data_bulan_tahun, huruf kecil dengan garis bawah", () => {
    expect(namaBerkasData(data())).toBe("budi_sebaran_anggrek_november_2026");
    expect(namaBerkasData(data({ namaKader: "Siti Rahma", judul: "Mata Air Bukit", createdAt: "2026-01-20T05:00:00Z" }))).toBe(
      "siti_rahma_mata_air_bukit_januari_2026"
    );
  });

  it("aksen dan tanda baca dibuang, judul kosong memakai kategori", () => {
    expect(namaBerkasData(data({ namaKader: "Andrés", judul: "Pohon Ulin (besar) #2" }))).toBe("andres_pohon_ulin_besar_2_november_2026");
    expect(namaBerkasData(data({ judul: "  ", kategori: "Mata Air" }))).toBe("budi_mata_air_november_2026");
    expect(namaBerkasData(data({ namaKader: "", judul: "", kategori: "" }))).toBe("kader_data_november_2026");
  });

  it("bulan mengikuti waktu perekaman, bukan waktu unggah", () => {
    expect(namaBerkasData(data({ createdAt: "2026-05-15T05:00:00Z" }))).toMatch(/_mei_2026$/);
    expect(namaBerkasData(data({ createdAt: "2027-12-10T05:00:00Z" }))).toMatch(/_desember_2027$/);
  });

  it("slug dibatasi panjangnya tanpa garis bawah menggantung", () => {
    const s = slugBerkas("a b ".repeat(40), 9);
    expect(s.length).toBeLessThanOrEqual(9);
    expect(s.endsWith("_")).toBe(false);
  });
});

describe("wilayah administrasi", () => {
  it("38 provinsi tanpa duplikat", () => {
    expect(DAFTAR_PROVINSI).toHaveLength(38);
    expect(new Set(DAFTAR_PROVINSI).size).toBe(38);
    expect(DAFTAR_PROVINSI).toContain("Jambi");
    expect(DAFTAR_PROVINSI).toContain("Papua Barat Daya");
  });

  it("dirapikan: spasi ganda, garis miring, dan tanda '-' dari data lama", () => {
    expect(rapikanWilayah({ provinsi: "  Jambi ", kabupaten: "Kab.  Merangin", kecamatan: "Bangko/Barat", desa: "-" })).toEqual({
      provinsi: "Jambi",
      kabupaten: "Kab. Merangin",
      kecamatan: "Bangko-Barat",
      desa: ""
    });
  });

  it("lengkap hanya bila keempat tingkat terisi; tingkat kosong menjadi folder Wilayah_Belum_Diisi", () => {
    expect(wilayahLengkap(JAMBI)).toBe(true);
    expect(wilayahLengkap({ ...JAMBI, kecamatan: " " })).toBe(false);
    expect(wilayahLengkap(undefined)).toBe(false);
    expect(wilayahKosong({ desa: "-" })).toBe(true);
    expect(jalurFolder({ desa: "Desa A" })).toEqual([BELUM_DIISI, BELUM_DIISI, BELUM_DIISI, "Desa A"]);
    expect(teksWilayah(JAMBI)).toBe("Jambi › Kabupaten Merangin › Bangko › Rantau Panjang");
  });

  it("wilayah data: cap lengkap pada data, lalu wilayah akun, lalu nama desa lama", () => {
    const lain = { ...JAMBI, desa: "Pulau Rengas" };
    expect(wilayahUntukData({ wilayah: lain, desaWilayah: "x" }, JAMBI)).toEqual(lain);
    expect(wilayahUntukData({ wilayah: { ...lain, kecamatan: "" }, desaWilayah: "x" }, JAMBI)).toEqual(JAMBI);
    expect(wilayahUntukData({ desaWilayah: "Desa A" }, undefined)).toEqual({ provinsi: "", kabupaten: "", kecamatan: "", desa: "Desa A" });
    expect(wilayahUntukData({ desaWilayah: "Desa A" }, { provinsi: "Jambi" })).toEqual({
      provinsi: "Jambi",
      kabupaten: "",
      kecamatan: "",
      desa: "Desa A"
    });
  });
});
