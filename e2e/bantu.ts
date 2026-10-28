import { readFileSync } from "node:fs";
import { createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Browser, BrowserContextOptions, Page, expect } from "@playwright/test";

/** Build tanpa kunci peta (dist/) dan build mode e2e dengan kunci API palsu (dist-e2e/) */
export const URL_APP = "http://localhost:4173/";
export const URL_APP_KUNCI = "http://localhost:4175/";
export const SANDI = "RimbaHijau-2026";
export const PIN = "482915";

/** Tile 1x1 piksel untuk meniru penyedia peta tanpa jaringan */
export const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64"
);
export const PNG = readFileSync(fileURLToPath(new URL("../public/favicon-48.png", import.meta.url)));
export const RUTE_TILE_PUBLIK = /tiles\.maps\.eox\.at|tile\.openstreetmap\.org|tile\.opentopomap\.org/;

/** Menunggu sampai fn bernilai benar (galat dianggap belum), mengembalikan false bila waktu habis */
export async function sampai(fn: () => Promise<boolean> | boolean, ms = 10_000): Promise<boolean> {
  const mulai = Date.now();
  while (Date.now() - mulai < ms) {
    try {
      if (await fn()) return true;
    } catch {
      // belum siap
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

function base32(s: string): Buffer {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let v = 0;
  const out: number[] = [];
  for (const c of s.replace(/\s+/g, "")) {
    v = (v << 5) | A.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((v >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Kode TOTP RFC 6238 (SHA-1, 6 digit, 30 detik), dihitung terpisah dari implementasi aplikasi */
export function totp(rahasia: string, ms: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(ms / 30_000)));
  const h = createHmac("sha1", base32(rahasia)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6;
  return String(n).padStart(6, "0");
}

export interface Halaman {
  p: Page;
  galat: string[];
  tutup: () => Promise<void>;
}

/**
 * Konteks baru dengan jam aplikasi yang bisa dimajukan (sessionStorage.__off, tetap berlaku setelah
 * muat ulang) dan pengumpul galat JavaScript. hurufBesar meniru ukuran huruf HP yang diperbesar.
 */
export async function halamanBaru(browser: Browser, opsi: BrowserContextOptions = {}, hurufBesar = false): Promise<Halaman> {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, ...opsi });
  await ctx.addInitScript(() => {
    const asli = Date.now.bind(Date);
    Date.now = () => asli() + Number(sessionStorage.getItem("__off") || 0);
  });
  if (hurufBesar) {
    await ctx.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "html { font-size: 130% !important; }";
        document.head.appendChild(s);
      });
    });
  }
  const p = await ctx.newPage();
  const galat: string[] = [];
  p.on("pageerror", (e) => galat.push(e.message));
  p.on("dialog", (d) => void d.accept());
  return { p, galat, tutup: () => ctx.close() };
}

export const offsetJam = async (p: Page) => Number(await p.evaluate(() => sessionStorage.getItem("__off") || 0));

/** Memajukan jam aplikasi (berlaku setelah muat ulang atau pemeriksaan kunci berikutnya) */
export async function majukanJam(p: Page, detik: number): Promise<void> {
  const off = (await offsetJam(p)) + detik * 1000;
  await p.evaluate((v) => sessionStorage.setItem("__off", String(v)), off);
}

/** Kode Authenticator berikutnya menurut jam aplikasi (jam dimajukan satu langkah agar kode tidak terpakai ulang) */
export async function kodeBerikutnya(p: Page, rahasia: string): Promise<string> {
  await majukanJam(p, 31);
  return totp(rahasia, Date.now() + (await offsetJam(p)));
}

export const terkunci = async (p: Page) => (await p.locator(".layar-kunci").count()) === 1;

/** Teks toast yang sedang tampil, atau "" bila tidak ada */
export async function teksToast(p: Page): Promise<string> {
  const t = p.locator(".avenza-toast");
  return (await t.count()) ? ((await t.first().textContent()) ?? "") : "";
}

/** Membuat PIN di layar "Amankan GeoKader" (sidik jari tidak diaktifkan) */
export async function buatPin(p: Page, pin = PIN): Promise<void> {
  expect(await sampai(async () => (await p.locator("#form-siapkan-pin").count()) === 1)).toBe(true);
  await p.locator("#pin-baru").fill(pin);
  await p.locator("#pin-ulang").fill(pin);
  if (await p.locator(".verifikasi-centang input").count()) await p.locator(".verifikasi-centang input").uncheck();
  await p.locator("#form-siapkan-pin button[type=submit]").click();
  expect(await sampai(async () => !(await terkunci(p)))).toBe(true);
}

/**
 * Penyiapan Administrator pertama lewat antarmuka sampai layar pembuatan PIN, termasuk memasang
 * Google Authenticator dari kunci yang ditampilkan. Mengembalikan rahasia TOTP.
 */
export async function siapkanAdmin(p: Page, url = URL_APP, nama = "Siti Rahmawati", email = "siti.admin@contoh.id"): Promise<string> {
  await p.goto(url);
  expect(await sampai(async () => (await p.locator("#form-setup-admin").count()) === 1)).toBe(true);
  const f = p.locator("#form-setup-admin");
  await f.getByPlaceholder("Nama lengkap").fill(nama);
  await f.getByPlaceholder("Alamat email").fill(email);
  await f.getByPlaceholder("Nama desa/wilayah").fill("Desa Rimba Hijau");
  await f.getByPlaceholder("Nomor telepon").fill("0812");
  await f.locator("input[type=password]").nth(0).fill(SANDI);
  await f.locator("input[type=password]").nth(1).fill(SANDI);
  await f.locator("button[type=submit]").click();
  expect(await sampai(async () => (await p.locator("#kunci-totp").count()) === 1)).toBe(true);
  const rahasia = (await p.locator("#kunci-totp").innerText()).replace(/\s+/g, "");
  await p.locator("#kode-konfirmasi-totp").fill(totp(rahasia, Date.now() + (await offsetJam(p))));
  await p.locator("#form-daftar-totp button[type=submit]").click();
  expect(await sampai(async () => (await p.locator("#panel-kode-pemulihan").count()) === 1)).toBe(true);
  await p.locator("#kode-sudah-disimpan").check();
  await p.locator("#lanjut-setelah-pemulihan").click();
  return rahasia;
}

/** Admin pertama lengkap dengan PIN, lalu menunggu toast sambutan hilang */
export async function masukSebagaiAdmin(p: Page, url = URL_APP, nama?: string): Promise<string> {
  const rahasia = await siapkanAdmin(p, url, nama);
  await buatPin(p);
  await p.waitForTimeout(3500);
  return rahasia;
}

/** Masuk dengan email, sandi, dan kode Authenticator lewat halaman masuk */
export async function masuk(p: Page, email: string, sandi: string, rahasia: string): Promise<void> {
  await p.getByPlaceholder("Masukkan alamat email").fill(email);
  await p.getByPlaceholder("Masukkan kata sandi").fill(sandi);
  await p.getByRole("button", { name: "Lanjut" }).click();
  expect(await sampai(async () => (await p.locator("#form-kode-totp").count()) === 1)).toBe(true);
  await p.locator("#kode-totp").fill(await kodeBerikutnya(p, rahasia));
  await p.locator("#form-kode-totp button[type=submit]").click();
}

/** Akun siap pakai untuk disemai langsung ke penyimpanan (sandi di-hash seperti aplikasi, iterasi rendah) */
export function akunSemai(data: {
  idKader: string;
  nama: string;
  email: string;
  peran: "admin" | "kader";
  sandi: string;
  totpRahasia: string;
}) {
  const garam = randomBytes(16);
  const hash = pbkdf2Sync(data.sandi.normalize("NFKC"), garam, 1000, 32, "sha256");
  return {
    idKader: data.idKader,
    nama: data.nama,
    email: data.email,
    peran: data.peran,
    desaWilayah: "Desa A",
    noHp: "-",
    kelompokMasyarakat: "-",
    namaOrganisasi: "Sertifikat Kader Pemetaan Partisipatif",
    createdAt: "2026-10-01T00:00:00.000Z",
    kataSandiHash: hash.toString("base64"),
    garam: garam.toString("base64"),
    iterasi: 1000,
    totpRahasia: data.totpRahasia,
    kodePemulihanHash: []
  };
}

/** Menu titik tiga lalu pilih item */
export async function pilihMenu(p: Page, teks: string | RegExp): Promise<void> {
  await p.getByRole("button", { name: /Menu/ }).first().click();
  await p.locator(".avenza-overflow-item", { hasText: teks }).click();
}

export async function kotak(p: Page, selektor: string) {
  return p
    .locator(selektor)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    });
}

export const posisiPeta = (p: Page) =>
  p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("geokader_posisi_peta_v1") || "null") as {
        lat: number;
        lng: number;
        zoom: number;
        basemap: string;
      } | null
  );
