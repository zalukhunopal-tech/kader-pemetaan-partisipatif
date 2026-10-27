import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "GeoKader: Survei & Pemetaan Partisipatif",
        short_name: "GeoKader",
        description:
          "Aplikasi survei keanekaragaman hayati & pemetaan partisipatif kader masyarakat (Offline-First GIS, Google Drive Sync, Gamifikasi Sertifikat & HOK)",
        theme_color: "#064e3b",
        background_color: "#061411",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"]
      }
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 3000
  }
});
