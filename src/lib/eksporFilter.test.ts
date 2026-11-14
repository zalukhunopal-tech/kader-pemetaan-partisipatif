import { describe, expect, it } from "vitest";
import { AreaPetaOffline, DataSpasialItem, LapisanSpasial } from "../types";
import { eksporGeoJsonDenganOpsi, eksporKmlDenganOpsi, filterDataUntukEkspor } from "./eksporFilter";

const DATA_UJI: DataSpasialItem[] = [
  {
    id: "SPS-1",
    idKader: "KDR-01",
    namaKader: "Siti",
    desaWilayah: "Long Peso",
    jenisGeometri: "point",
    kategori: "Biodiversitas",
    judul: "Pohon Ulin Besar",
    deskripsi: "Diameter 120cm",
    koordinat: [{ lat: 2.855, lng: 117.38 }],
    panjangKm: 0,
    luasHa: 0,
    fotoBase64: "data:image/jpeg;base64,/9j/4AAQ",
    namaFileFoto: "ulin.jpg",
    statusSinkron: "lokal",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    riwayatPembaruan: []
  },
  {
    id: "SPS-2",
    idKader: "KDR-01",
    namaKader: "Siti",
    desaWilayah: "Long Peso",
    jenisGeometri: "point",
    kategori: "Mata Air",
    judul: "Mata Air Hulu",
    deskripsi: "Sumber air bersih",
    koordinat: [{ lat: 3.1, lng: 117.8 }],
    panjangKm: 0,
    luasHa: 0,
    statusSinkron: "lokal",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    riwayatPembaruan: []
  }
];

const PETA_CONTOH: AreaPetaOffline = {
  id: "MAP-1",
  namaArea: "Lembar Hulu",
  basemapId: "topo",
  minLat: 2.84,
  maxLat: 2.87,
  minLng: 117.36,
  maxLng: 117.4,
  zoomMin: 11,
  zoomMax: 16,
  jumlahTile: 0,
  ukuranMb: 2.1,
  diunduhPada: "2026-11-01T00:00:00Z"
};

const LAPISAN_BIO: LapisanSpasial = {
  id: "LAY-1",
  nama: "Lapisan Hayati",
  jumlahPeta: 1,
  kategoriDefault: "Biodiversitas",
  createdAt: "2026-11-01T00:00:00Z"
};

describe("eksporFilter", () => {
  it("menyaring fitur berdasarkan peta atau lapisan terpilih pada mode Semua fitur terpilih", () => {
    const dalamPeta = filterDataUntukEkspor(DATA_UJI, {
      jenisData: "Semua fitur terpilih",
      konteks: { petaDipilih: [PETA_CONTOH] }
    });
    expect(dalamPeta.map((d) => d.id)).toEqual(["SPS-1"]);

    const berdasarLapisan = filterDataUntukEkspor(DATA_UJI, {
      jenisData: "Semua fitur terpilih",
      konteks: { lapisanDipilih: [LAPISAN_BIO] }
    });
    expect(berdasarLapisan.map((d) => d.id)).toEqual(["SPS-1"]);
  });

  it("menghapus tautan/data foto bila sertakanFoto false", () => {
    const tanpaFoto = filterDataUntukEkspor(DATA_UJI, {
      jenisData: "Hanya lapisan",
      sertakanFoto: false
    });
    expect(tanpaFoto).toHaveLength(2);
    expect(tanpaFoto[0].fotoBase64).toBeUndefined();
    expect(tanpaFoto[0].namaFileFoto).toBeUndefined();
  });

  it("menyertakan poligon batas peta ke GeoJSON dan KML saat mode Lapisan dan peta aktif", () => {
    const geo = JSON.parse(eksporGeoJsonDenganOpsi(DATA_UJI, [PETA_CONTOH], true));
    expect(geo.features).toHaveLength(3);
    expect(geo.features[2].properties.jenis_fitur).toBe("batas_peta");
    expect(geo.features[2].geometry.type).toBe("Polygon");

    const kml = eksporKmlDenganOpsi(DATA_UJI, [PETA_CONTOH], true);
    expect(kml).toContain("Batas Peta: Lembar Hulu");
    expect(kml).toContain("<Polygon>");
  });
});
