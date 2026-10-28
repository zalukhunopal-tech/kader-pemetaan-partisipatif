// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ModulPerekam = typeof import("./perekamLatar");

const KUNCI = "kader_pemetaan_rekam_latar_v1";

/** GPS tiruan: menyimpan callback watchPosition agar tes bisa mengirim posisi atau galat */
function pasangGpsTiruan() {
  const gps = {
    sukses: null as ((p: GeolocationPosition) => void) | null,
    galat: null as ((e: GeolocationPositionError) => void) | null,
    opsi: null as PositionOptions | null,
    watch: vi.fn(),
    clear: vi.fn()
  };
  gps.watch.mockImplementation((s: (p: GeolocationPosition) => void, g: (e: GeolocationPositionError) => void, o: PositionOptions) => {
    gps.sukses = s;
    gps.galat = g;
    gps.opsi = o;
    return 7;
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition: gps.watch, clearWatch: gps.clear, getCurrentPosition: vi.fn() }
  });
  return gps;
}

function pasangWakeLockTiruan() {
  const lepas = vi.fn(async () => undefined);
  const minta = vi.fn(async () => ({ release: lepas }));
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: minta } });
  return { minta, lepas };
}

const posisi = (lat: number, lng: number, akurasi = 4, altitude: number | null = 412.6): GeolocationPosition =>
  ({
    coords: { latitude: lat, longitude: lng, accuracy: akurasi, altitude, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: Date.now()
  }) as unknown as GeolocationPosition;

const galatGps = (code: number): GeolocationPositionError =>
  ({ code, message: "", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError;

/** Modul dimuat ulang per tes (seperti aplikasi dibuka ulang): state modul kosong, localStorage tetap */
const dimuat: ModulPerekam[] = [];
async function muat(): Promise<ModulPerekam> {
  vi.resetModules();
  const m = await import("./perekamLatar");
  dimuat.push(m);
  return m;
}

const tunggu = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date(2026, 9, 28, 9, 0, 0));
});
afterEach(() => {
  // Modul lama tetap memasang pendengar visibilitychange di document yang sama: hentikan rekamannya
  dimuat.splice(0).forEach((m) => m.perekamLatar.batal());
  vi.useRealTimers();
});

describe("perekam latar: merekam dari GPS perangkat", () => {
  it("mulai: status merekam, GPS akurasi tinggi dipantau, wake lock diminta, dan tersimpan untuk dipulihkan", async () => {
    const gps = pasangGpsTiruan();
    const wl = pasangWakeLockTiruan();
    const { perekamLatar } = await muat();
    const awal = { lat: -1.6, lng: 103.6 };
    perekamLatar.mulai("line", [awal]);
    await tunggu();
    const s = perekamLatar.getState();
    expect(s.status).toBe("merekam");
    expect(s.jenis).toBe("line");
    expect(s.titik).toEqual([awal]);
    expect(s.autoGpsAktif).toBe(false); // simulasi mati secara bawaan
    expect(gps.watch).toHaveBeenCalledTimes(1);
    expect(gps.opsi).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
    expect(wl.minta).toHaveBeenCalledWith("screen");
    expect(JSON.parse(localStorage.getItem(KUNCI)!).status).toBe("merekam");
  });

  it("titik GPS: akurasi buruk dan getaran < 3 m diabaikan, titik sah ditambahkan dengan elevasi dibulatkan", async () => {
    const gps = pasangGpsTiruan();
    const { perekamLatar } = await muat();
    perekamLatar.mulai("line", []);
    gps.sukses!(posisi(-1.6, 103.6, 4));
    expect(perekamLatar.getState().titik).toHaveLength(1);
    expect(perekamLatar.getState().titik[0]).toMatchObject({ lat: -1.6, lng: 103.6, akurasi: 4, elevasi: 413 });

    gps.sukses!(posisi(-1.6001, 103.6, 75)); // ±75 m: terlalu lemah
    expect(perekamLatar.getState().titik).toHaveLength(1);
    expect(perekamLatar.getState().galat).toMatch(/lemah/);

    gps.sukses!(posisi(-1.60001, 103.6, 4)); // ±1 m dari titik terakhir: getaran
    expect(perekamLatar.getState().titik).toHaveLength(1);
    expect(perekamLatar.getState().posisiTerakhir?.lat).toBe(-1.60001);
    expect(perekamLatar.getState().galat).toBeNull();

    gps.sukses!(posisi(-1.6001, 103.6, 4, null)); // ±11 m: sah, tanpa elevasi
    expect(perekamLatar.getState().titik).toHaveLength(2);
    expect(perekamLatar.getState().titik[1].elevasi).toBeUndefined();
  });

  it("galat GPS ditampilkan apa adanya (izin ditolak atau sinyal belum ada)", async () => {
    const gps = pasangGpsTiruan();
    const { perekamLatar } = await muat();
    perekamLatar.mulai("polygon", []);
    gps.galat!(galatGps(1));
    expect(perekamLatar.getState().galat).toMatch(/belum diizinkan/);
    gps.galat!(galatGps(3));
    expect(perekamLatar.getState().galat).toMatch(/Sinyal GPS belum didapat/);
  });

  it("jeda menghentikan GPS dan durasi; lanjutkan memantau lagi; durasi tidak menghitung masa jeda", async () => {
    const gps = pasangGpsTiruan();
    const wl = pasangWakeLockTiruan();
    const m = await muat();
    m.perekamLatar.mulai("line", []);
    await tunggu();
    vi.advanceTimersByTime(60_000);
    m.perekamLatar.jeda();
    expect(m.perekamLatar.getState().status).toBe("dijeda");
    expect(gps.clear).toHaveBeenCalledWith(7);
    expect(wl.lepas).toHaveBeenCalled();
    vi.advanceTimersByTime(10 * 60_000); // dijeda 10 menit
    expect(m.durasiRekamMs(m.perekamLatar.getState())).toBe(60_000);
    m.perekamLatar.lanjutkan();
    expect(gps.watch).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30_000);
    expect(m.durasiRekamMs(m.perekamLatar.getState())).toBe(90_000);
    expect(m.formatDurasi(m.durasiRekamMs(m.perekamLatar.getState()))).toBe("01:30");
  });

  it("titik GPS saat dijeda tidak ditambahkan; jeda/lanjut di status yang salah diabaikan", async () => {
    const gps = pasangGpsTiruan();
    const { perekamLatar } = await muat();
    perekamLatar.lanjutkan(); // belum merekam
    perekamLatar.jeda();
    expect(perekamLatar.getState().status).toBe("idle");
    perekamLatar.mulai("line", []);
    const kirim = gps.sukses!;
    perekamLatar.jeda();
    kirim(posisi(-1.6, 103.6)); // callback lama terlambat datang
    expect(perekamLatar.getState().titik).toHaveLength(0);
    expect(perekamLatar.getState().posisiTerakhir?.lat).toBe(-1.6);
  });

  it("tambah titik dari bidikan peta hanya saat ada rekaman", async () => {
    pasangGpsTiruan();
    const { perekamLatar } = await muat();
    perekamLatar.tambahTitik({ lat: 1, lng: 2 });
    expect(perekamLatar.getState().titik).toHaveLength(0);
    perekamLatar.mulai("polygon", []);
    perekamLatar.tambahTitik({ lat: 1, lng: 2 });
    expect(perekamLatar.getState().titik).toEqual([{ lat: 1, lng: 2 }]);
  });

  it("selesai mengembalikan titik lalu mengosongkan rekaman; batal membuang tanpa mengembalikan", async () => {
    const gps = pasangGpsTiruan();
    const { perekamLatar } = await muat();
    perekamLatar.mulai("line", [{ lat: 1, lng: 2 }]);
    perekamLatar.tambahTitik({ lat: 1.001, lng: 2 });
    const hasil = perekamLatar.selesai();
    expect(hasil).toHaveLength(2);
    expect(perekamLatar.getState().status).toBe("idle");
    expect(localStorage.getItem(KUNCI)).toBeNull();
    expect(gps.clear).toHaveBeenCalled();

    perekamLatar.mulai("polygon", [{ lat: 1, lng: 2 }]);
    perekamLatar.batal();
    expect(perekamLatar.getState()).toMatchObject({ status: "idle", titik: [], jenis: null });
    expect(localStorage.getItem(KUNCI)).toBeNull();
  });

  it("pendengar diberi tahu setiap perubahan dan bisa berhenti berlangganan", async () => {
    pasangGpsTiruan();
    const { perekamLatar } = await muat();
    const fn = vi.fn();
    const henti = perekamLatar.subscribe(fn);
    perekamLatar.mulai("line", []);
    perekamLatar.tambahTitik({ lat: 1, lng: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
    henti();
    perekamLatar.batal();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("perekam latar: mode simulasi (demo)", () => {
  it("tanpa simulasi, perangkat diam tidak menambah titik walau waktu berjalan", async () => {
    pasangGpsTiruan();
    const { perekamLatar } = await muat();
    perekamLatar.mulai("line", [{ lat: -1.6, lng: 103.6 }]);
    vi.advanceTimersByTime(10 * 60_000);
    expect(perekamLatar.getState().titik).toHaveLength(1);
  });

  it("simulasi menambah titik tiap 2 detik, semuanya bertanda simulasi, dan berhenti saat dimatikan atau dijeda", async () => {
    const gps = pasangGpsTiruan();
    const { perekamLatar } = await muat();
    perekamLatar.mulai("line", [{ lat: -1.6, lng: 103.6 }]);
    perekamLatar.toggleAutoGps();
    vi.advanceTimersByTime(10_000);
    const s = perekamLatar.getState();
    expect(s.titik).toHaveLength(6);
    expect(s.titik.slice(1).every((t) => t.simulasi === true)).toBe(true);
    gps.galat!(galatGps(1)); // galat GPS tidak mengganggu demo
    expect(perekamLatar.getState().galat).toBeNull();

    perekamLatar.jeda();
    vi.advanceTimersByTime(10_000);
    expect(perekamLatar.getState().titik).toHaveLength(6);
    perekamLatar.lanjutkan();
    perekamLatar.toggleAutoGps();
    vi.advanceTimersByTime(10_000);
    expect(perekamLatar.getState().titik).toHaveLength(6);
  });
});

describe("perekam latar: pemulihan setelah aplikasi dibuka ulang", () => {
  it("rekaman yang masih berjalan dilanjutkan: GPS dipantau lagi dan durasi lama dipertahankan", async () => {
    localStorage.setItem(
      KUNCI,
      JSON.stringify({
        status: "merekam",
        jenis: "line",
        titik: [{ lat: 1, lng: 2 }],
        mulaiPada: "2026-10-28T01:00:00.000Z",
        durasiTersimpanMs: 120_000,
        segmenMulaiMs: 1,
        posisiTerakhir: null,
        autoGpsAktif: false,
        galat: null
      })
    );
    const gps = pasangGpsTiruan();
    const m = await muat();
    expect(m.perekamLatar.getState().status).toBe("merekam");
    expect(gps.watch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    // waktu saat aplikasi tertutup tidak dihitung: 120 detik lama + 30 detik sejak dibuka lagi
    expect(m.durasiRekamMs(m.perekamLatar.getState())).toBe(150_000);
  });

  it("rekaman lama dengan Auto GPS aktif ditandai simulasi dan timernya tidak dinyalakan lagi", async () => {
    localStorage.setItem(
      KUNCI,
      JSON.stringify({
        status: "dijeda",
        jenis: "line",
        titik: [
          { lat: 1, lng: 2 },
          { lat: 1.001, lng: 2 }
        ],
        durasiTersimpanMs: 0,
        segmenMulaiMs: null,
        autoGpsAktif: true
      })
    );
    pasangGpsTiruan();
    const { perekamLatar } = await muat();
    const s = perekamLatar.getState();
    expect(s.autoGpsAktif).toBe(false);
    expect(s.titik.every((t) => t.simulasi === true)).toBe(true);
    perekamLatar.lanjutkan();
    vi.advanceTimersByTime(10_000);
    expect(perekamLatar.getState().titik).toHaveLength(2);
  });

  it("isi penyimpanan rusak diabaikan", async () => {
    localStorage.setItem(KUNCI, "{rusak");
    pasangGpsTiruan();
    const { perekamLatar } = await muat();
    expect(perekamLatar.getState().status).toBe("idle");
  });

  it("wake lock diminta lagi saat aplikasi kembali ditampilkan selama merekam", async () => {
    pasangGpsTiruan();
    const wl = pasangWakeLockTiruan();
    const { perekamLatar } = await muat();
    perekamLatar.mulai("line", []);
    await tunggu();
    expect(wl.minta).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event("visibilitychange"));
    await tunggu();
    expect(wl.minta).toHaveBeenCalledTimes(2);
    perekamLatar.batal();
  });
});

describe("format durasi dan ringkasan", () => {
  it("mm:dd di bawah satu jam, j:mm:dd di atasnya", async () => {
    const { formatDurasi } = await muat();
    expect(formatDurasi(0)).toBe("00:00");
    expect(formatDurasi(65_400)).toBe("01:05");
    expect(formatDurasi(3_725_000)).toBe("1:02:05");
  });

  it("ringkasan jalur (km) dan poligon (Ha)", async () => {
    const { ringkasanRekam } = await muat();
    const dasar = {
      status: "merekam" as const,
      mulaiPada: null,
      durasiTersimpanMs: 0,
      segmenMulaiMs: null,
      posisiTerakhir: null,
      autoGpsAktif: false,
      galat: null
    };
    expect(
      ringkasanRekam({
        ...dasar,
        jenis: "line",
        titik: [
          { lat: 0, lng: 0 },
          { lat: 0, lng: 0.01 }
        ]
      })
    ).toMatch(/^2 titik • 1\.1\d* km$/);
    expect(
      ringkasanRekam({
        ...dasar,
        jenis: "polygon",
        titik: [
          { lat: 0, lng: 0 },
          { lat: 0, lng: 0.001 },
          { lat: 0.001, lng: 0.001 },
          { lat: 0.001, lng: 0 }
        ]
      })
    ).toMatch(/^4 sudut • 1\.2\d* Ha$/);
  });
});
