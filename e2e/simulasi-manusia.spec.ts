import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { JPEG, RUTE_TILE_PUBLIK, halamanBaru, kodeBerikutnya, majukanJam, masukSebagaiAdmin, posisiPeta, sampai, terkunci } from "./bantu";

test("simulasi pemakaian manusia advanced: drawer pelacakan bersih dan berwarna, basemap memanjang, menu alat, ekspor GeoJSON KML SHP biner, dan obrolan suara", async ({
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

  const rahasia = await masukSebagaiAdmin(p);

  await test.step("1. Peta: posisi tab Lokasi/Pelacakan/Navigasi rapat atas, pewarnaan Pelacakan tanpa tombol ekstra, & basemap memanjang penuh", async () => {
    await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
    await p.waitForSelector(".map-canvas-container");

    // Buka drawer Lokasi · Pelacakan · Navigasi
    await p.locator('button[aria-label="Buka panel lokasi, pelacakan, dan navigasi"]').click();
    const drawer = p.locator(".avz-gps-drawer");
    await expect(drawer).toBeVisible();
    await p.waitForTimeout(260);

    // Verifikasi posisi tab header tidak terlalu ke bawah terhadap tepi atas drawer
    const kotakDrawer = await drawer.boundingBox();
    const kotakTabs = await drawer.locator(".avz-gps-tabs-header").boundingBox();
    expect(kotakDrawer).toBeTruthy();
    expect(kotakTabs).toBeTruthy();
    const jarakAtasTabs = kotakTabs!.y - kotakDrawer!.y;
    expect(jarakAtasTabs).toBeLessThan(36);

    // Pindah ke tab Pelacakan dan mulai pelacakan
    const tabPelacakan = drawer.getByRole("tab", { name: "Pelacakan" });
    await tabPelacakan.click();
    await expect(drawer.locator(".avz-gps-status-box.siap")).toBeVisible();
    await drawer.getByRole("button", { name: "Mulai Pelacakan" }).click();

    // Kotak status & tab Pelacakan mendapat pewarnaan aktif ketika mulai pelacakan
    await expect(tabPelacakan).toHaveClass(/pelacakan-aktif/);
    const kotakStatusAktif = drawer.locator(".avz-gps-status-box.sedang-melacak");
    await expect(kotakStatusAktif).toBeVisible();
    const warnaLatarAktif = await kotakStatusAktif.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(warnaLatarAktif).not.toBe("rgba(0, 0, 0, 0)");
    expect(warnaLatarAktif).not.toBe("rgb(255, 255, 255)");

    // Tombol ekstra di bawah Jeda dan Hentikan sudah dihapus
    await expect(drawer.getByRole("button", { name: "Jeda" })).toBeVisible();
    const btnHentikan = drawer.getByRole("button", { name: "Hentikan" });
    await expect(btnHentikan).toBeVisible();
    await expect(btnHentikan).toBeEnabled();
    await expect(drawer.locator("button", { hasText: /Tambah titik|Urungkan|Ulangi|Simulasi|Batalkan/ })).toHaveCount(0);

    // Tab header tetap berada di atas tanpa terpotong
    const kotakTabsSaatMelacak = await drawer.locator(".avz-gps-tabs-header").boundingBox();
    expect(kotakTabsSaatMelacak!.y).toBeGreaterThanOrEqual(kotakDrawer!.y);

    // Jeda -> warna status dijeda -> Lanjutkan -> Hentikan
    await drawer.getByRole("button", { name: "Jeda" }).click();
    await expect(drawer.locator(".avz-gps-status-box.dijeda")).toBeVisible();
    await drawer.getByRole("button", { name: "Lanjutkan" }).click();
    await expect(drawer.locator(".avz-gps-status-box.sedang-melacak")).toBeVisible();
    await btnHentikan.click();
    await expect(drawer).toHaveCount(0);

    // Verifikasi semua kartu Pilihan Peta Dasar dibuat memanjang penuh seperti Topografi
    await p.locator('button[aria-label="Pilih peta dasar"]').click();
    const sheetBasemap = p.locator(".avz-basemap-sheet");
    await expect(sheetBasemap).toBeVisible();
    const lebarGrid = (await sheetBasemap.locator(".avz-basemap-grid").boundingBox())!.width;
    const jumlahKartu = await sheetBasemap.locator(".avz-basemap-kartu").count();
    expect(jumlahKartu).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < jumlahKartu; i++) {
      const box = await sheetBasemap.locator(".avz-basemap-kartu").nth(i).boundingBox();
      expect(Math.abs(box!.width - lebarGrid)).toBeLessThan(2);
    }
    await p.locator(".avz-sheet-latar").click({ position: { x: 10, y: 10 } });
  });

  await test.step("2. Menu Alat Peta: Cari Koordinat, Pusatkan GPS, Rata-rata Plot GPS, Tandai Foto, & Monitor Geofences dinamis", async () => {
    // Buka pencarian dan lompat ke koordinat jauh
    await p.locator('button[aria-label="Cari di Peta"]').click();
    await p.locator("input.avz-cari-input").fill("2.875000, 117.395000");
    await p.locator("input.avz-cari-input").press("Enter");
    await sampai(async () => {
      const pos = await posisiPeta(p);
      return Boolean(pos && Math.abs(pos.lat - 2.875) < 0.002);
    });

    // Klik tombol Posisi saya -> memusatkan peta ke GPS aktif
    await p.locator("button.avz-nav-arrow-btn").click();
    await sampai(async () => {
      const pos = await posisiPeta(p);
      return Boolean(pos && Math.abs(pos.lat - 2.85727) < 0.002);
    });

    // Menu Alat -> Rata-rata Plot GPS langsung masuk ke detail form, lalu simpan 1 titik nyata
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

    // Menu Alat -> Tandai Foto membuka detail form dengan sorotan unggah foto
    await p.getByRole("button", { name: "Alat peta" }).click();
    await p.locator(".avz-tool-popup-item", { hasText: "Tandai Foto" }).click();
    await expect(p.locator(".visual-category-grid")).toHaveCount(0);
    await expect(p.locator(".form-photo-box.sorot-aksi-foto")).toBeVisible();
    await p.locator("form.field-survey-form button", { hasText: "Tutup, simpan draf" }).click();

    // Menu Alat -> Monitor Geofences: aktif -> keluar batas -> masuk kembali -> matikan
    await p.getByRole("button", { name: "Alat peta" }).click();
    await p.locator(".avz-tool-popup-item", { hasText: "Monitor Geofences" }).click();
    await expect(p.locator(".avz-geofence-pill")).toContainText(/Di dalam/i);

    await p.context().setGeolocation({ latitude: 2.872, longitude: 117.392, accuracy: 8 });
    await expect(p.locator(".avz-geofence-pill")).toContainText(/Di luar/i, { timeout: 8000 });

    await p.context().setGeolocation({ latitude: 2.8573, longitude: 117.3775, accuracy: 6 });
    await expect(p.locator(".avz-geofence-pill")).toContainText(/Di dalam/i, { timeout: 8000 });

    await p.getByRole("button", { name: "Alat peta" }).click();
    await p.locator(".avz-tool-popup-item", { hasText: "Matikan Monitor Geofences" }).click();
    await expect(p.locator(".avz-geofence-pill")).toHaveCount(0);

    // Keluar dari peta layar penuh
    await p.locator('button[aria-label="Kembali"]').first().click();
  });

  await test.step("3. Pustaka & Pengaturan Ekspor: Verifikasi nyata GeoJSON, KML, SHP biner ESRI, dan Paket SHP ZIP", async () => {
    await p.locator(".avenza-nav-item", { hasText: "Mode User" }).click();
    await p.locator(".avenza-nav-item", { hasText: "Pustaka" }).click();
    await p.locator('[role="tab"]', { hasText: "Lapisan" }).click();

    await p.locator("button.avenza-fab-orange").click();
    await p.locator('input[placeholder="Masukkan nama lapisan"]').fill("Lapisan Survei Simulasi");
    await p.locator("button", { hasText: /^Buat Lapisan$/ }).click();
    await expect(p.locator(".avenza-pustaka-container")).toContainText("Lapisan Survei Simulasi");

    await p.locator('button.avenza-toolbar-toggle-btn[title="Buka Toolbar"]').click();
    await p.locator(".avenza-overflow-item", { hasText: "Pilih" }).click();
    await expect(p.locator(".avenza-selection-banner")).toBeVisible();
    await p.locator('input[type="checkbox"]').first().check();
    await p.locator(".avenza-selection-banner button", { hasText: "Pengaturan Ekspor" }).click();

    await expect(p.locator(".avenza-subpage-header")).toContainText("Ekspor");
    await p.locator("select").first().selectOption("Lapisan dan peta");

    // Pastikan chip format hanya menyediakan GeoJSON, KML, dan SHP
    const grupFormat = p.getByRole("group", { name: "Pilih format ekspor" });
    await expect(grupFormat.locator("button")).toHaveCount(3);
    await expect(grupFormat.getByRole("button", { name: "GeoJSON (.geojson)" })).toBeVisible();
    await expect(grupFormat.getByRole("button", { name: "KML (.kml)" })).toBeVisible();
    await expect(grupFormat.getByRole("button", { name: "Shapefile (.shp)" })).toBeVisible();

    // Toggle switch Foto ditautkan
    const switchFoto = p.getByRole("switch", { name: /Foto ditautkan/ });
    await expect(switchFoto).toHaveAttribute("aria-checked", "true");
    await switchFoto.click();
    await expect(switchFoto).toHaveAttribute("aria-checked", "false");

    // 3a. Ekspor GeoJSON dan verifikasi isi FeatureCollection
    await grupFormat.getByRole("button", { name: "GeoJSON (.geojson)" }).click();
    const tungguGeoJson = p.waitForEvent("download");
    await p.locator('button[title="Ekspor sekarang"]').click();
    const unduhanGeoJson = await tungguGeoJson;
    expect(unduhanGeoJson.suggestedFilename()).toMatch(/\.geojson$/);
    const isiGeoJson = JSON.parse(readFileSync((await unduhanGeoJson.path())!, "utf8")) as {
      type: string;
      features: Array<{ properties?: Record<string, unknown> }>;
    };
    expect(isiGeoJson.type).toBe("FeatureCollection");
    expect(
      isiGeoJson.features.some(
        (f) => f.properties?.judul === "Pohon Meranti Simulasi" || f.properties?.label === "Pohon Meranti Simulasi"
      )
    ).toBe(true);

    // 3b. Ekspor KML dan verifikasi struktur XML Placemark
    await grupFormat.getByRole("button", { name: "KML (.kml)" }).click();
    const tungguKml = p.waitForEvent("download");
    await p.locator('button[title="Ekspor sekarang"]').click();
    const unduhanKml = await tungguKml;
    expect(unduhanKml.suggestedFilename()).toMatch(/\.kml$/);
    const isiKml = readFileSync((await unduhanKml.path())!, "utf8");
    expect(isiKml).toContain("<kml");
    expect(isiKml).toContain("Pohon Meranti Simulasi");

    // 3c. Ekspor SHP (.shp) dan verifikasi biner header ESRI 9994 + panjang + versi + shapeType
    await grupFormat.getByRole("button", { name: "Shapefile (.shp)" }).click();
    const tungguShp = p.waitForEvent("download");
    await p.locator('button[title="Ekspor sekarang"]').click();
    const unduhanShp = await tungguShp;
    expect(unduhanShp.suggestedFilename()).toMatch(/\.shp$/);
    const bufShp = readFileSync((await unduhanShp.path())!);
    const dvShp = new DataView(bufShp.buffer, bufShp.byteOffset, bufShp.byteLength);
    expect(dvShp.getInt32(0, false)).toBe(9994);
    expect(dvShp.getInt32(24, false) * 2).toBe(bufShp.byteLength);
    expect(dvShp.getInt32(28, true)).toBe(1000);
    expect([1, 3, 5]).toContain(dvShp.getInt32(32, true));

    // 3d. Ekspor Paket Lengkap SHP (.zip: .shp, .shx, .dbf, .prj)
    const tungguZip = p.waitForEvent("download");
    await p.getByRole("button", { name: /Unduh Paket Lengkap SHP/ }).click();
    const unduhanZip = await tungguZip;
    expect(unduhanZip.suggestedFilename()).toMatch(/_shp\.zip$/);
    const bufZip = readFileSync((await unduhanZip.path())!);
    const dvZip = new DataView(bufZip.buffer, bufZip.byteOffset, bufZip.byteLength);
    expect(dvZip.getUint32(0, true)).toBe(0x04034b50);
    expect(dvZip.getUint32(bufZip.byteLength - 22, true)).toBe(0x06054b50);

    await p.locator(".avenza-back-btn").click();
  });

  await test.step("4. Komunikasi: Rekam Pesan Suara, Putar Audio, Kirim Pin GPS, dan Buka di Peta", async () => {
    await p.locator(".avenza-nav-item", { hasText: "Diskusi" }).click();

    await p.locator('button[aria-label="Rekam Pesan Suara"]').click();
    await expect(p.locator('[role="region"][aria-label="Rekaman Pesan Suara"]')).toBeVisible();
    await p.waitForTimeout(1100);
    await p.locator('button[aria-label="Kirim Pesan Suara"]').click();

    const btnPutar = p.locator('button[aria-label="Putar Pesan Suara"]').last();
    await expect(btnPutar).toBeVisible();
    await btnPutar.click();
    await expect(p.locator('button[aria-label="Jeda Pesan Suara"]')).toBeVisible();
    await p.locator('button[aria-label="Jeda Pesan Suara"]').click();

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

test("simulasi PC desktop: basemap memanjang konsisten dan drawer pelacakan bersih dan berwarna", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    {
      viewport: { width: 1280, height: 800 },
      permissions: ["geolocation"],
      geolocation: { latitude: 2.85727, longitude: 117.377476, accuracy: 6 }
    },
    false
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));

  const rahasia = await masukSebagaiAdmin(p);
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.waitForSelector(".map-canvas-container");

  // Basemap memanjang penuh di PC juga
  await p.locator('button[aria-label="Pilih peta dasar"]').click();
  const sheet = p.locator(".avz-basemap-sheet");
  await expect(sheet).toBeVisible();
  const lebarGrid = (await sheet.locator(".avz-basemap-grid").boundingBox())!.width;
  const jumlahKartu = await sheet.locator(".avz-basemap-kartu").count();
  for (let i = 0; i < jumlahKartu; i++) {
    const box = await sheet.locator(".avz-basemap-kartu").nth(i).boundingBox();
    expect(Math.abs(box!.width - lebarGrid)).toBeLessThan(2);
  }
  await p.locator(".avz-sheet-latar").click({ position: { x: 10, y: 10 } });

  // Drawer Pelacakan berwarna aktif dan bebas tombol ekstra
  await p.locator('button[aria-label="Buka panel lokasi, pelacakan, dan navigasi"]').click();
  const drawer = p.locator(".avz-gps-drawer");
  await drawer.getByRole("tab", { name: "Pelacakan" }).click();
  await drawer.getByRole("button", { name: "Mulai Pelacakan" }).click();
  await expect(drawer.locator(".avz-gps-status-box.sedang-melacak")).toBeVisible();
  await expect(drawer.locator("button", { hasText: /Urungkan|Ulangi|Simulasi|Batalkan/ })).toHaveCount(0);
  await drawer.getByRole("button", { name: "Hentikan" }).click();

  expect(galat).toEqual([]);
  await tutup();
});

test("posisi pojok kiri bawah skala/atribusi dan auto-cache 1x1 km zoom tinggi 2 slot bergulir", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
  );
  let gagalJaringan = false;
  await p.context().route(/server\.arcgisonline\.com|ibasemaps-api\.arcgis\.com/, (r) =>
    r.fulfill({ status: 404, body: "" })
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) =>
    gagalJaringan
      ? r.fulfill({ status: 503, body: "offline-nyasar" })
      : r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG })
  );

  const rahasia = await masukSebagaiAdmin(p);
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.waitForSelector(".map-canvas-container");

  // 1. Verifikasi skala & atribusi mepet sudut kiri bawah tepat di atas bilah bawah
  const kanvasBox = await p.locator(".map-canvas-container").boundingBox();
  const bilahBox = await p.locator(".avz-bottom-pill-bar").boundingBox();
  const skalaBox = await p.locator(".avenza-scale-bar-wrap").boundingBox();
  const atrBox = await p.locator("#atribusi-peta").boundingBox();
  expect(skalaBox!.x - kanvasBox!.x).toBeLessThanOrEqual(12);
  expect(atrBox!.x - kanvasBox!.x).toBeLessThanOrEqual(12);
  expect(bilahBox!.y - (atrBox!.y + atrBox!.height)).toBeLessThanOrEqual(10);
  expect(bilahBox!.y - (atrBox!.y + atrBox!.height)).toBeGreaterThanOrEqual(-0.5);

  // 2. Pilih OSM agar rute RUTE_TILE_PUBLIK melayani tile 200 OK
  await p.locator('button[aria-label="Pilih peta dasar"]').click();
  await p.locator(".map-basemap-Option", { hasText: "OSM" }).click();

  // Tunggu auto-cache 1x1 km pertama selesai mengisi Cache API & localStorage slot 1
  expect(
    await sampai(async () => {
      return p.evaluate(() => {
        const raw = localStorage.getItem("geokader_auto_cache_peta_v1");
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) && arr.length === 1 && arr[0].basemap === "osm";
      });
    }, 15_000)
  ).toBe(true);

  const infoSlot1 = await p.evaluate(async () => {
    const slots = JSON.parse(localStorage.getItem("geokader_auto_cache_peta_v1") || "[]");
    const keys = await (await caches.open("geokader-tiles-v1")).keys();
    return { slots, jumlahKeys: keys.length };
  });
  expect(infoSlot1.slots[0].zoomMax).toBe(19);
  expect(infoSlot1.jumlahKeys).toBeGreaterThanOrEqual(infoSlot1.slots[0].urls.length);

  // 3. Pindah lokasi > 1 km via fitur Cari di Peta -> tunggu terbentuk cadangan 2 slot
  await p.getByRole("button", { name: "Cari di Peta" }).click();
  await p.getByPlaceholder("Telusuri...").fill("-6.2450, 106.8650");
  await p.getByPlaceholder("Telusuri...").press("Enter");

  expect(
    await sampai(async () => {
      return p.evaluate(() => {
        const arr = JSON.parse(localStorage.getItem("geokader_auto_cache_peta_v1") || "[]");
        return Array.isArray(arr) && arr.length === 2;
      });
    }, 15_000)
  ).toBe(true);

  // 4. Jaringan nyasar (503) saat pindah ke lokasi ke-3: 2 slot sebelumnya TIDAK boleh terhapus
  gagalJaringan = true;
  await p.getByRole("button", { name: "Cari di Peta" }).click();
  await p.getByPlaceholder("Telusuri...").fill("-6.2900, 106.9100");
  await p.getByPlaceholder("Telusuri...").press("Enter");
  await p.waitForTimeout(2500);

  const setelahNyasar = await p.evaluate(() => JSON.parse(localStorage.getItem("geokader_auto_cache_peta_v1") || "[]"));
  expect(setelahNyasar).toHaveLength(2);
  expect(Math.abs(setelahNyasar[0].pusatLat - -6.245)).toBeLessThan(0.01);

  // 5. Majukan waktu > 30 hari (buka kunci TOTP bila sesi 8 jam habis) & simulasikan jaringan menyambung -> otomatis perbarui ke lokasi aktif dan tetap jaga maks 2 slot
  const waktuSebelum = setelahNyasar[0].dibuatPada as number;
  gagalJaringan = false;
  await majukanJam(p, 31 * 86400);
  await p.evaluate(() => window.dispatchEvent(new Event("offline")));
  await p.waitForTimeout(1200);
  if (await terkunci(p)) {
    await p.locator(".layar-kunci").getByPlaceholder("123 456").fill(await kodeBerikutnya(p, rahasia));
    await p.locator(".layar-kunci").getByRole("button", { name: "Verifikasi" }).click();
    expect(await sampai(async () => !(await terkunci(p)))).toBe(true);
  }
  await p.evaluate(() => window.dispatchEvent(new Event("online")));
  if ((await p.locator(".map-canvas-container").count()) === 0) {
    await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
    await p.waitForSelector(".map-canvas-container");
  }
  const basemapNow = await p.locator("#atribusi-peta").innerText();
  if (!/OpenStreetMap/.test(basemapNow)) {
    await p.locator('button[aria-label="Pilih peta dasar"]').click();
    await p.locator(".map-basemap-Option", { hasText: "OSM" }).click();
  }

  expect(
    await sampai(async () => {
      return p.evaluate((lama) => {
        const arr = JSON.parse(localStorage.getItem("geokader_auto_cache_peta_v1") || "[]");
        return Array.isArray(arr) && arr.length === 2 && arr[0]?.dibuatPada > lama;
      }, waktuSebelum);
    }, 15_000)
  ).toBe(true);

  const hasilAkhir = await p.evaluate(() => JSON.parse(localStorage.getItem("geokader_auto_cache_peta_v1") || "[]"));
  expect(hasilAkhir).toHaveLength(2);
  expect(Math.abs(hasilAkhir[0].pusatLat - -6.29)).toBeLessThan(0.01);
  expect(Math.abs(hasilAkhir[1].pusatLat - -6.245)).toBeLessThan(0.01);

  expect(galat).toEqual([]);
  await tutup();
});

test("swipe ke atas buka drawer, kompas klik 3x pertahankan simbol, pelacakan tidak terpotong di bawah, dan hapus lembar peta dari Lapisan", async ({
  browser
}) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    {
      viewport: { width: 390, height: 780 },
      hasTouch: true,
      isMobile: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 2.85727, longitude: 117.377476, accuracy: 6 }
    },
    false
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));

  await masukSebagaiAdmin(p);

  // Semai area offline ke localStorage agar bisa menguji bahwa menu Lapisan Peta TIDAK menampilkan Lembar peta
  await p.evaluate(() => {
    localStorage.setItem(
      "geokader_offline_maps_v5",
      JSON.stringify([
        {
          id: "lembar-uji-1",
          namaArea: "Peta Uji Offline GeoPDF",
          basemap: "esri",
          basemapId: "esri",
          minLat: 2.84,
          maxLat: 2.87,
          minLng: 117.36,
          maxLng: 117.39,
          zoomMin: 12,
          zoomMax: 16,
          jumlahTile: 4,
          ukuranMb: 1.5,
          diunduhPada: "2026-11-14T00:00:00.000Z"
        }
      ])
    );
  });

  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.waitForSelector(".map-canvas-container");

  // 1. Uji menu kompas (.avz-nav-arrow-btn & .avz-kompas) diklik 3x: simbol harus selalu tampak dan kontras
  const navBtn = p.locator(".avz-nav-arrow-btn");
  const kompasBtn = p.locator(".avz-kompas");
  for (let klik = 1; klik <= 3; klik++) {
    await navBtn.click();
    await expect(navBtn.locator("svg")).toBeVisible();
    await expect(kompasBtn.locator("svg")).toBeVisible();
    const gaya = await navBtn.evaluate((el) => {
      const s = getComputedStyle(el);
      const svg = el.querySelector("svg")!.getBoundingClientRect();
      return { color: s.color, bg: s.backgroundColor, w: svg.width, h: svg.height };
    });
    expect(gaya.w, `klik ke-${klik} ukuran ikon nav`).toBeGreaterThanOrEqual(20);
    expect(gaya.h, `klik ke-${klik} tinggi ikon nav`).toBeGreaterThanOrEqual(20);
    expect(gaya.color, `klik ke-${klik} warna ikon jangan putih-di-putih`).not.toBe(gaya.bg);
  }
  for (let klik = 1; klik <= 3; klik++) {
    await kompasBtn.click();
    await expect(kompasBtn).toBeVisible();
    await expect(kompasBtn.locator("svg")).toBeVisible();
    const svgBox = await kompasBtn.locator("svg").boundingBox();
    expect(svgBox!.width, `kompas klik ke-${klik}`).toBeGreaterThanOrEqual(30);
    expect(svgBox!.height, `kompas klik ke-${klik}`).toBeGreaterThanOrEqual(30);
  }

  // 2. Uji swipe ke atas & ke bawah yang halus dan bertahap (mengikuti jari + ringkas <-> sedang <-> penuh <-> tutup)
  const pillKoord = p.locator(".avz-pill-koordinat");
  const boxPill = (await pillKoord.boundingBox())!;
  const sx = boxPill.x + boxPill.width / 2;
  const sy = boxPill.y + boxPill.height / 2;
  const cdp = await p.context().newCDPSession(p);

  const geserVertikal = async (x: number, yAwal: number, totalDy: number, langkah = 5, jedaMs = 30, tahanSebelumLepas = false) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: yAwal, id: 1 }] });
    for (let i = 1; i <= langkah; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: yAwal + (totalDy * i) / langkah, id: 1 }]
      });
      if (jedaMs > 0) await p.waitForTimeout(jedaMs);
    }
    if (!tahanSebelumLepas) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
  };

  // Tarikan terlalu pendek (< 28px) langsung memantul menutup kembali
  await geserVertikal(sx, sy, -16, 4, 25);
  const drawer = p.locator(".avz-gps-drawer");
  await expect(drawer).toBeHidden();

  // Usap naik bertahap ke tahap 1 ("ringkas") sambil mengecek pelacakan jari real-time di tengah tarikan
  await geserVertikal(sx, sy, -70, 5, 30, true);
  await expect(drawer).toHaveClass(/sedang-seret/);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("data-tahap", "ringkas");
  // Memastikan swipe pada pill koordinat TIDAK memicu dialog Salin Koordinat
  await expect(p.locator(".avz-coord-modal")).toHaveCount(0);
  await p.waitForTimeout(280);
  const tinggiRingkas = (await drawer.boundingBox())!.height;

  // Usap naik dari kepala drawer -> naik bertahap ke "sedang", lalu ke "penuh"
  const kepala = drawer.locator(".avz-gps-drawer-kepala");
  const kMid = async () => {
    const b = (await kepala.boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + 12 };
  };
  let posKepala = await kMid();
  await geserVertikal(posKepala.x, posKepala.y, -70, 5, 30);
  await expect(drawer).toHaveAttribute("data-tahap", "sedang");
  await p.waitForTimeout(280);
  const tinggiSedang = (await drawer.boundingBox())!.height;
  expect(tinggiSedang).toBeGreaterThan(tinggiRingkas + 40);

  posKepala = await kMid();
  await geserVertikal(posKepala.x, posKepala.y, -70, 5, 30);
  await expect(drawer).toHaveAttribute("data-tahap", "penuh");
  await p.waitForTimeout(280);
  const tinggiPenuh = (await drawer.boundingBox())!.height;
  expect(tinggiPenuh).toBeGreaterThan(tinggiSedang + 40);

  // Usap turun terkendali dari kepala drawer -> turun bertahap penuh -> sedang -> ringkas -> tutup
  posKepala = await kMid();
  await geserVertikal(posKepala.x, posKepala.y, 70, 5, 30);
  await expect(drawer).toHaveAttribute("data-tahap", "sedang");
  await p.waitForTimeout(280);

  posKepala = await kMid();
  await geserVertikal(posKepala.x, posKepala.y, 70, 5, 30);
  await expect(drawer).toHaveAttribute("data-tahap", "ringkas");
  await p.waitForTimeout(280);

  posKepala = await kMid();
  await geserVertikal(posKepala.x, posKepala.y, 70, 5, 30);
  await expect(drawer).toBeHidden();

  // Buka lagi ke "ringkas" dari bilah bawah, lalu pindah tab Pelacakan -> otomatis melebar agar tombol utuh
  await geserVertikal(sx, sy, -70, 5, 30);
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("data-tahap", "ringkas");

  // 3. Cek tab Pelacakan: tombol Mulai Pelacakan, Jeda, dan Hentikan TIDAK terpotong di bawah
  await drawer.getByRole("tab", { name: "Pelacakan" }).click();
  await expect(drawer).toHaveAttribute("data-tahap", "sedang");
  await p.waitForTimeout(280);
  const drawerBox = (await drawer.boundingBox())!;
  const btnMulai = drawer.getByRole("button", { name: "Mulai Pelacakan" });
  await expect(btnMulai).toBeVisible();
  const mulaiBox = (await btnMulai.boundingBox())!;
  expect(mulaiBox.y + mulaiBox.height).toBeLessThanOrEqual(drawerBox.y + drawerBox.height + 0.5);
  expect(mulaiBox.y + mulaiBox.height).toBeLessThanOrEqual(780 + 0.5);

  await btnMulai.click();
  const drawerAktifBox = (await drawer.boundingBox())!;
  const btnJeda = drawer.getByRole("button", { name: "Jeda" });
  const btnHentikan = drawer.getByRole("button", { name: "Hentikan" });
  await expect(btnJeda).toBeVisible();
  await expect(btnHentikan).toBeVisible();
  const jedaBox = (await btnJeda.boundingBox())!;
  const hentiBox = (await btnHentikan.boundingBox())!;
  expect(jedaBox.y + jedaBox.height).toBeLessThanOrEqual(drawerAktifBox.y + drawerAktifBox.height + 0.5);
  expect(hentiBox.y + hentiBox.height).toBeLessThanOrEqual(drawerAktifBox.y + drawerAktifBox.height + 0.5);

  await btnHentikan.click();
  await p.locator(".avz-gps-drawer").waitFor({ state: "hidden" }).catch(() => undefined);

  // 4. Buka Lapisan Peta: pastikan fitur Lembar peta sudah dihilangkan dari menu ini
  await p.getByRole("button", { name: "Lapisan peta" }).click();
  const halamanLapisan = p.locator(".avz-halaman");
  await expect(halamanLapisan.getByRole("heading", { name: "Lapisan Peta" })).toBeVisible();
  await expect(halamanLapisan.getByText("Data lapangan")).toBeVisible();
  await expect(halamanLapisan.getByText("Lembar peta")).toHaveCount(0);
  await expect(halamanLapisan.getByText("Peta Uji Offline GeoPDF")).toHaveCount(0);
  await halamanLapisan.getByRole("button", { name: "Kembali" }).click();

  expect(galat).toEqual([]);
  await tutup();
});

test("uji mendalam fitur peta interaktif: hitung kecepatan real-time, pelacakan saat bergerak, pin titik di tengah rute, cari koordinat UTM/DMS, navigasi, dan ukur poligon", async ({
  browser
}) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 2.85727, longitude: 117.377476, accuracy: 5 }
    },
    false
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));

  await masukSebagaiAdmin(p);
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.waitForSelector(".map-canvas-container");

  // 1. Uji hitung kecepatan sesaat (Lokasi tab): bergerak 8.9 m dalam 1.2 detik -> kecepatan > 5 Km/j, lalu berhenti -> kembali 0,00
  await p.locator('button[aria-label="Buka panel lokasi, pelacakan, dan navigasi"]').click();
  const drawer = p.locator(".avz-gps-drawer");
  await expect(drawer).toBeVisible();
  const nilaiKecepatan = drawer.locator(".avz-gps-metric-item", { hasText: "Kecepatan (Km/j)" }).locator(".avz-metric-val");
  await expect(nilaiKecepatan).toHaveText("0,00");

  // Segarkan acuan waktu GPS di lokasi yang sama, tunggu 1.2 detik lalu pindah ~8.9m ke utara (~26 Km/j)
  await p.context().setGeolocation({ latitude: 2.85727, longitude: 117.377476, accuracy: 5 });
  await p.waitForTimeout(1200);
  await p.context().setGeolocation({ latitude: 2.85735, longitude: 117.377476, accuracy: 5 });
  await sampai(async () => {
    const teks = (await nilaiKecepatan.textContent())?.trim() || "0,00";
    return parseFloat(teks.replace(",", ".")) > 5;
  }, 5000);
  const vBergerak = parseFloat(((await nilaiKecepatan.textContent()) || "0").replace(",", "."));
  expect(vBergerak).toBeGreaterThan(5);
  expect(vBergerak).toBeLessThan(80);

  await p.waitForTimeout(1200);
  await p.context().setGeolocation({ latitude: 2.85735, longitude: 117.377476, accuracy: 5 });
  await expect(nilaiKecepatan).toHaveText("0,00", { timeout: 5000 });

  // 2. Uji tab Pelacakan: mulai rekam jalur, berjalan 2 segmen -> Jarak > 0, Kecepatan & Kecepatan Rata-rata > 0
  await drawer.getByRole("tab", { name: "Pelacakan" }).click();
  await drawer.getByRole("button", { name: "Mulai Pelacakan" }).click();
  await expect(drawer.locator(".avz-gps-status-box.sedang-melacak")).toBeVisible();

  await p.waitForTimeout(1200);
  await p.context().setGeolocation({ latitude: 2.85743, longitude: 117.377476, accuracy: 5 });
  await p.waitForTimeout(1200);
  await p.context().setGeolocation({ latitude: 2.85751, longitude: 117.377476, accuracy: 5 });

  const nilaiJarak = drawer.locator(".avz-gps-metric-item", { hasText: "Jarak: (Km)" }).locator(".avz-metric-val");
  const nilaiRata = drawer.locator(".avz-gps-metric-item", { hasText: "Kecepatan Rata-rata" }).locator(".avz-metric-val");
  await sampai(async () => {
    const j = parseFloat(((await nilaiJarak.textContent()) || "0").replace(",", "."));
    const r = parseFloat(((await nilaiRata.textContent()) || "0").replace(",", "."));
    const k = parseFloat(((await nilaiKecepatan.textContent()) || "0").replace(",", "."));
    return j > 0 && r > 0 && k > 0;
  }, 5000);

  // Tutup drawer dulu (perekaman tetap jalan di PanelPerekaman)
  await drawer.locator('button[aria-label="Tutup panel"]').click();
  await expect(drawer).toBeHidden();
  await expect(p.locator(".avz-status-rekam")).toBeVisible();

  // 3. Jatuhkan pin & simpan 1 titik di tengah pelacakan aktif -> pelacakan latar BELUM terhapus!
  await p.locator(".avz-fab-pin").click();
  await p.locator(".form-kategori-grid button").first().click();
  await p.locator('#form-survei-lapangan input[required]').fill("Patok Tengah Jalur");
  await p.locator('button[form="form-survei-lapangan"][aria-label="Simpan"]').click();
  await expect(p.locator(".avz-status-rekam")).toBeVisible();

  // Sekarang hentikan & simpan jalur yang terekam lewat PanelPerekaman
  await p.locator(".avz-status-rekam .rec-btn-save").click();
  await p.locator(".form-kategori-grid button").first().click();
  await p.locator('#form-survei-lapangan input[required]').fill("Jalur Patroli Terukur");
  await p.locator('button[form="form-survei-lapangan"][aria-label="Simpan"]').click();
  await expect(p.locator(".avz-status-rekam")).toBeHidden();

  // 4. Uji Gambar dan Ukur poligon (tambah sudut + urungkan + simpan poligon)
  await p.getByRole("button", { name: "Alat peta" }).click();
  await p.getByRole("menuitem", { name: "Gambar dan Ukur" }).click();
  const canvasBox = (await p.locator(".map-canvas-viewport").boundingBox())!;
  const geserPeta = async (dx: number, dy: number) => {
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await p.mouse.move(cx, cy);
    await p.mouse.down();
    await p.mouse.move(cx + dx, cy + dy, { steps: 6 });
    await p.mouse.up();
  };
  await geserPeta(80, 0);
  await p.locator(".avz-status-rekam .rec-btn-add").click();
  await geserPeta(0, 80);
  await p.locator(".avz-status-rekam .rec-btn-add").click();
  await geserPeta(-80, 0);
  await p.locator(".avz-status-rekam .rec-btn-add").click();
  await p.locator('.avz-status-rekam button[aria-label="Urungkan"]').click();
  await p.locator(".avz-status-rekam .rec-btn-add").click();
  await expect(p.locator(".avz-status-rekam .rec-btn-save")).toBeEnabled();
  await p.locator(".avz-status-rekam .rec-btn-save").click();
  await p.locator(".form-kategori-grid button").first().click();
  await p.locator('#form-survei-lapangan input[required]').fill("Petak Ukur Kebun");
  await p.locator('button[form="form-survei-lapangan"][aria-label="Simpan"]').click();
  await expect(p.locator(".avz-status-rekam")).toBeHidden();

  // 5. Uji Cari Koordinat dengan format UTM & Navigasi DMS -> banner Go-To aktif lalu Hentikan Navigasi
  await p.getByRole("button", { name: "Cari di Peta" }).click();
  await p.locator('input[aria-label="Titik koordinat atau nama objek"]').fill("UTM 50N 541932 315890");
  await p.locator('input[aria-label="Titik koordinat atau nama objek"]').press("Enter");
  await expect(p.locator(".field-map-message")).toContainText("Menuju ke koordinat");

  await p.locator('button[aria-label="Buka panel lokasi, pelacakan, dan navigasi"]').click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("tab", { name: "Navigasi" }).click();
  await drawer.getByRole("button", { name: "Masukkan Koordinat" }).click();
  await drawer.locator('input[aria-label="Koordinat tujuan"]').fill("2°51'30.0\" LU, 117°22'40.0\" BT");
  await drawer.getByRole("button", { name: "Navigasi", exact: true }).click();
  await expect(p.locator(".goto-nav-banner")).toBeVisible();

  await p.locator('button[aria-label="Buka panel lokasi, pelacakan, dan navigasi"]').click();
  await drawer.getByRole("tab", { name: "Navigasi" }).click();
  await drawer.getByRole("button", { name: "Hentikan Navigasi" }).click();
  await expect(p.locator(".goto-nav-banner")).toBeHidden();

  expect(galat).toEqual([]);
  await tutup();
});

test("hapus label maskot di pembuka sambil jaga simbol, titik sentuh melengkung rapi, Bantuan di Menu, dan inventaris bug otomatis/manual", async ({
  browser
}) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    false
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));

  await masukSebagaiAdmin(p);

  // 1. Layar pembuka mempertahankan simbol maskot tanpa label teks maskot
  await p.locator(".taka-topbar-mascot").click();
  const splash = p.locator("#layar-pembuka-taka");
  await expect(splash).toBeVisible();
  await expect(splash.locator(".taka-splash-avatar")).toBeVisible();
  await expect(splash.getByText(/MASKOT RESMI|Setiap titik punya cerita/i)).toHaveCount(0);
  await splash.locator("#lewati-splash-taka").click();
  await expect(splash).toBeHidden();

  // 2. Titik sentuh tombol dan item menu mengikuti sudut melengkung (bukan kotak kaku)
  await p.locator(".avenza-toolbar-toggle-btn").click();
  const itemMenu = p.locator(".avenza-overflow-item").first();
  await expect(itemMenu).toBeVisible();
  const radiusItemMenu = await itemMenu.evaluate((el) => parseFloat(getComputedStyle(el).borderRadius));
  expect(radiusItemMenu).toBeGreaterThanOrEqual(6);
  const radiusNavBawah = await p.locator(".avenza-nav-item").first().evaluate((el) => parseFloat(getComputedStyle(el).borderRadius));
  expect(radiusNavBawah).toBeGreaterThanOrEqual(8);

  // 3. Bug saat pemakaian terinventaris otomatis + Menu "Bantuan" ada dan bisa tulis bug manual
  await p.locator(".avenza-toolbar-toggle-btn").click(); // tutup dulu menu agar bisa picu event
  await p.evaluate(() => {
    window.dispatchEvent(new ErrorEvent("error", { message: "Uji bug otomatis pada peta" }));
  });

  await p.locator(".avenza-toolbar-toggle-btn").click();
  const btnBantuan = p.locator(".avenza-overflow-item", { hasText: "Bantuan" });
  await expect(btnBantuan).toBeVisible();
  await btnBantuan.click();

  const halBantuan = p.locator(".bantuan-page");
  await expect(halBantuan).toBeVisible();
  await expect(halBantuan.locator(".bantuan-bug-judul", { hasText: "Uji bug otomatis pada peta" })).toBeVisible();
  await expect(halBantuan.getByText("Otomatis", { exact: true }).first()).toBeVisible();

  await halBantuan.locator('input[placeholder*="Tombol tidak merespons"]').fill("Tombol tidak mulus di layar kecil");
  await halBantuan.locator(".bantuan-textarea").fill("Saat mengetuk menu pilihan di sudut kiri masih terasa kotak di tepi.");
  await halBantuan.getByRole("button", { name: "Simpan Catatan Bug" }).click();
  await expect(halBantuan.getByText("Tombol tidak mulus di layar kecil")).toBeVisible();
  await expect(halBantuan.getByText("Manual", { exact: true }).first()).toBeVisible();

  // Pastikan tersimpan di localStorage agar terbawa ke sesi perbaikan berikutnya
  const tersimpan = await p.evaluate(() => localStorage.getItem("geokader_inventaris_bug_v1") || "");
  expect(tersimpan).toContain("Uji bug otomatis pada peta");
  expect(tersimpan).toContain("Tombol tidak mulus di layar kecil");

  await halBantuan.locator('button[aria-label="Kembali"]').click();
  await expect(halBantuan).toBeHidden();

  // Cek item alat peta juga punya sudut melengkung
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.waitForSelector(".map-canvas-container");
  await p.getByRole("button", { name: "Alat peta" }).click();
  const radiusAlat = await p.locator(".avz-tool-popup-item").first().evaluate((el) => parseFloat(getComputedStyle(el).borderRadius));
  expect(radiusAlat).toBeGreaterThanOrEqual(6);

  expect(galat).toEqual([]);
  await tutup();
});

test("tekan back 1 kali hanya menampilkan peringatan dan baru keluar pada tekan back ke-2", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    false
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));

  // Beri entri riwayat asal yang sah (same-origin) sebelum membuka aplikasi
  await p.goto("http://localhost:4173/icon.svg");
  const urlAsal = p.url();

  // Uji pada halaman masuk setelah interaksi ringan (fokus kolom email) sebelum login:
  // Back ke-1 harus tetap menahan di aplikasi & tampilkan peringatan; Back ke-2 baru keluar ke icon.svg
  await p.goto("http://localhost:4173/");
  const inputEmail = p.getByPlaceholder("Masukkan alamat email");
  await expect(inputEmail).toBeVisible();
  await inputEmail.click();
  const urlAplikasi = p.url();
  await p.goBack();
  expect(p.url()).toBe(urlAplikasi);
  await expect(p.locator(".avenza-toast")).toContainText("Tekan kembali sekali lagi untuk keluar dari aplikasi.");
  await p.goBack();
  expect(p.url()).toBe(urlAsal);

  // Masuk sebagai admin (riwayat: [icon.svg, URL_APP]) lalu uji alur setelah masuk
  await masukSebagaiAdmin(p);

  // 1. Jika halaman Bantuan sedang terbuka, tekan Back menutup Bantuan tanpa keluar
  await p.locator(".avenza-toolbar-toggle-btn").click();
  await p.locator(".avenza-overflow-item", { hasText: "Bantuan" }).click();
  await expect(p.locator(".bantuan-page")).toBeVisible();
  await p.goBack();
  await expect(p.locator(".bantuan-page")).toBeHidden();
  expect(p.url()).toBe(urlAplikasi);

  // 2. Tekan Back ke-1 di layar utama: tetap berada di aplikasi dan muncul toast peringatan
  await p.goBack();
  expect(p.url()).toBe(urlAplikasi);
  await expect(p.locator(".avenza-toast")).toContainText("Tekan kembali sekali lagi untuk keluar dari aplikasi.");

  // 3. Tunggu lewat 2 detik lalu tekan Back lagi: tetap dicegat ulang (bukan langsung keluar)
  await p.waitForTimeout(2300);
  await p.goBack();
  expect(p.url()).toBe(urlAplikasi);
  await expect(p.locator(".avenza-toast")).toContainText("Tekan kembali sekali lagi untuk keluar dari aplikasi.");

  // 4. Tekan Back ke-2 dalam 2 detik: baru diizinkan keluar dari aplikasi ke halaman asal
  await p.goBack();
  expect(p.url()).toBe(urlAsal);

  expect(galat).toEqual([]);
  await tutup();
});

test("formulir langsung point/line/polygon dengan kategori & kolam peta tematik vs non-tematik serta anti-overlap label CRS WKT di Pustaka", async ({
  browser
}) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    false
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));

  // Semai peta ber-CRS WKT panjang seperti CT Lung Mekatif1 final untuk memastikan badge CRS tidak meluap keluar kartu
  await p.context().addInitScript(() => {
    const ada = localStorage.getItem("geokader_offline_maps_v5");
    if (!ada || ada === "[]") {
      localStorage.setItem(
        "geokader_offline_maps_v5",
        JSON.stringify([
          {
            id: "AREA-WKT-UJI",
            namaArea: "CT Lung Mekatif1 final",
            basemapId: "esri",
            minLat: 2.84,
            maxLat: 2.86,
            minLng: 117.36,
            maxLng: 117.39,
            zoomMin: 12,
            zoomMax: 16,
            jumlahTile: 0,
            ukuranMb: 12.7,
            jarakKm: 183.4,
            jenisFile: "GeoPDF / GeoTIFF",
            unduhanNyata: true,
            statusTeks: "Pada peta",
            crs: 'PROJCS["WGS_1984_UTM_Zone_50N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984"]]]',
            diunduhPada: "2026-11-16T00:00:00Z"
          }
        ])
      );
    }
  });

  await masukSebagaiAdmin(p);
  await p.locator(".avenza-nav-item", { hasText: "Mode User" }).click();

  // 1. Cek badge CRS WKT di Pustaka ringkas & muat di dalam kotak kartu
  const kartuWkt = p.locator(".avenza-map-row", { hasText: "CT Lung Mekatif1 final" }).first();
  await expect(kartuWkt).toBeVisible();
  const badgeCrs = kartuWkt.locator(".avenza-crs-badge");
  await expect(badgeCrs).toContainText("WGS84 UTM Zone 50N");
  const boxKartu = await kartuWkt.boundingBox();
  const boxBadge = await badgeCrs.boundingBox();
  expect(boxKartu).toBeTruthy();
  expect(boxBadge).toBeTruthy();
  expect(boxBadge!.x + boxBadge!.width).toBeLessThanOrEqual(boxKartu!.x + boxKartu!.width + 1);

  // 2. Uji Formulir Langsung pada Point: tambah kolam tematik baru "Kolam Flora" (Biodiversitas)
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.waitForSelector(".map-canvas-container");

  await p.locator(".avz-fab-pin").click();
  await expect(p.locator('#form-survei-lapangan input[required]')).toBeVisible();
  await expect(p.locator('select[aria-label="Pilih Peta Tematik"]')).toBeVisible();
  await p.locator('#form-survei-lapangan input[required]').fill("Meranti Kolam Satu");
  await p.locator(".form-kategori-grid button", { hasText: "Biodiversitas" }).click();
  await p.locator('select[aria-label="Pilih Peta Tematik"]').selectOption("__BARU__");
  await p.locator('input[placeholder*="Misal: Sebaran Meranti"]').fill("Kolam Flora");
  await p.locator('button[form="form-survei-lapangan"][aria-label="Simpan"]').click();
  await expect(p.locator(".avenza-toast")).toContainText("Kolam Flora");

  // 3. Uji Point ke-2 dengan tematik "Kolam Flora" TETAPI kategori berbeda ("Air" -> "Mata Air") -> jadi tematik tersendiri!
  await p.locator(".avz-fab-pin").click();
  await p.locator('#form-survei-lapangan input[required]').fill("Mata Air Terpisah");
  await p.locator(".form-kategori-grid button", { hasText: "Air" }).click();
  await p.locator('select[aria-label="Pilih Peta Tematik"]').selectOption("Kolam Flora");
  await expect(p.locator(".form-tematik-info.peringatan")).toContainText("Kolam Flora (Mata Air)");
  await p.locator('button[form="form-survei-lapangan"][aria-label="Simpan"]').click();

  // 4. Uji Point ke-3 dengan mengosongkan tematik -> masuk ke peta biasa (non-tematik)
  await p.locator(".avz-fab-pin").click();
  await p.locator('#form-survei-lapangan input[required]').fill("Patok Biasa");
  await p.locator(".form-kategori-grid button", { hasText: "Batas" }).click();
  await p.locator('select[aria-label="Pilih Peta Tematik"]').selectOption("");
  await expect(p.locator(".form-tematik-info")).toContainText("non-tematik");
  await p.locator('button[form="form-survei-lapangan"][aria-label="Simpan"]').click();

  // Verifikasi filter kolam tematik vs non-tematik di halaman Lapisan Peta
  await p.getByRole("button", { name: "Lapisan" }).click();
  await expect(p.locator(".avz-tematik-chip", { hasText: "Kolam Flora · Biodiversitas (1)" })).toBeVisible();
  await expect(p.locator(".avz-tematik-chip", { hasText: "Kolam Flora (Mata Air) · Mata Air (1)" })).toBeVisible();
  await expect(p.locator(".avz-tematik-chip", { hasText: "Non-Tematik (1)" })).toBeVisible();

  await p.getByRole("dialog", { name: "Lapisan Peta" }).getByRole("button", { name: "Kembali" }).click();

  expect(galat).toEqual([]);
  await tutup();
});

test("korelasi database GDrive, pencadangan 90 hari (pulihkan & hapus permanen), dan perhitungan level hanya dari database aktif", async ({
  browser
}) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    { viewport: { width: 1024, height: 820 }, hasTouch: false, isMobile: false },
    false
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));

  const aksiGDrive: string[] = [];
  await p.context().route(/script\.google\.com/, async (route) => {
    const raw = route.request().postData() || "{}";
    let body: { action?: string; idData?: string; records?: { id: string }[] } = {};
    try {
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
    if (body.action) aksiGDrive.push(body.action);
    if (body.action === "list_active_status") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sukses: true, aktif: [], pencadanganIds: [] }) });
      return;
    }
    if (body.action === "move_to_backup" || body.action === "restore_from_backup" || body.action === "delete_backup_permanent") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sukses: true }) });
      return;
    }
    const ids = (body.records || []).map((r) => r.id).filter((id) => id !== "SPS-LOKAL-ONLY");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sukses: true, diterima: ids, gagal: [] }) });
  });

  // Semai 1 data lokal (belum di database) & 1 jalur tersinkron (di database asli) milik Admin ADM-UJI
  await p.context().addInitScript(() => {
    const ada = localStorage.getItem("geokader_data_spasial_v5");
    if (!ada || ada === "[]") {
      const sekarang = new Date().toISOString();
      localStorage.setItem(
        "geokader_data_spasial_v5",
        JSON.stringify([
          {
            id: "SPS-DB-OK",
            idKader: "ADM-UJI",
            namaKader: "Siti Rahmawati",
            desaWilayah: "Desa Rimba Hijau",
            jenisGeometri: "line",
            kategori: "Tanda Batas",
            judul: "Jalur Aktif Database",
            deskripsi: "Sudah di GDrive",
            koordinat: [
              { lat: 2.85, lng: 117.37, akurasi: 4 },
              { lat: 2.87, lng: 117.39, akurasi: 4 }
            ],
            panjangKm: 3.1,
            luasHa: 0,
            statusSinkron: "tersinkron",
            createdAt: sekarang,
            updatedAt: sekarang,
            riwayatPembaruan: []
          },
          {
            id: "SPS-LOKAL-ONLY",
            idKader: "ADM-UJI",
            namaKader: "Siti Rahmawati",
            desaWilayah: "Desa Rimba Hijau",
            jenisGeometri: "point",
            kategori: "Biodiversitas",
            judul: "Titik Lokal Belum Standar",
            deskripsi: "",
            koordinat: [{ lat: 2.85, lng: 117.37 }],
            panjangKm: 0,
            luasHa: 0,
            statusSinkron: "lokal",
            createdAt: sekarang,
            updatedAt: sekarang,
            riwayatPembaruan: []
          }
        ])
      );
    }
  });

  await masukSebagaiAdmin(p);

  // Helper klik Hapus pada baris data (berfungsi baik untuk tampilan desktop maupun tablet/HP)
  const hapusBaris = async (judul: string) => {
    const baris = p.locator("tr", { hasText: judul });
    await expect(baris).toBeVisible();
    const btnDesktop = baris.locator('button[title="Pindahkan ke Pencadangan 90 Hari"]');
    if (await btnDesktop.isVisible()) {
      await btnDesktop.click();
    } else {
      await baris.locator(".aksi-data-trigger").click();
      await p.locator(".aksi-sheet .aksi-sheet-hapus").click();
    }
  };

  // 1. Buka Kendali > Data -> hapus data "Jalur Aktif Database" (harus pindah ke Pencadangan 90 Hari & kirim move_to_backup ke GDrive)
  await p.getByRole("button", { name: "Data", exact: true }).click();
  await hapusBaris("Jalur Aktif Database");
  await expect(p.locator(".avenza-toast")).toContainText("Pencadangan 90 Hari");
  await expect.poll(() => aksiGDrive.includes("move_to_backup")).toBe(true);

  // 2. Cek tab Pencadangan 90 Hari di Admin
  await p.getByRole("tab", { name: /Pencadangan 90 Hari/ }).click();
  const kartuCadangan = p.locator(".admin-pencadangan-card", { hasText: "Jalur Aktif Database" });
  await expect(kartuCadangan).toBeVisible();
  await expect(kartuCadangan).toContainText(/90 hari tersisa/);

  // 3. Cek Level di Kader/User: karena Jalur Aktif Database ada di Pencadangan, hanya tersisa 0 data sah DB -> tetap Level 1
  await p.locator(".avenza-nav-item", { hasText: "Mode User" }).click();
  await p.locator(".avenza-nav-item", { hasText: "Sertifikat" }).click();
  await expect(p.locator(".visual-current-level-title")).toContainText("Penjelajah Dasar");
  await expect(p.locator("#info-korelasi-level-database")).toContainText("Di Pencadangan 90 Hari (tidak dihitung): 1");

  // 4. Kembali ke Admin -> Pulihkan data dari Pencadangan 90 Hari -> kirim restore_from_backup & Level naik kembali!
  await p.locator(".avenza-nav-item", { hasText: "Pustaka" }).click();
  await p.locator(".avenza-toolbar-toggle-btn").click();
  await p.locator(".avenza-overflow-item", { hasText: /Mode Admin/i }).click();
  await p.locator("#kode-totp-admin").waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
  // Buka tab Data bila gerbang masih terbuka
  if ((await p.getByRole("button", { name: "Data", exact: true }).count()) > 0) {
    await p.getByRole("button", { name: "Data", exact: true }).click();
    await p.getByRole("tab", { name: /Pencadangan 90 Hari/ }).click();
    await p.locator(".admin-pencadangan-card", { hasText: "Jalur Aktif Database" }).getByRole("button", { name: "Pulihkan" }).click();
    await expect.poll(() => aksiGDrive.includes("restore_from_backup")).toBe(true);

    // Pindah lagi ke cadangan lalu uji Hapus Permanen
    await p.getByRole("tab", { name: /Database Aktif/ }).click();
    await hapusBaris("Jalur Aktif Database");
    await p.getByRole("tab", { name: /Pencadangan 90 Hari/ }).click();
    await p.locator(".admin-pencadangan-card", { hasText: "Jalur Aktif Database" }).getByRole("button", { name: "Hapus Permanen" }).click();
    await expect.poll(() => aksiGDrive.includes("delete_backup_permanent")).toBe(true);
    await expect(p.locator(".admin-pencadangan-card", { hasText: "Jalur Aktif Database" })).toHaveCount(0);
  }

  expect(galat).toEqual([]);
  await tutup();
});
