import { describe, expect, it } from "vitest";
import {
  eksporKeGPX,
  eksporKeGeoJSON,
  eksporKeKML,
  formatKoordinatTeks,
  hitungJarakMeter,
  hitungLuasPoligonHa,
  hitungPanjangGarisKm,
  konversiUTM
} from "./geoUtils";
import { DataSpasialItem } from "../types";

// Nilai acuan dihitung dengan PROJ (pyproj 3.8, EPSG:326xx/327xx) dan dibulatkan ke meter
const ACUAN_UTM: [string, number, number, number, "N" | "S", number, number][] = [
  ["Padang", -0.9475, 100.4192, 47, "S", 657916, 9895240],
  ["Jakarta (Monas)", -6.1754, 106.8272, 48, "S", 702183, 9317059],
  ["Denpasar", -8.65, 115.2167, 50, "S", 303775, 9043383],
  ["Jayapura", -2.5337, 140.7181, 54, "S", 468662, 9719945],
  ["Banda Aceh", 5.5483, 95.3238, 46, "N", 757447, 613778],
  ["Khatulistiwa 0,0", 0.0, 0.0, 31, "N", 166021, 0],
  ["Medan", 3.5952, 98.6722, 47, "N", 463595, 397389],
  ["Sorong", -0.8762, 131.2558, 52, "S", 751050, 9903078],
  ["London", 51.5074, -0.1278, 30, "N", 699316, 5710164],
  ["Sydney", -33.8688, 151.2093, 56, "S", 334369, 6250948]
];

describe("konversiUTM", () => {
  it.each(ACUAN_UTM)("%s cocok dengan PROJ", (_nama, lat, lng, zona, belahan, timur, utara) => {
    const u = konversiUTM(lat, lng);
    expect(u).not.toBeNull();
    expect(u!.zona).toBe(zona);
    expect(u!.belahan).toBe(belahan);
    expect(Math.abs(u!.timur - timur)).toBeLessThanOrEqual(1);
    expect(Math.abs(u!.utara - utara)).toBeLessThanOrEqual(1);
  });

  it("tidak lagi meleset ratusan meter seperti pendekatan bola lama (Padang, utara)", () => {
    // Pendekatan lama memberi utara 9894684; yang benar 9895240 (selisih sekitar 556 m)
    expect(konversiUTM(-0.9475, 100.4192)!.utara).toBeGreaterThan(9895000);
  });

  it("menolak lintang di luar 80°S-84°U dan nilai tidak valid", () => {
    expect(konversiUTM(85, 10)).toBeNull();
    expect(konversiUTM(-80.5, 10)).toBeNull();
    expect(konversiUTM(NaN, 10)).toBeNull();
  });

  it("bujur 180 masuk zona 60 dan bujur di luar rentang diputar", () => {
    expect(konversiUTM(0, 180)!.zona).toBe(60);
    expect(konversiUTM(0, 190)!.zona).toBe(konversiUTM(0, -170)!.zona);
  });

  it("formatKoordinatTeks UTM menuliskan zona, belahan, timur, dan utara", () => {
    expect(formatKoordinatTeks(-0.9475, 100.4192, "UTM")).toBe("UTM 47S 657916mE 9895240mN");
    expect(formatKoordinatTeks(89, 10, "UTM")).toMatch(/tidak berlaku/);
  });
});

describe("format DD dan DMS", () => {
  it("DD memakai 6 desimal", () => {
    expect(formatKoordinatTeks(-0.9475, 100.4192, "DD")).toBe("-0.947500°, 100.419200°");
  });
  it("DMS memberi huruf arah LS/BT", () => {
    expect(formatKoordinatTeks(-0.9475, 100.4192, "DMS")).toMatch(/LS .*BT$/);
  });
});

describe("jarak, panjang jalur, dan luas", () => {
  it("1° lintang di khatulistiwa sekitar 111,2 km (Haversine)", () => {
    const d = hitungJarakMeter({ lat: 0, lng: 100 }, { lat: 1, lng: 100 });
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });
  it("panjang jalur menjumlahkan ruas dalam km", () => {
    const km = hitungPanjangGarisKm([
      { lat: 0, lng: 100 },
      { lat: 0.01, lng: 100 },
      { lat: 0.02, lng: 100 }
    ]);
    expect(km).toBeCloseTo(2.224, 2);
  });
  it("luas kotak 0,01° x 0,01° di khatulistiwa sekitar 123,6 ha", () => {
    const ha = hitungLuasPoligonHa([
      { lat: 0, lng: 100 },
      { lat: 0, lng: 100.01 },
      { lat: 0.01, lng: 100.01 },
      { lat: 0.01, lng: 100 }
    ]);
    expect(ha).toBeGreaterThan(122);
    expect(ha).toBeLessThan(125);
  });
  it("titik kurang dari batas minimum menghasilkan 0", () => {
    expect(hitungPanjangGarisKm([{ lat: 0, lng: 0 }])).toBe(0);
    expect(
      hitungLuasPoligonHa([
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1 }
      ])
    ).toBe(0);
  });
});

const item = (koordinat: DataSpasialItem["koordinat"], jenis: DataSpasialItem["jenisGeometri"]): DataSpasialItem => ({
  id: "X",
  idKader: "K",
  namaKader: "N",
  desaWilayah: "D",
  jenisGeometri: jenis,
  kategori: "Flora",
  judul: "t",
  deskripsi: "",
  koordinat,
  panjangKm: 0,
  luasHa: 0,
  statusSinkron: "lokal",
  createdAt: "",
  updatedAt: "",
  riwayatPembaruan: []
});

describe("ekspor tidak memalsukan elevasi", () => {
  const tanpa = item([{ lat: -1.6, lng: 103.6 }], "point");
  const dengan = item([{ lat: -1.6, lng: 103.6, elevasi: 53 }], "point");

  it("GeoJSON: 2 elemen bila elevasi tidak diketahui, 3 bila ada, 0 asli tetap ditulis", () => {
    expect(JSON.parse(eksporKeGeoJSON([tanpa])).features[0].geometry.coordinates).toEqual([103.6, -1.6]);
    expect(JSON.parse(eksporKeGeoJSON([dengan])).features[0].geometry.coordinates).toEqual([103.6, -1.6, 53]);
    const nol = item([{ lat: 0, lng: 0, elevasi: 0 }], "point");
    expect(JSON.parse(eksporKeGeoJSON([nol])).features[0].geometry.coordinates).toEqual([0, 0, 0]);
  });
  it("KML dan GPX menghilangkan elevasi yang tidak diketahui", () => {
    expect(eksporKeKML([tanpa])).toContain("<coordinates>103.6,-1.6</coordinates>");
    expect(eksporKeKML([dengan])).toContain("103.6,-1.6,53");
    expect(eksporKeGPX([tanpa])).not.toContain("<ele>");
    expect(eksporKeGPX([dengan])).toContain("<ele>53</ele>");
  });
  it("GeoJSON menandai data simulasi dan data impor", () => {
    const sim = item([{ lat: 0, lng: 0, simulasi: true }], "point");
    const imp = { ...item([{ lat: 0, lng: 0 }], "point"), diimpor: true };
    const f = JSON.parse(eksporKeGeoJSON([sim, imp])).features;
    expect(f[0].properties.simulasi).toBe(true);
    expect(f[1].properties.diimpor).toBe(true);
  });
});
