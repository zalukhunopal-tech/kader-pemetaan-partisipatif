import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { DataSpasialItem, KonflikSinkron, PilihanResolusiKonflik, StatusAntreanSinkron } from "../types";
import { bacaTeks, tulisTeks, simpanSekarang } from "./penyimpanan";
import { eksporKeGeoJSON, wktUntukSpreadsheet } from "./geoUtils";
import { hitungSkorKualitasData } from "./kualitasData";
import { gdriveTerpasang, HasilSinkron, KONEKSI_GDRIVE, OpsiSinkron, tujuanDrive } from "./gdriveSync";

export const KUNCI_ANTREAN_SINKRON = "titik_tapak_antrean_v3";
export const BATAS_METADATA_BYTE = 48_000;
export const UKURAN_CHUNK_BYTE = 24_000;
const utf8 = new TextEncoder();
export const checksumSha256 = (isi: Uint8Array | string) => bytesToHex(sha256(typeof isi === "string" ? utf8.encode(isi) : isi));
const ukuran = (x: unknown) => utf8.encode(JSON.stringify(x)).length;

export function fingerprintData(d: DataSpasialItem): string {
  return checksumSha256(
    JSON.stringify({ ...d, statusSinkron: undefined, revisiServer: undefined, konflikSinkron: undefined, kualitasData: undefined })
  );
}
export function bacaAntreanSinkron(): Record<string, StatusAntreanSinkron> {
  try {
    return JSON.parse(bacaTeks(KUNCI_ANTREAN_SINKRON) ?? "{}");
  } catch {
    return {};
  }
}
export function jedaBackoffMs(percobaan: number): number {
  return Math.min(300_000, 1000 * 2 ** Math.max(0, Math.min(18, percobaan - 1)));
}

export interface OpsiSinkronBertahap extends OpsiSinkron {
  signal?: AbortSignal;
  /** Suntikan jam/transport untuk pengujian dan host alternatif, tanpa menaruh token di antrean. */
  sekarang?: () => number;
  transport?: typeof fetch;
  tunggu?: (ms: number) => Promise<void>;
  progres?: (antrean: StatusAntreanSinkron) => void;
}
interface BalasanV3 {
  sukses: boolean;
  protokol?: number;
  pesan?: string;
  uploadId?: string;
  chunkDiterima?: number[];
  revisiServer?: string;
  konflik?: { revisiServer: string; server: DataSpasialItem };
}
class GalatPermanen extends Error {}

/** Semua metadata diprioritaskan sebelum satu chunk media pun dikirim. */
export async function sinkronkanBertahapKeGDrive(daftar: DataSpasialItem[], opsi: OpsiSinkronBertahap = {}): Promise<HasilSinkron> {
  const koneksi = opsi.koneksi ?? KONEKSI_GDRIVE,
    sekarang = opsi.sekarang ?? Date.now,
    transport = opsi.transport ?? fetch;
  const lokal = daftar.filter((d) => d.statusSinkron === "lokal" && !d.konflikSinkron);
  const hasil: HasilSinkron = { sukses: false, pesan: "", idTersinkron: [], jumlahGagal: lokal.length, konflik: [], konfirmasi: [] };
  if (!lokal.length)
    return {
      ...hasil,
      sukses: !daftar.some((d) => d.konflikSinkron),
      jumlahGagal: daftar.filter((d) => d.konflikSinkron).length,
      pesan: daftar.some((d) => d.konflikSinkron) ? "Selesaikan konflik data sebelum mengunggah ulang." : "Tidak ada antrean baru."
    };
  if (!gdriveTerpasang(koneksi))
    return { ...hasil, belumDiatur: true, pesan: "Unggahan ke Google Drive belum aktif. Data tetap aman di HP." };
  const antrean = bacaAntreanSinkron(),
    galat: string[] = [];
  const simpan = async (a: StatusAntreanSinkron) => {
    antrean[a.idData] = a;
    tulisTeks(KUNCI_ANTREAN_SINKRON, JSON.stringify(antrean));
    await simpanSekarang();
    opsi.progres?.({ ...a });
  };
  const request = async (payload: Record<string, unknown>): Promise<BalasanV3> => {
    for (let percobaan = 0; ; percobaan++) {
      opsi.signal?.throwIfAborted();
      const kontrol = new AbortController(),
        timeout = setTimeout(() => kontrol.abort(), 25_000);
      const batal = () => kontrol.abort();
      opsi.signal?.addEventListener("abort", batal, { once: true });
      try {
        const body = JSON.stringify({ ...payload, token: koneksi.token });
        if (utf8.encode(body).length > 50_000) throw new GalatPermanen("Paket sinkronisasi melebihi 50 KB.");
        const resp = await transport(koneksi.url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body,
          signal: kontrol.signal
        });
        if (!resp.ok) {
          if (resp.status === 408 || resp.status === 429 || resp.status >= 500) throw new Error(`HTTP ${resp.status}`);
          throw new GalatPermanen(`HTTP ${resp.status}`);
        }
        let b: BalasanV3;
        try {
          b = JSON.parse(await resp.text());
        } catch {
          throw new GalatPermanen("Balasan bukan JSON; periksa deployment Apps Script.");
        }
        if (b.protokol !== 3) throw new GalatPermanen("Perbarui deployment Apps Script ke protokol 3 sebelum sinkronisasi bertahap.");
        if (!b.sukses && !b.konflik) throw new GalatPermanen(b.pesan ?? "Server menolak unggahan.");
        return b;
      } catch (e) {
        if (e instanceof GalatPermanen || opsi.signal?.aborted || percobaan >= 2) throw e;
      } finally {
        clearTimeout(timeout);
        opsi.signal?.removeEventListener("abort", batal);
      }
      const ms = jedaBackoffMs(percobaan + 1);
      await (
        opsi.tunggu ??
        ((n: number) =>
          new Promise<void>((r, j) => {
            const batal = () => {
              clearTimeout(t);
              opsi.signal?.removeEventListener("abort", batal);
              j(new DOMException("Dibatalkan", "AbortError"));
            };
            const t = setTimeout(() => {
              opsi.signal?.removeEventListener("abort", batal);
              r();
            }, n);
            opsi.signal?.addEventListener("abort", batal, { once: true });
            if (opsi.signal?.aborted) batal();
          }))
      )(ms);
    }
  };
  const konflik = (d: DataSpasialItem, b: BalasanV3, a: StatusAntreanSinkron) => {
    if (!b.konflik) return false;
    hasil.konflik!.push({
      idData: d.id,
      lokal: { ...d, konflikSinkron: undefined },
      server: b.konflik.server,
      revisiServer: b.konflik.revisiServer,
      terdeteksiPada: new Date(sekarang()).toISOString()
    });
    a.fase = "konflik";
    return true;
  };
  const siap: { d: DataSpasialItem; a: StatusAntreanSinkron; bytes: Uint8Array }[] = [];
  try {
    await request({ action: "sync_capabilities" });
  } catch (e) {
    return { ...hasil, pesan: e instanceof Error ? e.message : String(e) };
  }
  for (const d of lokal) {
    const f = fingerprintData(d),
      lama = antrean[d.id];
    if (lama?.fingerprint === f && lama.cobaLagiPada && Date.parse(lama.cobaLagiPada) > sekarang()) {
      galat.push("Antrean menunggu jadwal percobaan ulang.");
      continue;
    }
    const a: StatusAntreanSinkron = {
      idData: d.id,
      fingerprint: f,
      fase: "metadata",
      chunkDiterima: [],
      jumlahChunk: 0,
      percobaan: lama?.fingerprint === f ? lama.percobaan : 0
    };
    try {
      const dqa = hitungSkorKualitasData(d);
      if (!dqa.geometriValid) throw new GalatPermanen(dqa.masalah[0]);
      const tujuan = tujuanDrive(d, opsi.cariWilayah);
      const snapshot = { ...d, konflikSinkron: undefined, kualitasData: dqa };
      const record = { ...snapshot, ...tujuan, wkt: wktUntukSpreadsheet(d).wkt };
      const feature = JSON.parse(eksporKeGeoJSON([{ ...snapshot, wilayah: tujuan.wilayah }])).features[0];
      const bytes = utf8.encode(JSON.stringify({ record, feature }));
      if (bytes.length > 8_000_000) throw new GalatPermanen("Data melebihi batas 8 MB per objek; pisahkan rekaman atau media.");
      a.jumlahChunk = Math.ceil(bytes.length / UKURAN_CHUNK_BYTE);
      const meta = {
        ...record,
        koordinat: undefined,
        riwayatPembaruan: undefined,
        memoSuara: undefined,
        fotoBase64: undefined,
        gpsAveraging: undefined,
        konflikSinkron: undefined,
        wkt: undefined
      };
      if (ukuran(meta) > BATAS_METADATA_BYTE) throw new GalatPermanen("Metadata melebihi 48 KB; ringkas atribut teks.");
      const b = await request({
        action: "sync_metadata_v3",
        metadata: meta,
        baseRevision: d.revisiServer ?? "",
        fingerprint: f,
        checksum: checksumSha256(bytes),
        jumlahChunk: a.jumlahChunk,
        ukuranByte: bytes.length
      });
      if (konflik(d, b, a)) {
        await simpan(a);
        continue;
      }
      if (!b.uploadId || !Array.isArray(b.chunkDiterima)) throw new GalatPermanen("Konfirmasi metadata tidak lengkap.");
      a.uploadId = b.uploadId;
      a.chunkDiterima = b.chunkDiterima;
      a.fase = "media";
      await simpan(a);
      siap.push({ d, a, bytes });
    } catch (e) {
      a.fase = "gagal";
      a.percobaan++;
      a.galat = e instanceof Error ? e.message : String(e);
      a.cobaLagiPada = new Date(sekarang() + jedaBackoffMs(a.percobaan)).toISOString();
      await simpan(a);
      galat.push(a.galat);
    }
  }
  for (const { d, a, bytes } of siap) {
    try {
      for (let indeks = 0; indeks < a.jumlahChunk; indeks++) {
        if (a.chunkDiterima.includes(indeks)) continue;
        const chunk = bytes.slice(indeks * UKURAN_CHUNK_BYTE, (indeks + 1) * UKURAN_CHUNK_BYTE);
        const b64 = btoa(Array.from(chunk, (b) => String.fromCharCode(b)).join(""));
        const b = await request({ action: "sync_chunk_v3", uploadId: a.uploadId, indeks, data: b64, checksum: checksumSha256(chunk) });
        if (!b.chunkDiterima?.includes(indeks)) throw new GalatPermanen("Chunk belum dikonfirmasi server.");
        a.chunkDiterima = b.chunkDiterima;
        await simpan(a);
      }
      const b = await request({ action: "sync_finalize_v3", uploadId: a.uploadId });
      if (konflik(d, b, a)) {
        await simpan(a);
        continue;
      }
      if (!b.revisiServer) throw new GalatPermanen("Revisi akhir server belum dikonfirmasi.");
      a.fase = "selesai";
      a.galat = undefined;
      a.cobaLagiPada = undefined;
      a.percobaan = 0;
      await simpan(a);
      hasil.idTersinkron.push(d.id);
      hasil.konfirmasi!.push({ id: d.id, revisiServer: b.revisiServer, fingerprint: a.fingerprint });
    } catch (e) {
      a.fase = "gagal";
      a.percobaan++;
      a.galat = e instanceof Error ? e.message : String(e);
      a.cobaLagiPada = new Date(sekarang() + jedaBackoffMs(a.percobaan)).toISOString();
      await simpan(a);
      galat.push(a.galat);
    }
  }
  hasil.jumlahGagal = lokal.length - hasil.idTersinkron.length;
  hasil.sukses = hasil.jumlahGagal === 0;
  hasil.pesan = hasil.sukses
    ? `${hasil.idTersinkron.length} data lengkap dikonfirmasi tersimpan di Google Drive.`
    : `${hasil.idTersinkron.length} dari ${lokal.length} data lengkap tersimpan. ${hasil.konflik!.length} konflik perlu ditinjau. ${galat[0] ?? "Data lokal tetap aman."}`;
  return hasil;
}

/** Gabungan wajib eksplisit, terutama geometri; tidak pernah menimpa identitas atau keputusan admin. */
export function selesaikanKonflik(
  k: KonflikSinkron,
  pilihan: PilihanResolusiKonflik,
  gabungan?: Partial<DataSpasialItem>
): DataSpasialItem {
  if (k.lokal.id !== k.server.id || k.lokal.idKader !== k.server.idKader) throw new Error("Identitas konflik tidak cocok.");
  if (pilihan === "admin") return { ...k.server, revisiServer: k.revisiServer, konflikSinkron: undefined };
  if (pilihan === "gabungkan" && !gabungan) throw new Error("Pilih atribut gabungan secara eksplisit.");
  const d = {
    ...k.lokal,
    ...(pilihan === "gabungkan" ? gabungan : {}),
    id: k.lokal.id,
    idKader: k.lokal.idKader,
    catatanAdmin: k.server.catatanAdmin,
    revisiServer: k.revisiServer,
    statusSinkron: "lokal" as const,
    konflikSinkron: undefined,
    updatedAt: new Date().toISOString()
  };
  if (!hitungSkorKualitasData(d).geometriValid) throw new Error("Geometri hasil resolusi tidak valid.");
  return d;
}

/** Konfirmasi upload lama tidak boleh menghapus edit yang dibuat saat koneksi sedang berjalan. */
export function terapkanHasilSinkron(data: DataSpasialItem[], hasil: HasilSinkron): DataSpasialItem[] {
  return data.map((d) => {
    const konflik = hasil.konflik?.find((k) => k.idData === d.id);
    if (konflik) return { ...d, konflikSinkron: { ...konflik, lokal: { ...d, konflikSinkron: undefined } } };
    const ack = hasil.konfirmasi?.find((a) => a.id === d.id);
    if (!ack) return d;
    return {
      ...d,
      revisiServer: ack.revisiServer,
      statusSinkron: d.statusSinkron === "lokal" && fingerprintData(d) === ack.fingerprint ? "tersinkron" : d.statusSinkron
    };
  });
}
