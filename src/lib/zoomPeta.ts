import { ZOOM_MAKS_PETA, ZOOM_MIN_PETA } from "./posisiPeta";

/**
 * Perhitungan zoom cubit (dua jari) dan roda tetikus. Fungsi murni agar mudah diuji; peta hanya
 * meneruskan posisi jari. Titik di bawah jari tetap di bawah jari selama dicubit, seperti peta
 * pada umumnya: dua jari menjauh = perbesar, mendekat = perkecil.
 */

const UKURAN_TILE = 256;
const BATAS_LINTANG = 85;

export interface TitikLayar {
  x: number;
  y: number;
}

/** Posisi dunia Web Mercator sebagai pecahan 0..1 (kiri-atas = 0,0) */
export interface PecahanDunia {
  fx: number;
  fy: number;
}

export const jepitZoom = (z: number): number => Math.min(ZOOM_MAKS_PETA, Math.max(ZOOM_MIN_PETA, z));

const lebarDunia = (zoom: number) => UKURAN_TILE * Math.pow(2, zoom);

function keFy(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
}

function dariFy(fy: number): number {
  const n = Math.PI * (1 - 2 * fy);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** Titik dunia yang berada di bawah titik layar (sx, sy) pada kanvas selebar W x H */
export function pecahanDiLayar(pusat: { lat: number; lng: number }, zoom: number, titik: TitikLayar, W: number, H: number): PecahanDunia {
  const d = lebarDunia(zoom);
  return {
    fx: (pusat.lng + 180) / 360 + (titik.x - W / 2) / d,
    fy: keFy(pusat.lat) + (titik.y - H / 2) / d
  };
}

/** Pusat peta baru supaya titik dunia `jangkar` tampil tepat di titik layar `titik` pada zoom ini */
export function pusatUntukJangkar(
  jangkar: PecahanDunia,
  zoom: number,
  titik: TitikLayar,
  W: number,
  H: number
): { lat: number; lng: number } {
  const d = lebarDunia(zoom);
  const fx = jangkar.fx - (titik.x - W / 2) / d;
  const fy = jangkar.fy - (titik.y - H / 2) / d;
  return {
    lat: Math.max(-BATAS_LINTANG, Math.min(BATAS_LINTANG, dariFy(fy))),
    lng: Math.max(-180, Math.min(180, fx * 360 - 180))
  };
}

/** Zoom setelah jarak dua jari berubah dari `jarakAwal` menjadi `jarakKini` (dua kali jarak = +1 level) */
export function zoomCubit(zoomAwal: number, jarakAwal: number, jarakKini: number): number {
  if (!(jarakAwal > 0) || !(jarakKini > 0)) return jepitZoom(zoomAwal);
  return jepitZoom(zoomAwal + Math.log2(jarakKini / jarakAwal));
}

/**
 * Perubahan zoom untuk satu event roda. Cubit di trackpad laptop dikirim browser sebagai roda
 * dengan ctrlKey dan delta kecil, jadi diberi pengali lebih besar.
 */
export function langkahZoomRoda(deltaY: number, deltaMode: number, ctrlKey: boolean): number {
  const piksel = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const langkah = ctrlKey ? -piksel * 0.01 : -piksel / 240;
  return Math.max(-1, Math.min(1, langkah));
}

export const jarakDuaTitik = (a: TitikLayar, b: TitikLayar): number => Math.hypot(a.x - b.x, a.y - b.y);
export const tengahDuaTitik = (a: TitikLayar, b: TitikLayar): TitikLayar => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
