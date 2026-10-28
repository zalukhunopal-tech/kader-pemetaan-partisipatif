/**
 * CITRA SATELIT GOOGLE lewat Map Tiles API resmi (bukan alamat tile tak resmi mt*.google.com yang
 * melanggar ketentuan Google). Perlu kunci API Google Maps Platform dengan Map Tiles API aktif dan
 * akun penagihan; kuota gratis 2D Map Tiles 100.000 permintaan per bulan.
 *
 * Alur: satu token sesi dibuat (POST createSession) lalu dipakai ulang untuk semua tile sampai
 * kedaluwarsa; teks hak cipta diambil dari endpoint viewport sesuai area yang sedang tampil dan
 * wajib ditampilkan bersama logo Google. Tile Google tidak boleh disimpan untuk offline.
 */

const ALAMAT_API = "https://tile.googleapis.com";
const KUNCI_SIMPAN = "geokader_sesi_google_v1";
/** Token dianggap habis sedikit lebih awal supaya tidak kedaluwarsa di tengah menggambar */
const CADANGAN_MS = 5 * 60 * 1000;
/** Setelah gagal membuat sesi, tunggu sebelum mencoba lagi agar tidak membanjiri API */
const JEDA_ULANG_MS = 60 * 1000;

export const LOGO_GOOGLE = "https://maps.gstatic.com/mapfiles/api-3/images/google_white5_hdpi.png";

export const kunciGoogle = (): string => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();

interface SesiGoogle {
  token: string;
  kedaluwarsaMs: number;
  /** Akhir kunci API, supaya token dari kunci lain tidak terpakai */
  ujungKunci: string;
}

export interface StatusGoogle {
  siap: boolean;
  galat: string | null;
}

let sesi: SesiGoogle | null = null;
let janji: Promise<void> | null = null;
let galat: string | null = null;
let gagalPada = 0;
const pendengar = new Set<() => void>();

const beritahu = () => pendengar.forEach((p) => p());

/** Dipanggil saat sesi siap atau gagal dibuat, supaya peta digambar ulang */
export function pantauSesiGoogle(fn: () => void): () => void {
  pendengar.add(fn);
  return () => {
    pendengar.delete(fn);
  };
}

export const statusGoogle = (): StatusGoogle => ({ siap: sesi !== null, galat });

function sesiSah(s: SesiGoogle | null, sekarang: number): s is SesiGoogle {
  return !!s && s.ujungKunci === kunciGoogle().slice(-6) && s.kedaluwarsaMs - CADANGAN_MS > sekarang;
}

function bacaSesiTersimpan(sekarang: number): SesiGoogle | null {
  try {
    const s = JSON.parse(localStorage.getItem(KUNCI_SIMPAN) || "null") as SesiGoogle | null;
    return s && typeof s.token === "string" && typeof s.kedaluwarsaMs === "number" && sesiSah(s, sekarang) ? s : null;
  } catch {
    return null;
  }
}

/** Mengubah balasan galat API menjadi pesan yang bisa ditindaklanjuti admin */
export function pesanGalatGoogle(status: number, isi: unknown): string {
  const pesan = (isi as { error?: { message?: string } } | null)?.error?.message ?? "";
  if (/API key not valid/i.test(pesan)) return "Kunci API Google tidak valid.";
  if (/billing/i.test(pesan)) return "Akun penagihan Google Cloud belum aktif untuk kunci ini.";
  if (status === 403) return "Map Tiles API belum diaktifkan atau kunci dibatasi untuk alamat lain.";
  if (status === 429) return "Kuota Google Map Tiles habis untuk saat ini.";
  return pesan ? `Google: ${pesan}` : `Google menolak permintaan (HTTP ${status}).`;
}

/** Membuat token sesi citra satelit (bahasa Indonesia, wilayah Indonesia) */
export async function buatSesiGoogle(ambil: typeof fetch = fetch, sekarang = Date.now()): Promise<void> {
  const kunci = kunciGoogle();
  if (!kunci) return;
  try {
    const resp = await ambil(`${ALAMAT_API}/v1/createSession?key=${encodeURIComponent(kunci)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapType: "satellite", language: "id-ID", region: "ID" })
    });
    const isi = (await resp.json().catch(() => null)) as { session?: string; expiry?: string } | null;
    if (!resp.ok || !isi?.session) {
      galat = pesanGalatGoogle(resp.status, isi);
      gagalPada = sekarang;
      return;
    }
    // expiry dalam detik sejak epoch; bila tidak ada, anggap berlaku sehari
    const detik = Number(isi.expiry);
    sesi = {
      token: isi.session,
      kedaluwarsaMs: Number.isFinite(detik) && detik > 0 ? detik * 1000 : sekarang + 24 * 3600 * 1000,
      ujungKunci: kunci.slice(-6)
    };
    galat = null;
    try {
      localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(sesi));
    } catch {
      // tidak tersimpan: sesi dibuat ulang saat aplikasi dibuka lagi
    }
  } catch {
    galat = "Tidak dapat menghubungi Google (periksa internet).";
    gagalPada = sekarang;
  }
}

/**
 * Token sesi yang masih berlaku, atau null (sambil memulai pembuatan sesi di latar).
 * Pendengar diberi tahu ketika sesi siap sehingga tile bisa dimuat.
 */
export function tokenSesiGoogle(sekarang = Date.now()): string | null {
  if (!kunciGoogle()) return null;
  if (sesiSah(sesi, sekarang)) return sesi.token;
  const tersimpan = bacaSesiTersimpan(sekarang);
  if (tersimpan) {
    sesi = tersimpan;
    return sesi.token;
  }
  sesi = null;
  if (!janji && sekarang - gagalPada >= JEDA_ULANG_MS) {
    janji = buatSesiGoogle().finally(() => {
      janji = null;
      beritahu();
    });
  }
  return null;
}

export interface BatasTampilan {
  utara: number;
  selatan: number;
  timur: number;
  barat: number;
}

/** Teks hak cipta citra untuk area yang sedang tampil (wajib ditampilkan menurut ketentuan Google) */
export async function ambilAtribusiGoogle(
  batas: BatasTampilan,
  zoom: number,
  ambil: typeof fetch = fetch
): Promise<string | null> {
  const token = tokenSesiGoogle();
  if (!token) return null;
  const q = new URLSearchParams({
    session: token,
    key: kunciGoogle(),
    zoom: String(Math.round(zoom)),
    north: batas.utara.toFixed(6),
    south: batas.selatan.toFixed(6),
    east: batas.timur.toFixed(6),
    west: batas.barat.toFixed(6)
  });
  try {
    const resp = await ambil(`${ALAMAT_API}/tile/v1/viewport?${q.toString()}`);
    if (!resp.ok) return null;
    const isi = (await resp.json()) as { copyright?: string };
    return typeof isi.copyright === "string" && isi.copyright.trim() ? isi.copyright.trim() : null;
  } catch {
    return null;
  }
}

/** Hanya untuk pengujian */
export function setelUlangGoogleUntukUji(): void {
  sesi = null;
  janji = null;
  galat = null;
  gagalPada = 0;
  pendengar.clear();
  try {
    localStorage.removeItem(KUNCI_SIMPAN);
  } catch {
    // abaikan
  }
}
