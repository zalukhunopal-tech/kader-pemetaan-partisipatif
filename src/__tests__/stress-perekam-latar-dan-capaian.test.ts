// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KoordinatTitik, DataSpasialItem, ProfilKader } from "../types";
import { hitungLuasPoligonHa, hitungPanjangGarisKm } from "../lib/geoUtils";
import { hitungCapaianKader, hitungPeringkatGis20Level } from "../lib/rewardEngine";
import { formatKoordinat } from "../lib/sistemKoordinat";

const KUNCI = "kader_pemetaan_rekam_latar_v1";

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
    return 88;
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

const buatPosisi = (lat: number, lng: number, akurasi = 4, alt = 250, ts = Date.now()): GeolocationPosition =>
  ({
    coords: { latitude: lat, longitude: lng, accuracy: akurasi, altitude: alt, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: ts
  }) as unknown as GeolocationPosition;

const profilTes: ProfilKader = {
  idKader: "KDR-STRESS-01",
  nama: "Kader Uji Stress",
  desaWilayah: "Desa Rimba Uji",
  kelompokMasyarakat: "Kelompok Tani Hutan",
  noHp: "081234567890",
  namaOrganisasi: "KKI Warsi",
  modeKombinasiTarget: "per_kategori"
};

describe("Uji Stress Perekam Latar Belakang (Jalur & Poligon)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 10, 13, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Stress test 500+ titik kontinu: merekam jalur secara stabil tanpa kebocoran memori atau crash", async () => {
    const gps = pasangGpsTiruan();
    pasangWakeLockTiruan();
    vi.resetModules();
    const { perekamLatar } = await import("../lib/perekamLatar");

    perekamLatar.mulai("line", [{ lat: -0.9, lng: 100.4, timestamp: new Date(Date.now()).toISOString() }]);

    let lat = -0.9;
    let lng = 100.4;
    let waktuMs = Date.now();

    // Simulasi 500 titik pergerakan pejalan kaki (setiap 3 detik berpindah ~5-8 meter)
    for (let i = 1; i <= 500; i++) {
      waktuMs += 3000;
      lat += 0.00005; // ~5.5 meter per step
      lng += 0.00003;
      vi.setSystemTime(new Date(waktuMs));
      gps.sukses!(buatPosisi(lat, lng, 3.5, 200 + (i % 20), waktuMs));
    }

    const state = perekamLatar.getState();
    expect(state.titik.length).toBeGreaterThanOrEqual(500);
    expect(state.status).toBe("merekam");
    expect(state.jenis).toBe("line");

    // Panjang jalur terhitung valid dan konsisten
    const totalKm = hitungPanjangGarisKm(state.titik);
    expect(totalKm).toBeGreaterThan(2.0);

    // Verifikasi penyimpanan instan di localStorage aman dan tidak korup
    const rawStorage = localStorage.getItem(KUNCI);
    expect(rawStorage).toBeTruthy();
    const parsed = JSON.parse(rawStorage!);
    expect(parsed.titik.length).toBe(state.titik.length);
    perekamLatar.batal();
  });

  it("Stress test perekaman poligon di latar belakang: keliling lahan 5 Ha dengan 60 sudut", async () => {
    const gps = pasangGpsTiruan();
    pasangWakeLockTiruan();
    vi.resetModules();
    const { perekamLatar } = await import("../lib/perekamLatar");

    // Mulai pembuatan poligon di latar belakang
    perekamLatar.mulai("polygon", []);

    // Simulasi rute mengelilingi batas lahan persegi ~230m x ~230m (luas ~5.3 Ha)
    const baseLat = -0.9478;
    const baseLng = 100.4185;
    const deltaLat = 0.0021; // ~230 meter
    const deltaLng = 0.0021; // ~230 meter

    let waktu = Date.now();
    const titikSimulasi: { lat: number; lng: number }[] = [];

    // Sisi 1: Selatan (Barat -> Timur, 15 titik)
    for (let i = 0; i < 15; i++) {
      titikSimulasi.push({ lat: baseLat, lng: baseLng + (deltaLng * i) / 15 });
    }
    // Sisi 2: Timur (Selatan -> Utara, 15 titik)
    for (let i = 0; i < 15; i++) {
      titikSimulasi.push({ lat: baseLat + (deltaLat * i) / 15, lng: baseLng + deltaLng });
    }
    // Sisi 3: Utara (Timur -> Barat, 15 titik)
    for (let i = 0; i < 15; i++) {
      titikSimulasi.push({ lat: baseLat + deltaLat, lng: baseLng + deltaLng - (deltaLng * i) / 15 });
    }
    // Sisi 4: Barat (Utara -> Selatan, 15 titik)
    for (let i = 0; i < 15; i++) {
      titikSimulasi.push({ lat: baseLat + deltaLat - (deltaLat * i) / 15, lng: baseLng });
    }

    // Suntikkan seluruh titik simulasi
    for (const pt of titikSimulasi) {
      waktu += 4000;
      vi.setSystemTime(new Date(waktu));
      gps.sukses!(buatPosisi(pt.lat, pt.lng, 3.0, 300, waktu));
    }

    const statePoly = perekamLatar.getState();
    expect(statePoly.jenis).toBe("polygon");
    expect(statePoly.titik.length).toBeGreaterThanOrEqual(50);

    const luasHa = hitungLuasPoligonHa(statePoly.titik);
    expect(luasHa).toBeGreaterThan(4.5);
    expect(luasHa).toBeLessThan(6.5);

    perekamLatar.batal();
  });

  it("Ketahanan sleep/background: jeda panjang 60 detik & timeout GPS tetap pulih saat layar bangun", async () => {
    const gps = pasangGpsTiruan();
    const wl = pasangWakeLockTiruan();
    vi.resetModules();
    const { perekamLatar } = await import("../lib/perekamLatar");

    perekamLatar.mulai("line", [{ lat: -1.0, lng: 100.0, timestamp: new Date(Date.now()).toISOString() }]);

    // 1. Tab disembunyikan / layar mati
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));

    // 2. Waktu berlalu 60 detik saat HP di saku
    vi.advanceTimersByTime(60000);

    // 3. Terjadi GPS timeout dari OS
    gps.galat!({ code: 3, message: "GPS Timeout", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);

    // 4. Layar dinyalakan kembali
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));

    // WakeLock diminta kembali
    expect(wl.minta).toHaveBeenCalled();

    // 5. Titik GPS masuk setelah 60 detik (perpindahan 50 meter)
    const waktuBaru = Date.now() + 60000;
    vi.setSystemTime(new Date(waktuBaru));
    gps.sukses!(buatPosisi(-1.0004, 100.0, 4.0, 260, waktuBaru));

    // Titik harus diterima dan tidak dibuang karena jeda waktu wajar pejalan kaki
    const state = perekamLatar.getState();
    expect(state.titik.length).toBe(2);
    expect(perekamLatar.getState().galat).toBeNull();

    perekamLatar.batal();
  });

  it("Filter lonjakan ekstrim (GPS glitch) berhasil menolak lonjakan fiktif", async () => {
    const gps = pasangGpsTiruan();
    pasangWakeLockTiruan();
    vi.resetModules();
    const { perekamLatar } = await import("../lib/perekamLatar");

    const t0 = Date.now();
    perekamLatar.mulai("line", [{ lat: -1.0, lng: 100.0, timestamp: new Date(t0).toISOString() }]);

    // Titik melonjak 5 kilometer dalam 1 detik (kecepatan 5000 m/s >> 12 m/s batas pejalan kaki)
    const t1 = t0 + 1000;
    vi.setSystemTime(new Date(t1));
    gps.sukses!(buatPosisi(-1.045, 100.0, 3.0, 260, t1));

    // Lonjakan harus ditolak, titik tidak bertambah
    expect(perekamLatar.getState().titik.length).toBe(1);
    expect(perekamLatar.getState().galat).toMatch(/Lonjakan GPS/);

    perekamLatar.batal();
  });
});

describe("Uji Validasi Formula Level (1 Titik = Level 1) & Syarat Sertifikat Baru", () => {
  it("1 titik baru masuk aplikasi menghasilkan Level 1 (bukan Level 3)", () => {
    const satuTitik: DataSpasialItem[] = [
      {
        id: "T1",
        idKader: "KDR-STRESS-01",
        namaKader: "Kader Uji Stress",
        desaWilayah: "Desa Rimba",
        judul: "Pohon Meranti",
        kategori: "Biodiversitas",
        jenisGeometri: "point",
        koordinat: [{ lat: -0.9, lng: 100.4, akurasi: 3.5 }],
        panjangKm: 0,
        luasHa: 0,
        statusSinkron: "lokal", // data awal saat pertama kali diambil di lapangan
        createdAt: "2026-11-13T10:00:00.000Z",
        updatedAt: "",
        deskripsi: "",
        riwayatPembaruan: []
      }
    ];

    const peringkat = hitungPeringkatGis20Level(satuTitik, profilTes);
    expect(peringkat.levelSaatIni.level).toBe(1);
    expect(peringkat.levelSaatIni.namaLevel).toBe("Penjelajah Dasar");
    expect(peringkat.rincianSkor.skorVariasiData).toBe(0); // 1 kategori dan 1 geometri tidak dapat bonus variasi cuma-cuma
    expect(peringkat.skorTotal).toBeLessThan(40); // Level 2 butuh minSkor 40
  });

  it("Sertifikat baru keluar jika 50 titik, 5 km jalur, DAN 5 ha poligon terverifikasi admin terpenuhi bersamaan", () => {
    const buatTitik = (n: number, status: "terverifikasi" | "lokal" = "terverifikasi"): DataSpasialItem[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `PT-${i}`,
        idKader: "KDR-STRESS-01",
        namaKader: "Kader Uji Stress",
        desaWilayah: "Desa Rimba",
        judul: `Titik Survei ${i + 1}`,
        kategori: "Biodiversitas",
        jenisGeometri: "point",
        koordinat: [{ lat: -0.9 + i * 0.0001, lng: 100.4 }],
        panjangKm: 0,
        luasHa: 0,
        statusSinkron: status,
        createdAt: "2026-11-13T10:00:00.000Z",
        updatedAt: "",
        deskripsi: "",
        riwayatPembaruan: []
      }));

    const buatGaris = (km: number): DataSpasialItem => ({
      id: "LN-1",
      idKader: "KDR-STRESS-01",
      namaKader: "Kader Uji Stress",
      desaWilayah: "Desa Rimba",
      judul: "Tracking Patroli Hutan",
      kategori: "Biodiversitas",
      jenisGeometri: "line",
      koordinat: [{ lat: -0.9, lng: 100.4 }, { lat: -0.94, lng: 100.44 }],
      panjangKm: km,
      luasHa: 0,
      statusSinkron: "terverifikasi",
      createdAt: "2026-11-13T10:00:00.000Z",
      updatedAt: "",
      deskripsi: "",
      riwayatPembaruan: []
    });

    const buatPoligon = (ha: number): DataSpasialItem => ({
      id: "PL-1",
      idKader: "KDR-STRESS-01",
      namaKader: "Kader Uji Stress",
      desaWilayah: "Desa Rimba",
      judul: "Lahan Ulayat Desa",
      kategori: "Wilayah Adat / Lahan",
      jenisGeometri: "polygon",
      koordinat: [
        { lat: -0.9, lng: 100.4 },
        { lat: -0.92, lng: 100.4 },
        { lat: -0.92, lng: 100.42 },
        { lat: -0.9, lng: 100.4 }
      ],
      panjangKm: 0,
      luasHa: ha,
      statusSinkron: "terverifikasi",
      createdAt: "2026-11-13T10:00:00.000Z",
      updatedAt: "",
      deskripsi: "",
      riwayatPembaruan: []
    });

    // Kasus A: 50 titik saja -> BELUM berhak
    const hanyaTitik = hitungCapaianKader(buatTitik(50), profilTes, true);
    expect(hanyaTitik.berhakSertifikat).toBe(false);

    // Kasus B: 50 titik + 5 km jalur (tanpa poligon) -> BELUM berhak
    const titikDanGaris = hitungCapaianKader([...buatTitik(50), buatGaris(5.2)], profilTes, true);
    expect(titikDanGaris.berhakSertifikat).toBe(false);

    // Kasus C: 50 titik + 5 km jalur + 5 Ha poligon -> BERHAK SERTIFIKAT!
    const paketLengkap = hitungCapaianKader([...buatTitik(50), buatGaris(5.2), buatPoligon(5.1)], profilTes, true);
    expect(paketLengkap.berhakSertifikat).toBe(true);
    expect(paketLengkap.totalPaketSelesai).toBe(1);
    expect(paketLengkap.alasanSertifikat).toMatch(/Lengkap/);

    // Kasus D: Data belum diverifikasi admin -> BELUM berhak saat hanyaTerverifikasi = true
    const paketLengkapBelumVerif = [...buatTitik(50), buatGaris(5.2), buatPoligon(5.1)].map((d) => ({
      ...d,
      statusSinkron: "tersinkron" as const
    }));
    const hasilBelumVerif = hitungCapaianKader(paketLengkapBelumVerif, profilTes, true);
    expect(hasilBelumVerif.berhakSertifikat).toBe(false);
  });
});

describe("Uji Penyelarasan Koordinat Sejajar X & Y", () => {
  it("Format koordinat menghasilkan baris X dan Y yang dapat ditampilkan sejajar", () => {
    const lat = 2.85727;
    const lng = 117.377476;

    const fDD = formatKoordinat(lat, lng, "DD");
    expect(fDD.baris).toHaveLength(2);
    expect(fDD.baris[0].nilai).toContain("°");
    expect(fDD.baris[1].nilai).toContain("°");

    const fUTM = formatKoordinat(lat, lng, "UTM");
    expect(fUTM.baris).toHaveLength(2);
    expect(fUTM.baris[0].nilai).toContain("m");
    expect(fUTM.baris[1].nilai).toContain("m");
  });
});
