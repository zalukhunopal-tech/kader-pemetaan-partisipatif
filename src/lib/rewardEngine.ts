import { DataSpasialItem, ProfilKader } from "../types";

export const TARGET_TITIK = 50;
export const TARGET_TRACKING_KM = 5.0;
export const TARGET_POLIGON_HA = 5.0;

export interface HasilPerhitunganCapaian {
  jumlahTitik: number;
  jumlahPembaruan: number;
  totalPoinTitik: number; // titik baru + pembaruan data existing
  totalTrackingKm: number;
  totalPoligonHa: number;
  persenTitik: number;
  persenTracking: number;
  persenPoligon: number;
  paketDariTitik: number;
  paketDariTracking: number;
  paketDariPoligon: number;
  totalPaketSelesai: number;
  progresPaketBerikutnyaPersen: number;
  berhakSertifikat: boolean;
  alasanSertifikat: string;
  jumlahHakUpahHok: number;
  paketMenujuUpahBerikutnya: number;
}

/**
 * Menghitung capaian gamifikasi & insentif kader sesuai PRD Bab 3.3:
 * - 1 Paket Capaian = 50 Titik Koordinat ATAU 5 km Tracking Perjalanan ATAU 5 Ha Pemetaan Poligon
 * - Capaian Pertama (1x Target) -> Sertifikat Kader Pemetaan
 * - Capaian Berikutnya (Setiap 2x Target) -> Upah Harian 1 Hari Kerja (1 HOK)
 */
export function hitungCapaianKader(
  semuaData: DataSpasialItem[],
  profil: ProfilKader,
  hanyaTerverifikasi: boolean = false
): HasilPerhitunganCapaian {
  const dataKader = semuaData.filter((d) => {
    if (d.idKader !== profil.idKader) return false;
    if (d.statusSinkron === "ditolak") return false;
    if (hanyaTerverifikasi) return d.statusSinkron === "terverifikasi";
    return true;
  });

  const jumlahTitik = dataKader.filter((d) => d.jenisGeometri === "point").length;
  const jumlahPembaruan = dataKader.reduce(
    (acc, d) => acc + (d.riwayatPembaruan ? d.riwayatPembaruan.length : 0),
    0
  );
  // Sesuai PRD 3.3.A.1: Mengumpulkan atau memperbarui titik koordinat
  const totalPoinTitik = jumlahTitik + jumlahPembaruan;

  const totalTrackingKm = Number(
    dataKader
      .filter((d) => d.jenisGeometri === "line")
      .reduce((acc, d) => acc + (d.panjangKm || 0), 0)
      .toFixed(2)
  );

  const totalPoligonHa = Number(
    dataKader
      .filter((d) => d.jenisGeometri === "polygon")
      .reduce((acc, d) => acc + (d.luasHa || 0), 0)
      .toFixed(2)
  );

  const paketDariTitik = Math.floor(totalPoinTitik / TARGET_TITIK);
  const paketDariTracking = Math.floor(totalTrackingKm / TARGET_TRACKING_KM);
  const paketDariPoligon = Math.floor(totalPoligonHa / TARGET_POLIGON_HA);

  let totalPaketSelesai = 0;
  let progresPaketBerikutnyaPersen = 0;

  if (profil.modeKombinasiTarget === "gabungan_proporsional") {
    const totalFraksi =
      totalPoinTitik / TARGET_TITIK +
      totalTrackingKm / TARGET_TRACKING_KM +
      totalPoligonHa / TARGET_POLIGON_HA;
    totalPaketSelesai = Math.floor(totalFraksi);
    progresPaketBerikutnyaPersen = Math.round((totalFraksi - totalPaketSelesai) * 100);
  } else {
    // Default PRD: menyelesaikan penuh salah satu indikator (50 titik ATAU 5 km ATAU 5 Ha)
    totalPaketSelesai = paketDariTitik + paketDariTracking + paketDariPoligon;
    const sisaTitikPersen = ((totalPoinTitik % TARGET_TITIK) / TARGET_TITIK) * 100;
    const sisaTrackPersen = ((totalTrackingKm % TARGET_TRACKING_KM) / TARGET_TRACKING_KM) * 100;
    const sisaPolyPersen = ((totalPoligonHa % TARGET_POLIGON_HA) / TARGET_POLIGON_HA) * 100;
    progresPaketBerikutnyaPersen = Math.round(
      Math.max(sisaTitikPersen, sisaTrackPersen, sisaPolyPersen)
    );
  }

  const persenTitik = Math.min(100, Math.round(((totalPoinTitik % TARGET_TITIK) / TARGET_TITIK) * 100)) || (paketDariTitik > 0 ? 100 : 0);
  const persenTracking = Math.min(100, Math.round(((totalTrackingKm % TARGET_TRACKING_KM) / TARGET_TRACKING_KM) * 100)) || (paketDariTracking > 0 ? 100 : 0);
  const persenPoligon = Math.min(100, Math.round(((totalPoligonHa % TARGET_POLIGON_HA) / TARGET_POLIGON_HA) * 100)) || (paketDariPoligon > 0 ? 100 : 0);

  const berhakSertifikat = totalPaketSelesai >= 1;
  const alasanList: string[] = [];
  if (paketDariTitik >= 1) alasanList.push(`${totalPoinTitik} Titik Koordinat`);
  if (paketDariTracking >= 1) alasanList.push(`${totalTrackingKm} km Tracking Survei`);
  if (paketDariPoligon >= 1) alasanList.push(`${totalPoligonHa} Ha Pemetaan Poligon`);
  if (alasanList.length === 0 && berhakSertifikat) {
    alasanList.push(`Kombinasi Capaian (${totalPoinTitik} titik, ${totalTrackingKm} km, ${totalPoligonHa} Ha)`);
  }

  // Perhitungan Siklus Upah Harian (1 HOK setiap 2x Paket Capaian)
  let jumlahHakUpahHok = 0;
  let paketMenujuUpahBerikutnya = 2;

  if (profil.modePerhitunganUpah === "reset_setelah_sertifikat") {
    // Setelah paket ke-1 dipakai sertifikat, setiap 2 paket berikutnya = 1 HOK (paket ke-3, 5, 7...)
    const paketSetelahSertifikat = Math.max(0, totalPaketSelesai - 1);
    jumlahHakUpahHok = Math.floor(paketSetelahSertifikat / 2);
    paketMenujuUpahBerikutnya = 2 - (paketSetelahSertifikat % 2);
  } else {
    // Kumulatif: setiap kelipatan 2 paket (paket ke-2, 4, 6...) = 1 HOK
    jumlahHakUpahHok = Math.floor(totalPaketSelesai / 2);
    paketMenujuUpahBerikutnya = 2 - (totalPaketSelesai % 2);
  }

  return {
    jumlahTitik,
    jumlahPembaruan,
    totalPoinTitik,
    totalTrackingKm,
    totalPoligonHa,
    persenTitik,
    persenTracking,
    persenPoligon,
    paketDariTitik,
    paketDariTracking,
    paketDariPoligon,
    totalPaketSelesai,
    progresPaketBerikutnyaPersen,
    berhakSertifikat,
    alasanSertifikat: alasanList.join(" & ") || "Dalam Progres",
    jumlahHakUpahHok,
    paketMenujuUpahBerikutnya
  };
}
