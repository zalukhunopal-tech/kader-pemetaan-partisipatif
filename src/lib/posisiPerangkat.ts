import { useSyncExternalStore } from "react";
import { KoordinatTitik } from "../types";
import { hitungJarakMeter } from "./geoUtils";

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

/* ---------- GPS ---------- */

let watchId: number | null = null;

function mulaiGps() {
  if (watchId !== null) return;
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    setState({ statusGps: "tidak_tersedia" });
    return;
  }
  try {
    watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setState({
          statusGps: "aktif",
          posisi: {
            lat: Number(pos.coords.latitude.toFixed(7)),
            lng: Number(pos.coords.longitude.toFixed(7)),
            elevasi: pos.coords.altitude != null && Number.isFinite(pos.coords.altitude) ? Math.round(pos.coords.altitude) : undefined,
            akurasi: Number(pos.coords.accuracy.toFixed(1)),
            timestamp: new Date(pos.timestamp).toISOString()
          }
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState({ statusGps: "ditolak", posisi: null });
        else if (err.code === err.POSITION_UNAVAILABLE) setState({ statusGps: "galat" });
        else if (state.posisi) setState({ statusGps: "galat" });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  } catch {
    watchId = null;
    setState({ statusGps: "tidak_tersedia" });
  }
}

function hentikanGps() {
  if (watchId !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
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

function pasangKompas() {
  if (typeof window === "undefined") return;
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
