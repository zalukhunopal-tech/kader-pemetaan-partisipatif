import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function pwaMobileRefreshPlugin(): Plugin {
  return {
    name: "pwa-mobile-refresh",
    closeBundle: {
      order: "post",
      handler() {
        const swPath = path.resolve(process.cwd(), "dist", "sw.js");
        if (fs.existsSync(swPath)) {
          const swContent = fs.readFileSync(swPath, "utf8");
          const forceRefreshSnippet = `\n;self.addEventListener("activate",function(event){event.waitUntil((async function(){try{await self.clients.claim();var clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});for(var i=0;i<clients.length;i++){var c=clients[i];if(c&&"navigate" in c&&c.url){try{await c.navigate(c.url);}catch(_){}}}}catch(_){}})());});\n`;
          if (!swContent.includes("includeUncontrolled:true")) {
            fs.writeFileSync(swPath, swContent + forceRefreshSnippet, "utf8");
          }
        }
      }
    }
  };
}

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
        name: "Titik Tapak: Survei & Pemetaan Partisipatif",
        short_name: "Titik Tapak",
        description:
          "Aplikasi survei keanekaragaman hayati & pemetaan partisipatif kader masyarakat (Offline-First GIS, Google Drive Sync, Sertifikat Kader)",
        lang: "id",
        dir: "ltr",
        theme_color: "#042f2e",
        background_color: "#061411",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
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
          { src: "screenshot-pc.jpg", sizes: "1280x800", type: "image/jpeg", form_factor: "wide", label: "Titik Tapak di tablet dan PC" }
        ],
        shortcuts: [
          { name: "Peta", short_name: "Peta", url: "./?tab=peta", icons: [{ src: "icon-192.png", sizes: "192x192" }] },
          { name: "Pustaka", short_name: "Pustaka", url: "./?tab=pustaka", icons: [{ src: "icon-192.png", sizes: "192x192" }] },
          { name: "Sinkronisasi", short_name: "Sinkron", url: "./?tab=data_sync", icons: [{ src: "icon-192.png", sizes: "192x192" }] }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,ico,json,webp,mp4,gif}"],
        // Tangkapan layar hanya untuk dialog pemasangan, tidak perlu disimpan untuk offline
        globIgnores: ["**/screenshot-*"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      }
    }),
    pwaMobileRefreshPlugin()
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    hmr: false
  }
});
