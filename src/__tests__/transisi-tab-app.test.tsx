// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import App from "../App";
import { AkunSesi, bersihkanAkunSetelahTes, simpanSesiPengguna } from "../lib/auth";
import { bukaAplikasi, kunciAplikasi } from "../lib/kunciAplikasi";
import { kunciGerbangAdmin } from "../lib/gerbangAdmin";
import { setelUlangPenyimpananUntukUji } from "../lib/penyimpanan";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function tungguTransisi(ms = 260) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe("Transisi Halus Antar Tab di App.tsx (Framer Motion)", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    setelUlangPenyimpananUntukUji();
    bersihkanAkunSetelahTes();
    localStorage.clear();
    sessionStorage.clear();
    kunciAplikasi();
    kunciGerbangAdmin();

    if (typeof window.matchMedia !== "function") {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn()
        }))
      });
    }

    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const stubCtx = new Proxy(
      {
        measureText: vi.fn(() => ({ width: 20 })),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
      } as Record<string, unknown>,
      {
        get(target, prop: string) {
          if (prop in target) return target[prop];
          const fn = vi.fn();
          target[prop] = fn;
          return fn;
        },
        set(target, prop: string, value: unknown) {
          target[prop] = value;
          return true;
        }
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(stubCtx as unknown as CanvasRenderingContext2D);

    const sesiUji: AkunSesi = {
      idKader: "KDR-TRANSISI-01",
      nama: "Kader Transisi",
      email: "kader.transisi@titiktapak.id",
      peran: "kader",
      desaWilayah: "Long Bawan",
      noHp: "081200009999",
      kelompokMasyarakat: "KTH Uji",
      namaOrganisasi: "Titik Tapak",
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(
      "geokader_accounts_v5",
      JSON.stringify([
        {
          ...sesiUji,
          kataSandi: "hash-uji",
          totpDilewati: true,
          pinHash: "pin-hash-uji"
        }
      ])
    );
    simpanSesiPengguna(sesiUji);
    localStorage.setItem(
      "geokader_verifikasi_totp_v1",
      JSON.stringify({ email: sesiUji.email, pada: Date.now() })
    );
    bukaAplikasi(sesiUji.email);

    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    kunciAplikasi();
    kunciGerbangAdmin();
    bersihkanAkunSetelahTes();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("merender panggung transisi Framer Motion dan mengubah arah transisi sesuai urutan tab saat berpindah", async () => {
    root = createRoot(container);
    await act(async () => {
      root!.render(<App />);
    });

    // Awal masuk di tab Peta
    const panggungAwal = container.querySelector(".tab-transition-stage") as HTMLElement | null;
    expect(panggungAwal).not.toBeNull();
    expect(panggungAwal?.getAttribute("data-tab-aktif")).toBe("peta");

    // Indikator aktif bergeser hadir di tombol navigasi Peta
    const tombolAktifAwal = container.querySelector(".avenza-nav-item.active");
    expect(tombolAktifAwal?.textContent).toContain("Peta");
    expect(tombolAktifAwal?.querySelector(".avenza-nav-active-pill")).not.toBeNull();

    // Pindah maju ke kanan: Peta -> Sertifikat (reward)
    const tombolSertifikat = Array.from(container.querySelectorAll(".avenza-nav-item")).find((b) =>
      b.textContent?.includes("Sertifikat")
    ) as HTMLButtonElement | undefined;
    expect(tombolSertifikat).toBeDefined();

    await act(async () => {
      tombolSertifikat!.click();
    });
    await tungguTransisi();

    const panggungReward = container.querySelector('.tab-transition-stage[data-tab-aktif="reward"]') as HTMLElement | null;
    expect(panggungReward).not.toBeNull();
    expect(panggungReward?.getAttribute("data-arah-transisi")).toBe("kanan");
    expect(tombolSertifikat!.querySelector(".avenza-nav-active-pill")).not.toBeNull();

    // Pindah mundur ke kiri: Sertifikat -> Pustaka
    const tombolPustaka = Array.from(container.querySelectorAll(".avenza-nav-item")).find((b) =>
      b.textContent?.includes("Pustaka")
    ) as HTMLButtonElement | undefined;
    expect(tombolPustaka).toBeDefined();

    await act(async () => {
      tombolPustaka!.click();
    });
    await tungguTransisi();

    const panggungPustaka = container.querySelector('.tab-transition-stage[data-tab-aktif="pustaka"]') as HTMLElement | null;
    expect(panggungPustaka).not.toBeNull();
    expect(panggungPustaka?.getAttribute("data-arah-transisi")).toBe("kiri");
    expect(tombolPustaka!.querySelector(".avenza-nav-active-pill")).not.toBeNull();
  });

  it("menjaga overflow-x: clip dan dukungan reducedMotion agar transisi tetap bersih tanpa scrollbar horizontal", () => {
    const appCode = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
    const cssApp = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

    expect(appCode).toContain("AnimatePresence");
    expect(appCode).toContain('MotionConfig reducedMotion="user"');
    expect(appCode).toContain("VARIAN_TRANSISI_TAB");
    expect(cssApp).toContain("overflow-x: clip;");
    expect(cssApp).toContain(".tab-transition-stage");
    expect(cssApp).toContain(".avenza-nav-active-pill");
  });
});
