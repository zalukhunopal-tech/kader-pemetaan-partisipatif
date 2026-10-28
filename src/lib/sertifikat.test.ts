import { describe, expect, it } from "vitest";
import { nomorSertifikatBerikut, nomorSudahDipakai, ringkasanKader, siapkanSertifikat } from "./sertifikat";
import { DataSpasialItem, SertifikatKader } from "../types";

const titik = (idKader: string, namaKader: string, n: number, status: DataSpasialItem["statusSinkron"]): DataSpasialItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${idKader}-${status}-${i}`,
    idKader,
    namaKader,
    desaWilayah: "Desa A",
    jenisGeometri: "point" as const,
    kategori: "Flora" as const,
    judul: "t",
    deskripsi: "",
    koordinat: [{ lat: -0.9, lng: 100.4 + i * 1e-5 }],
    panjangKm: 0,
    luasHa: 0,
    statusSinkron: status,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "",
    riwayatPembaruan: []
  }));

const sert = (nomor: string, idKader = "X"): SertifikatKader => ({
  id: "C" + nomor,
  nomorSertifikat: nomor,
  idKader,
  namaKader: "N",
  desaWilayah: "D",
  namaOrganisasi: "O",
  tanggalTerbit: "2026-10-01",
  alasanCapaian: "",
  status: "diterbitkan",
  ditandatanganiOleh: "P",
  jabatanPenandatangan: "J"
});

const info = { namaOrganisasi: "Org", ditandatanganiOleh: "Pejabat", jabatanPenandatangan: "Koordinator", sekarang: new Date(2026, 9, 28) };

describe("nomorSertifikatBerikut", () => {
  it("mulai dari 0001 dan memakai bulan Romawi serta tahun", () => {
    expect(nomorSertifikatBerikut([], new Date(2026, 9, 28))).toBe("0001/SKPP-GIS/WILAYAH/X/2026");
    expect(nomorSertifikatBerikut([], new Date(2026, 0, 5))).toBe("0001/SKPP-GIS/WILAYAH/I/2026");
    expect(nomorSertifikatBerikut([], new Date(2026, 11, 31))).toBe("0001/SKPP-GIS/WILAYAH/XII/2026");
  });
  it("melanjutkan urutan tertinggi pada tahun yang sama, termasuk nomor lama", () => {
    const daftar = [sert("0115/SKPP-GIS/WILAYAH/X/2026"), sert("0003/SKPP-GIS/WILAYAH/IX/2026"), sert("0900/SKPP-GIS/WILAYAH/X/2025")];
    expect(nomorSertifikatBerikut(daftar, new Date(2026, 9, 28))).toBe("0116/SKPP-GIS/WILAYAH/X/2026");
  });
  it("urutan dimulai ulang di tahun baru dan format lain diabaikan", () => {
    expect(nomorSertifikatBerikut([sert("0200/SKPP-GIS/WILAYAH/XII/2026"), sert("001/SERT-KPP/2026")], new Date(2027, 0, 2))).toBe("0001/SKPP-GIS/WILAYAH/I/2027");
  });
  it("nomorSudahDipakai tidak peka huruf besar dan spasi", () => {
    expect(nomorSudahDipakai([sert("0001/SKPP-GIS/WILAYAH/X/2026")], " 0001/skpp-gis/wilayah/x/2026 ")).toBe(true);
    expect(nomorSudahDipakai([sert("0001/SKPP-GIS/WILAYAH/X/2026")], "0002/SKPP-GIS/WILAYAH/X/2026")).toBe(false);
  });
});

describe("ringkasanKader dan penerbitan (S1)", () => {
  const data = [
    ...titik("KDR-1", "Budi", 50, "lokal"), // banyak tetapi belum diverifikasi
    ...titik("KDR-2", "Siti", 50, "terverifikasi"),
    ...titik("KDR-3", "Sari", 30, "terverifikasi")
  ];

  it("hanya kader dengan capaian terverifikasi yang berhak", () => {
    const r = ringkasanKader(data, []);
    const hak = Object.fromEntries(r.map((k) => [k.namaKader, k.capaian.berhakSertifikat]));
    expect(hak).toEqual({ Budi: false, Siti: true, Sari: false });
    expect(r[0].namaKader).toBe("Siti"); // yang berhak di urutan atas
  });

  it("menolak menerbitkan untuk kader yang datanya belum terverifikasi", () => {
    const budi = ringkasanKader(data, []).find((k) => k.namaKader === "Budi")!;
    const h = siapkanSertifikat(budi, "0001/SKPP-GIS/WILAYAH/X/2026", [], info);
    expect(h.ok).toBe(false);
    expect(h.pesan).toMatch(/belum memenuhi/);
  });

  it("menerbitkan untuk kader yang berhak, atas nama kader itu sendiri (bukan profil admin)", () => {
    const siti = ringkasanKader(data, []).find((k) => k.namaKader === "Siti")!;
    const h = siapkanSertifikat(siti, "0001/SKPP-GIS/WILAYAH/X/2026", [], info);
    expect(h.ok).toBe(true);
    expect(h.sertifikat).toMatchObject({ idKader: "KDR-2", namaKader: "Siti", desaWilayah: "Desa A", status: "diterbitkan", tanggalTerbit: "2026-10-28", ditandatanganiOleh: "Pejabat" });
    expect(h.sertifikat!.id).toMatch(/^CERT-[0-9a-f]{12}$/);
    expect(h.sertifikat!.alasanCapaian).toMatch(/50 Titik Koordinat/);
  });

  it("menolak sertifikat ganda untuk kader yang sama dan nomor kembar", () => {
    const sudah = [sert("0001/SKPP-GIS/WILAYAH/X/2026", "KDR-2")];
    const siti = ringkasanKader(data, sudah).find((k) => k.namaKader === "Siti")!;
    expect(siti.sudahTerbit).toBe(true);
    expect(siapkanSertifikat(siti, "0002/SKPP-GIS/WILAYAH/X/2026", sudah, info).pesan).toMatch(/sudah memiliki/);
    const siti2 = ringkasanKader(data, []).find((k) => k.namaKader === "Siti")!;
    const milikLain = [sert("0001/SKPP-GIS/WILAYAH/X/2026", "KDR-9")];
    expect(siapkanSertifikat(siti2, "0001/SKPP-GIS/WILAYAH/X/2026", milikLain, info).pesan).toMatch(/sudah dipakai/);
    expect(siapkanSertifikat(siti2, "  ", [], info).pesan).toMatch(/wajib diisi/);
  });

  it("data simulasi dan data impor belum diverifikasi tidak ikut menghitung", () => {
    const simulasi = titik("KDR-4", "Dewi", 50, "terverifikasi").map((d) => ({ ...d, koordinat: [{ ...d.koordinat[0], simulasi: true }] }));
    const impor = titik("KDR-5", "Rudi", 50, "lokal").map((d) => ({ ...d, diimpor: true }));
    const r = ringkasanKader([...simulasi, ...impor], []);
    expect(r.every((k) => !k.capaian.berhakSertifikat)).toBe(true);
  });
});
