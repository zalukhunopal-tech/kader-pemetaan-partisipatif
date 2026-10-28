// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SUFIKS_CADANGAN,
  ambilStatusPenyimpanan,
  bacaTeks,
  formatUkuranByte,
  setelUlangPenyimpananUntukUji,
  siapkanPenyimpanan,
  simpanSekarang,
  tulisTeks
} from "./penyimpanan";

const KUNCI = ["geokader_a_v5", "geokader_b_v5"];

/** Meniru memuat ulang halaman: memori dikosongkan, data hanya dari penyimpanan */
async function muatUlang() {
  await simpanSekarang();
  setelUlangPenyimpananUntukUji();
  await siapkanPenyimpanan(KUNCI);
}

async function hapusDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("geokader-db");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  setelUlangPenyimpananUntukUji();
  localStorage.clear();
  await hapusDb();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("IndexedDB", () => {
  it("memakai mode indexeddb dan data bertahan setelah muat ulang", async () => {
    await siapkanPenyimpanan(KUNCI);
    expect(ambilStatusPenyimpanan().mode).toBe("indexeddb");
    tulisTeks("geokader_a_v5", '{"x":1}');
    expect(bacaTeks("geokader_a_v5")).toBe('{"x":1}'); // sinkron lewat cache
    expect(localStorage.getItem("geokader_a_v5")).toBeNull(); // tidak menyentuh localStorage
    await muatUlang();
    expect(bacaTeks("geokader_a_v5")).toBe('{"x":1}');
  });

  it("penulisan beruntun pada kunci yang sama menyimpan nilai terakhir", async () => {
    await siapkanPenyimpanan(KUNCI);
    for (let i = 0; i < 50; i++) tulisTeks("geokader_a_v5", String(i));
    expect(ambilStatusPenyimpanan().menunggu).toBe(true);
    await muatUlang();
    expect(bacaTeks("geokader_a_v5")).toBe("49");
    expect(ambilStatusPenyimpanan().menunggu).toBe(false);
  });

  it("menghapus kunci (nilai null)", async () => {
    await siapkanPenyimpanan(KUNCI);
    tulisTeks("geokader_a_v5", "1");
    await simpanSekarang();
    tulisTeks("geokader_a_v5", null);
    await muatUlang();
    expect(bacaTeks("geokader_a_v5")).toBeNull();
  });

  it("memigrasikan data dari localStorage lalu menghapus salinan lama", async () => {
    localStorage.setItem("geokader_a_v5", '{"lama":true}');
    localStorage.setItem("geokader_akun_lain", "tetap"); // bukan kunci data: tidak disentuh
    await siapkanPenyimpanan(KUNCI);
    expect(bacaTeks("geokader_a_v5")).toBe('{"lama":true}');
    expect(localStorage.getItem("geokader_a_v5")).toBeNull();
    expect(localStorage.getItem("geokader_akun_lain")).toBe("tetap");
    await muatUlang();
    expect(bacaTeks("geokader_a_v5")).toBe('{"lama":true}'); // kini berasal dari IndexedDB
  });

  it("jika kedua tempat berisi nilai berbeda: IndexedDB dipakai, salinan localStorage disimpan sebagai cadangan", async () => {
    await siapkanPenyimpanan(KUNCI);
    tulisTeks("geokader_a_v5", "baru");
    await muatUlang();
    localStorage.setItem("geokader_a_v5", "dari-versi-lama"); // mis. halaman versi lama yang masih terbuka
    await muatUlang();
    expect(bacaTeks("geokader_a_v5")).toBe("baru");
    expect(bacaTeks("geokader_a_v5" + SUFIKS_CADANGAN)).toBe("dari-versi-lama");
    expect(localStorage.getItem("geokader_a_v5")).toBeNull();
    await muatUlang();
    expect(bacaTeks("geokader_a_v5" + SUFIKS_CADANGAN)).toBe("dari-versi-lama"); // cadangan ikut bertahan
  });

  it("jika salinan localStorage identik (migrasi terputus), tidak ada cadangan dan sisa dibersihkan", async () => {
    await siapkanPenyimpanan(KUNCI);
    tulisTeks("geokader_a_v5", "sama");
    await muatUlang();
    localStorage.setItem("geokader_a_v5", "sama");
    await muatUlang();
    expect(bacaTeks("geokader_a_v5" + SUFIKS_CADANGAN)).toBeNull();
    expect(localStorage.getItem("geokader_a_v5")).toBeNull();
  });

  it("kegagalan menulis (kuota) dilaporkan, tidak diabaikan, dan pulih setelah berhasil", async () => {
    await siapkanPenyimpanan(KUNCI);
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("penuh", "QuotaExceededError");
    });
    tulisTeks("geokader_a_v5", "penting");
    await simpanSekarang();
    expect(ambilStatusPenyimpanan().kuotaPenuh).toBe(true);
    expect(ambilStatusPenyimpanan().galat).toMatch(/penuh/i);
    expect(ambilStatusPenyimpanan().menunggu).toBe(true); // masih dipertahankan untuk dicoba lagi
    expect(bacaTeks("geokader_a_v5")).toBe("penting"); // tetap terbaca selama sesi

    put.mockRestore();
    await simpanSekarang();
    expect(ambilStatusPenyimpanan()).toMatchObject({ kuotaPenuh: false, galat: null, menunggu: false });
    await muatUlang();
    expect(bacaTeks("geokader_a_v5")).toBe("penting");
  });

  it("galat selain kuota diberi pesan umum", async () => {
    await siapkanPenyimpanan(KUNCI);
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("rusak", "UnknownError");
    });
    tulisTeks("geokader_b_v5", "x");
    await simpanSekarang();
    expect(ambilStatusPenyimpanan().kuotaPenuh).toBe(false);
    expect(ambilStatusPenyimpanan().galat).toMatch(/gagal disimpan/);
  });

  it("memberi tahu pendengar saat status berubah", async () => {
    const { langgananStatusPenyimpanan } = await import("./penyimpanan");
    const fn = vi.fn();
    const berhenti = langgananStatusPenyimpanan(fn);
    await siapkanPenyimpanan(KUNCI);
    expect(fn).toHaveBeenCalled();
    berhenti();
  });
});

describe("tanpa IndexedDB", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", undefined);
  });

  it("kembali ke localStorage dan data tetap tersimpan di sana", async () => {
    await siapkanPenyimpanan(KUNCI);
    expect(ambilStatusPenyimpanan().mode).toBe("localstorage");
    tulisTeks("geokader_a_v5", "1");
    expect(localStorage.getItem("geokader_a_v5")).toBe("1");
    setelUlangPenyimpananUntukUji();
    expect(bacaTeks("geokader_a_v5")).toBe("1");
  });

  it("kuota localStorage penuh dilaporkan, bukan diabaikan", async () => {
    await siapkanPenyimpanan(KUNCI);
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("penuh", "QuotaExceededError");
    });
    tulisTeks("geokader_a_v5", "x".repeat(10));
    expect(ambilStatusPenyimpanan().kuotaPenuh).toBe(true);
    expect(bacaTeks("geokader_a_v5")).toBe("x".repeat(10)); // tetap ada di memori
    set.mockRestore();
    tulisTeks("geokader_a_v5", "ok");
    expect(ambilStatusPenyimpanan()).toMatchObject({ kuotaPenuh: false, galat: null });
  });

  it("jika localStorage juga tidak bisa ditulis: mode memori dengan peringatan", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("diblokir", "SecurityError");
    });
    await siapkanPenyimpanan(KUNCI);
    expect(ambilStatusPenyimpanan().mode).toBe("memori");
    expect(ambilStatusPenyimpanan().galat).toMatch(/tidak tersedia/);
    tulisTeks("geokader_a_v5", "sesi");
    expect(bacaTeks("geokader_a_v5")).toBe("sesi");
  });
});

describe("formatUkuranByte", () => {
  it("memilih satuan yang sesuai", () => {
    expect(formatUkuranByte(512)).toBe("512 B");
    expect(formatUkuranByte(2048)).toBe("2.0 KB");
    expect(formatUkuranByte(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatUkuranByte(3 * 1024 * 1024 * 1024)).toBe("3.00 GB");
  });
});
