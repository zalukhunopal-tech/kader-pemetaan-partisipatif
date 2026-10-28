import { describe, expect, it } from "vitest";
import vm from "node:vm";
import { KODE_GOOGLE_APPS_SCRIPT } from "./gdriveSync";

/**
 * Menjalankan Code.gs yang dihasilkan aplikasi terhadap tiruan layanan Google
 * (Drive, Spreadsheet, Lock, Properties). Ini membuktikan logika skrip; belum
 * menggantikan uji di Apps Script sungguhan.
 */

type Baris = unknown[];
interface Berkas { tipe: "foto" | "teks"; nama: string; isi?: string; getUrl: () => string }

function buatLingkungan({ token = "rahasia" as string | null, terikatSheet = true } = {}) {
  const log = { foto: [] as { folder: string; nama: string }[], geojson: [] as { folder: string; nama: string; isi: string }[], lockLepas: 0 };
  class Folder {
    anak: Record<string, Folder> = {};
    constructor(public nama: string) {}
    getFoldersByName(n: string) {
      const f = this.anak[n];
      return { hasNext: () => !!f, next: () => f };
    }
    createFolder(n: string) {
      return (this.anak[n] = new Folder(n));
    }
    createFile(a: { nama: string } | string, b?: string): Berkas {
      const f: Berkas =
        typeof a === "object"
          ? { tipe: "foto", nama: a.nama, getUrl: () => "https://drive.test/" + a.nama }
          : { tipe: "teks", nama: a, isi: b, getUrl: () => "https://drive.test/" + a };
      if (f.tipe === "foto") log.foto.push({ folder: this.nama, nama: f.nama });
      else log.geojson.push({ folder: this.nama, nama: f.nama, isi: f.isi ?? "" });
      return f;
    }
  }
  const root = new Folder("ROOT");
  class Sheet {
    baris: Baris[] = [];
    appendRow(r: Baris) { this.baris.push([...r]); }
    getLastRow() { return this.baris.length; }
    getRange(r: number, c: number, nr = 1, nc = 1) {
      const baris = this.baris; // larik yang sama dipakai appendRow, jadi perubahan terlihat di kedua arah
      return {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (baris[r - 1 + i] || [])[c - 1 + j] ?? "")),
        getValue: () => (baris[r - 1] || [])[c - 1] ?? "",
        setValues: (v: Baris[]) => { v.forEach((row, i) => { baris[r - 1 + i] = [...row]; }); }
      };
    }
  }
  const ss = {
    tab: {} as Record<string, Sheet>,
    getSheetByName(n: string) { return this.tab[n] || null; },
    insertSheet(n: string) { return (this.tab[n] = new Sheet()); }
  };
  const sandbox: Record<string, unknown> = {
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { log.lockLepas++; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => (k === "GEOKADER_TOKEN" ? token : null) }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => (terikatSheet ? ss : null) },
    DriveApp: { getRootFolder: () => root, getFolderById: (id: string) => { throw new Error("tidak ada " + id); } },
    Utilities: { base64Decode: (s: string) => Buffer.from(s, "base64"), newBlob: (bytes: Buffer, tipe: string, nama: string) => ({ nama, tipe, bytes }) },
    MimeType: { PLAIN_TEXT: "text/plain" },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t: string) => ({ isi: t, setMimeType() { return this; } }) },
    JSON, Date, String, Object, Array, Buffer
  };
  vm.createContext(sandbox);
  vm.runInContext(KODE_GOOGLE_APPS_SCRIPT, sandbox);
  const kirim = (body: unknown) =>
    JSON.parse(((sandbox.doPost as (e: unknown) => { isi: string })({ postData: { contents: JSON.stringify(body) } })).isi) as Record<string, unknown>;
  return { kirim, ss, root, log };
}

const rec = (id: string, o: Record<string, unknown> = {}) => ({
  id, idKader: "KDR-1", namaKader: "Budi", desaWilayah: "A", jenisGeometri: "point", kategori: "Flora",
  judul: "J " + id, namaLokal: "", namaIlmiah: "", jumlahIndividu: 1, panjangKm: 0, luasHa: 0,
  wkt: "POINT(1 2)", fotoBase64: "", namaFileFoto: id + ".jpg", createdAt: "2026-10-01T00:00:00Z", updatedAt: "", ...o
});
const fitur = (r: { id: string; namaKader: string }) => ({ type: "Feature", id: r.id, geometry: { type: "Point", coordinates: [1, 2] }, properties: { namaKader: r.namaKader } });
const bundle = (rs: { id: string; namaKader: string }[]) => JSON.stringify({ type: "FeatureCollection", features: rs.map(fitur) });
const payload = (rs: ReturnType<typeof rec>[], o: Record<string, unknown> = {}) => ({
  token: "rahasia", folderId: "Database_Pemetaan", spreadsheetId: "Master_Spasial", records: rs, geojsonBundle: bundle(rs), ...o
});

describe("Code.gs: token dan prasyarat", () => {
  it("token salah atau tidak ada ditolak tanpa menulis apa pun", () => {
    const L = buatLingkungan();
    let h = L.kirim(payload([rec("a")], { token: "salah" }));
    expect(h.sukses).toBe(false);
    expect(h.pesan).toMatch(/Token/);
    expect(h.diterima).toBeUndefined();
    expect(Object.keys(L.ss.tab)).toHaveLength(0);
    h = L.kirim(payload([rec("a")], { token: undefined }));
    expect(h.sukses).toBe(false);
  });
  it("GEOKADER_TOKEN belum diatur: ditolak dengan petunjuk", () => {
    const h = buatLingkungan({ token: null }).kirim(payload([rec("a")]));
    expect(h.sukses).toBe(false);
    expect(h.pesan).toMatch(/GEOKADER_TOKEN belum diatur/);
  });
  it("skrip tidak terikat Spreadsheet: pesan jelas", () => {
    const h = buatLingkungan({ terikatSheet: false }).kirim(payload([rec("a")]));
    expect(h.sukses).toBe(false);
    expect(h.pesan).toMatch(/Spreadsheet/);
  });
  it("lock dilepas juga saat permintaan ditolak", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a")], { token: "salah" }));
    expect(L.log.lockLepas).toBe(1);
  });
});

describe("Code.gs: penyimpanan idempoten", () => {
  it("data baru dikonfirmasi per id dan masuk ke sheet (header + baris)", () => {
    const L = buatLingkungan();
    const h = L.kirim(payload([rec("a"), rec("b")]));
    expect(h).toMatchObject({ sukses: true, diterima: ["a", "b"], gagal: [], jumlah: 2 });
    expect(L.ss.tab["Master_Spasial"].baris).toHaveLength(3);
  });

  it("kirim ulang id yang sama memperbarui baris, tidak menggandakan", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a"), rec("b")]));
    const h = L.kirim(payload([rec("a", { judul: "Judul diperbarui" }), rec("b")]));
    const tab = L.ss.tab["Master_Spasial"];
    expect(tab.baris).toHaveLength(3);
    expect(tab.baris[1][6]).toBe("Judul diperbarui");
    expect(h.diterima).toEqual(["a", "b"]);
  });

  it("status verifikasi yang diubah admin di sheet tidak ditimpa saat kirim ulang", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a")]));
    L.ss.tab["Master_Spasial"].baris[1][14] = "Terverifikasi_Admin";
    L.kirim(payload([rec("a")]));
    expect(L.ss.tab["Master_Spasial"].baris[1][14]).toBe("Terverifikasi_Admin");
  });

  it("campuran data lama dan baru: yang baru ditambahkan di bawah", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a"), rec("b")]));
    L.kirim(payload([rec("a"), rec("c")]));
    const tab = L.ss.tab["Master_Spasial"];
    expect(tab.baris).toHaveLength(4);
    expect(tab.baris[3][0]).toBe("c");
  });
});

describe("Code.gs: foto, arsip, konfigurasi", () => {
  it("foto diunggah sekali dan tautannya masuk ke sheet; kirim ulang tidak mengunggah lagi", () => {
    const L = buatLingkungan();
    const foto = "data:image/jpeg;base64," + Buffer.from("JPEGDATA").toString("base64");
    L.kirim(payload([rec("f", { fotoBase64: foto })]));
    expect(L.log.foto).toHaveLength(1);
    expect(L.ss.tab["Master_Spasial"].baris[1][13]).toBe("https://drive.test/f.jpg");
    L.kirim(payload([rec("f", { fotoBase64: foto })]));
    expect(L.log.foto).toHaveLength(1);
    expect(L.ss.tab["Master_Spasial"].baris).toHaveLength(2);
  });

  it("arsip GeoJSON dipisah per kader", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a", { namaKader: "Budi" }), rec("b", { namaKader: "Siti Rahma" }), rec("c", { namaKader: "Budi" })]));
    const peta = Object.fromEntries(L.log.geojson.map((g) => [g.folder, (JSON.parse(g.isi).features as { id: string }[]).map((f) => f.id)]));
    expect(peta).toEqual({ Budi: ["a", "c"], "Siti Rahma": ["b"] });
  });

  it("nama folder dan tab mengikuti konfigurasi aplikasi", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a")], { folderId: "Folder_Desa_X", spreadsheetId: "Tab_Khusus" }));
    expect(L.root.anak["Folder_Desa_X"]).toBeDefined();
    expect(L.ss.tab["Tab_Khusus"]).toBeDefined();
  });
});
