import { expect, test } from "@playwright/test";
import {
  JPEG,
  PIN,
  PNG,
  RUTE_TILE_PUBLIK,
  URL_APP,
  URL_APP_KUNCI,
  halamanBaru,
  kotak,
  masukSebagaiAdmin,
  posisiPeta,
  sampai,
  teksToast
} from "./bantu";

test("HP dengan huruf besar: peta layar penuh, atribusi dan tombol pin tidak tertutup bilah bawah; cubit dua jari", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    { viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.6 },
    true
  );
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));
  await masukSebagaiAdmin(p);

  await test.step("bilah navigasi di luar peta: label utuh", async () => {
    const nav = await kotak(p, ".avenza-bottom-nav");
    const varNav = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tinggi-nav").trim());
    expect(Math.abs(parseFloat(varNav) - nav.height)).toBeLessThanOrEqual(1);
    const labelUtuh = await p.locator(".avenza-nav-item span").evaluateAll((s) =>
      s.map((x) => {
        const r = x.getBoundingClientRect();
        const n = x.closest("nav")!.getBoundingClientRect();
        return r.top >= n.top - 0.5 && r.bottom <= n.bottom + 0.5;
      })
    );
    expect(labelUtuh.every(Boolean)).toBe(true);
  });

  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.waitForTimeout(1200);

  await test.step("tata letak peta layar penuh", async () => {
    // Di tab peta HP, bilah navigasi aplikasi disembunyikan (seperti Avenza); tombol kembali di bilah judul
    expect(await p.locator(".avenza-bottom-nav").isVisible()).toBe(false);
    expect(await p.locator(".avz-titlebar").getByRole("button", { name: "Kembali" }).isVisible()).toBe(true);
    const bawahLayar = 780;
    expect((await kotak(p, ".map-canvas-container")).bottom).toBeLessThanOrEqual(bawahLayar + 0.5);
    const bilah = await kotak(p, ".avz-bottom-pill-bar");
    const atr = await kotak(p, "#atribusi-peta");
    const pin = await kotak(p, ".avz-fab-pin");
    expect(bilah.bottom).toBeLessThanOrEqual(bawahLayar + 0.5);
    expect(atr.bottom).toBeLessThanOrEqual(bilah.top + 0.5);
    expect(bilah.top - atr.bottom).toBeLessThanOrEqual(10);
    expect(atr.left).toBeLessThanOrEqual(12);
    expect(pin.bottom).toBeLessThanOrEqual(bilah.top + 0.5);
    expect(pin.right).toBeLessThanOrEqual(360);
    const tidakBertumpuk = atr.right <= pin.left + 1 || atr.bottom <= pin.top + 1 || pin.bottom <= atr.top + 1;
    expect(tidakBertumpuk).toBe(true);
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  await test.step("cubit dua jari: perbesar, perkecil, dan geser", async () => {
    const kan = await kotak(p, "canvas.map-canvas");
    const cx = kan.left + kan.width / 2;
    const cy = kan.top + kan.height / 2;
    const cdp = await p.context().newCDPSession(p);
    const cubit = async (dari: number, ke: number, geserX = 0) => {
      const titik = (d: number, gx: number) => [
        { x: cx - d / 2 + gx, y: cy, id: 1 },
        { x: cx + d / 2 + gx, y: cy, id: 2 }
      ];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: titik(dari, 0) });
      for (let i = 1; i <= 8; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: titik(dari + ((ke - dari) * i) / 8, (geserX * i) / 8)
        });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await p.waitForTimeout(600);
    };
    const awal = (await posisiPeta(p))!;
    await cubit(100, 200);
    const z1 = (await posisiPeta(p))!;
    expect(Math.abs(z1.zoom - (awal.zoom + 1))).toBeLessThan(0.08);
    expect(Math.abs(z1.lat - awal.lat)).toBeLessThan(1e-4);
    expect(Math.abs(z1.lng - awal.lng)).toBeLessThan(1e-4);
    await cubit(240, 120);
    const z2 = (await posisiPeta(p))!;
    expect(Math.abs(z2.zoom - (z1.zoom - 1))).toBeLessThan(0.08);
    await cubit(150, 150, 120);
    const z3 = (await posisiPeta(p))!;
    expect(z3.lng).toBeLessThan(awal.lng - 1e-5); // dua jari bergeser bersama menggeser peta
    expect(Math.abs(z3.zoom - z2.zoom)).toBeLessThan(0.02);
    expect(await p.locator(".avz-titlebar").count()).toBe(1); // tidak pindah tab
    expect(await p.locator(".field-inspector-sheet").count()).toBe(0); // bukan ketukan memilih objek
  });

  expect(galat).toEqual([]);
  await tutup();
});

test("PC: roda tetikus memperbesar peta tanpa menggulir halaman", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(browser, { viewport: { width: 1280, height: 800 } });
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));
  await masukSebagaiAdmin(p);
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.waitForTimeout(1200);
  const kan = await kotak(p, "canvas.map-canvas");
  const zAwal = (await posisiPeta(p))!.zoom;
  const gulirAwal = await p.evaluate(() => window.scrollY);
  await p.mouse.move(kan.left + kan.width / 2, kan.top + kan.height / 2);
  await p.mouse.wheel(0, -120);
  await p.waitForTimeout(150);
  await p.mouse.wheel(0, -120);
  await p.waitForTimeout(600);
  expect(Math.abs((await posisiPeta(p))!.zoom - (zAwal + 1))).toBeLessThan(0.05);
  expect(await p.evaluate(() => window.scrollY)).toBe(gulirAwal);
  // Peta pas di layar (tanpa gulir) dan berada di samping menu navigasi PC, tidak tertutupinya
  expect((await kotak(p, ".map-canvas-container")).bottom).toBeLessThanOrEqual(800 + 0.5);
  expect((await kotak(p, ".map-canvas-container")).left).toBeGreaterThanOrEqual((await kotak(p, ".avenza-bottom-nav")).right - 0.5);
  expect(galat).toEqual([]);
  await tutup();
});

test("rekam titik lewat formulir: tersimpan dengan koordinat GPS dan muncul di peta", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(browser, {
    geolocation: { latitude: -1.61, longitude: 103.61, accuracy: 6 },
    permissions: ["geolocation"]
  });
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));
  await masukSebagaiAdmin(p);
  await p.locator(".avenza-nav-item", { hasText: "Mode User" }).click();
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  expect(await sampai(async () => /-1\.61/.test(await p.locator(".field-telemetry-coordinate").first().innerText()), 8000)).toBe(true);
  // Tombol pin besar: halaman "Pin dijatuhkan" di posisi bidikan (peta mengikuti GPS)
  await p.locator(".avz-fab-pin").click();
  await expect(p.getByRole("heading", { name: "Pin dijatuhkan" })).toBeVisible();
  await p.getByRole("button", { name: /^Biodiversitas/ }).click();
  await p.getByPlaceholder("Masukkan nama objek").fill("Pohon Meranti uji");
  await p.locator(".modal-form button[type=submit]").click();
  expect(await sampai(async () => /Pohon Meranti uji/.test(await teksToast(p)))).toBe(true);
  type Data = { judul: string; jenisGeometri: string; koordinat: { lat: number; lng: number; akurasi?: number }[] };
  const bacaData = () =>
    p.evaluate(
      () =>
        new Promise<Data[]>((ok) => {
          const r = indexedDB.open("geokader-db");
          r.onsuccess = () => {
            const g = r.result.transaction("kv").objectStore("kv").get("geokader_data_spasial_v5");
            g.onsuccess = () => ok(g.result ? JSON.parse(g.result) : []);
          };
        })
    );
  let titik: Data | undefined;
  // penulisan ke IndexedDB ditunda sesaat setelah perubahan
  await sampai(async () => (titik = (await bacaData()).find((d) => d.judul === "Pohon Meranti uji")) !== undefined);
  expect(titik?.jenisGeometri).toBe("point");
  expect(Math.abs(titik!.koordinat[0].lat + 1.61)).toBeLessThan(1e-4);
  expect(titik!.koordinat[0].akurasi).toBe(6);
  // ketuk titik di tengah peta: kartu detail objek terbuka
  const kan = await kotak(p, "canvas.map-canvas");
  await p.mouse.click(kan.left + kan.width / 2, kan.top + kan.height / 2);
  expect(await sampai(async () => /Pohon Meranti uji/.test(await p.locator(".field-inspector-sheet").innerText()))).toBe(true);

  // perbarui kondisi: objek yang baru dibuat belum boleh diperbarui (jeda 24 jam), isian tetap ada
  await p.getByPlaceholder("Kondisi terbaru...").fill("Daun menguning");
  await p.getByRole("button", { name: "Simpan pembaruan" }).click();
  expect(await sampai(async () => /baru dibuat/.test(await teksToast(p)))).toBe(true);
  expect(await p.getByPlaceholder("Kondisi terbaru...").inputValue()).toBe("Daun menguning");

  // navigasi Go-To ke objek
  await p.getByRole("button", { name: "Navigasi", exact: true }).click();
  expect(await sampai(async () => /Pohon Meranti uji/.test(await p.locator(".goto-nav-banner").innerText()))).toBe(true);
  expect(galat).toEqual([]);
  await tutup();
});

test("unduh area offline dari penyedia tile berlisensi: tile tersimpan dan area muncul di Pustaka", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(browser);
  let dimintaJaringan = 0;
  // penyedia tile uji (bundel e2e memasangnya lewat VITE_TILE_URL_OSM dengan izin unduh)
  await p.context().route(/tile\.uji\.example/, (r) => {
    dimintaJaringan++;
    return r.fulfill({ status: 200, contentType: "image/png", body: PNG, headers: { "access-control-allow-origin": "*" } });
  });
  await p
    .context()
    .route(/tiles\.maps\.eox\.at|ibasemaps-api\.arcgis\.com|tile\.googleapis\.com|maps\.gstatic\.com/, (r) =>
      r.fulfill({ status: 404, body: "" })
    );
  await masukSebagaiAdmin(p, URL_APP_KUNCI);
  await p.locator(".avenza-nav-item", { hasText: "Mode User" }).click();
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.locator(".avz-quick-basemap-btn").click();
  await p.locator(".map-basemap-Option", { hasText: "OSM" }).click();
  expect(await p.locator("#atribusi-peta").innerText()).toMatch(/penyedia tile uji/);
  // Lapisan peta → menu titik tiga lapisan → Unduh area offline
  await p.getByRole("button", { name: "Lapisan peta" }).click();
  await p.getByRole("button", { name: "Menu lapisan" }).click();
  await p.getByRole("menuitem", { name: "Unduh area offline" }).click();

  await p.getByPlaceholder("Masukkan nama area").fill("Wilayah Uji Offline");
  await p.locator("#zoom-min-unduh").selectOption({ index: 0 });
  const perkiraan = await p.locator("#perkiraan-unduh").innerText();
  const jumlah = Number(perkiraan.match(/^([\d.]+) tile/)![1].replace(/\./g, ""));
  expect(jumlah).toBeGreaterThan(0);
  const sebelum = dimintaJaringan;
  await p.getByRole("button", { name: /Unduh Sekarang/ }).click();
  expect(await sampai(async () => (await p.getByText("Unduh Peta Offline").count()) === 0, 30_000)).toBe(true);
  expect(dimintaJaringan - sebelum).toBeGreaterThanOrEqual(1);
  const tersimpan = await p.evaluate(async () => (await (await caches.open("geokader-tiles-v1")).keys()).length);
  // Tembolok juga berisi tile yang sempat tampil di layar (simpan otomatis), jadi minimal sejumlah perkiraan
  expect(tersimpan).toBeGreaterThanOrEqual(jumlah);

  // Peta layar penuh: keluar lewat tombol kembali di bilah judul, lalu buka Pustaka
  await p.locator(".avz-titlebar").getByRole("button", { name: "Kembali" }).click();
  await p.locator(".avenza-nav-item", { hasText: "Pustaka" }).click();
  expect(await sampai(async () => (await p.getByRole("button", { name: "Buka peta Wilayah Uji Offline" }).count()) === 1)).toBe(true);
  expect(galat).toEqual([]);
  await tutup();
});

test("Satelit Google lewat Map Tiles API resmi (jaringan Google ditiru) dan Satelit Esri", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(browser);
  const minta = { sesi: [] as { u: string; body: string | null }[], tile: [] as string[], viewport: [] as string[] };
  await p.context().route(/tile\.googleapis\.com/, async (r) => {
    const u = r.request().url();
    if (/createSession/.test(u)) {
      minta.sesi.push({ u, body: r.request().postData() });
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: "SESI-UJI",
          expiry: String(Math.floor(Date.now() / 1000) + 14 * 86400),
          tileWidth: 256,
          tileHeight: 256
        })
      });
    }
    if (/\/tile\/v1\/viewport/.test(u)) {
      minta.viewport.push(u);
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ copyright: "Imagery ©2026 Airbus, Maxar Technologies" })
      });
    }
    if (/\/v1\/2dtiles\//.test(u)) {
      minta.tile.push(u);
      return r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG });
    }
    return r.fulfill({ status: 404, body: "" });
  });
  await p.context().route(/maps\.gstatic\.com/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p
    .context()
    .route(/tiles\.maps\.eox\.at|ibasemaps-api\.arcgis\.com|tile\.openstreetmap\.org/, (r) =>
      r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG })
    );
  await masukSebagaiAdmin(p, URL_APP_KUNCI);
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  // Peta dasar bawaan adalah Satelit Esri; pilih Google Satelit dari pemilih peta dasar
  await p.locator(".avz-quick-basemap-btn").click();
  await p.locator(".map-basemap-Option", { hasText: "Google Satelit" }).click();

  expect(await sampai(async () => /Maxar/.test(await p.locator("#atribusi-peta").innerText()), 8000)).toBe(true);
  expect(await p.locator("#atribusi-peta img.map-logo-google").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(
    true
  );
  expect(minta.sesi).toHaveLength(1);
  expect(JSON.parse(minta.sesi[0].body!).mapType).toBe("satellite");
  expect(minta.sesi[0].u).toMatch(/key=kunci-uji-google/);
  expect(minta.tile.length).toBeGreaterThan(0);
  expect(minta.tile.every((u) => /session=SESI-UJI/.test(u))).toBe(true);
  const kan = await kotak(p, "canvas.map-canvas");
  const maksTile = (Math.floor(kan.width / 256) + 2) * (Math.floor(kan.height / 256) + 2);
  expect(minta.tile.length).toBeLessThanOrEqual(maksTile); // hanya tile yang tampil
  expect(minta.viewport[0]).toMatch(/north=/);

  // Catatan ketentuan Google tampil di halaman Info peta
  await p.getByRole("button", { name: "Info Peta" }).click();
  expect(await p.locator("#info-lisensi-peta").innerText()).toMatch(/menjiplak/);
  await p.keyboard.press("Escape");
  await p.locator(".avz-quick-basemap-btn").click();
  const pilihan = await p.locator(".map-basemap-Option").allInnerTexts();
  expect(pilihan.join("|")).toMatch(/Satelit Esri.*Google Satelit.*Citra Satelit/);
  expect(pilihan.some((t) => /Kontur Taktis/.test(t))).toBe(false);
  await p.locator(".map-basemap-Option", { hasText: "Satelit Esri" }).click();
  await p.waitForTimeout(800);
  expect(await p.locator("#atribusi-peta").innerText()).toMatch(/Powered by Esri/);
  await p.reload();
  expect(await sampai(async () => (await p.locator("#pin-buka").count()) === 1)).toBe(true);
  await p.locator("#pin-buka").fill(PIN);
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  expect(await sampai(async () => /Powered by Esri/.test(await p.locator("#atribusi-peta").innerText()))).toBe(true);
  expect(galat).toEqual([]);
  await tutup();
});

test("tanpa kunci API: Esri publik jadi bawaan, tidak ada permintaan ke Google Map Tiles API", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(browser);
  const keGoogle: string[] = [];
  await p.context().route(/googleapis|gstatic/, (r) => {
    keGoogle.push(r.request().url());
    return r.abort();
  });
  await p.context().route(RUTE_TILE_PUBLIK, (r) => r.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }));
  await masukSebagaiAdmin(p, URL_APP);
  await p.locator(".avenza-nav-item", { hasText: "Temukan" }).click();
  await p.waitForTimeout(1500);
  expect(await p.locator("#atribusi-peta").innerText()).toMatch(/Powered by Esri/);
  await p.locator(".avz-quick-basemap-btn").click();
  const pilihan = await p.locator(".map-basemap-Option").allInnerTexts();
  expect(pilihan.some((t) => /Kontur Taktis/.test(t))).toBe(false);
  await p.locator(".map-basemap-Option", { hasText: "Citra Satelit" }).click();
  await p.waitForTimeout(500);
  expect(await p.locator("#atribusi-peta").innerText()).not.toMatch(/Powered by Esri/);
  expect(keGoogle).toEqual([]);
  expect(galat).toEqual([]);
  await tutup();
});
