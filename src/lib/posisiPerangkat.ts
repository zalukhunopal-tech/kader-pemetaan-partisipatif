import { useSyncExternalStore } from "react";
import { KoordinatTitik } from "../types";
import { hitungJarakMeter, hitungRataRataGps, koordinatValid } from "./geoUtils";

/**
 * POSISI & ARAH PERANGKAT
 * Satu pemantau bersama untuk GPS (geolocation) dan kompas (orientasi perangkat).
 * Pemantau menyala selama ada komponen yang memakainya dan mati saat tidak ada.
 * Tidak ada nilai bawaan: sebelum sensor memberi data, posisi dan arah bernilai null.
 */

export type StatusGps = "mencari" | "aktif" | "ditolak" | "tidak_tersedia" | "galat";
export type StatusKompas = "mencari" | "aktif" | "perlu_izin" | "ditolak" | "tidak_tersedia";

export interface StatePosisiPerangkat {
  statusGps: StatusGps;
  /** Fix GPS terakhir apa adanya; elevasi kosong bila perangkat tidak memberinya */
  posisi: KoordinatTitik | null;
  statusKompas: StatusKompas;
  /** Arah atas layar dari utara, 0-359 derajat, searah jarum jam */
  arahDerajat: number | null;
}

/** Fix GPS yang lebih tua dari ini tidak dipakai untuk mengisi akurasi/elevasi titik */
const UMUR_POSISI_MAKS_MS = 60_000;
/** Titik bidikan dianggap "di posisi saya" bila jaraknya ke fix GPS tidak lebih dari ini */
export const JARAK_BIDIKAN_DEKAT_M = 15;
const BATAS_TUNGGU_KOMPAS_MS = 3000;
const BATAS_CEPAT_WAJAR_MPS = 85; // ~306 km/jam: lonjakan GPS mustahil diabaikan
const INTERVAL_MIN_KECEPATAN_S = 0.35;
const INTERVAL_MAKS_KECEPATAN_S = 30;

const STATE_AWAL: StatePosisiPerangkat = {
  statusGps: "mencari",
  posisi: null,
  statusKompas: "mencari",
  arahDerajat: null
};

let state: StatePosisiPerangkat = STATE_AWAL;
const pendengar = new Set<() => void>();

function setState(patch: Partial<StatePosisiPerangkat>) {
  state = { ...state, ...patch };
  pendengar.forEach((fn) => fn());
}

/* ---------- Fungsi murni (diuji terpisah) ---------- */

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Arah atas layar dari utara (searah jarum jam) dari sudut orientasi absolut perangkat.
 * Perangkat mendekati datar: arah tepi atas. Perangkat tegak: arah kamera belakang.
 * alpha = 0 berarti tepi atas menghadap utara; sumbu bumi: x timur, y utara, z atas.
 */
export function kompasDariOrientasi(alpha: number, beta: number, gamma: number): number {
  const a = rad(alpha);
  const b = rad(beta);
  const g = rad(gamma);
  const normalLayarKeAtas = Math.cos(b) * Math.cos(g);
  let timur: number;
  let utara: number;
  if (Math.abs(normalLayarKeAtas) > 0.5) {
    timur = -Math.sin(a) * Math.cos(b);
    utara = Math.cos(a) * Math.cos(b);
  } else {
    timur = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
    utara = -(Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g));
  }
  return (deg(Math.atan2(timur, utara)) + 360) % 360;
}

/** Selisih bertanda dari arah perangkat ke arah target: negatif = ke kiri, positif = ke kanan (-180..180) */
export function selisihArah(arahTarget: number, arahPerangkat: number): number {
  return ((((arahTarget - arahPerangkat) % 360) + 540) % 360) - 180;
}

/**
 * Titik dari bidikan tengah peta. Akurasi dan elevasi GPS hanya ikut bila titik itu berada
 * di posisi GPS (kader berdiri di objek). Di luar itu keduanya dikosongkan, karena
 * nilai GPS menggambarkan posisi perangkat, bukan titik yang dibidik.
 */
export function titikDariBidikan(
  bidikan: { lat: number; lng: number },
  posisi: KoordinatTitik | null,
  sekarangMs: number = Date.now()
): KoordinatTitik {
  const titik: KoordinatTitik = {
    lat: Number(bidikan.lat.toFixed(6)),
    lng: Number(bidikan.lng.toFixed(6)),
    timestamp: new Date(sekarangMs).toISOString()
  };
  if (!posisi || posisi.akurasi === undefined) return titik;
  const waktuFix = Date.parse(posisi.timestamp ?? "");
  if (Number.isNaN(waktuFix) || sekarangMs - waktuFix > UMUR_POSISI_MAKS_MS) return titik;
  const jarak = hitungJarakMeter(posisi, bidikan as KoordinatTitik);
  if (jarak > JARAK_BIDIKAN_DEKAT_M) return titik;
  titik.akurasi = Number(Math.max(posisi.akurasi, jarak).toFixed(1));
  if (posisi.elevasi !== undefined) titik.elevasi = posisi.elevasi;
  return titik;
}

/**
 * Menghitung kecepatan sesaat (m/s): memprioritaskan sensor perangkat (coords.speed),
 * lalu menghitung perpindahan/waktu dari dua fix GPS berturut-turut saat sensor speed kosong.
 */
export function hitungKecepatanMps(
  posSekarang: KoordinatTitik,
  posSebelumnya: KoordinatTitik | null | undefined,
  speedSensorMps?: number | null
): number {
  if (typeof speedSensorMps === "number" && Number.isFinite(speedSensorMps) && speedSensorMps >= 0) {
    return speedSensorMps <= BATAS_CEPAT_WAJAR_MPS ? Number(speedSensorMps.toFixed(2)) : 0;
  }
  if (!posSebelumnya) return 0;
  const t0 = Date.parse(posSebelumnya.timestamp ?? "");
  const t1 = Date.parse(posSekarang.timestamp ?? "");
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return 0;
  const dtDetik = (t1 - t0) / 1000;
  if (dtDetik <= 0) return posSebelumnya.kecepatan ?? 0;
  if (dtDetik < INTERVAL_MIN_KECEPATAN_S) {
    return posSebelumnya.kecepatan ?? 0;
  }
  if (dtDetik > INTERVAL_MAKS_KECEPATAN_S) return 0;
  const jarakM = hitungJarakMeter(posSebelumnya, posSekarang);
  const accGabung = (posSebelumnya.akurasi ?? 5) + (posSekarang.akurasi ?? 5);
  const ambangDiamM = accGabung > 40 ? accGabung * 0.25 : 0.6;
  if (jarakM < ambangDiamM) return 0;
  const rawMps = jarakM / dtDetik;
  if (rawMps > BATAS_CEPAT_WAJAR_MPS) return 0;
  return Number(rawMps.toFixed(2));
}

export type ModeSinyalGnss = "gnss_optimal" | "gnss_standar" | "pencarian_satelit";

const JENDELA_BUFFER_GNSS_MS = 12_000;
const MAKS_BUFFER_GNSS = 5;
const BATAS_RADIUS_SMOOTH_M = 28;

function hitungRataTerbobotGnss(buffer: KoordinatTitik[], acuan: KoordinatTitik): KoordinatTitik {
  let sumW = 0;
  let sumLat = 0;
  let sumLng = 0;
  let bestAcc = Infinity;
  for (const s of buffer) {
    const acc = Math.max(1.5, s.akurasi ?? 25);
    const w = 1 / (acc * acc);
    sumW += w;
    sumLat += s.lat * w;
    sumLng += s.lng * w;
    if (s.akurasi !== undefined && s.akurasi < bestAcc) bestAcc = s.akurasi;
  }
  if (sumW <= 0) return acuan;
  return {
    ...acuan,
    lat: Number((sumLat / sumW).toFixed(7)),
    lng: Number((sumLng / sumW).toFixed(7)),
    akurasi: Number.isFinite(bestAcc) ? Number(bestAcc.toFixed(1)) : acuan.akurasi
  };
}

/**
 * Optimasi tangkapan satelit GNSS (efektif terutama saat offline tanpa A-GPS jaringan):
 * 1. Menolak fix kasar (> 65 m) apabila sudah mengunci satelit rapat (<= 35 m).
 * 2. Menolak lonjakan multipath ekstrem (> 250 m dalam <= 2 dtk dengan akurasi memburuk).
 * 3. Meratakan 2-5 sampel GNSS berdekatan dengan pembobotan 1 / akurasi^2 untuk meredam jitter kanopi.
 */
export function optimasiFixGnss(
  kandidat: KoordinatTitik,
  bufferSebelumnya: KoordinatTitik[]
): {
  posisi: KoordinatTitik;
  buffer: KoordinatTitik[];
  modeSinyal: ModeSinyalGnss;
} {
  const akurasiBaru = kandidat.akurasi ?? 50;
  const adaKunciKetat = bufferSebelumnya.some((b) => (b.akurasi ?? 999) <= 35);
  const terakhir = bufferSebelumnya[bufferSebelumnya.length - 1];

  // Abaikan fix Wi-Fi/seluler/multipath yang tiba-tiba melonggar jauh setelah satelit terkunci
  if (adaKunciKetat && akurasiBaru > 65) {
    const posTetap = terakhir ? hitungRataTerbobotGnss(bufferSebelumnya, terakhir) : kandidat;
    const ak = posTetap.akurasi ?? 50;
    return {
      posisi: posTetap,
      buffer: bufferSebelumnya,
      modeSinyal: ak <= 15 ? "gnss_optimal" : ak <= 35 ? "gnss_standar" : "pencarian_satelit"
    };
  }

  // Deteksi lonjakan kecepatan tidak masuk akal pada bacaan buruk
  if (terakhir) {
    const t0 = Date.parse(terakhir.timestamp ?? "");
    const t1 = Date.parse(kandidat.timestamp ?? "");
    const dtS = Number.isFinite(t0) && Number.isFinite(t1) ? Math.max(0.1, (t1 - t0) / 1000) : 1;
    const jarak = hitungJarakMeter(terakhir, kandidat);
    if (dtS <= 2 && jarak > 250 && akurasiBaru > (terakhir.akurasi ?? 20)) {
      const posTetap = hitungRataTerbobotGnss(bufferSebelumnya, terakhir);
      const ak = posTetap.akurasi ?? 50;
      return {
        posisi: posTetap,
        buffer: bufferSebelumnya,
        modeSinyal: ak <= 15 ? "gnss_optimal" : ak <= 35 ? "gnss_standar" : "pencarian_satelit"
      };
    }
  }

  const tsBaru = Date.parse(kandidat.timestamp ?? "") || Date.now();
  // Jika bergerak > BATAS_RADIUS_SMOOTH_M atau akurasi membaik drastis, mulai jendela rata-rata baru agar tidak tertinggal (lag)
  const jauhDariTerakhir = terakhir ? hitungJarakMeter(terakhir, kandidat) > BATAS_RADIUS_SMOOTH_M : false;
  const membaikDrastis = terakhir && (terakhir.akurasi ?? 999) > 65 && akurasiBaru <= 25;

  const bufferDasar =
    jauhDariTerakhir || membaikDrastis
      ? []
      : bufferSebelumnya.filter((b) => {
          const tb = Date.parse(b.timestamp ?? "");
          return Number.isFinite(tb) && tsBaru - tb <= JENDELA_BUFFER_GNSS_MS && (b.akurasi ?? 999) <= Math.max(65, akurasiBaru * 2.5);
        });

  const bufferBaru = [...bufferDasar, kandidat].slice(-MAKS_BUFFER_GNSS);
  // Ketika kunci satelit sudah ketat (<= 15 m), pertahankan koordinat terbaru tanpa inertia lag agar deteksi gerak & berhenti instan.
  // Ketika sinyal lebih lemah (> 15 m, mis. kanopi rapat/cold-start offline), gunakan rata-rata terbobot 1/akurasi^2 untuk meredam jitter.
  const posisiOptimal = akurasiBaru <= 15 ? kandidat : hitungRataTerbobotGnss(bufferBaru, kandidat);

  const akAkhir = posisiOptimal.akurasi ?? 99;
  const modeSinyal: ModeSinyalGnss = akAkhir <= 15 ? "gnss_optimal" : akAkhir <= 35 ? "gnss_standar" : "pencarian_satelit";
  return { posisi: posisiOptimal, buffer: bufferBaru, modeSinyal };
}

/* ---------- GPS ---------- */

let watchId: number | null = null;
let timerWarmupOffline: number | null = null;
let bufferGnss: KoordinatTitik[] = [];
let posisiSebelumnya: KoordinatTitik | null = null;

function mulaiGps() {
  if (watchId !== null) return;
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    setState({ statusGps: "tidak_tersedia" });
    return;
  }
  const prosesPosisiMentah = (pos: GeolocationPosition) => {
    const tsMs = pos.timestamp || Date.now();
    const ptDasar: KoordinatTitik = {
      lat: Number(pos.coords.latitude.toFixed(7)),
      lng: Number(pos.coords.longitude.toFixed(7)),
      elevasi: pos.coords.altitude != null && Number.isFinite(pos.coords.altitude) ? Math.round(pos.coords.altitude) : undefined,
      akurasi: pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy) ? Number(pos.coords.accuracy.toFixed(1)) : undefined,
      akurasiVertikal:
        pos.coords.altitudeAccuracy != null && Number.isFinite(pos.coords.altitudeAccuracy)
          ? Number(pos.coords.altitudeAccuracy.toFixed(1))
          : undefined,
      timestamp: new Date(tsMs).toISOString()
    };
    const hasilGnss = optimasiFixGnss(ptDasar, bufferGnss);
    bufferGnss = hasilGnss.buffer;
    const ptOptimal = hasilGnss.posisi;

    const tPrev = posisiSebelumnya ? Date.parse(posisiSebelumnya.timestamp ?? "") : NaN;
    const speedSensor = pos.coords.speed != null && Number.isFinite(pos.coords.speed) && pos.coords.speed >= 0 ? pos.coords.speed : null;
    const kecepatan = hitungKecepatanMps(ptOptimal, posisiSebelumnya, speedSensor);
    const posisiBaru: KoordinatTitik = { ...ptOptimal, kecepatan };
    const selisihDetik = Number.isFinite(tPrev) ? (tsMs - tPrev) / 1000 : Infinity;
    if (!posisiSebelumnya || speedSensor !== null || selisihDetik >= INTERVAL_MIN_KECEPATAN_S) {
      posisiSebelumnya = posisiBaru;
    }
    setState({
      statusGps: "aktif",
      posisi: posisiBaru
    });
  };

  try {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    watchId = navigator.geolocation.watchPosition(
      prosesPosisiMentah,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          posisiSebelumnya = null;
          bufferGnss = [];
          setState({ statusGps: "ditolak", posisi: null });
        } else if (err.code === err.POSITION_UNAVAILABLE) setState({ statusGps: "galat" });
        else if (state.posisi) setState({ statusGps: "galat" });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: offline ? 30000 : 18000 }
    );

    // GPS dimulai ulang setiap kembali ke peta (status dikosongkan saat berhenti). Saat perangkat diam,
    // pemantau baru bisa lama tidak menerima fix, sehingga tombol "Posisi saya" mati dan titik tidak
    // membawa akurasi. Minta fix terakhir yang masih segar (maks. 30 detik) agar langsung aktif kembali.
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (watchId !== null && !state.posisi) prosesPosisiMentah(pos);
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
    } catch {
      // abaikan bila peramban menolak permintaan tambahan
    }

    // Pancingan warm-up GNSS khusus kondisi luring agar hardware cepat mengunci satelit tanpa A-GPS jaringan
    if (typeof window !== "undefined") {
      timerWarmupOffline = window.setTimeout(() => {
        const akurasiKini = state.posisi?.akurasi ?? 999;
        if (akurasiKini > 35 && typeof navigator !== "undefined" && navigator.geolocation) {
          try {
            navigator.geolocation.getCurrentPosition(prosesPosisiMentah, () => undefined, {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 25000
            });
          } catch {
            // abaikan bila panggilan tambahan ditolak
          }
        }
      }, 6000);
    }
  } catch {
    watchId = null;
    setState({ statusGps: "tidak_tersedia" });
  }
}

function hentikanGps() {
  if (timerWarmupOffline !== null && typeof window !== "undefined") {
    window.clearTimeout(timerWarmupOffline);
  }
  timerWarmupOffline = null;
  if (watchId !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
  posisiSebelumnya = null;
  bufferGnss = [];
  state = { ...state, statusGps: "mencari", posisi: null };
}

/* ---------- Kompas ---------- */

let kompasTerpasang = false;
let timerKompas: number | null = null;
let arahHalus: number | null = null;
let terakhirEmitMs = 0;

type SuntikanIos = DeviceOrientationEvent & { webkitCompassHeading?: number };
type DeviceOrientationDenganIzin = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function perbaruiArah(arahMentah: number) {
  if (arahHalus === null) {
    arahHalus = arahMentah;
  } else {
    // Perataan melingkar agar jarum tidak bergetar dan tidak melompat di batas 0/360
    const delta = ((arahMentah - arahHalus + 540) % 360) - 180;
    arahHalus = (arahHalus + 0.35 * delta + 360) % 360;
  }
  const bulat = Math.round(arahHalus) % 360;
  const sekarang = Date.now();
  if (state.statusKompas === "aktif") {
    if (state.arahDerajat === bulat) return;
    if (sekarang - terakhirEmitMs < 100) return;
  }
  terakhirEmitMs = sekarang;
  setState({ statusKompas: "aktif", arahDerajat: bulat });
}

function tanganiOrientasi(e: Event) {
  const ev = e as SuntikanIos;
  let arah: number | null = null;
  if (typeof ev.webkitCompassHeading === "number" && Number.isFinite(ev.webkitCompassHeading)) {
    arah = ev.webkitCompassHeading; // iOS
  } else if ((ev.type === "deviceorientationabsolute" || ev.absolute === true) && ev.alpha !== null && ev.alpha !== undefined) {
    arah = kompasDariOrientasi(ev.alpha, ev.beta ?? 0, ev.gamma ?? 0);
  }
  // Orientasi relatif (alpha sembarang) tidak menunjuk utara, jadi diabaikan
  if (arah !== null) perbaruiArah(arah);
}

let izinSudahDiminta = false;

/** Menunggu data sensor. Bila tidak ada yang datang: minta izin (iOS) atau nyatakan tidak tersedia. */
function mulaiTungguKompas() {
  if (timerKompas !== null) window.clearTimeout(timerKompas);
  setState({ statusKompas: "mencari" });
  timerKompas = window.setTimeout(() => {
    if (state.statusKompas !== "mencari") return;
    const DOE = DeviceOrientationEvent as DeviceOrientationDenganIzin;
    const perluIzin = typeof DOE.requestPermission === "function" && !izinSudahDiminta;
    setState({ statusKompas: perluIzin ? "perlu_izin" : "tidak_tersedia" });
  }, BATAS_TUNGGU_KOMPAS_MS);
}

/**
 * Mengunci orientasi layar perangkat ke mode portrait (tegak) jika didukung.
 * Menghindari aplikasi memutar viewport secara otomatis saat HP ditaruh rebah
 * untuk membaca kompas lapangan di telapak tangan.
 */
export function kunciOrientasiLayar(): void {
  if (typeof window === "undefined") return;
  try {
    const sO = (window.screen as any)?.orientation;
    if (sO && typeof sO.lock === "function") {
      sO.lock("portrait").catch(() => {});
    }
  } catch {}
}

function pasangKompas() {
  if (typeof window === "undefined") return;
  kunciOrientasiLayar();
  if (!kompasTerpasang) {
    kompasTerpasang = true;
    window.addEventListener("deviceorientationabsolute", tanganiOrientasi, true);
    window.addEventListener("deviceorientation", tanganiOrientasi, true);
  }
  mulaiTungguKompas();
}

function mulaiKompas() {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") {
    setState({ statusKompas: "tidak_tersedia" });
    return;
  }
  // Dengarkan dulu: banyak browser tidak membutuhkan izin. Bila tidak ada data, baru minta ketukan.
  pasangKompas();
}

function hentikanKompas() {
  if (typeof window !== "undefined") {
    window.removeEventListener("deviceorientationabsolute", tanganiOrientasi, true);
    window.removeEventListener("deviceorientation", tanganiOrientasi, true);
    if (timerKompas !== null) window.clearTimeout(timerKompas);
  }
  timerKompas = null;
  kompasTerpasang = false;
  arahHalus = null;
  state = { ...state, statusKompas: "mencari", arahDerajat: null };
}

/** Dipanggil dari ketukan pengguna (wajib di iOS) untuk menyalakan kompas */
export async function aktifkanKompas(): Promise<void> {
  kunciOrientasiLayar();
  if (typeof DeviceOrientationEvent === "undefined") {
    setState({ statusKompas: "tidak_tersedia" });
    return;
  }
  const DOE = DeviceOrientationEvent as DeviceOrientationDenganIzin;
  if (typeof DOE.requestPermission === "function") {
    try {
      const hasil = await DOE.requestPermission();
      izinSudahDiminta = true;
      if (hasil !== "granted") {
        setState({ statusKompas: "ditolak" });
        return;
      }
    } catch {
      izinSudahDiminta = true;
      setState({ statusKompas: "ditolak" });
      return;
    }
  }
  pasangKompas();
}

/* ---------- Hook ---------- */

function subscribe(fn: () => void) {
  pendengar.add(fn);
  if (pendengar.size === 1) {
    mulaiGps();
    mulaiKompas();
  }
  return () => {
    pendengar.delete(fn);
    if (pendengar.size === 0) {
      hentikanGps();
      hentikanKompas();
    }
  };
}

export function usePosisiPerangkat(): StatePosisiPerangkat {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );
}

/** Pengambilan fix selama 5–15 detik, bisa dibatalkan saat form ditutup. */
export async function ambilRataRataGps(
  opsi: {
    durasiDetik?: number;
    minimalSampel?: number;
    signal?: AbortSignal;
    progres?: (jumlah: number) => void;
  } = {}
): Promise<import("../types").HasilRataRataGps> {
  const durasi = opsi.durasiDetik ?? 10,
    minimum = opsi.minimalSampel ?? 3;
  if (!Number.isFinite(durasi) || durasi < 5 || durasi > 15 || !Number.isInteger(minimum) || minimum < 1)
    throw new Error("Pengaturan GPS averaging tidak valid.");
  if (typeof navigator === "undefined" || !navigator.geolocation) throw new Error("GPS perangkat tidak tersedia.");
  return new Promise((resolve, reject) => {
    if (opsi.signal?.aborted) {
      reject(new DOMException("Dibatalkan", "AbortError"));
      return;
    }
    let watch: number | undefined,
      selesai = false;
    const sampel: KoordinatTitik[] = [],
      waktu = new Set<number>();
    const bersih = () => {
      selesai = true;
      clearTimeout(timer);
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      opsi.signal?.removeEventListener("abort", batal);
    };
    const batal = () => {
      bersih();
      reject(new DOMException("Dibatalkan", "AbortError"));
    };
    const timer = setTimeout(() => {
      bersih();
      if (sampel.length < minimum) {
        reject(new Error(`GPS belum cukup: ${sampel.length}/${minimum} sampel. Coba di tempat lebih terbuka.`));
        return;
      }
      try {
        // Prioritaskan sampel satelit ketat bila jumlahnya mencukupi (mencegah bias fix awal offline)
        const sampelKetat = sampel.filter((s) => (s.akurasi ?? 99) <= 28);
        const pilihan = sampelKetat.length >= minimum ? sampelKetat : sampel;
        resolve(hitungRataRataGps(pilihan));
      } catch (e) {
        reject(e);
      }
    }, durasi * 1000);
    opsi.signal?.addEventListener("abort", batal, { once: true });
    try {
      watch = navigator.geolocation.watchPosition(
        (p) => {
          if (selesai || waktu.has(p.timestamp)) return;
          const t: KoordinatTitik = {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            akurasi: p.coords.accuracy,
            elevasi: p.coords.altitude ?? undefined,
            timestamp: new Date(p.timestamp).toISOString()
          };
          if (!koordinatValid(t) || p.coords.accuracy > 50) return;
          waktu.add(p.timestamp);
          sampel.push(t);
          opsi.progres?.(sampel.length);
        },
        (e) => {
          bersih();
          reject(new Error(e.code === 1 ? "Izin GPS ditolak." : "Sampel GPS tidak tersedia."));
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: durasi * 1000 }
      );
      if (selesai) navigator.geolocation.clearWatch(watch);
    } catch (e) {
      bersih();
      reject(e);
    }
  });
}
