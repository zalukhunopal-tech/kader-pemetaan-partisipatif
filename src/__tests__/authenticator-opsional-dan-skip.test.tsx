// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthModal } from "../components/AuthModal";
import {
  AkunSesi,
  aturUlangAuthenticatorOlehAdmin,
  autentikasiLogin,
  bersihkanAkunSetelahTes,
  buatAdminPertama,
  konfigUji,
  lewatiPendaftaranTotp,
  mulaiPendaftaranEmail,
  muatSemuaAkun,
  muatSesiPengguna,
  setujuiAkunOlehAdmin,
  simpanSesiPengguna,
  verifikasiKodeEmailPendaftaran
} from "../lib/auth";
import { bukaGerbangAdmin } from "../lib/gerbangAdmin";
import { bukaAplikasi } from "../lib/kunciAplikasi";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SANDI_UJI = "RimbaHijau-2026";

function ubahInput(el: HTMLInputElement, nilai: string) {
  const proto = HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, nilai);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const tunggu = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Pendaftaran Google Authenticator: Opsional dan Dapat di-Skip untuk Langsung Masuk ke Aplikasi", () => {
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

  it("1. Penyiapan Administrator pertama: layar Authenticator menampilkan label Opsional dan tombol Skip untuk langsung masuk", async () => {
    let akunMasuk: AkunSesi | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AuthModal onLoginSukses={(akun) => { akunMasuk = akun; }} />);
    });

    // Form setup admin muncul
    const formSetup = container.querySelector("#form-setup-admin") as HTMLFormElement | null;
    expect(formSetup).not.toBeNull();

    // Isi form setup admin
    const inputs = container.querySelectorAll("input");
    const inputNama = inputs[0] as HTMLInputElement;
    const inputEmail = inputs[1] as HTMLInputElement;
    const inputSandi = container.querySelector("#setup-sandi") as HTMLInputElement;
    const inputSandiUlang = container.querySelector("#setup-sandi-ulang") as HTMLInputElement;

    ubahInput(inputNama, "Admin Utama");
    ubahInput(inputEmail, "admin.pertama@titiktapak.id");
    ubahInput(inputSandi, SANDI_UJI);
    ubahInput(inputSandiUlang, SANDI_UJI);

    // Submit form setup
    await act(async () => {
      formSetup?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await tunggu(100);
    });

    // Layar berubah ke mode daftar_totp (Google Authenticator Opsional)
    const formTotp = container.querySelector("#form-daftar-totp") as HTMLFormElement | null;
    expect(formTotp).not.toBeNull();

    // Memverifikasi teks "(Opsional)" dan tombol "Skip" dengan keterangan masuk aplikasi
    expect(container.textContent).toContain("Pasang Google Authenticator (Opsional)");
    expect(container.textContent).toContain("opsional");

    const tombolSkip = container.querySelector("#tombol-skip-totp") as HTMLButtonElement | null;
    expect(tombolSkip).not.toBeNull();
    expect(tombolSkip?.textContent).toContain("Skip");
    expect(tombolSkip?.textContent).toContain("Langsung Masuk ke Aplikasi");

    // Klik tombol Skip
    await act(async () => {
      tombolSkip?.click();
      await tunggu(400);
    });

    // Admin berhasil langsung masuk ke dalam aplikasi
    expect(akunMasuk).not.toBeNull();
    expect((akunMasuk as unknown as AkunSesi).email).toBe("admin.pertama@titiktapak.id");
    expect((akunMasuk as unknown as AkunSesi).peran).toBe("admin");
    expect((akunMasuk as unknown as AkunSesi).totpDilewati).toBe(true);

    const akunTersimpan = muatSemuaAkun().find((a) => a.email === "admin.pertama@titiktapak.id");
    expect(akunTersimpan?.totpRahasia).toBeUndefined();
    expect(akunTersimpan?.totpDilewati).toBe(true);
    expect(muatSesiPengguna()?.email).toBe("admin.pertama@titiktapak.id");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("2. Pendaftaran akun baru: pendaftaran Google Authenticator dapat di-skip dengan tombol skip untuk langsung masuk ke aplikasi", async () => {
    // Siapkan admin
    const admin = await buatAdminPertama({
      nama: "Admin Wilayah",
      email: "admin.wilayah@titiktapak.id",
      desaWilayah: "Desa Rimba",
      noHp: "081234567890",
      kataSandi: SANDI_UJI
    });
    expect(admin.sukses).toBe(true);
    await lewatiPendaftaranTotp("admin.wilayah@titiktapak.id", SANDI_UJI);

    // Daftarkan akun baru
    const daftar = await mulaiPendaftaranEmail({
      nama: "Budi Kader",
      email: "budi.kader@gmail.com",
      peran: "kader",
      kategoriAsal: "masyarakat_desa",
      desaWilayah: "Desa Rimba",
      noHp: "089876543210",
      kataSandi: "KaderRimba-2026"
    });
    expect(daftar.sukses).toBe(true);
    await verifikasiKodeEmailPendaftaran("budi.kader@gmail.com", daftar.kodeVerifikasi!);
    const sesiAdmin = muatSesiPengguna();
    expect(setujuiAkunOlehAdmin(sesiAdmin, "budi.kader@gmail.com").sukses).toBe(true);

    // Login sebagai user baru di AuthModal
    let akunMasuk: AkunSesi | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AuthModal onLoginSukses={(akun) => { akunMasuk = akun; }} />);
    });

    const inputEmailLogin = container.querySelector("input[type='email']") as HTMLInputElement;
    const inputSandiLogin = container.querySelector("input[type='password']") as HTMLInputElement;
    const formLogin = container.querySelector("form") as HTMLFormElement;

    ubahInput(inputEmailLogin, "budi.kader@gmail.com");
    ubahInput(inputSandiLogin, "KaderRimba-2026");

    await act(async () => {
      formLogin.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await tunggu(100);
    });

    // Muncul form pasang Google Authenticator (Opsional)
    const tombolSkip = container.querySelector("#tombol-skip-totp") as HTMLButtonElement | null;
    expect(tombolSkip).not.toBeNull();
    expect(tombolSkip?.textContent).toContain("Skip");
    expect(tombolSkip?.textContent).toContain("Langsung Masuk ke Aplikasi");

    // Klik Skip untuk langsung masuk ke aplikasi
    await act(async () => {
      tombolSkip?.click();
      await tunggu(400);
    });

    expect(akunMasuk).not.toBeNull();
    expect((akunMasuk as unknown as AkunSesi).email).toBe("budi.kader@gmail.com");
    expect((akunMasuk as unknown as AkunSesi).totpDilewati).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("3. Akun yang telah memilih skip TOTP dapat login berikutnya langsung menggunakan kata sandi", async () => {
    // Siapkan admin
    await buatAdminPertama({
      nama: "Admin Warsi",
      email: "admin.warsi@warsi.or.id",
      desaWilayah: "Jambi",
      noHp: "0811223344",
      kataSandi: SANDI_UJI
    });
    await lewatiPendaftaranTotp("admin.warsi@warsi.or.id", SANDI_UJI);

    // Daftarkan kader
    const daftar = await mulaiPendaftaranEmail({
      nama: "Siti Rahma",
      email: "siti.rahma@warsi.or.id",
      peran: "kader",
      kategoriAsal: "staff_warsi",
      desaWilayah: "Lanskap Bukit Tigapuluh",
      noHp: "0855667788",
      kataSandi: "WarsiLanskap-2026"
    });
    await verifikasiKodeEmailPendaftaran("siti.rahma@warsi.or.id", daftar.kodeVerifikasi!);
    const sesiAdmin = muatSesiPengguna();
    setujuiAkunOlehAdmin(sesiAdmin, "siti.rahma@warsi.or.id");

    // Pertama kali: lewati TOTP
    const resLewati = await lewatiPendaftaranTotp("siti.rahma@warsi.or.id", "WarsiLanskap-2026");
    expect(resLewati.sukses).toBe(true);
    expect(resLewati.akun?.totpDilewati).toBe(true);

    // Login berikutnya dengan email dan kata sandi langsung berhasil tanpa diminta TOTP
    const resLoginUlang = await autentikasiLogin("siti.rahma@warsi.or.id", "WarsiLanskap-2026");
    expect(resLoginUlang.sukses).toBe(true);
    expect(resLoginUlang.perluDaftarTotp).toBeUndefined();
    expect(resLoginUlang.perluKodeTotp).toBeUndefined();
    expect(resLoginUlang.akun?.email).toBe("siti.rahma@warsi.or.id");
  });

  it("4. Reset Authenticator oleh Admin mengembalikan opsi Authenticator untuk ditampilkan kembali saat login berikutnya", async () => {
    await buatAdminPertama({
      nama: "Admin Satu",
      email: "admin.satu@titiktapak.id",
      desaWilayah: "Pusat",
      noHp: "0811111111",
      kataSandi: SANDI_UJI
    });
    const lewatiAdmin = await lewatiPendaftaranTotp("admin.satu@titiktapak.id", SANDI_UJI);
    const sesiAdmin = lewatiAdmin.akun!;

    // Kader terdaftar dan lewati TOTP
    const daftar = await mulaiPendaftaranEmail({
      nama: "Bambang",
      email: "bambang@titiktapak.id",
      peran: "kader",
      kategoriAsal: "masyarakat_desa",
      desaWilayah: "Desa Lindung",
      noHp: "0822222222",
      kataSandi: "LindungHutan-2026"
    });
    expect(daftar.sukses).toBe(true);
    await verifikasiKodeEmailPendaftaran("bambang@titiktapak.id", daftar.kodeVerifikasi!);
    setujuiAkunOlehAdmin(sesiAdmin, "bambang@titiktapak.id");
    await lewatiPendaftaranTotp("bambang@titiktapak.id", "LindungHutan-2026");

    // Admin masuk kembali untuk mengelola akun
    const loginAdmin = await autentikasiLogin("admin.satu@titiktapak.id", SANDI_UJI);
    expect(loginAdmin.sukses).toBe(true);
    const sesiAdminAktif = loginAdmin.akun!;
    bukaGerbangAdmin(sesiAdminAktif.email);

    // Admin mereset Authenticator Bambang
    const reset = aturUlangAuthenticatorOlehAdmin(sesiAdminAktif, "bambang@titiktapak.id");
    expect(reset.sukses).toBe(true);

    const akunBambang = muatSemuaAkun().find((a) => a.email === "bambang@titiktapak.id");
    expect(akunBambang?.totpDilewati).toBeUndefined();
    expect(akunBambang?.totpRahasia).toBeUndefined();

    // Login berikutnya kembali menawarkan pilihan Authenticator / Skip
    const resLogin = await autentikasiLogin("bambang@titiktapak.id", "LindungHutan-2026");
    expect(resLogin.sukses).toBe(false);
    expect(resLogin.perluDaftarTotp).toBe(true);
  });
});
