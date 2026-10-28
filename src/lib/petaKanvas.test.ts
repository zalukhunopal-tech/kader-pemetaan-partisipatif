import { describe, expect, it } from "vitest";
import { DataSpasialItem } from "../types";
import { StatePosisiPerangkat } from "./posisiPerangkat";
import {
  LapisanPeta,
  gambarLapisanPeta,
  latToTileY,
  lngToTileX,
  teksStatusGps,
  teksStatusKompas,
  tileXToLng,
  tileYToLat
} from "./petaKanvas";

/** Konteks kanvas tiruan yang mencatat setiap pemanggilan metode (arc, fillText, ...) dan pengisian properti (fillStyle, ...) */
function kanvasTiruan() {
  const catatan: { metode: string; argumen: unknown[] }[] = [];
  const nilai: Record<string | symbol, unknown> = {
    measureText: (teks: string) => ({ width: teks.length * 6 })
  };
  const ctx = new Proxy(nilai, {
    get: (t, k) => (k in t ? t[k] : (...argumen: unknown[]) => catatan.push({ metode: String(k), argumen })),
    set: (t, k, v) => {
      catatan.push({ metode: `=${String(k)}`, argumen: [v] });
      t[k] = v;
      return true;
    }
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, catatan, panggilan: (metode: string) => catatan.filter((c) => c.metode === metode) };
}

const titik = (id: string, lat: number, lng: number): DataSpasialItem => ({
  id,
  idKader: "KDR-1",
  namaKader: "Budi",
  desaWilayah: "Desa A",
  jenisGeometri: "point",
  kategori: "Flora",
  judul: "Pohon Ulin",
  deskripsi: "",
  koordinat: [{ lat, lng }],
  panjangKm: 0,
  luasHa: 0,
  statusSinkron: "lokal",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  riwayatPembaruan: []
});

const lapisanDasar = (ubah: Partial<LapisanPeta> = {}): LapisanPeta => ({
  W: 400,
  H: 600,
  zoom: 16,
  // 1 piksel = 0,0001 derajat di sekitar (-1, 100), dibulatkan ke piksel utuh
  keLayar: (lat, lng) => ({ x: Math.round(200 + (lng - 100) * 1e4), y: Math.round(300 - (lat + 1) * 1e4) }),
  dataSpasial: [],
  modeRekam: null,
  titikDraft: [],
  targetGoTo: null,
  gpsPos: null,
  ...ubah
});

const perangkat = (ubah: Partial<StatePosisiPerangkat>): StatePosisiPerangkat => ({
  statusGps: "mencari",
  posisi: null,
  statusKompas: "mencari",
  arahDerajat: null,
  ...ubah
});

describe("matematika tile Web Mercator", () => {
  it("nilai acuan: pusat dunia di tengah tile zoom 0, dan satu tile per 2^zoom", () => {
    expect(lngToTileX(0, 0)).toBeCloseTo(0.5, 12);
    expect(latToTileY(0, 0)).toBeCloseTo(0.5, 12);
    expect(lngToTileX(-180, 5)).toBe(0);
    expect(lngToTileX(180, 5)).toBe(32);
    expect(latToTileY(85.0511287798, 3)).toBeCloseTo(0, 6);
  });

  it("bolak-balik koordinat ke tile dan kembali", () => {
    for (const [lat, lng, z] of [
      [-0.9475, 100.4192, 15],
      [2.855823, 117.375968, 18],
      [-8.65, 115.2167, 11.5]
    ]) {
      expect(tileXToLng(lngToTileX(lng, z), z)).toBeCloseTo(lng, 9);
      expect(tileYToLat(latToTileY(lat, z), z)).toBeCloseTo(lat, 9);
    }
  });
});

describe("teks status sensor", () => {
  it("GPS: akurasi baik, lemah, ditolak, dan mode simulasi", () => {
    expect(teksStatusGps(perangkat({ statusGps: "aktif", posisi: { lat: 0, lng: 0, akurasi: 8 } }), false)).toEqual({
      teks: "±8 m",
      peringatan: false
    });
    expect(teksStatusGps(perangkat({ statusGps: "aktif", posisi: { lat: 0, lng: 0, akurasi: 72.4 } }), false)).toEqual({
      teks: "±72 m (lemah)",
      peringatan: true
    });
    expect(teksStatusGps(perangkat({ statusGps: "ditolak" }), false).teks).toBe("GPS ditolak");
    expect(teksStatusGps(perangkat({ statusGps: "aktif" }), true)).toEqual({ teks: "SIMULASI", peringatan: true });
    expect(teksStatusGps(perangkat({}), false)).toEqual({ teks: "Mencari GPS…", peringatan: true });
  });

  it("kompas: hanya status 'perlu izin' yang bisa diketuk", () => {
    expect(teksStatusKompas(perangkat({ statusKompas: "perlu_izin" }))).toEqual({
      teks: "Aktifkan kompas",
      peringatan: true,
      perluKetuk: true
    });
    expect(teksStatusKompas(perangkat({ statusKompas: "tidak_tersedia" })).perluKetuk).toBe(false);
    expect(teksStatusKompas(perangkat({ statusKompas: "aktif" })).peringatan).toBe(false);
  });
});

describe("gambarLapisanPeta", () => {
  it("objek titik digambar di posisi layarnya beserta label; objek terpilih diberi lingkaran sorot", () => {
    const { ctx, panggilan } = kanvasTiruan();
    gambarLapisanPeta(ctx, lapisanDasar({ dataSpasial: [titik("A", -1, 100), titik("B", -1, 100.001)], idTerpilih: "B" }));
    const lingkaran = panggilan("arc").map((c) => c.argumen.slice(0, 3));
    expect(lingkaran).toContainEqual([200, 300, 9]); // titik A
    expect(lingkaran).toContainEqual([210, 300, 16]); // sorot titik B yang terpilih
    expect(lingkaran.filter((a) => a[2] === 16)).toHaveLength(1);
    expect(panggilan("fillText").map((c) => c.argumen[0])).toEqual(["Pohon Ulin", "Pohon Ulin"]);
  });

  it("posisi GPS: lingkaran akurasi mengikuti skala peta dan dibatasi; kipas arah hanya bila kompas ada", () => {
    const gps = { lat: -1, lng: 100, akurasi: 20 };
    const radiusAkurasi = (zoom: number, kompasDerajat?: number) => {
      const { ctx, panggilan } = kanvasTiruan();
      gambarLapisanPeta(ctx, lapisanDasar({ zoom, gpsPos: gps, kompasDerajat }));
      const arc = panggilan("arc").map((c) => c.argumen[2] as number);
      return { akurasi: arc[0], kipas: arc.includes(34) };
    };
    // 20 m pada zoom 18 (±0,6 m/piksel) ≈ 33 piksel; pada zoom 12 terlalu kecil sehingga dipakai minimum 16
    expect(radiusAkurasi(18).akurasi).toBeCloseTo(20 / ((156543.03392 * Math.cos((-1 * Math.PI) / 180)) / 2 ** 18), 6);
    expect(radiusAkurasi(12).akurasi).toBe(16);
    expect(radiusAkurasi(18).kipas).toBe(false);
    expect(radiusAkurasi(18, 90).kipas).toBe(true);
  });

  it("rekaman poligon ditutup dan diisi; titik terakhir rekaman ditandai merah", () => {
    const { ctx, panggilan } = kanvasTiruan();
    const titikDraft = [
      { lat: -1, lng: 100 },
      { lat: -1.001, lng: 100 },
      { lat: -1.001, lng: 100.001 }
    ];
    gambarLapisanPeta(ctx, lapisanDasar({ modeRekam: "polygon", titikDraft }));
    expect(panggilan("closePath")).toHaveLength(1);
    expect(panggilan("=fillStyle").map((c) => c.argumen[0])).toContain("rgba(251, 191, 36, 0.28)");
    expect(panggilan("arc").filter((c) => c.argumen[2] === 6)).toHaveLength(3);
    expect(panggilan("=fillStyle").filter((c) => c.argumen[0] === "#ef4444")).toHaveLength(1);
  });

  it("garis Go-To hanya digambar bila posisi GPS sudah ada", () => {
    const target = { lat: -1.002, lng: 100.002 };
    const tanpaGps = kanvasTiruan();
    gambarLapisanPeta(tanpaGps.ctx, lapisanDasar({ targetGoTo: target }));
    expect(tanpaGps.panggilan("setLineDash")).toHaveLength(0);

    const denganGps = kanvasTiruan();
    gambarLapisanPeta(denganGps.ctx, lapisanDasar({ targetGoTo: target, gpsPos: { lat: -1, lng: 100 } }));
    expect(denganGps.panggilan("setLineDash").map((c) => c.argumen[0])).toContainEqual([6, 6]);
  });
});
