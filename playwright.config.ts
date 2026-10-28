import { defineConfig } from "@playwright/test";

/**
 * Uji browser (Playwright, Chromium) terhadap bundel produksi.
 * Jalankan dengan `npm run test:e2e`: skrip itu membangun dua bundel lalu menjalankan tes ini.
 * - dist/     : build biasa (tanpa kunci peta), port 4173
 * - dist-e2e/ : build mode e2e (.env.e2e berisi kunci API palsu untuk Satelit Google/Esri), port 4175
 * Tes memakai alamat localhost (bukan 127.0.0.1) karena WebAuthn menolak alamat IP.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "line" : [["list"]],
  use: {
    browserName: "chromium",
    // Lingkungan dengan Chromium terpasang di lokasi lain dapat menunjuknya lewat PW_CHROMIUM_PATH
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
  },
  webServer: [
    {
      command: "npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "npx vite preview --host 127.0.0.1 --port 4175 --strictPort --outDir dist-e2e",
      url: "http://127.0.0.1:4175/",
      reuseExistingServer: !process.env.CI
    }
  ]
});
