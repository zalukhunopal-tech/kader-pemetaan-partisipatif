import { describe, expect, it } from "vitest";
import {
  hitungRataRataGps,
  sederhanakanJalurDouglasPeucker,
  validasiGeometri,
  wktUntukSpreadsheet,
  buatEditorVertex,
  snapKeVertex
} from "./geoUtils";
import { hitungSkorKualitasData } from "./kualitasData";
import { hitungBukuHok, KONFIGURASI_HOK_CONTOH, eksporHokCSV, eksporHokPDF } from "./hok";
import { titikJalurDapatDiterima } from "./filterJalur";
import { DataSpasialItem } from "../types";
import { terapkanHasilSinkron, fingerprintData } from "./gdriveBertahap";

const data = (o: Partial<DataSpasialItem> = {}): DataSpasialItem => ({
  id: "a",
  idKader: "k",
  namaKader: "Kader",
  desaWilayah: "Desa",
  jenisGeometri: "point",
  kategori: "Flora",
  judul: "Pohon",
  namaLokal: "Beringin",
  deskripsi: "Pohon besar",
  koordinat: [{ lat: 0, lng: 100, akurasi: 4 }],
  panjangKm: 0,
  luasHa: 0,
  statusSinkron: "terverifikasi",
  createdAt: "2026-11-01T01:00:00Z",
  updatedAt: "2026-11-01T01:00:00Z",
  riwayatPembaruan: [],
  fotoBase64: "data:image/jpeg;base64,QQ==",
  buktiFoto: { posisi: { lat: 0, lng: 100 }, idKader: "k", desa: "Desa", diambilPada: "2026-11-01T01:00:00Z", stampVisual: false },
  ...o
});

describe("GPS, geometri dan audit", () => {
  it("membobot akurasi, menolak fix rusak dan tidak memalsukan elevasi", () => {
    const h = hitungRataRataGps([
      { lat: 0, lng: 100, akurasi: 2 },
      { lat: 0, lng: 100.001, akurasi: 10 },
      { lat: NaN, lng: 100, akurasi: 1 }
    ]);
    expect(h.titik.lng).toBeCloseTo(100 + 0.001 / 26, 7);
    expect(h.jumlahSampel).toBe(2);
    expect(h.titik.elevasi).toBeUndefined();
    expect(() => hitungRataRataGps([{ lat: 0, lng: 0, akurasi: 0 }])).toThrow();
  });
  it("averaging dan RDP melintasi antimeridian", () => {
    expect(
      Math.abs(
        hitungRataRataGps([
          { lat: 0, lng: 179.999, akurasi: 4 },
          { lat: 0, lng: -179.999, akurasi: 4 }
        ]).titik.lng
      )
    ).toBeCloseTo(180, 4);
    expect(
      sederhanakanJalurDouglasPeucker(
        [
          { lat: 0, lng: 179.9 },
          { lat: 0, lng: 180 },
          { lat: 0, lng: -179.9 }
        ],
        2
      )
    ).toHaveLength(2);
  });
  it("RDP mempertahankan belokan dan metadata titik, tanpa mengubah track asli", () => {
    const k = [
      { lat: 0, lng: 100, timestamp: "awal" },
      { lat: 0, lng: 100.001 },
      { lat: 0.001, lng: 100.001 },
      { lat: 0.002, lng: 100.001, timestamp: "akhir" }
    ];
    const h = sederhanakanJalurDouglasPeucker(k, 2);
    expect(h).toHaveLength(3);
    expect(h[0]).toBe(k[0]);
    expect(h.at(-1)?.timestamp).toBe("akhir");
    expect(k).toHaveLength(4);
  });
  it("mendeteksi angka delapan dan sentuhan non-adjacent; menerima ring tertutup", () => {
    expect(
      validasiGeometri("polygon", [
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 0 }
      ])
    ).not.toEqual([]);
    expect(
      validasiGeometri("polygon", [
        { lat: 0, lng: 179.9 },
        { lat: 0, lng: -179.9 },
        { lat: 1, lng: -179.9 },
        { lat: 1, lng: 179.9 },
        { lat: 0, lng: 179.9 }
      ])
    ).toEqual([]);
  });
  it("WKT panjang aman tanpa memangkas geometri sumber", () => {
    const koordinat = Array.from({ length: 4000 }, (_, i) => ({ lat: i * 0.000001, lng: 100 }));
    const d = data({ jenisGeometri: "line", koordinat });
    const h = wktUntukSpreadsheet(d);
    expect(h.geometriEksternal).toBe(true);
    expect(h.wkt.length).toBeLessThan(40000);
    expect(d.koordinat).toHaveLength(4000);
  });
  it("undo redo bercabang dan snap hanya dalam toleransi", () => {
    const e = buatEditorVertex([{ lat: 0, lng: 100 }]);
    e.ubah([{ lat: 1, lng: 100 }]);
    e.undo();
    e.redo();
    expect(e.titik()[0].lat).toBe(1);
    e.undo();
    e.ubah([{ lat: 2, lng: 100 }]);
    e.redo();
    expect(e.titik()[0].lat).toBe(2);
    expect(snapKeVertex({ lat: 0, lng: 100.00001 }, [{ lat: 0, lng: 100 }], 2).lng).toBe(100);
  });
  it("DQA tidak menyamakan URL Drive dengan foto geotag dan tidak meluluskan geometri invalid", () => {
    expect(hitungSkorKualitasData(data()).skor).toBe(100);
    expect(hitungSkorKualitasData(data({ buktiFoto: undefined, driveFileUrl: "https://drive.test/a" })).rincian.fotoGeotag).toBe(0);
    expect(hitungSkorKualitasData(data({ koordinat: [] })).grade).toBe("D");
    expect(hitungSkorKualitasData(data({ diimpor: true })).rincian.gps).toBe(0);
  });
  it("lonjakan multipath dan fix mundur ditolak", () => {
    const a = { lat: 0, lng: 100, akurasi: 4, timestamp: "2026-11-01T00:00:00Z" };
    expect(titikJalurDapatDiterima(a, { ...a, lat: 1, timestamp: "2026-11-01T00:00:01Z" })).toBe(false);
    expect(titikJalurDapatDiterima(a, { ...a, lat: 0.00005, timestamp: "2026-11-01T00:00:01Z" })).toBe(true);
  });
});

describe("HOK transparan", () => {
  const sesi = {
    id: "patroli",
    idKader: "k",
    mulai: "2026-11-01T16:00:00Z",
    selesai: "2026-11-01T18:00:00Z",
    kmMedanBerat: 2,
    terverifikasi: true
  };
  it("membagi patroli melewati tengah malam desa dan menampilkan batas rumus", () => {
    const h = hitungBukuHok([data()], [sesi], {
      ...KONFIGURASI_HOK_CONTOH,
      bonusTitikGradeA: 0.2,
      hokPerKmMedanBerat: 0.5,
      batasHokPerHari: 0.5
    });
    expect(h).toHaveLength(2);
    expect(h.map((b) => b.menitEfektif)).toEqual([60, 60]);
    expect(h.map((b) => b.kmMedanBerat)).toEqual([1, 1]);
    expect(h[0].totalHok).toBe(0.5);
    expect(h[0].hokSebelumBatas).toBeCloseTo(0.825);
  });
  it("menolak jam ganda dan tidak menghitung simulasi/data belum terverifikasi", () => {
    expect(() => hitungBukuHok([], [sesi, { ...sesi, id: "ganda" }], KONFIGURASI_HOK_CONTOH)).toThrow(/tumpang tindih/);
    expect(hitungBukuHok([data({ statusSinkron: "lokal" })], [{ ...sesi, simulasi: true }], KONFIGURASI_HOK_CONTOH)).toEqual([]);
  });
  it("ekspor CSV menetralkan formula dan PDF dapat dibuka", async () => {
    const h = hitungBukuHok([data({ idKader: "=CMD", buktiFoto: { ...data().buktiFoto!, idKader: "=CMD" } })], [], KONFIGURASI_HOK_CONTOH);
    expect(eksporHokCSV(h)).toContain("'=CMD");
    const pdf = await eksporHokPDF(h);
    expect(new TextDecoder().decode(pdf.slice(0, 4))).toBe("%PDF");
  });
});

it("konfirmasi upload tidak menandai edit baru sebagai tersinkron", () => {
  const d = data({ statusSinkron: "lokal" });
  const h = {
    sukses: true,
    pesan: "",
    idTersinkron: [d.id],
    jumlahGagal: 0,
    konfirmasi: [{ id: d.id, revisiServer: "rev", fingerprint: fingerprintData(d) }]
  };
  expect(terapkanHasilSinkron([d], h)[0].statusSinkron).toBe("tersinkron");
  expect(terapkanHasilSinkron([{ ...d, deskripsi: "edit saat upload" }], h)[0]).toMatchObject({
    statusSinkron: "lokal",
    revisiServer: "rev"
  });
});
