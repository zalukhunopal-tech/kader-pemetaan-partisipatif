import {
  DataSpasialItem,
  PembaruanObjek,
  PesanKomunikasi,
  ProfilKader,
  TugasPemetaan
} from "../types";
import { dihitungUntukCapaian } from "./geoUtils";

export const TARGET_TITIK = 50;
export const TARGET_TRACKING_KM = 5.0;
export const TARGET_POLIGON_HA = 5.0;

/** Batas sumbangan diskusi pada skor level (setara Level 4; Level 5 butuh data lapangan) */
export const BATAS_SKOR_DISKUSI = 200;

/** Jeda minimal antar pembaruan pada objek yang sama */
export const JEDA_PEMBARUAN_JAM = 24;
const JEDA_PEMBARUAN_MS = JEDA_PEMBARUAN_JAM * 60 * 60 * 1000;

const bersihkanTeks = (t: string | undefined) =>
  (t ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const normalisasiIsi = (u: Pick<PembaruanObjek, "kondisiTerbaru" | "catatan">) =>
  `${bersihkanTeks(u.kondisiTerbaru)}|${bersihkanTeks(u.catatan)}`;

const waktuMs = (iso: string | undefined) => {
  const t = Date.parse(iso ?? "");
  return Number.isNaN(t) ? null : t;
};

/**
 * Pembaruan yang dihitung sebagai poin: dicatat oleh pemilik objek, berjarak minimal
 * JEDA_PEMBARUAN_JAM dari pembaruan sah sebelumnya (atau dari saat objek dibuat),
 * dan isinya berbeda dari pembaruan sah sebelumnya.
 */
export function daftarPembaruanSah(item: DataSpasialItem): PembaruanObjek[] {
  const urut = (item.riwayatPembaruan ?? [])
    .filter((u) => waktuMs(u.tanggal) !== null)
    .sort((a, b) => (waktuMs(a.tanggal) as number) - (waktuMs(b.tanggal) as number));

  const sah: PembaruanObjek[] = [];
  let terakhirMs = waktuMs(item.createdAt) ?? -Infinity;
  let isiTerakhir = "";
  for (const u of urut) {
    const oleh = u.idKader ? u.idKader === item.idKader : u.olehKader === item.namaKader;
    if (!oleh) continue;
    const t = waktuMs(u.tanggal) as number;
    if (t - terakhirMs < JEDA_PEMBARUAN_MS) continue;
    const isi = normalisasiIsi(u);
    if (isi === isiTerakhir) continue;
    sah.push(u);
    terakhirMs = t;
    isiTerakhir = isi;
  }
  return sah;
}

export const hitungPembaruanSah = (item: DataSpasialItem): number =>
  daftarPembaruanSah(item).length;

const formatSisa = (ms: number) =>
  ms >= 60 * 60 * 1000
    ? `${Math.ceil(ms / (60 * 60 * 1000))} jam`
    : `${Math.max(1, Math.ceil(ms / (60 * 1000)))} menit`;

/**
 * Memeriksa apakah pembaruan baru boleh dicatat: satu pembaruan per objek per
 * JEDA_PEMBARUAN_JAM, dan isinya harus berbeda dari pembaruan terakhir.
 */
export function cekPembaruanBaru(
  item: DataSpasialItem,
  kondisiTerbaru: string,
  catatan: string,
  sekarangMs: number = Date.now()
): { boleh: boolean; alasan?: string } {
  const riwayat = item.riwayatPembaruan ?? [];
  const terakhir = riwayat.reduce<PembaruanObjek | null>((a, u) => {
    const t = waktuMs(u.tanggal);
    if (t === null) return a;
    return !a || t > (waktuMs(a.tanggal) as number) ? u : a;
  }, null);
  const terakhirMs = terakhir ? (waktuMs(terakhir.tanggal) as number) : waktuMs(item.createdAt) ?? -Infinity;

  const sisaMs = JEDA_PEMBARUAN_MS - (sekarangMs - terakhirMs);
  if (sisaMs > 0) {
    return {
      boleh: false,
      alasan: `Objek ini baru ${terakhir ? "diperbarui" : "dibuat"}. Pembaruan berikutnya bisa dicatat dalam ${formatSisa(sisaMs)}.`
    };
  }
  if (terakhir && normalisasiIsi(terakhir) === normalisasiIsi({ kondisiTerbaru, catatan })) {
    return { boleh: false, alasan: "Isi pembaruan sama dengan sebelumnya. Tuliskan kondisi yang berubah." };
  }
  return { boleh: true };
}

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
}

export interface InfoLevelGis {
  level: number;
  namaLevel: string;
  kategoriTier: string;
  ikon: string;
  minSkor: number;
  deskripsiSingkat: string;
}

export interface RincianSkorGis {
  skorVolumeData: number;
  skorVariasiData: number;
  skorDiskusi: number;
  skorKualitasData: number;
  skorTugas: number;
  detailStatistik: {
    totalObjek: number;
    kategoriUnik: number;
    geometriUnik: number;
    pesanDiskusi: number;
    pinDibagikan: number;
    dataBerfoto: number;
    dataTerverifikasi: number;
    tugasSelesai: number;
  };
}

export interface HasilPeringkatGis20 {
  levelSaatIni: InfoLevelGis;
  levelBerikutnya: InfoLevelGis | null;
  levelSebelumnya: InfoLevelGis | null;
  jumlahLevelDiBawah: number;
  jumlahLevelKeAtas: number;
  totalLevelMaksimal: number;
  skorTotal: number;
  skorMenujuLevelBerikutnya: number;
  persenProgresLevel: number;
  rincianSkor: RincianSkorGis;
}

export const DAFTAR_20_LEVEL_GIS: InfoLevelGis[] = [
  {
    level: 1,
    namaLevel: "Penjelajah Dasar",
    kategoriTier: "Tier 1 • Kader Dasar (Lv 1–5)",
    ikon: "👤",
    minSkor: 0,
    deskripsiSingkat: "Memulai orientasi alat GPS dan pengenalan peta dasar wilayah desa."
  },
  {
    level: 2,
    namaLevel: "Pencatat Titik Lapangan",
    kategoriTier: "Tier 1 • Kader Dasar (Lv 1–5)",
    ikon: "📍",
    minSkor: 40,
    deskripsiSingkat: "Aktif mengambil titik koordinat awal (waypoint) objek penting masyarakat."
  },
  {
    level: 3,
    namaLevel: "Perintis Sketsa Desa",
    kategoriTier: "Tier 1 • Kader Dasar (Lv 1–5)",
    ikon: "🧭",
    minSkor: 90,
    deskripsiSingkat: "Mengenali arah kompas dan mulai memetakan lebih dari satu kategori objek."
  },
  {
    level: 4,
    namaLevel: "Pengamat Flora & Fauna",
    kategoriTier: "Tier 1 • Kader Dasar (Lv 1–5)",
    ikon: "🌿",
    minSkor: 150,
    deskripsiSingkat: "Mendokumentasikan keanekaragaman hayati lokal beserta manfaatnya bagi warga."
  },
  {
    level: 5,
    namaLevel: "Surveyor Jejak Komunitas",
    kategoriTier: "Tier 1 • Kader Dasar (Lv 1–5)",
    ikon: "🥾",
    minSkor: 220,
    deskripsiSingkat: "Terbiasa merekam jalur perjalanan (tracking) dan berbagi informasi lapangan."
  },
  {
    level: 6,
    namaLevel: "Pemeta Sumber Daya Desa",
    kategoriTier: "Tier 2 • Kader Terampil (Lv 6–10)",
    ikon: "💧",
    minSkor: 300,
    deskripsiSingkat: "Memetakan mata air, kebun, dan objek vital desa dengan variasi geometri."
  },
  {
    level: 7,
    namaLevel: "Fasilitator Diskusi Spasial",
    kategoriTier: "Tier 2 • Kader Terampil (Lv 6–10)",
    ikon: "💬",
    minSkor: 400,
    deskripsiSingkat: "Aktif berdiskusi, berbagi pin lokasi temuan, dan berkoordinasi antar-kader."
  },
  {
    level: 8,
    namaLevel: "Kader Geotagging Terampil",
    kategoriTier: "Tier 2 • Kader Terampil (Lv 6–10)",
    ikon: "📸",
    minSkor: 520,
    deskripsiSingkat: "Melengkapi rekaman koordinat dengan bukti foto lapangan dan atribut lengkap."
  },
  {
    level: 9,
    namaLevel: "Penjaga Batas Wilayah",
    kategoriTier: "Tier 2 • Kader Terampil (Lv 6–10)",
    ikon: "🪧",
    minSkor: 650,
    deskripsiSingkat: "Konsisten memetakan tanda batas alam, sungai, dan kesepakatan sempadan."
  },
  {
    level: 10,
    namaLevel: "Kader Pemetaan Tersertifikasi",
    kategoriTier: "Tier 2 • Kader Terampil (Lv 6–10)",
    ikon: "🏅",
    minSkor: 800,
    deskripsiSingkat: "Menguasai pengambilan titik, jalur, dan poligon sesuai standar sertifikasi."
  },
  {
    level: 11,
    namaLevel: "Analis Transek Lapangan",
    kategoriTier: "Tier 3 • Kader Mahir (Lv 11–15)",
    ikon: "📐",
    minSkor: 970,
    deskripsiSingkat: "Mampu melakukan survei lintas blok hutan dan memperbarui kondisi data berkala."
  },
  {
    level: 12,
    namaLevel: "Spesialis Poligon Ulayat",
    kategoriTier: "Tier 3 • Kader Mahir (Lv 11–15)",
    ikon: "🗺️",
    minSkor: 1160,
    deskripsiSingkat: "Terampil menghitung luas poligon wilayah kelola masyarakat dan agroforestri."
  },
  {
    level: 13,
    namaLevel: "Verifikator Data Komunitas",
    kategoriTier: "Tier 3 • Kader Mahir (Lv 11–15)",
    ikon: "🛡️",
    minSkor: 1370,
    deskripsiSingkat: "Menghasilkan data berakurasi tinggi yang lolos verifikasi GIS organisasi."
  },
  {
    level: 14,
    namaLevel: "Penggerak Pemetaan Partisipatif",
    kategoriTier: "Tier 3 • Kader Mahir (Lv 11–15)",
    ikon: "🤝",
    minSkor: 1600,
    deskripsiSingkat: "Menjadi motor kolaborasi survei lapangan dan diskusi lintas dusun/desa."
  },
  {
    level: 15,
    namaLevel: "Kartografer Muda Desa",
    kategoriTier: "Tier 3 • Kader Mahir (Lv 11–15)",
    ikon: "✒️",
    minSkor: 1850,
    deskripsiSingkat: "Mengintegrasikan seluruh kategori survei menjadi basis data spasial desa."
  },
  {
    level: 16,
    namaLevel: "Koordinator Spasial Wilayah",
    kategoriTier: "Tier 4 • Master GIS (Lv 16–20)",
    ikon: "📡",
    minSkor: 2120,
    deskripsiSingkat: "Memimpin penugasan pemetaan blok wilayah dan pemantauan kondisi lapangan."
  },
  {
    level: 17,
    namaLevel: "Pakar Biodiversitas & Lahan",
    kategoriTier: "Tier 4 • Master GIS (Lv 16–20)",
    ikon: "🌳",
    minSkor: 2420,
    deskripsiSingkat: "Memiliki rekam jejak kaya dalam inventarisasi flora, fauna, hidrologi & lahan."
  },
  {
    level: 18,
    namaLevel: "Mentor GIS Masyarakat",
    kategoriTier: "Tier 4 • Master GIS (Lv 16–20)",
    ikon: "🎓",
    minSkor: 2750,
    deskripsiSingkat: "Membimbing sesama kader dalam diskusi teknis, akurasi GPS, dan validasi data."
  },
  {
    level: 19,
    namaLevel: "Arsitek Kedaulatan Ruang",
    kategoriTier: "Tier 4 • Master GIS (Lv 16–20)",
    ikon: "🏛️",
    minSkor: 3120,
    deskripsiSingkat: "Menyusun data spasial komprehensif untuk perlindungan wilayah adat & desa."
  },
  {
    level: 20,
    namaLevel: "Maestro GIS Partisipatif Nusantara",
    kategoriTier: "Tier 4 • Master GIS (Lv 16–20)",
    ikon: "👑",
    minSkor: 3500,
    deskripsiSingkat: "Puncak kompetensi kader pemetaan partisipatif dengan kontribusi paripurna."
  }
];

/**
 * Menghitung posisi level kader dari 20 Level GIS berdasarkan:
 * 1. Banyak data yang diambil (Titik, Jalur Tracking km, Poligon Ha, Pembaruan objek)
 * 2. Variasi data (Keberagaman kategori survei & jenis geometri)
 * 3. Keaktifan dalam diskusi (Pesan yang dibuat, berbagi pin koordinat, pesan suara)
 * 4. Kualitas & kelengkapan data (Foto geotagging, atribut lokal/ilmiah, akurasi GPS, verifikasi)
 * 5. Penyelesaian penugasan pemetaan lapangan
 */
export function hitungPeringkatGis20Level(
  semuaData: DataSpasialItem[],
  profil: ProfilKader,
  pesanList: PesanKomunikasi[] = [],
  tugasList: TugasPemetaan[] = []
): HasilPeringkatGis20 {
  const dataKader = semuaData.filter(
    (d) =>
      d.idKader === profil.idKader &&
      d.statusSinkron !== "ditolak" &&
      dihitungUntukCapaian(d)
  );

  // 1. Skor Volume Data
  const jmlTitik = dataKader.filter((d) => d.jenisGeometri === "point").length;
  const jmlPembaruan = dataKader.reduce((acc, d) => acc + hitungPembaruanSah(d), 0);
  const totalKm = dataKader
    .filter((d) => d.jenisGeometri === "line")
    .reduce((acc, d) => acc + (d.panjangKm || 0), 0);
  const totalHa = dataKader
    .filter((d) => d.jenisGeometri === "polygon")
    .reduce((acc, d) => acc + (d.luasHa || 0), 0);

  const skorVolumeData = Math.round(
    jmlTitik * 10 + jmlPembaruan * 8 + totalKm * 25 + totalHa * 25
  );

  // 2. Skor Variasi Data (Kategori Unik & Geometri Unik)
  const kategoriSet = new Set(dataKader.map((d) => d.kategori));
  const geometriSet = new Set(dataKader.map((d) => d.jenisGeometri));
  const kategoriUnik = kategoriSet.size;
  const geometriUnik = geometriSet.size;
  const skorVariasiData = kategoriUnik * 35 + geometriUnik * 45;

  // 3. Skor Keaktifan Diskusi & Koordinasi
  // Hanya ruang diskusi komunitas, dicocokkan dengan ID pengirim (bukan nama yang bisa sama atau
  // diubah), dan dibatasi supaya diskusi saja tidak bisa menaikkan level jauh tanpa data lapangan.
  const pesanKader = pesanList.filter(
    (m) => m.saluran === "komunitas" && m.idPengirim === profil.idKader
  );
  const pesanDiskusi = pesanKader.length;
  const pinDibagikan = pesanKader.filter((m) => Boolean(m.pinKoordinat)).length;
  const pesanSuara = pesanKader.filter((m) => Boolean(m.durasiSuaraDetik)).length;
  const skorDiskusi = Math.min(
    BATAS_SKOR_DISKUSI,
    pesanDiskusi * 15 + pinDibagikan * 20 + pesanSuara * 15
  );

  // 4. Skor Kualitas & Validasi Data
  const dataBerfoto = dataKader.filter((d) => Boolean(d.fotoBase64 || d.driveFileUrl)).length;
  const dataAtributLengkap = dataKader.filter((d) =>
    Boolean((d.namaLokal && d.namaLokal !== "-") || d.namaIlmiah || d.manfaatMasyarakat)
  ).length;
  const dataAkuratGps = dataKader.filter(
    (d) => d.koordinat[0]?.akurasi !== undefined && d.koordinat[0].akurasi <= 5
  ).length;
  const dataTersinkron = dataKader.filter((d) => d.statusSinkron === "tersinkron").length;
  const dataTerverifikasi = dataKader.filter((d) => d.statusSinkron === "terverifikasi").length;

  const skorKualitasData =
    dataBerfoto * 15 +
    dataAtributLengkap * 10 +
    dataAkuratGps * 8 +
    dataTersinkron * 10 +
    dataTerverifikasi * 25;

  // 5. Skor Ketuntasan Tugas Pemetaan
  const tugasSelesai = tugasList.filter((t) => t.status === "selesai").length;
  const skorTugas = tugasSelesai * 60;

  const skorTotal =
    skorVolumeData + skorVariasiData + skorDiskusi + skorKualitasData + skorTugas;

  // Tentukan level saat ini dari 20 level
  let idxLevel = 0;
  for (let i = 0; i < DAFTAR_20_LEVEL_GIS.length; i++) {
    if (skorTotal >= DAFTAR_20_LEVEL_GIS[i].minSkor) {
      idxLevel = i;
    } else {
      break;
    }
  }

  const levelSaatIni = DAFTAR_20_LEVEL_GIS[idxLevel];
  const levelBerikutnya =
    idxLevel + 1 < DAFTAR_20_LEVEL_GIS.length ? DAFTAR_20_LEVEL_GIS[idxLevel + 1] : null;
  const levelSebelumnya = idxLevel > 0 ? DAFTAR_20_LEVEL_GIS[idxLevel - 1] : null;

  const jumlahLevelDiBawah = levelSaatIni.level - 1;
  const jumlahLevelKeAtas = DAFTAR_20_LEVEL_GIS.length - levelSaatIni.level;

  let skorMenujuLevelBerikutnya = 0;
  let persenProgresLevel = 100;

  if (levelBerikutnya) {
    const rentangLevel = levelBerikutnya.minSkor - levelSaatIni.minSkor;
    const capaianDiLevelIni = skorTotal - levelSaatIni.minSkor;
    skorMenujuLevelBerikutnya = Math.max(0, levelBerikutnya.minSkor - skorTotal);
    persenProgresLevel = Math.min(
      99,
      Math.max(0, Math.round((capaianDiLevelIni / Math.max(1, rentangLevel)) * 100))
    );
  }

  return {
    levelSaatIni,
    levelBerikutnya,
    levelSebelumnya,
    jumlahLevelDiBawah,
    jumlahLevelKeAtas,
    totalLevelMaksimal: DAFTAR_20_LEVEL_GIS.length,
    skorTotal,
    skorMenujuLevelBerikutnya,
    persenProgresLevel,
    rincianSkor: {
      skorVolumeData,
      skorVariasiData,
      skorDiskusi,
      skorKualitasData,
      skorTugas,
      detailStatistik: {
        totalObjek: dataKader.length,
        kategoriUnik,
        geometriUnik,
        pesanDiskusi,
        pinDibagikan,
        dataBerfoto,
        dataTerverifikasi,
        tugasSelesai
      }
    }
  };
}

/**
 * Menghitung capaian gamifikasi & insentif kader sesuai PRD Bab 3.3:
 * - 1 Paket Capaian = 50 Titik Koordinat ATAU 5 km Tracking Perjalanan ATAU 5 Ha Pemetaan Poligon
 * - Capaian Pertama (1x Target) -> berhak atas Sertifikat Kader Pemetaan (hanya data terverifikasi)
 */
export function hitungCapaianKader(
  semuaData: DataSpasialItem[],
  profil: ProfilKader,
  hanyaTerverifikasi: boolean = false
): HasilPerhitunganCapaian {
  const dataKader = semuaData.filter((d) => {
    if (d.idKader !== profil.idKader) return false;
    if (d.statusSinkron === "ditolak") return false;
    if (!dihitungUntukCapaian(d)) return false;
    if (hanyaTerverifikasi) return d.statusSinkron === "terverifikasi";
    return true;
  });

  const jumlahTitik = dataKader.filter((d) => d.jenisGeometri === "point").length;
  const jumlahPembaruan = dataKader.reduce((acc, d) => acc + hitungPembaruanSah(d), 0);
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

  let totalPaketSelesai: number;
  let progresPaketBerikutnyaPersen: number;

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

  const persenTitik =
    Math.min(100, Math.round(((totalPoinTitik % TARGET_TITIK) / TARGET_TITIK) * 100)) ||
    (paketDariTitik > 0 ? 100 : 0);
  const persenTracking =
    Math.min(
      100,
      Math.round(((totalTrackingKm % TARGET_TRACKING_KM) / TARGET_TRACKING_KM) * 100)
    ) || (paketDariTracking > 0 ? 100 : 0);
  const persenPoligon =
    Math.min(
      100,
      Math.round(((totalPoligonHa % TARGET_POLIGON_HA) / TARGET_POLIGON_HA) * 100)
    ) || (paketDariPoligon > 0 ? 100 : 0);

  const berhakSertifikat = totalPaketSelesai >= 1;
  const alasanList: string[] = [];
  if (paketDariTitik >= 1) alasanList.push(`${totalPoinTitik} Titik Koordinat`);
  if (paketDariTracking >= 1) alasanList.push(`${totalTrackingKm} km Tracking Survei`);
  if (paketDariPoligon >= 1) alasanList.push(`${totalPoligonHa} Ha Pemetaan Poligon`);
  if (alasanList.length === 0 && berhakSertifikat) {
    alasanList.push(
      `Kombinasi Capaian (${totalPoinTitik} titik, ${totalTrackingKm} km, ${totalPoligonHa} Ha)`
    );
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
    alasanSertifikat: alasanList.join(", ") || "Dalam Progres"
  };
}
