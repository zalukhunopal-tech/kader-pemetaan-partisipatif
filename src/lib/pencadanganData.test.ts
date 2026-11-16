import { describe, expect, it } from "vitest";
import { DataSpasialItem } from "../types";
import {
  RETENSI_PENCADANGAN_HARI,
  RETENSI_PENCADANGAN_MS,
  pindahkanKePencadangan,
  pisahkanPencadanganKedaluwarsa,
  pulihkanItemDariPencadangan,
  rekonsiliasiDatabaseDenganGDrive,
  sisaHariPencadangan
} from "./pencadanganData";

const buatItem = (overrides: Partial<DataSpasialItem> = {}): DataSpasialItem => ({
  id: "SPS-100",
  idKader: "KDR-1",
  namaKader: "Budi",
  desaWilayah: "Long Peso",
  jenisGeometri: "point",
  kategori: "Biodiversitas",
  judul: "Temuan Burung",
  deskripsi: "Data lapangan",
  koordinat: [{ lat: 2.85, lng: 117.38, akurasi: 4 }],
  panjangKm: 0,
  luasHa: 0,
  statusSinkron: "tersinkron",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  riwayatPembaruan: [],
  ...overrides
});

describe("pencadanganData (Retensi 90 Hari & Korelasi Database GDrive)", () => {
  it("memindahkan data yang dihapus ke folder pencadangan selama 90 hari dan dapat dipulihkan admin", () => {
    const t0 = Date.UTC(2026, 10, 1, 10, 0, 0);
    const item = buatItem({ id: "SPS-DEL-1", statusSinkron: "tersinkron" });
    const entri = pindahkanKePencadangan(item, "Admin Nopal", "Data belum sesuai standar", t0);

    expect(entri.statusGDrive).toBe("menunggu_pindah");
    expect(entri.data.dalamPencadangan).toBe(true);
    expect(sisaHariPencadangan(entri, t0)).toBe(RETENSI_PENCADANGAN_HARI);
    expect(sisaHariPencadangan(entri, t0 + 30 * 24 * 60 * 60 * 1000)).toBe(60);

    // Belum kedaluwarsa sebelum 90 hari
    const sebelum90 = pisahkanPencadanganKedaluwarsa([entri], t0 + 89 * 24 * 60 * 60 * 1000);
    expect(sebelum90.aktif).toHaveLength(1);
    expect(sebelum90.kedaluwarsa).toHaveLength(0);

    // Setelah >= 90 hari tanpa pemulihan -> masuk daftar hapus permanen
    const lewat90 = pisahkanPencadanganKedaluwarsa([entri], t0 + RETENSI_PENCADANGAN_MS);
    expect(lewat90.aktif).toHaveLength(0);
    expect(lewat90.kedaluwarsa).toHaveLength(1);

    // Jika dipulihkan admin sebelum 90 hari
    const pulih = pulihkanItemDariPencadangan(entri, t0 + 5 * 60_000);
    expect(pulih.dalamPencadangan).toBeUndefined();
    expect(pulih.id).toBe("SPS-DEL-1");
  });

  it("merekonsiliasi database lokal dengan GDrive ketika data dihapus atau dipindah ke pencadangan di server", () => {
    const lokalBelumUpload = buatItem({ id: "SPS-LOKAL", statusSinkron: "lokal" });
    const aktifDiServer = buatItem({ id: "SPS-AKTIF", statusSinkron: "tersinkron" });
    const dipindahDiServer = buatItem({ id: "SPS-BACKUP", statusSinkron: "tersinkron" });
    const dihapusPermanenDiServer = buatItem({ id: "SPS-GONE", statusSinkron: "terverifikasi" });

    const hasil = rekonsiliasiDatabaseDenganGDrive(
      [lokalBelumUpload, aktifDiServer, dipindahDiServer, dihapusPermanenDiServer],
      [],
      {
        aktif: [{ id: "SPS-AKTIF", statusSinkron: "terverifikasi", catatanAdmin: "Valid" }],
        pencadanganIds: ["SPS-BACKUP"]
      }
    );

    expect(hasil.dataAktif.map((d) => d.id)).toEqual(["SPS-LOKAL", "SPS-AKTIF"]);
    expect(hasil.dataAktif.find((d) => d.id === "SPS-AKTIF")?.statusSinkron).toBe("terverifikasi");
    expect(hasil.pencadangan.map((p) => p.id)).toEqual(["SPS-BACKUP"]);
    expect(hasil.jumlahDipindahKeCadangan).toBe(1);
    expect(hasil.jumlahDihapusDariLokal).toBe(1);
    expect(hasil.jumlahStatusDiperbarui).toBe(1);
  });
});
