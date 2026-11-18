import { WilayahAdministrasi } from "../types";
import { KONEKSI_GDRIVE, KoneksiGDrive, gdriveTerpasang } from "./koneksiDrive";

export interface AkunCloudRecord {
  idKader: string;
  nama: string;
  email: string;
  peran: "admin" | "kader";
  desaWilayah: string;
  wilayah?: WilayahAdministrasi;
  noHp: string;
  kelompokMasyarakat: string;
  namaOrganisasi: string;
  kataSandiHash: string;
  garam: string;
  iterasi: number;
  sigPeran?: string;
  emailTerverifikasi?: boolean;
  statusPersetujuan?: "menunggu" | "disetujui" | "ditolak";
  emailDiverifikasiPada?: string;
  disetujuiPada?: string;
  totpRahasia?: string;
  totpLangkahTerakhir?: number;
  kodePemulihanHash?: string[];
  wajibGantiSandi?: boolean;
  idSesiAktif?: string;
  infoPerangkatAktif?: string;
  sesiAktifSejak?: string;
  createdAt: string;
  versiAkun?: number;
}

const TIMEOUT_AKUN_MS = 12_000;

async function kirimAksiAkun(
  payload: Record<string, unknown>,
  opsi: { koneksi?: KoneksiGDrive; keepalive?: boolean; timeoutMs?: number } = {}
): Promise<Record<string, unknown>> {
  const koneksi = opsi.koneksi ?? KONEKSI_GDRIVE;
  if (!gdriveTerpasang(koneksi) || typeof globalThis.fetch !== "function") {
    return { sukses: false, offline: true, pesan: "Koneksi server Google Apps Script tidak tersedia." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sukses: false, offline: true, pesan: "Perangkat sedang offline." };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opsi.timeoutMs ?? TIMEOUT_AKUN_MS);
  try {
    const resp = await fetch(koneksi.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, token: koneksi.token }),
      signal: ctrl.signal,
      ...(opsi.keepalive ? { keepalive: true } : {})
    });
    if (!resp.ok) return { sukses: false, pesan: `HTTP ${resp.status}` };
    const teks = await resp.text();
    return JSON.parse(teks) as Record<string, unknown>;
  } catch (err) {
    return {
      sukses: false,
      offline: true,
      pesan: err instanceof Error ? err.message : "Gagal menghubungi server."
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function kirimOtpEmailGDrive(
  email: string,
  nama: string,
  kodeOtp: string,
  koneksi?: KoneksiGDrive
): Promise<{
  sukses: boolean;
  protokolAkun?: number;
  terkirimEmail?: boolean;
  duplikat?: boolean;
  offline?: boolean;
  pesan?: string;
}> {
  const res = await kirimAksiAkun(
    { action: "kirim_otp_email", email, nama, kodeOtp },
    { koneksi }
  );
  return {
    sukses: Boolean(res.sukses),
    protokolAkun: typeof res.protokolAkun === "number" ? res.protokolAkun : undefined,
    terkirimEmail: Boolean(res.terkirimEmail),
    duplikat: Boolean(res.duplikat),
    offline: Boolean(res.offline),
    pesan: res.pesan ? String(res.pesan) : undefined
  };
}

export async function daftarAkunBaruGDrive(
  akun: AkunCloudRecord,
  kodeOtp: string,
  wajibOtpServer = false,
  koneksi?: KoneksiGDrive
): Promise<{
  sukses: boolean;
  protokolAkun?: number;
  duplikat?: boolean;
  offline?: boolean;
  akun?: AkunCloudRecord;
  pesan?: string;
}> {
  const res = await kirimAksiAkun(
    {
      action: "verifikasi_otp_dan_daftar_akun",
      email: akun.email,
      kodeOtp,
      wajibOtpServer,
      akun
    },
    { koneksi }
  );
  return {
    sukses: Boolean(res.sukses),
    protokolAkun: typeof res.protokolAkun === "number" ? res.protokolAkun : undefined,
    duplikat: Boolean(res.duplikat),
    offline: Boolean(res.offline),
    akun: res.akun as AkunCloudRecord | undefined,
    pesan: res.pesan ? String(res.pesan) : undefined
  };
}

export async function ambilDaftarAkunGDrive(
  email?: string,
  koneksi?: KoneksiGDrive
): Promise<{
  sukses: boolean;
  protokolAkun?: number;
  akunList?: AkunCloudRecord[];
  akun?: AkunCloudRecord | null;
  pesan?: string;
}> {
  const res = await kirimAksiAkun({ action: "ambil_daftar_akun", ...(email ? { email } : {}) }, { koneksi });
  return {
    sukses: Boolean(res.sukses),
    protokolAkun: typeof res.protokolAkun === "number" ? res.protokolAkun : undefined,
    akunList: Array.isArray(res.akunList) ? (res.akunList as AkunCloudRecord[]) : undefined,
    akun: (res.akun as AkunCloudRecord | null | undefined) ?? undefined,
    pesan: res.pesan ? String(res.pesan) : undefined
  };
}

export async function setujuiAkunGDrive(email: string, disetujuiPada: string, koneksi?: KoneksiGDrive) {
  return kirimAksiAkun({ action: "setujui_akun", email, disetujuiPada }, { koneksi });
}

export async function tolakAkunGDrive(email: string, koneksi?: KoneksiGDrive) {
  return kirimAksiAkun({ action: "tolak_akun", email }, { koneksi });
}

export async function hapusAkunGDrive(email: string, koneksi?: KoneksiGDrive) {
  return kirimAksiAkun({ action: "hapus_akun", email }, { koneksi });
}

export async function ubahWilayahAkunGDrive(email: string, wilayah: WilayahAdministrasi, koneksi?: KoneksiGDrive) {
  return kirimAksiAkun({ action: "ubah_wilayah_akun", email, wilayah }, { koneksi });
}

export async function simpanKredensialAkunGDrive(
  email: string,
  perubahan: Partial<AkunCloudRecord>,
  akunLengkap?: AkunCloudRecord,
  koneksi?: KoneksiGDrive
) {
  return kirimAksiAkun(
    {
      action: "simpan_kredensial_akun",
      email,
      perubahan,
      ...(akunLengkap ? { akun: akunLengkap } : {})
    },
    { koneksi }
  );
}

export async function resetSemuaAkunGDrive(emailAdmin: string, koneksi?: KoneksiGDrive) {
  return kirimAksiAkun({ action: "reset_semua_akun", emailAdmin }, { koneksi });
}

export async function klaimSesiAkunGDrive(
  email: string,
  idPerangkat: string,
  infoPerangkat: string,
  akunFallback?: AkunCloudRecord,
  koneksi?: KoneksiGDrive
): Promise<{
  sukses: boolean;
  protokolAkun?: number;
  ditolakSesiGanda?: boolean;
  offline?: boolean;
  pesan?: string;
}> {
  const res = await kirimAksiAkun(
    {
      action: "klaim_sesi_akun",
      email,
      idPerangkat,
      infoPerangkat,
      ...(akunFallback ? { akunFallback } : {})
    },
    { koneksi, timeoutMs: 2500 }
  );
  return {
    sukses: Boolean(res.sukses),
    protokolAkun: typeof res.protokolAkun === "number" ? res.protokolAkun : undefined,
    ditolakSesiGanda: Boolean(res.ditolakSesiGanda),
    offline: Boolean(res.offline),
    pesan: res.pesan ? String(res.pesan) : undefined
  };
}

export async function lepasSesiAkunGDrive(
  email: string,
  idPerangkat: string,
  opsi: { paksaAdmin?: boolean; keepalive?: boolean; koneksi?: KoneksiGDrive } = {}
) {
  return kirimAksiAkun(
    {
      action: "lepas_sesi_akun",
      email,
      idPerangkat,
      ...(opsi.paksaAdmin ? { paksaAdmin: true } : {})
    },
    { keepalive: opsi.keepalive, koneksi: opsi.koneksi }
  );
}

export async function cekSesiAkunGDrive(
  email: string,
  idPerangkat: string,
  koneksi?: KoneksiGDrive
): Promise<{
  sukses: boolean;
  protokolAkun?: number;
  sah?: boolean;
  alasan?: string;
  statusPersetujuan?: "menunggu" | "disetujui" | "ditolak";
}> {
  const res = await kirimAksiAkun({ action: "cek_sesi_akun", email, idPerangkat }, { koneksi, timeoutMs: 3000 });
  return {
    sukses: Boolean(res.sukses),
    protokolAkun: typeof res.protokolAkun === "number" ? res.protokolAkun : undefined,
    sah: typeof res.sah === "boolean" ? res.sah : undefined,
    alasan: res.alasan ? String(res.alasan) : undefined,
    statusPersetujuan: res.statusPersetujuan as "menunggu" | "disetujui" | "ditolak" | undefined
  };
}
