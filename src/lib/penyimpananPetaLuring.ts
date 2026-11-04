import { daftarkanSumberPmtiles } from "./pmtilesProtocol";
import { daftarkanSumberMbtiles } from "./mbtilesProtocol";

const NAMA_DB = "geokader_arsip_peta_v1";
const VERSI_DB = 1;
const STORE_ARSIP = "arsip";

export interface RekamanArsipPeta {
  id: string;
  namaArea: string;
  tipe: "pmtiles" | "mbtiles" | "geopdf" | "geotiff";
  berkas: Blob;
  ukuranMb: number;
  metadata?: Record<string, unknown>;
  diunduhPada: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function bukaDbArsip(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB tidak didukung di lingkungan ini."));
  }

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAMA_DB, VERSI_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ARSIP)) {
        db.createObjectStore(STORE_ARSIP, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error("Gagal membuka IndexedDB arsip peta."));
  });

  return dbPromise;
}

/**
 * Menutup koneksi database arsip peta dan mereset cache koneksi
 */
export async function tutupDbArsip(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // Abaikan jika sudah tertutup
    } finally {
      dbPromise = null;
    }
  }
}

/**
 * Menyimpan berkas peta biner (PMTiles atau MBTiles) secara persisten di IndexedDB
 */
export async function simpanArsipPeta(
  id: string,
  berkas: Blob | File,
  meta: {
    namaArea: string;
    tipe: "pmtiles" | "mbtiles" | "geopdf" | "geotiff";
    ukuranMb?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const db = await bukaDbArsip();
  const ukuranMb = meta.ukuranMb || Number((berkas.size / (1024 * 1024)).toFixed(1));

  const entri: RekamanArsipPeta = {
    id,
    namaArea: meta.namaArea,
    tipe: meta.tipe,
    berkas,
    ukuranMb,
    metadata: meta.metadata,
    diunduhPada: new Date().toISOString()
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ARSIP, "readwrite");
    const store = tx.objectStore(STORE_ARSIP);
    const req = store.put(entri);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Minta persistensi penyimpanan browser untuk mencegah penggusuran cache
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    void navigator.storage.persist().catch(() => undefined);
  }
}

/**
 * Mengambil berkas peta biner dan metadatanya dari IndexedDB
 */
export async function ambilArsipPeta(id: string): Promise<RekamanArsipPeta | null> {
  try {
    const db = await bukaDbArsip();
    return await new Promise<RekamanArsipPeta | null>((resolve, reject) => {
      const tx = db.transaction(STORE_ARSIP, "readonly");
      const store = tx.objectStore(STORE_ARSIP);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as RekamanArsipPeta) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Menghapus arsip peta biner dari IndexedDB
 */
export async function hapusArsipPeta(id: string): Promise<boolean> {
  try {
    const db = await bukaDbArsip();
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_ARSIP, "readwrite");
      const store = tx.objectStore(STORE_ARSIP);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

/**
 * Mendaftarkan seluruh arsip PMTiles dan MBTiles yang tersimpan di IndexedDB
 * ke MapLibre Custom Protocols agar langsung siap digunakan saat aplikasi dibuka.
 */
export async function muatSemuaArsipPetaKeProtokol(): Promise<number> {
  try {
    const db = await bukaDbArsip();
    const daftar = await new Promise<RekamanArsipPeta[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ARSIP, "readonly");
      const store = tx.objectStore(STORE_ARSIP);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as RekamanArsipPeta[]) || []);
      req.onerror = () => reject(req.error);
    });

    let jumlah = 0;
    for (const arsip of daftar) {
      if (arsip.tipe === "pmtiles") {
        daftarkanSumberPmtiles(arsip.id, arsip.berkas);
        jumlah++;
      } else if (arsip.tipe === "mbtiles") {
        await daftarkanSumberMbtiles(arsip.id, arsip.berkas);
        jumlah++;
      }
    }
    return jumlah;
  } catch {
    return 0;
  }
}

/**
 * Memulihkan URL gambar GeoPDF dari arsip biner IndexedDB apabila Blob URL sebelumnya
 * sudah kadaluarsa setelah halaman dimuat ulang (F5).
 */
export async function rehidrasiArsipGeoPdf(): Promise<
  Record<string, { dataUrl: string; thumbnailDataUrl?: string }>
> {
  const hasil: Record<string, { dataUrl: string; thumbnailDataUrl?: string }> = {};
  try {
    const db = await bukaDbArsip();
    const daftar = await new Promise<RekamanArsipPeta[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ARSIP, "readonly");
      const store = tx.objectStore(STORE_ARSIP);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as RekamanArsipPeta[]) || []);
      req.onerror = () => reject(req.error);
    });

    for (const arsip of daftar) {
      if (arsip.tipe === "geopdf" && arsip.berkas) {
        try {
          const { imporGeoPdf, renderHalamanPdfBiasa } = await import("./geoPdf");
          try {
            const r = await imporGeoPdf(arsip.berkas);
            hasil[arsip.id] = { dataUrl: r.dataUrl, thumbnailDataUrl: r.thumbnailDataUrl };
          } catch {
            const r = await renderHalamanPdfBiasa(arsip.berkas);
            hasil[arsip.id] = { dataUrl: r.dataUrl, thumbnailDataUrl: r.thumbnailDataUrl };
          }
        } catch {
          // Abaikan jika gagal merender ulang di lingkungan non-browser
        }
      }
    }
  } catch {
    // Abaikan jika IndexedDB tidak tersedia
  }
  return hasil;
}
