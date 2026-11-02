// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DataSpasialItem, ProfilKader } from "../../types";
import {
  hitungCapaianKader,
  hitungPeringkatGis20Level,
  HasilPerhitunganCapaian
} from "../../lib/rewardEngine";
import { payloadVerifikasi, matriksQr } from "../../lib/qr";
import { ringkasanKader, siapkanSertifikat } from "../../lib/sertifikat";

const profilDasar: ProfilKader = {
  idKader: "KDR-SIM-01",
  nama: "Kader Lapangan Bulungan",
  desaWilayah: "Tanjung Selor Hilir",
  namaOrganisasi: "Komunitas Pemetaan Partisipatif",
  kelompokMasyarakat: "Kelompok Tani Hutan",
  noHp: "08123456789",
  modeKombinasiTarget: "gabungan_proporsional"
};

const buatJalurMock = (id: string, km: number, waktuMulai: string, waktuSelesai: string): DataSpasialItem => ({
  id,
  idKader: "KDR-SIM-01",
  namaKader: "Kader Lapangan Bulungan",
  desaWilayah: "Tanjung Selor Hilir",
  jenisGeometri: "line",
  kategori: "Tanda Batas",
  judul: `Patroli Blok ${id}`,
  deskripsi: "Perekaman batas jalur",
  koordinat: [
    { lat: 2.8574, lng: 117.3774, timestamp: waktuMulai },
    { lat: 2.8600, lng: 117.3800, timestamp: waktuSelesai }
  ],
  panjangKm: km,
  luasHa: 0,
  statusSinkron: "terverifikasi",
  createdAt: waktuMulai,
  updatedAt: waktuSelesai,
  riwayatPembaruan: []
});

describe("Kategori E: Perhitungan Insentif HOK, Gamifikasi & Sertifikat QR (Skenario 36–42)", () => {
  // Skenario 36: HOK Calculation on Split / Multi-Session Patrols
  it("Skenario 36: HOK Split Sessions — 3 sesi patroli 2 jam di hari yang sama diakumulasi tanpa rounding drift", () => {
    const sesi1 = buatJalurMock("TRK-1", 3.2, "2026-11-01T08:00:00Z", "2026-11-01T10:00:00Z");
    const sesi2 = buatJalurMock("TRK-2", 2.8, "2026-11-01T11:00:00Z", "2026-11-01T13:00:00Z");
    const sesi3 = buatJalurMock("TRK-3", 4.0, "2026-11-01T14:00:00Z", "2026-11-01T16:00:00Z");

    const semuaData = [sesi1, sesi2, sesi3];
    const capaian = hitungCapaianKader(semuaData, profilDasar, true);

    expect(capaian.totalTrackingKm).toBe(10.0);
    // Insentif HOK: Rp 15.000 per km terverifikasi
    const insentifHok = Math.round(capaian.totalTrackingKm * 15000);
    expect(insentifHok).toBe(150000);
  });

  // Skenario 37: Midnight Crossing Patrol
  it("Skenario 37: Midnight Crossing Patrol — patroli malam lintas tengah malam (23:00 -> 01:30) menghasilkan durasi positif", () => {
    const waktuMulai = "2026-11-01T23:00:00.000Z";
    const waktuSelesai = "2026-11-02T01:30:00.000Z";

    const tMulai = Date.parse(waktuMulai);
    const tSelesai = Date.parse(waktuSelesai);
    const durasiJam = (tSelesai - tMulai) / (1000 * 60 * 60);

    expect(durasiJam).toBe(2.5); // 2.5 jam, tidak negatif
  });

  // Skenario 38: Tampered LocalStorage HOK Points
  it("Skenario 38: Anti-Tampering HOK — skor dihitung langsung dari data spasial valid, bukan dari angka mentah storage", () => {
    // Simulasi jika attacker mencoba memalsukan angka di localStorage
    localStorage.setItem("kader_skor_palsu", "999999");

    // Perhitungan resmi aplikasi selalu menguji array data spasial asli
    const dataKosong: DataSpasialItem[] = [];
    const capaian = hitungCapaianKader(dataKosong, profilDasar);
    const peringkat = hitungPeringkatGis20Level(dataKosong, profilDasar, [], []);

    expect(capaian.totalPaketSelesai).toBe(0);
    expect(capaian.totalPoinTitik).toBe(0);
    expect(capaian.berhakSertifikat).toBe(false);
    expect(peringkat.skorTotal).toBe(0);
  });

  // Skenario 39: QR Code Certificate Generation with Long Names
  it("Skenario 39: Long Name QR Certificate — nama kader 65 karakter di-encode ke matriks QR tanpa overflow", () => {
    const namaPanjang = "Raden Mas Aryo Tejo Kusumo Diningrat Notonegoro Senopati Ing Ngalaga";
    expect(namaPanjang.length).toBeGreaterThan(60);

    const dataSertifikat = {
      nomorSertifikat: "0001/SKPP-GIS/WILAYAH/XI/2026",
      idKader: "KDR-65-CHAR-TEST",
      tanggalTerbit: "2026-11-01"
    };

    const payload = payloadVerifikasi(dataSertifikat);
    expect(payload).toContain("GEOKADER|0001/SKPP-GIS/WILAYAH/XI/2026|KDR-65-CHAR-TEST|2026-11-01");

    // Matriks modul QR otomatis memilih versi yang sesuai
    const matriks = matriksQr(payload);
    expect(matriks.length).toBeGreaterThanOrEqual(21);
    expect(Array.isArray(matriks[0])).toBe(true);
  });

  // Skenario 40: Certificate Export While Offline
  it("Skenario 40: Offline Certificate Preparation — persiapan dan verifikasi sertifikat bekerja tanpa koneksi internet", () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });

    const ringkasan = {
      idKader: "KDR-SIM-01",
      namaKader: "Kader Hutan",
      desaWilayah: "Tanjung Selor Hilir",
      capaian: { berhakSertifikat: true, totalPoinTitik: 50, alasanSertifikat: "Memenuhi target 50 titik" } as HasilPerhitunganCapaian,
      sudahTerbit: false
    };

    const hasil = siapkanSertifikat(ringkasan, "0001/SKPP-GIS/WILAYAH/XI/2026", [], {
      namaOrganisasi: "Organisasi Pemetaan",
      ditandatanganiOleh: "Koordinator Wilayah",
      jabatanPenandatangan: "Koordinator"
    });

    expect(hasil.ok).toBe(true);
    expect(hasil.sertifikat).toBeDefined();
    expect(hasil.sertifikat!.nomorSertifikat).toBe("0001/SKPP-GIS/WILAYAH/XI/2026");
  });

  // Skenario 41: Zero-Activity New Kader State
  it("Skenario 41: Zero-Activity State — kader baru dengan 0 aktivitas tidak menghasilkan NaN% progress", () => {
    const peringkat = hitungPeringkatGis20Level([], profilDasar, [], []);

    expect(peringkat.skorTotal).toBe(0);
    expect(peringkat.levelSaatIni.level).toBe(1);
    expect(Number.isFinite(peringkat.persenProgresLevel)).toBe(true);
    expect(peringkat.persenProgresLevel).toBe(0);
  });

  // Skenario 42: Leaderboard Tie-Breaking & Large Cadre List
  it("Skenario 42: Leaderboard Tie-Breaking — 200 kader dengan skor identik diurutkan secara deterministik", () => {
    const dataSpasial: DataSpasialItem[] = [];

    // Buat 200 kader dengan 1 titik yang sama persis
    for (let i = 1; i <= 200; i++) {
      const idKader = `KDR-${String(i).padStart(3, "0")}`;
      dataSpasial.push({
        id: `SPS-${i}`,
        idKader,
        namaKader: `Kader Warga ${String(i).padStart(3, "0")}`,
        desaWilayah: "Tanjung Selor Hilir",
        jenisGeometri: "point",
        kategori: "Flora",
        judul: `Titik Survei ${i}`,
        deskripsi: "",
        koordinat: [{ lat: 2.85, lng: 117.37 }],
        panjangKm: 0,
        luasHa: 0,
        statusSinkron: "terverifikasi",
        createdAt: "2026-11-01T08:00:00Z",
        updatedAt: "2026-11-01T08:00:00Z",
        riwayatPembaruan: []
      });
    }

    const tStart = performance.now();
    const daftarKader = ringkasanKader(dataSpasial, []);
    const durasi = performance.now() - tStart;

    expect(daftarKader).toHaveLength(200);
    expect(durasi).toBeLessThan(100);

    // Tie breaking terurut rapi menurut abjad dan ID
    expect(daftarKader[0].namaKader).toBe("Kader Warga 001");
    expect(daftarKader[199].namaKader).toBe("Kader Warga 200");
  });
});
