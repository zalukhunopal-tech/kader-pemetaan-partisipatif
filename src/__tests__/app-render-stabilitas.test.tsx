// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../App";
import { bukaAplikasi, kunciAplikasi } from "../lib/kunciAplikasi";
import { bukaGerbangAdmin, kunciGerbangAdmin } from "../lib/gerbangAdmin";
import { simpanSesiPengguna } from "../lib/auth";

describe("Stabilitas Render App (bebas setState-in-render)", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    kunciAplikasi();
    kunciGerbangAdmin();
    container = document.createElement("div");
    document.body.appendChild(container);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    if (typeof window.matchMedia !== "function") {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
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
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("merender App awal tanpa peringatan setState-in-render di StrictMode", async () => {
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    });

    const pesanSetState = errorSpy.mock.calls
      .map((args: unknown[]) => args.map(String).join(" "))
      .filter((msg: string) => msg.includes("Cannot update a component"));

    expect(pesanSetState).toEqual([]);
  });

  it("tidak memicu peringatan Cannot update a component saat kunciAplikasi / gerbangAdmin kedaluwarsa di fase render", async () => {
    const email = "kader.uji@titiktapak.id";
    simpanSesiPengguna({
      idKader: "KDR-TEST-01",
      nama: "Kader Uji",
      email,
      peran: "kader",
      desaWilayah: "Desa Uji",
      noHp: "08123456789",
      kelompokMasyarakat: "Kelompok Uji",
      namaOrganisasi: "Titik Tapak",
      createdAt: new Date().toISOString()
    });

    // Buka aplikasi pada waktu sekarang, lalu majukan Date.now melewati batas diam (15 menit)
    const waktuAwal = Date.now();
    bukaAplikasi(email, waktuAwal);
    bukaGerbangAdmin(email, waktuAwal);

    root = createRoot(container);
    await act(async () => {
      root!.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    });

    // Majukan jam melebihi batas diam 15 menit lalu paksa re-render App
    vi.spyOn(Date, "now").mockReturnValue(waktuAwal + 20 * 60 * 1000);
    await act(async () => {
      root!.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    });

    const pesanSetState = errorSpy.mock.calls
      .map((args: unknown[]) => args.map(String).join(" "))
      .filter((msg: string) => msg.includes("Cannot update a component"));

    expect(pesanSetState).toEqual([]);
  });
});
