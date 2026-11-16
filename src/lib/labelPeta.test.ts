import { describe, it, expect } from "vitest";
import { ringkasLabelCrs, singkatkanLabelPeta } from "./labelPeta";

describe("Pembersih dan Penyingkat Label Peta Adaptif (singkatkanLabelPeta)", () => {
  it("membersihkan ekstensi berkas .geopdf, .pdf, .pmtiles, dan underscore", () => {
    const raw = "Peta_Kecamatan_Tanjung_Palas_Timur.geopdf";
    const res = singkatkanLabelPeta(raw, 40);
    expect(res).toBe("Peta Kec. Tg. Palas Timur");
    expect(res).not.toContain(".geopdf");
    expect(res).not.toContain("_");
  });

  it("menyingkat istilah kawasan hutan dan administratif panjang secara adaptif", () => {
    const raw = "Peta_Fungsi_Kawasan_Hutan_Kecamatan_Tanjung_Selor_2024.pdf";
    const res = singkatkanLabelPeta(raw, 45);
    expect(res).toBe("Peta Fungsi Kws. Htn. Kec. Tg. Selor 2024");
    expect(res.length).toBeLessThanOrEqual(45);
  });

  it("menyingkat istilah tutupan lahan, masyarakat, dan adat", () => {
    const raw = "Hutan_Lindung_Wilayah_Masyarakat_Adat_Dayak.geojson";
    const res = singkatkanLabelPeta(raw, 50);
    expect(res).toBe("Htn. Ldg. Wil. Masy. Adat Dayak");
  });

  it("memotong pada batas kata jika teks sangat panjang melebihi maxLen", () => {
    const raw = "Peta_Tutupan_Lahan_Kawasan_Hutan_Produksi_Tetap_Provinsi_Kalimantan_Utara.pmtiles";
    const res = singkatkanLabelPeta(raw, 25);
    expect(res.endsWith("...")).toBe(true);
    expect(res.length).toBeLessThanOrEqual(25);
  });

  it("menangani string kosong atau nama pendek tanpa merusaknya", () => {
    expect(singkatkanLabelPeta("")).toBe("");
    expect(singkatkanLabelPeta("Peta Desa")).toBe("Peta Ds.");
  });
});

describe("Penyingkat Label CRS (ringkasLabelCrs)", () => {
  it("mengekstrak dan meringkas WKT PROJCS panjang agar tidak overlap kartu", () => {
    const wkt = 'PROJCS["WGS_1984_UTM_Zone_50N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984"]]]';
    const res = ringkasLabelCrs(wkt);
    expect(res).toBe("WGS84 UTM Zone 50N");
    expect(res.length).toBeLessThanOrEqual(26);
  });

  it("menjaga kode EPSG ringkas dan memotong string tak dikenal yang terlalu panjang", () => {
    expect(ringkasLabelCrs("EPSG:4326 (WGS 84)")).toBe("EPSG:4326");
    const panjang = "PROYEKSI_KHUSUS_KALIMANTAN_UTARA_ZONA_SANGAT_PANJANG";
    const res = ringkasLabelCrs(panjang, 22);
    expect(res.endsWith("...")).toBe(true);
    expect(res.length).toBeLessThanOrEqual(22);
  });
});
