import {
  AreaPetaOffline,
  DataSpasialItem,
  KlaimUpahHOK,
  KonfigurasiGDrive,
  LapisanSpasial,
  PengumumanBroadcast,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  TugasPemetaan
} from "../types";

const KEY_PROFIL = "geokader_profil_v2";
const KEY_SPASIAL = "geokader_data_spasial_v2";
const KEY_OFFLINE_MAPS = "geokader_offline_maps_v2";
const KEY_LAPISAN = "geokader_lapisan_v2";
const KEY_SERTIFIKAT = "geokader_sertifikat_v2";
const KEY_UPAH_HOK = "geokader_upah_hok_v2";
const KEY_PENGUMUMAN = "geokader_pengumuman_v2";
const KEY_TUGAS = "geokader_tugas_v2";
const KEY_PESAN = "geokader_pesan_v2";
const KEY_GDRIVE = "geokader_gdrive_v2";

export const PROFIL_BAWAAN: ProfilKader = {
  idKader: "KDR-2026-014",
  nama: "Budi Santoso",
  desaWilayah: "Desa Rimba Lestari",
  kelompokMasyarakat: "Kelompok Tani Hutan (KTH) Mandiri",
  noHp: "0812-3456-7890",
  namaOrganisasi: "Konsorsium Pemetaan Partisipatif Nusantara",
  tarifHokRupiah: 150000,
  modePerhitunganUpah: "kumulatif",
  modeKombinasiTarget: "per_kategori"
};

export const DATA_SPASIAL_AWAL: DataSpasialItem[] = [
  {
    id: "SPS-001",
    idKader: "KDR-2026-014",
    namaKader: "Budi Santoso",
    desaWilayah: "Desa Rimba Lestari",
    jenisGeometri: "point",
    kategori: "Flora",
    judul: "Pohon Meranti Merah Induk (Blok Hulu)",
    namaLokal: "Meranti Merah",
    namaIlmiah: "Shorea leprosula",
    jumlahIndividu: 4,
    manfaatMasyarakat: "Pohon induk penghasil benih alami & pelindung lereng",
    kondisiAncaman: "Sehat, diameter ±110 cm, bebas tebangan",
    deskripsi: "Ditemukan di punggung bukit dekat jalur sungai kecil, tajuk rapat.",
    koordinat: [{ lat: -0.94725, lng: 100.4178, elevasi: 425, akurasi: 3.2 }],
    panjangKm: 0,
    luasHa: 0,
    kompasDerajat: 48,
    statusSinkron: "terverifikasi",
    createdAt: "2026-10-24T08:15:00.000Z",
    updatedAt: "2026-10-25T10:00:00.000Z",
    riwayatPembaruan: [
      {
        id: "UPD-101",
        tanggal: "2026-10-25T10:00:00.000Z",
        olehKader: "Budi Santoso",
        kondisiTerbaru: "Muncul anakan alami di sekitar pohon induk (±15 bibit).",
        catatan: "Sudah dipasang pita penanda pohon induk."
      }
    ]
  },
  {
    id: "SPS-002",
    idKader: "KDR-2026-014",
    namaKader: "Budi Santoso",
    desaWilayah: "Desa Rimba Lestari",
    jenisGeometri: "point",
    kategori: "Fauna",
    judul: "Temuan Jejak & Sarang Rangkong Badak",
    namaLokal: "Burung Enggang / Rangkong",
    namaIlmiah: "Buceros rhinoceros",
    jumlahIndividu: 2,
    manfaatMasyarakat: "Indikator hutan sehat & penyebar biji pohon hutan",
    kondisiAncaman: "Aman, bersarang di pohon ara tinggi",
    deskripsi: "Terlihat sepasang rangkong terbang menuju pohon ara besar pukul 07.30 pagi.",
    koordinat: [{ lat: -0.9448, lng: 100.4212, elevasi: 468, akurasi: 3.8 }],
    panjangKm: 0,
    luasHa: 0,
    kompasDerajat: 112,
    statusSinkron: "terverifikasi",
    createdAt: "2026-10-24T09:20:00.000Z",
    updatedAt: "2026-10-24T09:20:00.000Z",
    riwayatPembaruan: []
  },
  {
    id: "SPS-003",
    idKader: "KDR-2026-014",
    namaKader: "Budi Santoso",
    desaWilayah: "Desa Rimba Lestari",
    jenisGeometri: "point",
    kategori: "Mata Air",
    judul: "Mata Air Batu Putih (Sumber Air Bersih Dusun II)",
    namaLokal: "Pancuran Batu Putih",
    namaIlmiah: "-",
    jumlahIndividu: 1,
    manfaatMasyarakat: "Sumber air pipa gravitasi untuk 85 KK warga Dusun II",
    kondisiAncaman: "Debit jernih & stabil sepanjang tahun",
    deskripsi: "Mata air keluar dari celah batuan granit di bawah rumpun bambu betung.",
    koordinat: [{ lat: -0.9491, lng: 100.4151, elevasi: 392, akurasi: 2.5 }],
    panjangKm: 0,
    luasHa: 0,
    kompasDerajat: 210,
    statusSinkron: "tersinkron",
    createdAt: "2026-10-25T11:05:00.000Z",
    updatedAt: "2026-10-25T11:05:00.000Z",
    riwayatPembaruan: []
  },
  {
    id: "SPS-004",
    idKader: "KDR-2026-014",
    namaKader: "Budi Santoso",
    desaWilayah: "Desa Rimba Lestari",
    jenisGeometri: "point",
    kategori: "Tanda Batas",
    judul: "Patok Batas Alam Sungai Jernih - Simpang Tiga",
    namaLokal: "Batu Sempadan Adat",
    kondisiAncaman: "Utuh, disepakati kedua desa bersebelahan",
    manfaatMasyarakat: "Penanda batas wilayah kelola masyarakat",
    deskripsi: "Pertemuan Anak Sungai Jernih dengan batu besar berlumut.",
    koordinat: [{ lat: -0.9518, lng: 100.4235, elevasi: 360, akurasi: 2.9 }],
    panjangKm: 0,
    luasHa: 0,
    kompasDerajat: 165,
    statusSinkron: "lokal",
    createdAt: "2026-10-27T07:45:00.000Z",
    updatedAt: "2026-10-27T07:45:00.000Z",
    riwayatPembaruan: []
  },
  {
    id: "SPS-005",
    idKader: "KDR-2026-014",
    namaKader: "Budi Santoso",
    desaWilayah: "Desa Rimba Lestari",
    jenisGeometri: "line",
    kategori: "Flora",
    judul: "Jalur Patroli & Transek Inventarisasi Blok Timur",
    deskripsi: "Rekaman jejak GPS mengikuti jalur punggungan bukit dari Pos Dusun II hingga Puncak Bukit Kabut.",
    koordinat: [
      { lat: -0.9522, lng: 100.4138, elevasi: 355 },
      { lat: -0.9495, lng: 100.4162, elevasi: 388 },
      { lat: -0.9468, lng: 100.4191, elevasi: 430 },
      { lat: -0.9432, lng: 100.4225, elevasi: 475 },
      { lat: -0.9398, lng: 100.4258, elevasi: 512 },
      { lat: -0.9361, lng: 100.4294, elevasi: 545 }
    ],
    panjangKm: 5.24,
    luasHa: 0,
    durasiMenit: 135,
    statusSinkron: "terverifikasi",
    createdAt: "2026-10-25T14:20:00.000Z",
    updatedAt: "2026-10-25T14:20:00.000Z",
    riwayatPembaruan: []
  },
  {
    id: "SPS-006",
    idKader: "KDR-2026-014",
    namaKader: "Budi Santoso",
    desaWilayah: "Desa Rimba Lestari",
    jenisGeometri: "polygon",
    kategori: "Wilayah Adat / Lahan",
    judul: "Poligon Agroforestri Kopi & Durian KTH Mandiri",
    manfaatMasyarakat: "Kebun campur produktif warga (kopi robusta, durian, petai, kemiri)",
    kondisiAncaman: "Produktif, dikelola 24 keluarga anggota KTH",
    deskripsi: "Batas keliling dipetakan secara partisipatif bersama pengurus KTH dengan metode walk-tracking.",
    koordinat: [
      { lat: -0.9488, lng: 100.4168, elevasi: 400 },
      { lat: -0.9462, lng: 100.4172, elevasi: 420 },
      { lat: -0.9459, lng: 100.4204, elevasi: 435 },
      { lat: -0.9485, lng: 100.4209, elevasi: 412 },
      { lat: -0.9497, lng: 100.4188, elevasi: 395 }
    ],
    panjangKm: 1.42,
    luasHa: 5.48,
    statusSinkron: "terverifikasi",
    createdAt: "2026-10-26T10:30:00.000Z",
    updatedAt: "2026-10-26T10:30:00.000Z",
    riwayatPembaruan: []
  }
];

export const AREA_OFFLINE_AWAL: AreaPetaOffline[] = [
  {
    id: "MAP-OFF-01",
    namaArea: "PetaKerja_KameraTrap_Gabungan_Desa_Lung_Barang_GeoPDF",
    basemapId: "satelit",
    minLat: -0.96,
    maxLat: -0.93,
    minLng: 100.405,
    maxLng: 100.435,
    zoomMin: 13,
    zoomMax: 18,
    jumlahTile: 1420,
    ukuranMb: 22.2,
    jarakKm: 162.23,
    thumbnailType: "radar",
    diunduhPada: "2026-10-27T19:00:00.000Z",
    jenisFile: "GeoPDF / GeoTIFF"
  },
  {
    id: "MAP-OFF-02",
    namaArea: "Hutan Desa Wa' Laya+BIG",
    basemapId: "topo",
    minLat: -0.955,
    maxLat: -0.935,
    minLng: 100.41,
    maxLng: 100.43,
    zoomMin: 14,
    zoomMax: 17,
    jumlahTile: 540,
    ukuranMb: 1.5,
    jarakKm: 206.59,
    thumbnailType: "vector",
    diunduhPada: "2026-10-26T06:30:00.000Z",
    jenisFile: "GeoPDF / GeoTIFF"
  },
  {
    id: "MAP-OFF-03",
    namaArea: "Layout DEM Ruang Atas Mentarang Hulu",
    basemapId: "topo",
    minLat: -0.958,
    maxLat: -0.932,
    minLng: 100.408,
    maxLng: 100.432,
    zoomMin: 13,
    zoomMax: 17,
    jumlahTile: 1120,
    ukuranMb: 22.5,
    jarakKm: 163.69,
    thumbnailType: "dem_atas",
    diunduhPada: "2026-10-25T14:20:00.000Z",
    jenisFile: "GeoPDF / GeoTIFF"
  },
  {
    id: "MAP-OFF-04",
    namaArea: "Layout DEM Ruang Bawah Mentarang Hulu",
    basemapId: "topo",
    minLat: -0.962,
    maxLat: -0.938,
    minLng: 100.402,
    maxLng: 100.428,
    zoomMin: 13,
    zoomMax: 17,
    jumlahTile: 1150,
    ukuranMb: 22.7,
    jarakKm: 145.18,
    thumbnailType: "dem_bawah",
    diunduhPada: "2026-10-24T11:10:00.000Z",
    jenisFile: "GeoPDF / GeoTIFF"
  }
];

export const LAPISAN_AWAL: LapisanSpasial[] = [
  {
    id: "LYR-01",
    nama: "Lapisan 1",
    jumlahPeta: 1,
    kategoriDefault: "Flora",
    createdAt: "2026-10-27T08:00:00.000Z"
  },
  {
    id: "LYR-04",
    nama: "Lapisan 4",
    jumlahPeta: 1,
    kategoriDefault: "Fauna",
    createdAt: "2026-10-26T09:30:00.000Z"
  },
  {
    id: "LYR-02",
    nama: "Lapisan 2",
    jumlahPeta: 1,
    kategoriDefault: "Mata Air",
    createdAt: "2026-10-25T10:15:00.000Z"
  },
  {
    id: "LYR-03",
    nama: "Lapisan 3",
    jumlahPeta: 1,
    kategoriDefault: "Wilayah Adat / Lahan",
    createdAt: "2026-10-24T13:00:00.000Z"
  }
];

export const SERTIFIKAT_AWAL: SertifikatKader[] = [
  {
    id: "CERT-2026-001",
    nomorSertifikat: "042/SERT-KPP/X/2026",
    idKader: "KDR-2026-014",
    namaKader: "Budi Santoso",
    desaWilayah: "Desa Rimba Lestari",
    namaOrganisasi: "Konsorsium Pemetaan Partisipatif Nusantara",
    tanggalTerbit: "2026-10-26",
    alasanCapaian: "Menyelesaikan >5,0 km Tracking Perjalanan & >5,0 Ha Poligon Wilayah",
    status: "diterbitkan",
    ditandatanganiOleh: "Ir. Hendra Wijaya, M.Sc.",
    jabatanPenandatangan: "Koordinator Program GIS & Pemetaan Partisipatif"
  }
];

export const KLAIM_UPAH_AWAL: KlaimUpahHOK[] = [
  {
    id: "HOK-2026-01",
    idKader: "KDR-2026-014",
    namaKader: "Budi Santoso",
    desaWilayah: "Desa Rimba Lestari",
    paketKe: 2,
    jumlahHok: 1,
    nominalRupiah: 150000,
    rincianBukti: "Paket 1 (Tracking 5,24 km SPS-005) + Paket 2 (Poligon 5,48 Ha SPS-006)",
    tanggalKlaim: "2026-10-26",
    status: "disetujui",
    catatanAdmin: "Data spasial GeoJSON & foto terverifikasi di GDrive. Siap dicairkan."
  }
];

export const PENGUMUMAN_AWAL: PengumumanBroadcast[] = [
  {
    id: "ANN-01",
    judul: "Standar Pengambilan Foto Pohon Induk & Mata Air",
    isi: "Pastikan GPS HP berada pada akurasi di bawah 10 meter sebelum menyimpan titik. Ambil minimal 1 foto tampak dekat dan catat manfaat lokal bagi warga desa.",
    kategori: "Panduan Survei",
    targetDesa: "Semua Wilayah",
    olehAdmin: "Tim GIS Pusat",
    tanggal: "2026-10-25",
    penting: true
  },
  {
    id: "ANN-02",
    judul: "Peringatan Cuaca: Curah Hujan Tinggi di Blok Hulu",
    isi: "BMKG memprakirakan hujan lebat sore hari di kawasan hulu sungai. Kader diharapkan menyelesaikan tracking sebelum pukul 15.00 WIB dan mengunduh peta offline sebelum berangkat.",
    kategori: "Peringatan Cuaca",
    targetDesa: "Desa Rimba Lestari",
    olehAdmin: "Koordinator Lapangan",
    tanggal: "2026-10-27",
    penting: true
  }
];

export const TUGAS_AWAL: TugasPemetaan[] = [
  {
    id: "TSK-01",
    judul: "Petakan Batas Kebun Agroforestri Blok Timur",
    deskripsi: "Lakukan pemetaan poligon keliling bersama pemilik lahan di Blok Timur serta catat titik mata air yang ada di dalamnya.",
    targetWilayah: "Dusun II - Blok Timur",
    jenisTargetGeometri: "polygon",
    kategoriTarget: "Wilayah Adat / Lahan",
    targetKuantitas: "Minimal 5,0 Ha Poligon",
    batasWaktu: "2026-11-05",
    koordinatAcuan: { lat: -0.9475, lng: 100.419 },
    status: "aktif",
    dibuatOleh: "Admin GIS"
  },
  {
    id: "TSK-02",
    judul: "Inventarisasi Titik Pohon Pakan Satwa Jalur Sungai",
    deskripsi: "Ambil titik koordinat pohon ara, beringin hutan, dan meranti sepanjang sempadan Sungai Jernih.",
    targetWilayah: "Sempadan Sungai Jernih",
    jenisTargetGeometri: "point",
    kategoriTarget: "Flora",
    targetKuantitas: "50 Titik Koordinat Flora/Fauna",
    batasWaktu: "2026-11-10",
    koordinatAcuan: { lat: -0.9491, lng: 100.4151 },
    status: "aktif",
    dibuatOleh: "Admin GIS"
  }
];

export const PESAN_AWAL: PesanKomunikasi[] = [
  {
    id: "MSG-01",
    saluran: "komunitas",
    idPengirim: "KDR-2026-008",
    namaPengirim: "Siti Rahmah (Kader Dusun I)",
    peranPengirim: "kader",
    desaPengirim: "Desa Rimba Lestari",
    teks: "Selamat pagi rekan-rekan kader! Di jalur punggungan utara tadi pagi kami menemukan pohon damar besar dan sumber mata air baru.",
    waktu: "08:30",
    statusKirim: "terkirim",
    pinKoordinat: {
      lat: -0.9448,
      lng: 100.4212,
      label: "Temuan Damar & Air Dusun I"
    }
  },
  {
    id: "MSG-02",
    saluran: "komunitas",
    idPengirim: "KDR-2026-014",
    namaPengirim: "Budi Santoso",
    peranPengirim: "kader",
    desaPengirim: "Desa Rimba Lestari",
    teks: "Mantap Kak Siti! Nanti siang tim kami lanjut menyambung tracking poligon dari batas simpang sungai.",
    waktu: "08:42",
    statusKirim: "terkirim"
  },
  {
    id: "MSG-03",
    saluran: "admin",
    idPengirim: "ADMIN-01",
    namaPengirim: "Admin GIS Organisasi",
    peranPengirim: "admin",
    desaPengirim: "Pusat",
    teks: "Halo Pak Budi, data poligon 5,48 Ha dan jalur tracking 5,24 km kemarin sudah masuk ke Google Drive dan sudah kami verifikasi. Sertifikat Kader & tiket 1 HOK sudah aktif ya!",
    waktu: "09:15",
    statusKirim: "terkirim"
  }
];

function bacaJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function simpanJson<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota error
  }
}

export const muatProfil = () => bacaJson<ProfilKader>(KEY_PROFIL, PROFIL_BAWAAN);
export const simpanProfil = (v: ProfilKader) => simpanJson(KEY_PROFIL, v);

export const muatDataSpasial = () => bacaJson<DataSpasialItem[]>(KEY_SPASIAL, DATA_SPASIAL_AWAL);
export const simpanDataSpasial = (v: DataSpasialItem[]) => simpanJson(KEY_SPASIAL, v);

export const muatAreaOffline = () => bacaJson<AreaPetaOffline[]>(KEY_OFFLINE_MAPS, AREA_OFFLINE_AWAL);
export const simpanAreaOffline = (v: AreaPetaOffline[]) => simpanJson(KEY_OFFLINE_MAPS, v);

export const muatLapisan = () => bacaJson<LapisanSpasial[]>(KEY_LAPISAN, LAPISAN_AWAL);
export const simpanLapisan = (v: LapisanSpasial[]) => simpanJson(KEY_LAPISAN, v);

export const muatSertifikat = () => bacaJson<SertifikatKader[]>(KEY_SERTIFIKAT, SERTIFIKAT_AWAL);
export const simpanSertifikat = (v: SertifikatKader[]) => simpanJson(KEY_SERTIFIKAT, v);

export const muatKlaimUpah = () => bacaJson<KlaimUpahHOK[]>(KEY_UPAH_HOK, KLAIM_UPAH_AWAL);
export const simpanKlaimUpah = (v: KlaimUpahHOK[]) => simpanJson(KEY_UPAH_HOK, v);

export const muatPengumuman = () => bacaJson<PengumumanBroadcast[]>(KEY_PENGUMUMAN, PENGUMUMAN_AWAL);
export const simpanPengumuman = (v: PengumumanBroadcast[]) => simpanJson(KEY_PENGUMUMAN, v);

export const muatTugas = () => bacaJson<TugasPemetaan[]>(KEY_TUGAS, TUGAS_AWAL);
export const simpanTugas = (v: TugasPemetaan[]) => simpanJson(KEY_TUGAS, v);

export const muatPesan = () => bacaJson<PesanKomunikasi[]>(KEY_PESAN, PESAN_AWAL);
export const simpanPesan = (v: PesanKomunikasi[]) => simpanJson(KEY_PESAN, v);

export const muatKonfigGDrive = () =>
  bacaJson<KonfigurasiGDrive>(KEY_GDRIVE, {
    webAppUrl: "",
    folderIdDatabase: "Database_Pemetaan",
    spreadsheetIdMaster: "Master_Spasial_Sheets",
    autoSyncSaatOnline: true,
    terakhirSinkron: "2026-10-27 08:00"
  });
export const simpanKonfigGDrive = (v: KonfigurasiGDrive) => simpanJson(KEY_GDRIVE, v);
