import { DataSpasialItem, WilayahAdministrasi } from "../types";
import { eksporKeGeoJSON, keWKT } from "./geoUtils";
import { wilayahAkun } from "./auth";
import { namaBerkasData, wilayahUntukData } from "./wilayah";

/**
 * Unggahan data spasial ke Google Drive pemilik aplikasi lewat Web App Apps Script (apps-script/Code.gs).
 * Alamat dan token diisi saat build (VITE_GDRIVE_URL, VITE_GDRIVE_TOKEN), tidak bisa diubah dari aplikasi.
 * Code.gs menyimpan setiap data di folder Provinsi/Kabupaten/Kecamatan/Desa milik akun pembuatnya,
 * dalam berkas bernama akun_data_bulan_tahun (mis. budi_sebaran_anggrek_november_2026).
 */
export interface KoneksiGDrive {
  url: string;
  token: string;
}

export const KONEKSI_GDRIVE: KoneksiGDrive = {
  url: (import.meta.env.VITE_GDRIVE_URL ?? "").trim(),
  token: (import.meta.env.VITE_GDRIVE_TOKEN ?? "").trim()
};

export interface HasilSinkron {
  /** true hanya bila SEMUA data yang dikirim dikonfirmasi tersimpan oleh Apps Script */
  sukses: boolean;
  pesan: string;
  /** Hanya data yang dikonfirmasi tersimpan; data lain tetap berstatus "lokal" */
  idTersinkron: string[];
  jumlahGagal: number;
  /** true bila Google Drive belum dipasang di build ini (tidak ada yang dikirim) */
  belumDiatur?: boolean;
}

const UKURAN_BATCH = 10;
const BATAS_BYTE_BATCH = 4_000_000;
const WAKTU_TUNGGU_MS = 90_000;

export function urlAppsScriptValid(url: string | undefined): boolean {
  const u = (url ?? "").trim();
  return u.startsWith("https://script.google.com/") && /\/exec(\?.*)?$/.test(u);
}

/** true bila build ini memuat alamat Web App dan token Google Drive */
export const gdriveTerpasang = (koneksi: KoneksiGDrive = KONEKSI_GDRIVE): boolean =>
  urlAppsScriptValid(koneksi.url) && koneksi.token !== "";

export type CariWilayahAkun = (idKader: string) => Partial<WilayahAdministrasi> | undefined;

/** Folder wilayah dan nama berkas tujuan sebuah data di Google Drive */
export function tujuanDrive(d: DataSpasialItem, cariWilayah: CariWilayahAkun = wilayahAkun) {
  return { wilayah: wilayahUntukData(d, cariWilayah(d.idKader)), namaBerkas: namaBerkasData(d) };
}

export interface OpsiSinkron {
  koneksi?: KoneksiGDrive;
  cariWilayah?: CariWilayahAkun;
}

interface BalasanDiterima {
  diterima: string[];
  gagal: { id: string; pesan: string }[];
}

/**
 * Menafsirkan balasan Apps Script. Data hanya dianggap tersimpan bila dikonfirmasi:
 * - format baru: daftar `diterima` per id
 * - format lama: `sukses: true` dan `jumlah` sama dengan data yang dikirim
 * Selain itu dilempar galat, karena HTTP 200 saja tidak membuktikan apa pun
 * (Apps Script membalas 200 juga saat galat atau token salah).
 */
export function tafsirkanBalasan(json: unknown, idDikirim: string[]): BalasanDiterima {
  const b = (json ?? {}) as Record<string, unknown>;
  if (Array.isArray(b.diterima)) {
    const diterimaSet = new Set(b.diterima.map(String));
    const diterima = idDikirim.filter((id) => diterimaSet.has(id));
    const dilaporkan = new Map<string, string>();
    if (Array.isArray(b.gagal)) {
      for (const g of b.gagal as Record<string, unknown>[]) {
        if (g && typeof g.id !== "undefined") dilaporkan.set(String(g.id), String(g.pesan ?? "ditolak"));
      }
    }
    const gagal = idDikirim
      .filter((id) => !diterimaSet.has(id))
      .map((id) => ({ id, pesan: dilaporkan.get(id) ?? "tidak dikonfirmasi oleh Apps Script" }));
    return { diterima, gagal };
  }
  if (b.sukses === true && Number(b.jumlah) === idDikirim.length) {
    return { diterima: [...idDikirim], gagal: [] };
  }
  if (b.sukses === false) {
    throw new Error(String(b.pesan ?? "Apps Script menolak permintaan"));
  }
  throw new Error("Balasan Apps Script tidak sah atau jumlah data tersimpan tidak cocok");
}

function ukuranRekamanByte(r: unknown): number {
  return JSON.stringify(r).length;
}

function bagiBatch<T>(daftar: T[]): T[][] {
  const hasil: T[][] = [];
  let sekarang: T[] = [];
  let byte = 0;
  for (const item of daftar) {
    const ukuran = ukuranRekamanByte(item);
    if (sekarang.length > 0 && (sekarang.length >= UKURAN_BATCH || byte + ukuran > BATAS_BYTE_BATCH)) {
      hasil.push(sekarang);
      sekarang = [];
      byte = 0;
    }
    sekarang.push(item);
    byte += ukuran;
  }
  if (sekarang.length > 0) hasil.push(sekarang);
  return hasil;
}

function pesanGalat(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return `waktu habis setelah ${WAKTU_TUNGGU_MS / 1000} detik`;
  }
  if (err instanceof TypeError) {
    return "tidak ada koneksi atau URL tidak dapat dijangkau";
  }
  return err instanceof Error ? err.message : String(err);
}

async function kirimBatch(koneksi: KoneksiGDrive, batch: DataSpasialItem[], cariWilayah: CariWilayahAkun): Promise<BalasanDiterima> {
  const tujuan = batch.map((d) => tujuanDrive(d, cariWilayah));
  const payload = {
    action: "sync_spatial_batch",
    versi: 2,
    token: koneksi.token,
    timestamp: new Date().toISOString(),
    geojsonBundle: eksporKeGeoJSON(batch.map((d, i) => ({ ...d, wilayah: tujuan[i].wilayah }))),
    records: batch.map((d, i) => ({
      id: d.id,
      idKader: d.idKader,
      namaKader: d.namaKader,
      desaWilayah: d.desaWilayah,
      wilayah: tujuan[i].wilayah,
      namaBerkas: tujuan[i].namaBerkas,
      jenisGeometri: d.jenisGeometri,
      kategori: d.kategori,
      judul: d.judul,
      namaLokal: d.namaLokal || "",
      namaIlmiah: d.namaIlmiah || "",
      jumlahIndividu: d.jumlahIndividu ?? "",
      manfaatMasyarakat: d.manfaatMasyarakat || "",
      kondisiAncaman: d.kondisiAncaman || "",
      deskripsi: d.deskripsi,
      wkt: keWKT(d),
      panjangKm: d.panjangKm,
      luasHa: d.luasHa,
      fotoBase64: d.fotoBase64 || "",
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }))
  };

  const pengendali = new AbortController();
  const pewaktu = setTimeout(() => pengendali.abort(), WAKTU_TUNGGU_MS);
  try {
    const resp = await fetch(koneksi.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: pengendali.signal
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const teks = await resp.text();
    let json: unknown;
    try {
      json = JSON.parse(teks);
    } catch {
      throw new Error('balasan bukan JSON (pastikan Web App dipasang dengan akses "Anyone" dan URL berakhiran /exec)');
    }
    return tafsirkanBalasan(
      json,
      batch.map((d) => d.id)
    );
  } finally {
    clearTimeout(pewaktu);
  }
}

/**
 * Mengirim antrean data spasial ke Google Drive & Google Sheets lewat Google Apps Script
 * Web App. Status data hanya berubah untuk id yang dikonfirmasi tersimpan; tanpa Google Drive
 * yang terpasang di build ini tidak ada yang dikirim dan tidak ada yang dilaporkan berhasil.
 */
export async function sinkronkanDataKeGDrive(itemList: DataSpasialItem[], opsi: OpsiSinkron = {}): Promise<HasilSinkron> {
  const koneksi = opsi.koneksi ?? KONEKSI_GDRIVE;
  const cariWilayah = opsi.cariWilayah ?? wilayahAkun;
  const belumSinkron = itemList.filter((d) => d.statusSinkron === "lokal");
  if (belumSinkron.length === 0) {
    return {
      sukses: true,
      pesan: "Semua data lapangan sudah tersinkron dengan Google Drive.",
      idTersinkron: [],
      jumlahGagal: 0
    };
  }

  if (!gdriveTerpasang(koneksi)) {
    return {
      sukses: false,
      pesan: "Unggahan ke Google Drive belum aktif di aplikasi ini. Data tetap aman di HP.",
      idTersinkron: [],
      jumlahGagal: belumSinkron.length,
      belumDiatur: true
    };
  }

  const idTersinkron: string[] = [];
  const gagal: { id: string; pesan: string }[] = [];
  let galat: string | null = null;

  for (const batch of bagiBatch(belumSinkron)) {
    try {
      const hasil = await kirimBatch(koneksi, batch, cariWilayah);
      idTersinkron.push(...hasil.diterima);
      gagal.push(...hasil.gagal);
    } catch (err) {
      galat = pesanGalat(err);
      break;
    }
  }

  const total = belumSinkron.length;
  const jumlahGagal = total - idTersinkron.length;
  if (jumlahGagal === 0) {
    return {
      sukses: true,
      pesan: `${total} data dan foto berhasil diunggah dan dikonfirmasi oleh Google Drive & Spreadsheet.`,
      idTersinkron,
      jumlahGagal: 0
    };
  }

  const alasan = (galat ?? gagal[0]?.pesan ?? "tidak dikonfirmasi").replace(/[.\s]+$/, "");
  const pesan =
    idTersinkron.length > 0
      ? `${idTersinkron.length} dari ${total} data tersimpan di Google Drive. ${jumlahGagal} belum berhasil (${alasan}). Data yang belum tersimpan tetap aman di HP.`
      : `Gagal mengunggah ke Google Drive: ${alasan}. Data tetap aman di memori HP.`;
  return { sukses: false, pesan, idTersinkron, jumlahGagal };
}
