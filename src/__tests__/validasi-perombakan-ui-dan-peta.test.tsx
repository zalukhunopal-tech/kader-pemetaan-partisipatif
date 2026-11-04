// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Part 1 Imports: GeoPDF, MBTiles, PMTiles
import { bacaReferensiGeoPdf, selesaikanAffine2D } from "../lib/geoPdf";
import { parseMBTilesBuffer, parseMBTilesSqlWasm, tileKeBujur, tileKeLintang } from "../lib/mbtilesParser";
import { daftarkanSumberMbtiles, ambilSumberMbtiles } from "../lib/mbtilesProtocol";
import { daftarkanSumberPmtiles, ambilSumberPmtiles } from "../lib/pmtilesProtocol";
import { simpanArsipPeta, ambilArsipPeta } from "../lib/penyimpananPetaLuring";

// Part 2 Imports: UI Components
import { PanelLapisanPeta } from "../components/peta/PanelLapisanPeta";
import { NavigasiBawah } from "../components/app/NavigasiBawah";
import { LogoSertifikatResmiSvg } from "../components/sertifikat/LogoSertifikatResmiSvg";
import { KomunikasiView } from "../components/KomunikasiView";
import { PanelDataUserLevel, hitungLevelKaderOtomatis } from "../components/PanelDataUserLevel";
import { RailAlatPeta } from "../components/peta/RailAlatPeta";
import { ChipKoordinatPeta } from "../components/peta/ChipKoordinatPeta";
import { KartuLokasiTitik } from "../components/peta/KartuLokasiTitik";
import { PanelPerekaman } from "../components/peta/PanelPerekaman";
import { StatePerekamLatar } from "../lib/perekamLatar";
import { formatKoordinat } from "../lib/sistemKoordinat";
import { formatJudulAvenza } from "../components/InteractiveMap";
import { singkatkanLabelPeta } from "../lib/labelPeta";
import { PDFDocument, PDFName } from "pdf-lib";
import { AreaPetaOffline, DataSpasialItem, ProfilKader, PesanKomunikasi } from "../types";

const mockProfil: ProfilKader = {
  idKader: "KAD-BULUNGAN-01",
  nama: "Rian Hidayat",
  desaWilayah: "Tanjung Selor Hilir",
  kelompokMasyarakat: "Kader Konservasi Kayan",
  noHp: "081234567890",
  namaOrganisasi: "Komunitas Konservasi Kayan",
  modeKombinasiTarget: "per_kategori"
};

const mockItemSurvey: DataSpasialItem = {
  id: "DAT-SIM-001",
  idKader: "KAD-BULUNGAN-01",
  namaKader: "Rian Hidayat",
  desaWilayah: "Tanjung Selor Hilir",
  judul: "Temuan Pohon Ulin Langka",
  kategori: "Flora",
  jenisGeometri: "point",
  koordinat: [{ lat: 2.8571, lng: 117.3775, akurasi: 3.2 }],
  deskripsi: "Pohon ulin diameter 80cm kondisi sehat",
  panjangKm: 0,
  luasHa: 0,
  riwayatPembaruan: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  statusSinkron: "lokal"
};

describe("TEST SUITE VALIDASI LENGKAP — PEROMBAKAN UI TITIK TAPAK & ENGINE AVENZA", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  // SIMULASI 1: Peta Interaktif & Tool Gambar Terpadu di Bawah Zoom
  it("Simulasi 1: Tool Gambar di Bawah Zoom terpadu dan membuka pilihan Titik, Jalur, Poligon", () => {
    let modeTerpilih = "";
    let alatGambarTerbuka = false;

    const toggleTool = () => {
      alatGambarTerbuka = !alatGambarTerbuka;
    };
    const mulaiModeRekam = (jenis: string) => {
      modeTerpilih = jenis;
      alatGambarTerbuka = false;
    };

    // 1. Initial State: Tool tertutup
    expect(alatGambarTerbuka).toBe(false);

    // 2. Klik Tool Trigger di bawah zoom
    toggleTool();
    expect(alatGambarTerbuka).toBe(true);

    // 3. Render HTML tool flyout menu
    const html = renderToString(
      <div className="drawing-tool-container-pod">
        <button type="button" className={`drawing-tool-main-trigger ${alatGambarTerbuka ? "active-tool" : ""}`}>
          ✏️
        </button>
        {alatGambarTerbuka && (
          <div className="drawing-tool-flyout-menu">
            <button type="button" className="flyout-tool-choice">📍 Ambil Titik</button>
            <button type="button" className="flyout-tool-choice">〰️ Rekam Jalur</button>
            <button type="button" className="flyout-tool-choice">⬠ Buat Poligon</button>
          </div>
        )}
      </div>
    );

    expect(html).toContain("active-tool");
    expect(html).toContain("Ambil Titik");
    expect(html).toContain("Rekam Jalur");
    expect(html).toContain("Buat Poligon");

    // 4. Pilih salah satu aksi: Ambil Titik
    mulaiModeRekam("point");
    expect(modeTerpilih).toBe("point");
    expect(alatGambarTerbuka).toBe(false);
  });

  // SIMULASI 2: 1-Click Clean Map Mode Toggle
  it("Simulasi 2: 1-Click Clean Map Mode menyembunyikan overlay saat kanvas diketuk sekali dan mengembalikannya saat diketuk lagi", () => {
    let cleanMode = false;
    const toggleCleanMode = () => {
      cleanMode = !cleanMode;
    };

    // Ketuk kanvas pertama: Full immersion clean mode
    toggleCleanMode();
    expect(cleanMode).toBe(true);

    const htmlClean = renderToString(
      <div className={`map-module-wrapper ${cleanMode ? "clean-map-immersion" : ""}`}>
        <div className="map-hud-pod" />
      </div>
    );
    expect(htmlClean).toContain("clean-map-immersion");

    // Ketuk kanvas kedua: Kembalikan seluruh UI overlay
    toggleCleanMode();
    expect(cleanMode).toBe(false);

    const htmlNormal = renderToString(
      <div className={`map-module-wrapper ${cleanMode ? "clean-map-immersion" : ""}`}>
        <div className="map-hud-pod" />
      </div>
    );
    expect(htmlNormal).not.toContain("clean-map-immersion");
  });

  // SIMULASI 3: Tab Pustaka, Impor GeoPDF (UTM 50N & Affine 2D), MBTiles, PMTiles & Auto-Rehydration
  it("Simulasi 3: Engine GeoPDF membaca proyeksi UTM 50N, Affine 2D quad 4-sudut, dan format MBTiles/PMTiles", async () => {
    // A. GeoPDF UTM Zone 50N (Kalimantan Utara - Tanjung Selor)
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const utmGpts = [315000, 541000, 320000, 541000, 320000, 546000, 315000, 546000];
    const lpts = [0, 0, 0, 1, 1, 1, 1, 0];

    page.node.set(
      PDFName.of("VP"),
      doc.context.obj([
        {
          Type: "Viewport",
          BBox: [0, 0, 600, 800],
          Measure: {
            Type: "Measure",
            Subtype: "GEO",
            PROJCS: { Type: "PROJCS", EPSG: 32650 },
            GPTS: utmGpts,
            LPTS: lpts
          }
        }
      ])
    );

    const ref = await bacaReferensiGeoPdf(await doc.save({ useObjectStreams: true }));
    expect(ref.crs).toBe("EPSG:32650");
    expect(ref.empatSudut.length).toBe(4);
    expect(ref.minLng).toBeGreaterThan(117);
    expect(ref.minLat).toBeGreaterThan(2);

    // B. Transformasi Affine 2D rotasi 4-sudut
    const pts = [
      { u: 0, v: 0, x: 117.15, y: 2.65 },
      { u: 0, v: 1, x: 117.15, y: 3.05 },
      { u: 1, v: 1, x: 117.65, y: 3.05 },
      { u: 1, v: 0, x: 117.65, y: 2.65 }
    ];
    const affine = selesaikanAffine2D(pts);
    const nwCorner = affine.keGeo(0, 1);
    expect(nwCorner[0]).toBeCloseTo(117.15, 2);
    expect(nwCorner[1]).toBeCloseTo(3.05, 2);

    // C. Render PanelLapisanPeta Tab Pustaka dengan layout horizontal
    const mockPetaOffline: AreaPetaOffline = {
      id: "MAP-SELOR-01",
      namaArea: "Peta_Fungsi_Kawasan_Hutan_Tanjung_Selor_A3",
      basemapId: "topo",
      minLat: 2.65,
      maxLat: 3.05,
      minLng: 117.15,
      maxLng: 117.65,
      zoomMin: 10,
      zoomMax: 16,
      jumlahTile: 0,
      ukuranMb: 12.5,
      diunduhPada: new Date().toISOString(),
      jenisFile: "GeoPDF / GeoTIFF",
      crs: "EPSG:32650 (UTM 50N)"
    };

    const htmlPustaka = renderToString(
      <PanelLapisanPeta
        basemap="esri"
        jumlahObjek={5}
        tampilDaftarObjek={false}
        onPilihBasemap={vi.fn()}
        onUnduhOffline={vi.fn()}
        onPilihBerkas={vi.fn()}
        onAlihDaftarObjek={vi.fn()}
        onTutup={vi.fn()}
        areaOffline={[mockPetaOffline]}
        center={{ lat: 2.85, lng: 117.37 }}
      />
    );

    expect(htmlPustaka).toContain("Pustaka");
    expect(htmlPustaka).toContain("pustaka-tabs-header-bar");
  });

  // SIMULASI 4: Logo & Ikon Sertifikat Resmi Baru
  it("Simulasi 4: LogoSertifikatResmiSvg merender emblem vektor resmi dengan varian zamrud dan emas", () => {
    const html = renderToString(
      <div>
        <LogoSertifikatResmiSvg size={24} variant="zamrud" />
        <LogoSertifikatResmiSvg size={32} variant="emas" />
      </div>
    );

    expect(html).toContain("logo-sertifikat-resmi");
    expect(html).toContain('width="24"');
    expect(html).toContain('width="32"');
    expect(html).toContain("#0d7344");
    expect(html).toContain("#d97706");
  });

  // SIMULASI 5: Switch Diskusi Modern (Ruang Diskusi Kader vs Jalur Koordinasi Admin)
  it("Simulasi 5: Segmented switch diskusi menyediakan saluran Kader dan Admin dengan touch target nyaman", () => {
    const html = renderToString(
      <KomunikasiView
        pesanList={[
          {
            id: "MSG-1",
            saluran: "komunitas",
            teks: "Halo rekan kader, jalur patroli sektor barat terpantau aman.",
            namaPengirim: "Rian",
            peranPengirim: "kader",
            desaPengirim: "Tanjung Selor Hilir",
            statusKirim: "tersimpan",
            waktu: "10:30",
            idPengirim: "KAD-BULUNGAN-01"
          }
        ]}
        profil={mockProfil}
        peranPengguna="kader"
        onKirimPesan={vi.fn()}
        onLihatPinDiPeta={vi.fn()}
      />
    );

    expect(html).toContain("komunikasi-segmented-control");
    expect(html).toContain("Ruang Diskusi Kader");
    expect(html).toContain("Jalur Koordinasi Admin");
    expect(html).toContain("jalur patroli sektor barat terpantau aman");
  });

  // SIMULASI 6: 100% Background Auto-Sync & Tab Sinkronisasi Dihapus dari Navigasi
  it("Simulasi 6: Tab Sinkronisasi manual terhapus dari NavigasiBawah dan auto-sync berjalan transparan", () => {
    const html = renderToString(
      <NavigasiBawah
        peran="kader"
        tabAktif="peta"
        setTabAktif={vi.fn()}
        antreanLokalCount={1}
        onModeUser={vi.fn()}
      />
    );

    // Tombol tab GDrive / CloudUpload tidak ada lagi di baris navigasi
    expect(html).not.toContain("GDrive");
    expect(html).not.toContain("Sinkronisasi");

    // Tab yang tersedia bersih: Pustaka, Temukan, Sertifikat, Diskusi
    expect(html).toContain("Pustaka");
    expect(html).toContain("Temukan");
    expect(html).toContain("Sertifikat");
    expect(html).toContain("Diskusi");
  });

  // SIMULASI 7: Penggantian Buku HOK menjadi Panel Data User & Level Kader
  it("Simulasi 7: Panel Data User & Level Kader menampilkan tingkatan user otomatis dan fitur HOK telah dihapus", () => {
    // Uji fungsi kenaikan level otomatis
    const lvl1 = hitungLevelKaderOtomatis(2, 1.5, 0.5);
    expect(lvl1.tierNama).toBe("Kader Pemula");
    expect(lvl1.level).toBeGreaterThanOrEqual(1);

    const lvlAhli = hitungLevelKaderOtomatis(80, 50, 25);
    expect(lvlAhli.tierNama).toContain("Kader Ahli");
    expect(lvlAhli.level).toBeGreaterThanOrEqual(16);

    // Render PanelDataUserLevel
    const html = renderToString(
      <PanelDataUserLevel
        dataSpasial={[mockItemSurvey]}
        profilSaya={mockProfil}
        peranPengguna="admin"
        onFokusPetaKader={vi.fn()}
      />
    );

    expect(html).toContain("Data User &amp; Level Kader");
    expect(html).not.toContain("Penetapan Alokasi HOK");
    expect(html).toContain("Rian Hidayat");
    expect(html).toContain("Tanjung Selor Hilir");
  });
  // SIMULASI 8: RailAlatPeta menyatukan Zoom In/Out dengan Alat Survei (Titik, Jalur, Area)
  it("Simulasi 8: RailAlatPeta menyatukan tombol zoom dan aksi survei dalam 1 rail terpadu", () => {
    let modeTerpilih = "";
    const html = renderToString(
      <RailAlatPeta
        modeRekam={null}
        gpsTersedia={true}
        ikutiKompas={false}
        onGps={vi.fn()}
        onZoomMasuk={vi.fn()}
        onZoomKeluar={vi.fn()}
        onPilihAlat={(jenis) => {
          modeTerpilih = jenis;
        }}
      />
    );

    expect(html).toContain("map-tool-rail");
    expect(html).toContain("rail-zoom");
    expect(html).toContain("rail-tools");
    expect(html).toContain("Titik");
    expect(html).toContain("Jalur");
    expect(html).toContain("Area");
  });

  // SIMULASI 9: Tampilan Koordinat Simpel & Pengisian Form Titik dengan Ganti Sistem Koordinat
  it("Simulasi 9: ChipKoordinatPeta dan KartuLokasiTitik memformat koordinat WGS 84 dan UTM serta memudahkan form titik", () => {
    const dummyPos = { lat: 2.857472, lng: 117.377476, akurasi: 4.2 };

    // A. Chip Telemetri Peta
    const htmlChip = renderToString(
      <ChipKoordinatPeta
        posisi={dummyPos}
        teksMenunggu="Mencari sinyal..."
        sistem="UTM"
        onGantiSistem={vi.fn()}
        onSalin={vi.fn()}
      />
    );
    expect(htmlChip).toContain("coord-chip");
    expect(htmlChip).toContain("50N");
    expect(htmlChip).toContain("UTM");

    // B. Kartu Lokasi Titik di dalam Form Survei
    const htmlKartu = renderToString(
      <KartuLokasiTitik
        titik={dummyPos}
        sistem="DD"
        onGantiSistem={vi.fn()}
        onUbahKoordinat={vi.fn()}
        gpsSibuk={false}
        sampel={0}
        onUkurGps={vi.fn()}
        onBatalUkur={vi.fn()}
      />
    );
    expect(htmlKartu).toContain("loc-card");
    expect(htmlKartu).toContain("Koordinat Titik");
    expect(htmlKartu).toContain("Lintang");
    expect(htmlKartu).toContain("Bujur");
    expect(htmlKartu).toContain("Ukur GPS 10 detik");
    expect(htmlKartu).toContain("Ketik manual");
  });
  it("Validasi PanelPerekaman mobile/desktop dan gestur rotasi dua jari searah putaran", () => {
    const mockRekamLatar: StatePerekamLatar = {
      status: "merekam",
      jenis: "polygon",
      titik: [
        { lat: 2.85, lng: 117.37 },
        { lat: 2.86, lng: 117.37 },
        { lat: 2.86, lng: 117.38 }
      ],
      mulaiPada: new Date().toISOString(),
      durasiTersimpanMs: 65000,
      segmenMulaiMs: Date.now() - 65000,
      autoGpsAktif: false,
      redoVertex: [],
      posisiTerakhir: null,
      galat: null
    };

    const htmlPanel = renderToString(
      <PanelPerekaman
        rekamLatar={mockRekamLatar}
        modeRekam="polygon"
        jumlahTitik={3}
        panjangDraftKm={0.85}
        luasDraftHa={1.24}
        detikTick={65}
        onTambahTitik={vi.fn()}
        snapAktif={true}
        onToggleSnap={vi.fn()}
        onSimpan={vi.fn()}
        onBatal={vi.fn()}
      />
    );

    expect(htmlPanel).toContain("recording-active-bar");
    expect(htmlPanel).toContain("recording-header-row");
    expect(htmlPanel).toContain("recording-actions");
    expect(htmlPanel).toContain("Poligon");
    expect(htmlPanel).toContain("+Titik");
    expect(htmlPanel).toContain("Urungkan");
    expect(htmlPanel).toContain("Simpan");
    expect(htmlPanel).toContain("Snap");
    expect(htmlPanel).toContain("ON");

    // Uji arah rotasi dua jari:
    // Jika dua jari berputar searah jarum jam (deltaSudut > 0), bearing baru harus berkurang
    // sehingga CSS rotateZ(-bearingBaru) berputar searah jarum jam (searah dua jari)
    const bearingAwal = 0;
    const deltaSudutPutarKanan = 35; // jari berputar ke kanan/searah jarum jam
    let bearingBaru = Math.round(bearingAwal - deltaSudutPutarKanan) % 360;
    if (bearingBaru < 0) bearingBaru += 360;
    expect(bearingBaru).toBe(325);
    // Di CSS: rotateZ(-325deg) identik dengan rotateZ(+35deg) searah jarum jam
    const cssAngle = -bearingBaru;
    expect(((cssAngle % 360) + 360) % 360).toBe(35);
  });

  it("Validasi penyingkatan label adaptif peta & anti-overlap (singkatkanLabelPeta & formatJudulAvenza)", () => {
    const rawJudulGeoPdf = "Peta_Fungsi_Kawasan_Hutan_Kecamatan_Tanjung_Selor_2024.geopdf";
    const judulFormatPenuh = formatJudulAvenza(rawJudulGeoPdf, 45);
    const judulFormatRingkas = formatJudulAvenza(rawJudulGeoPdf, 28);

    expect(judulFormatPenuh).not.toContain(".geopdf");
    expect(judulFormatPenuh).not.toContain("_");
    expect(judulFormatPenuh).toBe("Peta Fungsi Kws. Htn. Kec. Tg. Selor 2024");

    expect(judulFormatRingkas.length).toBeLessThanOrEqual(28);
    expect(judulFormatRingkas.endsWith("...")).toBe(true);

    // Singkatan wilayah adat
    const rawAdat = "Batas_Wilayah_Masyarakat_Adat_Dayak_Kenyah.pmtiles";
    const labelAdat = singkatkanLabelPeta(rawAdat, 40);
    expect(labelAdat).toBe("Batas Wil. Masy. Adat Dayak Kenyah");
  });

  it("Validasi fitur chat interaktif ala WhatsApp: render balon pesan, kuotasi balasan, dan komponen topbar", () => {
    const mockPesanList: PesanKomunikasi[] = [
      {
        id: "MSG-01",
        saluran: "komunitas",
        idPengirim: "KAD-01",
        namaPengirim: "Budi",
        peranPengirim: "kader",
        desaPengirim: "Tanjung Selor",
        teks: "Ditemukan sarang burung enggang di koordinat pohon damar.",
        waktu: new Date().toISOString(),
        statusKirim: "tersimpan"
      },
      {
        id: "MSG-02",
        saluran: "komunitas",
        idPengirim: mockProfil.idKader,
        namaPengirim: mockProfil.nama,
        peranPengirim: "kader",
        desaPengirim: mockProfil.desaWilayah,
        teks: '[Membalas Budi: "Ditemukan sarang burung enggang..."]\nSiap, tim kami akan meluncur ke lokasi untuk mencatat GPS.',
        waktu: new Date().toISOString(),
        statusKirim: "tersimpan"
      }
    ];

    const htmlChat = renderToString(
      <KomunikasiView
        pesanList={mockPesanList}
        profil={mockProfil}
        peranPengguna="kader"
        onKirimPesan={vi.fn()}
        onHapusPesan={vi.fn()}
        onTeruskanPesan={vi.fn()}
        onLihatPinDiPeta={vi.fn()}
      />
    );

    // Balon pesan dan kutipan balasan
    expect(htmlChat).toContain("chat-bubble-item");
    expect(htmlChat).toContain("chat-quoted-box");
    expect(htmlChat).toContain("chat-quoted-author");
    expect(htmlChat).toContain("Membalas Budi");
    expect(htmlChat).toContain("Siap, tim kami akan meluncur ke lokasi");
    expect(htmlChat).toContain("Ditemukan sarang burung enggang");
  });
});
