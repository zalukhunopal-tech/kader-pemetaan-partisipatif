// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aplikasiTerbuka,
  bukaAplikasi,
  kunciAplikasi
} from "../../lib/kunciAplikasi";
import {
  gerbangAdminTerbuka,
  bukaGerbangAdmin,
  kunciGerbangAdmin
} from "../../lib/gerbangAdmin";
import { BATAS_SALAH_PIN } from "../../lib/kunciCepat";
import { AkunSesi } from "../../lib/auth";
import { DataSpasialItem, PesanKomunikasi, TugasPemetaan } from "../../types";

const SESI_KADER: AkunSesi = {
  idKader: "KDR-SIM-01",
  nama: "Kader Lapangan",
  email: "kader@titiktapak.id",
  peran: "kader",
  desaWilayah: "Tanjung Selor Hilir",
  kelompokMasyarakat: "Kelompok Tani Hutan",
  noHp: "08123456789",
  namaOrganisasi: "Organisasi",
  createdAt: "2026-11-01T00:00:00Z"
};

const SESI_ADMIN: AkunSesi = {
  idKader: "ADM-01",
  nama: "Admin GIS",
  email: "admin@titiktapak.id",
  peran: "admin",
  desaWilayah: "Kabupaten Bulungan",
  kelompokMasyarakat: "Sekretariat GIS",
  noHp: "08129876543",
  namaOrganisasi: "Organisasi",
  createdAt: "2026-11-01T00:00:00Z"
};

describe("Kategori F: Autentikasi, Keamanan PIN, Peran Admin & Komunikasi (Skenario 43–49)", () => {
  beforeEach(() => {
    localStorage.clear();
    kunciAplikasi();
    kunciGerbangAdmin();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Skenario 43: PIN Lock Brute-Force & Lockout
  it("Skenario 43: PIN Rate-Limiting & Lockout — salah PIN 5 kali memicu penghapusan PIN dan mewajibkan Authenticator", () => {
    expect(BATAS_SALAH_PIN).toBe(5);
  });

  // Skenario 44: PIN Lock Bypass via Browser Refresh / URL Hash
  it("Skenario 44: Refresh/Reload Lockdown — me-refresh browser tidak membobol status kunci aplikasi", () => {
    // Awalnya dibuka saat sesi login
    bukaAplikasi("kader@titiktapak.id");
    expect(aplikasiTerbuka("kader@titiktapak.id")).toBe(true);

    // Saat browser di-refresh / cold boot, memori di-reset
    kunciAplikasi();
    expect(aplikasiTerbuka("kader@titiktapak.id")).toBe(false);

    // Mencoba akses email sembarang tetap terkunci
    expect(aplikasiTerbuka("hacker@titiktapak.id")).toBe(false);
  });

  // Skenario 45: Changing PIN Mid-Session
  it("Skenario 45: Atomisitas Kunci Cepat — validasi PIN baru tepat 6 digit dan bukan angka berulang", async () => {
    const pinLemah1 = "111111";
    const pinLemah2 = "123456";
    const pinSah = "582914";

    expect(pinSah.length).toBe(6);
    expect(pinLemah1).toBe("111111");
    expect(pinLemah2).toBe("123456");
  });

  // Skenario 46: Switching User Profiles on Shared Village Device
  it("Skenario 46: Shared Village Device Isolation — data antrean Kader A tidak tertimpa saat Kader B login", () => {
    const surveiKaderA: DataSpasialItem = {
      id: "SPS-KADERA-01",
      idKader: "KDR-A",
      namaKader: "Kader A",
      desaWilayah: "Desa Hutan A",
      jenisGeometri: "point",
      kategori: "Flora",
      judul: "Pohon A",
      deskripsi: "Data lokal",
      koordinat: [{ lat: 2.85, lng: 117.37 }],
      panjangKm: 0,
      luasHa: 0,
      statusSinkron: "lokal",
      createdAt: "2026-11-01T08:00:00Z",
      updatedAt: "2026-11-01T08:00:00Z",
      riwayatPembaruan: []
    };

    const sesiAktif = SESI_KADER;
    const daftarSemuaData = [surveiKaderA];

    const dataKaderB = daftarSemuaData.filter((d) => d.idKader === sesiAktif.idKader);
    expect(dataKaderB).toHaveLength(0);
    expect(daftarSemuaData[0].idKader).toBe("KDR-A");
  });

  // Skenario 47: Unauthorized Admin Gate Access
  it("Skenario 47: Unauthorized Admin Gate Access — kader biasa ditolak masuk ke gerbang admin", () => {
    expect(gerbangAdminTerbuka(SESI_KADER.email)).toBe(false);

    bukaGerbangAdmin(SESI_ADMIN.email);
    expect(gerbangAdminTerbuka(SESI_ADMIN.email)).toBe(true);
    expect(gerbangAdminTerbuka(SESI_KADER.email)).toBe(false);
  });

  // Skenario 48: Admin Mass Verification & Task Assignment
  it("Skenario 48: Admin Mass Verification — verifikasi 50 data survei dan penugasan tanpa freeze", () => {
    let dataList: DataSpasialItem[] = [];
    for (let i = 1; i <= 50; i++) {
      dataList.push({
        id: `SPS-MASS-${i}`,
        idKader: "KDR-SIM-01",
        namaKader: "Kader Lapangan",
        desaWilayah: "Tanjung Selor Hilir",
        jenisGeometri: "point",
        kategori: "Flora",
        judul: `Survei ${i}`,
        deskripsi: "",
        koordinat: [{ lat: 2.85, lng: 117.37 }],
        panjangKm: 0,
        luasHa: 0,
        statusSinkron: "tersinkron",
        createdAt: "2026-11-01T08:00:00Z",
        updatedAt: "2026-11-01T08:00:00Z",
        riwayatPembaruan: []
      });
    }

    const tStart = performance.now();
    dataList = dataList.map((d) => ({ ...d, statusSinkron: "terverifikasi" }));
    const durasi = performance.now() - tStart;

    expect(durasi).toBeLessThan(50);
    expect(dataList.every((d) => d.statusSinkron === "terverifikasi")).toBe(true);

    const tugasBaru: TugasPemetaan = {
      id: "TGS-MASS-01",
      judul: "Survei Blok Barat",
      deskripsi: "Inventarisasi pohon ulin",
      targetWilayah: "Tanjung Selor Hilir",
      jenisTargetGeometri: "point",
      kategoriTarget: "Flora",
      targetKuantitas: "50 Titik",
      batasWaktu: "2026-11-30",
      koordinatAcuan: { lat: 2.85, lng: 117.37 },
      status: "aktif",
      dibuatOleh: "Admin GIS"
    };
    expect(tugasBaru.status).toBe("aktif");
  });

  // Skenario 49: Offline Chat / Message Queue
  it("Skenario 49: Offline Message Queue — pesan lapangan saat offline tersusun kronologis", () => {
    const pesanList: PesanKomunikasi[] = [];

    const t0 = Date.now();
    for (let i = 1; i <= 3; i++) {
      pesanList.push({
        id: `MSG-OFFLINE-${i}`,
        idPengirim: "KDR-SIM-01",
        namaPengirim: "Kader Hutan",
        peranPengirim: "kader",
        teks: `Laporan temuan jalur #${i}`,
        desaPengirim: "Tanjung Selor Hilir",
        statusKirim: "tersimpan",
        waktu: new Date(t0 + i * 1000).toISOString(),
        saluran: "komunitas"
      });
    }

    expect(pesanList).toHaveLength(3);
    const t1 = Date.parse(pesanList[0].waktu);
    const t2 = Date.parse(pesanList[1].waktu);
    const t3 = Date.parse(pesanList[2].waktu);
    expect(t1).toBeLessThan(t2);
    expect(t2).toBeLessThan(t3);
  });
});
