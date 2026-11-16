// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATAS_WAKTU_KEMBALI_MS,
  KUNCI_STATE_DASAR,
  KUNCI_STATE_PENJAGA,
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

  it("menutup panel anak terlebih dahulu jika masih terbuka lalu memasang ulang penjaga", () => {
    let modalTerbuka = true;
    const peringatan = vi.fn();
    const lepas = pasangPenjagaKembali({
      onTutupLapisanTeratas: () => {
        if (!modalTerbuka) return false;
        modalTerbuka = false;
        return true;
      },
      onPeringatanKeluar: peringatan
    });

    pushSpy.mockClear();

    // Tekan Back saat modal terbuka -> tutup modal, pasang ulang penjaga, tanpa peringatan keluar
    window.history.replaceState({ [KUNCI_STATE_DASAR]: true }, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { [KUNCI_STATE_DASAR]: true } }));
    expect(modalTerbuka).toBe(false);
    expect(peringatan).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(window.history.state).toEqual({ [KUNCI_STATE_PENJAGA]: true });

    // Tekan Back setelah modal tertutup -> baru tampilkan peringatan keluar
    window.history.replaceState({ [KUNCI_STATE_DASAR]: true }, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { [KUNCI_STATE_DASAR]: true } }));
    expect(peringatan).toHaveBeenCalledTimes(1);

    lepas();
  });
});
