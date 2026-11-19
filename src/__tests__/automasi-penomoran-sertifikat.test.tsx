// @vitest-environment jsdom
// @ts-expect-error React act environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bersihkanKodeKader,
  bersihkanKodeWilayah,
  buatNomorSertifikatOtomatis,
  ekstrakUrutanTertinggi,
  nomorSertifikatBerikut,
  nomorSudahDipakai,
  RingkasanKader,
  siapkanSemuaSertifikatOtomatis,
  siapkanSertifikat
} from "../lib/sertifikat";
import { AdminDashboardView } from "../components/AdminDashboardView";
import { DEFAULT_PENANDATANGAN_SERTIFIKAT } from "../lib/sertifikatBawaan";
import { DataSpasialItem, ProfilKader, SertifikatKader } from "../types";

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

const buatKader = (id: string, nama: string, desa: string): RingkasanKader => ({
  idKader: id,
  namaKader: nama,
  desaWilayah: desa,
  capaian: {
    jumlahTitik: 60,
    jumlahPembaruan: 0,
    totalPoinTitik: 60,
    totalTrackingKm: 12.5,
    totalPoligonHa: 8.4,
    persenTitik: 100,
    persenTracking: 100,
    persenPoligon: 100,
    paketDariTitik: 1,
    paketDariTracking: 1,
    paketDariPoligon: 1,
    totalPaketSelesai: 1,
    progresPaketBerikutnyaPersen: 100,
    berhakSertifikat: true,
    alasanSertifikat: "60 Titik, 12.5 km Tracking, 8.4 Ha Poligon"
  },
  sudahTerbit: false
});

const info = {
  namaOrganisasi: "Komunitas GIS Warsi",
  ditandatanganiOleh: "Adi Junedi",
  jabatanPenandatangan: "Direktur",
  sekarang: new Date("2026-11-19T10:00:00Z"),
  penandatanganList: DEFAULT_PENANDATANGAN_SERTIFIKAT
};

describe("Automasi Penomoran dan Pengkodean Sertifikat Unik per Pengguna", () => {
  it("membersihkan kode wilayah dan kode kader dengan benar", () => {
    expect(bersihkanKodeWilayah("Desa Long Loreh")).toBe("LONG-LOREH");
    expect(bersihkanKodeWilayah("Kelurahan Rimba Hijau & Sekitarnya")).toBe("RIMBA-HIJAU-SEKITARNYA");
    expect(bersihkanKodeWilayah("")).toBe("WILAYAH");
    expect(bersihkanKodeWilayah(undefined)).toBe("WILAYAH");

    expect(bersihkanKodeKader("KDR-001")).toBe("KDR-001");
    expect(bersihkanKodeKader("user_7a3f")).toBe("USER-7A3F");
    expect(bersihkanKodeKader("")).toBe("KDR");
    expect(bersihkanKodeKader(undefined)).toBe("KDR");
  });

  it("menghasilkan nomor sertifikat berbeda untuk setiap user yang berbeda secara berurutan", () => {
    const tanggal = new Date("2026-11-19T10:00:00Z");
    const daftar: SertifikatKader[] = [];

    const user1 = buatKader("KDR-101", "Budi Santoso", "Desa Long Loreh");
    const no1 = buatNomorSertifikatOtomatis(user1, daftar, tanggal, { skema: "standar" });
    expect(no1).toBe("0001/SKPP-GIS/WILAYAH/XI/2026");

    const sert1 = siapkanSertifikat(user1, no1, daftar, info).sertifikat!;
    daftar.push(sert1);

    const user2 = buatKader("KDR-102", "Siti Aminah", "Desa Rimba Hijau");
    const no2 = buatNomorSertifikatOtomatis(user2, daftar, tanggal, { skema: "standar" });
    expect(no2).toBe("0002/SKPP-GIS/WILAYAH/XI/2026");

    const sert2 = siapkanSertifikat(user2, no2, daftar, info).sertifikat!;
    daftar.push(sert2);

    const user3 = buatKader("KDR-103", "Ahmad Fauzi", "Desa Punan");
    const no3 = buatNomorSertifikatOtomatis(user3, daftar, tanggal, { skema: "standar" });
    expect(no3).toBe("0003/SKPP-GIS/WILAYAH/XI/2026");

    // Pastikan seluruh nomor benar-benar berbeda
    const kumpulanNomor = new Set([no1, no2, no3]);
    expect(kumpulanNomor.size).toBe(3);
  });

  it("mendukung berbagai skema pengkodean sertifikat (wilayah, kader, dan warsi)", () => {
    const tanggal = new Date("2026-11-19T10:00:00Z");
    const user = buatKader("KDR-888", "Rian Hidayat", "Desa Long Loreh");

    // Skema Wilayah
    const noWilayah = buatNomorSertifikatOtomatis(user, [], tanggal, { skema: "wilayah" });
    expect(noWilayah).toBe("0001/SKPP-GIS/LONG-LOREH/XI/2026");

    // Skema ID Kader
    const noKader = buatNomorSertifikatOtomatis(user, [], tanggal, { skema: "kader" });
    expect(noKader).toBe("0001/SKPP-GIS/KDR-888/XI/2026");

    // Skema Resmi Warsi
    const noWarsi = buatNomorSertifikatOtomatis(user, [], tanggal, { skema: "warsi" });
    expect(noWarsi).toBe("SKPP-WARSI/2026/XI/0001-888");
  });

  it("mencegah bentrok nomor dan secara otomatis mencari urutan berikutnya jika nomor sudah ada", () => {
    const tanggal = new Date("2026-11-19T10:00:00Z");
    const daftarAda: SertifikatKader[] = [
      {
        id: "CERT-1",
        nomorSertifikat: "0001/SKPP-GIS/WILAYAH/XI/2026",
        idKader: "KDR-OLD-1",
        namaKader: "Kader Terdahulu 1",
        desaWilayah: "Desa A",
        namaOrganisasi: "Warsi",
        tanggalTerbit: "2026-11-01",
        alasanCapaian: "50 Titik",
        status: "diterbitkan",
        ditandatanganiOleh: "Direktur",
        jabatanPenandatangan: "Direktur"
      },
      {
        id: "CERT-2",
        nomorSertifikat: "0002/SKPP-GIS/WILAYAH/XI/2026",
        idKader: "KDR-OLD-2",
        namaKader: "Kader Terdahulu 2",
        desaWilayah: "Desa B",
        namaOrganisasi: "Warsi",
        tanggalTerbit: "2026-11-02",
        alasanCapaian: "50 Titik",
        status: "diterbitkan",
        ditandatanganiOleh: "Direktur",
        jabatanPenandatangan: "Direktur"
      }
    ];

    const kaderBaru = buatKader("KDR-NEW", "Kader Baru", "Desa C");
    const nomorBerikutnya = buatNomorSertifikatOtomatis(kaderBaru, daftarAda, tanggal, { skema: "standar" });

    // Harus otomatis mulai dari 0003 karena 0001 dan 0002 sudah terpakai
    expect(nomorBerikutnya).toBe("0003/SKPP-GIS/WILAYAH/XI/2026");
    expect(nomorSudahDipakai(daftarAda, nomorBerikutnya)).toBe(false);
  });

  it("menerbitkan sertifikat otomatis secara massal (batch) dengan nomor unik untuk setiap kader", () => {
    const daftarKader = [
      buatKader("KDR-A", "Kader Alpha", "Desa Satu"),
      buatKader("KDR-B", "Kader Beta", "Desa Dua"),
      buatKader("KDR-C", "Kader Gamma", "Desa Tiga"),
      buatKader("KDR-D", "Kader Delta", "Desa Empat")
    ];

    const hasilBatch = siapkanSemuaSertifikatOtomatis(daftarKader, [], info);
    expect(hasilBatch.berhasil).toHaveLength(4);
    expect(hasilBatch.gagal).toHaveLength(0);

    const nomorHasil = hasilBatch.berhasil.map((s) => s.nomorSertifikat);
    expect(nomorHasil).toEqual([
      "0001/SKPP-GIS/WILAYAH/XI/2026",
      "0002/SKPP-GIS/WILAYAH/XI/2026",
      "0003/SKPP-GIS/WILAYAH/XI/2026",
      "0004/SKPP-GIS/WILAYAH/XI/2026"
    ]);

    // Setiap user mendapatkan idKader dan nomor yang tepat dan unik
    hasilBatch.berhasil.forEach((sert, idx) => {
      expect(sert.idKader).toBe(daftarKader[idx].idKader);
      expect(sert.namaKader).toBe(daftarKader[idx].namaKader);
    });
  });

  it("menampilkan pratinjau nomor unik per user di tabel admin dan tombol terbitkan semua otomatis", () => {
    const dataSpasial: DataSpasialItem[] = [
      // 50 titik terverifikasi untuk KDR-10
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `PT-10-${i}`,
        idKader: "KDR-10",
        namaKader: "Kader Sepuluh",
        desaWilayah: "Desa Rukun",
        jenisGeometri: "point" as const,
        kategori: "Flora" as const,
        judul: `Titik ${i}`,
        deskripsi: "",
        koordinat: [{ lat: -0.9, lng: 100.4 }],
        panjangKm: 0,
        luasHa: 0,
        statusSinkron: "terverifikasi" as const,
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "",
        riwayatPembaruan: []
      })),
      {
        id: "LN-10",
        idKader: "KDR-10",
        namaKader: "Kader Sepuluh",
        desaWilayah: "Desa Rukun",
        jenisGeometri: "line" as const,
        kategori: "Biodiversitas" as const,
        judul: "Jalur",
        deskripsi: "",
        koordinat: [{ lat: -0.9, lng: 100.4 }, { lat: -0.95, lng: 100.45 }],
        panjangKm: 6.0,
        luasHa: 0,
        statusSinkron: "terverifikasi" as const,
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "",
        riwayatPembaruan: []
      },
      {
        id: "PG-10",
        idKader: "KDR-10",
        namaKader: "Kader Sepuluh",
        desaWilayah: "Desa Rukun",
        jenisGeometri: "polygon" as const,
        kategori: "Wilayah Adat / Lahan" as const,
        judul: "Lahan",
        deskripsi: "",
        koordinat: [{ lat: -0.9, lng: 100.4 }, { lat: -0.95, lng: 100.4 }, { lat: -0.9, lng: 100.4 }],
        panjangKm: 0,
        luasHa: 7.0,
        statusSinkron: "terverifikasi" as const,
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "",
        riwayatPembaruan: []
      }
    ];

    const profilAdmin: ProfilKader = {
      idKader: "ADM-001",
      nama: "Administrator",
      desaWilayah: "KKI Warsi",
      kelompokMasyarakat: "Staff Warsi",
      noHp: "08123456789",
      namaOrganisasi: "KKI Warsi",
      modeKombinasiTarget: "per_kategori"
    };

    const mockTerbitkan = vi.fn();
    const mockTerbitkanBanyak = vi.fn();

    const dom = pasang(
      <AdminDashboardView
        dataSpasial={dataSpasial}
        profilKader={profilAdmin}
        sertifikatList={[]}
        tugasList={[]}
        kaderAktifList={[]}
        sesiAdmin={null}
        onVerifikasiData={vi.fn()}
        onUbahDataSpasial={vi.fn()}
        onHapusDataSpasial={vi.fn()}
        onTerbitkanSertifikat={mockTerbitkan}
        onTerbitkanBanyakSertifikat={mockTerbitkanBanyak}
        onTambahTugas={vi.fn()}
        onHapusTugas={vi.fn()}
        onBalasPesanAdmin={vi.fn()}
        onFokusKePeta={vi.fn()}
      />
    );

    // Pindah ke tab Sertifikat di Admin
    const tombolTabSertifikat = Array.from(dom.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Sertifikat")
    );
    klik(tombolTabSertifikat || null);

    // Periksa bahwa Skema Automasi Pengkodean Sertifikat tampil
    const selectSkema = dom.querySelector("#pilih-skema-pengkodean");
    expect(selectSkema).toBeTruthy();

    // Periksa bahwa tabel menampilkan kolom Nomor Sertifikat (Otomatis)
    expect(dom.textContent).toContain("Nomor Sertifikat (Otomatis)");

    // Periksa tombol Terbitkan Semua Otomatis tampil
    const btnSemua = dom.querySelector("#btn-terbitkan-semua-otomatis");
    expect(btnSemua).toBeTruthy();

    // Klik tombol Terbitkan Semua Otomatis
    klik(btnSemua);
    expect(mockTerbitkanBanyak).toHaveBeenCalledTimes(1);
    const diterbitkanList = mockTerbitkanBanyak.mock.calls[0][0];
    expect(diterbitkanList).toHaveLength(1);
    expect(diterbitkanList[0].idKader).toBe("KDR-10");
    expect(diterbitkanList[0].nomorSertifikat).toMatch(/^\d{4}\/SKPP-GIS\//);
  });
});
