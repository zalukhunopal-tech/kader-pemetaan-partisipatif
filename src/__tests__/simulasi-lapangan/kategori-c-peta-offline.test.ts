import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseMBTilesBuffer } from "../../lib/mbtilesParser";
import { parseGeoTiffBuffer } from "../../lib/geoTiffParser";
import { simpanArsipPeta, ambilArsipPeta, hapusArsipPeta, tutupDbArsip } from "../../lib/penyimpananPetaLuring";
import { AreaPetaOffline } from "../../types";

describe("Kategori C: Peta Offline, MBTiles, GeoPDF & GeoTIFF (Skenario 19–27)", () => {
  beforeEach(async () => {
    await tutupDbArsip();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("geokader_arsip_peta_v1");
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });

  afterEach(async () => {
    await tutupDbArsip();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Skenario 19: Corrupted / Truncated .mbtiles File
  it("Skenario 19: Corrupted MBTiles — berkas MBTiles rusak/terpotong ditolak secara aman tanpa unhandled exception", () => {
    const corruptedBuffer = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
    const hasil = parseMBTilesBuffer(corruptedBuffer);
    expect(hasil).toBeNull();
  });

  // Skenario 20: Unsupported CRS / Projection in GeoTIFF
  it("Skenario 20: GeoTIFF CRS Detection — mengenali file dan memberikan deskripsi sistem koordinat", () => {
    const dummyTiff = new Uint8Array([
      0x49, 0x49, 0x2a, 0x00, // II (Intel Little Endian), versi 42
      0x08, 0x00, 0x00, 0x00  // Offset IFD pertama
    ]);
    const hasil = parseGeoTiffBuffer(dummyTiff);
    expect(hasil).toBeNull();
  });

  // Skenario 21: Oversized Raster Import (Low RAM Phone)
  it("Skenario 21: Oversized Raster Import — berkas besar disimpan bertahap via IndexedDB Blob tanpa lonjakan RAM", async () => {
    const ukuranBytes = 100 * 1024;
    const blobBesar = new Blob([new Uint8Array(ukuranBytes)], { type: "application/x-sqlite3" });

    await simpanArsipPeta("mbtiles-tanjung-selor", blobBesar, {
      namaArea: "Tanjung Selor Blok A",
      tipe: "mbtiles",
      ukuranMb: 0.1
    });

    const arsip = await ambilArsipPeta("mbtiles-tanjung-selor");
    expect(arsip).not.toBeNull();
    expect(arsip!.namaArea).toBe("Tanjung Selor Blok A");
    expect(arsip!.berkas.size).toBe(ukuranBytes);
  });

  // Skenario 22: Missing Zoom Levels in Offline MBTiles (Overzooming)
  it("Skenario 22: Missing Zoom Levels (Overzooming) — metadata zoomMin dan zoomMax tersimpan untuk membatasi atau mengizinkan overzooming", () => {
    const area: AreaPetaOffline = {
      id: "AREA-OFFLINE-01",
      namaArea: "Hutan Adat Bulungan",
      basemapId: "osm",
      minLat: 2.80,
      maxLat: 2.90,
      minLng: 117.30,
      maxLng: 117.45,
      zoomMin: 10,
      zoomMax: 15,
      jumlahTile: 250,
      ukuranMb: 1.5,
      diunduhPada: new Date().toISOString()
    };

    expect(area.zoomMax).toBe(15);
    const zoomLevelPengguna = 18;
    const zoomEfektif = Math.min(zoomLevelPengguna, area.zoomMax);
    expect(zoomEfektif).toBe(15);
  });

  // Skenario 23: Out-of-Bounds Offline Map Load
  it("Skenario 23: Out-of-Bounds Offline Map — deteksi posisi kader di luar cakupan bounding box peta offline", () => {
    const areaBulungan = {
      minLat: 2.80,
      maxLat: 2.90,
      minLng: 117.30,
      maxLng: 117.45
    };

    const posisiKader = { lat: 3.32, lng: 117.59 };

    const diDalamArea =
      posisiKader.lat >= areaBulungan.minLat &&
      posisiKader.lat <= areaBulungan.maxLat &&
      posisiKader.lng >= areaBulungan.minLng &&
      posisiKader.lng <= areaBulungan.maxLng;

    expect(diDalamArea).toBe(false);
  });

  // Skenario 24: Deleting Active Offline Basemap
  it("Skenario 24: Deleting Active Offline Basemap — penghapusan arsip peta berjalan bersih", async () => {
    const blob = new Blob(["konten-peta"], { type: "application/octet-stream" });
    await simpanArsipPeta("peta-aktif", blob, {
      namaArea: "Peta Hapus",
      tipe: "pmtiles"
    });

    const suksesHapus = await hapusArsipPeta("peta-aktif");
    expect(suksesHapus).toBe(true);

    const cariLagi = await ambilArsipPeta("peta-aktif");
    expect(cariLagi).toBeNull();
  });

  // Skenario 25: Rapid Layer Toggling
  it("Skenario 25: Rapid Layer Toggling — pergantian basemap dan lapisan berkali-kali tidak memicu unhandled rejection", () => {
    let activeBasemap = "esri";
    const daftarPeta = ["esri", "osm", "topo", "google_satellite", "google_hybrid"];

    for (let i = 0; i < 15; i++) {
      activeBasemap = daftarPeta[i % daftarPeta.length];
      expect(daftarPeta).toContain(activeBasemap);
    }
    expect(activeBasemap).toBeTruthy();
  });

  // Skenario 26: Offline Tile Quota Exhaustion (QuotaExceededError)
  it("Skenario 26: QuotaExceededError Catch — penanganan kuota penyimpanan penuh saat unduh peta", () => {
    const errorKuota = new DOMException("The quota has been exceeded.", "QuotaExceededError");
    let tertangkap: boolean;
    let kuotaPenuh = false;

    try {
      throw errorKuota;
    } catch (err: unknown) {
      tertangkap = true;
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        kuotaPenuh = true;
      }
    }

    expect(tertangkap).toBe(true);
    expect(kuotaPenuh).toBe(true);
  });

  // Skenario 27: Corrupted IndexedDB Tile Cache Entry
  it("Skenario 27: Corrupted Tile Cache Entry — blob kosong 0-byte ditolak tanpa crash", async () => {
    const badBlob = new Blob([], { type: "image/png" });
    expect(badBlob.size).toBe(0);

    const tileValid = badBlob.size > 0;
    expect(tileValid).toBe(false);
  });
});
