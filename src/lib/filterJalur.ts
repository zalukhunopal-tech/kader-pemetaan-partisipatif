import { KoordinatTitik } from "../types";
import { hitungJarakMeter, koordinatValid } from "./geoUtils";

/** Gate gerak pejalan kaki. Lonjakan ditolak, bukan digeser menjadi pengukuran fiktif. */
export function titikJalurDapatDiterima(terakhir: KoordinatTitik | undefined, baru: KoordinatTitik, kecepatanMaksMps = 12): boolean {
  if (!koordinatValid(baru) || (baru.akurasi ?? Infinity) > 50) return false;
  if (!terakhir || baru.simulasi || terakhir.simulasi) return true;
  const a = Date.parse(terakhir.timestamp ?? ""),
    b = Date.parse(baru.timestamp ?? "");
  // Titik manual/rekaman lama tidak memiliki waktu yang dapat dipakai untuk gate kecepatan.
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  if (b < a) return false;
  const jarak = hitungJarakMeter(terakhir, baru),
    noise = (terakhir.akurasi ?? 0) + (baru.akurasi ?? 0);
  return jarak <= noise + Math.max(0, (b - a) / 1000) * kecepatanMaksMps;
}
