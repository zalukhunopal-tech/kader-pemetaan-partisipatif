import { useSyncExternalStore } from "react";
import { KoordinatTitik } from "../types";
import { hitungJarakMeter, hitungLuasPoligonHa, hitungPanjangGarisKm } from "./geoUtils";

/**
 * PEREKAM LATAR BELAKANG (Background Recorder)
 * - Berjalan di luar siklus hidup komponen React sehingga perekaman tetap berlanjut
 *   walaupun kader berpindah tab/menu (Pustaka, Sertifikat, Diskusi, GDrive, dll)
 *   maupun ketika layar/aplikasi diminimalkan.
 * - Menggunakan navigator.geolocation.watchPosition (GPS perangkat) + interval latar belakang.
 * - Menyimpan jejak ke localStorage setiap ada titik baru, sehingga aman
 *   walau aplikasi tertutup / dimuat ulang.
 * - Meminta Screen Wake Lock agar layar tidak mati & GPS tidak dihentikan OS.
 */

export type StatusPerekam = "idle" | "merekam" | "dijeda";
export type JenisRekamLatar = "line" | "polygon";

export interface StatePerekamLatar {
  status: StatusPerekam;
  jenis: JenisRekamLatar | null;
  titik: KoordinatTitik[];
  mulaiPada: string | null;
  /** Total milidetik saat merekam (tidak termasuk saat dijeda) */
  durasiTersimpanMs: number;
  /** Timestamp (ms) saat segmen merekam terakhir dimulai */
  segmenMulaiMs: number | null;
  posisiTerakhir: KoordinatTitik | null;
  autoGpsAktif: boolean;
  galat: string | null;
}

const KUNCI = "kader_pemetaan_rekam_latar_v1";
const JARAK_MIN_METER = 3; // abaikan getaran GPS < 3 m
const AKURASI_MAKS_METER = 50; // abaikan titik dengan akurasi buruk

const STATE_AWAL: StatePerekamLatar = {
  status: "idle",
  jenis: null,
  titik: [],
  mulaiPada: null,
  durasiTersimpanMs: 0,
  segmenMulaiMs: null,
  posisiTerakhir: null,
  autoGpsAktif: false,
  galat: null
};

function muat(): StatePerekamLatar {
  try {
    const raw = localStorage.getItem(KUNCI);
    if (!raw) return STATE_AWAL;
    const s = JSON.parse(raw) as StatePerekamLatar;
    // Rekaman lama dengan Auto GPS aktif memuat titik acak: tandai sebagai simulasi dan matikan timernya
    const titik = (s.titik ?? []).map((t) => (s.autoGpsAktif ? { ...t, simulasi: true } : t));
    return { ...STATE_AWAL, ...s, titik, autoGpsAktif: false, galat: null };
  } catch {
    return STATE_AWAL;
  }
}

let state: StatePerekamLatar = muat();
const pendengar = new Set<() => void>();
let watchId: number | null = null;
let autoTimerId: number | null = null;
let wakeLock: { release: () => Promise<void> } | null = null;

function setState(patch: Partial<StatePerekamLatar>) {
  state = { ...state, ...patch };
  try {
    if (state.status === "idle") localStorage.removeItem(KUNCI);
    else localStorage.setItem(KUNCI, JSON.stringify(state));
  } catch {
    /* penyimpanan penuh: tetap lanjut di memori */
  }
  pendengar.forEach((fn) => fn());
}

async function mintaWakeLock() {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock && !wakeLock) {
      wakeLock = await nav.wakeLock.request("screen");
    }
  } catch {
    wakeLock = null;
  }
}

function lepasWakeLock() {
  wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}

function tanganiPosisi(pos: GeolocationPosition) {
  const pt: KoordinatTitik = {
    lat: Number(pos.coords.latitude.toFixed(7)),
    lng: Number(pos.coords.longitude.toFixed(7)),
    elevasi: pos.coords.altitude != null ? Math.round(pos.coords.altitude) : undefined,
    akurasi: Number(pos.coords.accuracy.toFixed(1)),
    timestamp: new Date(pos.timestamp).toISOString()
  };

  if (state.status !== "merekam") {
    setState({ posisiTerakhir: pt });
    return;
  }

  if ((pt.akurasi ?? 0) > AKURASI_MAKS_METER) {
    setState({ posisiTerakhir: pt, galat: `Sinyal GPS lemah (±${Math.round(pt.akurasi ?? 0)} m)` });
    return;
  }

  const akhir = state.titik[state.titik.length - 1];
  if (akhir && hitungJarakMeter(akhir, pt) < JARAK_MIN_METER) {
    setState({ posisiTerakhir: pt, galat: null });
    return;
  }

  setState({ titik: [...state.titik, pt], posisiTerakhir: pt, galat: null });
}

function tanganiGalat(err: GeolocationPositionError) {
  // Mode simulasi tidak bergantung pada GPS perangkat, jadi galat GPS tidak ditampilkan saat simulasi aktif
  if (!state.autoGpsAktif) {
    const pesan =
      err.code === err.PERMISSION_DENIED
        ? "GPS perangkat belum diizinkan. Izinkan akses lokasi di pengaturan browser."
        : "Sinyal GPS belum didapat. Pindah ke tempat terbuka lalu coba lagi.";
    setState({ galat: pesan });
  }
}

function sinkronkanAutoTimer() {
  if (autoTimerId !== null) {
    window.clearInterval(autoTimerId);
    autoTimerId = null;
  }
  if (state.status === "merekam" && state.autoGpsAktif && typeof window !== "undefined") {
    autoTimerId = window.setInterval(() => {
      if (state.status !== "merekam" || !state.autoGpsAktif) return;
      const ref = state.titik[state.titik.length - 1] ||
        state.posisiTerakhir || {
          lat: -0.9478,
          lng: 100.4185,
          elevasi: 418,
          akurasi: 2.5
        };
      const nextLat = Number((ref.lat + (Math.random() - 0.35) * 0.00042).toFixed(6));
      const nextLng = Number((ref.lng + (Math.random() - 0.3) * 0.00042).toFixed(6));
      const nextElev = Math.round((ref.elevasi || 415) + (Math.random() - 0.45) * 3);
      const ptBaru: KoordinatTitik = {
        lat: nextLat,
        lng: nextLng,
        elevasi: nextElev,
        akurasi: Number((2.1 + Math.random() * 1.4).toFixed(1)),
        timestamp: new Date().toISOString(),
        simulasi: true
      };
      setState({
        titik: [...state.titik, ptBaru],
        posisiTerakhir: ptBaru,
        galat: null
      });
    }, 2000);
  }
}

function mulaiWatch() {
  if (typeof navigator !== "undefined" && "geolocation" in navigator && watchId === null) {
    try {
      watchId = navigator.geolocation.watchPosition(tanganiPosisi, tanganiGalat, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      });
    } catch {
      watchId = null;
    }
  }
  mintaWakeLock();
  sinkronkanAutoTimer();
}

function hentikanWatch() {
  if (watchId !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
  if (autoTimerId !== null && typeof window !== "undefined") {
    window.clearInterval(autoTimerId);
    autoTimerId = null;
  }
  lepasWakeLock();
}

// Wake Lock otomatis dilepas browser saat tab disembunyikan: minta lagi saat kembali
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.status === "merekam") {
      wakeLock = null;
      mintaWakeLock();
    }
  });
}

// Lanjutkan perekaman yang masih aktif sebelum aplikasi ditutup / dimuat ulang
if (typeof window !== "undefined" && state.status === "merekam") {
  setState({ segmenMulaiMs: Date.now() });
  mulaiWatch();
}

export const perekamLatar = {
  getState: () => state,

  subscribe(fn: () => void) {
    pendengar.add(fn);
    return () => {
      pendengar.delete(fn);
    };
  },

  /** autoGps = mode simulasi (titik acak untuk demo/pelatihan); mati secara bawaan */
  mulai(jenis: JenisRekamLatar, titikAwal: KoordinatTitik[] = [], autoGps = false) {
    setState({
      status: "merekam",
      jenis,
      titik: titikAwal,
      mulaiPada: new Date().toISOString(),
      durasiTersimpanMs: 0,
      segmenMulaiMs: Date.now(),
      posisiTerakhir: titikAwal[titikAwal.length - 1] || state.posisiTerakhir,
      autoGpsAktif: autoGps,
      galat: null
    });
    mulaiWatch();
  },

  toggleAutoGps() {
    const baru = !state.autoGpsAktif;
    setState({ autoGpsAktif: baru });
    sinkronkanAutoTimer();
  },

  jeda() {
    if (state.status !== "merekam") return;
    setState({
      status: "dijeda",
      durasiTersimpanMs: state.durasiTersimpanMs + (Date.now() - (state.segmenMulaiMs ?? Date.now())),
      segmenMulaiMs: null
    });
    hentikanWatch();
  },

  lanjutkan() {
    if (state.status !== "dijeda") return;
    setState({ status: "merekam", segmenMulaiMs: Date.now() });
    mulaiWatch();
  },

  tambahTitik(pt: KoordinatTitik) {
    if (state.status === "idle") return;
    setState({
      titik: [...state.titik, pt],
      posisiTerakhir: pt
    });
  },

  /** Hentikan & kembalikan seluruh titik yang terekam */
  selesai(): KoordinatTitik[] {
    const hasil = state.titik;
    hentikanWatch();
    setState({ ...STATE_AWAL });
    return hasil;
  },

  batal() {
    hentikanWatch();
    setState({ ...STATE_AWAL });
  }
};

export function durasiRekamMs(s: StatePerekamLatar): number {
  return (
    s.durasiTersimpanMs +
    (s.status === "merekam" && s.segmenMulaiMs ? Date.now() - s.segmenMulaiMs : 0)
  );
}

export function formatDurasi(ms: number): string {
  const total = Math.floor(ms / 1000);
  const j = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const d = total % 60;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return j > 0 ? `${j}:${mm}:${dd}` : `${mm}:${dd}`;
}

export function ringkasanRekam(s: StatePerekamLatar): string {
  if (s.jenis === "polygon") return `${s.titik.length} sudut • ${hitungLuasPoligonHa(s.titik)} Ha`;
  return `${s.titik.length} titik • ${hitungPanjangGarisKm(s.titik)} km`;
}

export function usePerekamLatar(): StatePerekamLatar {
  return useSyncExternalStore(perekamLatar.subscribe, perekamLatar.getState, perekamLatar.getState);
}
