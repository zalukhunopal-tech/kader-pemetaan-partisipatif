/**
 * Sistem koordinat tampilan & input untuk kader lapangan.
 * - DD  : Derajat desimal (WGS 84)
 * - DDM : Derajat + menit desimal (format GPS genggam / Garmin)
 * - DMS : Derajat, menit, detik
 * - UTM : Universal Transverse Mercator (WGS 84), zona 6°
 * - TM3 : Transverse Mercator 3° Indonesia (BPN / ATR, SRGI2013 ≈ WGS 84), zona 46.2 – 54.1
 *
 * Semua proyeksi TM dihitung dengan deret Krüger orde-3 (akurasi milimeter di dalam zona).
 */

export type SistemKoordinat = "DD" | "DDM" | "DMS" | "UTM" | "TM3";

export interface InfoSistemKoordinat {
  id: SistemKoordinat;
  nama: string;
  singkat: string;
  contoh: string;
  keterangan: string;
}

export const DAFTAR_SISTEM_KOORDINAT: InfoSistemKoordinat[] = [
  { id: "DD", nama: "Derajat Desimal", singkat: "DD", contoh: "2.857472°, 117.377476°", keterangan: "WGS 84 · Google Maps & GPS HP" },
  { id: "DMS", nama: "Derajat Menit Detik", singkat: "DMS", contoh: "2°51'26.9\" LU", keterangan: "WGS 84 · peta cetak & dokumen" },
  { id: "DDM", nama: "Derajat Menit Desimal", singkat: "DDM", contoh: "2°51.448' LU", keterangan: "WGS 84 · GPS Garmin" },
  { id: "UTM", nama: "UTM", singkat: "UTM", contoh: "50N 541 932 mE", keterangan: "WGS 84 · zona 6°, satuan meter" },
  { id: "TM3", nama: "TM-3 Indonesia", singkat: "TM-3", contoh: "50.1 · X 381 245", keterangan: "SRGI2013 · zona 3°, standar BPN" }
];

const KUNCI_SIMPAN = "titik-tapak:sistem-koordinat";

export function bacaSistemKoordinat(): SistemKoordinat {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(KUNCI_SIMPAN) : null;
    if (v && DAFTAR_SISTEM_KOORDINAT.some((s) => s.id === v)) return v as SistemKoordinat;
  } catch {
    // penyimpanan tidak tersedia
  }
  return "DD";
}

export function simpanSistemKoordinat(s: SistemKoordinat): void {
  try {
    localStorage.setItem(KUNCI_SIMPAN, s);
  } catch {
    // abaikan
  }
}

/* ------------------------------------------------------------------ */
/* Proyeksi Transverse Mercator generik (WGS 84)                       */
/* ------------------------------------------------------------------ */

const A = 6378137;
const F = 1 / 298.257223563;
const E = Math.sqrt(F * (2 - F));
const N_ = F / (2 - F);
const A_BULAT = (A / (1 + N_)) * (1 + (N_ * N_) / 4 + (N_ ** 4) / 64);
const ALFA = [N_ / 2 - (2 * N_ ** 2) / 3 + (5 * N_ ** 3) / 16, (13 * N_ ** 2) / 48 - (3 * N_ ** 3) / 5, (61 * N_ ** 3) / 240];
const BETA = [N_ / 2 - (2 * N_ ** 2) / 3 + (37 * N_ ** 3) / 96, N_ ** 2 / 48 + N_ ** 3 / 15, (17 * N_ ** 3) / 480];
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

interface ParamTM {
  lon0: number;
  k0: number;
  fe: number;
  fn: number;
}

export function proyeksiTM(lat: number, lng: number, p: ParamTM): { x: number; y: number } {
  const phi = rad(lat);
  const dL = rad(lng - p.lon0);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - E * Math.atanh(E * Math.sin(phi)));
  const xi0 = Math.atan2(t, Math.cos(dL));
  const eta0 = Math.atanh(Math.sin(dL) / Math.sqrt(1 + t * t));
  let xi = xi0;
  let eta = eta0;
  for (let j = 1; j <= 3; j++) {
    xi += ALFA[j - 1] * Math.sin(2 * j * xi0) * Math.cosh(2 * j * eta0);
    eta += ALFA[j - 1] * Math.cos(2 * j * xi0) * Math.sinh(2 * j * eta0);
  }
  return { x: p.fe + p.k0 * A_BULAT * eta, y: p.fn + p.k0 * A_BULAT * xi };
}

export function inversTM(x: number, y: number, p: ParamTM): { lat: number; lng: number } {
  const eta = (x - p.fe) / (p.k0 * A_BULAT);
  const xi = (y - p.fn) / (p.k0 * A_BULAT);
  let xi1 = xi;
  let eta1 = eta;
  for (let j = 1; j <= 3; j++) {
    xi1 -= BETA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    eta1 -= BETA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1));
  let phi = chi;
  for (let i = 0; i < 12; i++) {
    const s = E * Math.sin(phi);
    const baru = 2 * Math.atan(Math.tan(Math.PI / 4 + chi / 2) * Math.pow((1 + s) / (1 - s), E / 2)) - Math.PI / 2;
    if (Math.abs(baru - phi) < 1e-13) {
      phi = baru;
      break;
    }
    phi = baru;
  }
  const lng = p.lon0 + deg(Math.atan2(Math.sinh(eta1), Math.cos(xi1)));
  return { lat: deg(phi), lng };
}

/* ------------------------------------------------------------------ */
/* UTM & TM-3                                                          */
/* ------------------------------------------------------------------ */

export interface HasilProyeksi {
  zona: string;
  x: number;
  y: number;
}

export function keUtm(lat: number, lng: number): HasilProyeksi | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -80 || lat > 84) return null;
  const z = Math.min(60, Math.floor((lng + 180) / 6) + 1);
  const { x, y } = proyeksiTM(lat, lng, { lon0: (z - 1) * 6 - 177, k0: 0.9996, fe: 500000, fn: lat < 0 ? 10000000 : 0 });
  return { zona: `${z}${lat >= 0 ? "N" : "S"}`, x, y };
}

export function dariUtm(x: number, y: number, zona: string): { lat: number; lng: number } | null {
  const m = /^(\d{1,2})\s*([NS])$/i.exec(zona.trim());
  if (!m) return null;
  const z = Number(m[1]);
  if (z < 1 || z > 60) return null;
  const selatan = m[2].toUpperCase() === "S";
  return inversTM(x, y, { lon0: (z - 1) * 6 - 177, k0: 0.9996, fe: 500000, fn: selatan ? 10000000 : 0 });
}

/** Bujur tengah zona TM-3 Indonesia: 94.5°, 97.5°, … 139.5° (berlaku 93°–141° BT). */
export function zonaTm3(lng: number): { kode: string; lon0: number } | null {
  if (!Number.isFinite(lng) || lng < 93 || lng > 141) return null;
  const idx = Math.min(15, Math.floor((lng - 93) / 3));
  const lon0 = 94.5 + idx * 3;
  const zUtm = Math.floor((lon0 + 180) / 6) + 1;
  const tengahUtm = (zUtm - 1) * 6 - 177;
  return { kode: `${zUtm}.${lon0 < tengahUtm ? 1 : 2}`, lon0 };
}

const PARAM_TM3 = { k0: 0.9999, fe: 200000, fn: 1500000 };

export function keTm3(lat: number, lng: number): HasilProyeksi | null {
  const z = zonaTm3(lng);
  if (!z || lat < -15 || lat > 10) return null;
  const { x, y } = proyeksiTM(lat, lng, { lon0: z.lon0, ...PARAM_TM3 });
  return { zona: z.kode, x, y };
}

export function dariTm3(x: number, y: number, kode: string): { lat: number; lng: number } | null {
  const m = /^(\d{2})\.([12])$/.exec(kode.trim());
  if (!m) return null;
  const zUtm = Number(m[1]);
  const tengahUtm = (zUtm - 1) * 6 - 177;
  const lon0 = tengahUtm + (m[2] === "1" ? -1.5 : 1.5);
  if (lon0 < 94.5 || lon0 > 139.5) return null;
  return inversTM(x, y, { lon0, ...PARAM_TM3 });
}

/* ------------------------------------------------------------------ */
/* Format tampilan terstruktur                                          */
/* ------------------------------------------------------------------ */

export interface BarisKoordinat {
  label: string;
  nilai: string;
}

export interface KoordinatTerformat {
  sistem: SistemKoordinat;
  baris: [BarisKoordinat, BarisKoordinat];
  /** Info pendukung: zona / datum */
  keterangan: string;
  /** Satu baris ringkas untuk pill telemetri */
  ringkas: string;
  /** Teks untuk disalin ke papan klip */
  salin: string;
}

const ribuan = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function dms(val: number, pos: string, neg: string, menitDesimal: boolean): string {
  const arah = val >= 0 ? pos : neg;
  const abs = Math.abs(val);
  let d = Math.floor(abs);
  const mF = (abs - d) * 60;
  if (menitDesimal) {
    let m = Number(mF.toFixed(3));
    if (m >= 60) {
      m = 0;
      d += 1;
    }
    return `${d}°${m.toFixed(3)}' ${arah}`;
  }
  let m = Math.floor(mF);
  let s = Number(((mF - m) * 60).toFixed(1));
  if (s >= 60) {
    s = 0;
    m += 1;
  }
  if (m >= 60) {
    m = 0;
    d += 1;
  }
  return `${d}°${String(m).padStart(2, "0")}'${s.toFixed(1).padStart(4, "0")}" ${arah}`;
}

export function formatKoordinat(lat: number, lng: number, sistem: SistemKoordinat): KoordinatTerformat {
  const latDD = `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? "LU" : "LS"}`;
  const lngDD = `${Math.abs(lng).toFixed(6)}° ${lng >= 0 ? "BT" : "BB"}`;
  const salinDD = `${lat.toFixed(7)}, ${lng.toFixed(7)}`;

  if (sistem === "DMS" || sistem === "DDM") {
    const md = sistem === "DDM";
    const a = dms(lat, "LU", "LS", md);
    const b = dms(lng, "BT", "BB", md);
    return {
      sistem,
      baris: [
        { label: "Lintang", nilai: a },
        { label: "Bujur", nilai: b }
      ],
      keterangan: "WGS 84",
      ringkas: `${a}  ${b}`,
      salin: `${a}, ${b}`
    };
  }

  if (sistem === "UTM" || sistem === "TM3") {
    const h = sistem === "UTM" ? keUtm(lat, lng) : keTm3(lat, lng);
    if (h) {
      const xs = sistem === "UTM" ? ribuan(h.x) : h.x.toFixed(1);
      const ys = sistem === "UTM" ? ribuan(h.y) : h.y.toFixed(1);
      const label = sistem === "UTM" ? `Zona ${h.zona} · WGS 84` : `Zona ${h.zona} · TM-3 SRGI2013`;
      return {
        sistem,
        baris: [
          { label: sistem === "UTM" ? "Timur (E)" : "X", nilai: `${xs} m` },
          { label: sistem === "UTM" ? "Utara (N)" : "Y", nilai: `${ys} m` }
        ],
        keterangan: label,
        ringkas: `${h.zona}  ${xs} E  ${ys} N`,
        salin: `${sistem === "UTM" ? "UTM" : "TM-3"} ${h.zona} ${h.x.toFixed(sistem === "UTM" ? 0 : 2)} ${h.y.toFixed(sistem === "UTM" ? 0 : 2)}`
      };
    }
    return {
      sistem,
      baris: [
        { label: "Lintang", nilai: latDD },
        { label: "Bujur", nilai: lngDD }
      ],
      keterangan: sistem === "TM3" ? "Di luar zona TM-3 Indonesia · ditampilkan WGS 84" : "Di luar cakupan UTM · ditampilkan WGS 84",
      ringkas: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      salin: salinDD
    };
  }

  return {
    sistem: "DD",
    baris: [
      { label: "Lintang", nilai: latDD },
      { label: "Bujur", nilai: lngDD }
    ],
    keterangan: "WGS 84",
    ringkas: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    salin: salinDD
  };
}

/* ------------------------------------------------------------------ */
/* Input manual                                                         */
/* ------------------------------------------------------------------ */

/** Sistem yang dipakai untuk input manual (DMS/DDM diisi sebagai desimal agar mudah di HP). */
export function sistemInput(sistem: SistemKoordinat): "DD" | "UTM" | "TM3" {
  return sistem === "UTM" || sistem === "TM3" ? sistem : "DD";
}

export interface IsianKoordinatManual {
  a: string;
  b: string;
  zona: string;
}

export function isianDariTitik(lat: number, lng: number, sistem: SistemKoordinat): IsianKoordinatManual {
  const s = sistemInput(sistem);
  if (s !== "DD") {
    const h = s === "UTM" ? keUtm(lat, lng) : keTm3(lat, lng);
    if (h) return { a: h.x.toFixed(s === "UTM" ? 0 : 2), b: h.y.toFixed(s === "UTM" ? 0 : 2), zona: h.zona };
  }
  return { a: lat.toFixed(7), b: lng.toFixed(7), zona: "" };
}

const angka = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));

export function parseIsianManual(
  isian: IsianKoordinatManual,
  sistem: SistemKoordinat
): { lat: number; lng: number } | { galat: string } {
  const s = sistemInput(sistem);
  const a = angka(isian.a);
  const b = angka(isian.b);
  if (!Number.isFinite(a) || !Number.isFinite(b) || isian.a.trim() === "" || isian.b.trim() === "") {
    return { galat: "Isi kedua kolom dengan angka." };
  }
  if (s === "DD") {
    if (a < -90 || a > 90) return { galat: "Lintang harus antara -90 dan 90." };
    if (b < -180 || b > 180) return { galat: "Bujur harus antara -180 dan 180." };
    return { lat: a, lng: b };
  }
  const hasil = s === "UTM" ? dariUtm(a, b, isian.zona) : dariTm3(a, b, isian.zona);
  if (!hasil) return { galat: s === "UTM" ? "Zona UTM tidak valid (contoh: 50N)." : "Zona TM-3 tidak valid (contoh: 50.1)." };
  if (!Number.isFinite(hasil.lat) || Math.abs(hasil.lat) > 90) return { galat: "Nilai koordinat di luar jangkauan." };
  return { lat: Number(hasil.lat.toFixed(7)), lng: Number(hasil.lng.toFixed(7)) };
}
