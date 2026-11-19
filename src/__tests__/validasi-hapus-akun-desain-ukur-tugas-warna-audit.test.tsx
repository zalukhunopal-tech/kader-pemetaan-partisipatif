// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AkunSesi,
  autentikasiLogin,
  bersihkanAkunSetelahTes,
  buatAdminPertama,
  hapusAkunOlehAdmin,
  konfigUji,
  muatSemuaAkun,
  mulaiPendaftaranEmail,
  mulaiPendaftaranTotp,
  selesaikanPendaftaranTotp,
  setujuiAkunOlehAdmin,
  verifikasiKodeEmailPendaftaran
} from "../lib/auth";
import { hitungTotp } from "../lib/totp";
import { perekamLatar } from "../lib/perekamLatar";
import { buatFieldSkemaBaru, sinkronkanLapisanDariTugas } from "../lib/skemaTugas";
import { PeekSheetInteraktif } from "../components/peta/PeekSheetInteraktif";
import { TugasPemetaan } from "../types";

const AKAR = resolve(__dirname, "..");
konfigUji.iterasi = 1000;

beforeEach(() => {
  bersihkanAkunSetelahTes();
  localStorage.clear();
  perekamLatar.batal();
});

afterEach(() => {
  bersihkanAkunSetelahTes();
  localStorage.clear();
  perekamLatar.batal();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(() => {
  bersihkanAkunSetelahTes();
  localStorage.clear();
});

describe("Validasi Hapus Akun, Desain Toast & Tugas, Gambar-Ukur Line, Format Per Tipe, Warna Simbol, dan Menu Hapus Objek", () => {
  it("1. Fitur Hapus Akun berfungsi penuh dan AkunAdminPanel memakai kotak konfirmasi kustom tanpa window.confirm", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 19, 8, 0, 0));

    const sandi = "RimbaHijau-2026";
    const emailAdmin = "admin.uji@contoh.id";
    await buatAdminPertama({
      nama: "Admin Uji",
      email: emailAdmin,
      kataSandi: sandi,
      desaWilayah: "Desa A",
      noHp: "08120001"
    });
    const m = await mulaiPendaftaranTotp(emailAdmin, sandi);
    expect(m.sukses).toBe(true);
    await selesaikanPendaftaranTotp(emailAdmin, sandi, m.rahasia!, hitungTotp(m.rahasia!)!);
    vi.setSystemTime(new Date(Date.now() + 35_000));
    const login = await autentikasiLogin(emailAdmin, sandi, hitungTotp(m.rahasia!)!);
    expect(login.sukses).toBe(true);
    const sesiAdmin = login.akun as AkunSesi;

    const emailKader = "kader.hapus@gmail.com";
    const daftar = await mulaiPendaftaranEmail({
      nama: "Kader Dihapus",
      email: emailKader,
      desaWilayah: "Desa B",
      noHp: "08130002",
      kataSandi: sandi
    });
    expect(daftar.sukses).toBe(true);
    const verif = await verifikasiKodeEmailPendaftaran(emailKader, daftar.kodeVerifikasi!);
    expect(verif.sukses).toBe(true);
    expect(setujuiAkunOlehAdmin(sesiAdmin, emailKader).sukses).toBe(true);
    expect(muatSemuaAkun().some((a) => a.email === emailKader)).toBe(true);

    // Hapus akun kader oleh admin
    const resHapus = hapusAkunOlehAdmin(sesiAdmin, emailKader);
    expect(resHapus.sukses).toBe(true);
    expect(muatSemuaAkun().some((a) => a.email === emailKader)).toBe(false);

    // Pastikan AkunAdminPanel tidak lagi memakai window.confirm dan punya modal konfirmasi kustom
    const panelAkunSrc = readFileSync(resolve(AKAR, "components/AkunAdminPanel.tsx"), "utf8");
    expect(panelAkunSrc).not.toContain("window.confirm");
    expect(panelAkunSrc).toContain("Konfirmasi Hapus Akun");
    expect(panelAkunSrc).toContain("Ya, Hapus Akun");
    expect(panelAkunSrc).toContain("konfirmasi-modal-card");
  });

  it("2. Desain Toast (snackbar rapi bukan oval gepeng) dan Kartu Field Tugas (input nama lebar penuh)", () => {
    const appCss = readFileSync(resolve(AKAR, "styles/app.css"), "utf8");
    const adminSrc = readFileSync(resolve(AKAR, "components/AdminDashboardView.tsx"), "utf8");

    expect(appCss).toMatch(/\.avenza-toast\s*\{[^}]*border-radius:\s*14px/);
    expect(appCss).toMatch(/\.avenza-toast\.ada-aksi\s*\{[^}]*width:\s*min\(calc\(100vw - 24px\),\s*440px\)/);
    expect(appCss).toContain(".tugas-field-card-head");
    expect(appCss).toContain(".tugas-field-name-wrap");
    expect(adminSrc).toContain("tugas-field-card-head");
    expect(adminSrc).toContain("tugas-field-name-wrap");
  });

  it("3. Fitur Gambar dan Ukur dimulai dari Line terlebih dahulu dan keluar tidak mengalihkan ke perekaman jalur/layar", () => {
    const interactiveMap = readFileSync(resolve(AKAR, "components/InteractiveMap.tsx"), "utf8");
    const appSrc = readFileSync(resolve(AKAR, "App.tsx"), "utf8");

    // Tombol Gambar dan Ukur memulai dari mode line
    expect(interactiveMap).toContain('onClick={() => mulaiModeRekam("line", true)}');
    // Menggunakan mulaiGambarUkur (bukan perekaman latar)
    expect(interactiveMap).toContain("perekamLatar.mulaiGambarUkur");
    // BannerPerekaman di App.tsx mengecualikan modeGambarUkur
    expect(appSrc).toContain("rekamLatar.status !== \"idle\" && !rekamLatar.modeGambarUkur");

    // Verifikasi perilaku state perekamLatar.mulaiGambarUkur -> batal
    perekamLatar.mulaiGambarUkur("line", [{ lat: 3.94, lng: 116.0 }]);
    expect(perekamLatar.getState().modeGambarUkur).toBe(true);
    expect(perekamLatar.getState().jenis).toBe("line");
    expect(perekamLatar.getState().status).toBe("dijeda");

    perekamLatar.batal();
    expect(perekamLatar.getState().status).toBe("idle");
    expect(perekamLatar.getState().modeGambarUkur).toBe(false);
    expect(perekamLatar.getState().titik).toHaveLength(0);
  });

  it("4. Tugas Admin mendukung pilihan tipe data (Point & Line, Point saja, semua, atau Default bila tidak diatur)", () => {
    // Kasus A: Point dan Line saja dengan format berbeda masing-masing
    const tugasPointLine: TugasPemetaan = {
      id: "T-PL",
      judul: "Survei Sumber Air dan Jalur Patroli",
      deskripsi: "Khusus Point dan Line",
      targetWilayah: "Desa A",
      jenisTargetGeometri: "point",
      tipeGeometriDiizinkan: ["point", "line"],
      targetKuantitas: "2 isian",
      batasWaktu: "-",
      koordinatAcuan: { lat: 3.9, lng: 116.0 },
      status: "aktif",
      dibuatOleh: "Admin",
      skemaGeometri: {
        point: [buatFieldSkemaBaru({ nama: "Debit Air", tipe: "angka", wajib: true, tabel: "Data Point" })],
        line: [buatFieldSkemaBaru({ nama: "Kondisi Jalur", tipe: "teks", wajib: true, tabel: "Data Line" })],
        polygon: [],
        daftarTabel: { point: ["Data Point"], line: ["Data Line"], polygon: [] }
      }
    };

    // Kasus B: Tidak diatur -> mode Default
    const tugasDefault: TugasPemetaan = {
      id: "T-DEF",
      judul: "Pemetaan Umum Default",
      deskripsi: "Default",
      targetWilayah: "Desa A",
      jenisTargetGeometri: "point",
      targetKuantitas: "Format default",
      batasWaktu: "-",
      koordinatAcuan: { lat: 3.9, lng: 116.0 },
      status: "aktif",
      dibuatOleh: "Admin"
    };

    const lapisan = sinkronkanLapisanDariTugas([], [tugasPointLine, tugasDefault]);
    const lapPL = lapisan.find((l) => l.tugasId === "T-PL");
    const lapDef = lapisan.find((l) => l.tugasId === "T-DEF");

    expect(lapPL?.tipeGeometriDiizinkan).toEqual(["point", "line"]);
    expect(lapPL?.skemaGeometri?.point).toHaveLength(1);
    expect(lapPL?.skemaGeometri?.line).toHaveLength(1);
    expect(lapPL?.skemaGeometri?.polygon).toHaveLength(0);

    expect(lapDef?.tipeGeometriDiizinkan).toBeUndefined();
    expect(lapDef?.skemaGeometri?.point).toHaveLength(0);
    expect(lapDef?.skemaGeometri?.line).toHaveLength(0);
    expect(lapDef?.skemaGeometri?.polygon).toHaveLength(0);
  });

  it("5. Nama warna simbol bersih tanpa embel-embel tambahan di seluruh komponen peta", () => {
    const formSrc = readFileSync(resolve(AKAR, "components/peta/FormSurveiModal.tsx"), "utf8");
    const peekSrc = readFileSync(resolve(AKAR, "components/peta/PeekSheetInteraktif.tsx"), "utf8");
    const inspSrc = readFileSync(resolve(AKAR, "components/peta/InspektorObjek.tsx"), "utf8");

    for (const src of [formSrc, peekSrc, inspSrc]) {
      expect(src).not.toContain("Hijau zamrud");
      expect(src).not.toContain("Ungu peta");
      expect(src).not.toContain("Biru langit");
      expect(src).not.toContain("Kuning emas");
      expect(src).not.toContain("Pin Merah");
      expect(src).not.toContain("Pin Biru");
      expect(src).not.toContain("Pin Hijau");
      expect(src).not.toContain("Pin Kuning");
      expect(src).not.toContain("Pin Ungu");
      expect(src).not.toContain("Jingga jejak");
      expect(src).not.toContain("Jingga area");
    }

    expect(formSrc).toContain('{ id: "Hijau", label: "Hijau", warna: "#0d7344" }');
    expect(formSrc).toContain('{ id: "Ungu", label: "Ungu", warna: "#7c3aed" }');
  });

  it("6. Menu Hapus tersedia untuk Point, Line, dan Polygon di PeekSheetInteraktif dan daftar objek InteractiveMap", () => {
    const interactiveMap = readFileSync(resolve(AKAR, "components/InteractiveMap.tsx"), "utf8");
    expect(interactiveMap).toContain("avz-daftar-hapus-btn");

    for (const jenis of ["point", "line", "polygon"] as const) {
      const html = renderToString(
        <PeekSheetInteraktif
          mode="objek_terpilih"
          objekTerpilih={{
            id: `obj-${jenis}`,
            idKader: "K1",
            namaKader: "Kader",
            desaWilayah: "Desa",
            kategori: "Lainnya",
            judul: `Objek ${jenis}`,
            deskripsi: "",
            jenisGeometri: jenis,
            koordinat: [
              { lat: 3.9, lng: 116.0 },
              { lat: 3.91, lng: 116.01 },
              { lat: 3.9, lng: 116.02 }
            ],
            panjangKm: 1.5,
            luasHa: 12,
            statusSinkron: "lokal",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            riwayatPembaruan: []
          }}
          onBukaFormLengkap={vi.fn()}
          onBukaDetailLengkap={vi.fn()}
          onTutup={vi.fn()}
          onGoTo={vi.fn()}
          onBagikan={vi.fn()}
          onHapus={vi.fn()}
        />
      );
      expect(html).toContain("Hapus");
    }
  });
});
