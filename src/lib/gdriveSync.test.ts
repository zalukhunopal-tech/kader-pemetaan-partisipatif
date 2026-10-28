import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsiSinkron, gdriveTerpasang, sinkronkanDataKeGDrive, tafsirkanBalasan, tujuanDrive, urlAppsScriptValid } from "./gdriveSync";
import { DataSpasialItem, WilayahAdministrasi } from "../types";

const URL_OK = "https://script.google.com/macros/s/AKfycbx123/exec";
const JAMBI: WilayahAdministrasi = { provinsi: "Jambi", kabupaten: "Kabupaten Merangin", kecamatan: "Bangko", desa: "Rantau Panjang" };
/** Koneksi uji dan wilayah akun KDR-1 seperti yang diisi admin */
const konfig = (koneksi: Partial<OpsiSinkron["koneksi"]> = {}, wilayahAkun: WilayahAdministrasi | undefined = JAMBI): OpsiSinkron => ({
  koneksi: { url: URL_OK, token: "rahasia", ...koneksi },
  cariWilayah: (id) => (id === "KDR-1" ? wilayahAkun : undefined)
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
  createdAt: "2026-11-14T03:00:00Z",
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

describe("tujuanDrive", () => {
  it("cap wilayah pada data dipakai lebih dulu, lalu wilayah akun, lalu nama desa lama", () => {
    const lain = { ...JAMBI, desa: "Pulau Rengas" };
    expect(tujuanDrive({ ...item("a"), wilayah: lain }, () => JAMBI).wilayah).toEqual(lain);
    expect(tujuanDrive(item("a"), () => JAMBI).wilayah).toEqual(JAMBI);
    expect(tujuanDrive(item("a"), () => undefined).wilayah).toEqual({ provinsi: "", kabupaten: "", kecamatan: "", desa: "Desa A" });
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

  it("Google Drive belum dipasang di build (URL atau token kosong): tidak mengirim dan tidak melaporkan berhasil", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    for (const koneksi of [{ url: "" }, { token: "" }, { url: "https://contoh.com/exec" }]) {
      const h = await sinkronkanDataKeGDrive([item("a"), item("b")], konfig(koneksi));
      expect(h).toMatchObject({ sukses: false, belumDiatur: true, idTersinkron: [], jumlahGagal: 2 });
      expect(h.pesan).toMatch(/belum aktif/);
    }
    expect(f).not.toHaveBeenCalled();
    expect(gdriveTerpasang({ url: URL_OK, token: "t" })).toBe(true);
    expect(gdriveTerpasang({ url: URL_OK, token: "" })).toBe(false);
  });

  it("build uji tanpa VITE_GDRIVE_*: unggahan tidak aktif", () => {
    expect(gdriveTerpasang()).toBe(false);
  });

  it("berhasil: hanya data berstatus lokal dikirim, lengkap dengan token dan WKT", async () => {
    const f = vi.fn(async () => balas({ diterima: ["a", "b"], gagal: [] }));
    vi.stubGlobal("fetch", f);
    const h = await sinkronkanDataKeGDrive([item("a"), item("b"), item("c", "terverifikasi")], konfig());
    expect(h).toMatchObject({ sukses: true, idTersinkron: ["a", "b"], jumlahGagal: 0 });
    expect(f).toHaveBeenCalledTimes(1);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ action: "sync_spatial_batch", versi: 2, token: "rahasia" });
    expect(body).not.toHaveProperty("folderId");
    expect(body.records.map((r: { id: string }) => r.id)).toEqual(["a", "b"]);
    expect(body.records[0].wkt).toBe("POINT(100.400000 -0.900000)"); // WKT: bujur lalu lintang, 6 desimal;
    expect(JSON.parse(body.geojsonBundle).features).toHaveLength(2);
  });

  it("setiap data membawa wilayah tujuan dan nama berkas akun_data_bulan_tahun", async () => {
    const f = vi.fn(async () => balas({ diterima: ["a"], gagal: [] }));
    vi.stubGlobal("fetch", f);
    await sinkronkanDataKeGDrive([{ ...item("a"), namaKader: "Budi", judul: "Sebaran Anggrek" }], konfig());
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.records[0]).toMatchObject({ wilayah: JAMBI, namaBerkas: "budi_sebaran_anggrek_november_2026" });
    expect(JSON.parse(body.geojsonBundle).features[0].properties).toMatchObject({
      provinsi: "Jambi",
      kabupatenKota: "Kabupaten Merangin",
      kecamatan: "Bangko",
      kelurahanDesa: "Rantau Panjang"
    });
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
