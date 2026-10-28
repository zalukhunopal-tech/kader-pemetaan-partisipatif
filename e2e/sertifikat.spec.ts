import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import { PNG, URL_APP, akunSemai, buatPin, halamanBaru, kotak, masuk, masukSebagaiAdmin, pilihMenu, sampai } from "./bantu";

const RAHASIA_ADMIN = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const RAHASIA_SITI = "KRSXG5DSNFXGOIDUN5ZGK43FMQQHEZLC";
const SANDI_UJI = "Sungai-Batang-2026";
const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const titik = (idKader: string, namaKader: string, n: number, statusSinkron: string) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${idKader}-${statusSinkron}-${i}`,
    idKader,
    namaKader,
    desaWilayah: "Desa A",
    jenisGeometri: "point",
    kategori: "Flora",
    judul: "t",
    deskripsi: "",
    koordinat: [{ lat: -0.9, lng: 100.4 + i * 1e-5 }],
    panjangKm: 0,
    luasHa: 0,
    statusSinkron,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "",
    riwayatPembaruan: []
  }));

const bacaIdb = (p: import("@playwright/test").Page, kunci: string) =>
  p.evaluate(
    (k) =>
      new Promise<unknown>((ok) => {
        const r = indexedDB.open("geokader-db");
        r.onsuccess = () => {
          const g = r.result.transaction("kv").objectStore("kv").get(k);
          g.onsuccess = () => ok(g.result ? JSON.parse(g.result) : null);
        };
      }),
    kunci
  );

test("admin menerbitkan sertifikat atas nama kader yang berhak; QR di sertifikat kader terbaca", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(browser, { viewport: { width: 420, height: 900 } });
  // Akun dan data disemai sebelum aplikasi pertama kali dimuat (data spasial lalu dipindah ke IndexedDB)
  const semai = {
    akun: [
      akunSemai({
        idKader: "ADM-1",
        nama: "Siti Admin",
        email: "admin@contoh.id",
        peran: "admin",
        sandi: SANDI_UJI,
        totpRahasia: RAHASIA_ADMIN
      }),
      akunSemai({ idKader: "KDR-2", nama: "Siti", email: "siti@contoh.id", peran: "kader", sandi: SANDI_UJI, totpRahasia: RAHASIA_SITI })
    ],
    profil: {
      idKader: "KDR-1",
      nama: "Budi",
      desaWilayah: "Desa A",
      kelompokMasyarakat: "-",
      noHp: "-",
      namaOrganisasi: "Sertifikat Kader Pemetaan Partisipatif",
      modeKombinasiTarget: "per_kategori",
      logoSertifikatList: [{ id: "l1", nama: "Logo Uji", imageBase64: LOGO }]
    },
    data: [
      ...titik("KDR-1", "Budi", 50, "lokal"),
      ...titik("KDR-2", "Siti", 50, "terverifikasi"),
      ...titik("KDR-3", "Sari", 30, "terverifikasi")
    ]
  };
  await p.context().addInitScript((s) => {
    if (localStorage.getItem("__disemai")) return;
    localStorage.setItem("__disemai", "1");
    localStorage.setItem("geokader_accounts_v5", JSON.stringify(s.akun));
    localStorage.setItem("geokader_profil_v5", JSON.stringify(s.profil));
    localStorage.setItem("geokader_data_spasial_v5", JSON.stringify(s.data));
  }, semai);
  await p.goto(URL_APP);
  await masuk(p, "admin@contoh.id", SANDI_UJI, RAHASIA_ADMIN);
  await buatPin(p);
  let nomor = "";

  await test.step("admin: hanya kader dengan 50 titik terverifikasi yang siap terbit", async () => {
    await p.locator(".admin-subnav-btn", { hasText: "Sertifikat" }).click();
    expect(await sampai(async () => (await p.locator("#tabel-kader-sertifikat").count()) === 1)).toBe(true);
    const baris = await p.locator("#tabel-kader-sertifikat tbody tr").evaluateAll((rs) =>
      rs.map((r) => ({
        nama: r.querySelector("strong")!.textContent,
        status: r.querySelector(".badge-sync")!.textContent!.trim(),
        nonaktif: (r.querySelector("button") as HTMLButtonElement).disabled
      }))
    );
    expect(baris[0]).toEqual({ nama: "Siti", status: "SIAP TERBIT", nonaktif: false });
    expect(baris.find((b) => b.nama === "Budi")).toMatchObject({ status: "BELUM", nonaktif: true });
    expect(baris.find((b) => b.nama === "Sari")?.nonaktif).toBe(true);
    nomor = await p.locator("input.form-input").first().inputValue();
    expect(nomor).toMatch(/^0001\/SKPP-GIS\/WILAYAH\/[IVX]+\/\d{4}$/);
  });

  await test.step("admin menerbitkan untuk Siti: atas nama Siti, nomor otomatis, tidak bisa ganda", async () => {
    await p.locator("#tabel-kader-sertifikat tbody tr").first().locator("button").click();
    expect(await sampai(async () => ((await bacaIdb(p, "geokader_sertifikat_v5")) as unknown[] | null)?.length === 1)).toBe(true);
    const daftar = (await bacaIdb(p, "geokader_sertifikat_v5")) as { idKader: string; namaKader: string; nomorSertifikat: string }[];
    expect(daftar[0]).toMatchObject({ idKader: "KDR-2", namaKader: "Siti", nomorSertifikat: nomor });
    expect(await p.locator("input.form-input").first().inputValue()).toMatch(/^0002\//);
    expect(await p.locator("#tabel-kader-sertifikat tbody tr").first().locator("button").isDisabled()).toBe(true);
  });

  await test.step("Siti masuk: sertifikat terbit, tombol Unduh aktif, QR berisi nomor, ID, dan tanggal", async () => {
    await pilihMenu(p, "Keluar");
    expect(await sampai(async () => (await p.getByPlaceholder("Masukkan alamat email").count()) === 1)).toBe(true);
    await masuk(p, "siti@contoh.id", SANDI_UJI, RAHASIA_SITI);
    await buatPin(p);
    await p.locator(".avenza-nav-item", { hasText: "Sertifikat" }).click();
    expect(await sampai(async () => /sudah diterbitkan/.test((await p.locator("#status-sertifikat").textContent()) ?? ""))).toBe(true);
    expect(await p.getByText("Tersertifikasi").count()).toBeGreaterThan(0);
    expect(await p.locator(".sertifikat-unduh").isDisabled()).toBe(false);
    const daftar = (await bacaIdb(p, "geokader_sertifikat_v5")) as { tanggalTerbit: string }[];
    let isiQr: string | null = null;
    await sampai(async () => {
      const px = await p.evaluate(() => {
        const c = document.querySelector("canvas.certificate-wysiwyg-canvas") as HTMLCanvasElement;
        const d = c.getContext("2d")!.getImageData(1341, 521, 180, 180);
        return Array.from(d.data);
      });
      isiQr = jsQR(new Uint8ClampedArray(px), 180, 180)?.data ?? null;
      return isiQr !== null;
    });
    expect(isiQr).toBe(`GEOKADER|${nomor}|KDR-2|${daftar[0].tanggalTerbit}`);
  });

  expect(galat).toEqual([]);
  await tutup();
});

test("Sertifikat di HP dengan huruf besar: tombol rapi, kartu capaian tidak meluber, pratinjau bertanda air", async ({ browser }) => {
  const { p, galat, tutup } = await halamanBaru(
    browser,
    { viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.6 },
    true
  );
  await masukSebagaiAdmin(p, URL_APP, "Adrila Nopal Prastian Zalukhu");
  await p.locator(".avenza-nav-item", { hasText: "Mode User" }).click();
  await p.locator(".avenza-nav-item", { hasText: "Sertifikat" }).click();
  await p.waitForTimeout(1200);
  await p.locator("#aksi-sertifikat").scrollIntoViewIfNeeded();

  const ukurTombol = () =>
    p.locator(".sertifikat-aksi-baris .sertifikat-aksi-tombol").evaluateAll((bs) =>
      bs.map((x) => {
        const r = x.getBoundingClientRect();
        return { t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), l: r.left, r: r.right };
      })
    );
  const tombol = await ukurTombol();
  const kartu = await kotak(p, ".certificate-section-card");
  expect(tombol.length).toBeGreaterThanOrEqual(2);
  expect(tombol.every((x) => x.t === tombol[0].t && Math.abs(x.w - tombol[0].w) <= 1 && x.h === tombol[0].h)).toBe(true);
  expect(tombol.every((x) => x.l >= kartu.left && x.r <= kartu.right)).toBe(true);
  const unduh = await kotak(p, ".sertifikat-unduh");
  expect(unduh.top).toBeGreaterThan(tombol[0].t);
  expect(Math.abs(unduh.left - tombol[0].l)).toBeLessThanOrEqual(1);
  expect(Math.abs(unduh.right - tombol[tombol.length - 1].r)).toBeLessThanOrEqual(1);
  const kananCincin = await p.locator(".visual-ring-card").evaluateAll((cs) => cs.map((c) => c.getBoundingClientRect().right));
  expect(kananCincin.every((r) => r <= 360)).toBe(true);
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  // belum diterbitkan: pratinjau bertanda air "PRATINJAU" (piksel kemerahan di tengah kanvas)
  const merah = await p.evaluate(() => {
    const c = document.querySelector("canvas.certificate-wysiwyg-canvas") as HTMLCanvasElement;
    const g = c.getContext("2d")!;
    let n = 0;
    for (let x = 500; x < 1100; x += 6) {
      const d = g.getImageData(x, 480, 1, 1).data;
      if (d[0] > d[2] + 12) n++;
    }
    return n;
  });
  expect(merah).toBeGreaterThan(5);

  // dengan foto: Ganti Foto | Hapus Foto | Cetak tetap satu baris berukuran sama
  await p.locator('input[type=file][accept="image/*"]').first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  expect(await sampai(async () => (await p.locator(".sertifikat-aksi-tombol.bahaya").count()) === 1, 5000)).toBe(true);
  const tiga = await ukurTombol();
  expect(tiga).toHaveLength(3);
  expect(tiga.every((x) => x.t === tiga[0].t && Math.abs(x.w - tiga[0].w) <= 1 && x.h === tiga[0].h)).toBe(true);
  expect(galat).toEqual([]);
  await tutup();
});
