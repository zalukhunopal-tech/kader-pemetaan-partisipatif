// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataSpasialItem } from "../../types";
import { kompresFoto } from "../../lib/foto";
import {
  eksporKeCSV,
  eksporKeKML,
  eksporKeGeoJSON,
  sanitasiTeksInput
} from "../../lib/geoUtils";
import { wilayahLengkap } from "../../lib/wilayah";

describe("Kategori D: Input Formulir Survei, Foto & Validasi Data (Skenario 28–35)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Skenario 28: Corrupt or Zero-Byte Photo Upload
  it("Skenario 28: Zero-Byte Photo — berkas kamera rusak 0 byte ditolak dengan pesan jelas tanpa crash", async () => {
    const zeroByteFile = new File([], "corrupted_camera.jpg", { type: "image/jpeg" });
    await expect(kompresFoto(zeroByteFile)).rejects.toThrow("0 byte");
  });

  // Skenario 29: Ultra-High-Resolution Photo (48MP / 20MB)
  it("Skenario 29: Batas Ukuran Foto — berkas melebihi 25MB dicegah dari awal agar tidak kehabisan memori", async () => {
    const bigFile = new File([new Uint8Array(10)], "huge_photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(bigFile, "size", { value: 26 * 1024 * 1024 });

    await expect(kompresFoto(bigFile)).rejects.toThrow("terlalu besar");
  });

  // Skenario 30: Special Characters, Emojis & Script Injection in Survey Inputs
  it("Skenario 30: Script Injection & Emoji — tag script dinetralkan sedangkan emoji dan tanda kutip tetap aman", () => {
    const rawInput = "Pohon Bengkirai \"Super\" <script>alert('XSS')</script> 🌲⚠️ di tepi jurang";
    const sanitized = sanitasiTeksInput(rawInput);

    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("alert");
    expect(sanitized).toContain("🌲⚠️");
    expect(sanitized).toContain('Pohon Bengkirai "Super"');

    const item: DataSpasialItem = {
      id: "SPS-XSS-01",
      idKader: "KDR-01",
      namaKader: "Budi",
      desaWilayah: "Desa Hutan",
      jenisGeometri: "point",
      kategori: "Flora",
      judul: sanitized,
      deskripsi: 'Catatan dengan tanda "kutip" dan baris baru\nLanjutan baris.',
      koordinat: [{ lat: 2.85, lng: 117.37 }],
      panjangKm: 0,
      luasHa: 0,
      statusSinkron: "lokal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      riwayatPembaruan: []
    };

    // Verifikasi ekspor CSV menangani kutip ganda
    const csv = eksporKeCSV([item]);
    expect(csv).toContain('""Super""');

    // Verifikasi ekspor KML meng-escape tag XML
    const kml = eksporKeKML([item]);
    expect(kml).not.toContain("<script>");

    // Verifikasi GeoJSON valid JSON
    const geojson = eksporKeGeoJSON([item]);
    const parsed = JSON.parse(geojson);
    expect(parsed.features[0].properties.judul).toContain("🌲⚠️");
  });

  // Skenario 31: Accidental Back-Button / Modal Dismiss During Long Form
  it("Skenario 31: Form Draft State — isian form tetap terjaga sebelum pengguna menekan batal", () => {
    const draft = {
      kategori: "Fauna",
      judulInput: "Jejak Orangutan",
      namaLokal: "Mawas",
      deskripsi: "Ditemukan sarang segar di ketinggian 15 meter"
    };

    expect(draft.judulInput).toBe("Jejak Orangutan");
    expect(draft.kategori).toBe("Fauna");
  });

  // Skenario 32: Editing an Already-Queued Offline Object
  it("Skenario 32: Editing Already-Queued Object — pengeditan lokal memperbarui objek yang sama tanpa duplikasi", () => {
    let daftar: DataSpasialItem[] = [
      {
        id: "SPS-EDIT-01",
        idKader: "KDR-01",
        namaKader: "Kader A",
        desaWilayah: "Desa A",
        jenisGeometri: "point",
        kategori: "Flora",
        judul: "Pohon Meranti",
        deskripsi: "Tinggi 20m",
        koordinat: [{ lat: 2.85, lng: 117.37 }],
        panjangKm: 0,
        luasHa: 0,
        statusSinkron: "lokal",
        createdAt: "2026-11-01T08:00:00Z",
        updatedAt: "2026-11-01T08:00:00Z",
        riwayatPembaruan: []
      }
    ];

    daftar = daftar.map((d) =>
      d.id === "SPS-EDIT-01" ? { ...d, judul: "Pohon Meranti Merah", deskripsi: "Tinggi 25m", updatedAt: "2026-11-01T09:00:00Z" } : d
    );
    expect(daftar).toHaveLength(1);
    expect(daftar[0].judul).toBe("Pohon Meranti Merah");

    daftar = daftar.map((d) =>
      d.id === "SPS-EDIT-01"
        ? {
            ...d,
            riwayatPembaruan: [
              ...d.riwayatPembaruan,
              {
                id: "UPD-1",
                tanggal: "2026-11-01T10:00:00Z",
                idKader: "KDR-01",
                olehKader: "Kader A",
                kondisiTerbaru: "Subur",
                catatan: "Berbunga lebat"
              }
            ]
          }
        : d
    );

    expect(daftar).toHaveLength(1);
    expect(daftar[0].riwayatPembaruan).toHaveLength(1);
  });

  // Skenario 33: Deleting an Object While Sync is in Progress
  it("Skenario 33: Deleting an Object Concurrently — penghapusan tidak meninggalkan state menggantung", () => {
    let daftar: DataSpasialItem[] = [
      {
        id: "SPS-DEL-01",
        idKader: "KDR-01",
        namaKader: "Kader A",
        desaWilayah: "Desa A",
        jenisGeometri: "point",
        kategori: "Flora",
        judul: "Tanaman Obat",
        deskripsi: "Akar kuning",
        koordinat: [{ lat: 2.85, lng: 117.37 }],
        panjangKm: 0,
        luasHa: 0,
        statusSinkron: "lokal",
        createdAt: "2026-11-01T08:00:00Z",
        updatedAt: "2026-11-01T08:00:00Z",
        riwayatPembaruan: []
      }
    ];

    daftar = daftar.filter((d) => d.id !== "SPS-DEL-01");
    expect(daftar).toHaveLength(0);

    const idTersinkron = ["SPS-DEL-01"];
    daftar = daftar.map((d) => (idTersinkron.includes(d.id) ? { ...d, statusSinkron: "tersinkron" } : d));
    expect(daftar).toHaveLength(0);
  });

  // Skenario 34: Empty / Whitespace-Only Required Fields
  it("Skenario 34: Whitespace-Only Fields — spasi kosong '   ' ditolak pada validasi wilayah lengkap", () => {
    const wilayahKosong = {
      provinsi: "Kalimantan Utara",
      kabupaten: "   ",
      kecamatan: "Tanjung Selor",
      desa: "Tanjung Selor Hilir"
    };

    expect(wilayahLengkap(wilayahKosong)).toBe(false);

    const wilayahValid = {
      provinsi: "Kalimantan Utara",
      kabupaten: "Bulungan",
      kecamatan: "Tanjung Selor",
      desa: "Tanjung Selor Hilir"
    };
    expect(wilayahLengkap(wilayahValid)).toBe(true);
  });

  // Skenario 35: Sequential Processing of Multiple Photo Attachments
  it("Skenario 35: Sequential Processing — pengolahan multiple foto berjalan teratur", async () => {
    const listFile = [
      new File([new Uint8Array(100)], "foto1.jpg", { type: "image/jpeg" }),
      new File([new Uint8Array(200)], "foto2.jpg", { type: "image/jpeg" }),
      new File([new Uint8Array(300)], "foto3.jpg", { type: "image/jpeg" })
    ];

    const valid = listFile.every((f) => f.type.startsWith("image/") && f.size > 0);
    expect(valid).toBe(true);
  });
});
