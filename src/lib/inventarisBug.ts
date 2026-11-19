import { useSyncExternalStore } from "react";
import { buatId } from "./id";
import { sanitasiTeksInput } from "./geoUtils";

export type SumberBug = "otomatis" | "manual";
export type StatusBug = "tercatat" | "siap_diperbaiki" | "diperbaiki";

export interface CatatanBug {
  id: string;
  sumber: SumberBug;
  judul: string;
  deskripsi: string;
  lokasi?: string;
  tumpukan?: string;
  pengguna?: string;
  perangkat?: string;
  waktuPertama: string;
  waktuTerakhir: string;
  jumlahKejadian: number;
  status: StatusBug;
}

export const KUNCI_INVENTARIS_BUG = "geokader_inventaris_bug_v1";
export const KUNCI_BUG_DIPERBAIKI = "geokader_bug_sudah_diperbaiki_v1";
/** Batas waktu rilis perbaikan bug terbaru: catatan bug sebelum/pada waktu ini otomatis dibersihkan karena sudah diperbaiki */
export const WAKTU_PERBAIKAN_BUG_TERAKHIR = "2026-11-19T02:30:00.000Z";
const MAKS_CATATAN_BUG = 60;

/** Daftar tanda tangan bug yang sudah diperbaiki secara permanen di kode */
export const POLA_BUG_SUDAH_DIPERBAIKI: RegExp[] = [
  /Cannot update a component\s*\(.*\)\s*while rendering a different component/i,
  /reactjs\.org\/link\/setstate-in-render/i,
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i
];

const pendengar = new Set<() => void>();
let sedangMenangkap = false;
let cacheDaftar: CatatanBug[] | null = null;
let notifikasiBugTertunda = false;

function beritahuPendengarBugNanti(): void {
  if (notifikasiBugTertunda) return;
  notifikasiBugTertunda = true;
  const tunda =
    typeof queueMicrotask === "function"
      ? queueMicrotask
      : (fn: () => void) => {
          void Promise.resolve().then(fn);
        };
  tunda(() => {
    notifikasiBugTertunda = false;
    pendengar.forEach((fn) => fn());
  });
}

function bacaPenandaBugDiperbaiki(): string[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(KUNCI_BUG_DIPERBAIKI);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export function adalahBugSudahDiperbaiki(
  bug: Pick<CatatanBug, "id" | "judul" | "deskripsi" | "tumpukan" | "waktuTerakhir"> & { status?: StatusBug }
): boolean {
  if (bug.status === "diperbaiki") return true;
  const gabungan = `${bug.judul || ""} ${bug.deskripsi || ""} ${bug.tumpukan || ""}`;
  if (POLA_BUG_SUDAH_DIPERBAIKI.some((re) => re.test(gabungan))) return true;

  const penanda = bacaPenandaBugDiperbaiki();
  if (
    penanda.some(
      (p) =>
        bug.id === p ||
        bug.judul.toLowerCase() === p.toLowerCase() ||
        gabungan.toLowerCase().includes(p.toLowerCase())
    )
  ) {
    return true;
  }

  if (bug.waktuTerakhir) {
    const tBug = Date.parse(bug.waktuTerakhir);
    const tRilis = Date.parse(WAKTU_PERBAIKAN_BUG_TERAKHIR);
    if (Number.isFinite(tBug) && Number.isFinite(tRilis) && tBug <= tRilis) {
      return true;
    }
  }
  return false;
}

function bersihkanSensitif(teks: string, maksPanjang: number): string {
  const bersih = sanitasiTeksInput(teks)
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, "Bearer [DISENSOR]")
    .replace(/\bgh[opsu]_[A-Za-z0-9]+\b/g, "[TOKEN_GH]")
    .replace(/\bAIza[0-9A-Za-z\-_]{10,}\b/g, "[KUNCI_API]");
  return bersih.slice(0, maksPanjang);
}

function infoPerangkatRingkas(): string {
  if (typeof window === "undefined") return "lingkungan non-browser";
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  const status = typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online";
  return `${w}x${h} (${status})`;
}

export function bacaInventarisBug(): CatatanBug[] {
  if (cacheDaftar) {
    const tersaringCache = cacheDaftar.filter((b) => !adalahBugSudahDiperbaiki(b));
    if (tersaringCache.length !== cacheDaftar.length) {
      cacheDaftar = tersaringCache;
      try {
        if (typeof localStorage !== "undefined") {
          if (tersaringCache.length === 0) localStorage.removeItem(KUNCI_INVENTARIS_BUG);
          else localStorage.setItem(KUNCI_INVENTARIS_BUG, JSON.stringify(tersaringCache));
        }
      } catch {
        // abaikan
      }
    }
    return cacheDaftar;
  }
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(KUNCI_INVENTARIS_BUG);
    if (!raw) {
      cacheDaftar = [];
      return cacheDaftar;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cacheDaftar = [];
      return cacheDaftar;
    }
    const sah = parsed.filter(
      (b): b is CatatanBug =>
        Boolean(b && typeof b.id === "string" && typeof b.judul === "string" && typeof b.deskripsi === "string")
    );
    const belumDiperbaiki = sah.filter((b) => !adalahBugSudahDiperbaiki(b));
    cacheDaftar = belumDiperbaiki;
    if (belumDiperbaiki.length !== sah.length) {
      if (belumDiperbaiki.length === 0) localStorage.removeItem(KUNCI_INVENTARIS_BUG);
      else localStorage.setItem(KUNCI_INVENTARIS_BUG, JSON.stringify(belumDiperbaiki));
    }
    return cacheDaftar;
  } catch {
    return [];
  }
}

function simpanInventaris(daftar: CatatanBug[], tundaNotifikasi = false): CatatanBug[] {
  const belumDiperbaiki = daftar.filter((b) => !adalahBugSudahDiperbaiki(b));
  const terbatas = belumDiperbaiki.slice(0, MAKS_CATATAN_BUG);
  cacheDaftar = terbatas;
  try {
    if (typeof localStorage !== "undefined") {
      if (terbatas.length === 0) localStorage.removeItem(KUNCI_INVENTARIS_BUG);
      else localStorage.setItem(KUNCI_INVENTARIS_BUG, JSON.stringify(terbatas));
    }
  } catch {
    // Abaikan kuota penyimpanan penuh agar tidak memicu loop error baru
  }
  if (tundaNotifikasi) {
    beritahuPendengarBugNanti();
  } else {
    pendengar.forEach((fn) => fn());
  }
  return terbatas;
}

/**
 * Menghapus secara otomatis seluruh bug yang sudah diperbaiki dari inventaris bug.
 * Mengembalikan jumlah catatan bug yang dihapus.
 */
export function bersihkanBugSudahDiperbaiki(): number {
  cacheDaftar = null;
  try {
    if (typeof localStorage === "undefined") return 0;
    const raw = localStorage.getItem(KUNCI_INVENTARIS_BUG);
    if (!raw) {
      cacheDaftar = [];
      return 0;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(KUNCI_INVENTARIS_BUG);
      cacheDaftar = [];
      return 0;
    }
    const sebelum = parsed.filter(
      (b): b is CatatanBug =>
        Boolean(b && typeof b.id === "string" && typeof b.judul === "string" && typeof b.deskripsi === "string")
    );
    const sisa = sebelum.filter((b) => !adalahBugSudahDiperbaiki(b));
    const dihapus = sebelum.length - sisa.length;
    if (dihapus > 0) {
      simpanInventaris(sisa);
    } else {
      cacheDaftar = sisa;
    }
    return dihapus;
  } catch {
    return 0;
  }
}

/**
 * Menandai sebuah bug (berdasarkan ID atau judul/pola pesan) sebagai sudah diperbaiki,
 * sehingga langsung otomatis terhapus dari daftar bug di menu Bantuan dan tidak muncul kembali.
 */
export function tandaiBugSudahDiperbaiki(idAtauPola: string): void {
  const bersih = idAtauPola.trim();
  if (!bersih) return;
  try {
    if (typeof localStorage !== "undefined") {
      const daftar = bacaPenandaBugDiperbaiki();
      if (!daftar.includes(bersih)) {
        localStorage.setItem(KUNCI_BUG_DIPERBAIKI, JSON.stringify([...daftar, bersih]));
      }
    }
  } catch {
    // abaikan
  }
  bersihkanBugSudahDiperbaiki();
}

export function resetCacheInventarisBugUntukUji(): void {
  cacheDaftar = null;
}

function subscribeInventarisBug(fn: () => void): () => void {
  pendengar.add(fn);
  return () => {
    pendengar.delete(fn);
  };
}

export function useInventarisBug(): CatatanBug[] {
  return useSyncExternalStore(subscribeInventarisBug, bacaInventarisBug, bacaInventarisBug);
}

export function catatBugOtomatis(
  masukan: {
    judul: string;
    deskripsi: string;
    lokasi?: string;
    tumpukan?: string;
    pengguna?: string;
  },
  opsi: { tundaNotifikasi?: boolean } = {}
): CatatanBug[] {
  const judul = bersihkanSensitif(masukan.judul || "Galat aplikasi", 160);
  const deskripsi = bersihkanSensitif(masukan.deskripsi || judul, 1200);
  if (!judul && !deskripsi) return bacaInventarisBug();
  const lokasi = masukan.lokasi ? bersihkanSensitif(masukan.lokasi, 100) : undefined;
  const tumpukan = masukan.tumpukan ? bersihkanSensitif(masukan.tumpukan, 1500) : undefined;
  const pengguna = masukan.pengguna ? bersihkanSensitif(masukan.pengguna, 80) : undefined;
  const sekarang = new Date().toISOString();

  if (
    adalahPesanDiabaikan(`${judul} ${deskripsi} ${tumpukan ?? ""}`) ||
    adalahBugSudahDiperbaiki({ id: "", judul, deskripsi, tumpukan, waktuTerakhir: sekarang })
  ) {
    return bacaInventarisBug();
  }

  const daftar = [...bacaInventarisBug()];
  const idx = daftar.findIndex(
    (b) => b.sumber === "otomatis" && b.judul.toLowerCase() === judul.toLowerCase() && (b.lokasi ?? "") === (lokasi ?? "")
  );

  if (idx >= 0) {
    const lama = daftar[idx];
    const diperbarui: CatatanBug = {
      ...lama,
      deskripsi,
      tumpukan: tumpukan ?? lama.tumpukan,
      perangkat: infoPerangkatRingkas(),
      waktuTerakhir: sekarang,
      jumlahKejadian: (lama.jumlahKejadian || 1) + 1
    };
    daftar.splice(idx, 1);
    return simpanInventaris([diperbarui, ...daftar], Boolean(opsi.tundaNotifikasi));
  }

  const baru: CatatanBug = {
    id: buatId("BUG"),
    sumber: "otomatis",
    judul,
    deskripsi,
    lokasi,
    tumpukan,
    pengguna,
    perangkat: infoPerangkatRingkas(),
    waktuPertama: sekarang,
    waktuTerakhir: sekarang,
    jumlahKejadian: 1,
    status: "tercatat"
  };
  return simpanInventaris([baru, ...daftar], Boolean(opsi.tundaNotifikasi));
}

export function catatBugManual(masukan: {
  judul: string;
  deskripsi: string;
  lokasi?: string;
  pengguna?: string;
}): CatatanBug {
  const deskripsi = bersihkanSensitif(masukan.deskripsi, 2000);
  if (!deskripsi) {
    throw new Error("Tuliskan penjelasan bug terlebih dahulu.");
  }
  const judulMentah = bersihkanSensitif(masukan.judul, 160);
  const judul = judulMentah || deskripsi.slice(0, 72);
  const lokasi = masukan.lokasi ? bersihkanSensitif(masukan.lokasi, 100) : undefined;
  const pengguna = masukan.pengguna ? bersihkanSensitif(masukan.pengguna, 80) : undefined;
  const sekarang = new Date().toISOString();

  const baru: CatatanBug = {
    id: buatId("BUG"),
    sumber: "manual",
    judul,
    deskripsi,
    lokasi,
    pengguna,
    perangkat: infoPerangkatRingkas(),
    waktuPertama: sekarang,
    waktuTerakhir: sekarang,
    jumlahKejadian: 1,
    status: "tercatat"
  };
  simpanInventaris([baru, ...bacaInventarisBug()]);
  return baru;
}

export function hapusCatatanBug(id: string): void {
  simpanInventaris(bacaInventarisBug().filter((b) => b.id !== id));
}

export function kosongkanInventarisBug(): void {
  simpanInventaris([]);
}

export function eksporInventarisBugJson(): string {
  return JSON.stringify(bacaInventarisBug(), null, 2);
}

export function eksporInventarisBugMarkdown(): string {
  const daftar = bacaInventarisBug();
  if (daftar.length === 0) return "# Inventaris Bug\n\nBelum ada bug tercatat.\n";
  const baris = daftar.map((b, i) => {
    const meta = [
      `Sumber: ${b.sumber === "otomatis" ? "Otomatis" : "Manual"}`,
      b.lokasi ? `Area: ${b.lokasi}` : null,
      `Kejadian: ${b.jumlahKejadian}x`,
      `Terakhir: ${b.waktuTerakhir}`,
      b.perangkat ? `Perangkat: ${b.perangkat}` : null
    ]
      .filter(Boolean)
      .join(" | ");
    return `## ${i + 1}. ${b.judul}\n- ${meta}\n- Detail: ${b.deskripsi}${b.tumpukan ? `\n- Tumpukan:\n\`\`\`\n${b.tumpukan}\n\`\`\`` : ""}`;
  });
  return `# Inventaris Bug Titik Tapak (${daftar.length})\n\n${baris.join("\n\n")}\n`;
}

function adalahPesanDiabaikan(pesan: string): boolean {
  return (
    /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i.test(pesan) ||
    /Cannot update a component\s*\(.*\)\s*while rendering a different component/i.test(pesan) ||
    /reactjs\.org\/link\/setstate-in-render/i.test(pesan)
  );
}

function ekstrakPesanGalat(argumen: unknown[]): { pesan: string; stack?: string } {
  for (const a of argumen) {
    if (a instanceof Error) {
      return { pesan: a.message || a.name, stack: a.stack };
    }
  }
  const teks = argumen
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ")
    .trim();
  return { pesan: teks || "Kesalahan konsol tidak dikenal" };
}

/**
 * Memasang penangkap galat global (window.error, unhandledrejection, dan console.error)
 * agar bug saat pemakaian otomatis terinventarisir untuk diperbaiki di sesi berikutnya.
 */
export function pasangPenangkapBugGlobal(getKonteks?: () => { lokasi?: string; pengguna?: string }): () => void {
  if (typeof window === "undefined") return () => undefined;

  // Bersihkan otomatis setiap bug lama yang sudah diperbaiki saat aplikasi dijalankan
  bersihkanBugSudahDiperbaiki();

  const catatAman = (judul: string, deskripsi: string, stack?: string) => {
    if (sedangMenangkap || adalahPesanDiabaikan(judul + " " + deskripsi)) return;
    sedangMenangkap = true;
    try {
      const ctx = getKonteks?.() ?? {};
      // Tunda notifikasi store ke microtask agar console.error yang terjadi saat render React
      // tidak memicu re-render sinkron pada komponen pemakai useInventarisBug()
      catatBugOtomatis(
        {
          judul,
          deskripsi,
          lokasi: ctx.lokasi,
          tumpukan: stack,
          pengguna: ctx.pengguna
        },
        { tundaNotifikasi: true }
      );
    } catch {
      // Abaikan agar penangkap error tidak memicu error berantai
    } finally {
      sedangMenangkap = false;
    }
  };

  const saatError = (ev: ErrorEvent) => {
    const err = ev.error instanceof Error ? ev.error : null;
    const pesan = err?.message || ev.message || "Kesalahan runtime JavaScript";
    const infoLokasi = ev.filename ? `${ev.filename.split("/").pop()}:${ev.lineno}:${ev.colno}` : "";
    catatAman(pesan, infoLokasi ? `${pesan} (${infoLokasi})` : pesan, err?.stack);
  };

  const saatRejection = (ev: PromiseRejectionEvent) => {
    const alasan = ev.reason;
    const err = alasan instanceof Error ? alasan : null;
    const pesan = err?.message || (typeof alasan === "string" ? alasan : "Promise ditolak tanpa penanganan");
    catatAman(`Promise: ${pesan}`, pesan, err?.stack);
  };

  const consoleErrorAsli = console.error;
  console.error = (...args: unknown[]) => {
    try {
      const { pesan, stack } = ekstrakPesanGalat(args);
      if (pesan) catatAman(pesan.slice(0, 120), pesan, stack);
    } catch {
      // Abaikan
    }
    consoleErrorAsli.apply(console, args);
  };

  window.addEventListener("error", saatError);
  window.addEventListener("unhandledrejection", saatRejection);

  return () => {
    window.removeEventListener("error", saatError);
    window.removeEventListener("unhandledrejection", saatRejection);
    if (console.error !== consoleErrorAsli) {
      console.error = consoleErrorAsli;
    }
  };
}
