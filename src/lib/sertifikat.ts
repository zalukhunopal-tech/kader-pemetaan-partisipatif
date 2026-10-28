import { DataSpasialItem, ProfilKader, SertifikatKader } from "../types";
import { HasilPerhitunganCapaian, hitungCapaianKader } from "./rewardEngine";
import { buatId } from "./id";

/**
 * PENERBITAN SERTIFIKAT
 * Sertifikat hanya bisa diterbitkan admin untuk kader yang capaian TERVERIFIKASI-nya sudah
 * memenuhi satu paket. Nomor berurutan per tahun dan tidak boleh kembar.
 */

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

const polaNomor = (tahun: number) => new RegExp(`^(\\d+)/SKPP-GIS/WILAYAH/[IVX]+/${tahun}$`);

/** Nomor berikutnya: urutan tertinggi pada tahun yang sama ditambah satu, mis. 0004/SKPP-GIS/WILAYAH/X/2026 */
export function nomorSertifikatBerikut(daftar: SertifikatKader[], tanggal: Date = new Date()): string {
  const tahun = tanggal.getFullYear();
  const pola = polaNomor(tahun);
  let tertinggi = 0;
  for (const s of daftar) {
    const m = s.nomorSertifikat.trim().match(pola);
    if (m) tertinggi = Math.max(tertinggi, Number(m[1]));
  }
  const urut = String(tertinggi + 1).padStart(4, "0");
  return `${urut}/SKPP-GIS/WILAYAH/${ROMAWI[tanggal.getMonth()]}/${tahun}`;
}

export function nomorSudahDipakai(daftar: SertifikatKader[], nomor: string): boolean {
  const n = nomor.trim().toLowerCase();
  return daftar.some((s) => s.nomorSertifikat.trim().toLowerCase() === n);
}

export interface RingkasanKader {
  idKader: string;
  namaKader: string;
  desaWilayah: string;
  /** Capaian dari data yang sudah diverifikasi admin */
  capaian: HasilPerhitunganCapaian;
  sudahTerbit: boolean;
}

/** Semua kader yang punya data, dengan capaian terverifikasi dan status sertifikatnya */
export function ringkasanKader(
  dataSpasial: DataSpasialItem[],
  sertifikatList: SertifikatKader[],
  modeKombinasiTarget: ProfilKader["modeKombinasiTarget"] = "per_kategori"
): RingkasanKader[] {
  const kader = new Map<string, { namaKader: string; desaWilayah: string }>();
  for (const d of dataSpasial) {
    if (!kader.has(d.idKader)) kader.set(d.idKader, { namaKader: d.namaKader, desaWilayah: d.desaWilayah });
  }
  return [...kader.entries()]
    .map(([idKader, info]) => ({
      idKader,
      ...info,
      capaian: hitungCapaianKader(
        dataSpasial,
        { idKader, nama: info.namaKader, modeKombinasiTarget } as ProfilKader,
        true
      ),
      sudahTerbit: sertifikatList.some((s) => s.idKader === idKader)
    }))
    .sort((a, b) => Number(b.capaian.berhakSertifikat) - Number(a.capaian.berhakSertifikat) || a.namaKader.localeCompare(b.namaKader));
}

export interface HasilPenerbitan {
  ok: boolean;
  pesan: string;
  sertifikat?: SertifikatKader;
}

/**
 * Menyiapkan sertifikat baru untuk satu kader. Gagal bila kader belum memenuhi capaian
 * terverifikasi, sudah punya sertifikat, atau nomor sudah dipakai.
 */
export function siapkanSertifikat(
  kader: RingkasanKader,
  nomor: string,
  daftar: SertifikatKader[],
  info: {
    namaOrganisasi: string;
    ditandatanganiOleh: string;
    jabatanPenandatangan: string;
    fotoKaderBase64?: string;
    sekarang?: Date;
  }
): HasilPenerbitan {
  const nomorBersih = nomor.trim();
  if (!nomorBersih) return { ok: false, pesan: "Nomor sertifikat wajib diisi." };
  if (!kader.capaian.berhakSertifikat) {
    return {
      ok: false,
      pesan: `${kader.namaKader} belum memenuhi satu paket capaian terverifikasi. Verifikasi datanya dulu di tab Data.`
    };
  }
  if (kader.sudahTerbit || daftar.some((s) => s.idKader === kader.idKader)) {
    return { ok: false, pesan: `${kader.namaKader} sudah memiliki sertifikat.` };
  }
  if (nomorSudahDipakai(daftar, nomorBersih)) {
    return { ok: false, pesan: `Nomor ${nomorBersih} sudah dipakai sertifikat lain.` };
  }
  const sertifikat: SertifikatKader = {
    id: buatId("CERT"),
    nomorSertifikat: nomorBersih,
    idKader: kader.idKader,
    namaKader: kader.namaKader,
    desaWilayah: kader.desaWilayah,
    namaOrganisasi: info.namaOrganisasi,
    tanggalTerbit: (info.sekarang ?? new Date()).toISOString().slice(0, 10),
    alasanCapaian: kader.capaian.alasanSertifikat,
    status: "diterbitkan",
    ditandatanganiOleh: info.ditandatanganiOleh,
    jabatanPenandatangan: info.jabatanPenandatangan,
    fotoKaderBase64: info.fotoKaderBase64
  };
  return { ok: true, pesan: `Sertifikat ${nomorBersih} diterbitkan untuk ${kader.namaKader}.`, sertifikat };
}
