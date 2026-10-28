// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  BATAS_BYTE_IMPOR,
  BATAS_FITUR_IMPOR,
  fiturKeDataSpasial,
  parseBerkas,
  parseGPX,
  parseGeoJSON,
  parseKML,
  ringkasDilewati
} from "./impor";
import { dihitungUntukCapaian } from "./geoUtils";

const fc = (...features: unknown[]) => JSON.stringify({ type: "FeatureCollection", features });
const feat = (geometry: unknown, properties: Record<string, unknown> = {}) => ({ type: "Feature", properties, geometry });
const pt = (lng: number, lat: number, ele?: number) => ({ type: "Point", coordinates: ele === undefined ? [lng, lat] : [lng, lat, ele] });

describe("GeoJSON: bentuk berkas", () => {
  it("FeatureCollection berisi titik, jalur, dan poligon", () => {
    const h = parseGeoJSON(
      fc(
        feat(pt(100.4, -0.9), { judul: "Pohon" }),
        feat({ type: "LineString", coordinates: [[100, 0], [100.1, 0.1]] }),
        feat({ type: "Polygon", coordinates: [[[100, 0], [100.1, 0], [100.1, 0.1], [100, 0.1], [100, 0]]] })
      )
    );
    expect(h.format).toBe("GeoJSON");
    expect(h.fitur.map((f) => f.jenisGeometri)).toEqual(["point", "line", "polygon"]);
    expect(h.dilewati).toEqual([]);
  });
  it("cincin poligon ditutup titik pertama dibuka (4 sudut, bukan 5)", () => {
    const h = parseGeoJSON(fc(feat({ type: "Polygon", coordinates: [[[100, 0], [100.1, 0], [100.1, 0.1], [100, 0.1], [100, 0]]] })));
    expect(h.fitur[0].koordinat).toHaveLength(4);
  });
  it("Feature tunggal dan geometri polos diterima", () => {
    expect(parseGeoJSON(JSON.stringify(feat(pt(100, 0)))).fitur).toHaveLength(1);
    expect(parseGeoJSON(JSON.stringify(pt(100, 0))).fitur).toHaveLength(1);
  });
  it("GeometryCollection diuraikan", () => {
    const g = { type: "GeometryCollection", geometries: [pt(100, 0), { type: "LineString", coordinates: [[100, 0], [101, 1]] }] };
    expect(parseGeoJSON(fc(feat(g))).fitur.map((f) => f.jenisGeometri)).toEqual(["point", "line"]);
  });
  it("Multi* dipecah menjadi beberapa objek bernomor", () => {
    const h = parseGeoJSON(
      fc(feat({ type: "MultiPoint", coordinates: [[100, 0], [101, 1], [102, 2]] }, { judul: "Rumpun" }))
    );
    expect(h.fitur.map((f) => f.judul)).toEqual(["Rumpun (1)", "Rumpun (2)", "Rumpun (3)"]);
    const mp = parseGeoJSON(
      fc(feat({ type: "MultiPolygon", coordinates: [[[[100, 0], [100.1, 0], [100.1, 0.1], [100, 0]]], [[[101, 0], [101.1, 0], [101.1, 0.1], [101, 0]]]] }))
    );
    expect(mp.fitur).toHaveLength(2);
    const ml = parseGeoJSON(fc(feat({ type: "MultiLineString", coordinates: [[[100, 0], [101, 1]], [[102, 0], [103, 1]]] })));
    expect(ml.fitur.map((f) => f.jenisGeometri)).toEqual(["line", "line"]);
  });
});

describe("GeoJSON: validasi (T6/S7)", () => {
  it.each([
    ["lintang di luar rentang", pt(100, 95)],
    ["bujur di luar rentang", pt(200, 0)],
    ["koordinat bukan angka", { type: "Point", coordinates: ["100", "0"] }],
    ["koordinat kosong", { type: "Point", coordinates: [] }],
    ["jalur satu titik", { type: "LineString", coordinates: [[100, 0]] }],
    ["jalur dengan satu titik rusak", { type: "LineString", coordinates: [[100, 0], [null, 1]] }],
    ["poligon dua sudut", { type: "Polygon", coordinates: [[[100, 0], [101, 1]]] }],
    ["poligon tanpa cincin", { type: "Polygon", coordinates: [] }]
  ])("%s dilewati dan dilaporkan, tidak diimpor setengah rusak", (_nama, geometri) => {
    const h = parseGeoJSON(fc(feat(geometri)));
    expect(h.fitur).toHaveLength(0);
    expect(h.dilewati).toHaveLength(1);
  });
  it("tipe tidak didukung dan fitur tanpa geometri dilaporkan", () => {
    const h = parseGeoJSON(fc(feat({ type: "Curve", coordinates: [] }), { type: "Feature", properties: {}, geometry: null }));
    expect(h.fitur).toHaveLength(0);
    expect(h.dilewati.join("|")).toMatch(/tidak didukung/);
    expect(h.dilewati.join("|")).toMatch(/tanpa geometri/);
  });
  it("fitur valid tetap masuk walau di antaranya ada yang rusak", () => {
    const h = parseGeoJSON(fc(feat(pt(100, 0)), feat(pt(100, 99)), feat(pt(101, 1))));
    expect(h.fitur).toHaveLength(2);
    expect(h.dilewati).toEqual(["fitur 2: koordinat titik tidak valid"]);
  });
  it("berkas bukan JSON atau bukan GeoJSON menghasilkan galat yang jelas", () => {
    expect(() => parseGeoJSON("bukan json")).toThrow(/bukan JSON/);
    expect(() => parseGeoJSON(JSON.stringify({ halo: 1 }))).toThrow(/bukan GeoJSON/);
    expect(() => parseGeoJSON("123")).toThrow(/bukan GeoJSON/);
  });
  it("berkas dengan terlalu banyak fitur ditolak", () => {
    const banyak = Array.from({ length: BATAS_FITUR_IMPOR + 1 }, () => feat(pt(100, 0)));
    expect(() => parseGeoJSON(fc(...banyak))).toThrow(/melebihi batas/);
  });
});

describe("GeoJSON: atribut", () => {
  it("judul memakai judul, name, Name, title, lalu nomor urut", () => {
    const h = parseGeoJSON(fc(feat(pt(1, 1), { judul: "A" }), feat(pt(1, 1), { name: "B" }), feat(pt(1, 1), { Name: "C" }), feat(pt(1, 1), { title: "D" }), feat(pt(1, 1))));
    expect(h.fitur.map((f) => f.judul)).toEqual(["A", "B", "C", "D", "Impor #5"]);
  });
  it("kategori tidak dikenal dibuang (bukan diteruskan sebagai teks bebas)", () => {
    const h = parseGeoJSON(fc(feat(pt(1, 1), { kategori: "Mata Air" }), feat(pt(1, 1), { kategori: "Sembarang" })));
    expect(h.fitur.map((f) => f.kategori)).toEqual(["Mata Air", undefined]);
  });
  it("elevasi hanya dipertahankan bila angka terhingga", () => {
    const h = parseGeoJSON(fc(feat(pt(1, 1, 53)), feat(pt(1, 1)), feat({ type: "Point", coordinates: [1, 1, "tinggi"] })));
    expect(h.fitur.map((f) => f.koordinat[0].elevasi)).toEqual([53, undefined, undefined]);
  });
  it("teks panjang dipotong dan penanda simulasi diteruskan ke tiap titik", () => {
    const h = parseGeoJSON(fc(feat({ type: "LineString", coordinates: [[1, 1], [2, 2]] }, { deskripsi: "x".repeat(2000), simulasi: true })));
    expect(h.fitur[0].deskripsi).toHaveLength(500);
    expect(h.fitur[0].koordinat.every((k) => k.simulasi === true)).toBe(true);
  });
});

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Pohon Meranti</name><description>Dekat sungai</description>
    <Point><coordinates>100.4192,-0.9475,53</coordinates></Point></Placemark>
  <Placemark><name>Jalur Patroli</name>
    <LineString><coordinates>100.40,-0.95,0 100.41,-0.94,0 100.42,-0.93,0</coordinates></LineString></Placemark>
  <Placemark><name>Hutan Adat</name>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>100,0 100.1,0 100.1,0.1 100,0.1 100,0</coordinates></LinearRing></outerBoundaryIs>
      <innerBoundaryIs><LinearRing><coordinates>100.02,0.02 100.04,0.02 100.04,0.04 100.02,0.02</coordinates></LinearRing></innerBoundaryIs></Polygon></Placemark>
  <Placemark><name>Gabungan</name><MultiGeometry>
    <Point><coordinates>101,1</coordinates></Point><Point><coordinates>102,2</coordinates></Point></MultiGeometry></Placemark>
  <Placemark><name>Rusak</name><Point><coordinates>100,95</coordinates></Point></Placemark>
  <Placemark><name>Tanpa geometri</name></Placemark>
</Document></kml>`;

describe("KML", () => {
  const h = parseKML(KML);
  it("membaca titik, jalur, poligon (cincin luar saja), dan MultiGeometry", () => {
    expect(h.format).toBe("KML");
    expect(h.fitur.map((f) => `${f.judul}:${f.jenisGeometri}`)).toEqual([
      "Pohon Meranti:point",
      "Jalur Patroli:line",
      "Hutan Adat:polygon",
      "Gabungan (1):point",
      "Gabungan (2):point"
    ]);
    expect(h.fitur[2].koordinat).toHaveLength(4);
  });
  it("urutan KML adalah bujur,lintang,tinggi; deskripsi dan elevasi terbaca", () => {
    expect(h.fitur[0].koordinat[0]).toEqual({ lng: 100.4192, lat: -0.9475, elevasi: 53 });
    expect(h.fitur[0].deskripsi).toBe("Dekat sungai");
  });
  it("koordinat rusak dan Placemark tanpa geometri dilaporkan", () => {
    expect(h.dilewati).toHaveLength(2);
    expect(h.dilewati.join("|")).toMatch(/koordinat titik tidak valid/);
    expect(h.dilewati.join("|")).toMatch(/tidak ada geometri yang didukung/);
  });
  it("XML rusak atau tanpa Placemark ditolak", () => {
    expect(() => parseKML("<kml><Placemark>")).toThrow(/XML rusak/);
    expect(() => parseKML('<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>')).toThrow(/tidak memuat Placemark/);
  });
});

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="uji" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="-0.9475" lon="100.4192"><ele>53.5</ele><name>Mata Air</name><desc>Jernih</desc></wpt>
  <wpt lat="-0.95" lon="100.42"><name>Tanpa tinggi</name></wpt>
  <wpt lat="95" lon="100"><name>Lintang rusak</name></wpt>
  <trk><name>Jejak Pagi</name>
    <trkseg><trkpt lat="-0.95" lon="100.40"><ele>10</ele></trkpt><trkpt lat="-0.94" lon="100.41"></trkpt></trkseg>
    <trkseg><trkpt lat="-0.93" lon="100.42"></trkpt></trkseg></trk>
  <rte><name>Rute</name><rtept lat="0" lon="100"/><rtept lat="1" lon="101"/></rte>
  <trk><name>Terlalu pendek</name><trkseg><trkpt lat="0" lon="100"/></trkseg></trk>
</gpx>`;

describe("GPX", () => {
  const h = parseGPX(GPX);
  it("membaca waypoint, jejak (semua segmen digabung), dan rute", () => {
    expect(h.format).toBe("GPX");
    expect(h.fitur.map((f) => `${f.judul}:${f.jenisGeometri}:${f.koordinat.length}`)).toEqual([
      "Mata Air:point:1",
      "Tanpa tinggi:point:1",
      "Jejak Pagi:line:3",
      "Rute:line:2"
    ]);
  });
  it("lat/lon dibaca dari atribut dan elevasi hanya bila ada", () => {
    expect(h.fitur[0].koordinat[0]).toEqual({ lat: -0.9475, lng: 100.4192, elevasi: 53.5 });
    expect(h.fitur[1].koordinat[0].elevasi).toBeUndefined();
    expect(h.fitur[2].koordinat[0].elevasi).toBe(10);
  });
  it("waypoint rusak dan jejak satu titik dilaporkan", () => {
    expect(h.dilewati).toHaveLength(2);
  });
  it("berkas kosong atau bukan GPX ditolak", () => {
    expect(() => parseGPX('<gpx version="1.1"/>')).toThrow(/tidak memuat titik/);
    expect(() => parseGPX("<kml/>")).toThrow(/bukan GPX/);
    expect(() => parseGPX("<gpx>")).toThrow(/XML rusak/);
  });
});

describe("parseBerkas", () => {
  it("memilih parser dari ekstensi, lalu dari isi", () => {
    expect(parseBerkas("a.geojson", fc(feat(pt(1, 1)))).format).toBe("GeoJSON");
    expect(parseBerkas("a.JSON", fc(feat(pt(1, 1)))).format).toBe("GeoJSON");
    expect(parseBerkas("a.kml", KML).format).toBe("KML");
    expect(parseBerkas("a.gpx", GPX).format).toBe("GPX");
    expect(parseBerkas("tanpa-ekstensi", KML).format).toBe("KML");
    expect(parseBerkas("data.txt", GPX).format).toBe("GPX");
    expect(parseBerkas("data.dat", fc(feat(pt(1, 1)))).format).toBe("GeoJSON");
  });
  it("format tak dikenal dan berkas terlalu besar ditolak", () => {
    expect(() => parseBerkas("a.pdf", "%PDF-1.4")).toThrow(/tidak dikenali/);
    expect(() => parseBerkas("a.geojson", " ".repeat(BATAS_BYTE_IMPOR + 1))).toThrow(/terlalu besar/);
  });
});

describe("ringkasDilewati dan fiturKeDataSpasial", () => {
  it("mengelompokkan alasan yang sama dan mengurutkan dari yang terbanyak", () => {
    const r = ringkasDilewati(["fitur 1: koordinat titik tidak valid", "fitur 2: koordinat titik tidak valid", "fitur 3: tipe geometri Curve tidak didukung"]);
    expect(r).toBe("2x koordinat titik tidak valid; tipe geometri Curve tidak didukung");
    expect(ringkasDilewati([])).toBe("");
  });
  it("objek impor: ID berawalan IMP-, ditandai diimpor, status lokal, dan belum dihitung capaian", () => {
    const [jalur] = parseGeoJSON(fc(feat({ type: "LineString", coordinates: Array.from({ length: 60 }, (_, i) => [100.4, -0.9478 + i * 0.0008]) }))).fitur;
    const o = fiturKeDataSpasial(jalur, { idKader: "KDR-001", namaKader: "Budi", desaWilayah: "A" });
    expect(o.id).toMatch(/^IMP-[0-9a-f]{12}$/);
    expect(o.diimpor).toBe(true);
    expect(o.statusSinkron).toBe("lokal");
    expect(o.idKader).toBe("KDR-001");
    expect(o.panjangKm).toBeGreaterThan(5);
    expect(dihitungUntukCapaian(o)).toBe(false);
    expect(dihitungUntukCapaian({ ...o, statusSinkron: "terverifikasi" })).toBe(true);
  });
  it("poligon impor menghitung luas; kategori tak dikenal menjadi Flora", () => {
    const [poli] = parseGeoJSON(fc(feat({ type: "Polygon", coordinates: [[[100, 0], [100.01, 0], [100.01, 0.01], [100, 0.01], [100, 0]]] }, { kategori: "Aneh" }))).fitur;
    const o = fiturKeDataSpasial(poli, { idKader: "K", namaKader: "N", desaWilayah: "D" });
    expect(o.luasHa).toBeGreaterThan(100);
    expect(o.kategori).toBe("Flora");
  });
});
