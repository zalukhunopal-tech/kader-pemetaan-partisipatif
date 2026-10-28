import { expect, test } from "@playwright/test";
import { PIN, SANDI, buatPin, halamanBaru, kodeBerikutnya, majukanJam, masuk, pilihMenu, sampai, siapkanAdmin, terkunci } from "./bantu";

/** Pemeriksaan kunci aplikasi seperti yang dilakukan App tiap 15 detik dan saat aplikasi tampil lagi */
const periksaKunci = (p: import("@playwright/test").Page) => p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

test("Authenticator 8 jam, PIN, gerbang admin, dan keluar", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(browser, { hasTouch: true, isMobile: true });
  const rahasia = await siapkanAdmin(p);

  await test.step("masuk pertama: wajib membuat PIN, isi aplikasi di belakangnya tidak bisa disentuh", async () => {
    expect(await sampai(async () => (await p.locator("#form-siapkan-pin").count()) === 1)).toBe(true);
    expect(await p.evaluate(() => (document.querySelector(".bungkus-terkunci") as HTMLElement).inert)).toBe(true);
    await p.locator("#pin-baru").fill("123456");
    await p.locator("#pin-ulang").fill("123456");
    await p.locator("#form-siapkan-pin button[type=submit]").click();
    expect(await sampai(async () => /berurutan/.test(await p.locator("#form-siapkan-pin").innerText()))).toBe(true);
    await buatPin(p);
    expect(await p.locator(".admin-subnav").count()).toBe(1);
    const simpanan = await p.evaluate(() => JSON.stringify(localStorage));
    expect(simpanan).not.toContain(PIN);
    expect(simpanan).toMatch(/pinHash/);
  });

  await test.step("dalam 8 jam: dibuka ulang cukup dengan PIN, sekaligus membuka mode admin", async () => {
    await majukanJam(p, 2 * 3600);
    await p.reload();
    expect(await sampai(async () => (await p.locator("#pin-buka").count()) === 1)).toBe(true);
    expect(await p.locator("#kode-verifikasi").count()).toBe(0);
    await p.locator("#pin-buka").fill("111111");
    expect(await sampai(async () => /PIN salah\. Sisa 4/.test(await p.locator(".layar-kunci").innerText()))).toBe(true);
    await p.locator("#pin-buka").fill(PIN);
    expect(await sampai(async () => !(await terkunci(p)))).toBe(true);
    expect(await p.locator(".admin-subnav").count()).toBe(1);
    expect(await p.locator("#gerbang-admin").count()).toBe(0);
  });

  await test.step("diam lebih dari 15 menit: terkunci, dibuka lagi dengan PIN", async () => {
    await majukanJam(p, 16 * 60);
    await periksaKunci(p);
    expect(await sampai(() => terkunci(p), 5000)).toBe(true);
    await p.locator("#pin-buka").fill(PIN);
    expect(await sampai(async () => !(await terkunci(p)))).toBe(true);
  });

  await test.step("lewat 8 jam: PIN tidak cukup, kode Authenticator wajib", async () => {
    await majukanJam(p, 8 * 3600);
    await periksaKunci(p);
    expect(await sampai(async () => (await p.locator("#kode-verifikasi").count()) === 1, 5000)).toBe(true);
    expect(await p.locator(".layar-kunci").innerText()).toMatch(/8 jam/);
    await p.locator("#kode-verifikasi").fill("000000");
    await p.locator("#verifikasi-kode button[type=submit]").click();
    expect(await sampai(async () => /Kode salah/.test(await p.locator(".layar-kunci").innerText()))).toBe(true);
    await p.locator("#kode-verifikasi").fill(await kodeBerikutnya(p, rahasia));
    await p.locator("#verifikasi-kode button[type=submit]").click();
    expect(await sampai(async () => !(await terkunci(p)))).toBe(true);
    expect(await p.locator(".admin-subnav").count()).toBe(1);
    await p.reload();
    expect(await sampai(async () => (await p.locator("#pin-buka").count()) === 1)).toBe(true);
    await p.locator("#pin-buka").fill(PIN);
    expect(await sampai(async () => !(await terkunci(p)))).toBe(true);
  });

  await test.step("Mode User lalu kembali ke admin: gerbang admin meminta PIN", async () => {
    await p.locator(".avenza-nav-item", { hasText: "Mode User" }).click();
    await pilihMenu(p, "Mode Admin");
    expect(await sampai(async () => (await p.locator("#gerbang-admin #pin-buka").count()) === 1)).toBe(true);
    await p.locator("#gerbang-admin #pin-buka").fill(PIN);
    expect(await sampai(async () => (await p.locator(".admin-subnav").count()) === 1)).toBe(true);
  });

  await test.step("menu Keamanan, kunci sekarang, dan 5 PIN salah menonaktifkan PIN", async () => {
    await pilihMenu(p, "PIN & sidik jari");
    expect(await sampai(async () => /berlaku sampai pukul/.test(await p.locator("#pengaturan-kunci").innerText()))).toBe(true);
    await p.locator("#pengaturan-kunci").getByRole("button", { name: "Kunci aplikasi sekarang" }).click();
    expect(await sampai(() => terkunci(p))).toBe(true);
    for (let i = 0; i < 5; i++) {
      await p.locator("#pin-buka").fill("111111");
      await p.waitForTimeout(250);
      if ((await p.locator("#pin-buka").count()) === 0) break;
    }
    expect(await sampai(async () => (await p.locator("#kode-verifikasi").count()) === 1)).toBe(true);
    expect(await p.locator(".layar-kunci").innerText()).toMatch(/dinonaktifkan/);
    await p.locator("#kode-verifikasi").fill(await kodeBerikutnya(p, rahasia));
    await p.locator("#verifikasi-kode button[type=submit]").click();
    await buatPin(p, "730518");
  });

  await test.step("keluar dari layar kunci; masuk lagi tetap meminta kode Authenticator", async () => {
    await pilihMenu(p, "PIN & sidik jari");
    await p.locator("#pengaturan-kunci").getByRole("button", { name: "Kunci aplikasi sekarang" }).click();
    expect(await sampai(() => terkunci(p))).toBe(true);
    await p.locator(".layar-kunci-keluar").click();
    expect(await sampai(async () => (await p.getByPlaceholder("Masukkan alamat email").count()) === 1)).toBe(true);
    await masuk(p, "siti.admin@contoh.id", SANDI, rahasia);
    expect(await sampai(async () => (await p.locator(".admin-subnav").count()) === 1)).toBe(true);
    expect(await terkunci(p)).toBe(false); // PIN sudah ada, tidak diminta lagi
  });

  expect(galat).toEqual([]);
  await tutup();
});

test("sidik jari / pengenalan wajah (autentikator virtual Chrome)", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(browser);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  });
  await siapkanAdmin(p);

  await test.step("daftar PIN + sidik jari; aplikasi hanya menyimpan kunci publik", async () => {
    expect(await sampai(async () => (await p.locator(".verifikasi-centang").count()) === 1, 4000)).toBe(true);
    await p.locator("#pin-baru").fill(PIN);
    await p.locator("#pin-ulang").fill(PIN);
    await p.locator("#form-siapkan-pin button[type=submit]").click();
    expect(await sampai(async () => !(await terkunci(p)))).toBe(true);
    const kred = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
    expect(kred.credentials).toHaveLength(1);
    const bio = await p.evaluate(() => JSON.parse(localStorage.getItem("geokader_accounts_v5")!)[0].biometrik);
    expect(bio.kunciPublik).toBeTruthy();
    expect(bio.alg).toBe(-7);
  });

  await test.step("dibuka ulang: sidik jari ditawarkan otomatis dan membuka aplikasi + mode admin", async () => {
    await p.reload();
    expect(await sampai(async () => !(await terkunci(p)) && (await p.locator(".admin-subnav").count()) === 1, 8000)).toBe(true);
  });

  await test.step("verifikasi pengguna gagal: tetap terkunci; berhasil: terbuka", async () => {
    await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: false });
    await p.reload();
    await p.waitForTimeout(1500);
    expect(await terkunci(p)).toBe(true);
    await p.locator(".btn-biometrik").click();
    await p.waitForTimeout(1500);
    expect(await terkunci(p)).toBe(true);
    expect(await p.locator(".verifikasi-galat").count()).toBe(1);
    await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: true });
    await p.locator(".btn-biometrik").click();
    expect(await sampai(async () => !(await terkunci(p)))).toBe(true);
  });

  await test.step("menu Keamanan: sidik jari bisa dimatikan, PIN tetap ada", async () => {
    await pilihMenu(p, "PIN & sidik jari");
    await p
      .locator("#pengaturan-kunci")
      .getByRole("button", { name: /Matikan sidik jari/ })
      .click();
    expect(await sampai(async () => /Sidik jari \/ wajah: belum aktif/.test(await p.locator("#pengaturan-kunci").innerText()))).toBe(true);
  });

  expect(galat).toEqual([]);
  await tutup();
});
