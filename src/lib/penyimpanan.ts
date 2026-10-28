import { useSyncExternalStore } from "react";

/**
 * Penyimpanan data aplikasi.
 *
 * localStorage hanya ±5 MB dan menjatuhkan penulisan secara senyap saat penuh. Data spasial
 * (apalagi dengan foto) cepat melewati batas itu, sehingga data terbaru bisa hilang tanpa
 * peringatan. Modul ini memakai IndexedDB (kuota jauh lebih besar), tetap menyediakan
 * pembacaan/penulisan sinkron lewat cache memori, dan MELAPORKAN setiap kegagalan menulis.
 *
 * Mode:
 * - "indexeddb"   : data ada di IndexedDB; penulisan ke disk dikumpulkan lalu dikirim sekaligus
 * - "localstorage": IndexedDB tidak tersedia (mis. mode privat tertentu); kembali ke localStorage
 * - "memori"      : keduanya gagal; data hanya hidup selama tab terbuka
 */

export type ModePenyimpanan = "indexeddb" | "localstorage" | "memori";

export interface StatusPenyimpanan {
  mode: ModePenyimpanan;
  /** true bila browser berjanji tidak menghapus data otomatis; null bila tidak diketahui */
  persisten: boolean | null;
  /** Pesan galat penulisan terakhir yang belum pulih; null bila semua tersimpan */
  galat: string | null;
  kuotaPenuh: boolean;
  /** true selama masih ada perubahan di memori yang belum sampai ke penyimpanan */
  menunggu: boolean;
}

export interface PerkiraanPenyimpanan {
  pakaiByte: number;
  kuotaByte: number;
  persen: number;
}

const NAMA_DB = "geokader-db";
const NAMA_STORE = "kv";
/** Kunci cadangan: salinan localStorage yang berbeda dari IndexedDB saat migrasi */
export const SUFIKS_CADANGAN = "::cadangan-localstorage";
const JEDA_TULIS_MS = 200;
const BATAS_BUKA_DB_MS = 4000;

const cache = new Map<string, string>();
const antrean = new Map<string, string | null>();
let dbRef: IDBDatabase | null = null;
let jadwal: ReturnType<typeof setTimeout> | null = null;
let sedangMenulis: Promise<void> | null = null;
const pendengar = new Set<() => void>();
let status: StatusPenyimpanan = { mode: "localstorage", persisten: null, galat: null, kuotaPenuh: false, menunggu: false };

function ubahStatus(sebagian: Partial<StatusPenyimpanan>): void {
  const baru = { ...status, ...sebagian };
  if (
    baru.mode === status.mode &&
    baru.persisten === status.persisten &&
    baru.galat === status.galat &&
    baru.kuotaPenuh === status.kuotaPenuh &&
    baru.menunggu === status.menunggu
  )
    return;
  status = baru;
  pendengar.forEach((p) => p());
}

export function ambilStatusPenyimpanan(): StatusPenyimpanan {
  return status;
}

export function langgananStatusPenyimpanan(fn: () => void): () => void {
  pendengar.add(fn);
  return () => {
    pendengar.delete(fn);
  };
}

export function useStatusPenyimpanan(): StatusPenyimpanan {
  return useSyncExternalStore(langgananStatusPenyimpanan, ambilStatusPenyimpanan, ambilStatusPenyimpanan);
}

const adalahKuota = (e: unknown) =>
  e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);

function laporkanGalat(e: unknown): void {
  const kuota = adalahKuota(e);
  ubahStatus({
    kuotaPenuh: kuota,
    galat: kuota
      ? "Penyimpanan perangkat penuh. Perubahan terbaru belum tersimpan permanen."
      : "Perubahan terbaru gagal disimpan ke perangkat."
  });
}

// ---------- IndexedDB ----------

function bukaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak tersedia"));
      return;
    }
    const batas = setTimeout(() => reject(new Error("IndexedDB tidak merespons")), BATAS_BUKA_DB_MS);
    const req = indexedDB.open(NAMA_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(NAMA_STORE)) req.result.createObjectStore(NAMA_STORE);
    };
    req.onsuccess = () => {
      clearTimeout(batas);
      resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(batas);
      reject(req.error ?? new Error("Gagal membuka IndexedDB"));
    };
    req.onblocked = () => {
      clearTimeout(batas);
      reject(new Error("IndexedDB terblokir"));
    };
  });
}

function bacaSemua(db: IDBDatabase): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    const hasil = new Map<string, string>();
    const tx = db.transaction(NAMA_STORE, "readonly");
    const req = tx.objectStore(NAMA_STORE).openCursor();
    req.onsuccess = () => {
      const kursor = req.result;
      if (!kursor) return;
      if (typeof kursor.value === "string") hasil.set(String(kursor.key), kursor.value);
      kursor.continue();
    };
    tx.oncomplete = () => resolve(hasil);
    tx.onerror = () => reject(tx.error ?? new Error("Gagal membaca IndexedDB"));
    tx.onabort = () => reject(tx.error ?? new Error("Pembacaan IndexedDB dibatalkan"));
  });
}

function tulisBatch(db: IDBDatabase, isi: Map<string, string | null>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NAMA_STORE, "readwrite");
    const store = tx.objectStore(NAMA_STORE);
    isi.forEach((nilai, kunci) => {
      if (nilai === null) store.delete(kunci);
      else store.put(nilai, kunci);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Gagal menulis IndexedDB"));
    tx.onabort = () => reject(tx.error ?? new Error("Penulisan IndexedDB dibatalkan"));
  });
}

async function mintaPersisten(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/**
 * Menyiapkan penyimpanan sebelum aplikasi membaca data. `kunciData` adalah kunci yang dipindahkan
 * dari localStorage ke IndexedDB (kunci sesi/autentikasi sengaja tetap di localStorage).
 * Kunci di localStorage baru dihapus setelah penulisan ke IndexedDB terkonfirmasi. Bila kedua tempat
 * berisi nilai berbeda, IndexedDB dipakai dan nilai localStorage disimpan sebagai `<kunci>::cadangan-localstorage`.
 */
export async function siapkanPenyimpanan(kunciData: string[]): Promise<void> {
  try {
    const db = await bukaDb();
    const tersimpan = await bacaSemua(db);
    const migrasi = new Map<string, string | null>();
    const hapusDariLocal: string[] = [];
    for (const kunci of kunciData) {
      let lama: string | null = null;
      try {
        lama = localStorage.getItem(kunci);
      } catch {
        lama = null;
      }
      if (lama === null) continue;
      const diIdb = tersimpan.get(kunci);
      if (diIdb === undefined) {
        migrasi.set(kunci, lama);
        tersimpan.set(kunci, lama);
      } else if (diIdb !== lama) {
        // IndexedDB menang, tetapi salinan localStorage yang berbeda (mis. ditulis halaman versi lama
        // yang masih terbuka/ter-cache) tidak dibuang: disimpan sebagai cadangan agar tidak hilang senyap.
        migrasi.set(kunci + SUFIKS_CADANGAN, lama);
        tersimpan.set(kunci + SUFIKS_CADANGAN, lama);
      }
      hapusDariLocal.push(kunci);
    }
    if (migrasi.size > 0) await tulisBatch(db, migrasi);
    hapusDariLocal.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // abaikan
      }
    });
    cache.clear();
    tersimpan.forEach((v, k) => cache.set(k, v));
    dbRef = db;
    db.onversionchange = () => {
      db.close();
      dbRef = null;
      ubahStatus({ mode: "memori", galat: "Penyimpanan ditutup oleh tab lain. Muat ulang halaman." });
    };
    ubahStatus({ mode: "indexeddb", galat: null, kuotaPenuh: false });
    void mintaPersisten().then((p) => ubahStatus({ persisten: p }));
  } catch (e) {
    dbRef = null;
    try {
      localStorage.setItem("geokader_uji_tulis", "1");
      localStorage.removeItem("geokader_uji_tulis");
      ubahStatus({ mode: "localstorage" });
    } catch {
      ubahStatus({ mode: "memori", galat: "Penyimpanan perangkat tidak tersedia. Data hilang saat tab ditutup." });
    }
    if (adalahKuota(e)) laporkanGalat(e);
  }
}

// ---------- Baca / tulis ----------

export function bacaTeks(kunci: string): string | null {
  if (cache.has(kunci)) return cache.get(kunci) ?? null;
  if (status.mode === "indexeddb") return null;
  try {
    const v = localStorage.getItem(kunci);
    if (v !== null) cache.set(kunci, v);
    return v;
  } catch {
    return null;
  }
}

async function kirimAntrean(): Promise<void> {
  while (sedangMenulis) await sedangMenulis;
  if (antrean.size === 0) {
    ubahStatus({ menunggu: false });
    return;
  }
  if (!dbRef) return;
  const paket = new Map(antrean);
  antrean.clear();
  sedangMenulis = (async () => {
    try {
      await tulisBatch(dbRef!, paket);
      ubahStatus({ galat: null, kuotaPenuh: false });
    } catch (e) {
      // kembalikan ke antrean (kecuali kunci yang sudah ditimpa oleh penulisan yang lebih baru)
      paket.forEach((v, k) => {
        if (!antrean.has(k)) antrean.set(k, v);
      });
      laporkanGalat(e);
    } finally {
      sedangMenulis = null;
      ubahStatus({ menunggu: antrean.size > 0 });
    }
  })();
  await sedangMenulis;
}

function jadwalkan(): void {
  ubahStatus({ menunggu: true });
  if (jadwal !== null) return;
  jadwal = setTimeout(() => {
    jadwal = null;
    void kirimAntrean();
  }, JEDA_TULIS_MS);
}

export function tulisTeks(kunci: string, nilai: string | null): void {
  if (nilai === null) cache.delete(kunci);
  else cache.set(kunci, nilai);

  if (status.mode === "indexeddb") {
    antrean.set(kunci, nilai);
    jadwalkan();
    return;
  }
  if (status.mode === "localstorage") {
    try {
      if (nilai === null) localStorage.removeItem(kunci);
      else localStorage.setItem(kunci, nilai);
      if (status.galat || status.kuotaPenuh) ubahStatus({ galat: null, kuotaPenuh: false });
    } catch (e) {
      laporkanGalat(e);
    }
  }
}

/** Menunggu semua perubahan yang tertunda sampai benar-benar tertulis (atau gagal). */
export async function simpanSekarang(): Promise<void> {
  if (jadwal !== null) {
    clearTimeout(jadwal);
    jadwal = null;
  }
  await kirimAntrean();
}

/** Perkiraan pemakaian ruang penyimpanan situs ini (tidak tersedia di semua browser). */
export async function perkiraanPenyimpanan(): Promise<PerkiraanPenyimpanan | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (!usage && !quota) return null;
    const pakaiByte = usage ?? 0;
    const kuotaByte = quota ?? 0;
    return { pakaiByte, kuotaByte, persen: kuotaByte > 0 ? Math.min(100, (pakaiByte / kuotaByte) * 100) : 0 };
  } catch {
    return null;
  }
}

export function formatUkuranByte(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Hanya untuk pengujian: mengembalikan modul ke keadaan awal. */
export function setelUlangPenyimpananUntukUji(): void {
  if (jadwal !== null) clearTimeout(jadwal);
  jadwal = null;
  dbRef?.close();
  dbRef = null;
  cache.clear();
  antrean.clear();
  sedangMenulis = null;
  status = { mode: "localstorage", persisten: null, galat: null, kuotaPenuh: false, menunggu: false };
  pendengar.forEach((p) => p());
}

if (typeof window !== "undefined") {
  // Pastikan perubahan yang masih tertunda tidak hilang saat tab disembunyikan / ditutup
  const buang = () => {
    if (antrean.size > 0) void simpanSekarang();
  };
  window.addEventListener("pagehide", buang);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") buang();
  });
}
