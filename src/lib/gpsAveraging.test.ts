import { afterEach, describe, expect, it, vi } from "vitest";
import { ambilRataRataGps } from "./posisiPerangkat";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const posisi = (timestamp: number, accuracy = 4): GeolocationPosition =>
  ({
    timestamp,
    coords: { latitude: -2, longitude: 102, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null }
  }) as unknown as GeolocationPosition;
function pasangGps() {
  let callback: ((p: GeolocationPosition) => void) | undefined;
  const clearWatch = vi.fn();
  vi.stubGlobal("navigator", {
    geolocation: {
      watchPosition: (fn: (p: GeolocationPosition) => void) => {
        callback = fn;
        return 8;
      },
      clearWatch
    }
  });
  return { kirim: (p: GeolocationPosition) => callback!(p), clearWatch };
}

describe("sesi averaging GPS", () => {
  it("mengabaikan timestamp ganda dan GPS buruk; membersihkan watch setelah 10 detik", async () => {
    vi.useFakeTimers();
    const gps = pasangGps(),
      progres = vi.fn();
    const hasil = ambilRataRataGps({ progres });
    gps.kirim(posisi(1000));
    gps.kirim(posisi(1000));
    gps.kirim(posisi(2000, 80));
    gps.kirim(posisi(3000));
    gps.kirim(posisi(4000));
    await vi.advanceTimersByTimeAsync(10000);
    expect((await hasil).jumlahSampel).toBe(3);
    expect(progres).toHaveBeenCalledTimes(3);
    expect(gps.clearWatch).toHaveBeenCalledWith(8);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("abort menolak promise dan tidak meninggalkan watch/timer", async () => {
    vi.useFakeTimers();
    const gps = pasangGps(),
      abort = new AbortController();
    const hasil = ambilRataRataGps({ signal: abort.signal });
    const ditolak = expect(hasil).rejects.toMatchObject({ name: "AbortError" });
    abort.abort();
    await ditolak;
    expect(gps.clearWatch).toHaveBeenCalledWith(8);
    expect(vi.getTimerCount()).toBe(0);
  });
});
