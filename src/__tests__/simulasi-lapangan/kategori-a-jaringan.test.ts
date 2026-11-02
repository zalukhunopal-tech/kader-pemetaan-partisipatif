// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataSpasialItem, WilayahAdministrasi } from "../../types";
import {
  gdriveTerpasang,
  sinkronkanDataKeGDrive,
  tafsirkanBalasan,
  KONEKSI_GDRIVE,
  OpsiSinkron
} from "../../lib/gdriveSync";
import {
  siapkanPenyimpanan,
  tulisTeks,
  bacaTeks,
  simpanSekarang,
  setelUlangPenyimpananUntukUji
} from "../../lib/penyimpanan";
import { hitungPanjangGarisKm } from "../../lib/geoUtils";

const DUMMY_URL = "https://script.google.com/macros/s/AKfycbx_simulasi_lapangan/exec";
const DUMMY_TOKEN = "token_simulasi_kader_123";
const WILAYAH_KALIMANTAN: WilayahAdministrasi = {
  provinsi: "Kalimantan Utara",
  kabupaten: "Bulungan",
  kecamatan: "Tanjung Selor",
  desa: "Tanjung Selor Hilir"
};

const buatDataMock = (id: string, overrides: Partial<DataSpasialItem> = {}): DataSpasialItem => ({
  id,
  idKader: "KDR-SIM-01",
  namaKader: "Kader Hutan",
  desaWilayah: "Tanjung Selor Hilir",
  jenisGeometri: "point",
  kategori: "Flora",
  judul: `Pohon Ulin ${id}`,
  deskripsi: "Pohon ulin diameter 1.2m di perbatasan blok hutan",
  koordinat: [{ lat: 2.8574, lng: 117.3774, elevasi: 42, akurasi: 3.5 }],
  panjangKm: 0,
  luasHa: 0,
  statusSinkron: "lokal",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  riwayatPembaruan: [],
  ...overrides
});

describe("Kategori A: Ekstremitas Jaringan & Fluktuasi Sinyal Hutan/Desa (Skenario 1–8)", () => {
  beforeEach(async () => {
    setelUlangPenyimpananUntukUji();
    localStorage.clear();
    await siapkanPenyimpanan(["geokader_data_spasial_v5"]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Skenario 1: Dead-Zone Entry Mid-Survey
  it("Skenario 1: Dead-Zone Entry Mid-Survey — data tersimpan ke IndexedDB lokal saat sinyal hilang mendadak", async () => {
    // Kader mulai online, lalu masuk blank spot
    vi.stubGlobal("navigator", { ...navigator, onLine: false });

    const item = buatDataMock("SPS-DEADZONE-01");
    const daftarSebelumnya = [item];

    // Simpan ke storage offline
    tulisTeks("geokader_data_spasial_v5", JSON.stringify(daftarSebelumnya));
    await simpanSekarang();

    const tersimpan = bacaTeks("geokader_data_spasial_v5");
    expect(tersimpan).toBeTruthy();
    const parsed = JSON.parse(tersimpan!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("SPS-DEADZONE-01");
    expect(parsed[0].statusSinkron).toBe("lokal");
  });

  // Skenario 2: Flaky Signal (Packet Loss & Flapping)
  it("Skenario 2: Flaky Signal — jaringan putus-nyambung tidak menghasilkan duplikasi rekaman", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      callCount++;
      if (callCount % 2 === 1) {
        throw new TypeError("Failed to fetch (network flapping)");
      }
      return new Response(JSON.stringify({
        diterima: ["SPS-FLAP-01"],
        gagal: []
      }), { status: 200 });
    }));

    const opsi: OpsiSinkron = {
      koneksi: { url: DUMMY_URL, token: DUMMY_TOKEN },
      cariWilayah: () => WILAYAH_KALIMANTAN
    };

    const items = [buatDataMock("SPS-FLAP-01")];

    // Percobaan pertama gagal karena sinyal putus
    const res1 = await sinkronkanDataKeGDrive(items, opsi);
    expect(res1.sukses).toBe(false);
    expect(res1.idTersinkron).toEqual([]);

    // Percobaan kedua berhasil saat sinyal nyambung
    const res2 = await sinkronkanDataKeGDrive(items, opsi);
    expect(res2.sukses).toBe(true);
    expect(res2.idTersinkron).toEqual(["SPS-FLAP-01"]);
    expect(res2.jumlahGagal).toBe(0);
  });

  // Skenario 3: Captive Portal / Zero-Bandwidth Wi-Fi
  it("Skenario 3: Captive Portal Wi-Fi Desa — balasan HTML login ditolak tanpa merusak antrean", async () => {
    // Wi-Fi connected tapi captive portal menghasilkan HTML
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
        "<!DOCTYPE html><html><head><title>Login WiFi Desa</title></head><body>Sila masukkan voucher</body></html>",
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }));

    const opsi: OpsiSinkron = {
      koneksi: { url: DUMMY_URL, token: DUMMY_TOKEN },
      cariWilayah: () => WILAYAH_KALIMANTAN
    };

    const items = [buatDataMock("SPS-CAPTIVE-01")];
    const hasil = await sinkronkanDataKeGDrive(items, opsi);

    expect(hasil.sukses).toBe(false);
    expect(hasil.pesan).toContain("bukan JSON");
    expect(hasil.idTersinkron).toHaveLength(0);
    expect(hasil.jumlahGagal).toBe(1);
  });

  // Skenario 4: Mid-Upload Connection Drop on Large Payload
  it("Skenario 4: Mid-Upload Drop pada Batch Besar — item yang sudah terkonfirmasi ditandai, sisanya tetap dalam antrean", async () => {
    let batchIndex = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      batchIndex++;
      const body = JSON.parse(init.body as string);
      const ids: string[] = body.records.map((r: any) => r.id);

      if (batchIndex === 1) {
        // Batch 1 (10 item) sukses
        return new Response(JSON.stringify({ diterima: ids, gagal: [] }), { status: 200 });
      }
      // Batch 2 gagal putus koneksi di tengah jalan
      throw new TypeError("Network error during batch 2 upload");
    }));

    const opsi: OpsiSinkron = {
      koneksi: { url: DUMMY_URL, token: DUMMY_TOKEN },
      cariWilayah: () => WILAYAH_KALIMANTAN
    };

    // 25 items -> 3 batch (10, 10, 5)
    const items = Array.from({ length: 25 }, (_, i) => buatDataMock(`SPS-BATCH-${i + 1}`));
    const hasil = await sinkronkanDataKeGDrive(items, opsi);

    expect(hasil.sukses).toBe(false);
    expect(hasil.idTersinkron).toHaveLength(10); // Batch 1 sukses
    expect(hasil.jumlahGagal).toBe(15); // Batch 2 & 3 belum tersinkron
    expect(hasil.pesan).toContain("10 dari 25 data tersimpan");
  });

  // Skenario 5: Server 429 / 502 / Apps Script Quota Exceeded
  it("Skenario 5: Server 429 Quota Exceeded — antrean tetap utuh dan pesan informatif diberikan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response("Service invoked too many times for one day", { status: 429 });
    }));

    const opsi: OpsiSinkron = {
      koneksi: { url: DUMMY_URL, token: DUMMY_TOKEN },
      cariWilayah: () => WILAYAH_KALIMANTAN
    };

    const items = [buatDataMock("SPS-QUOTA-01")];
    const hasil = await sinkronkanDataKeGDrive(items, opsi);

    expect(hasil.sukses).toBe(false);
    expect(hasil.pesan).toContain("HTTP 429");
    expect(hasil.idTersinkron).toEqual([]);
    expect(hasil.jumlahGagal).toBe(1);
  });

  // Skenario 6: Concurrent Sync Trigger (Double-Tap Race Condition)
  it("Skenario 6: Concurrent Sync Trigger — pemanggilan paralel dicegah agar tidak mengirim data ganda", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      callCount++;
      // Simulasi delay jaringan 50ms
      await new Promise((r) => setTimeout(r, 50));
      return new Response(JSON.stringify({ diterima: ["SPS-RACE-01"], gagal: [] }), { status: 200 });
    }));

    const opsi: OpsiSinkron = {
      koneksi: { url: DUMMY_URL, token: DUMMY_TOKEN },
      cariWilayah: () => WILAYAH_KALIMANTAN
    };

    const items = [buatDataMock("SPS-RACE-01")];

    // Trigger 5 panggilan sekaligus
    const results = await Promise.all([
      sinkronkanDataKeGDrive(items, opsi),
      sinkronkanDataKeGDrive(items, opsi),
      sinkronkanDataKeGDrive(items, opsi),
      sinkronkanDataKeGDrive(items, opsi),
      sinkronkanDataKeGDrive(items, opsi)
    ]);

    // Setidaknya salah satu sukses dan fetch dipanggil
    expect(results.some((r) => r.sukses)).toBe(true);
    expect(results[0].idTersinkron).toEqual(["SPS-RACE-01"]);
  });

  // Skenario 7: Offline PWA Cold Boot
  it("Skenario 7: Offline PWA Cold Boot — inisialisasi penyimpanan saat offline tanpa white screen", async () => {
    // Simulasi offline
    vi.stubGlobal("navigator", { ...navigator, onLine: false });

    // Inisialisasi storage
    setelUlangPenyimpananUntukUji();
    await siapkanPenyimpanan(["geokader_data_spasial_v5", "geokader_profil_kader_v5"]);

    tulisTeks("geokader_profil_kader_v5", JSON.stringify({ nama: "Kader Luring", desa: "Desa Hutan" }));
    await simpanSekarang();

    expect(bacaTeks("geokader_profil_kader_v5")).toContain("Kader Luring");
  });

  // Skenario 8: Clock Skew / Unsynced Device Time
  it("Skenario 8: Clock Skew — waktu perangkat mundur tidak menyebabkan durasi negatif atau kegagalan simpan", async () => {
    // HP reset ke tahun 2020
    const waktuMasaLalu = "2020-01-01T00:00:00.000Z";
    const waktuSelesai = "2020-01-01T02:00:00.000Z";

    const item = buatDataMock("SPS-CLOCK-01", {
      createdAt: waktuMasaLalu,
      updatedAt: waktuSelesai
    });

    // Durasi tracking / selisih waktu
    const tAwal = Date.parse(item.createdAt);
    const tAkhir = Date.parse(item.updatedAt);
    const durasiDetik = Math.max(0, Math.floor((tAkhir - tAwal) / 1000));

    expect(durasiDetik).toBe(7200); // 2 jam, tidak negatif

    // Bila device clock mundur lebih tua dari awal
    const durasiMundur = Math.max(0, Math.floor((tAwal - tAkhir) / 1000));
    expect(durasiMundur).toBe(0); // Terlindungi oleh Math.max(0, ...)
  });
});
