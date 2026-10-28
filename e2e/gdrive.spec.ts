import { expect, test } from "@playwright/test";
import { JPEG, RUTE_TILE_PUBLIK, URL_APP, URL_APP_KUNCI, halamanBaru, masukSebagaiAdmin, sampai, teksToast } from "./bantu";

/** Web App Apps Script tiruan; dist-e2e dibangun dengan VITE_GDRIVE_URL dan VITE_GDRIVE_TOKEN dari .env.e2e */
const RUTE_GDRIVE = /script\.google\.com\/macros\/s\/uji-geokader\/exec/;
const WILAYAH = { provinsi: "Jambi", kabupaten: "Kabupaten Merangin", kecamatan: "Bangko", desa: "Rantau Panjang" };

interface Kiriman {
  token: string;
  records: { id: string; judul: string; wilayah: typeof WILAYAH; namaBerkas: string }[];
  geojsonBundle: string;
}

test("Google Drive: admin mengisi wilayah akun, data baru terunggah otomatis ke folder wilayah dengan nama akun_data_bulan_tahun", async ({
  browser
}) => {
  const { p, galat, tutup } = await halamanBaru(browser, {
    geolocation: { latitude: -2.08, longitude: 102.27, accuracy: 6 },
    permissions: ["geolocation"]
  });
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));
  const kiriman: Kiriman[] = [];
  await p.context().route(RUTE_GDRIVE, async (r) => {
    const body = JSON.parse(r.request().postData() ?? "{}") as Kiriman;
    kiriman.push(body);
    const id = body.records.map((x) => x.id);
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sukses: true, diterima: id, gagal: [], jumlah: id.length })
    });
  });

  await masukSebagaiAdmin(p, URL_APP_KUNCI);
  await p.locator(".admin-subnav-btn", { hasText: "Akun" }).click();

  // Akun kader baru wajib diberi wilayah: provinsi dari daftar 38 provinsi, sisanya diketik
  await expect(p.locator("#akun-provinsi option")).toHaveCount(39);
  await expect(p.locator("#akun-kabupaten")).toHaveAttribute("required", "");

  // Akun admin pertama belum punya wilayah lengkap: lengkapi lewat Detail > Ubah
  const panel = p.locator("#panel-akun-admin");
  await panel.getByRole("button", { name: "Detail" }).first().click();
  await expect(panel).toContainText("(belum lengkap)");
  await panel.getByRole("button", { name: "Ubah", exact: true }).click();
  await p.locator("#ubah-wilayah-provinsi").selectOption(WILAYAH.provinsi);
  await p.locator("#ubah-wilayah-kabupaten").fill(WILAYAH.kabupaten);
  await p.locator("#ubah-wilayah-kecamatan").fill(WILAYAH.kecamatan);
  await expect(p.locator("#simpan-wilayah")).toBeDisabled(); // desa belum diisi
  await p.locator("#ubah-wilayah-desa").fill(WILAYAH.desa);
  await p.locator("#simpan-wilayah").click();
  await expect(panel).toContainText("Jambi › Kabupaten Merangin › Bangko › Rantau Panjang");

  // Rekam titik di Mode User
  await p.locator(".avenza-nav-item", { hasText: "Mode User" }).click();
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.locator(".map-fab-record-trigger").click();
  await p.locator(".compact-rec-pill", { hasText: "Titik" }).click();
  await p.getByPlaceholder("Masukkan nama objek").fill("Sebaran Anggrek");
  await p.locator(".modal-form button[type=submit]").click();
  expect(await sampai(async () => /Sebaran Anggrek/.test(await teksToast(p)))).toBe(true);

  // Terunggah otomatis tanpa pengaturan apa pun, membawa token build, wilayah akun, dan nama berkas
  expect(await sampai(() => kiriman.length > 0, 15_000)).toBe(true);
  const [k] = kiriman;
  expect(k.token).toBe("token-uji-gdrive");
  expect(k.records).toHaveLength(1);
  expect(k.records[0].wilayah).toEqual(WILAYAH);
  expect(k.records[0].namaBerkas).toMatch(
    /^siti_rahmawati_sebaran_anggrek_(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)_\d{4}$/
  );
  expect(JSON.parse(k.geojsonBundle).features[0].properties).toMatchObject({ provinsi: "Jambi", kelurahanDesa: "Rantau Panjang" });

  // Halaman GDrive: tanpa Konfigurasi, menampilkan folder dan berkas tujuan, status tersinkron
  await p.locator(".avenza-nav-item", { hasText: "GDrive" }).click();
  await expect(p.getByText("Konfigurasi", { exact: false })).toHaveCount(0);
  await expect(p.getByPlaceholder("https://script.google.com/macros/s/.../exec")).toHaveCount(0);
  await expect(p.locator("#gdrive-belum-aktif")).toHaveCount(0);
  await expect(p.locator(".tujuan-drive").first()).toContainText(
    `Jambi › Kabupaten Merangin › Bangko › Rantau Panjang / ${k.records[0].namaBerkas}`
  );
  await expect(p.locator(".data-table .badge-sync").first()).toContainText("TERSINKRON");
  expect(galat).toEqual([]);
  await tutup();
});

test("build tanpa Google Drive: unggahan dinyatakan belum aktif, tanpa isian pengaturan, tanpa kiriman", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(browser);
  let terkirim = 0;
  await p.context().route(/script\.google\.com/, (r) => {
    terkirim++;
    return r.abort();
  });
  await masukSebagaiAdmin(p, URL_APP);
  await p.locator(".avenza-nav-item", { hasText: "GDrive" }).click();
  await expect(p.locator("#gdrive-belum-aktif")).toBeVisible();
  await expect(p.getByText("Konfigurasi", { exact: false })).toHaveCount(0);
  await expect(p.locator("input[type=password]")).toHaveCount(0);
  expect(terkirim).toBe(0);
  expect(galat).toEqual([]);
  await tutup();
});
