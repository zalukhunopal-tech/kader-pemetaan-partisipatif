import { DataSpasialItem, KonfigurasiGDrive } from "../types";
import { eksporKeGeoJSON, keWKT } from "./geoUtils";

export interface HasilSinkron {
  /** true hanya bila SEMUA data yang dikirim dikonfirmasi tersimpan oleh Apps Script */
  sukses: boolean;
  pesan: string;
  /** Hanya data yang dikonfirmasi tersimpan; data lain tetap berstatus "lokal" */
  idTersinkron: string[];
  jumlahGagal: number;
  /** true bila URL Apps Script belum diisi atau tidak valid (tidak ada yang dikirim) */
  belumDiatur?: boolean;
}

const UKURAN_BATCH = 10;
const BATAS_BYTE_BATCH = 4_000_000;
const WAKTU_TUNGGU_MS = 90_000;

export function urlAppsScriptValid(url: string | undefined): boolean {
  const u = (url ?? "").trim();
  return u.startsWith("https://script.google.com/") && /\/exec(\?.*)?$/.test(u);
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

async function kirimBatch(url: string, konfig: KonfigurasiGDrive, batch: DataSpasialItem[]): Promise<BalasanDiterima> {
  const payload = {
    action: "sync_spatial_batch",
    token: konfig.tokenBersama ?? "",
    folderId: konfig.folderIdDatabase,
    spreadsheetId: konfig.spreadsheetIdMaster,
    timestamp: new Date().toISOString(),
    geojsonBundle: eksporKeGeoJSON(batch),
    records: batch.map((d) => ({
      id: d.id,
      idKader: d.idKader,
      namaKader: d.namaKader,
      desaWilayah: d.desaWilayah,
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
      namaFileFoto:
        d.namaFileFoto || `${d.kategori.toUpperCase().replace(/\W+/g, "_")}_${d.idKader}_${d.createdAt.slice(0, 10).replace(/-/g, "")}.jpg`,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }))
  };

  const pengendali = new AbortController();
  const pewaktu = setTimeout(() => pengendali.abort(), WAKTU_TUNGGU_MS);
  try {
    const resp = await fetch(url, {
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
 * Web App. Status data hanya berubah untuk id yang dikonfirmasi tersimpan; tanpa URL yang
 * valid tidak ada yang dikirim dan tidak ada yang dilaporkan berhasil.
 */
export async function sinkronkanDataKeGDrive(itemList: DataSpasialItem[], konfig: KonfigurasiGDrive): Promise<HasilSinkron> {
  const belumSinkron = itemList.filter((d) => d.statusSinkron === "lokal");
  if (belumSinkron.length === 0) {
    return {
      sukses: true,
      pesan: "Semua data lapangan sudah tersinkron dengan Google Drive.",
      idTersinkron: [],
      jumlahGagal: 0
    };
  }

  const url = (konfig.webAppUrl ?? "").trim();
  if (!urlAppsScriptValid(url)) {
    return {
      sukses: false,
      pesan: "Belum tersambung ke Google Drive. Isi URL Web App (berakhiran /exec) dan token di bagian Konfigurasi. Data tetap aman di HP.",
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
      const hasil = await kirimBatch(url, konfig, batch);
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

/**
 * Kode Google Apps Script (Code.gs) siap pakai untuk dipasang di Google Spreadsheet / Drive Organisasi
 */
export const KODE_GOOGLE_APPS_SCRIPT = `/**
 * BACKEND OTOMATIS GEOKADER - DATABASE PEMETAAN PARTISIPATIF
 * Pasang di: Google Sheets -> Extensions -> Apps Script -> Deploy as Web App (Anyone)
 *
 * WAJIB: Project Settings -> Script Properties -> tambah GEOKADER_TOKEN
 * berisi kata sandi bersama, lalu isi nilai yang sama di aplikasi
 * (Sinkronisasi -> Konfigurasi -> Token). Permintaan tanpa token yang cocok ditolak.
 *
 * Penyimpanan idempoten: data dengan ID yang sama diperbarui, bukan digandakan,
 * sehingga pengiriman ulang setelah gangguan jaringan aman.
 *
 * Struktur Folder Otomatis di Google Drive:
 * Database_Pemetaan/
 *   ├── Data_Spasial/
 *   │     └── [Tahun-Bulan]/
 *   │           └── [Nama_Kader]/Batch_xxx.geojson
 *   └── Foto_Lapangan/
 *         └── FLORA_KADER01_20261027.jpg
 */

var KOLOM = [
  "ID_Data", "ID_Kader", "Nama_Kader", "Desa_Wilayah", "Jenis_Geometri",
  "Kategori", "Judul", "Nama_Lokal", "Nama_Ilmiah", "Jumlah_Individu",
  "Panjang_Km", "Luas_Ha", "Koordinat_WKT", "Tautan_Foto_Drive",
  "Status_Verifikasi", "Waktu_Rekam", "Waktu_Sinkron"
];
var KOL_FOTO = 14;
var KOL_STATUS = 15;

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var body = JSON.parse(e.postData.contents);

    var tokenTersimpan = PropertiesService.getScriptProperties().getProperty("GEOKADER_TOKEN");
    if (!tokenTersimpan) {
      return balas_({ sukses: false, pesan: "GEOKADER_TOKEN belum diatur di Script Properties." });
    }
    if (body.token !== tokenTersimpan) {
      return balas_({ sukses: false, pesan: "Token tidak cocok. Periksa token di Konfigurasi aplikasi." });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return balas_({ sukses: false, pesan: "Skrip harus dipasang dari dalam Google Spreadsheet." });
    }

    var rootFolder = siapkanFolderRoot_(body.folderId || "Database_Pemetaan");
    var folderSpasial = dapatkanAtauBuatFolder_(rootFolder, "Data_Spasial");
    var folderFoto = dapatkanAtauBuatFolder_(rootFolder, "Foto_Lapangan");

    var namaTab = body.spreadsheetId || "Master_Spasial";
    var sheet = ss.getSheetByName(namaTab);
    if (!sheet) {
      sheet = ss.insertSheet(namaTab);
      sheet.appendRow(KOLOM);
    }

    var barisAda = {};
    var jmlBaris = sheet.getLastRow();
    if (jmlBaris > 1) {
      var idAda = sheet.getRange(2, 1, jmlBaris - 1, 1).getValues();
      for (var i = 0; i < idAda.length; i++) barisAda[String(idAda[i][0])] = i + 2;
    }

    var records = body.records || [];
    var nowIso = new Date().toISOString();
    var diterima = [];
    var gagal = [];

    for (var j = 0; j < records.length; j++) {
      var r = records[j];
      try {
        var baris = barisAda[String(r.id)];
        var fotoUrl = "";
        var status = "Tersinkron_GDrive";
        if (baris) {
          var lama = sheet.getRange(baris, 1, 1, KOLOM.length).getValues()[0];
          fotoUrl = String(lama[KOL_FOTO - 1] || "");
          status = String(lama[KOL_STATUS - 1] || status);
        }
        if (!fotoUrl && r.fotoBase64 && r.fotoBase64.indexOf("base64,") !== -1) {
          var parts = r.fotoBase64.split("base64,");
          var bytes = Utilities.base64Decode(parts[1]);
          var blob = Utilities.newBlob(bytes, "image/jpeg", r.namaFileFoto || (r.id + ".jpg"));
          fotoUrl = folderFoto.createFile(blob).getUrl();
        }

        var nilai = [
          r.id, r.idKader, r.namaKader, r.desaWilayah, r.jenisGeometri,
          r.kategori, r.judul, r.namaLokal, r.namaIlmiah, r.jumlahIndividu,
          r.panjangKm, r.luasHa, r.wkt, fotoUrl,
          status, r.createdAt, nowIso
        ];
        if (baris) {
          sheet.getRange(baris, 1, 1, nilai.length).setValues([nilai]);
        } else {
          sheet.appendRow(nilai);
          barisAda[String(r.id)] = sheet.getLastRow();
        }
        diterima.push(r.id);
      } catch (err) {
        gagal.push({ id: r.id, pesan: String(err) });
      }
    }

    if (body.geojsonBundle && diterima.length > 0) {
      try {
        simpanGeojsonPerKader_(folderSpasial, body.geojsonBundle, diterima, nowIso);
      } catch (err2) {
        // Arsip GeoJSON bersifat tambahan; data utama sudah tersimpan di Spreadsheet
      }
    }

    return balas_({ sukses: gagal.length === 0, diterima: diterima, gagal: gagal, jumlah: diterima.length });
  } catch (err) {
    return balas_({ sukses: false, pesan: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function simpanGeojsonPerKader_(folderSpasial, geojsonBundle, idDiterima, nowIso) {
  var bundle = JSON.parse(geojsonBundle);
  var diterimaSet = {};
  for (var i = 0; i < idDiterima.length; i++) diterimaSet[String(idDiterima[i])] = true;

  var perKader = {};
  var fitur = bundle.features || [];
  for (var j = 0; j < fitur.length; j++) {
    var f = fitur[j];
    if (!diterimaSet[String(f.id)]) continue;
    var nama = (f.properties && f.properties.namaKader) || "Kader";
    if (!perKader[nama]) perKader[nama] = [];
    perKader[nama].push(f);
  }

  var subBulan = dapatkanAtauBuatFolder_(folderSpasial, nowIso.slice(0, 7));
  for (var nm in perKader) {
    var folderKader = dapatkanAtauBuatFolder_(subBulan, String(nm).replace(/[^A-Za-z0-9 _.-]/g, "_"));
    folderKader.createFile(
      "Batch_" + Date.now() + ".geojson",
      JSON.stringify({ type: "FeatureCollection", features: perKader[nm] }),
      MimeType.PLAIN_TEXT
    );
  }
}

function balas_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function siapkanFolderRoot_(nilai) {
  if (/^[A-Za-z0-9_-]{25,}$/.test(nilai)) {
    try { return DriveApp.getFolderById(nilai); } catch (e) {}
  }
  return dapatkanAtauBuatFolder_(null, nilai);
}

function dapatkanAtauBuatFolder_(induk, nama) {
  var parent = induk || DriveApp.getRootFolder();
  var iter = parent.getFoldersByName(nama);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(nama);
}
`;
