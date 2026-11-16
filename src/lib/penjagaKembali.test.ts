// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATAS_WAKTU_KEMBALI_MS,
  KUNCI_STATE_DASAR,
  KUNCI_STATE_PENJAGA,
  daftarkanPenutupLapisan,
  pasangPenjagaKembali,
  pastikanRiwayatPenjaga
} from "./penjagaKembali";

describe("penjagaKembali", () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;
  let replaceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/");
    pushSpy = vi.spyOn(window.history, "pushState");
    replaceSpy = vi.spyOn(window.history, "replaceState");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("memasang entri riwayat penjaga secara idempoten (aman untuk React StrictMode)", () => {
    expect(pastikanRiwayatPenjaga()).toBe(true);
    expect(window.history.state).toEqual({ [KUNCI_STATE_PENJAGA]: true });
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy.mock.calls[0]?.[0]).toMatchObject({ [KUNCI_STATE_DASAR]: true });
    expect(pushSpy).toHaveBeenCalledTimes(1);

    // Pemanggilan kedua tidak menambah entri ganda
    expect(pastikanRiwayatPenjaga()).toBe(false);
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("menunda pushState sampai ada interaksi pengguna jika userActivation belum aktif agar Chromium tidak melewati entri dasar", () => {
    const uaMock = { hasBeenActive: false, isActive: false };
    Object.defineProperty(window.navigator, "userActivation", {
      value: uaMock,
      configurable: true
    });

    const lepas = pasangPenjagaKembali({ onPeringatanKeluar: vi.fn() });
    // Saat mount tanpa aktivasi pengguna: tidak merusak entri dasar dengan pushState dini
    expect(pushSpy).not.toHaveBeenCalled();

    // Pengguna mengetuk layar -> userActivation menjadi aktif -> penjaga langsung dipasang
    uaMock.hasBeenActive = true;
    uaMock.isActive = true;
    window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(window.history.state).toEqual({ [KUNCI_STATE_PENJAGA]: true });

    lepas();
    delete (window.navigator as unknown as { userActivation?: unknown }).userActivation;
  });

  it("menampilkan peringatan pada Back ke-1, membiarkan keluar pada Back ke-2 dalam 2 detik, dan mereset setelah lewat 2 detik", () => {
    const peringatan = vi.fn();
    const lepas = pasangPenjagaKembali({ onPeringatanKeluar: peringatan });

    pushSpy.mockClear();

    // Tekan Back ke-1 -> sentinel terlepas (state kembali ke dasar)
    window.history.replaceState({ [KUNCI_STATE_DASAR]: true }, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { [KUNCI_STATE_DASAR]: true } }));
    expect(peringatan).toHaveBeenCalledTimes(1);
    // Tidak langsung pushState selama jendela 2 detik agar Back ke-2 bisa langsung keluar
    expect(pushSpy).not.toHaveBeenCalled();

    // Tunggu lewat 2 detik tanpa Back ke-2 -> jendela reset dan penjaga dipasang ulang
    vi.advanceTimersByTime(BATAS_WAKTU_KEMBALI_MS + 10);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(window.history.state).toEqual({ [KUNCI_STATE_PENJAGA]: true });

    // Tekan Back lagi setelah lewat batas waktu -> dianggap Back ke-1 baru (peringatan ke-2), bukan keluar
    window.history.replaceState({ [KUNCI_STATE_DASAR]: true }, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { [KUNCI_STATE_DASAR]: true } }));
    expect(peringatan).toHaveBeenCalledTimes(2);
    expect(pushSpy).toHaveBeenCalledTimes(1);

    // Tekan Back ke-2 DALAM 2 detik -> dibiarkan keluar (tidak memicu peringatan ke-3 maupun pushState)
    vi.advanceTimersByTime(500);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    expect(peringatan).toHaveBeenCalledTimes(2);
    expect(pushSpy).toHaveBeenCalledTimes(1);

    lepas();
  });

  it("menutup panel anak terlebih dahulu (termasuk tumpukan LIFO) lalu memasang ulang penjaga", () => {
    let formTerbuka = true;
    let modalAppTerbuka = true;
    const peringatan = vi.fn();
    const lepasAnak = daftarkanPenutupLapisan(() => {
      if (!formTerbuka) return false;
      formTerbuka = false;
      return true;
    });
    const lepas = pasangPenjagaKembali({
      onTutupLapisanTeratas: () => {
        if (!modalAppTerbuka) return false;
        modalAppTerbuka = false;
        return true;
      },
      onPeringatanKeluar: peringatan
    });

    pushSpy.mockClear();

    // Back 1: tutup lapisan anak (FormSurveiModal) terlebih dahulu
    window.history.replaceState({ [KUNCI_STATE_DASAR]: true }, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { [KUNCI_STATE_DASAR]: true } }));
    expect(formTerbuka).toBe(false);
    expect(modalAppTerbuka).toBe(true);
    expect(peringatan).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(1);

    // Back 2: tutup modal App
    window.history.replaceState({ [KUNCI_STATE_DASAR]: true }, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { [KUNCI_STATE_DASAR]: true } }));
    expect(modalAppTerbuka).toBe(false);
    expect(peringatan).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(2);

    // Back 3: semua lapisan sudah tertutup -> baru tampilkan peringatan keluar
    window.history.replaceState({ [KUNCI_STATE_DASAR]: true }, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { [KUNCI_STATE_DASAR]: true } }));
    expect(peringatan).toHaveBeenCalledTimes(1);

    lepasAnak();
    lepas();
  });
});
