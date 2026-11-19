import {
  DataSpasialItem,
  PenandatanganSertifikatItem,
  ProfilKader,
  SertifikatKader,
  SkemaPengkodeanSertifikat
} from "../types";
import { HasilPerhitunganCapaian, hitungCapaianKader } from "./rewardEngine";
import { buatId } from "./id";

/**
 * PENERBITAN SERTIFIKAT
 * Sertifikat diterbitkan admin untuk kader yang capaian TERVERIFIKASI-nya sudah
 * memenuhi satu paket. Penomoran dan pengkodean diotomatisasi sehingga setiap user
 * mendapatkan nomor sertifikat unik dan berbeda.
 */

export const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/**
 * Membersihkan nama desa/wilayah menjadi kode ringkas (mis. "Desa Long Loreh" -> "LONG-LOREH").
 */
export function bersihkanKodeWilayah(desaWilayah?: string): string {
  if (!desaWilayah) return "WILAYAH";
  const dibersihkan = desaWilayah
    .trim()
    .replace(/^desa\s+/i, "")
    .replace(/^kelurahan\s+/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
  return dibersihkan || "WILAYAH";
}

/**
 * Membersihkan ID kader menjadi kode bersih untuk pengkodean sertifikat (mis. "KDR-101" -> "KDR-101").
 */
export function bersihkanKodeKader(idKader?: string): string {
  if (!idKader) return "KDR";
  const dibersihkan = idKader
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
  return dibersihkan || "KDR";
}

/**
 * Mengekstrak nomor urut tertinggi pada tahun yang sama dari daftar sertifikat.
 * Mendukung format bawaan (`0001/SKPP-GIS/WILAYAH/X/2026`), format wilayah/kader,
 * maupun format resmi Warsi.
 */
export function ekstrakUrutanTertinggi(daftar: SertifikatKader[], tahun: number): number {
  let tertinggi = 0;
  const polaTahun = new RegExp(`[/_-]${tahun}(?:$|[/_-])`);
  for (const s of daftar) {
    const no = s.nomorSertifikat.trim();
    // Prioritas 1: Format standar SKPP-GIS ({urut}/SKPP-GIS/...)
    const mStandar = no.match(new RegExp(`^(\\d+)/SKPP-GIS/[^/]+/[IVX]+/${tahun}$`, "i"));
    if (mStandar) {
      tertinggi = Math.max(tertinggi, Number(mStandar[1]));
      continue;
    }
    // Prioritas 2: Format Warsi (SKPP-WARSI/{tahun}/{bulan}/{urut}-{kader})
    const mWarsi = no.match(new RegExp(`^SKPP-WARSI/${tahun}/[IVX]+/(\\d+)-`, "i"));
    if (mWarsi) {
      tertinggi = Math.max(tertinggi, Number(mWarsi[1]));
      continue;
    }
    // Prioritas 3: Pola umum jika terdapat tahun dan angka awalan/tengah
    if (polaTahun.test(no)) {
      const mUmum = no.match(/^(\d{1,6})\//) || no.match(/[/_-](\d{1,6})[/_-]/);
      if (mUmum) {
        tertinggi = Math.max(tertinggi, Number(mUmum[1]));
      }
    }
  }
  return tertinggi;
}

export interface OpsiNomorSertifikat {
  kader?: { idKader?: string; namaKader?: string; desaWilayah?: string };
  skema?: SkemaPengkodeanSertifikat;
  awalanKhusus?: string;
  nomorDikecualikan?: Set<string>;
}

/**
 * Nomor berikutnya: urutan tertinggi pada tahun yang sama ditambah satu.
 * Menjamin setiap nomor belum dipakai dalam daftar sertifikat.
 */
export function nomorSertifikatBerikut(
  daftar: SertifikatKader[],
  tanggal: Date = new Date(),
  opsi?: OpsiNomorSertifikat
): string {
  const tahun = tanggal.getFullYear();
  const bulanRomawi = ROMAWI[tanggal.getMonth()];
  const skema = opsi?.skema ?? "standar";
  const tertinggi = ekstrakUrutanTertinggi(daftar, tahun);

  let urutNum = tertinggi + 1;

  const cobaBentuk = (num: number): string => {
    const urutStr = String(num).padStart(4, "0");
    if (skema === "wilayah") {
      const kodeWilayah = bersihkanKodeWilayah(opsi?.kader?.desaWilayah);
      return `${urutStr}/SKPP-GIS/${kodeWilayah}/${bulanRomawi}/${tahun}`;
    }
    if (skema === "kader") {
      const kodeKader = bersihkanKodeKader(opsi?.kader?.idKader);
      return `${urutStr}/SKPP-GIS/${kodeKader}/${bulanRomawi}/${tahun}`;
    }
    if (skema === "warsi") {
      const kodeKader = bersihkanKodeKader(opsi?.kader?.idKader).replace(/^KDR-?/, "");
      return `SKPP-WARSI/${tahun}/${bulanRomawi}/${urutStr}-${kodeKader || "01"}`;
    }
    // Skema default "standar"
    return `${urutStr}/SKPP-GIS/WILAYAH/${bulanRomawi}/${tahun}`;
  };

  let hasil = cobaBentuk(urutNum);
  while (nomorSudahDipakai(daftar, hasil) || (opsi?.nomorDikecualikan && opsi.nomorDikecualikan.has(hasil.toLowerCase()))) {
    urutNum++;
    hasil = cobaBentuk(urutNum);
  }

  return hasil;
}

/**
 * Menghasilkan nomor sertifikat otomatis unik untuk seorang user/kader tertentu.
 * Menjamin setiap user mendapatkan nomor sertifikat yang berbeda dan bebas bentrok.
 */
export function buatNomorSertifikatOtomatis(
  kader: { idKader: string; namaKader?: string; desaWilayah?: string },
  daftar: SertifikatKader[],
  tanggal: Date = new Date(),
  opsi?: {
    skema?: SkemaPengkodeanSertifikat;
    awalanKhusus?: string;
    nomorDikecualikan?: Set<string>;
  }
): string {
  return nomorSertifikatBerikut(daftar, tanggal, {
    kader,
    skema: opsi?.skema ?? "standar",
    awalanKhusus: opsi?.awalanKhusus,
    nomorDikecualikan: opsi?.nomorDikecualikan
  });
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
      capaian: hitungCapaianKader(dataSpasial, { idKader, nama: info.namaKader, modeKombinasiTarget } as ProfilKader, true),
      sudahTerbit: sertifikatList.some((s) => s.idKader === idKader)
    }))
    .sort((a, b) => Number(b.capaian.berhakSertifikat) - Number(a.capaian.berhakSertifikat) || a.namaKader.localeCompare(b.namaKader) || a.idKader.localeCompare(b.idKader));
}

export interface HasilPenerbitan {
  ok: boolean;
  pesan: string;
  sertifikat?: SertifikatKader;
}

/**
 * Menyiapkan sertifikat baru untuk satu kader. Mendukung automasi penomoran unik
 * sehingga nomor otomatis dibuat bila tidak diisi manual atau mode otomatis aktif.
 */
export function siapkanSertifikat(
  kader: RingkasanKader,
  nomor: string | undefined,
  daftar: SertifikatKader[],
  info: {
    namaOrganisasi: string;
    ditandatanganiOleh: string;
    jabatanPenandatangan: string;
    penandatanganList?: PenandatanganSertifikatItem[];
    fotoKaderBase64?: string;
    sekarang?: Date;
    skemaPengkodean?: SkemaPengkodeanSertifikat;
    otomatiskanNomorJikaKosong?: boolean;
    nomorDikecualikan?: Set<string>;
  }
): HasilPenerbitan {
  let nomorBersih = (nomor ?? "").trim();

  // Jika nomor kosong dan otomatiskanNomorJikaKosong diset, atau nomor adalah "otomatis"
  if ((!nomorBersih && info.otomatiskanNomorJikaKosong) || nomorBersih.toLowerCase() === "otomatis") {
    nomorBersih = buatNomorSertifikatOtomatis(kader, daftar, info.sekarang, {
      skema: info.skemaPengkodean,
      nomorDikecualikan: info.nomorDikecualikan
    });
  }

  if (!nomorBersih) return { ok: false, pesan: "Nomor sertifikat wajib diisi." };
  if (kader.sudahTerbit || daftar.some((s) => s.idKader === kader.idKader)) {
    return { ok: false, pesan: `${kader.namaKader} sudah memiliki sertifikat.` };
  }
  if (!kader.capaian.berhakSertifikat) {
    return {
      ok: false,
      pesan: `${kader.namaKader} belum memenuhi syarat sertifikasi (50 titik, 5 km jalur, dan 5 Ha poligon terverifikasi). Verifikasi datanya dulu di tab Data.`
    };
  }
  if (nomorSudahDipakai(daftar, nomorBersih) || (info.nomorDikecualikan && info.nomorDikecualikan.has(nomorBersih.toLowerCase()))) {
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
    penandatanganList: info.penandatanganList,
    fotoKaderBase64: info.fotoKaderBase64
  };
  return { ok: true, pesan: `Sertifikat ${nomorBersih} diterbitkan untuk ${kader.namaKader}.`, sertifikat };
}

/**
 * Menerbitkan sertifikat secara otomatis untuk semua kader yang berhak dan belum memiliki sertifikat.
 * Setiap user dijamin mendapatkan nomor sertifikat unik yang berbeda.
 */
export function siapkanSemuaSertifikatOtomatis(
  daftarKader: RingkasanKader[],
  daftarSertifikatSaatIni: SertifikatKader[],
  info: {
    namaOrganisasi: string;
    ditandatanganiOleh: string;
    jabatanPenandatangan: string;
    penandatanganList?: PenandatanganSertifikatItem[];
    sekarang?: Date;
    skemaPengkodean?: SkemaPengkodeanSertifikat;
  }
): {
  berhasil: SertifikatKader[];
  gagal: { idKader: string; namaKader: string; alasan: string }[];
} {
  const berhasil: SertifikatKader[] = [];
  const gagal: { idKader: string; namaKader: string; alasan: string }[] = [];
  const daftarSementara = [...daftarSertifikatSaatIni];
  const nomorTerpakai = new Set<string>();

  for (const k of daftarKader) {
    if (k.sudahTerbit || daftarSementara.some((s) => s.idKader === k.idKader)) {
      continue;
    }
    if (!k.capaian.berhakSertifikat) {
      continue;
    }
    const nomorUnik = buatNomorSertifikatOtomatis(k, daftarSementara, info.sekarang, {
      skema: info.skemaPengkodean,
      nomorDikecualikan: nomorTerpakai
    });

    const hasil = siapkanSertifikat(k, nomorUnik, daftarSementara, {
      ...info,
      nomorDikecualikan: nomorTerpakai
    });

    if (hasil.ok && hasil.sertifikat) {
      berhasil.push(hasil.sertifikat);
      daftarSementara.push(hasil.sertifikat);
      nomorTerpakai.add(hasil.sertifikat.nomorSertifikat.toLowerCase());
    } else {
      gagal.push({ idKader: k.idKader, namaKader: k.namaKader, alasan: hasil.pesan });
    }
  }

  return { berhasil, gagal };
}
