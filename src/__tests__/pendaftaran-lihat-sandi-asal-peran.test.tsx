// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthModal } from "../components/AuthModal";
import {
  bersihkanAkunSetelahTes,
  buatAdminPertama,
  konfigUji,
  labelKategoriAsal,
  mulaiPendaftaranEmail,
  mulaiPendaftaranTotp,
  muatSemuaAkun,
  selesaikanPendaftaranTotp,
  setujuiAkunOlehAdmin,
  simpanSesiPengguna,
  verifikasiKodeEmailPendaftaran
} from "../lib/auth";
import { hitungTotp } from "../lib/totp";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SANDI_UJI = "RimbaHijau-2026";

describe("Pendaftaran Akun: Lihat Kata Sandi, Pilihan Asal (Masyarakat Desa / Staff Warsi / NGO Lain), dan Pilihan Peran (User / Admin)", () => {
  beforeEach(() => {
    konfigUji.iterasi = 1000;
    bersihkanAkunSetelahTes();
  });

  afterEach(() => {
    bersihkanAkunSetelahTes();
  });

  afterAll(() => {
    bersihkanAkunSetelahTes();
  });

  it("menampilkan tombol lihat/sembunyikan kata sandi pada formulir pendaftaran akun", async () => {
    await buatAdminPertama({
      nama: "Admin Awal",
      email: "admin.awal@warsi.or.id",
      desaWilayah: "KKI Warsi",
      noHp: "081122334455",
      kataSandi: SANDI_UJI
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AuthModal onLoginSukses={() => {}} />);
    });

    const tombolMenuDaftar = container.querySelector("#tombol-menu-daftar") as HTMLButtonElement | null;
    expect(tombolMenuDaftar).not.toBeNull();

    await act(async () => {
      tombolMenuDaftar?.click();
    });

    const inputSandi = container.querySelector("#daftar-sandi") as HTMLInputElement | null;
    const inputSandiUlang = container.querySelector("#daftar-sandi-ulang") as HTMLInputElement | null;
    const toggleSandi = container.querySelector("#toggle-lihat-sandi-daftar") as HTMLButtonElement | null;
    const toggleSandiUlang = container.querySelector("#toggle-lihat-sandi-daftar-ulang") as HTMLButtonElement | null;

    expect(inputSandi).not.toBeNull();
    expect(inputSandiUlang).not.toBeNull();
    expect(toggleSandi).not.toBeNull();
    expect(toggleSandiUlang).not.toBeNull();

    // Awalnya bertipe password
    expect(inputSandi?.type).toBe("password");
    expect(inputSandiUlang?.type).toBe("password");

    // Klik lihat kata sandi -> berubah menjadi text
    await act(async () => {
      toggleSandi?.click();
      toggleSandiUlang?.click();
    });
    expect(inputSandi?.type).toBe("text");
    expect(inputSandiUlang?.type).toBe("text");

    // Klik lagi -> kembali menjadi password
    await act(async () => {
      toggleSandi?.click();
      toggleSandiUlang?.click();
    });
    expect(inputSandi?.type).toBe("password");
    expect(inputSandiUlang?.type).toBe("password");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("menyesuaikan formulir pendaftaran untuk Masyarakat Desa, Staff Warsi, dan NGO Lain serta pilihan peran User atau Admin", async () => {
    await buatAdminPertama({
      nama: "Admin Awal",
      email: "admin.awal@warsi.or.id",
      desaWilayah: "KKI Warsi",
      noHp: "081122334455",
      kataSandi: SANDI_UJI
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AuthModal onLoginSukses={() => {}} />);
    });

    await act(async () => {
      (container.querySelector("#tombol-menu-daftar") as HTMLButtonElement)?.click();
    });

    const btnPeranKader = container.querySelector("#daftar-peran-kader") as HTMLButtonElement | null;
    const btnPeranAdmin = container.querySelector("#daftar-peran-admin") as HTMLButtonElement | null;
    const btnAsalMasyarakat = container.querySelector("#daftar-asal-masyarakat") as HTMLButtonElement | null;
    const btnAsalWarsi = container.querySelector("#daftar-asal-warsi") as HTMLButtonElement | null;
    const btnAsalNgo = container.querySelector("#daftar-asal-ngo") as HTMLButtonElement | null;

    expect(btnPeranKader?.getAttribute("aria-checked")).toBe("true");
    expect(btnPeranAdmin?.getAttribute("aria-checked")).toBe("false");
    expect(btnAsalMasyarakat?.getAttribute("aria-checked")).toBe("true");

    // Saat Masyarakat Desa aktif, IsianWilayah tampil
    expect(container.querySelector("#daftar-provinsi")).not.toBeNull();
    expect(container.querySelector("#daftar-wilayah-kerja")).toBeNull();

    // Pilih Staff Warsi dan peran Admin
    await act(async () => {
      btnPeranAdmin?.click();
      btnAsalWarsi?.click();
    });
    expect(btnPeranAdmin?.getAttribute("aria-checked")).toBe("true");
    expect(btnAsalWarsi?.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector("#daftar-wilayah-kerja")).not.toBeNull();
    expect((container.querySelector("#daftar-kelompok") as HTMLInputElement)?.placeholder).toContain("KKI Warsi");

    // Pilih NGO Lain -> input nama NGO menjadi wajib (required)
    await act(async () => {
      btnAsalNgo?.click();
    });
    expect(btnAsalNgo?.getAttribute("aria-checked")).toBe("true");
    const inputKelompokNgo = container.querySelector("#daftar-kelompok") as HTMLInputElement;
    expect(inputKelompokNgo.required).toBe(true);
    expect(inputKelompokNgo.placeholder).toContain("NGO");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("mendaftarkan akun Staff Warsi sebagai Admin dan akun NGO Lain sebagai User (Kader) dengan alur persetujuan Admin", async () => {
    // 1. Siapkan Admin aktif pertama untuk menyetujui pendaftaran
    await buatAdminPertama({
      nama: "Admin Utama",
      email: "admin.utama@warsi.or.id",
      desaWilayah: "KKI Warsi",
      noHp: "0811000011",
      kataSandi: SANDI_UJI
    });
    const totpUtama = await mulaiPendaftaranTotp("admin.utama@warsi.or.id", SANDI_UJI);
    expect(totpUtama.sukses).toBe(true);
    const selesaiUtama = await selesaikanPendaftaranTotp(
      "admin.utama@warsi.or.id",
      SANDI_UJI,
      totpUtama.rahasia!,
      hitungTotp(totpUtama.rahasia!)!
    );
    expect(selesaiUtama.sukses).toBe(true);
    const sesiAdminUtama = selesaiUtama.akun!;
    simpanSesiPengguna(sesiAdminUtama);

    // 2. Pendaftaran Staff Warsi yang memilih daftar sebagai Admin
    const mulaiWarsi = await mulaiPendaftaranEmail({
      nama: "Rizky Gis Warsi",
      email: "rizky.gis@warsi.or.id",
      peran: "admin",
      kategoriAsal: "staff_warsi",
      desaWilayah: "Lanskap Bukit Tigapuluh",
      noHp: "081277889900",
      kelompokMasyarakat: "Unit GIS dan Data Spasial",
      kataSandi: SANDI_UJI
    });
    expect(mulaiWarsi.sukses).toBe(true);

    const verifWarsi = await verifikasiKodeEmailPendaftaran("rizky.gis@warsi.or.id", mulaiWarsi.kodeVerifikasi!);
    expect(verifWarsi.sukses).toBe(true);
    expect(verifWarsi.menungguPersetujuan).toBe(true);

    const akunWarsi = muatSemuaAkun().find((a) => a.email === "rizky.gis@warsi.or.id")!;
    expect(akunWarsi).toBeDefined();
    expect(akunWarsi.peran).toBe("admin");
    expect(akunWarsi.idKader.startsWith("ADM-")).toBe(true);
    expect(akunWarsi.kategoriAsal).toBe("staff_warsi");
    expect(akunWarsi.kelompokMasyarakat).toBe("KKI Warsi — Unit GIS dan Data Spasial");
    expect(akunWarsi.desaWilayah).toBe("Lanskap Bukit Tigapuluh");
    expect(akunWarsi.statusPersetujuan).toBe("menunggu");
    expect(labelKategoriAsal(akunWarsi.kategoriAsal, akunWarsi.kelompokMasyarakat)).toBe("Staff KKI Warsi");

    // 3. Pendaftaran NGO Lain tanpa nama NGO ditolak, dengan nama NGO berhasil sebagai User (Kader)
    const gagalNgoKosong = await mulaiPendaftaranEmail({
      nama: "Sari Mitra",
      email: "sari@mitrango.org",
      peran: "kader",
      kategoriAsal: "ngo_lain",
      noHp: "081355667788",
      kelompokMasyarakat: "   ",
      kataSandi: SANDI_UJI
    });
    expect(gagalNgoKosong.sukses).toBe(false);
    expect(gagalNgoKosong.pesan).toMatch(/NGO|lembaga/i);

    const mulaiNgo = await mulaiPendaftaranEmail({
      nama: "Sari Mitra",
      email: "sari@mitrango.org",
      peran: "kader",
      kategoriAsal: "ngo_lain",
      desaWilayah: "Kalimantan Utara",
      noHp: "081355667788",
      kelompokMasyarakat: "Yayasan Hutan Lestari Nusantara",
      kataSandi: SANDI_UJI
    });
    expect(mulaiNgo.sukses).toBe(true);

    const verifNgo = await verifikasiKodeEmailPendaftaran("sari@mitrango.org", mulaiNgo.kodeVerifikasi!);
    expect(verifNgo.sukses).toBe(true);

    const akunNgo = muatSemuaAkun().find((a) => a.email === "sari@mitrango.org")!;
    expect(akunNgo.peran).toBe("kader");
    expect(akunNgo.idKader.startsWith("KDR-")).toBe(true);
    expect(akunNgo.kategoriAsal).toBe("ngo_lain");
    expect(akunNgo.kelompokMasyarakat).toBe("Yayasan Hutan Lestari Nusantara");
    expect(akunNgo.desaWilayah).toBe("Kalimantan Utara");
    expect(labelKategoriAsal(akunNgo.kategoriAsal, akunNgo.kelompokMasyarakat)).toBe("NGO / Lembaga Lain");

    // 4. Admin Utama menyetujui akun Staff Warsi (Admin) -> tetap berstatus Admin yang sah
    const setujuWarsi = setujuiAkunOlehAdmin(sesiAdminUtama, "rizky.gis@warsi.or.id");
    expect(setujuWarsi.sukses).toBe(true);

    const akunWarsiAktif = muatSemuaAkun().find((a) => a.email === "rizky.gis@warsi.or.id")!;
    expect(akunWarsiAktif.statusPersetujuan).toBe("disetujui");
    expect(akunWarsiAktif.peran).toBe("admin");
  });
});
