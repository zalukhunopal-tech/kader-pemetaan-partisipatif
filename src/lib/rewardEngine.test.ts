import { describe, expect, it } from "vitest";
import {
  BATAS_SKOR_DISKUSI,
  JEDA_PEMBARUAN_JAM,
  cekPembaruanBaru,
  hitungCapaianKader,
  hitungPeringkatGis20Level,
  hitungPembaruanSah
} from "./rewardEngine";
import { dihitungUntukCapaian } from "./geoUtils";
import { DataSpasialItem, PembaruanObjek, PesanKomunikasi, ProfilKader } from "../types";

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 28, 8, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

const profil = {
  idKader: "KDR-001",
  nama: "Budi",
  modeKombinasiTarget: "per_kategori"
} as ProfilKader;

function objek(over: Partial<DataSpasialItem> = {}): DataSpasialItem {
  return {
    id: "SPS-1",
    idKader: "KDR-001",
    namaKader: "Budi",
    desaWilayah: "-",
    jenisGeometri: "point",
    kategori: "Flora",
    judul: "t",
    deskripsi: "",
    koordinat: [{ lat: -0.9, lng: 100.4 }],
    panjangKm: 0,
    luasHa: 0,
    statusSinkron: "lokal",
    createdAt: iso(NOW - 48 * H),
    updatedAt: "",
    riwayatPembaruan: [],
    ...over
  };
}
const banyakTitik = (n: number, over: Partial<DataSpasialItem> = {}) =>
  Array.from({ length: n }, (_, i) =>
    objek({ id: `P-${i}`, koordinat: [{ lat: -0.9, lng: 100.4 + i * 1e-5, ...(over.koordinat?.[0] ?? {}) }], ...over })
  );
const jalur = (km5: boolean, sim = false) =>
  objek({
    id: "L-1",
    jenisGeometri: "line",
    koordinat: Array.from({ length: 60 }, (_, i) => ({ lat: -0.9478 + i * 0.0008, lng: 100.4, ...(sim ? { simulasi: true } : {}) })),
    panjangKm: km5 ? 5.25 : 1
  });
const upd = (ms: number, teks: string, over: Partial<PembaruanObjek> = {}): PembaruanObjek => ({
  id: "U" + ms,
  tanggal: iso(ms),
  idKader: "KDR-001",
  olehKader: "Budi",
  kondisiTerbaru: teks,
  catatan: "",
  ...over
});

describe("paket capaian", () => {
  it("50 titik = 1 paket dan berhak sertifikat; 49 titik belum", () => {
    expect(hitungCapaianKader(banyakTitik(50), profil).berhakSertifikat).toBe(true);
    expect(hitungCapaianKader(banyakTitik(49), profil).berhakSertifikat).toBe(false);
  });
  it("5 km jalur = 1 paket", () => {
    const c = hitungCapaianKader([jalur(true)], profil);
    expect(c.totalTrackingKm).toBeCloseTo(5.25, 2);
    expect(c.berhakSertifikat).toBe(true);
  });
  it("data kader lain dan data ditolak tidak dihitung", () => {
    const data = [...banyakTitik(30), ...banyakTitik(30, { idKader: "KDR-002" }).map((d) => ({ ...d, id: "Z" + d.id }))];
    expect(hitungCapaianKader(data, profil).totalPoinTitik).toBe(30);
    expect(hitungCapaianKader(banyakTitik(50, { statusSinkron: "ditolak" }), profil).totalPoinTitik).toBe(0);
  });
  it("mode hanya terverifikasi hanya menghitung data terverifikasi", () => {
    const data = [...banyakTitik(20), ...banyakTitik(20, { statusSinkron: "terverifikasi" }).map((d) => ({ ...d, id: "V" + d.id }))];
    expect(hitungCapaianKader(data, profil, true).totalPoinTitik).toBe(20);
    expect(hitungCapaianKader(data, profil, false).totalPoinTitik).toBe(40);
  });
});

describe("data simulasi (K2)", () => {
  it("jalur 5 km hasil simulasi tidak dihitung sama sekali", () => {
    const c = hitungCapaianKader([jalur(true, true)], profil);
    expect(c.totalTrackingKm).toBe(0);
    expect(c.berhakSertifikat).toBe(false);
  });
  it("campuran 30 simulasi + 20 asli = 20 titik", () => {
    const sim = banyakTitik(30, { koordinat: [{ lat: 0, lng: 0, simulasi: true }] }).map((d) => ({ ...d, id: "S" + d.id }));
    expect(hitungCapaianKader([...sim, ...banyakTitik(20)], profil).totalPoinTitik).toBe(20);
  });
  it("skor level data simulasi = 0, data asli > 0", () => {
    expect(hitungPeringkatGis20Level([jalur(true, true)], profil).skorTotal).toBe(0);
    expect(hitungPeringkatGis20Level([jalur(true)], profil).skorTotal).toBeGreaterThan(0);
  });
});

describe("data impor (T6)", () => {
  const impor = (n: number, status: DataSpasialItem["statusSinkron"] = "lokal") =>
    banyakTitik(n, { diimpor: true, statusSinkron: status }).map((d) => ({ ...d, id: "I" + d.id }));

  it("data impor baru dihitung setelah diverifikasi admin", () => {
    expect(hitungCapaianKader(impor(50), profil).totalPoinTitik).toBe(0);
    expect(hitungCapaianKader(impor(50, "terverifikasi"), profil).totalPoinTitik).toBe(50);
  });
  it("data impor lama tanpa penanda dikenali dari awalan ID IMP-", () => {
    const lama = banyakTitik(50).map((d, i) => ({ ...d, id: `IMP-17300000-${i}` }));
    expect(hitungCapaianKader(lama, profil).totalPoinTitik).toBe(0);
    expect(dihitungUntukCapaian({ ...lama[0], statusSinkron: "terverifikasi" })).toBe(true);
  });
  it("data simulasi tetap tidak dihitung walau sudah diverifikasi", () => {
    const sim = objek({ statusSinkron: "terverifikasi", koordinat: [{ lat: 0, lng: 0, simulasi: true }] });
    expect(dihitungUntukCapaian(sim)).toBe(false);
  });
});

describe("pembaruan objek (T7)", () => {
  it("50 pembaruan per menit pada objek berumur 2 hari hanya dihitung 1", () => {
    const riwayat = Array.from({ length: 50 }, (_, i) => upd(NOW - 100 * 60_000 + i * 60_000, "kondisi " + i));
    expect(hitungPembaruanSah(objek({ riwayatPembaruan: riwayat }))).toBe(1);
  });
  it("pembaruan dalam 24 jam pertama sejak objek dibuat tidak dihitung", () => {
    const o = objek({ createdAt: iso(NOW - 1 * H), riwayatPembaruan: [upd(NOW - 30 * 60_000, "x")] });
    expect(hitungPembaruanSah(o)).toBe(0);
  });
  it("50 pembaruan harian dengan isi berbeda dihitung semuanya", () => {
    const riwayat = Array.from({ length: 50 }, (_, i) => upd(NOW - (55 - i) * 24 * H, "kondisi " + i));
    expect(hitungPembaruanSah(objek({ createdAt: iso(NOW - 60 * 24 * H), riwayatPembaruan: riwayat }))).toBe(50);
  });
  it("isi yang sama berulang (spasi/huruf besar diabaikan) dihitung sekali", () => {
    const riwayat = Array.from({ length: 10 }, (_, i) => upd(NOW - (15 - i) * 24 * H, i % 2 ? "  KONDISI   Baik " : "kondisi baik"));
    expect(hitungPembaruanSah(objek({ createdAt: iso(NOW - 30 * 24 * H), riwayatPembaruan: riwayat }))).toBe(1);
  });
  it("pembaruan oleh kader lain tidak menambah poin pemilik; entri lama dicocokkan lewat nama", () => {
    expect(hitungPembaruanSah(objek({ riwayatPembaruan: [upd(NOW - 10 * H, "x", { idKader: "KDR-9", olehKader: "Sari" })] }))).toBe(0);
    expect(hitungPembaruanSah(objek({ riwayatPembaruan: [upd(NOW - 10 * H, "x", { idKader: undefined })] }))).toBe(1);
    expect(hitungPembaruanSah(objek({ riwayatPembaruan: [upd(NOW - 10 * H, "x", { idKader: undefined, olehKader: "Sari" })] }))).toBe(0);
  });
  it("tanggal rusak diabaikan tanpa galat", () => {
    expect(hitungPembaruanSah(objek({ riwayatPembaruan: [{ ...upd(NOW, "x"), tanggal: "bukan tanggal" }] }))).toBe(0);
  });
  it("1 titik + 49 pembaruan beruntun = 2 poin, bukan 50", () => {
    const riwayat = Array.from({ length: 49 }, (_, i) => upd(NOW - 100 * 60_000 + i * 60_000, "kondisi " + i));
    const c = hitungCapaianKader([objek({ riwayatPembaruan: riwayat })], profil);
    expect(c.totalPoinTitik).toBe(2);
    expect(c.berhakSertifikat).toBe(false);
  });
});

describe("cekPembaruanBaru", () => {
  const lama = objek({ createdAt: iso(NOW - 5 * 24 * H), riwayatPembaruan: [upd(NOW - 2 * H, "Sehat", { catatan: "daun hijau" })] });
  it(`ditolak dalam ${JEDA_PEMBARUAN_JAM} jam dengan sisa waktu`, () => {
    const r = cekPembaruanBaru(lama, "Layu", "", NOW);
    expect(r.boleh).toBe(false);
    expect(r.alasan).toMatch(/22 jam/);
  });
  it("isi yang sama ditolak walau jeda sudah lewat", () => {
    const r = cekPembaruanBaru(lama, "  sehat ", "Daun  Hijau", NOW + 25 * H);
    expect(r.boleh).toBe(false);
    expect(r.alasan).toMatch(/sama/);
  });
  it("isi berubah setelah jeda diterima", () => {
    expect(cekPembaruanBaru(lama, "Layu", "", NOW + 25 * H).boleh).toBe(true);
  });
  it("objek yang baru dibuat harus menunggu", () => {
    const r = cekPembaruanBaru(objek({ createdAt: iso(NOW - 3 * H) }), "Sehat", "", NOW);
    expect(r.boleh).toBe(false);
    expect(r.alasan).toMatch(/dibuat/);
  });
});

describe("skor diskusi (S4)", () => {
  const pesan = (n: number, over: Partial<PesanKomunikasi> = {}): PesanKomunikasi[] =>
    Array.from({ length: n }, (_, i) => ({
      id: "M" + i + (over.idPengirim ?? ""),
      saluran: "komunitas",
      idPengirim: "KDR-001",
      namaPengirim: "Budi",
      peranPengirim: "kader",
      desaPengirim: "-",
      teks: "halo",
      waktu: "08:00",
      statusKirim: "terkirim",
      ...over
    }));

  it("50 pesan tidak lagi menaikkan kader ke Level 9", () => {
    const hasil = hitungPeringkatGis20Level([], profil, pesan(50), []);
    expect(hasil.rincianSkor.skorDiskusi).toBe(BATAS_SKOR_DISKUSI);
    expect(hasil.levelSaatIni.level).toBeLessThan(5);
  });
  it("pesan orang lain dengan nama yang sama tidak dihitung", () => {
    const hasil = hitungPeringkatGis20Level([], profil, pesan(10, { idPengirim: "KDR-777", namaPengirim: "Budi" }), []);
    expect(hasil.rincianSkor.skorDiskusi).toBe(0);
  });
  it("saluran helpdesk admin tidak menghasilkan skor", () => {
    expect(hitungPeringkatGis20Level([], profil, pesan(10, { saluran: "admin" }), []).rincianSkor.skorDiskusi).toBe(0);
  });
  it("sedikit pesan dihitung proporsional di bawah batas", () => {
    expect(hitungPeringkatGis20Level([], profil, pesan(3), []).rincianSkor.skorDiskusi).toBe(45);
  });
});
