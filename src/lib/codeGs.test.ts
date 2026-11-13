import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { sinkronkanBertahapKeGDrive, selesaikanKonflik } from "./gdriveBertahap";
import { DataSpasialItem } from "../types";

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
    getBlob = () => ({ getDataAsString: () => this.isi, getBytes: () => Buffer.from(this.isi) });
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
    setTrashed = (v: boolean) => {
      this.trashed = v;
    };
    getFoldersByName = (n: string) => iter(this.anak.filter((f) => f.nama === n && !f.trashed));
    getFolders = () => iter(this.anak.filter((f) => !f.trashed));
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
    catatan: string[][] = [];
    nama = "Sheet1";
    setName(n: string) {
      this.nama = n;
    }
    appendRow(r: Baris) {
      this.baris.push([...r]);
      this.catatan.push(new Array(r.length).fill(""));
    }
    getLastRow() {
      return this.baris.length;
    }
    getRange(r: number, c: number, nr = 1, nc = 1) {
      const baris = this.baris;
      const catatan = this.catatan;
      return {
        getValues: () =>
          Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (baris[r - 1 + i] || [])[c - 1 + j] ?? "")),
        setValues: (v: Baris[]) => {
          v.forEach((row, i) => {
            baris[r - 1 + i] = [...row];
          });
        },
        getNotes: () =>
          Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (catatan[r - 1 + i] || [])[c - 1 + j] ?? "")),
        setNote: (note: string) => {
          if (!catatan[r - 1]) catatan[r - 1] = [];
          catatan[r - 1][c - 1] = note;
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
  const props = new Map<string, string>(token ? [["TITIK_TAPAK_TOKEN", token]] : []);
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
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_algorithm: string, bytes: Buffer) => [...createHash("sha256").update(Buffer.from(bytes)).digest()],
      newBlob: (input: Buffer | number[] | string, tipe: string, nama: string) => {
        const bytes = typeof input === "string" ? Buffer.from(input) : Buffer.from(input);
        return { nama, tipe, bytes, getBytes: () => bytes, getDataAsString: () => bytes.toString("utf8") };
      }
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
  const induk = () => root.cari("Titik_Tapak_Database")!;
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
  it("pasangTitikTapak membuat folder induk, spreadsheet di dalamnya, dan token; dijalankan ulang tidak menggandakan", () => {
    const L = buatLingkungan({ token: null });
    const hasil = L.panggil<{ token: string; folder: string; spreadsheet: string }>("pasangTitikTapak");
    expect(hasil.token).toBe("1234abcd000040008000" + "0000000000ff");
    expect(L.props.get("TITIK_TAPAK_TOKEN")).toBe(hasil.token);
    expect(L.induk()).toBeDefined();
    expect(
      L.induk()
        .berkasAktif()
        .map((b) => b.nama)
    ).toEqual(["Master_Data_Titik_Tapak"]);
    expect(L.tabData().baris[0]).toContain("Kelurahan_Desa");
    expect(L.log.logger.join("\n")).toMatch(/Token\s+: 1234abcd/);

    L.panggil("pasangTitikTapak");
    expect(L.root.anak.filter((f) => f.nama === "Titik_Tapak_Database")).toHaveLength(1);
    expect(L.spreadsheet.size).toBe(1);
    expect(L.props.get("TITIK_TAPAK_TOKEN")).toBe(hasil.token);
  });

  it("token belum diatur: ditolak dengan petunjuk menjalankan pasangTitikTapak", () => {
    const h = buatLingkungan({ token: null }).kirim(payload([rec("a")]));
    expect(h.sukses).toBe(false);
    expect(h.pesan).toMatch(/pasangTitikTapak/);
  });

  it("token salah atau tidak ada ditolak tanpa membuat folder apa pun, dan lock tetap dilepas", () => {
    const L = buatLingkungan();
    expect(L.kirim(payload([rec("a")], { token: "salah" })).sukses).toBe(false);
    expect(L.kirim(payload([rec("a")], { token: undefined })).sukses).toBe(false);
    expect(L.root.anak).toHaveLength(0);
    expect(L.log.lockLepas).toBe(2);
  });

  it("tanpa pasangTitikTapak (token diatur manual), folder induk dan spreadsheet dibuat saat data pertama masuk", () => {
    const L = buatLingkungan();
    expect(L.kirim(payload([rec("a")]))).toMatchObject({ sukses: true, diterima: ["a"], jumlah: 1 });
    expect(
      L.induk()
        .berkasAktif()
        .some((b) => b.nama === "Master_Data_Titik_Tapak")
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

describe("Code.gs: penyimpanan idempoten dan pengamanan (hardening)", () => {
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
    expect(isi?.features.map((f) => [f.id, f.properties.label])).toEqual([
      ["a", "Sebaran Anggrek (diperbarui)"],
      ["b", "Sebaran Anggrek"]
    ]);
  });

  it("menolak penimpaan ID data milik kader lain (anti-IDOR) dan tidak menghapus berkas pemilik asli", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a", { idKader: "KDR-1", namaKader: "Budi" })]));
    const serang = L.kirim(
      payload([rec("a", { idKader: "KDR-PENYERANG", namaKader: "Penyerang", namaBerkas: "penyerang_palsu_november_2026" })])
    );
    expect(serang.sukses).toBe(false);
    expect(serang.diterima).toEqual([]);
    expect((serang.gagal as { id: string; pesan: string }[])[0].pesan).toMatch(/milik kader lain/);
    const kepala = L.tabData().baris[0];
    expect(L.tabData().baris[1][kepala.indexOf("ID_Kader")]).toBe("KDR-1");
  });

  it("menetralkan injeksi formula spreadsheet (=, +, -, @) dengan tanda kutip tunggal", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("a", { judul: '=IMPORTXML("https://jahat.tld","//a")', namaLokal: "+SUM(A1:A2)" })]));
    const [kepala, baris] = L.tabData().baris;
    expect(baris[kepala.indexOf("Judul")]).toBe('\'=IMPORTXML("https://jahat.tld","//a")');
    expect(baris[kepala.indexOf("Nama_Lokal")]).toBe("'+SUM(A1:A2)");
  });

  it("menolak foto yang melebihi batas 2 MB", () => {
    const L = buatLingkungan();
    const besar = "data:image/jpeg;base64," + Buffer.alloc(2 * 1024 * 1024 + 10, 0x41).toString("base64");
    const h = L.kirim(payload([rec("terlalu-besar", { fotoBase64: besar })]));
    expect(h.sukses).toBe(false);
    expect((h.gagal as { id: string; pesan: string }[])[0].pesan).toMatch(/melebihi batas 2 MB/);
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

const dataV3 = (id: string, extra: Partial<DataSpasialItem> = {}): DataSpasialItem => ({
  ...rec(id),
  jenisGeometri: "point",
  kategori: "Flora",
  koordinat: [{ lat: -2.1, lng: 102.1, akurasi: 4 }],
  statusSinkron: "lokal",
  riwayatPembaruan: [],
  deskripsi: "Survei lapangan",
  ...extra
});
function transportV3(L: ReturnType<typeof buatLingkungan>, catat: string[] = []) {
  return (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    catat.push(body.action);
    return new Response(JSON.stringify(L.kirim(body)), { status: 200 });
  }) as typeof fetch;
}
const koneksiV3 = { url: "https://script.google.com/macros/s/test/exec", token: "rahasia" };

describe("protokol 3: integrasi browser dan Apps Script", () => {
  it("mengirim semua metadata sebelum media, membatasi 50 KB dan menyimpan ulang secara idempoten", async () => {
    const L = buatLingkungan(),
      actions: string[] = [],
      ukuran: number[] = [];
    const base = transportV3(L, actions),
      transport = (async (u: Parameters<typeof fetch>[0], i?: RequestInit) => {
        ukuran.push(Buffer.byteLength(String(i?.body)));
        return base(u, i);
      }) as typeof fetch;
    const d = dataV3("v3-a", { fotoBase64: "data:image/jpeg;base64," + Buffer.alloc(60000, 65).toString("base64") });
    const opts = { koneksi: koneksiV3, transport, tunggu: async () => {}, sekarang: () => Date.now() + 1000000 };
    const h = await sinkronkanBertahapKeGDrive([d, dataV3("v3-b")], opts);
    expect(h.sukses).toBe(true);
    expect(h.idTersinkron).toEqual(["v3-a", "v3-b"]);
    expect(actions.slice(0, 3)).toEqual(["sync_capabilities", "sync_metadata_v3", "sync_metadata_v3"]);
    expect(Math.max(...ukuran)).toBeLessThanOrEqual(50000);
    const ulang = await sinkronkanBertahapKeGDrive([d], opts);
    expect(ulang.sukses).toBe(true);
    expect(L.tabData().baris).toHaveLength(3);
    expect(
      desaJambi(L)
        ?.berkasAktif()
        .filter((b) => b.nama.endsWith(".jpg"))
    ).toHaveLength(1);
  });
  it("melanjutkan chunk dari server setelah jaringan terputus tanpa kirim ulang chunk yang sudah diterima", async () => {
    const L = buatLingkungan(),
      d = dataV3("v3-resume", { fotoBase64: "data:image/jpeg;base64," + Buffer.alloc(60000, 66).toString("base64") });
    const base = transportV3(L);
    let putus = true;
    const transport = (async (u: Parameters<typeof fetch>[0], i?: RequestInit) => {
      const b = JSON.parse(String(i?.body));
      if (putus && b.action === "sync_chunk_v3" && b.indeks === 1) throw new TypeError("offline");
      return base(u, i);
    }) as typeof fetch;
    const opts = { koneksi: koneksiV3, transport, tunggu: async () => {}, sekarang: () => Date.now() + 1000000 };
    expect((await sinkronkanBertahapKeGDrive([d], opts)).sukses).toBe(false);
    putus = false;
    const terkirim: number[] = [];
    const pulih = (async (u: Parameters<typeof fetch>[0], i?: RequestInit) => {
      const b = JSON.parse(String(i?.body));
      if (b.action === "sync_chunk_v3") terkirim.push(b.indeks);
      return base(u, i);
    }) as typeof fetch;
    const h = await sinkronkanBertahapKeGDrive([d], { ...opts, transport: pulih, sekarang: () => Date.now() + 2000000 });
    expect(h.sukses).toBe(true);
    expect(terkirim).not.toContain(0);
    expect(terkirim).toContain(1);
  });
  it("revisi admin memunculkan konflik; resolusi lokal eksplisit mempertahankan catatan admin", async () => {
    const L = buatLingkungan(),
      d = dataV3("v3-konflik"),
      opts = { koneksi: koneksiV3, transport: transportV3(L), tunggu: async () => {}, sekarang: () => Date.now() + 3000000 };
    const pertama = await sinkronkanBertahapKeGDrive([d], opts);
    expect(pertama.sukses).toBe(true);
    const [kepala, baris] = L.tabData().baris;
    baris[kepala.indexOf("Status_Verifikasi")] = "Ditolak";
    baris[kepala.indexOf("Catatan_Admin")] = "Periksa batas utara";
    const lokal = { ...d, revisiServer: pertama.konfirmasi![0].revisiServer, deskripsi: "Edit offline" };
    const h = await sinkronkanBertahapKeGDrive([lokal], opts);
    expect(h.idTersinkron).toEqual([]);
    expect(h.konflik).toHaveLength(1);
    const k = h.konflik![0];
    expect(k.server.catatanAdmin).toBe("Periksa batas utara");
    expect(selesaikanKonflik(k, "admin").statusSinkron).toBe("ditolak");
    expect(() => selesaikanKonflik(k, "gabungkan")).toThrow(/eksplisit/);
    const resolusi = selesaikanKonflik(k, "lokal");
    expect(resolusi.catatanAdmin).toBe("Periksa batas utara");
    expect((await sinkronkanBertahapKeGDrive([resolusi], opts)).sukses).toBe(true);
    expect(baris[kepala.indexOf("Status_Verifikasi")]).toBe("Ditolak");
  });
  it("checksum chunk rusak ditolak dan tidak membuat data seolah tersinkron", async () => {
    const L = buatLingkungan(),
      base = transportV3(L);
    const transport = (async (u: Parameters<typeof fetch>[0], i?: RequestInit) => {
      const b = JSON.parse(String(i?.body));
      if (b.action === "sync_chunk_v3") b.checksum = "0".repeat(64);
      return base(u, { ...i, body: JSON.stringify(b) });
    }) as typeof fetch;
    const h = await sinkronkanBertahapKeGDrive([dataV3("v3-rusak")], {
      koneksi: koneksiV3,
      transport,
      tunggu: async () => {},
      sekarang: () => Date.now() + 4000000
    });
    expect(h.sukses).toBe(false);
    expect(h.idTersinkron).toEqual([]);
    expect(L.tabData().baris).toHaveLength(1);
  });
  it("server versi lama ditolak sebelum mengirim data", async () => {
    let panggilan = 0;
    const h = await sinkronkanBertahapKeGDrive([dataV3("v3-old")], {
      koneksi: koneksiV3,
      transport: (async () => {
        panggilan++;
        return new Response(JSON.stringify({ diterima: [], jumlah: 0 }));
      }) as typeof fetch
    });
    expect(panggilan).toBe(1);
    expect(h.pesan).toMatch(/Perbarui deployment/);
    expect(h.idTersinkron).toEqual([]);
  });
  it("WKT legacy >40000 dirujuk ke GeoJSON tanpa kehilangan koordinat", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("overflow", { wkt: "LINESTRING(" + "102.1 -2.1,".repeat(5000) + "102.1 -2.1)" })]));
    const [kolom, row] = L.tabData().baris;
    expect(row[kolom.indexOf("Koordinat_WKT")]).toMatch(/^GEOMETRI_DI_GEOJSON: https:/);
  });
});

describe("Code.gs: tabel atribut PRM-AID & automasi migrasi folder wilayah", () => {
  it("menyimpan berkas GeoJSON dengan tabel atribut PRM-AID murni (Polygon, Line, Point) dan mengisi url foto Drive", () => {
    const L = buatLingkungan();
    const rPoint = rec("pt-1", {
      jenisGeometri: "point",
      kategori: "Sarana Desa",
      judul: "Gereja Santo Petrus",
      deskripsi: "Gereja pusat desa",
      fotoBase64: FOTO
    });
    const rLine = rec("ln-1", {
      jenisGeometri: "line",
      kategori: "Sarana Desa",
      judul: "Jembatan Gantung Sungai",
      deskripsi: "Jembatan penghubung dusun",
      panjangKm: 0.125,
      namaBerkas: "budi_jembatan_november_2026"
    });
    const rPoly = rec("pg-1", {
      jenisGeometri: "polygon",
      kategori: "Wilayah Adat / Lahan",
      judul: "Hutan Lindung Adat",
      deskripsi: "Kawasan lindung desa",
      luasHa: 48.75,
      namaBerkas: "budi_hutan_lindung_november_2026"
    });

    const h = L.kirim({
      token: "rahasia",
      records: [rPoint, rLine, rPoly],
      geojsonBundle: JSON.stringify({
        type: "FeatureCollection",
        features: [
          { type: "Feature", id: "pt-1", geometry: { type: "Point", coordinates: [102.1, -2.1] }, properties: {} },
          {
            type: "Feature",
            id: "ln-1",
            geometry: { type: "LineString", coordinates: [[102.1, -2.1], [102.11, -2.11]] },
            properties: {}
          },
          {
            type: "Feature",
            id: "pg-1",
            geometry: {
              type: "Polygon",
              coordinates: [[[102.1, -2.1], [102.12, -2.1], [102.12, -2.12], [102.1, -2.12], [102.1, -2.1]]]
            },
            properties: {}
          }
        ]
      })
    });
    expect(h.sukses).toBe(true);

    const desa = desaJambi(L);
    const geoPt = L.isiGeojson(desa, "budi_sebaran_anggrek_november_2026.geojson")!.features[0].properties;
    expect(Object.keys(geoPt)).toEqual(["label", "kategori", "keterangan", "url", "simbol"]);
    expect(geoPt).toMatchObject({
      label: "Gereja Santo Petrus",
      kategori: "Agama",
      keterangan: "Gereja pusat desa",
      simbol: "church.png"
    });
    expect(String(geoPt.url)).toMatch(/^https:\/\/drive\.test\//);

    const geoLn = L.isiGeojson(desa, "budi_jembatan_november_2026.geojson")!.features[0].properties;
    expect(Object.keys(geoLn)).toEqual(["label", "panjang_m", "keterangan", "url", "warna"]);
    expect(geoLn).toEqual({
      label: "Jembatan Gantung Sungai",
      panjang_m: 125,
      keterangan: "Jembatan penghubung dusun",
      url: "",
      warna: "#00BFFF"
    });

    const geoPg = L.isiGeojson(desa, "budi_hutan_lindung_november_2026.geojson")!.features[0].properties;
    expect(Object.keys(geoPg)).toEqual(["label", "luas_ha", "keterangan", "url", "tepi", "warna"]);
    expect(geoPg).toEqual({
      label: "Hutan Lindung Adat",
      luas_ha: 48.75,
      keterangan: "Kawasan lindung desa",
      url: "",
      tepi: "Transparent",
      warna: "#02AD00"
    });
  });

  it("otomatis memindahkan berkas lama dari Wilayah_Belum_Diisi ketika kader mengirim data dengan wilayah lengkap", () => {
    const L = buatLingkungan();
    // 1. Rekaman awal tanpa wilayah lengkap -> masuk Wilayah_Belum_Diisi
    L.kirim(payload([rec("lama-1", { wilayah: undefined, desaWilayah: "Indonesia", fotoBase64: FOTO })]));
    const folderBelumDiisi = L.induk().cari(
      "Wilayah_Belum_Diisi",
      "Wilayah_Belum_Diisi",
      "Wilayah_Belum_Diisi",
      "Indonesia"
    );
    expect(folderBelumDiisi?.berkasAktif()).toHaveLength(2); // 1 geojson + 1 foto

    // 2. Rekaman berikutnya dari kader yang sama dengan wilayah lengkap -> otomatis migrasi
    L.kirim(payload([rec("baru-2", { wilayah: JAMBI, namaBerkas: "budi_data_baru_november_2026" })]));

    expect(folderBelumDiisi?.berkasAktif()).toHaveLength(0);
    expect(folderBelumDiisi?.isTrashed()).toBe(true);
    const desaBaru = desaJambi(L);
    expect(desaBaru?.berkasAktif().map((b) => b.nama).sort()).toEqual([
      "budi_data_baru_november_2026.geojson",
      "budi_sebaran_anggrek_november_2026.geojson",
      "budi_sebaran_anggrek_november_2026_foto_1.jpg"
    ]);

    const [kepala, baris1] = L.tabData().baris;
    expect([
      baris1[kepala.indexOf("Provinsi")],
      baris1[kepala.indexOf("Kabupaten_Kota")],
      baris1[kepala.indexOf("Kecamatan")],
      baris1[kepala.indexOf("Kelurahan_Desa")]
    ]).toEqual(["Jambi", "Kabupaten Merangin", "Bangko", "Rantau Panjang"]);
  });

  it("mendukung aksi eksplisit rename_wilayah_folder untuk mengubah nama folder wilayah di server Google Drive", () => {
    const L = buatLingkungan();
    L.kirim(payload([rec("m-1", { wilayah: undefined, desaWilayah: "Kantor Balai Spasial", fotoBase64: FOTO })]));

    const KALTARA = {
      provinsi: "Kalimantan Utara",
      kabupaten: "Kabupaten Bulungan",
      kecamatan: "Tanjung Selor",
      desa: "Tanjung Selor Hilir"
    };
    const hasil = L.kirim({
      token: "rahasia",
      action: "rename_wilayah_folder",
      idKader: "KDR-1",
      wilayahLama: { desaWilayah: "Kantor Balai Spasial" },
      wilayahBaru: KALTARA
    });

    expect(hasil).toMatchObject({
      sukses: true,
      berkasDipindahkan: 2,
      barisDiperbarui: 1
    });
    const folderTujuan = L.induk().cari(
      "Kalimantan Utara",
      "Kabupaten Bulungan",
      "Tanjung Selor",
      "Tanjung Selor Hilir"
    );
    expect(folderTujuan?.berkasAktif().map((b) => b.nama).sort()).toEqual([
      "budi_sebaran_anggrek_november_2026.geojson",
      "budi_sebaran_anggrek_november_2026_foto_1.jpg"
    ]);
  });

  it("menyiapkan dan mengisi tab Polygon, Line, dan Point di spreadsheet induk sesuai standar atribut tabel PRM-AID", () => {
    const L = buatLingkungan();
    const poly = rec("pg-1", {
      jenisGeometri: "polygon",
      kategori: "Wilayah Adat / Lahan",
      judul: "Area Perkebunan Desa",
      deskripsi: "Kebun pangan",
      luasHa: 12.5,
      wkt: "POLYGON ((102.1 -2.1, 102.2 -2.1, 102.2 -2.2, 102.1 -2.1))"
    });
    const line = rec("ln-1", {
      jenisGeometri: "line",
      kategori: "Sarana Desa",
      judul: "Jalan Utama",
      deskripsi: "Akses jalan warga",
      panjangKm: 1.25,
      wkt: "LINESTRING (102.1 -2.1, 102.2 -2.2)"
    });
    const pt = rec("pt-1", {
      jenisGeometri: "point",
      kategori: "Agama",
      judul: "Masjid Raya",
      deskripsi: "Tempat ibadah",
      wkt: "POINT (102.1 -2.1)"
    });

    const hasil = L.kirim(payload([poly, line, pt]));
    expect(hasil.sukses).toBe(true);

    const ss = [...L.spreadsheet.values()][0];
    const tabPolygon = ss.getSheetByName("Polygon");
    const tabLine = ss.getSheetByName("Line");
    const tabPoint = ss.getSheetByName("Point");

    expect(tabPolygon).toBeTruthy();
    expect(tabLine).toBeTruthy();
    expect(tabPoint).toBeTruthy();

    // Verifikasi header tabel atribut
    expect(tabPolygon?.baris[0]).toEqual(["label", "luas_ha", "keterangan", "url", "tepi", "warna"]);
    expect(tabLine?.baris[0]).toEqual(["label", "panjang_m", "keterangan", "url", "warna"]);
    expect(tabPoint?.baris[0]).toEqual(["label", "kategori", "keterangan", "url", "simbol"]);

    // Verifikasi baris data yang dihasilkan
    expect(tabPolygon?.baris[1]).toEqual(["Area Perkebunan Desa", 12.5, "Kebun pangan", "", "#000000", "#00B050"]);
    expect(tabLine?.baris[1]).toEqual(["Jalan Utama", 1250, "Akses jalan warga", "", "#FF0000"]);
    expect(tabPoint?.baris[1]).toEqual(["Masjid Raya", "Agama", "Tempat ibadah", "", "mosque.png"]);
  });
});
