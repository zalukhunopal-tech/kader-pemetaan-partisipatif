import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { JPEG, RUTE_TILE_PUBLIK, halamanBaru, masukSebagaiAdmin, posisiPeta, sampai } from "./bantu";

test("simulasi pemakaian manusia lengkap: Menu Alat peta, Geofence dinamis, Ekspor Pustaka, dan Obrolan Suara", async ({
  browser
}) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      acceptDownloads: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 2.85727, longitude: 117.377476, accuracy: 6 }
    },
    false
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));

  await masukSebagaiAdmin(p);

  await test.step("1. Peta: Pencarian koordinat, Pusatkan GPS, Menu Alat Rata-rata Plot GPS & Tandai Foto, Monitor Geofences dinamis", async () => {
    await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
    await p.waitForSelector(".map-canvas-container");

    // Buka pencarian dan lompat ke koordinat jauh
    await p.locator('button[aria-label="Cari di Peta"]').click();
    await p.locator("input.avz-cari-input").fill("2.875000, 117.395000");
    await p.locator("input.avz-cari-input").press("Enter");
    await sampai(async () => {
      const pos = await posisiPeta(p);
      return Boolean(pos && Math.abs(pos.lat - 2.875) < 0.002);
    });

    // Klik tombol Posisi saya -> harus memusatkan peta ke GPS aktif
    await p.locator("button.avz-nav-arrow-btn").click();
    await sampai(async () => {
      const pos = await posisiPeta(p);
      return Boolean(pos && Math.abs(pos.lat - 2.85727) < 0.002);
    });

    // Menu Alat -> Rata-rata Plot GPS langsung masuk ke detail form dan memicu pengukuran GPS, lalu simpan 1 titik nyata
    await p.getByRole("button", { name: "Alat peta" }).click();
    await p.locator(".avz-tool-popup-item", { hasText: "Rata-rata Plot GPS" }).click();
    await expect(p.locator(".visual-category-grid")).toHaveCount(0);
    await expect(p.locator("button", { hasText: /Mengukur|Ulangi rata-rata GPS/ })).toBeVisible();
    await p.locator('input[placeholder="Masukkan nama objek"]').fill("Pohon Meranti Simulasi");
    const btnBatalGps = p.locator("button", { hasText: /Mengukur ·/ });
    if ((await btnBatalGps.count()) > 0) {
      await btnBatalGps.click();
    }
    await p.locator('#form-survei-lapangan button[type="submit"]').click();
    await expect(p.locator("form.field-survey-form")).toHaveCount(0);

    // Menu Alat -> Tandai Foto langsung membuka detail form dengan sorotan unggah foto
    await p.getByRole("button", { name: "Alat peta" }).click();
    await p.locator(".avz-tool-popup-item", { hasText: "Tandai Foto" }).click();
    await expect(p.locator(".visual-category-grid")).toHaveCount(0);
    await expect(p.locator(".form-photo-box.sorot-aksi-foto")).toBeVisible();
    await p.locator("form.field-survey-form button", { hasText: "Tutup, simpan draf" }).click();

    // Menu Alat -> Monitor Geofences: aktif -> keluar batas -> masuk kembali -> matikan
    await p.getByRole("button", { name: "Alat peta" }).click();
    await p.locator(".avz-tool-popup-item", { hasText: "Monitor Geofences" }).click();
    await expect(p.locator(".avz-geofence-pill")).toContainText(/Di dalam/i);

    // Simulasikan pengguna berjalan 1.8 km keluar radius
    await p.context().setGeolocation({ latitude: 2.872, longitude: 117.392, accuracy: 8 });
    await expect(p.locator(".avz-geofence-pill")).toContainText(/Di luar/i, { timeout: 8000 });

    // Simulasikan pengguna kembali masuk ke dalam radius
    await p.context().setGeolocation({ latitude: 2.8573, longitude: 117.3775, accuracy: 6 });
    await expect(p.locator(".avz-geofence-pill")).toContainText(/Di dalam/i, { timeout: 8000 });

    // Matikan geofence
    await p.getByRole("button", { name: "Alat peta" }).click();
    await p.locator(".avz-tool-popup-item", { hasText: "Matikan Monitor Geofences" }).click();
    await expect(p.locator(".avz-geofence-pill")).toHaveCount(0);

    // Keluar dari peta layar penuh agar navigasi bawah tampil di mobile
    await p.locator('button[aria-label="Kembali"]').first().click();
  });

  await test.step("2. Pustaka: Buat lapisan, pilih item, dan Pengaturan Ekspor mengunduh GeoJSON nyata", async () => {
    await p.locator(".avenza-nav-item", { hasText: "Mode User" }).click();
    await p.locator(".avenza-nav-item", { hasText: "Pustaka" }).click();
    await p.locator('[role="tab"]', { hasText: "Lapisan" }).click();

    await p.locator("button.avenza-fab-orange").click();
    await p.locator('input[placeholder="Masukkan nama lapisan"]').fill("Lapisan Survei Simulasi");
    await p.locator("button", { hasText: /^Buat Lapisan$/ }).click();
    await expect(p.locator(".avenza-pustaka-container")).toContainText("Lapisan Survei Simulasi");

    // Buka menu atas -> Pilih -> centang item pertama -> Pengaturan Ekspor
    await p.locator('button.avenza-toolbar-toggle-btn[title="Buka Toolbar"]').click();
    await p.locator(".avenza-overflow-item", { hasText: "Pilih" }).click();
    await expect(p.locator(".avenza-selection-banner")).toBeVisible();
    await p.locator('input[type="checkbox"]').first().check();
    await p.locator(".avenza-selection-banner button", { hasText: "Pengaturan Ekspor" }).click();

    await expect(p.locator(".avenza-subpage-header")).toContainText("Ekspor");
    await p.locator("select").first().selectOption("Lapisan dan peta");
    await p.locator(".avenza-export-item", { hasText: "Format (Ketuk untuk ganti:" }).click();
    await expect(p.locator(".avenza-export-item", { hasText: ".geojson" })).toBeVisible();

    // Toggle switch Foto ditautkan
    const switchFoto = p.getByRole("switch", { name: /Foto ditautkan/ });
    await expect(switchFoto).toHaveAttribute("aria-checked", "true");
    await switchFoto.click();
    await expect(switchFoto).toHaveAttribute("aria-checked", "false");

    const tungguUnduh = p.waitForEvent("download");
    await p.locator('button[title="Ekspor sekarang"]').click();
    const unduhan = await tungguUnduh;
    expect(unduhan.suggestedFilename()).toMatch(/\.geojson$/);

    const pathFile = await unduhan.path();
    expect(pathFile).toBeTruthy();
    const isiGeoJson = JSON.parse(readFileSync(pathFile!, "utf8")) as {
      type: string;
      features: Array<{ properties?: Record<string, unknown> }>;
    };
    expect(isiGeoJson.type).toBe("FeatureCollection");
    expect(isiGeoJson.features.some((f) => f.properties?.judul === "Pohon Meranti Simulasi" || f.properties?.label === "Pohon Meranti Simulasi")).toBe(true);
    await expect(p.locator('.avenza-export-sub[role="status"]')).toContainText("Berhasil mengekspor");

    await p.locator(".avenza-back-btn").click();
  });

  await test.step("3. Komunikasi: Rekam Pesan Suara, Putar Audio, Kirim Pin GPS, dan Buka di Peta", async () => {
    await p.locator(".avenza-nav-item", { hasText: "Diskusi" }).click();

    // Klik tombol Mic (sebelumnya mati saat input kosong) -> muncul bar perekaman suara
    await p.locator('button[aria-label="Rekam Pesan Suara"]').click();
    await expect(p.locator('[role="region"][aria-label="Rekaman Pesan Suara"]')).toBeVisible();
    await p.waitForTimeout(1100);
    await p.locator('button[aria-label="Kirim Pesan Suara"]').click();

    // Putar memo suara lalu jeda
    const btnPutar = p.locator('button[aria-label="Putar Pesan Suara"]').last();
    await expect(btnPutar).toBeVisible();
    await btnPutar.click();
    await expect(p.locator('button[aria-label="Jeda Pesan Suara"]')).toBeVisible();
    await p.locator('button[aria-label="Jeda Pesan Suara"]').click();

    // Bagikan pin koordinat lalu buka langsung di peta
    await p.locator('button[title="Lampirkan Lokasi GPS / Suara"]').click();
    await p.locator("button", { hasText: "Kirim Pin Lokasi" }).click();
    await p.locator("input.form-input").nth(0).fill("Patok Simulasi Lapangan");
    await p.locator("button", { hasText: "Kirim ke Obrolan" }).click();

    const btnBukaPeta = p.locator("button", { hasText: "Buka di Peta" }).last();
    await expect(btnBukaPeta).toBeVisible();
    await btnBukaPeta.click();
    await expect(p.locator(".map-canvas-container")).toBeVisible();
  });

  expect(galat).toEqual([]);
  await tutup();
});
