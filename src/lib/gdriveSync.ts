import { useState, useEffect, useCallback, useRef } from "react";
import { DataSpasialItem, WilayahAdministrasi } from "../types";
import { eksporKeGeoJSON, keWKT } from "./geoUtils";
import { wilayahAkun } from "./auth";
import { namaBerkasData, wilayahUntukData } from "./wilayah";
import { sinkronkanBertahapKeGDrive } from "./gdriveBertahap";

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

const GDRIVE_URL_DEFAULT =
  "https://script.google.com/macros/s/AKfycbzAQXKvXddb8IG9lf3kyf4brebn68u2LIC9Sw_gZnw1poGcXAIoKmDy1raIeV6_1X8D/exec";
const GDRIVE_TOKEN_DEFAULT = "893533c720cc47f3a094db1b183539da";

export const KONEKSI_GDRIVE: KoneksiGDrive = {
  url: (import.meta.env.VITE_GDRIVE_URL || (import.meta.env.MODE !== "test" ? GDRIVE_URL_DEFAULT : "")).trim(),
  token: (import.meta.env.VITE_GDRIVE_TOKEN || (import.meta.env.MODE !== "test" ? GDRIVE_TOKEN_DEFAULT : "")).trim()
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
  konflik?: import("../types").KonflikSinkron[];
  konfirmasi?: { id: string; revisiServer: string; fingerprint: string }[];
}

export { sinkronkanBertahapKeGDrive, terapkanHasilSinkron, selesaikanKonflik } from "./gdriveBertahap";

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
  /** Aktifkan setelah deployment Apps Script protokol 3 tersedia. */
  protokol?: "v2" | "v3";
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
  const butuhProtokolBaru = itemList.some(
    (d) => d.statusSinkron === "lokal" && Boolean(d.memoSuara?.length || d.kesepakatanBatas || d.buktiFoto || d.gpsAveraging)
  );
  if (butuhProtokolBaru || opsi.protokol === "v3" || (!opsi.protokol && import.meta.env.VITE_GDRIVE_SYNC_V3 === "true")) {
    return sinkronkanBertahapKeGDrive(itemList, opsi);
  }
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

export type StatusAutoSync = "tersinkron" | "menyinkronkan" | "offline" | "antrean" | "galat";

export interface StateAutoSync {
  status: StatusAutoSync;
  antreanCount: number;
  pesanStatus: string;
  sedangSinkron: boolean;
  sinkronSekarang: () => Promise<void>;
}

/**
 * Hook 100% Automatic Background Sync ke Google Drive & Cloud
 * Berjalan otomatis di latar belakang saat online, saat ada rekaman data baru,
 * dan berkala 60 detik tanpa memerlukan menu intervensi manual dari kader.
 */
export function useAutoSyncGDrive(
  dataSpasial: DataSpasialItem[],
  onDataTersinkron: (idTersinkron: string[]) => void
): StateAutoSync {
  const [online, setOnline] = useState<boolean>(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [sedangSinkron, setSedangSinkron] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusAutoSync>("tersinkron");
  const [pesanStatus, setPesanStatus] = useState<string>("Tersinkron Otomatis");
  const isSyncingRef = useRef<boolean>(false);
  const dataSpasialRef = useRef(dataSpasial);
  dataSpasialRef.current = dataSpasial;

  const antreanCount = dataSpasial.filter((d) => d.statusSinkron === "lokal").length;

  const jalankanSinkron = useCallback(async () => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      setPesanStatus(
        antreanCount > 0
          ? `Mode Offline (${antreanCount} data tersimpan aman di HP)`
          : "Mode Offline (Data tersimpan aman)"
      );
      return;
    }

    const belumSinkron = dataSpasialRef.current.filter((d) => d.statusSinkron === "lokal");
    if (belumSinkron.length === 0) {
      setStatus("tersinkron");
      setPesanStatus("Tersinkron Otomatis");
      return;
    }

    isSyncingRef.current = true;
    setSedangSinkron(true);
    setStatus("menyinkronkan");
    setPesanStatus(`Menyinkronkan ${belumSinkron.length} data ke Cloud…`);

    try {
      const hasil = await sinkronkanDataKeGDrive(belumSinkron);
      if (hasil.idTersinkron.length > 0) {
        onDataTersinkron(hasil.idTersinkron);
      }

      if (hasil.sukses) {
        setStatus("tersinkron");
        setPesanStatus("Tersinkron Otomatis");
      } else {
        setStatus("antrean");
        setPesanStatus(`Tersimpan lokal (${hasil.jumlahGagal} dalam antrean auto-sync)`);
      }
    } catch {
      setStatus("antrean");
      setPesanStatus(`Tersimpan aman di HP (${belumSinkron.length} data)`);
    } finally {
      isSyncingRef.current = false;
      setSedangSinkron(false);
    }
  }, [antreanCount, onDataTersinkron]);

  // Listener event online / offline browser
  useEffect(() => {
    const saatOnline = () => {
      setOnline(true);
      void jalankanSinkron();
    };
    const saatOffline = () => {
      setOnline(false);
      setStatus("offline");
      setPesanStatus(
        antreanCount > 0
          ? `Mode Offline (${antreanCount} data tersimpan aman di HP)`
          : "Mode Offline"
      );
    };

    window.addEventListener("online", saatOnline);
    window.addEventListener("offline", saatOffline);
    return () => {
      window.removeEventListener("online", saatOnline);
      window.removeEventListener("offline", saatOffline);
    };
  }, [jalankanSinkron, antreanCount]);

  // Trigger auto-sync saat data baru disimpan ketika perangkat sedang online
  useEffect(() => {
    if (online && antreanCount > 0 && !isSyncingRef.current) {
      const timer = setTimeout(() => {
        void jalankanSinkron();
      }, 1200); // Debounce sedikit agar batching data tidak spam network
      return () => clearTimeout(timer);
    }
  }, [antreanCount, online, jalankanSinkron]);

  // Polling auto-sync berkala setiap 60 detik jika ada antrean data
  useEffect(() => {
    const interval = setInterval(() => {
      if (online && antreanCount > 0 && !isSyncingRef.current) {
        void jalankanSinkron();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [online, antreanCount, jalankanSinkron]);

  return {
    status,
    antreanCount,
    pesanStatus,
    sedangSinkron,
    sinkronSekarang: jalankanSinkron
  };
}
