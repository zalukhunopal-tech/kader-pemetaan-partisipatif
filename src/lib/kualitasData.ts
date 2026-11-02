import { DataSpasialItem, SkorKualitasData } from "../types";
import { koordinatValid, validasiGeometri } from "./geoUtils";

/** Empat indikator masing-masing 25 poin; rekomendasi DQA bukan verifikasi admin. */
export function hitungSkorKualitasData(item: DataSpasialItem): SkorKualitasData {
  const masalah = validasiGeometri(item.jenisGeometri, item.koordinat);
  const geometriValid = masalah.length === 0;
  const gps =
    item.koordinat.length > 0 &&
    !item.diimpor &&
    item.koordinat.every((p) => !p.simulasi && p.akurasi !== undefined && p.akurasi > 0 && p.akurasi < 10)
      ? 25
      : 0;
  const bukti = item.buktiFoto;
  const fotoGeotag =
    item.fotoBase64 &&
    bukti &&
    bukti.idKader === item.idKader &&
    koordinatValid(bukti.posisi) &&
    Number.isFinite(Date.parse(bukti.diambilPada))
      ? 25
      : 0;
  const atribut = (item.namaLokal?.trim() && item.namaLokal.trim() !== "-" ? 12 : 0) + (item.deskripsi.trim() ? 13 : 0);
  const geometri = geometriValid ? 25 : 0;
  if (!gps) masalah.push("GPS asli dengan akurasi <10 m belum lengkap.");
  if (!fotoGeotag) masalah.push("Foto dengan metadata lokasi lapangan belum lengkap.");
  if (atribut < 25) masalah.push("Nama lokal atau deskripsi belum lengkap.");
  const skor = Math.min(geometriValid ? 100 : 49, gps + fotoGeotag + atribut + geometri);
  return {
    versi: 1,
    skor,
    grade: skor >= 90 ? "A" : skor >= 75 ? "B" : skor >= 50 ? "C" : "D",
    rincian: { gps, fotoGeotag, atribut, geometri },
    masalah,
    geometriValid
  };
}
