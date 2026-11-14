export type TahapDrawerGps = "tutup" | "ringkas" | "sedang" | "penuh";

export type TahapDrawerTerbuka = Exclude<TahapDrawerGps, "tutup">;

export interface SampelSentuh {
  y: number;
  waktuMs: number;
}

export interface GayaSeretDrawer {
  translateYPx: number;
  heightPx: number | null;
  backdropAlpha: number;
}

const AMBANG_JARAK_PX = 28;
const AMBANG_FLICK_PX = 16;
const AMBANG_KECEPATAN_MIN = 0.45;
const AMBANG_KECEPATAN_SEDANG = 0.95;
const AMBANG_KECEPATAN_CEPAT = 1.65;
const AMBANG_KECEPATAN_TUTUP_LANGSUNG = 1.05;
const MAKS_ALPHA_LATAR = 0.24;

function clamp(nilai: number, min: number, maks: number): number {
  return Math.min(maks, Math.max(min, nilai));
}

/**
 * Menghitung kecepatan vertikal (px/ms, positif = turun, negatif = naik)
 * dengan penyebut minimum 24ms agar lonjakan event sintetis tidak mengacaukan gestur.
 */
export function hitungKecepatanVertikal(awal: SampelSentuh, akhir: SampelSentuh): number {
  const dt = Math.max(akhir.waktuMs - awal.waktuMs, 24);
  return (akhir.y - awal.y) / dt;
}

/**
 * Menentukan tahap drawer setelah dilepas dari tarikan ke atas pada bilah bawah.
 */
export function tahapDariTarikanTutup(jarakNaikPx: number, kecepatanNaikPxPerMs: number): TahapDrawerGps {
  const lolosFlick = jarakNaikPx >= AMBANG_FLICK_PX && kecepatanNaikPxPerMs >= AMBANG_KECEPATAN_MIN;
  if (jarakNaikPx < AMBANG_JARAK_PX && !lolosFlick) {
    return "tutup";
  }
  if (jarakNaikPx >= 240 || kecepatanNaikPxPerMs >= AMBANG_KECEPATAN_CEPAT) {
    return "penuh";
  }
  if (jarakNaikPx >= 115 || kecepatanNaikPxPerMs >= AMBANG_KECEPATAN_SEDANG) {
    return "sedang";
  }
  return "ringkas";
}

/**
 * Menentukan tahap berikutnya secara bertahap (ringkas <-> sedang <-> penuh <-> tutup)
 * saat kepala drawer digeser ke atas (dy < 0) atau ke bawah (dy > 0).
 */
export function tahapBerikutnyaTerbuka(
  tahapSekarang: TahapDrawerTerbuka,
  dy: number,
  kecepatanTurunPxPerMs: number
): TahapDrawerGps {
  if (dy < 0) {
    const naik = -dy;
    const vNaik = -kecepatanTurunPxPerMs;
    const lolosFlick = naik >= AMBANG_FLICK_PX && vNaik >= AMBANG_KECEPATAN_MIN;
    if (naik < AMBANG_JARAK_PX && !lolosFlick) {
      return tahapSekarang;
    }
    if (tahapSekarang === "ringkas") {
      return naik >= 170 || vNaik >= AMBANG_KECEPATAN_CEPAT ? "penuh" : "sedang";
    }
    return "penuh";
  }

  const turun = dy;
  const vTurun = kecepatanTurunPxPerMs;
  const lolosFlick = turun >= AMBANG_FLICK_PX && vTurun >= AMBANG_KECEPATAN_MIN;
  if (turun < AMBANG_JARAK_PX && !lolosFlick) {
    return tahapSekarang;
  }

  if (tahapSekarang === "ringkas") {
    return "tutup";
  }
  if (vTurun >= AMBANG_KECEPATAN_TUTUP_LANGSUNG || turun >= 190) {
    return "tutup";
  }
  return tahapSekarang === "penuh" ? "sedang" : "ringkas";
}

/**
 * Menghitung posisi & tinggi drawer secara progresif mengikuti jari saat menarik dari bilah bawah.
 */
export function hitungGayaSeretTutupKeBuka(
  jarakNaikPx: number,
  tinggiPanelPx: number,
  tinggiKontainerPx: number
): GayaSeretDrawer {
  const amanNaik = Math.max(0, jarakNaikPx);
  const tinggiDasar = Math.max(tinggiPanelPx, 240);
  const batasTinggiMaks = Math.max(tinggiDasar, tinggiKontainerPx - 20);
  const progres = clamp(amanNaik / tinggiDasar, 0, 1);

  if (amanNaik <= tinggiDasar) {
    return {
      translateYPx: Math.round((tinggiDasar - amanNaik) * 10) / 10,
      heightPx: null,
      backdropAlpha: Math.round(progres * MAKS_ALPHA_LATAR * 1000) / 1000
    };
  }

  const kelebihan = amanNaik - tinggiDasar;
  const tinggiBaru = Math.min(batasTinggiMaks, tinggiDasar + kelebihan);
  const sisaRubber = amanNaik + 12 > batasTinggiMaks ? -Math.min(14, (amanNaik - (batasTinggiMaks - 12)) * 0.16) : 0;

  return {
    translateYPx: Math.round(sisaRubber * 10) / 10,
    heightPx: Math.round(tinggiBaru),
    backdropAlpha: MAKS_ALPHA_LATAR
  };
}

/**
 * Menghitung posisi & tinggi drawer secara real-time saat kepala drawer diseret dari tahap terbuka.
 */
export function hitungGayaSeretTerbuka(
  dy: number,
  tahapSekarang: TahapDrawerTerbuka,
  tinggiSaatIniPx: number,
  tinggiKontainerPx: number
): GayaSeretDrawer {
  const tinggiDasar = Math.max(tinggiSaatIniPx, 240);
  const batasTinggiMaks = Math.max(tinggiDasar, tinggiKontainerPx - 20);

  if (dy >= 0) {
    const progresTutup = clamp(dy / tinggiDasar, 0, 1);
    return {
      translateYPx: Math.round(dy * 10) / 10,
      heightPx: null,
      backdropAlpha: Math.round((1 - progresTutup) * MAKS_ALPHA_LATAR * 1000) / 1000
    };
  }

  const naik = -dy;
  if (tahapSekarang === "penuh") {
    return {
      translateYPx: Math.round(-Math.min(18, naik * 0.14) * 10) / 10,
      heightPx: null,
      backdropAlpha: MAKS_ALPHA_LATAR
    };
  }

  const targetTinggi = tinggiDasar + naik;
  const tinggiTerjepit = Math.min(batasTinggiMaks, targetTinggi);
  const sisaRubber = targetTinggi > batasTinggiMaks ? -Math.min(14, (targetTinggi - batasTinggiMaks) * 0.14) : 0;

  return {
    translateYPx: Math.round(sisaRubber * 10) / 10,
    heightPx: Math.round(tinggiTerjepit),
    backdropAlpha: MAKS_ALPHA_LATAR
  };
}
