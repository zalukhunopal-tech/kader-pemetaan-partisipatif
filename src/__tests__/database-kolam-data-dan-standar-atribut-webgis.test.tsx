// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSyncView } from "../components/DatabaseSyncView";
import { AdminDashboardView } from "../components/AdminDashboardView";
import { PengaturanEksporView } from "../components/PengaturanEksporView";
import { eksporKeCSV, eksporKeGeoJSON, eksporKeKML } from "../lib/geoUtils";
import { bangunShapefileTunggal, buatArsipZip, eksporPaketShapefile } from "../lib/shapefile";
import { sinkronkanLapisanDariTugas } from "../lib/skemaTugas";
import { setelUlangPenyimpananUntukUji } from "../lib/penyimpanan";
import { DataSpasialItem, ProfilKader, TugasPemetaan } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PROFIL_UJI: ProfilKader = {
  idKader: "KDR-KRAYAN-01",
  nama: "Kader Krayan",
  desaWilayah: "Pa' Padi",
  kelompokMasyarakat: "KTH Krayan",
  noHp: "081200001122",
  namaOrganisasi: "Titik Tapak",
  modeKombinasiTarget: "per_kategori"
};

const TUGAS_ANGGREK: TugasPemetaan = {
  id: "TSK-ANGGREK-99",
  judul: "Inventarisasi Anggrek Krayan",
  deskripsi: "Format tugas Inventarisasi Anggrek Krayan (Point) dengan 3 isian data.",
  targetWilayah: "Seluruh Wilayah",
  jenisTargetGeometri: "point",
  tipeGeometriDiizinkan: ["point"],
  targetKuantitas: "3 isian data",
  batasWaktu: "-",
  koordinatAcuan: { lat: 3.8163916, lng: 115.746927 },
  status: "aktif",
  dibuatOleh: "Admin GIS",
  targetKader: ["*"],
  skemaGeometri: {
    point: [
      { id: "F1", nama: "Nama Jenis Anggrek", tabel: "Data Point", tipe: "teks", wajib: true },
      { id: "F2", nama: "Tinggi Pohon Inang", tabel: "Data Point", tipe: "angka", wajib: false },
      { id: "F3", nama: "Nilai Ekonomi", tabel: "Data Point", tipe: "nominal", wajib: false }
    ],
    line: [],
    polygon: [],
    daftarTabel: { point: ["Data Point"], line: [], polygon: [] }
  }
};

const ITEM_POINT_TUGAS: DataSpasialItem = {
  id: "SPS-PT-01",
  idKader: PROFIL_UJI.idKader,
  namaKader: PROFIL_UJI.nama,
  desaWilayah: "Pa' Padi",
  jenisGeometri: "point",
  kategori: "Lainnya",
  lapisanId: "LAP-TGS-TSK-ANGGREK-99",
  lapisanNama: "Inventarisasi Anggrek Krayan",
  tugasId: "TSK-ANGGREK-99",
  judul: "Anggrek Hitam Spot 01",
  deskripsi: "Tumbuh sehat di batang meranti",
  simbol: "Merah", // corak UI yang sebelumnya sempat bocor ke simbol WebGIS
  warna: "#ef4444",
  koordinat: [{ lat: 3.8163916123, lng: 115.7469270456 }],
  panjangKm: 0,
  luasHa: 0,
  atributKustom: {
    "Nama Jenis Anggrek": "Coelogyne pandurata",
    "Tinggi Pohon Inang": "14",
    "Nilai Ekonomi": "Rp 250.000"
  },
  statusSinkron: "lokal",
  createdAt: "2026-11-19T08:00:00.000Z",
  updatedAt: "2026-11-19T08:00:00.000Z",
  riwayatPembaruan: []
};

const ITEM_LINE_SURVEI: DataSpasialItem = {
  id: "SPS-LN-01",
  idKader: PROFIL_UJI.idKader,
  namaKader: PROFIL_UJI.nama,
  desaWilayah: "Pa' Padi",
  jenisGeometri: "line",
  kategori: "Sarana Desa",
  lapisanNama: "Jalan Lokal",
  judul: "Jalan Lokal Pa' Padi",
  deskripsi: "Digitasi kader, November 2026",
  warna: "#FF0000",
  koordinat: [
    { lat: 3.9063084, lng: 115.7012307 },
    { lat: 3.9031, lng: 115.7055 },
    { lat: 3.8995082, lng: 115.7095739 }
  ],
  panjangKm: 1.196,
  luasHa: 0,
  statusSinkron: "lokal",
  createdAt: "2026-11-19T08:05:00.000Z",
  updatedAt: "2026-11-19T08:05:00.000Z",
  riwayatPembaruan: []
};

const ITEM_POLYGON_KECIL: DataSpasialItem = {
  id: "SPS-PG-01",
  idKader: PROFIL_UJI.idKader,
  namaKader: PROFIL_UJI.nama,
  desaWilayah: "Pa' Padi",
  jenisGeometri: "polygon",
  kategori: "Wilayah Adat / Lahan",
  lapisanNama: "Petak Sawah",
  judul: "Petak Sawah Adan",
  deskripsi: "Sawah irigasi desa",
  warna: "rgba(0, 180, 80, 0.5)", // nilai invalid untuk WebGIS -> harus dinormalisasi!
  tepi: "Transparent", // huruf kapital -> harus menjadi "transparent" huruf kecil!
  koordinat: [
    { lat: 3.9, lng: 115.7 },
    { lat: 3.9, lng: 115.7005 },
    { lat: 3.9005, lng: 115.7005 },
    { lat: 3.9005, lng: 115.7 }
  ],
  panjangKm: 0,
  luasHa: 0.309,
  statusSinkron: "lokal",
  createdAt: "2026-11-19T08:10:00.000Z",
  updatedAt: "2026-11-19T08:10:00.000Z",
  riwayatPembaruan: []
};

function bacaHeaderDbf(dbf: Uint8Array): string[] {
  const dec = new TextDecoder();
  const kolom: string[] = [];
  for (let off = 32; off < dbf.length && dbf[off] !== 0x0d; off += 32) {
    const namaRaw = dbf.slice(off, off + 11);
    const nol = namaRaw.indexOf(0);
    kolom.push(dec.decode(nol >= 0 ? namaRaw.slice(0, nol) : namaRaw).trim());
  }
  return kolom;
}

let wadah: HTMLDivElement | null = null;
let akar: Root | null = null;

function pasang(el: React.ReactElement): HTMLDivElement {
  wadah = document.createElement("div");
  document.body.appendChild(wadah);
  akar = createRoot(wadah);
  act(() => {
    akar!.render(el);
  });
  return wadah;
}

describe("Database Sesuai Format Tugas (Kolam Data) dan Ekspor Atribut Standar WebGIS Kecamatan v1.0", () => {
  beforeEach(() => {
    setelUlangPenyimpananUntukUji();
    localStorage.clear();
  });

  afterEach(() => {
    if (akar) {
      act(() => akar!.unmount());
      akar = null;
    }
    wadah?.remove();
    wadah = null;
    vi.restoreAllMocks();
  });

  it("1. DatabaseSyncView menampilkan kolom tabel dinamis sesuai format Menu Tugas saat lapisan (kolam data) dipilih", () => {
    const lapisanList = sinkronkanLapisanDariTugas([], [TUGAS_ANGGREK]);
    const rootEl = pasang(
      <DatabaseSyncView
        dataSpasial={[ITEM_POINT_TUGAS, ITEM_LINE_SURVEI]}
        lapisanList={lapisanList}
        areaOffline={[]}
        onResolusiKonflik={vi.fn()}
        sedangSinkron={false}
        pesanSinkron={null}
        pesanSinkronGagal={false}
        sedangOnline={true}
        onSinkronkanSekarang={vi.fn()}
        onFokusKePeta={vi.fn()}
      />
    );

    const pilihLapisan = rootEl.querySelector<HTMLSelectElement>('select[aria-label="Filter lapisan kolam data"]');
    expect(pilihLapisan).not.toBeNull();

    act(() => {
      pilihLapisan!.value = lapisanList[0].id;
      pilihLapisan!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const thTexts = Array.from(rootEl.querySelectorAll("table.data-table thead th")).map((th) => th.textContent?.trim());
    expect(thTexts).toContain("Nama Jenis Anggrek");
    expect(thTexts).toContain("Tinggi Pohon Inang");
    expect(thTexts).toContain("Nilai Ekonomi");

    const tbodyText = rootEl.querySelector("table.data-table tbody")?.textContent ?? "";
    expect(tbodyText).toContain("Coelogyne pandurata");
    expect(tbodyText).toContain("14");
    expect(tbodyText).toContain("Rp 250.000");
    // Data lapisan lain tidak ikut tampil
    expect(tbodyText).not.toContain("Jalan Lokal Pa' Padi");
  });

  it("2. AdminDashboardView (Database Aktif) menampilkan kolom format Tugas saat kolam data dipilih dan dapat mengedit atribut kustomnya", () => {
    const onUbah = vi.fn();
    const rootEl = pasang(
      <AdminDashboardView
        dataSpasial={[ITEM_POINT_TUGAS]}
        profilKader={PROFIL_UJI}
        sertifikatList={[]}
        tugasList={[TUGAS_ANGGREK]}
        kaderAktifList={[]}
        sesiAdmin={null}
        onVerifikasiData={vi.fn()}
        onUbahDataSpasial={onUbah}
        onHapusDataSpasial={vi.fn()}
        onTerbitkanSertifikat={vi.fn()}
        onTambahTugas={vi.fn()}
        onHapusTugas={vi.fn()}
        onBalasPesanAdmin={vi.fn()}
        onFokusKePeta={vi.fn()}
      />
    );

    // Pindah ke sub-tab Data (kelola_data)
    const tabData = Array.from(rootEl.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.includes("Data"));
    expect(tabData).toBeTruthy();
    act(() => {
      tabData!.click();
    });

    const pilihLapisan = rootEl.querySelector<HTMLSelectElement>('select[aria-label="Filter lapisan kolam data admin"]');
    expect(pilihLapisan).not.toBeNull();
    act(() => {
      pilihLapisan!.value = `LAP-TGS-${TUGAS_ANGGREK.id}`;
      pilihLapisan!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const headers = Array.from(rootEl.querySelectorAll("table.data-table-admin-spasial thead th")).map((th) => th.textContent?.trim());
    expect(headers).toContain("Nama Jenis Anggrek");
    expect(headers).toContain("Tinggi Pohon Inang");
    expect(headers).toContain("Nilai Ekonomi");
    expect(rootEl.textContent).toContain("Coelogyne pandurata");

    // Buka modal Edit data -> cek isian format tugas muncul dan bisa diubah
    const btnEdit = rootEl.querySelector<HTMLButtonElement>('button[title="Edit data objek"]');
    expect(btnEdit).not.toBeNull();
    act(() => {
      btnEdit!.click();
    });
    expect(rootEl.textContent).toContain("Isian Format Tugas (Kolam Data)");
  });

  it("3. Ekspor GeoJSON untuk Titik, Garis, dan Bidang 100% mengikuti Standar Atribut WebGIS Kecamatan v1.0", () => {
    // A. Titik (Point)
    const geoPoint = JSON.parse(eksporKeGeoJSON([ITEM_POINT_TUGAS]));
    const fPt = geoPoint.features[0];
    expect(fPt.geometry.type).toBe("Point");
    expect(fPt.geometry.coordinates).toEqual([115.746927, 3.8163916]); // 7 desimal
    expect(Object.keys(fPt.properties)).toEqual(["label", "kategori", "keterangan", "url", "simbol"]);
    expect(fPt.properties).toEqual({
      label: "Anggrek Hitam Spot 01",
      kategori: "Inventarisasi Anggrek Krayan",
      keterangan:
        "Tumbuh sehat di batang meranti | Nama Jenis Anggrek: Coelogyne pandurata; Tinggi Pohon Inang: 14; Nilai Ekonomi: Rp 250.000",
      url: "",
      simbol: "" // Bukan "Merah" atau ikon yang tidak ada di server
    });

    // B. Garis (Line)
    const geoLine = JSON.parse(eksporKeGeoJSON([ITEM_LINE_SURVEI]));
    const fLn = geoLine.features[0];
    expect(fLn.geometry.type).toBe("LineString");
    expect(Object.keys(fLn.properties)).toEqual(["label", "panjang_m", "keterangan", "url", "warna"]);
    expect(typeof fLn.properties.panjang_m).toBe("number");
    expect(fLn.properties.panjang_m).toBeGreaterThan(1180);
    expect(fLn.properties.panjang_m).toBeLessThan(1220);
    expect(fLn.properties.warna).toBe("#FF0000");

    // C. Bidang (Polygon)
    const geoPoly = JSON.parse(eksporKeGeoJSON([ITEM_POLYGON_KECIL]));
    const fPg = geoPoly.features[0];
    expect(fPg.geometry.type).toBe("Polygon");
    expect(Object.keys(fPg.properties)).toEqual(["label", "luas_ha", "keterangan", "url", "warna", "tepi"]);
    expect(typeof fPg.properties.luas_ha).toBe("number");
    expect(fPg.properties.luas_ha).toBeGreaterThan(0.25);
    expect(fPg.properties.luas_ha).toBeLessThan(0.35);
    // Warna rgba(...) yang ditolak website otomatis dinormalisasi ke hex sah, tepi "Transparent" -> "transparent" huruf kecil
    expect(fPg.properties.warna).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(fPg.properties.tepi).toBe("transparent");
    // Bidang < 1 Ha otomatis mencantumkan luas m² di keterangan
    expect(fPg.properties.keterangan).toContain("m²");
  });

  it("4. Ekspor Shapefile (.dbf) dan CSV memiliki kolom atribut persis sesuai Standar WebGIS Kecamatan v1.0", () => {
    const shpPoint = bangunShapefileTunggal([ITEM_POINT_TUGAS], "point");
    expect(bacaHeaderDbf(shpPoint.dbf)).toEqual(["label", "kategori", "keterangan", "url", "simbol"]);

    const shpLine = bangunShapefileTunggal([ITEM_LINE_SURVEI], "line");
    expect(bacaHeaderDbf(shpLine.dbf)).toEqual(["label", "panjang_m", "keterangan", "url", "warna"]);

    const shpPoly = bangunShapefileTunggal([ITEM_POLYGON_KECIL], "polygon");
    expect(bacaHeaderDbf(shpPoly.dbf)).toEqual(["label", "luas_ha", "keterangan", "url", "warna", "tepi"]);

    // CSV standar bersih WebGIS
    const csvWebgis = eksporKeCSV([ITEM_POINT_TUGAS]).replace(/^\uFEFF/, "");
    expect(csvWebgis.split(/\r?\n/)[0]).toBe("label,kategori,keterangan,url,simbol");

    // CSV dengan kolom tugas terpisah (untuk arsip database kolam data)
    const csvDenganTugas = eksporKeCSV([ITEM_POINT_TUGAS], { sertakanAtributTugas: true }).replace(/^\uFEFF/, "");
    expect(csvDenganTugas.split(/\r?\n/)[0]).toBe(
      "label,kategori,keterangan,url,simbol,Nama Jenis Anggrek,Tinggi Pohon Inang,Nilai Ekonomi"
    );
  });

  it("5. Ekspor KML menyertakan ExtendedData sesuai Standar Atribut WebGIS Kecamatan v1.0 dan tampilan ekspor hanya menyediakan 3 pilihan sederhana (KML, GeoJSON, SHP .zip)", () => {
    // A. KML Point, Line, Polygon berisi ExtendedData persis sesuai kolom WebGIS Kecamatan v1.0
    const kmlPoint = eksporKeKML([ITEM_POINT_TUGAS]);
    expect(kmlPoint).toContain('<Data name="label"><value>Anggrek Hitam Spot 01</value></Data>');
    expect(kmlPoint).toContain('<Data name="kategori"><value>Inventarisasi Anggrek Krayan</value></Data>');
    expect(kmlPoint).toContain('<Data name="keterangan"><value>Tumbuh sehat di batang meranti | Nama Jenis Anggrek: Coelogyne pandurata');
    expect(kmlPoint).toContain('<Data name="url"><value></value></Data>');
    expect(kmlPoint).toContain('<Data name="simbol"><value></value></Data>');

    const kmlLine = eksporKeKML([ITEM_LINE_SURVEI]);
    expect(kmlLine).toContain('<Data name="label">');
    expect(kmlLine).toContain('<Data name="panjang_m">');
    expect(kmlLine).toContain('<Data name="keterangan">');
    expect(kmlLine).toContain('<Data name="url">');
    expect(kmlLine).toContain('<Data name="warna"><value>#FF0000</value></Data>');

    const kmlPoly = eksporKeKML([ITEM_POLYGON_KECIL]);
    expect(kmlPoly).toContain('<Data name="label">');
    expect(kmlPoly).toContain('<Data name="luas_ha">');
    expect(kmlPoly).toContain('<Data name="keterangan">');
    expect(kmlPoly).toContain('<Data name="url">');
    expect(kmlPoly).toContain('<Data name="warna">');
    expect(kmlPoly).toContain('<Data name="tepi"><value>transparent</value></Data>');

    // B. Paket SHP ZIP berisi .shp, .shx, .dbf, .prj sah (diawali magic ZIP PK\x03\x04)
    const paket = eksporPaketShapefile([ITEM_POINT_TUGAS], "Anggrek_Krayan");
    expect(paket.map((b) => b.nama)).toEqual([
      "Anggrek_Krayan.shp",
      "Anggrek_Krayan.shx",
      "Anggrek_Krayan.dbf",
      "Anggrek_Krayan.prj"
    ]);
    const zipBytes = buatArsipZip(paket);
    expect(zipBytes[0]).toBe(0x50); // 'P'
    expect(zipBytes[1]).toBe(0x4b); // 'K'

    // C. Halaman PengaturanEksporView sederhana: HANYA 3 format (KML, GeoJSON, SHP (.zip)) tanpa sakelar rumit
    const rootEkspor = pasang(
      <PengaturanEksporView
        dataSpasial={[ITEM_POINT_TUGAS, ITEM_LINE_SURVEI, ITEM_POLYGON_KECIL]}
        onTutup={vi.fn()}
      />
    );
    const tombolFormat = Array.from(rootEkspor.querySelectorAll('[aria-label="Pilih format ekspor"] button')).map((b) =>
      b.textContent?.trim()
    );
    expect(tombolFormat).toEqual(["KML", "GeoJSON", "SHP (.zip)"]);
    expect(rootEkspor.textContent).not.toContain("Hanya skema");
    expect(rootEkspor.textContent).not.toContain("Foto ditautkan");
    expect(rootEkspor.textContent).not.toContain("Lintasan menjadi garis");
  });
});
