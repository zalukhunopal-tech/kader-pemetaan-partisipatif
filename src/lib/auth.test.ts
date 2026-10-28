// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AkunPengguna,
  AkunSesi,
  RAHASIA_TOTP_UJI,
  adaAdmin,
  aturUlangAuthenticatorOlehAdmin,
  aturUlangSandiOlehAdmin,
  autentikasiLogin,
  buatAdminPertama,
  buatAkunOlehAdmin,
  buatHashSandi,
  detikTertahan,
  konfigUji,
  migrasiAkunLama,
  mulaiPendaftaranTotp,
  muatSemuaAkun,
  muatSesiPengguna,
  selesaikanPendaftaranTotp,
  siapkanAkunUji,
  ubahKataSandi,
  validasiKataSandi
} from "./auth";
import { hitungTotp, base32Decode } from "./totp";

konfigUji.iterasi = 1000; // tes cepat; hash sungguhan memakai 200.000 iterasi

const SANDI = "RimbaHijau-2026";
const data = (n: string, over: Record<string, string> = {}) => ({
  nama: "Budi Santoso " + n,
  email: `budi${n}@contoh.id`,
  kataSandi: SANDI,
  desaWilayah: "Desa A",
  noHp: "0812",
  ...over
});

/** Waktu dibekukan agar kode TOTP deterministik; tiap kode baru memakai langkah 30 detik berikutnya */
const WAKTU_AWAL = new Date(2026, 9, 28, 8, 0, 0);
const majuDetik = (n: number) => vi.setSystemTime(new Date(Date.now() + n * 1000));

/** Mendaftarkan Authenticator sampai akun bisa masuk; mengembalikan rahasia dan kode pemulihan */
async function pasangAuthenticator(email: string, sandi = SANDI) {
  const m = await mulaiPendaftaranTotp(email, sandi);
  expect(m.sukses).toBe(true);
  const r = await selesaikanPendaftaranTotp(email, sandi, m.rahasia!, hitungTotp(m.rahasia!)!);
  expect(r.sukses).toBe(true);
  return { rahasia: m.rahasia!, kodePemulihan: r.kodePemulihan! };
}

/** Masuk penuh (sandi + kode berikutnya) */
async function masukPenuh(email: string, rahasia: string, sandi = SANDI) {
  majuDetik(30);
  return autentikasiLogin(email, sandi, hitungTotp(rahasia)!);
}

/** Admin pertama lengkap dengan Authenticator dan sesi aktif */
async function siapkanAdmin(n = "A") {
  await buatAdminPertama(data(n));
  const auth = await pasangAuthenticator(data(n).email);
  const masuk = await masukPenuh(data(n).email, auth.rahasia);
  return { ...auth, sesi: masuk.akun as AkunSesi, email: data(n).email.toLowerCase() };
}

/** Admin membuat kader, kader mengganti sandi sementara dan memasang Authenticator */
async function buatKaderLengkap(admin: AkunSesi, n = "K", sandiBaru = "KataBaruKu-2028") {
  const r = await buatAkunOlehAdmin(admin, { nama: "Kader " + n, email: `kader${n.toLowerCase()}@contoh.id`, desaWilayah: "Desa B", noHp: "0813" });
  expect(r.sukses).toBe(true);
  const email = `kader${n.toLowerCase()}@contoh.id`;
  expect((await ubahKataSandi(email, r.sandiSementara!, sandiBaru)).sukses).toBe(true);
  const auth = await pasangAuthenticator(email, sandiBaru);
  return { ...auth, email, sandiBaru, sandiSementara: r.sandiSementara! };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WAKTU_AWAL);
});
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
    expect(validasiKataSandi(SANDI, { nama: "Budi", email: "b@x.id" })).toBeNull();
  });
});

describe("tidak ada pendaftaran mandiri; admin pertama dan akun dari admin", () => {
  it("admin pertama: tersimpan sebagai hash, tanpa sandi polos, dan belum bisa masuk sebelum memasang Authenticator", async () => {
    const r = await buatAdminPertama(data("A"));
    expect(r.sukses).toBe(true);
    expect(r.perluDaftarTotp).toBe(true);
    const [akun] = muatSemuaAkun();
    expect(akun.peran).toBe("admin");
    expect(akun.idKader).toMatch(/^ADM-[0-9a-f]{12}$/);
    expect(akun.kataSandiHash.length).toBeGreaterThan(30);
    expect(akun.totpRahasia).toBeUndefined();
    expect(JSON.stringify(localStorage)).not.toContain(SANDI);
    expect(muatSesiPengguna()).toBeNull();
    expect(localStorage.getItem("geokader_current_session_v5")).toBeNull(); // tidak ada sesi otomatis
  });

  it("admin pertama hanya boleh sekali per perangkat", async () => {
    expect((await buatAdminPertama(data("A"))).sukses).toBe(true);
    expect(adaAdmin()).toBe(true);
    const kedua = await buatAdminPertama(data("B"));
    expect(kedua.sukses).toBe(false);
    expect(kedua.pesan).toMatch(/sudah memiliki Administrator/);
    expect(muatSemuaAkun().find((a) => a.email === "budib@contoh.id")).toBeUndefined();
  });

  it("kode aktivasi admin diwajibkan bila VITE_KODE_ADMIN diisi", async () => {
    vi.stubEnv("VITE_KODE_ADMIN", "rahasia-org");
    expect((await buatAdminPertama(data("A"), "salah")).pesan).toMatch(/Kode aktivasi/);
    expect(adaAdmin()).toBe(false);
    expect((await buatAdminPertama(data("A"), " rahasia-org ")).sukses).toBe(true);
  });

  it("menolak nama kosong, email tidak sah, email ganda, dan sandi lemah", async () => {
    expect((await buatAdminPertama(data("A", { nama: "  " }))).pesan).toMatch(/Nama/);
    expect((await buatAdminPertama(data("A", { email: "bukan-email" }))).pesan).toMatch(/email/i);
    expect((await buatAdminPertama(data("A", { kataSandi: "password" }))).sukses).toBe(false);
    expect(muatSemuaAkun()).toHaveLength(0);
    expect((await buatAdminPertama(data("A"))).sukses).toBe(true);
  });

  it("hanya admin yang dapat membuat akun: kader, sesi palsu, dan tanpa sesi ditolak", async () => {
    const admin = await siapkanAdmin();
    const kader = await buatKaderLengkap(admin.sesi);
    const sesiKader = (await masukPenuh(kader.email, kader.rahasia, kader.sandiBaru)).akun!;
    const baru = { nama: "Lain", email: "lain@contoh.id", desaWilayah: "-", noHp: "-" };
    expect((await buatAkunOlehAdmin(sesiKader, baru)).sukses).toBe(false);
    expect((await buatAkunOlehAdmin({ ...sesiKader, peran: "admin" }, baru)).sukses).toBe(false);
    expect((await buatAkunOlehAdmin(null, baru)).sukses).toBe(false);
    expect(muatSemuaAkun().find((a) => a.email === "lain@contoh.id")).toBeUndefined();
  });

  it("admin membuat kader: sandi sementara acak tampil sekali, tersimpan sebagai hash, ID unik, wajib ganti sandi", async () => {
    const admin = await siapkanAdmin();
    const r = await buatAkunOlehAdmin(admin.sesi, { nama: "Siti Kader", email: "siti@contoh.id", desaWilayah: "Desa B", noHp: "0813", kelompokMasyarakat: "KTH" });
    expect(r.sukses).toBe(true);
    expect(r.sandiSementara).toMatch(/^[A-Za-z2-9]{12}$/);
    expect(r.akun).toMatchObject({ peran: "kader", nama: "Siti Kader", desaWilayah: "Desa B", kelompokMasyarakat: "KTH" });
    const akun = muatSemuaAkun().find((a) => a.email === "siti@contoh.id")!;
    expect(akun.idKader).toMatch(/^KDR-[0-9a-f]{12}$/);
    expect(akun.wajibGantiSandi).toBe(true);
    expect(akun.totpRahasia).toBeUndefined();
    expect(JSON.stringify(localStorage)).not.toContain(r.sandiSementara!);
    // email ganda ditolak
    expect((await buatAkunOlehAdmin(admin.sesi, { nama: "X", email: "SITI@contoh.id", desaWilayah: "-", noHp: "-" })).pesan).toMatch(/sudah terdaftar/);
  });

  it("admin dapat membuat admin lain; ID dan peran sesuai", async () => {
    const admin = await siapkanAdmin();
    const r = await buatAkunOlehAdmin(admin.sesi, { nama: "Admin Dua", email: "dua@contoh.id", desaWilayah: "-", noHp: "-", peran: "admin" });
    expect(r.sukses).toBe(true);
    expect(muatSemuaAkun().find((a) => a.email === "dua@contoh.id")).toMatchObject({ peran: "admin" });
    expect(muatSemuaAkun().find((a) => a.email === "dua@contoh.id")!.idKader).toMatch(/^ADM-/);
  });

  it("alur lengkap akun baru: sandi sementara, ganti sandi, pasang Authenticator, lalu masuk", async () => {
    const admin = await siapkanAdmin();
    const r = await buatAkunOlehAdmin(admin.sesi, { nama: "Siti Kader", email: "siti@contoh.id", desaWilayah: "-", noHp: "-" });
    // 1. sandi sementara: harus diganti dulu, belum ada sesi
    const sementara = await autentikasiLogin("siti@contoh.id", r.sandiSementara!);
    expect(sementara).toMatchObject({ sukses: false, wajibGantiSandi: true });
    expect((await mulaiPendaftaranTotp("siti@contoh.id", r.sandiSementara!)).sukses).toBe(false); // belum boleh sebelum ganti sandi
    expect((await ubahKataSandi("siti@contoh.id", r.sandiSementara!, "KataBaruKu-2028")).sukses).toBe(true);
    // 2. sandi benar tetapi Authenticator belum ada
    const belum = await autentikasiLogin("siti@contoh.id", "KataBaruKu-2028");
    expect(belum).toMatchObject({ sukses: false, perluDaftarTotp: true });
    expect(muatSesiPengguna()?.email).toBe(admin.email); // sesi admin lama tidak tertimpa
    // 3. pasang, lalu masuk
    const auth = await pasangAuthenticator("siti@contoh.id", "KataBaruKu-2028");
    const masuk = await masukPenuh("siti@contoh.id", auth.rahasia, "KataBaruKu-2028");
    expect(masuk.sukses).toBe(true);
    expect(masuk.akun?.nama).toBe("Siti Kader");
  });
});

describe("Google Authenticator (TOTP)", () => {
  const siapkanKader = async () => {
    const admin = await siapkanAdmin();
    const kader = await buatKaderLengkap(admin.sesi);
    return { admin, kader };
  };

  it("pendaftaran: butuh sandi benar, rahasia belum disimpan sebelum kode pertama benar, dan tautan QR memuat rahasia", async () => {
    await buatAdminPertama(data("A"));
    expect((await mulaiPendaftaranTotp("budia@contoh.id", "SalahSalah-1")).sukses).toBe(false);
    const m = await mulaiPendaftaranTotp("budia@contoh.id", SANDI);
    expect(m.sukses).toBe(true);
    expect(m.uri).toContain(`secret=${m.rahasia}`);
    expect(m.uri).toContain("issuer=GeoKader");
    expect(base32Decode(m.rahasia!)!.length).toBe(20);
    expect(muatSemuaAkun()[0].totpRahasia).toBeUndefined(); // belum disimpan

    const salah = await selesaikanPendaftaranTotp("budia@contoh.id", SANDI, m.rahasia!, "000000");
    expect(salah.sukses).toBe(false);
    expect(muatSemuaAkun()[0].totpRahasia).toBeUndefined();

    const benar = await selesaikanPendaftaranTotp("budia@contoh.id", SANDI, m.rahasia!, hitungTotp(m.rahasia!)!);
    expect(benar.sukses).toBe(true);
    expect(muatSemuaAkun()[0].totpRahasia).toBe(m.rahasia);
    expect(muatSesiPengguna()).toBeNull(); // pemanggil membuat sesi setelah kode pemulihan diakui
  });

  it("kode pemulihan: 8 kode ditampilkan sekali, hanya hash yang tersimpan", async () => {
    await buatAdminPertama(data("A"));
    const { kodePemulihan } = await pasangAuthenticator("budia@contoh.id");
    expect(kodePemulihan).toHaveLength(8);
    const mentah = JSON.stringify(localStorage);
    kodePemulihan.forEach((k) => {
      expect(mentah).not.toContain(k);
      expect(mentah).not.toContain(k.replace("-", ""));
    });
    expect(muatSemuaAkun()[0].kodePemulihanHash).toHaveLength(8);
  });

  it("sudah terdaftar: tidak bisa mendaftar ulang lewat sandi saja", async () => {
    await buatAdminPertama(data("A"));
    await pasangAuthenticator("budia@contoh.id");
    const lagi = await mulaiPendaftaranTotp("budia@contoh.id", SANDI);
    expect(lagi.sukses).toBe(false);
    expect(lagi.pesan).toMatch(/sudah terdaftar/);
  });

  it("masuk: sandi saja meminta kode dan belum membuat sesi; kode benar membuat sesi tanpa rahasia", async () => {
    await buatAdminPertama(data("A"));
    const { rahasia } = await pasangAuthenticator("budia@contoh.id");
    majuDetik(30);
    const langkah1 = await autentikasiLogin("budia@contoh.id", SANDI);
    expect(langkah1).toMatchObject({ sukses: false, perluKodeTotp: true });
    expect(muatSesiPengguna()).toBeNull();
    const langkah2 = await autentikasiLogin("budia@contoh.id", SANDI, hitungTotp(rahasia)!);
    expect(langkah2.sukses).toBe(true);
    expect(muatSesiPengguna()?.email).toBe("budia@contoh.id");
    const sesiMentah = localStorage.getItem("geokader_current_session_v5")!;
    expect(sesiMentah).not.toMatch(/totp|kodePemulihan|kataSandiHash|garam|password/i);
  });

  it("kode salah, kode benar dengan sandi salah, dan kode dari rahasia lain ditolak", async () => {
    await buatAdminPertama(data("A"));
    const { rahasia } = await pasangAuthenticator("budia@contoh.id");
    majuDetik(30);
    expect((await autentikasiLogin("budia@contoh.id", SANDI, "000000")).sukses).toBe(false);
    expect((await autentikasiLogin("budia@contoh.id", "SalahSalah-1", hitungTotp(rahasia)!)).sukses).toBe(false);
    expect((await autentikasiLogin("budia@contoh.id", SANDI, hitungTotp("JBSWY3DPEHPK3PXP")!)).sukses).toBe(false);
    expect(muatSesiPengguna()).toBeNull();
  });

  it("kode yang sudah dipakai tidak bisa dipakai lagi; kode langkah berikutnya bisa", async () => {
    await buatAdminPertama(data("A"));
    const { rahasia } = await pasangAuthenticator("budia@contoh.id");
    majuDetik(30);
    const kode = hitungTotp(rahasia)!;
    expect((await autentikasiLogin("budia@contoh.id", SANDI, kode)).sukses).toBe(true);
    localStorage.removeItem("geokader_current_session_v5");
    const ulang = await autentikasiLogin("budia@contoh.id", SANDI, kode);
    expect(ulang.sukses).toBe(false);
    expect(ulang.pesan).toMatch(/salah atau sudah kedaluwarsa/);
    majuDetik(30);
    expect((await autentikasiLogin("budia@contoh.id", SANDI, hitungTotp(rahasia)!)).sukses).toBe(true);
  });

  it("kode pendaftaran tidak bisa dipakai ulang untuk masuk pada langkah yang sama", async () => {
    await buatAdminPertama(data("A"));
    const m = await mulaiPendaftaranTotp("budia@contoh.id", SANDI);
    const kode = hitungTotp(m.rahasia!)!;
    await selesaikanPendaftaranTotp("budia@contoh.id", SANDI, m.rahasia!, kode);
    expect((await autentikasiLogin("budia@contoh.id", SANDI, kode)).sukses).toBe(false);
  });

  it("selisih jam HP ±30 detik masih diterima", async () => {
    await buatAdminPertama(data("A"));
    const { rahasia } = await pasangAuthenticator("budia@contoh.id");
    majuDetik(60);
    const terlambat = hitungTotp(rahasia, Date.now() - 30_000)!; // HP tertinggal 30 dtk
    expect((await autentikasiLogin("budia@contoh.id", SANDI, terlambat)).sukses).toBe(true);
  });

  it("kode pemulihan: berlaku sekali, mengurangi sisa, dan kode sembarang ditolak", async () => {
    await buatAdminPertama(data("A"));
    const { kodePemulihan } = await pasangAuthenticator("budia@contoh.id");
    majuDetik(30);
    expect((await autentikasiLogin("budia@contoh.id", SANDI, "ZZZZZ-ZZZZZ")).sukses).toBe(false);
    const pakai = await autentikasiLogin("budia@contoh.id", SANDI, kodePemulihan[0].toLowerCase().replace("-", " "));
    expect(pakai.sukses).toBe(true);
    expect(pakai.sisaKodePemulihan).toBe(7);
    expect(pakai.pesan).toMatch(/sisa 7/);
    localStorage.removeItem("geokader_current_session_v5");
    expect((await autentikasiLogin("budia@contoh.id", SANDI, kodePemulihan[0])).sukses).toBe(false); // sudah terpakai
    expect((await autentikasiLogin("budia@contoh.id", SANDI, kodePemulihan[1])).sukses).toBe(true);
  });

  it("kegagalan kode ikut dibatasi: 5 kode salah menahan percobaan, termasuk dengan kode benar", async () => {
    await buatAdminPertama(data("A"));
    const { rahasia } = await pasangAuthenticator("budia@contoh.id");
    majuDetik(30);
    for (let i = 0; i < 5; i++) await autentikasiLogin("budia@contoh.id", SANDI, "000000");
    expect(detikTertahan("budia@contoh.id")).toBe(30);
    const ditahan = await autentikasiLogin("budia@contoh.id", SANDI, hitungTotp(rahasia)!);
    expect(ditahan.sukses).toBe(false);
    expect(ditahan.pesan).toMatch(/Terlalu banyak percobaan/);
    majuDetik(31);
    expect((await autentikasiLogin("budia@contoh.id", SANDI, hitungTotp(rahasia)!)).sukses).toBe(true);
  });

  it("sandi benar tanpa kode tidak menghapus catatan kegagalan (tidak bisa dipakai mengosongkan pembatasan)", async () => {
    await buatAdminPertama(data("A"));
    await pasangAuthenticator("budia@contoh.id");
    majuDetik(30);
    for (let i = 0; i < 3; i++) await autentikasiLogin("budia@contoh.id", SANDI, "000000");
    await autentikasiLogin("budia@contoh.id", SANDI); // langkah 1 saja
    for (let i = 0; i < 2; i++) await autentikasiLogin("budia@contoh.id", SANDI, "000000");
    expect(detikTertahan("budia@contoh.id")).toBe(30); // 3 + 2 = 5 gagal tetap terhitung
  });

  it("sesi lama untuk akun tanpa Authenticator (mis. dari versi sebelumnya) dicabut", async () => {
    await buatAdminPertama(data("A"));
    const akun = muatSemuaAkun()[0];
    localStorage.setItem("geokader_current_session_v5", JSON.stringify({ idKader: akun.idKader, nama: akun.nama, email: akun.email, peran: akun.peran }));
    expect(muatSesiPengguna()).toBeNull();
    expect(localStorage.getItem("geokader_current_session_v5")).toBeNull();
  });

  it("admin mengatur ulang Authenticator kader: rahasia dan kode pemulihan lama tidak berlaku, pemasangan ulang diminta", async () => {
    const { admin, kader } = await siapkanKader();
    expect(aturUlangAuthenticatorOlehAdmin(admin.sesi, kader.email).sukses).toBe(true);
    const akun = muatSemuaAkun().find((a) => a.email === kader.email)!;
    expect(akun.totpRahasia).toBeUndefined();
    expect(akun.kodePemulihanHash).toBeUndefined();
    majuDetik(30);
    expect((await autentikasiLogin(kader.email, kader.sandiBaru, kader.kodePemulihan[0])).sukses).toBe(false);
    expect(await autentikasiLogin(kader.email, kader.sandiBaru)).toMatchObject({ sukses: false, perluDaftarTotp: true });
    const baru = await pasangAuthenticator(kader.email, kader.sandiBaru);
    expect(baru.rahasia).not.toBe(kader.rahasia);
    expect((await masukPenuh(kader.email, baru.rahasia, kader.sandiBaru)).sukses).toBe(true);
  });

  it("reset Authenticator: bukan untuk kader, bukan sesi palsu, bukan diri sendiri, dan akun harus ada", async () => {
    const { admin, kader } = await siapkanKader();
    const sesiKader = (await masukPenuh(kader.email, kader.rahasia, kader.sandiBaru)).akun!;
    expect(aturUlangAuthenticatorOlehAdmin(sesiKader, admin.email).sukses).toBe(false);
    expect(aturUlangAuthenticatorOlehAdmin({ ...sesiKader, peran: "admin" }, admin.email).sukses).toBe(false);
    expect(aturUlangAuthenticatorOlehAdmin(null, kader.email).sukses).toBe(false);
    expect(aturUlangAuthenticatorOlehAdmin(admin.sesi, admin.email).pesan).toMatch(/admin lain/);
    expect(aturUlangAuthenticatorOlehAdmin(admin.sesi, "tidakada@contoh.id").pesan).toMatch(/tidak ditemukan/);
    expect(muatSemuaAkun().find((a) => a.email === admin.email)!.totpRahasia).toBeDefined();
  });

  it("admin kedua dapat mengatur ulang Authenticator admin pertama", async () => {
    const a1 = await siapkanAdmin("A");
    const r = await buatAkunOlehAdmin(a1.sesi, { nama: "Admin Dua", email: "dua@contoh.id", desaWilayah: "-", noHp: "-", peran: "admin" });
    await ubahKataSandi("dua@contoh.id", r.sandiSementara!, "KataBaruKu-2028");
    const a2 = await pasangAuthenticator("dua@contoh.id", "KataBaruKu-2028");
    const sesiDua = (await masukPenuh("dua@contoh.id", a2.rahasia, "KataBaruKu-2028")).akun!;
    expect(aturUlangAuthenticatorOlehAdmin(sesiDua, a1.email).sukses).toBe(true);
    expect(muatSemuaAkun().find((a) => a.email === a1.email)!.totpRahasia).toBeUndefined();
  });
});

describe("peran dan sesi (K1/T5)", () => {
  it("mengubah peran di sesi menjadi admin tidak berhasil (sesi dicek ke data akun)", async () => {
    const admin = await siapkanAdmin();
    const kader = await buatKaderLengkap(admin.sesi);
    await masukPenuh(kader.email, kader.rahasia, kader.sandiBaru);
    const sesi = JSON.parse(localStorage.getItem("geokader_current_session_v5")!);
    localStorage.setItem("geokader_current_session_v5", JSON.stringify({ ...sesi, peran: "admin" }));
    expect(muatSesiPengguna()).toBeNull();
    expect(localStorage.getItem("geokader_current_session_v5")).toBeNull();
  });

  it("sesi untuk akun yang sudah tidak ada ditolak", async () => {
    await siapkanAdmin();
    localStorage.removeItem("geokader_accounts_v5");
    expect(muatSesiPengguna()).toBeNull();
  });
});

describe("masuk: pesan umum dan pembatasan sandi", () => {
  it("pesan tidak membedakan email yang ada atau tidak", async () => {
    await buatAdminPertama(data("A"));
    const salah = await autentikasiLogin("budia@contoh.id", "SalahSalah-1");
    const takAda = await autentikasiLogin("tidakada@contoh.id", "SalahSalah-1");
    expect(salah.sukses).toBe(false);
    expect(salah.pesan).toBe(takAda.pesan);
    expect(muatSesiPengguna()).toBeNull();
  });

  it("5 sandi salah berturut-turut menahan percobaan berikutnya, lalu pulih", async () => {
    await buatAdminPertama(data("A"));
    for (let i = 0; i < 5; i++) await autentikasiLogin("budia@contoh.id", "SalahSalah-1");
    expect(detikTertahan("budia@contoh.id")).toBe(30);
    expect((await autentikasiLogin("budia@contoh.id", SANDI)).pesan).toMatch(/Terlalu banyak percobaan/);
    majuDetik(31);
    expect((await autentikasiLogin("budia@contoh.id", SANDI)).perluDaftarTotp).toBe(true);
  });
});

describe("ganti dan atur ulang sandi", () => {
  it("ubahKataSandi memerlukan sandi lama dan menolak sandi baru yang lemah atau sama", async () => {
    await buatAdminPertama(data("A"));
    expect((await ubahKataSandi("budia@contoh.id", "Salah-Salah-1", "SandiBaru-2027")).pesan).toMatch(/saat ini salah/);
    expect((await ubahKataSandi("budia@contoh.id", SANDI, SANDI)).pesan).toMatch(/berbeda/);
    expect((await ubahKataSandi("budia@contoh.id", SANDI, "pendek")).sukses).toBe(false);
    expect((await ubahKataSandi("budia@contoh.id", SANDI, "SandiBaru-2027")).sukses).toBe(true);
    expect((await autentikasiLogin("budia@contoh.id", SANDI)).pesan).toMatch(/salah/);
    expect((await autentikasiLogin("budia@contoh.id", "SandiBaru-2027")).perluDaftarTotp).toBe(true);
  });

  it("tidak ada reset mandiri: hanya admin yang dapat membuat sandi sementara", async () => {
    const admin = await siapkanAdmin();
    const kader = await buatKaderLengkap(admin.sesi);
    const sesiKader = (await masukPenuh(kader.email, kader.rahasia, kader.sandiBaru)).akun!;

    expect((await aturUlangSandiOlehAdmin(sesiKader, admin.email)).sukses).toBe(false);
    expect((await aturUlangSandiOlehAdmin({ ...sesiKader, peran: "admin" }, admin.email)).sukses).toBe(false);
    expect((await aturUlangSandiOlehAdmin(null, kader.email)).sukses).toBe(false);
    expect((await aturUlangSandiOlehAdmin(admin.sesi, admin.email)).pesan).toMatch(/sendiri/);
    expect((await aturUlangSandiOlehAdmin(admin.sesi, "tidakada@contoh.id")).pesan).toMatch(/tidak ditemukan/);

    const r = await aturUlangSandiOlehAdmin(admin.sesi, kader.email);
    expect(r.sukses).toBe(true);
    expect(r.sandiSementara).toMatch(/^[A-Za-z2-9]{12}$/);

    localStorage.removeItem("geokader_current_session_v5");
    expect((await autentikasiLogin(kader.email, kader.sandiBaru)).sukses).toBe(false);
    const sementara = await autentikasiLogin(kader.email, r.sandiSementara!);
    expect(sementara).toMatchObject({ sukses: false, wajibGantiSandi: true });
    expect(muatSesiPengguna()).toBeNull();

    expect((await ubahKataSandi(kader.email, r.sandiSementara!, "KataBaruLagi-2029")).sukses).toBe(true);
    // Authenticator kader tidak ikut terhapus oleh reset sandi
    const masuk = await masukPenuh(kader.email, kader.rahasia, "KataBaruLagi-2029");
    expect(masuk.sukses).toBe(true);
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
    // sesi lama memuat sandi dan akunnya belum punya Authenticator: dicabut, bukan ditulis ulang
    expect(localStorage.getItem("geokader_current_session_v5")).toBeNull();
    const masuk = await autentikasiLogin("lain@contoh.id", "SandiLamaKu-77");
    expect(masuk).toMatchObject({ sukses: false, perluDaftarTotp: true }); // sandi lama tetap berlaku, lalu wajib pasang Authenticator
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
    await buatAdminPertama(data("1"));
    const sebelum = localStorage.getItem("geokader_accounts_v5");
    await migrasiAkunLama();
    expect(localStorage.getItem("geokader_accounts_v5")).toBe(sebelum);
  });
});

describe("akun uji (build pengembangan)", () => {
  it("dibuat berhash dengan Authenticator uji, tidak ditambahkan ulang, dan dapat dipakai masuk", async () => {
    await siapkanAkunUji();
    await siapkanAkunUji();
    const akun = muatSemuaAkun();
    expect(akun.map((a) => a.email).sort()).toEqual(["admin@geokader.id", "kader@geokader.id"]);
    expect(localStorage.getItem("geokader_accounts_v5")).not.toMatch(/kader123|admin123/);
    expect(await autentikasiLogin("kader@geokader.id", "kader123")).toMatchObject({ sukses: false, perluKodeTotp: true });
    expect((await autentikasiLogin("kader@geokader.id", "kader123", hitungTotp(RAHASIA_TOTP_UJI)!)).sukses).toBe(true);
  });
  it("tidak menimpa akun yang sudah ada", async () => {
    const h = await buatHashSandi("SandiSendiri-5");
    localStorage.setItem("geokader_accounts_v5", JSON.stringify([{ idKader: "ADM-9", nama: "Admin Asli", email: "admin@geokader.id", peran: "admin", desaWilayah: "-", noHp: "-", kelompokMasyarakat: "-", namaOrganisasi: "x", createdAt: "", ...h }]));
    await siapkanAkunUji();
    expect(muatSemuaAkun().find((a) => a.email === "admin@geokader.id")?.nama).toBe("Admin Asli");
  });
});
