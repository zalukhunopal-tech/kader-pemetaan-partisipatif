import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/**
 * Menjalankan apps-script/Code.gs terhadap tiruan layanan Google (Drive, Spreadsheet, Lock,
 * Properties). Ini membuktikan logika skrip; belum menggantikan uji di Apps Script sungguhan.
 */

const KODE_GS = readFileSync(new URL("../../apps-script/Code.gs", import.meta.url), "utf8");

type Baris = unknown[];
type Iterator<T> = { hasNext: () => boolean; next: () => T };
const iter = <T>(daftar: T[]): Iterator<T> => {
  let i = 0;
  return { hasNext: () => i < daftar.length, next: () => daftar[i++] };
};

function buatLingkungan({ token = "rahasia" as string | null } = {}) {
  let nomor = 0;
  const semua = new Map<string, Folder | Berkas>();
  const log = { lockLepas: 0, logger: [] as string[] };

  class Berkas {
    id = "B" + ++nomor;
    trashed = false;
    induk: Folder | null = null;
    constructor(
      public nama: string,
      public isi: string,
      public tipe: string
    ) {
      semua.set(this.id, this);
    }
    getId = () => this.id;
    getName = () => this.nama;
    getUrl = () => "https://drive.test/" + this.id;
    isTrashed = () => this.trashed;
    setTrashed = (v: boolean) => {
      this.trashed = v;
    };
    getBlob = () => ({ getDataAsString: () => this.isi });
    setContent = (s: string) => {
      this.isi = s;
      return this;
    };
    moveTo = (f: Folder) => {
      if (this.induk) this.induk.berkas = this.induk.berkas.filter((b) => b !== this);
      f.berkas.push(this);
      this.induk = f;
    };
  }
  class Folder {
    id = "F" + ++nomor;
    trashed = false;
    anak: Folder[] = [];
    berkas: Berkas[] = [];
    constructor(public nama: string) {
      semua.set(this.id, this);
    }
    getId = () => this.id;
    getName = () => this.nama;
    getUrl = () => "https://drive.test/folder/" + this.id;
    isTrashed = () => this.trashed;
    getFoldersByName = (n: string) => iter(this.anak.filter((f) => f.nama === n));
    getFolders = () => iter([...this.anak]);
    createFolder = (n: string) => {
      const f = new Folder(n);
      this.anak.push(f);
      return f;
    };
    getFilesByName = (n: string) => iter(this.berkas.filter((b) => b.nama === n));
    getFiles = () => iter([...this.berkas]);
    createFile = (a: { nama: string; bytes: Buffer; tipe: string } | string, isi?: string, tipe?: string) => {
      const b = typeof a === "object" ? new Berkas(a.nama, a.bytes.toString("utf8"), a.tipe) : new Berkas(a, isi ?? "", tipe ?? "");
      b.moveTo(this);
      return b;
    };
    /** Jalur nama folder dari folder ini ke bawah, untuk pemeriksaan */
    cari = (...jalur: string[]): Folder | undefined =>
      jalur.reduce<Folder | undefined>((f, n) => f?.anak.find((x) => x.nama === n && !x.trashed), this);
    berkasAktif = () => this.berkas.filter((b) => !b.trashed);
  }
  class Sheet {
    baris: Baris[] = [];
    nama = "Sheet1";
    setName(n: string) {
      this.nama = n;
    }
    appendRow(r: Baris) {
      this.baris.push([...r]);
    }
    getLastRow() {
      return this.baris.length;
    }
    getRange(r: number, c: number, nr = 1, nc = 1) {
      const baris = this.baris;
      return {
        getValues: () =>
          Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (baris[r - 1 + i] || [])[c - 1 + j] ?? "")),
        setValues: (v: Baris[]) => {
          v.forEach((row, i) => {
            baris[r - 1 + i] = [...row];
          });
        }
      };
    }
  }
  class Spreadsheet {
    tab: Sheet[] = [new Sheet()];
    berkas: Berkas;
    constructor(nama: string) {
      this.berkas = new Berkas(nama, "", "spreadsheet");
      root.berkas.push(this.berkas);
      this.berkas.induk = root;
      spreadsheet.set(this.berkas.id, this);
    }
    getId = () => this.berkas.id;
    getUrl = () => "https://sheets.test/" + this.berkas.id;
    getSheets = () => this.tab;
    getSheetByName = (n: string) => this.tab.find((t) => t.nama === n) ?? null;
    insertSheet = (n: string) => {
      const t = new Sheet();
      t.nama = n;
      this.tab.push(t);
      return t;
    };
  }

  const root = new Folder("ROOT");
  const spreadsheet = new Map<string, Spreadsheet>();
  const props = new Map<string, string>(token ? [["GEOKADER_TOKEN", token]] : []);
  const ambil = (id: string) => {
    const x = semua.get(id);
    if (!x) throw new Error("tidak ada " + id);
    return x;
  };

  const sandbox: Record<string, unknown> = {
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock: () => log.lockLepas++ }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => props.set(k, v)
      })
    },
    SpreadsheetApp: {
      create: (n: string) => new Spreadsheet(n),
      openById: (id: string) => {
        const ss = spreadsheet.get(id);
        if (!ss) throw new Error("bukan spreadsheet " + id);
        return ss;
      }
    },
    DriveApp: { getRootFolder: () => root, getFolderById: ambil, getFileById: ambil },
    Utilities: {
      getUuid: () => "1234abcd-0000-4000-8000-0000000000ff",
      base64Decode: (s: string) => {
        if (!/^[A-Za-z0-9+/=]+$/.test(s)) throw new Error("Could not decode string.");
        return Buffer.from(s, "base64");
      },
      newBlob: (bytes: Buffer, tipe: string, nama: string) => ({ nama, tipe, bytes })
    },
    Logger: { log: (s: string) => log.logger.push(s) },
    MimeType: { PLAIN_TEXT: "text/plain" },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (t: string) => ({
        isi: t,
        setMimeType() {
          return this;
        }
      })
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(KODE_GS, sandbox);
  const panggil = <T>(nama: string, ...arg: unknown[]) => (sandbox[nama] as (...a: unknown[]) => T)(...arg);
  const kirim = (body: unknown) =>
    JSON.parse(panggil<{ isi: string }>("doPost", { postData: { contents: JSON.stringify(body) } }).isi) as Record<string, unknown>;
  const induk = () => root.cari("GeoKader_Database")!;
  const tabData = () => [...spreadsheet.values()][0].getSheetByName("Data_Spasial")!;
  const isiGeojson = (f: Folder | undefined, nama: string) => {
    const b = f?.berkasAktif().find((x) => x.nama === nama);
    return b ? (JSON.parse(b.isi) as { features: { id: string; properties: Record<string, unknown> }[] }) : undefined;
  };
  return { kirim, panggil, root, induk, tabData, isiGeojson, props, log, spreadsheet };
}

const JAMBI = { provinsi: "Jambi", kabupaten: "Kabupaten Merangin", kecamatan: "Bangko", desa: "Rantau Panjang" };

const rec = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  idKader: "KDR-1",
  namaKader: "Budi",
  desaWilayah: "Rantau Panjang",
  wilayah: JAMBI,
  namaBerkas: "budi_sebaran_anggrek_november_2026",
  jenisGeometri: "point",
  kategori: "Flora",
  judul: "Sebaran Anggrek",
  namaLokal: "",
  namaIlmiah: "",
  jumlahIndividu: 1,
  panjangKm: 0,
  luasHa: 0,
  wkt: "POINT(102.1 -2.1)",
  fotoBase64: "",
  createdAt: "2026-11-14T03:00:00Z",
  updatedAt: "",
  ...o
});
const fitur = (r: { id: string; judul?: unknown }) => ({
  type: "Feature",
  id: r.id,
  geometry: { type: "Point", coordinates: [102.1, -2.1] },
  properties: { id: r.id, judul: r.judul }
});
const payload = (rs: ReturnType<typeof rec>[], o: Record<string, unknown> = {}) => ({
  token: "rahasia",
  records: rs,
  geojsonBundle: JSON.stringify({ type: "FeatureCollection", features: rs.map(fitur) }),
  ...o
});
const FOTO = "data:image/jpeg;base64," + Buffer.from("JPEGDATA").toString("base64");
const desaJambi = (L: ReturnType<typeof buatLingkungan>) => L.induk().cari("Jambi", "Kabupaten Merangin", "Bangko", "Rantau Panjang");

describe("Code.gs: pemasangan dan token", () => {
  it("pasangGeoKader membuat folder induk, spreadsheet di dalamnya, dan token; dijalankan ulang tidak menggandakan", () => {
    const L = buatLingkungan({ token: null });
    const hasil = L.panggil<{ token: string; folder: string; spreadsheet: string }>("pasangGeoKader");
    expect(hasil.token).toBe("1234abcd000040008000" + "0000000000ff");
    expect(L.props.get("GEOKADER_TOKEN")).toBe(hasil.token);
    expect(L.induk()).toBeDefined();
    expect(
      L.induk()
        .berkasAktif()
        .map((b) => b.nama)
    ).toEqual(["Master_Data_GeoKader"]);
    expect(L.tabData().baris[0]).toContain("Kelurahan_Desa");
    expect(L.log.logger.join("\n")).toMatch(/Token\s+: 1234abcd/);

    L.panggil("pasangGeoKader");
    expect(L.root.anak.filter((f) => f.nama === "GeoKader_Database")).toHaveLength(1);
    expect(L.spreadsheet.size).toBe(1);
    expect(L.props.get("GEOKADER_TOKEN")).toBe(hasil.token);
  });

  it("token belum diatur: ditolak dengan petunjuk menjalankan pasangGeoKader", () => {
    const h = buatLingkungan({ token: null }).kirim(payload([rec("a")]));
    expect(h.sukses).toBe(false);
    expect(h.pesan).toMatch(/pasangGeoKader/);
  });

  it("token salah atau tidak ada ditolak tanpa membuat folder apa pun, dan lock tetap dilepas", () => {
    const L = buatLingkungan();
    expect(L.kirim(payload([rec("a")], { token: "salah" })).sukses).toBe(false);
    expect(L.kirim(payload([rec("a")], { token: undefined })).sukses).toBe(false);
    expect(L.root.anak).toHaveLength(0);
    expect(L.log.lockLepas).toBe(2);
  });

  it("tanpa pasangGeoKader (token diatur manual), folder induk dan spreadsheet dibuat saat data pertama masuk", () => {
    const L = buatLingkungan();
    expect(L.kirim(payload([rec("a")]))).toMatchObject({ sukses: true, diterima: ["a"], jumlah: 1 });
    expect(
      L.induk()
        .berkasAktif()
        .some((b) => b.nama === "Master_Data_GeoKader")
    ).toBe(true);
  });

  it("doGet menjawab status untuk memeriksa URL Web App", () => {
    const L = buatLingkungan();
    expect(JSON.parse(L.panggil<{ isi: string }>("doGet").isi)).toMatchObject({ sukses: true });
  });
});

describe("Code.gs: folder wilayah dan nama berkas", () => {
  it("data masuk ke Provinsi/Kabupaten/Kecamatan/Desa dengan nama akun_data_bulan_tahun", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a")]));
    const desa = desaJambi(L);
    expect(desa?.berkasAktif().map((b) => b.nama)).toEqual(["budi_sebaran_anggrek_november_2026.geojson"]);
    expect(L.isiGeojson(desa, "budi_sebaran_anggrek_november_2026.geojson")?.features.map((f) => f.id)).toEqual(["a"]);

    const [kepala, baris] = L.tabData().baris;
    const kolom = (n: string) => baris[kepala.indexOf(n)];
    expect([kolom("Provinsi"), kolom("Kabupaten_Kota"), kolom("Kecamatan"), kolom("Kelurahan_Desa")]).toEqual([
      "Jambi",
      "Kabupaten Merangin",
      "Bangko",
      "Rantau Panjang"
    ]);
    expect(kolom("Nama_Berkas")).toBe("budi_sebaran_anggrek_november_2026");
    expect(kolom("Tautan_Berkas")).toMatch(/^https:\/\/drive\.test\//);
  });

  it("objek bernama sama dari akun yang sama pada bulan yang sama dikumpulkan dalam satu berkas", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a"), rec("b")]));
    L.kirim(payload([rec("c"), rec("d", { namaKader: "Siti", namaBerkas: "siti_sebaran_anggrek_november_2026" })]));
    L.kirim(payload([rec("e", { namaBerkas: "budi_sebaran_anggrek_desember_2026" })]));
    const desa = desaJambi(L);
    expect(L.isiGeojson(desa, "budi_sebaran_anggrek_november_2026.geojson")?.features.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(L.isiGeojson(desa, "siti_sebaran_anggrek_november_2026.geojson")?.features.map((f) => f.id)).toEqual(["d"]);
    expect(L.isiGeojson(desa, "budi_sebaran_anggrek_desember_2026.geojson")?.features.map((f) => f.id)).toEqual(["e"]);
  });

  it("desa lain dalam kecamatan yang sama menjadi folder saudara; huruf besar-kecil tidak membuat folder ganda", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a")]));
    L.kirim(payload([rec("b", { wilayah: { ...JAMBI, provinsi: "JAMBI", kabupaten: "kabupaten merangin", desa: "Pulau Rengas" } })]));
    expect(L.induk().anak.map((f) => f.nama)).toEqual(["Jambi"]);
    expect(
      L.induk()
        .cari("Jambi", "Kabupaten Merangin", "Bangko")
        ?.anak.map((f) => f.nama)
    ).toEqual(["Rantau Panjang", "Pulau Rengas"]);
  });

  it("wilayah kosong masuk Wilayah_Belum_Diisi dengan nama desa lama; garis miring tidak membuat folder tambahan", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a", { wilayah: undefined, desaWilayah: "Desa A" })]));
    expect(L.induk().cari("Wilayah_Belum_Diisi", "Wilayah_Belum_Diisi", "Wilayah_Belum_Diisi", "Desa A")).toBeDefined();
    L.kirim(payload([rec("b", { wilayah: { ...JAMBI, kecamatan: "Bangko/Barat" } })]));
    expect(L.induk().cari("Jambi", "Kabupaten Merangin", "Bangko-Barat", "Rantau Panjang")).toBeDefined();
  });

  it("nama berkas dari aplikasi dibersihkan lagi; aplikasi versi lama tanpa nama berkas tetap diberi nama", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a", { namaBerkas: "../Rahasia/Budi Anggrek" })]));
    L.kirim(payload([rec("b", { namaBerkas: undefined, namaKader: "Siti Rahma", judul: "Mata Air Bukit" })]));
    expect(
      desaJambi(L)
        ?.berkasAktif()
        .map((b) => b.nama)
    ).toEqual(["rahasia_budi_anggrek.geojson", "siti_rahma_mata_air_bukit_november_2026.geojson"]);
  });
});

describe("Code.gs: penyimpanan idempoten", () => {
  it("kirim ulang memperbarui fitur dan baris yang sama, status verifikasi admin di sheet dipertahankan", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a"), rec("b")]));
    const kepala = L.tabData().baris[0];
    L.tabData().baris[1][kepala.indexOf("Status_Verifikasi")] = "Terverifikasi_Admin";
    const h = L.kirim(payload([rec("a", { judul: "Sebaran Anggrek (diperbarui)" }), rec("b")]));
    expect(h.diterima).toEqual(["a", "b"]);
    expect(L.tabData().baris).toHaveLength(3);
    expect(L.tabData().baris[1][kepala.indexOf("Status_Verifikasi")]).toBe("Terverifikasi_Admin");
    const isi = L.isiGeojson(desaJambi(L), "budi_sebaran_anggrek_november_2026.geojson");
    expect(isi?.features.map((f) => [f.id, f.properties.judul])).toEqual([
      ["a", "Sebaran Anggrek (diperbarui)"],
      ["b", "Sebaran Anggrek"]
    ]);
  });

  it("foto diunggah sekali per objek dengan nomor urut; kirim ulang tidak mengunggah lagi", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a", { fotoBase64: FOTO }), rec("b", { fotoBase64: FOTO })]));
    L.kirim(payload([rec("a", { fotoBase64: FOTO })]));
    const nama = desaJambi(L)
      ?.berkasAktif()
      .map((b) => b.nama)
      .sort();
    expect(nama).toEqual([
      "budi_sebaran_anggrek_november_2026.geojson",
      "budi_sebaran_anggrek_november_2026_foto_1.jpg",
      "budi_sebaran_anggrek_november_2026_foto_2.jpg"
    ]);
    const kepala = L.tabData().baris[0];
    expect(L.tabData().baris[1][kepala.indexOf("Tautan_Foto_Drive")]).toMatch(/^https:\/\/drive\.test\//);
  });

  it("nama data berubah: objek pindah ke berkas baru dan berkas lama yang kosong dibuang", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a"), rec("b")]));
    L.kirim(payload([rec("a", { judul: "Anggrek Hutan", namaBerkas: "budi_anggrek_hutan_november_2026" })]));
    const desa = desaJambi(L);
    expect(L.isiGeojson(desa, "budi_sebaran_anggrek_november_2026.geojson")?.features.map((f) => f.id)).toEqual(["b"]);
    expect(L.isiGeojson(desa, "budi_anggrek_hutan_november_2026.geojson")?.features.map((f) => f.id)).toEqual(["a"]);

    L.kirim(payload([rec("b", { namaBerkas: "budi_anggrek_hutan_november_2026" })]));
    expect(desa?.berkasAktif().map((b) => b.nama)).toEqual(["budi_anggrek_hutan_november_2026.geojson"]);
  });

  it("data dengan foto rusak ditolak tanpa sisa, data lain dalam kiriman yang sama tetap tersimpan", () => {
    const L = buatLingkungan();
    const h = L.kirim(payload([rec("a"), rec("rusak", { fotoBase64: "data:image/jpeg;base64,%%%" }), rec("c")]));
    expect(h).toMatchObject({ sukses: false, diterima: ["a", "c"], jumlah: 2 });
    expect((h.gagal as { id: string; pesan: string }[]).map((g) => g.id)).toEqual(["rusak"]);
    expect(L.isiGeojson(desaJambi(L), "budi_sebaran_anggrek_november_2026.geojson")?.features.map((f) => f.id)).toEqual(["a", "c"]);
    expect(L.tabData().baris).toHaveLength(3);
  });

  it("tanpa fitur GeoJSON dari aplikasi, objek tetap disimpan dengan koordinat WKT", () => {
    const L2 = buatLingkungan();
    const tanpaFitur = { ...payload([rec("x")]), geojsonBundle: "" };
    expect(L2.kirim(tanpaFitur).diterima).toEqual(["x"]);
    expect(L2.isiGeojson(desaJambi(L2), "budi_sebaran_anggrek_november_2026.geojson")?.features[0].id).toBe("x");
  });
});
