// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KoordinatTitik } from "../../types";
import {
  hitungJarakMeter,
  hitungPanjangGarisKm,
  hitungLuasPoligonHa,
  hitungBearingDerajat,
  validasiPoligon,
  formatKoordinatTeks
} from "../../lib/geoUtils";
import { perekamLatar } from "../../lib/perekamLatar";

describe("Kategori B: Sensor GPS, Perekaman Jalur & Geometri Spasial (Skenario 9–18)", () => {
  beforeEach(() => {
    localStorage.clear();
    perekamLatar.batal();
  });

  afterEach(() => {
    perekamLatar.batal();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Skenario 9: Canopy Multipath GPS Jump (Teleportation Spike)
  it("Skenario 9: Canopy Multipath GPS Jump — lonjakan koordinat palsu >2.5km di bawah tajuk hutan disaring", () => {
    let watchCallback: ((pos: GeolocationPosition) => void) | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        watchPosition: vi.fn((cb) => {
          watchCallback = cb;
          return 123;
        }),
        clearWatch: vi.fn()
      }
    });

    perekamLatar.mulai("line");

    // Titik awal 1 (Tanjung Selor)
    const t0 = Date.now();
    watchCallback!({
      coords: { latitude: 2.8574, longitude: 117.3774, altitude: 45, accuracy: 4.2 } as GeolocationCoordinates,
      timestamp: t0
    } as GeolocationPosition);

    expect(perekamLatar.getState().titik).toHaveLength(1);

    // Titik 2: lonjakan multipath 2.5 km dalam 2 detik (speed > 1000 m/s)
    watchCallback!({
      coords: { latitude: 2.8799, longitude: 117.3774, altitude: 45, accuracy: 180 } as GeolocationCoordinates,
      timestamp: t0 + 2000
    } as GeolocationPosition);

    // Sinyal akurasi 180m / lonjakan kecepatan harus diabaikan dari titik rekam
    const snapshot = perekamLatar.getState();
    expect(snapshot.titik).toHaveLength(1);
    expect(snapshot.galat).toBeTruthy();
  });

  // Skenario 10: Zero Movement / Stationary Drift
  it("Skenario 10: Zero Movement / Stationary Drift — istirahat makan siang tidak mengakumulasi jarak palsu", () => {
    let watchCallback: ((pos: GeolocationPosition) => void) | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        watchPosition: vi.fn((cb) => {
          watchCallback = cb;
          return 123;
        }),
        clearWatch: vi.fn()
      }
    });

    perekamLatar.mulai("line");
    const t0 = Date.now();

    // Titik awal
    watchCallback!({
      coords: { latitude: 2.857400, longitude: 117.377400, altitude: 45, accuracy: 3 } as GeolocationCoordinates,
      timestamp: t0
    } as GeolocationPosition);

    // Jitter halus 1-2 meter selama 45 menit (10 pembacaan bolak-balik)
    for (let i = 1; i <= 10; i++) {
      watchCallback!({
        coords: { latitude: 2.857405, longitude: 117.377405, altitude: 45, accuracy: 3 } as GeolocationCoordinates,
        timestamp: t0 + i * 60000
      } as GeolocationPosition);
      watchCallback!({
        coords: { latitude: 2.857400, longitude: 117.377400, altitude: 45, accuracy: 3 } as GeolocationCoordinates,
        timestamp: t0 + i * 60000 + 30000
      } as GeolocationPosition);
    }

    const titik = perekamLatar.getState().titik;
    // Jitter < JARAK_MIN_METER (3m) tidak menambah titik secara liar
    expect(titik.length).toBeLessThanOrEqual(2);
    const totalKm = hitungPanjangGarisKm(titik);
    expect(totalKm).toBeLessThan(0.01); // Tidak menghasilkan kilometer palsu
  });

  // Skenario 11: GPS Permission Revoked Mid-Recording
  it("Skenario 11: GPS Permission Revoked — jejak sebelumnya tetap aman dan status beralih dengan peringatan", () => {
    let errCallback: ((err: GeolocationPositionError) => void) | null = null;
    let watchCallback: ((pos: GeolocationPosition) => void) | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        watchPosition: vi.fn((cb, err) => {
          watchCallback = cb;
          errCallback = err;
          return 123;
        }),
        clearWatch: vi.fn()
      }
    });

    perekamLatar.mulai("line");
    watchCallback!({
      coords: { latitude: 2.8574, longitude: 117.3774, altitude: 45, accuracy: 4 } as GeolocationCoordinates,
      timestamp: Date.now()
    } as GeolocationPosition);

    expect(perekamLatar.getState().titik).toHaveLength(1);

    // Izin dicabut OS di tengah jalan
    errCallback!({
      code: 1, // PERMISSION_DENIED
      message: "User denied Geolocation",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    } as GeolocationPositionError);

    const snapshot = perekamLatar.getState();
    // Titik yang sudah terekam TIDAK hilang
    expect(snapshot.titik).toHaveLength(1);
    expect(snapshot.galat).toContain("belum diizinkan");
  });

  // Skenario 12: High-Frequency GPS Burst
  it("Skenario 12: High-Frequency GPS Burst — 20 koordinat/detik diserap dengan aman tanpa freeze", () => {
    let watchCallback: ((pos: GeolocationPosition) => void) | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        watchPosition: vi.fn((cb) => {
          watchCallback = cb;
          return 123;
        }),
        clearWatch: vi.fn()
      }
    });

    perekamLatar.mulai("line");
    const t0 = Date.now();

    // Burst 20 event dalam 1 detik
    for (let i = 0; i < 20; i++) {
      watchCallback!({
        coords: {
          latitude: 2.8574 + i * 0.00005,
          longitude: 117.3774 + i * 0.00005,
          altitude: 45,
          accuracy: 4
        } as GeolocationCoordinates,
        timestamp: t0 + i * 50
      } as GeolocationPosition);
    }

    const titik = perekamLatar.getState().titik;
    expect(titik.length).toBeGreaterThan(0);
    // State konsisten dan tidak melempar eksepsi
  });

  // Skenario 13: Null / NaN Altitude & Heading
  it("Skenario 13: Null & NaN Altitude — perangkat Android murah tidak menyebabkan NaN pada koordinat", () => {
    let watchCallback: ((pos: GeolocationPosition) => void) | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        watchPosition: vi.fn((cb) => {
          watchCallback = cb;
          return 123;
        }),
        clearWatch: vi.fn()
      }
    });

    perekamLatar.mulai("line");
    watchCallback!({
      coords: {
        latitude: 2.8574,
        longitude: 117.3774,
        altitude: NaN, // GPS murah mengembalikan NaN
        accuracy: 5
      } as GeolocationCoordinates,
      timestamp: Date.now()
    } as GeolocationPosition);

    const titik = perekamLatar.getState().titik;
    expect(titik).toHaveLength(1);
    expect(titik[0].elevasi).toBeUndefined(); // Aman, tidak bernilai NaN!
  });

  // Skenario 14: Self-Intersecting Polygon / Boundary Input
  it("Skenario 14: Self-Intersecting Polygon — deteksi poligon angka-8 dan validasi titik", () => {
    // Poligon angka 8 (self-intersecting)
    const poligonAngka8: KoordinatTitik[] = [
      { lat: 0, lng: 0 },
      { lat: 2, lng: 2 },
      { lat: 0, lng: 2 },
      { lat: 2, lng: 0 }
    ];

    const hasil8 = validasiPoligon(poligonAngka8);
    expect(hasil8.valid).toBe(false);
    expect(hasil8.pesan).toContain("saling memotong");

    // Poligon normal segitiga
    const poligonValid: KoordinatTitik[] = [
      { lat: 2.85, lng: 117.37 },
      { lat: 2.86, lng: 117.37 },
      { lat: 2.85, lng: 117.38 }
    ];
    const hasilValid = validasiPoligon(poligonValid);
    expect(hasilValid.valid).toBe(true);
    expect(hitungLuasPoligonHa(poligonValid)).toBeGreaterThan(0);
  });

  // Skenario 15: Duplicate Consecutive Vertices
  it("Skenario 15: Duplicate Consecutive Vertices — titik kembar berturut-turut tidak menyebabkan division-by-zero pada bearing", () => {
    const ptA: KoordinatTitik = { lat: 2.8574, lng: 117.3774 };
    const ptB: KoordinatTitik = { lat: 2.8574, lng: 117.3774 }; // Sama persis

    const bearing = hitungBearingDerajat(ptA, ptB);
    expect(Number.isFinite(bearing)).toBe(true);
    expect(bearing).toBe(0);

    const garisKembar: KoordinatTitik[] = [ptA, ptB, ptA];
    const panjang = hitungPanjangGarisKm(garisKembar);
    expect(panjang).toBe(0);
  });

  // Skenario 16: Extreme Coordinate / Antimeridian & Equator Crossing
  it("Skenario 16: Equator & Antimeridian — lat=0 (khatulistiwa Kalimantan) tidak dianggap falsy", () => {
    const titikKhatulistiwa: KoordinatTitik = { lat: 0.000000, lng: 117.377400 };

    const teksDD = formatKoordinatTeks(titikKhatulistiwa.lat, titikKhatulistiwa.lng, "DD");
    expect(teksDD).toBe("0.000000°, 117.377400°");

    const teksDMS = formatKoordinatTeks(titikKhatulistiwa.lat, titikKhatulistiwa.lng, "DMS");
    expect(teksDMS).toContain("0°0'0.0\"LU");

    // Jarak melintasi khatulistiwa
    const ptSelatan: KoordinatTitik = { lat: -0.001, lng: 117.3774 };
    const ptUtara: KoordinatTitik = { lat: 0.001, lng: 117.3774 };
    const jarak = hitungJarakMeter(ptSelatan, ptUtara);
    expect(jarak).toBeGreaterThan(200);
    expect(jarak).toBeLessThan(250);
  });

  // Skenario 17: Background Tab / Screen Lock During Track Recording
  it("Skenario 17: Screen Lock & Background Persistence — jejak tersimpan ke localStorage dan pulih", () => {
    perekamLatar.mulai("line");
    perekamLatar.tambahTitik({ lat: 2.8574, lng: 117.3774 });
    perekamLatar.tambahTitik({ lat: 2.8580, lng: 117.3780 });

    // Cek bahwa jejak tersimpan di localStorage
    const saved = localStorage.getItem("kader_pemetaan_rekam_latar_v1");
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.titik).toHaveLength(2);
    expect(parsed.status).toBe("merekam");

    // Selesaikan
    const titikSelesai = perekamLatar.selesai();
    expect(titikSelesai).toHaveLength(2);
  });

  // Skenario 18: Long Marathon Track (10,000+ Track Points)
  it("Skenario 18: Long Marathon Track — 10.000 titik patroli dihitung di bawah 200ms tanpa stack overflow", () => {
    const banyakTitik: KoordinatTitik[] = [];
    const latAwal = 2.8574;
    const lngAwal = 117.3774;

    for (let i = 0; i < 10000; i++) {
      banyakTitik.push({
        lat: latAwal + i * 0.00001,
        lng: lngAwal + i * 0.00001,
        elevasi: 40 + (i % 20),
        akurasi: 3.0
      });
    }

    const tStart = performance.now();
    const totalKm = hitungPanjangGarisKm(banyakTitik);
    const duration = performance.now() - tStart;

    expect(duration).toBeLessThan(200); // Harus cepat (<200ms)
    expect(totalKm).toBeGreaterThan(10); // Sekitar ~15km
    expect(Number.isFinite(totalKm)).toBe(true);
  });
});
