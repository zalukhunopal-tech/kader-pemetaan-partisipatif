import { afterEach, describe, expect, it, vi } from "vitest";
import { sinkronkanDataKeGDrive, tafsirkanBalasan, urlAppsScriptValid } from "./gdriveSync";
import { DataSpasialItem, KonfigurasiGDrive } from "../types";

const URL_OK = "https://script.google.com/macros/s/AKfycbx123/exec";
const konfig = (over: Partial<KonfigurasiGDrive> = {}): KonfigurasiGDrive => ({
  webAppUrl: URL_OK,
  folderIdDatabase: "Database_Pemetaan",
  spreadsheetIdMaster: "Master_Spasial",
  autoSyncSaatOnline: true,
  tokenBersama: "rahasia",
  ...over
});

const item = (id: string, status: DataSpasialItem["statusSinkron"] = "lokal"): DataSpasialItem => ({
  id,
  idKader: "KDR-1",
  namaKader: "Budi",
  desaWilayah: "Desa A",
  jenisGeometri: "point",
  kategori: "Flora",
  judul: "J " + id,
  deskripsi: "",
  koordinat: [{ lat: -0.9, lng: 100.4 }],
  panjangKm: 0,
  luasHa: 0,
  statusSinkron: status,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "",
  riwayatPembaruan: []
});

const balas = (obj: unknown, status = 200) => new Response(typeof obj === "string" ? obj : JSON.stringify(obj), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("urlAppsScriptValid", () => {
  it("menerima URL Web App /exec, juga dengan parameter dan spasi", () => {
    expect(urlAppsScriptValid(URL_OK)).toBe(true);
    expect(urlAppsScriptValid(`  ${URL_OK}?x=1 `)).toBe(true);
  });
  it("menolak http, host lain, /dev, dan kosong", () => {
    expect(urlAppsScriptValid(URL_OK.replace("https", "http"))).toBe(false);
    expect(urlAppsScriptValid("https://contoh.com/macros/s/x/exec")).toBe(false);
    expect(urlAppsScriptValid("https://script.google.com/macros/s/x/dev")).toBe(false);
    expect(urlAppsScriptValid("")).toBe(false);
    expect(urlAppsScriptValid(undefined)).toBe(false);
  });
});

describe("tafsirkanBalasan", () => {
  it("format baru: hanya id yang dikirim dan dikonfirmasi yang dianggap tersimpan", () => {
    const r = tafsirkanBalasan({ diterima: ["a", "z"], gagal: [{ id: "b", pesan: "foto rusak" }] }, ["a", "b", "c"]);
    expect(r.diterima).toEqual(["a"]); // "z" tidak pernah dikirim
    expect(r.gagal).toEqual([
      { id: "b", pesan: "foto rusak" },
      { id: "c", pesan: "tidak dikonfirmasi oleh Apps Script" }
    ]);
  });
  it("format lama: sukses + jumlah sama = semua tersimpan", () => {
    expect(tafsirkanBalasan({ sukses: true, jumlah: 2 }, ["a", "b"])).toEqual({ diterima: ["a", "b"], gagal: [] });
  });
  it("format lama dengan jumlah tidak cocok ditolak", () => {
    expect(() => tafsirkanBalasan({ sukses: true, jumlah: 1 }, ["a", "b"])).toThrow(/tidak cocok/);
  });
  it("sukses:false melempar pesan dari server", () => {
    expect(() => tafsirkanBalasan({ sukses: false, pesan: "Token tidak sah" }, ["a"])).toThrow("Token tidak sah");
  });
  it("balasan tak dikenal (null, objek kosong, teks) ditolak", () => {
    for (const b of [null, undefined, {}, "ok", 5]) {
      expect(() => tafsirkanBalasan(b, ["a"])).toThrow(/tidak sah/);
    }
  });
});

describe("sinkronkanDataKeGDrive", () => {
  it("tidak ada antrean: sukses tanpa mengirim apa pun", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const h = await sinkronkanDataKeGDrive([item("a", "terverifikasi")], konfig());
    expect(h).toMatchObject({ sukses: true, idTersinkron: [], jumlahGagal: 0 });
    expect(f).not.toHaveBeenCalled();
  });

  it("URL belum diisi/tidak valid: tidak mengirim dan tidak melaporkan berhasil", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const h = await sinkronkanDataKeGDrive([item("a"), item("b")], konfig({ webAppUrl: "" }));
    expect(h).toMatchObject({ sukses: false, belumDiatur: true, idTersinkron: [], jumlahGagal: 2 });
    expect(f).not.toHaveBeenCalled();
  });

  it("berhasil: hanya data berstatus lokal dikirim, lengkap dengan token dan WKT", async () => {
    const f = vi.fn(async () => balas({ diterima: ["a", "b"], gagal: [] }));
    vi.stubGlobal("fetch", f);
    const h = await sinkronkanDataKeGDrive([item("a"), item("b"), item("c", "terverifikasi")], konfig());
    expect(h).toMatchObject({ sukses: true, idTersinkron: ["a", "b"], jumlahGagal: 0 });
    expect(f).toHaveBeenCalledTimes(1);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({
      action: "sync_spatial_batch",
      token: "rahasia",
      folderId: "Database_Pemetaan",
      spreadsheetId: "Master_Spasial"
    });
    expect(body.records.map((r: { id: string }) => r.id)).toEqual(["a", "b"]);
    expect(body.records[0].wkt).toBe("POINT(100.400000 -0.900000)"); // WKT: bujur lalu lintang, 6 desimal;
    expect(JSON.parse(body.geojsonBundle).features).toHaveLength(2);
  });

  it("konfirmasi sebagian: hanya yang dikonfirmasi berubah status; sisanya dilaporkan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => balas({ diterima: ["a"], gagal: [{ id: "b", pesan: "foto rusak" }] }))
    );
    const h = await sinkronkanDataKeGDrive([item("a"), item("b")], konfig());
    expect(h.sukses).toBe(false);
    expect(h.idTersinkron).toEqual(["a"]);
    expect(h.jumlahGagal).toBe(1);
    expect(h.pesan).toMatch(/1 dari 2 data tersimpan/);
    expect(h.pesan).toMatch(/foto rusak/);
  });

  it("HTTP 200 dengan penolakan token tidak dianggap berhasil", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => balas({ sukses: false, pesan: "Token tidak sah." }))
    );
    const h = await sinkronkanDataKeGDrive([item("a")], konfig());
    expect(h).toMatchObject({ sukses: false, idTersinkron: [], jumlahGagal: 1 });
    expect(h.pesan).toMatch(/Token tidak sah/);
  });

  it("balasan bukan JSON (halaman login Google) memberi petunjuk akses Anyone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => balas("<html>Masuk</html>"))
    );
    const h = await sinkronkanDataKeGDrive([item("a")], konfig());
    expect(h.sukses).toBe(false);
    expect(h.pesan).toMatch(/bukan JSON/);
    expect(h.pesan).toMatch(/Anyone/);
  });

  it("HTTP 500 dan putus jaringan: gagal dengan pesan yang bisa dipahami, data tetap lokal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => balas({}, 500))
    );
    let h = await sinkronkanDataKeGDrive([item("a")], konfig());
    expect(h).toMatchObject({ sukses: false, idTersinkron: [] });
    expect(h.pesan).toMatch(/HTTP 500/);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    h = await sinkronkanDataKeGDrive([item("a")], konfig());
    expect(h.pesan).toMatch(/tidak ada koneksi/);
  });

  it("antrean besar dibagi per 10 data; berhenti di batch pertama yang gagal", async () => {
    const data = Array.from({ length: 25 }, (_, i) => item("d" + i));
    const f = vi.fn(async (_u: string, opsi: RequestInit) => {
      const ids = JSON.parse(opsi.body as string).records.map((r: { id: string }) => r.id);
      return balas({ diterima: ids, gagal: [] });
    });
    vi.stubGlobal("fetch", f);
    let h = await sinkronkanDataKeGDrive(data, konfig());
    expect(f).toHaveBeenCalledTimes(3);
    expect(h).toMatchObject({ sukses: true, jumlahGagal: 0 });
    expect(h.idTersinkron).toHaveLength(25);

    let n = 0;
    const g = vi.fn(async (_u: string, opsi: RequestInit) => {
      if (++n === 2) throw new TypeError("putus");
      const ids = JSON.parse(opsi.body as string).records.map((r: { id: string }) => r.id);
      return balas({ diterima: ids, gagal: [] });
    });
    vi.stubGlobal("fetch", g);
    h = await sinkronkanDataKeGDrive(data, konfig());
    expect(g).toHaveBeenCalledTimes(2); // batch ketiga tidak dicoba
    expect(h.idTersinkron).toHaveLength(10);
    expect(h.jumlahGagal).toBe(15);
  });
});
