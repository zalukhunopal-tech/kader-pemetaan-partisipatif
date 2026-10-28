// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AkunPengguna,
  adaAdmin,
  aturUlangSandiOlehAdmin,
  autentikasiLogin,
  buatHashSandi,
  daftarAdminPertama,
  daftarAkunBaru,
  detikTertahan,
  konfigUji,
  migrasiAkunLama,
  muatSemuaAkun,
  muatSesiPengguna,
  siapkanAkunUji,
  ubahKataSandi,
  validasiKataSandi
} from "./auth";

konfigUji.iterasi = 1000; // tes cepat; hash sungguhan memakai 200.000 iterasi

const data = (n: string, over: Record<string, string> = {}) => ({
  nama: "Budi Santoso " + n,
  email: `budi${n}@contoh.id`,
  kataSandi: "RimbaHijau-2026",
  desaWilayah: "Desa A",
  noHp: "0812",
  ...over
});

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("validasiKataSandi", () => {
  it("menolak yang pendek, berulang, umum, dan memuat nama/email", () => {
    expect(validasiKataSandi("abc1234")).toMatch(/minimal 8/);
    expect(validasiKataSandi("aaaaaaaa")).toMatch(/diulang/);
    expect(validasiKataSandi("password")).toMatch(/umum/);
    expect(validasiKataSandi("kader123")).toMatch(/umum/);
    expect(validasiKataSandi("12345678")).toMatch(/umum/);
    expect(validasiKataSandi("sitirahma99", { email: "sitirahma@x.id" })).toMatch(/email/);
    expect(validasiKataSandi("Budi Santoso!1", { nama: "Budi Santoso" })).toMatch(/nama/);
  });
  it("menerima sandi yang wajar", () => {
    expect(validasiKataSandi("RimbaHijau-2026", { nama: "Budi", email: "b@x.id" })).toBeNull();
  });
});

describe("pendaftaran dan masuk", () => {
  it("menyimpan hash dengan garam, tanpa sandi teks polos, dan sesi tanpa rahasia", async () => {
    const r = await daftarAkunBaru(data("1"));
    expect(r.sukses).toBe(true);
    const [akun] = muatSemuaAkun();
    expect(akun.peran).toBe("kader");
    expect(akun.kataSandiHash.length).toBeGreaterThan(30);
    expect(akun.garam.length).toBeGreaterThan(10);
    expect(JSON.stringify(localStorage)).not.toContain("RimbaHijau-2026");
    const sesiMentah = localStorage.getItem("geokader_current_session_v5")!;
    expect(sesiMentah).not.toMatch(/kataSandiHash|garam|password/);
    expect(muatSesiPengguna()?.email).toBe("budi1@contoh.id");
  });

  it("dua akun dengan sandi sama mendapat hash dan garam berbeda", async () => {
    await daftarAkunBaru(data("1"));
    await daftarAkunBaru(data("2"));
    const [a, b] = muatSemuaAkun();
    expect(a.garam).not.toBe(b.garam);
    expect(a.kataSandiHash).not.toBe(b.kataSandiHash);
    expect(a.idKader).not.toBe(b.idKader);
    expect(a.idKader).toMatch(/^KDR-[0-9a-f]{12}$/);
  });

  it("menolak email ganda dan sandi lemah", async () => {
    await daftarAkunBaru(data("1"));
    expect((await daftarAkunBaru(data("1"))).pesan).toMatch(/sudah terdaftar/);
    expect((await daftarAkunBaru(data("3", { kataSandi: "password" }))).sukses).toBe(false);
  });

  it("login benar dan salah; pesan tidak membedakan email yang ada atau tidak", async () => {
    await daftarAkunBaru(data("1"));
    localStorage.removeItem("geokader_current_session_v5");
    const salah = await autentikasiLogin("budi1@contoh.id", "SalahSalah-1");
    const takAda = await autentikasiLogin("tidakada@contoh.id", "SalahSalah-1");
    expect(salah.sukses).toBe(false);
    expect(salah.pesan).toBe(takAda.pesan);
    expect(muatSesiPengguna()).toBeNull();
    const ok = await autentikasiLogin(" BUDI1@contoh.id ", "RimbaHijau-2026");
    expect(ok.sukses).toBe(true);
    expect(muatSesiPengguna()?.nama).toContain("Budi");
  });

  it("5 kegagalan berturut-turut menahan percobaan berikutnya, lalu pulih", async () => {
    await daftarAkunBaru(data("1"));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 28, 8, 0, 0));
    for (let i = 0; i < 5; i++) await autentikasiLogin("budi1@contoh.id", "SalahSalah-1");
    expect(detikTertahan("budi1@contoh.id")).toBe(30);
    const ditahan = await autentikasiLogin("budi1@contoh.id", "RimbaHijau-2026");
    expect(ditahan.sukses).toBe(false);
    expect(ditahan.pesan).toMatch(/Terlalu banyak percobaan/);
    vi.setSystemTime(new Date(2026, 9, 28, 8, 0, 31));
    expect((await autentikasiLogin("budi1@contoh.id", "RimbaHijau-2026")).sukses).toBe(true);
    expect(detikTertahan("budi1@contoh.id")).toBe(0);
  });
});

describe("peran dan admin (K1/T5)", () => {
  it("pendaftaran mandiri tidak pernah menghasilkan admin", async () => {
    await daftarAkunBaru(data("1"));
    expect(muatSemuaAkun().every((a) => a.peran === "kader")).toBe(true);
    expect(adaAdmin()).toBe(false);
  });

  it("admin pertama hanya boleh sekali per perangkat", async () => {
    expect((await daftarAdminPertama(data("A"))).sukses).toBe(true);
    expect(adaAdmin()).toBe(true);
    const kedua = await daftarAdminPertama(data("B"));
    expect(kedua.sukses).toBe(false);
    expect(kedua.pesan).toMatch(/sudah memiliki Administrator/);
    expect(muatSemuaAkun().find((a) => a.email === "budib@contoh.id")).toBeUndefined();
  });

  it("kode aktivasi admin diwajibkan bila VITE_KODE_ADMIN diisi", async () => {
    vi.stubEnv("VITE_KODE_ADMIN", "rahasia-org");
    expect((await daftarAdminPertama(data("A"), "salah")).pesan).toMatch(/Kode aktivasi/);
    expect(adaAdmin()).toBe(false);
    expect((await daftarAdminPertama(data("A"), " rahasia-org ")).sukses).toBe(true);
  });

  it("mengubah peran di sesi menjadi admin tidak berhasil (sesi dicek ke data akun)", async () => {
    await daftarAkunBaru(data("1"));
    const sesi = JSON.parse(localStorage.getItem("geokader_current_session_v5")!);
    localStorage.setItem("geokader_current_session_v5", JSON.stringify({ ...sesi, peran: "admin" }));
    expect(muatSesiPengguna()).toBeNull();
    expect(localStorage.getItem("geokader_current_session_v5")).toBeNull();
  });

  it("sesi untuk akun yang sudah tidak ada ditolak", async () => {
    await daftarAkunBaru(data("1"));
    localStorage.removeItem("geokader_accounts_v5");
    expect(muatSesiPengguna()).toBeNull();
  });
});

describe("ganti dan atur ulang sandi", () => {
  it("ubahKataSandi memerlukan sandi lama dan menolak sandi baru yang lemah atau sama", async () => {
    await daftarAkunBaru(data("1"));
    expect((await ubahKataSandi("budi1@contoh.id", "Salah-Salah-1", "SandiBaru-2027")).pesan).toMatch(/saat ini salah/);
    expect((await ubahKataSandi("budi1@contoh.id", "RimbaHijau-2026", "RimbaHijau-2026")).pesan).toMatch(/berbeda/);
    expect((await ubahKataSandi("budi1@contoh.id", "RimbaHijau-2026", "pendek")).sukses).toBe(false);
    expect((await ubahKataSandi("budi1@contoh.id", "RimbaHijau-2026", "SandiBaru-2027")).sukses).toBe(true);
    expect((await autentikasiLogin("budi1@contoh.id", "RimbaHijau-2026")).sukses).toBe(false);
    expect((await autentikasiLogin("budi1@contoh.id", "SandiBaru-2027")).sukses).toBe(true);
  });

  it("tidak ada reset mandiri: hanya admin yang dapat membuat sandi sementara", async () => {
    await daftarAdminPertama(data("A"));
    const sesiAdmin = muatSesiPengguna()!;
    await daftarAkunBaru(data("K"));
    const sesiKader = muatSesiPengguna()!;

    // kader tidak boleh
    expect((await aturUlangSandiOlehAdmin(sesiKader, "budia@contoh.id")).sukses).toBe(false);
    // sesi admin palsu (peran diubah) tidak boleh
    expect((await aturUlangSandiOlehAdmin({ ...sesiKader, peran: "admin" }, "budia@contoh.id")).sukses).toBe(false);
    expect((await aturUlangSandiOlehAdmin(null, "budik@contoh.id")).sukses).toBe(false);
    // admin tidak mengatur ulang dirinya sendiri
    expect((await aturUlangSandiOlehAdmin(sesiAdmin, "budia@contoh.id")).pesan).toMatch(/sendiri/);
    expect((await aturUlangSandiOlehAdmin(sesiAdmin, "tidakada@contoh.id")).pesan).toMatch(/tidak ditemukan/);

    const r = await aturUlangSandiOlehAdmin(sesiAdmin, "budik@contoh.id");
    expect(r.sukses).toBe(true);
    expect(r.sandiSementara).toMatch(/^[A-Za-z2-9]{12}$/);

    // sandi lama tidak berlaku; sandi sementara memaksa penggantian dan belum membuat sesi
    localStorage.removeItem("geokader_current_session_v5");
    expect((await autentikasiLogin("budik@contoh.id", "RimbaHijau-2026")).sukses).toBe(false);
    const sementara = await autentikasiLogin("budik@contoh.id", r.sandiSementara!);
    expect(sementara.sukses).toBe(false);
    expect(sementara.wajibGantiSandi).toBe(true);
    expect(muatSesiPengguna()).toBeNull();

    expect((await ubahKataSandi("budik@contoh.id", r.sandiSementara!, "KataBaruKu-2028")).sukses).toBe(true);
    const masuk = await autentikasiLogin("budik@contoh.id", "KataBaruKu-2028");
    expect(masuk.sukses).toBe(true);
    expect(masuk.wajibGantiSandi).toBeUndefined();
  });
});

describe("migrasi akun lama", () => {
  const lama = (over: Partial<AkunPengguna> & { password: string }): AkunPengguna =>
    ({
      idKader: "KDR-001", nama: "Budi", email: "kader@geokader.id", peran: "kader", desaWilayah: "-", noHp: "-",
      kelompokMasyarakat: "-", namaOrganisasi: "x", createdAt: "2026-01-01T00:00:00.000Z", kataSandiHash: "", garam: "", iterasi: 0, ...over
    }) as AkunPengguna;

  it("mengubah sandi teks polos menjadi hash dan menghapusnya dari akun dan sesi", async () => {
    const akun = lama({ email: "lain@contoh.id", password: "SandiLamaKu-77" });
    localStorage.setItem("geokader_accounts_v5", JSON.stringify([akun]));
    localStorage.setItem("geokader_current_session_v5", JSON.stringify(akun)); // sesi lama memuat seluruh akun
    await migrasiAkunLama();
    const [a] = muatSemuaAkun();
    expect(a.password).toBeUndefined();
    expect(a.kataSandiHash).not.toBe("");
    expect(a.wajibGantiSandi).toBeFalsy();
    expect(localStorage.getItem("geokader_accounts_v5")).not.toContain("SandiLamaKu-77");
    const sesi = localStorage.getItem("geokader_current_session_v5")!;
    expect(sesi).not.toContain("SandiLamaKu-77");
    expect(sesi).not.toMatch(/kataSandiHash|password/);
    expect((await autentikasiLogin("lain@contoh.id", "SandiLamaKu-77")).sukses).toBe(true);
  });

  it("akun yang masih memakai sandi bawaan lama wajib mengganti sandi dan sesinya dicabut", async () => {
    const akunAdmin = lama({ idKader: "ADM-001", nama: "Siti Rahma", email: "admin@geokader.id", peran: "admin", password: "admin123" });
    const akunKader = lama({ password: "kader123" });
    localStorage.setItem("geokader_accounts_v5", JSON.stringify([akunKader, akunAdmin]));
    localStorage.setItem("geokader_current_session_v5", JSON.stringify(akunAdmin));
    await migrasiAkunLama();
    const akun = muatSemuaAkun();
    expect(akun.every((a) => a.wajibGantiSandi === true && !a.password)).toBe(true);
    expect(localStorage.getItem("geokader_current_session_v5")).toBeNull();
    const masuk = await autentikasiLogin("admin@geokader.id", "admin123");
    expect(masuk.sukses).toBe(false);
    expect(masuk.wajibGantiSandi).toBe(true);
  });

  it("akun bawaan lama yang sandinya sudah diganti tidak dipaksa lagi", async () => {
    localStorage.setItem("geokader_accounts_v5", JSON.stringify([lama({ password: "SudahDiganti-9" })]));
    await migrasiAkunLama();
    expect(muatSemuaAkun()[0].wajibGantiSandi).toBeFalsy();
  });

  it("migrasi aman bila tidak ada akun atau data sudah baru", async () => {
    await migrasiAkunLama();
    expect(muatSemuaAkun()).toEqual([]);
    await daftarAkunBaru(data("1"));
    const sebelum = localStorage.getItem("geokader_accounts_v5");
    await migrasiAkunLama();
    expect(localStorage.getItem("geokader_accounts_v5")).toBe(sebelum);
  });
});

describe("akun uji (build pengembangan)", () => {
  it("dibuat berhash, tidak ditambahkan ulang, dan dapat dipakai masuk", async () => {
    await siapkanAkunUji();
    await siapkanAkunUji();
    const akun = muatSemuaAkun();
    expect(akun.map((a) => a.email).sort()).toEqual(["admin@geokader.id", "kader@geokader.id"]);
    expect(localStorage.getItem("geokader_accounts_v5")).not.toMatch(/kader123|admin123/);
    expect((await autentikasiLogin("kader@geokader.id", "kader123")).sukses).toBe(true);
  });
  it("tidak menimpa akun yang sudah ada dan tidak membuat admin kedua dari pendaftaran", async () => {
    const h = await buatHashSandi("SandiSendiri-5");
    localStorage.setItem("geokader_accounts_v5", JSON.stringify([{ ...(await (async () => ({ idKader: "ADM-9", nama: "Admin Asli", email: "admin@geokader.id", peran: "admin", desaWilayah: "-", noHp: "-", kelompokMasyarakat: "-", namaOrganisasi: "x", createdAt: "" }))()), ...h }]));
    await siapkanAkunUji();
    expect(muatSemuaAkun().find((a) => a.email === "admin@geokader.id")?.nama).toBe("Admin Asli");
  });
});
