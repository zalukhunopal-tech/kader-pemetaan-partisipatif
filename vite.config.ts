import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Ikon PNG wajib untuk pemasangan di Android/Chrome dan iOS; SVG tetap dipakai sebagai favicon
      includeAssets: ["icon.svg", "favicon-48.png", "apple-touch-icon.png"],
      manifest: {
        id: "./",
        name: "GeoKader: Survei & Pemetaan Partisipatif",
        short_name: "GeoKader",
        description:
          "Aplikasi survei keanekaragaman hayati & pemetaan partisipatif kader masyarakat (Offline-First GIS, Google Drive Sync, Sertifikat Kader)",
        lang: "id",
        dir: "ltr",
        theme_color: "#064e3b",
        background_color: "#061411",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "any",
        start_url: "./",
        scope: "./",
        categories: ["productivity", "utilities", "education"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
        ],
        screenshots: [
          { src: "screenshot-hp.jpg", sizes: "540x1170", type: "image/jpeg", form_factor: "narrow", label: "Pustaka peta di HP" },
          { src: "screenshot-pc.jpg", sizes: "1280x800", type: "image/jpeg", form_factor: "wide", label: "GeoKader di tablet dan PC" }
        ],
        shortcuts: [
          { name: "Peta", short_name: "Peta", url: "./?tab=peta", icons: [{ src: "icon-192.png", sizes: "192x192" }] },
          { name: "Pustaka", short_name: "Pustaka", url: "./?tab=pustaka", icons: [{ src: "icon-192.png", sizes: "192x192" }] },
          { name: "Sinkronisasi", short_name: "Sinkron", url: "./?tab=data_sync", icons: [{ src: "icon-192.png", sizes: "192x192" }] }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
        // Tangkapan layar hanya untuk dialog pemasangan, tidak perlu disimpan untuk offline
        globIgnores: ["**/screenshot-*"]
      }
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 3000
  }
});
