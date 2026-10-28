import { defineConfig } from "vitest/config";

// Terpisah dari vite.config.ts agar tes tidak memuat plugin PWA
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
