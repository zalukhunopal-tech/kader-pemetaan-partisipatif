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

  // 2. Uji swipe ke atas dari bilah bawah (.avz-pill-koordinat) memunculkan kotak dialog Lokasi · Pelacakan · Navigasi
  const pillKoord = p.locator(".avz-pill-koordinat");
  const boxPill = (await pillKoord.boundingBox())!;
  const sx = boxPill.x + boxPill.width / 2;
  const sy = boxPill.y + boxPill.height / 2;
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: sx, y: sy - i * 16, id: 1 }]
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  const drawer = p.locator(".avz-gps-drawer");
  await expect(drawer).toBeVisible();
  // Memastikan swipe pada pill koordinat TIDAK memicu dialog Salin Koordinat
  await expect(p.locator(".avz-coord-modal")).toHaveCount(0);

  // Swipe ke bawah dari kepala drawer menutup kembali kotak dialog
  const kepala = drawer.locator(".avz-gps-drawer-kepala");
  const boxKepala = (await kepala.boundingBox())!;
  const kx = boxKepala.x + boxKepala.width / 2;
  const ky = boxKepala.y + 12;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: kx, y: ky, id: 2 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: kx, y: ky + i * 18, id: 2 }]
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(drawer).toBeHidden();

  // Buka lagi dengan swipe ke atas dari bilah bawah untuk memeriksa tab Pelacakan
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy, id: 3 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: sx, y: sy - i * 16, id: 3 }]
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(drawer).toBeVisible();

  // 3. Cek tab Pelacakan: tombol Mulai Pelacakan, Jeda, dan Hentikan TIDAK terpotong di bawah
  await drawer.getByRole("tab", { name: "Pelacakan" }).click();
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
