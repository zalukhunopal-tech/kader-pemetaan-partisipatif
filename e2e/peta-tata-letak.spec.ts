import { expect, test } from "@playwright/test";
import { JPEG, RUTE_TILE_PUBLIK, kontrolBertumpuk, masukAkunSemai } from "./bantu";

/**
 * Penjaga aturan UI (CLAUDE.md, "Aturan UI"): kontrol di atas peta tidak boleh bertumpuk, di HP, HP pendek,
 * dan PC, saat diam maupun saat merekam jalur tanpa GPS (panel rekam paling tinggi karena ada peringatan GPS).
 */
const KONTROL = [
  ".avz-quick-basemap-btn",
  ".avz-nav-arrow-btn",
  ".avz-kompas",
  ".field-map-message",
  ".recording-active-bar",
  ".avenza-scale-bar-wrap",
  "#atribusi-peta",
  ".avz-fab-pin",
  ".avz-pegangan",
  ".avz-pill-btn",
  ".avz-pill-koordinat",
  ".avenza-toast"
];

const UKURAN = [
  { nama: "HP", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { nama: "HP pendek", viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true },
  { nama: "PC", viewport: { width: 1280, height: 800 } },
  { nama: "PC pendek", viewport: { width: 1366, height: 640 } }
];

for (const u of UKURAN) {
  test(`kontrol peta tidak bertumpuk: ${u.nama}`, async ({ browser }) => {
    const { nama, ...opsi } = u;
    void nama;
    const { p, galat, tutup } = await masukAkunSemai(browser, opsi); // tanpa izin lokasi: GPS belum aktif
    await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));
    await p.locator(".avenza-nav-item", { hasText: "Temukan" }).first().click();
    await p.waitForTimeout(1200);
    expect(await kontrolBertumpuk(p, KONTROL), "diam").toEqual([]);

    // Jatuhkan pin lalu simpan: toast "disimpan" tidak boleh menutupi bilah bawah
    await p.locator(".avz-fab-pin").click();
    await p.getByRole("button", { name: /^Biodiversitas/ }).click();
    await p.getByPlaceholder("Masukkan nama objek").fill("Pohon uji tata letak");
    await p.locator(".modal-form button[type=submit]").click();
    await p.waitForTimeout(500);
    expect(await p.locator(".avenza-toast").count()).toBe(1);
    expect(await kontrolBertumpuk(p, KONTROL), "toast setelah simpan").toEqual([]);

    await p.getByRole("button", { name: "Alat peta" }).click();
    await p.getByRole("menuitem", { name: "Rekam Jalur GPS" }).click();
    await p.waitForTimeout(2500);
    expect(await kontrolBertumpuk(p, KONTROL), "rekam jalur tanpa GPS").toEqual([]);

    // Bilah bawah selalu utuh di dalam peta
    const alat = await p.locator(".avz-bottom-pill-bar").boundingBox();
    const peta = await p.locator(".map-canvas-container").boundingBox();
    expect(alat!.y + alat!.height).toBeLessThanOrEqual(peta!.y + peta!.height + 0.5);
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await p.locator(".rec-cancel-btn").click();
    expect(galat).toEqual([]);
    await tutup();
  });
}
