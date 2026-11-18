import { BrowserContext, expect, test } from "@playwright/test";
import { SANDI, URL_APP_KUNCI, halamanBaru, lewatiSplash, masukSebagaiAdmin, offsetJam, sampai, totp } from "./bantu";

/**
 * Menguji alur lengkap di browser sungguhan (2 konteks perangkat berbeda):
 * 1. Pendaftaran mandiri langsung dari halaman pertama + OTP email (tanpa server Node, langsung ke Apps Script).
 * 2. Satu email hanya bisa membuat satu akun.
 * 3. Fitur buat akun oleh admin sudah dihapus; Admin menyetujui pendaftaran baru di panel Akun.
 * 4. Satu akun hanya bisa diakses oleh 1 orang/perangkat (orang kedua ditolak saat sesi pertama masih aktif).
 */
test("pendaftaran OTP email di halaman awal, persetujuan admin, 1 email 1 akun, dan tolak akses ganda", async ({ browser }) => {
  // Server Apps Script tiruan bersama di memori untuk menyimulasikan Google Sheets/Drive & MailApp lintas perangkat
  const cloudAkun = new Map<string, Record<string, unknown>>();
  const cloudOtp = new Map<string, string>();
  const emailTerkirim: { email: string; kodeOtp: string }[] = [];

  const pasangRouteAppsScript = async (ctx: BrowserContext) => {
    await ctx.route(/script\.google\.com/, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      const action = String(body.action || "");
      const email = String(body.email || (body.akun as Record<string, unknown> | undefined)?.email || "")
        .trim()
        .toLowerCase();

      if (action === "kirim_otp_email") {
        if (cloudAkun.has(email)) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              sukses: false,
              protokolAkun: 1,
              duplikat: true,
              pesan: "Email ini sudah terdaftar. Satu email hanya dapat digunakan untuk satu akun."
            })
          });
        }
        const kode = String(body.kodeOtp || "123456");
        cloudOtp.set(email, kode);
        emailTerkirim.push({ email, kodeOtp: kode });
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sukses: true, protokolAkun: 1, terkirimEmail: true, email })
        });
      }

      if (action === "verifikasi_otp_dan_daftar_akun") {
        if (cloudAkun.has(email)) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ sukses: false, protokolAkun: 1, duplikat: true, pesan: "Email sudah terdaftar." })
          });
        }
        if (cloudOtp.get(email) !== String(body.kodeOtp || "")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ sukses: false, protokolAkun: 1, pesan: "Kode OTP email tidak cocok." })
          });
        }
        cloudOtp.delete(email);
        const akun = { ...(body.akun as Record<string, unknown>), email, statusPersetujuan: "menunggu", emailTerverifikasi: true };
        cloudAkun.set(email, akun);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sukses: true, protokolAkun: 1, menungguPersetujuan: true, akun })
        });
      }

      if (action === "ambil_daftar_akun") {
        if (email) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ sukses: true, protokolAkun: 1, akun: cloudAkun.get(email) ?? null })
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sukses: true, protokolAkun: 1, akunList: [...cloudAkun.values()] })
        });
      }

      if (action === "setujui_akun") {
        const ada = cloudAkun.get(email);
        if (ada) ada.statusPersetujuan = "disetujui";
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sukses: Boolean(ada), protokolAkun: 1, akun: ada ?? null })
        });
      }

      if (action === "simpan_kredensial_akun") {
        const ada = cloudAkun.get(email) ?? (body.akun as Record<string, unknown> | undefined);
        if (ada) {
          cloudAkun.set(email, { ...ada, ...((body.perubahan as Record<string, unknown>) || {}) });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sukses: true, protokolAkun: 1 }) });
      }

      if (action === "klaim_sesi_akun") {
        const idPerangkat = String(body.idPerangkat || "");
        const ada = cloudAkun.get(email) ?? (body.akunFallback as Record<string, unknown> | undefined);
        if (ada?.idSesiAktif && ada.idSesiAktif !== idPerangkat) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              sukses: false,
              protokolAkun: 1,
              ditolakSesiGanda: true,
              pesan: "Akses ditolak: akun ini sedang aktif digunakan oleh perangkat lain. Satu akun hanya dapat diakses oleh 1 orang."
            })
          });
        }
        if (ada) {
          ada.idSesiAktif = idPerangkat;
          cloudAkun.set(email, ada);
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sukses: true, protokolAkun: 1 }) });
      }

      if (action === "lepas_sesi_akun") {
        const ada = cloudAkun.get(email);
        if (ada) ada.idSesiAktif = "";
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sukses: true, protokolAkun: 1 }) });
      }

      if (action === "cek_sesi_akun") {
        const idPerangkat = String(body.idPerangkat || "");
        const ada = cloudAkun.get(email);
        const statusOk = !ada?.statusPersetujuan || ada.statusPersetujuan === "disetujui";
        const sah = !ada || (statusOk && (!ada.idSesiAktif || ada.idSesiAktif === idPerangkat));
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sukses: true, protokolAkun: 1, sah }) });
      }

      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sukses: true }) });
    });
  };

  // --- 1. PENDAFTAR DI HP-1 MENDAFTAR LANGSUNG DARI HALAMAN PERTAMA ---
  const hp1 = await halamanBaru(browser, { viewport: { width: 410, height: 860 } });
  await pasangRouteAppsScript(hp1.p.context());
  await hp1.p.goto(URL_APP_KUNCI);
  await hp1.p.waitForTimeout(1200);
  await lewatiSplash(hp1.p);

  await hp1.p.locator("#tombol-menu-daftar").click();
  await hp1.p.locator("#daftar-nama").fill("Budi Lapangan");
  await hp1.p.locator("#daftar-email").fill("budi.lapangan@gmail.com");
  await hp1.p.locator("#daftar-hp").fill("081234567890");
  await hp1.p.locator("#daftar-kelompok").fill("KTH Rimba Lestari");
  await hp1.p.locator("#daftar-sandi").fill(SANDI);
  await hp1.p.locator("#daftar-sandi-ulang").fill(SANDI);
  await hp1.p.locator("#form-daftar-akun button[type=submit]").click();

  expect(await sampai(async () => (await hp1.p.locator("#form-verifikasi-email").count()) === 1)).toBe(true);
  expect(emailTerkirim).toHaveLength(1);
  // Pastikan OTP tidak dibocorkan di UI saat email server terkirim
  await expect(hp1.p.locator("#nilai-kode-otp-email")).toHaveCount(0);

  await hp1.p.locator("#input-otp-email").fill(emailTerkirim[0].kodeOtp);
  await hp1.p.locator("#form-verifikasi-email button[type=submit]").click();
  expect(await sampai(async () => (await hp1.p.locator(".auth-body").innerText()).includes("menunggu persetujuan"))).toBe(true);

  // Sebelum disetujui admin -> login ditolak
  await hp1.p.getByPlaceholder("Masukkan alamat email").fill("budi.lapangan@gmail.com");
  await hp1.p.getByPlaceholder("Masukkan kata sandi").fill(SANDI);
  await hp1.p.getByRole("button", { name: "Lanjut ke Titik Tapak" }).click();
  expect(await sampai(async () => /menunggu persetujuan/i.test(await hp1.p.getByRole("alert").innerText()))).toBe(true);

  // --- 2. ADMIN MEMBUKA PANEL AKUN -> FORM BUAT AKUN SUDAH DIHAPUS & MENYETUJUI BUDI ---
  const adminPage = await halamanBaru(browser, { viewport: { width: 1280, height: 800 } });
  await pasangRouteAppsScript(adminPage.p.context());
  await masukSebagaiAdmin(adminPage.p, URL_APP_KUNCI);
  // Keluar dari peta default bila perlu dan masuk tab Admin > Akun
  const kembaliAdmin = adminPage.p.locator(".avz-titlebar").getByRole("button", { name: "Kembali" });
  if (await kembaliAdmin.isVisible().catch(() => false)) await kembaliAdmin.click();
  await adminPage.p.locator(".avenza-nav-item", { hasText: /Kendali|Admin/ }).first().click();
  await adminPage.p.locator(".admin-subnav-btn", { hasText: "Akun" }).click();

  await expect(adminPage.p.locator("#form-buat-akun")).toHaveCount(0);
  await adminPage.p.getByRole("button", { name: /Segarkan/ }).click();
  expect(await sampai(async () => (await adminPage.p.locator("#panel-persetujuan-akun").innerText()).includes("Budi Lapangan"))).toBe(true);
  await adminPage.p
    .locator("#panel-persetujuan-akun")
    .getByRole("button", { name: "Setujui" })
    .first()
    .click();
  expect(await sampai(async () => /telah disetujui/i.test(await adminPage.p.locator("#panel-persetujuan-akun").innerText()))).toBe(true);

  // --- 3. BUDI DI HP-1 MASUK, PASANG AUTHENTICATOR, & MENGUNCI SESI ---
  await hp1.p.getByPlaceholder("Masukkan alamat email").fill("budi.lapangan@gmail.com");
  await hp1.p.getByPlaceholder("Masukkan kata sandi").fill(SANDI);
  await hp1.p.getByRole("button", { name: "Lanjut ke Titik Tapak" }).click();
  expect(await sampai(async () => (await hp1.p.locator("#kunci-totp").count()) === 1)).toBe(true);
  const rahasiaBudi = (await hp1.p.locator("#kunci-totp").innerText()).replace(/\s+/g, "");
  await hp1.p.locator("#kode-konfirmasi-totp").fill(totp(rahasiaBudi, Date.now() + (await offsetJam(hp1.p))));
  await hp1.p.locator("#form-daftar-totp button[type=submit]").click();
  expect(await sampai(async () => (await hp1.p.locator("#panel-kode-pemulihan").count()) === 1)).toBe(true);
  await hp1.p.locator("#kode-sudah-disimpan").check();
  await hp1.p.locator("#lanjut-setelah-pemulihan").click();
  expect(await sampai(async () => (await hp1.p.locator("#form-siapkan-pin").count()) === 1)).toBe(true);

  // --- 4. ORANG KEDUA DI HP-2 MENCOBA AKSES AKUN BUDI -> DITOLAK ---
  const hp2 = await halamanBaru(browser, { viewport: { width: 410, height: 860 } });
  await pasangRouteAppsScript(hp2.p.context());
  await hp2.p.goto(URL_APP_KUNCI);
  await hp2.p.waitForTimeout(1200);
  await lewatiSplash(hp2.p);

  // Sekaligus uji: mendaftar lagi dengan email Budi ditolak (1 email = 1 akun)
  await hp2.p.locator("#tombol-menu-daftar").click();
  await hp2.p.locator("#daftar-nama").fill("Pendaftar Kedua");
  await hp2.p.locator("#daftar-email").fill("budi.lapangan@gmail.com");
  await hp2.p.locator("#daftar-sandi").fill(SANDI);
  await hp2.p.locator("#daftar-sandi-ulang").fill(SANDI);
  await hp2.p.locator("#form-daftar-akun button[type=submit]").click();
  expect(await sampai(async () => /sudah terdaftar/i.test(await hp2.p.getByRole("alert").innerText()))).toBe(true);

  // Mencoba login ke akun Budi dari HP-2 -> ditolak karena Budi masih aktif di HP-1
  await hp2.p.getByRole("button", { name: /Sudah punya akun/ }).click();
  await hp2.p.getByPlaceholder("Masukkan alamat email").fill("budi.lapangan@gmail.com");
  await hp2.p.getByPlaceholder("Masukkan kata sandi").fill(SANDI);
  await hp2.p.getByRole("button", { name: "Lanjut ke Titik Tapak" }).click();
  expect(await sampai(async () => (await hp2.p.locator("#form-kode-totp").count()) === 1)).toBe(true);
  // Tunggu langkah TOTP baru atau pakai langkah berikutnya
  await hp2.p.evaluate(() => sessionStorage.setItem("__off", String(Number(sessionStorage.getItem("__off") || 0) + 35_000)));
  await hp2.p.locator("#kode-totp").fill(totp(rahasiaBudi, Date.now() + (await offsetJam(hp2.p))));
  await hp2.p.locator("#form-kode-totp button[type=submit]").click();
  expect(await sampai(async () => /1 orang|perangkat lain/i.test(await hp2.p.getByRole("alert").innerText()))).toBe(true);

  expect(hp1.galat).toEqual([]);
  expect(adminPage.galat).toEqual([]);
  expect(hp2.galat).toEqual([]);
  await hp1.tutup();
  await adminPage.tutup();
  await hp2.tutup();
});
