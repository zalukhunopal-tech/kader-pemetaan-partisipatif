// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveMap } from "../components/InteractiveMap";
import { MenuAtas } from "../components/app/MenuAtas";
import { PanelLapisanPeta } from "../components/peta/PanelLapisanPeta";
import {
  TUNDA_UNDUH_OTOMATIS_MS,
  muatSlotAutoCache,
  titikDiDalamKotak
} from "../lib/cachePetaOtomatis";
import {
  StatusNotifCitraOffline,
  useUnduhPetaOtomatis
} from "../lib/useUnduhPetaOtomatis";
import {
  adalahPetaTileOffline,
  isiTemplateTile,
  muatCakupanOverlayOffline,
  setelUlangCacheUntukUji,
  setelUlangOverlayOfflineUntukUji,
  simpanCakupanOverlayOffline,
  sumberUnduhOfflineEfektif,
  unduhTile
} from "../lib/petaOffline";
import { gambarLapisanPeta, latToTileY, lngToTileX } from "../lib/petaKanvas";
import { setelUlangPenyimpananUntukUji } from "../lib/penyimpanan";
import { AreaPetaOffline, LapisanSpasial, ProfilKader } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PROFIL_UJI: ProfilKader = {
  idKader: "KDR-OFF-01",
  nama: "Kader Offline",
  desaWilayah: "Long Bawan",
  kelompokMasyarakat: "KTH Krayan",
  noHp: "081200001234",
  namaOrganisasi: "Titik Tapak",
  modeKombinasiTarget: "per_kategori"
};

const LAT_UJI = 3.817416;
const LNG_UJI = 115.754455;

function pasangCacheTiruan() {
  const isi = new Map<string, Response>();
  const cache = {
    match: async (u: string) => isi.get(u)?.clone(),
    put: async (u: string, r: Response) => {
      isi.set(u, r);
    },
    delete: async (u: string) => isi.delete(u),
    keys: async () => Array.from(isi.keys()).map((url) => ({ url }) as Request)
  };
  vi.stubGlobal("caches", { open: async () => cache });
  return isi;
}

function buatMockCanvasCtx() {
  const fillStyles: string[] = [];
  const drawImageCalls: unknown[][] = [];
  const strokeRectCalls: unknown[][] = [];
  let _fillStyle: unknown = "";
  const ctx = {
    setTransform: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    get fillStyle() {
      return _fillStyle;
    },
    set fillStyle(v: unknown) {
      _fillStyle = v;
      if (typeof v === "string") fillStyles.push(v);
    },
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "medium",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillRect: vi.fn(),
    strokeRect: vi.fn((...args: unknown[]) => strokeRectCalls.push(args)),
    clearRect: vi.fn(),
    drawImage: vi.fn((...args: unknown[]) => drawImageCalls.push(args)),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    bezierCurveTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 }))
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fillStyles, drawImageCalls, strokeRectCalls };
}

let wadah: HTMLDivElement | null = null;
let akar: Root | null = null;

function pasang(el: React.ReactElement): HTMLDivElement {
  wadah = document.createElement("div");
  document.body.appendChild(wadah);
  akar = createRoot(wadah);
  act(() => {
    akar!.render(el);
  });
  return wadah;
}

async function tungguAsync(putaran = 6) {
  for (let i = 0; i < putaran; i++) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 15));
    });
  }
}

describe("Unduh Citra Offline Otomatis 10x10 km, Jeda 3 Menit, Notifikasi HP, dan Overlay Halus", () => {
  beforeEach(() => {
    setelUlangPenyimpananUntukUji();
    setelUlangCacheUntukUji();
    setelUlangOverlayOfflineUntukUji();
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:offline-tile-test"),
      revokeObjectURL: vi.fn()
    });
    class ImageTiruan {
      width = 256;
      height = 256;
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = "";
      get src() {
        return this._src;
      }
      set src(v: string) {
        this._src = v;
        if (v.startsWith("blob:")) {
          queueMicrotask(() => this.onload?.());
        } else {
          queueMicrotask(() => this.onerror?.());
        }
      }
    }
    vi.stubGlobal("Image", ImageTiruan);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (akar) {
      act(() => akar!.unmount());
      akar = null;
    }
    wadah?.remove();
    wadah = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("1. sumberUnduhOfflineEfektif memakai sumber citra CORS sah (mengalihkan Google non-CORS ke Esri HD) dan mendukung cadangan server saat unduh", async () => {
    const cacheIsi = pasangCacheTiruan();

    const dariGoogle = sumberUnduhOfflineEfektif("google");
    expect(dariGoogle).not.toBeNull();
    expect(dariGoogle!.template).toContain("World_Imagery");
    expect(dariGoogle!.template).not.toContain("google.com/vt/");
    expect(dariGoogle!.dialihkanDariGoogle).toBe(true);

    const urlUtama = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/13460/8022";
    const urlCadangan = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/13460/8022";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        if (u === urlUtama) return new Response(null, { status: 500 });
        if (u === urlCadangan) return new Response(new Uint8Array(512), { status: 200, headers: { "content-type": "image/jpeg" } });
        return new Response(null, { status: 404 });
      })
    );

    const hasil = await unduhTile([urlUtama], {
      pembuatUrlCadangan: () => [urlCadangan]
    });
    expect(hasil.tersimpan).toBe(1);
    expect(hasil.gagal).toBe(0);
    expect(hasil.byte).toBe(512);
    expect(cacheIsi.has(urlUtama)).toBe(true);
  });

  it("2. Simbol dan label unduh peta offline manual telah dihilangkan dari Peta Interaktif dan Panel Lapisan", () => {
    const { ctx } = buatMockCanvasCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);

    const rootPeta = pasang(
      <InteractiveMap
        dataSpasial={[]}
        profil={PROFIL_UJI}
        areaOffline={[]}
        petaKustomAktif={null}
        fokusKoordinat={{ lat: LAT_UJI, lng: LNG_UJI }}
        sedangOnline={true}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    expect(rootPeta.querySelector("#unduh-progress-hud")).toBeNull();
    expect(rootPeta.querySelector(".unduh-hold-circle")).toBeNull();
    expect(rootPeta.textContent).not.toContain("Unduh area offline");
    expect(rootPeta.textContent).not.toContain("Unduh Peta Offline");

    // Pastikan PanelLapisanPeta juga tidak lagi menampilkan tombol Unduh Area Offline
    act(() => akar!.unmount());
    akar = null;
    wadah?.remove();
    wadah = null;

    const rootPanel = pasang(
      <PanelLapisanPeta
        basemap="google"
        jumlahObjek={0}
        tampilDaftarObjek={false}
        onPilihBasemap={vi.fn()}
        onPilihBerkas={vi.fn()}
        onAlihDaftarObjek={vi.fn()}
        onTutup={vi.fn()}
        areaOffline={[]}
      />
    );
    expect(rootPanel.textContent).not.toContain("Unduh Area Offline");
    expect(rootPanel.textContent).not.toContain("Unduh area offline");
  });

  it("3. useUnduhPetaOtomatis menunggu 3 menit untuk menyesuaikan posisi terkini user, lalu mengunduh otomatis 10 x 10 km", async () => {
    vi.useFakeTimers();
    const cacheIsi = pasangCacheTiruan();
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array(256), { status: 200, headers: { "content-type": "image/jpeg" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    // Simulasi GPS perangkat mengirim posisi terbaru selama masa tunggu 3 menit
    let kirimGps: ((pos: GeolocationPosition) => void) | null = null;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: vi.fn((cb: (pos: GeolocationPosition) => void) => {
          kirimGps = cb;
          return 1;
        }),
        clearWatch: vi.fn()
      }
    });

    let statusTerkini: StatusNotifCitraOffline | null = null;
    function Harness() {
      const s = useUnduhPetaOtomatis({
        aktif: true,
        sedangOnline: true,
        areaOffline: [],
        basemap: "topo",
        posisiAwal: { lat: LAT_UJI, lng: LNG_UJI }
      });
      statusTerkini = s;
      return null;
    }

    pasang(<Harness />);

    // Tepat saat aplikasi dibuka: belum mengunduh, masuk fase tunggu 3 menit dengan tanda peringatan
    expect(statusTerkini!.fase).toBe("menunggu");
    expect(statusTerkini!.perluPeringatan).toBe(true);
    expect(statusTerkini!.sisaDetikTunggu).toBe(180);
    expect(fetchMock).not.toHaveBeenCalled();

    // Setelah 1 menit, user mendapatkan posisi GPS terkini yang bergeser ~20 km
    const latBaru = LAT_UJI + 0.18;
    const lngBaru = LNG_UJI + 0.18;
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(statusTerkini!.fase).toBe("menunggu");
    expect(statusTerkini!.sisaDetikTunggu).toBeLessThanOrEqual(120);

    await act(async () => {
      kirimGps?.({
        coords: { latitude: latBaru, longitude: lngBaru } as GeolocationCoordinates,
        timestamp: Date.now()
      } as GeolocationPosition);
    });

    // Setelah tepat 3 menit (sisa 2 menit lagi), unduhan otomatis dimulai untuk posisi TERKINI!
    await act(async () => {
      vi.advanceTimersByTime(TUNDA_UNDUH_OTOMATIS_MS - 60_000);
      await Promise.resolve();
    });
    // Jalankan microtask pengunduhan
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }

    expect(fetchMock).toHaveBeenCalled();
    expect(statusTerkini!.fase).toBe("siap");
    expect(statusTerkini!.perluPeringatan).toBe(false);
    expect(statusTerkini!.daftarKotak).toHaveLength(1);
    const kotak = muatSlotAutoCache()[0];
    expect(titikDiDalamKotak(latBaru, lngBaru, kotak.kotak)).toBe(true);
    expect(muatCakupanOverlayOffline()).toHaveLength(1);
    expect(cacheIsi.size).toBeGreaterThan(0);
  });

  it("4. Notifikasi dekat indikator jaringan menampilkan tanda peringatan saat lokasi belum diunduh dan membuka kartu progres ala HP saat diklik", () => {
    const statusMengunduh: StatusNotifCitraOffline = {
      fase: "mengunduh",
      perluPeringatan: true,
      persen: 46,
      tileSelesai: 230,
      tileTotal: 500,
      sisaDetikTunggu: 0,
      totalDetikTunggu: 180,
      posisi: { lat: LAT_UJI, lng: LNG_UJI },
      daftarKotak: [],
      kotakAktif: null,
      maksKotak: 3
    };

    const statusMenunggu: StatusNotifCitraOffline = {
      ...statusMengunduh,
      fase: "menunggu",
      persen: 0,
      tileSelesai: 0,
      tileTotal: 0,
      sisaDetikTunggu: 135
    };

    // A. Saat lokasi belum diunduh (menunggu 3 menit): tampil tanda peringatan (!) di dekat tombol Online/Offline
    const elTunggu = pasang(
      <MenuAtas
        tabAktif="peta"
        setTabAktif={vi.fn()}
        peran="kader"
        adalahAkunAdmin={false}
        gantiPeranAkun={vi.fn()}
        bukaMenuTitikTiga={false}
        setBukaMenuTitikTiga={vi.fn()}
        sedangOnline={true}
        jaringanTersedia={true}
        modeOfflineManual={false}
        setModeOfflineManual={vi.fn()}
        tampilkanToast={vi.fn()}
        onBukaPemberitahuan={vi.fn()}
        onBukaEkspor={vi.fn()}
        onBukaKeamanan={vi.fn()}
        onBukaGantiSandi={vi.fn()}
        onKeluar={vi.fn()}
        statusCitraOffline={statusMenunggu}
      />
    );

    const tombolNotif = elTunggu.querySelector("button.avenza-notif-offline-btn") as HTMLButtonElement | null;
    expect(tombolNotif).not.toBeNull();
    expect(elTunggu.querySelector(".avenza-notif-warn-badge")).not.toBeNull();

    // Klik notifikasi -> muncul kartu notifikasi bergaya HP dengan hitung mundur & kuota 3 kotak
    act(() => {
      tombolNotif!.click();
    });
    const kartuHp = elTunggu.querySelector(".notif-hp-card");
    expect(kartuHp).not.toBeNull();
    expect(kartuHp!.textContent).toContain("Lokasi belum diunduh");
    expect(kartuHp!.textContent).toContain("2:15");
    expect(kartuHp!.textContent).toContain("0 / 3");
    expect(kartuHp!.querySelector('[role="progressbar"]')).not.toBeNull();

    // B. Saat sedang mengunduh: tampil persen progres di tombol & di kartu notifikasi HP
    act(() => {
      akar!.render(
        <MenuAtas
          tabAktif="peta"
          setTabAktif={vi.fn()}
          peran="kader"
          adalahAkunAdmin={false}
          gantiPeranAkun={vi.fn()}
          bukaMenuTitikTiga={false}
          setBukaMenuTitikTiga={vi.fn()}
          sedangOnline={true}
          jaringanTersedia={true}
          modeOfflineManual={false}
          setModeOfflineManual={vi.fn()}
          tampilkanToast={vi.fn()}
          onBukaPemberitahuan={vi.fn()}
          onBukaEkspor={vi.fn()}
          onBukaKeamanan={vi.fn()}
          onBukaGantiSandi={vi.fn()}
          onKeluar={vi.fn()}
          statusCitraOffline={statusMengunduh}
        />
      );
    });

    expect(elTunggu.querySelector(".avenza-notif-pct")?.textContent).toBe("46%");
    const kartuUnduh = elTunggu.querySelector(".notif-hp-card");
    expect(kartuUnduh!.textContent).toContain("Mengunduh citra offline (10 × 10 km)");
    expect(kartuUnduh!.textContent).toContain("230 dari 500 tile (46%)");
    expect(kartuUnduh!.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("46");
  });

  it("5. Hasil download langsung overlay halus di Peta Interaktif saat OFFLINE total bersama Lapisan Peta survei, tanpa garis atau warna tambahan, dan mendukung fallback overzoom", async () => {
    const cacheIsi = pasangCacheTiruan();
    const { ctx, fillStyles, drawImageCalls, strokeRectCalls } = buatMockCanvasCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);

    const templateEsri = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    // Isi Cache API pada zoom 14 (untuk menguji overzoom ke zoom 16 sekaligus overlay langsung saat offline!)
    const zInduk = 14;
    const px = Math.floor(lngToTileX(LNG_UJI, zInduk));
    const py = Math.floor(latToTileY(LAT_UJI, zInduk));
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const u = isiTemplateTile(templateEsri, zInduk, px + dx, py + dy);
        if (u) {
          cacheIsi.set(u, new Response(new Uint8Array(256), { status: 200, headers: { "content-type": "image/jpeg" } }));
        }
      }
    }

    simpanCakupanOverlayOffline({
      id: "OVL-TEST-01",
      basemapId: "esri",
      minLat: LAT_UJI - 0.045,
      maxLat: LAT_UJI + 0.045,
      minLng: LNG_UJI - 0.045,
      maxLng: LNG_UJI + 0.045,
      zoomMin: 10,
      zoomMax: 19,
      templateTile: templateEsri,
      jumlahTile: 9,
      ukuranMb: 4.2,
      diunduhPada: "2026-11-20T10:00:00Z"
    });

    const fetchOffline = vi.fn(async () => {
      throw new TypeError("Failed to fetch (offline)");
    });
    vi.stubGlobal("fetch", fetchOffline);

    const lapisanSurvei: LapisanSpasial = {
      id: "LAP-SURVEI-01",
      nama: "Inventarisasi Anggrek Krayan",
      jumlahPeta: 0,
      adalahTematik: true,
      createdAt: "2026-11-20T09:00:00Z"
    };

    pasang(
      <InteractiveMap
        dataSpasial={[]}
        profil={PROFIL_UJI}
        areaOffline={[]}
        petaKustomAktif={null}
        lapisanList={[lapisanSurvei]}
        lapisanAktifId={lapisanSurvei.id}
        fokusKoordinat={{ lat: LAT_UJI, lng: LNG_UJI }}
        sedangOnline={false}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    await tungguAsync(10);

    expect(drawImageCalls.filter((args) => args.length === 9).length).toBeGreaterThan(0);
    expect(fetchOffline).not.toHaveBeenCalled();
    expect(fillStyles).not.toContain("#f8f9fa");
    expect(fillStyles).not.toContain("#4a4d52");
    expect(strokeRectCalls.length).toBe(0);
  });

  it("6. gambarLapisanPeta tidak menutup citra XYZ Tiles dengan kertas putih maupun garis kotak tambahan, namun tetap menggambar lembar GeoPDF asli", () => {
    const keLayar = (lat: number, lng: number) => ({
      x: 200 + (lng - LNG_UJI) * 5000,
      y: 200 - (lat - LAT_UJI) * 5000
    });

    const mockXyz = buatMockCanvasCtx();
    const areaXyz: AreaPetaOffline = {
      id: "OFF-XYZ",
      namaArea: "Area Citra",
      basemapId: "esri",
      minLat: LAT_UJI - 0.01,
      maxLat: LAT_UJI + 0.01,
      minLng: LNG_UJI - 0.01,
      maxLng: LNG_UJI + 0.01,
      zoomMin: 10,
      zoomMax: 19,
      jumlahTile: 50,
      ukuranMb: 3.2,
      diunduhPada: "2026-11-19T14:00:00Z",
      jenisFile: "XYZ Tiles",
      unduhanNyata: true,
      templateTile: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    };
    expect(adalahPetaTileOffline(areaXyz)).toBe(true);
    gambarLapisanPeta(mockXyz.ctx, {
      W: 400,
      H: 400,
      zoom: 16,
      keLayar,
      dataSpasial: [],
      modeRekam: null,
      titikDraft: [],
      targetGoTo: null,
      gpsPos: null,
      petaKustomAktif: areaXyz
    });
    expect(mockXyz.fillStyles).not.toContain("#ffffff");
    expect(mockXyz.fillStyles).not.toContain("#f8f9fa");
    expect(mockXyz.strokeRectCalls.length).toBe(0);

    const mockPdf = buatMockCanvasCtx();
    gambarLapisanPeta(mockPdf.ctx, {
      W: 400,
      H: 400,
      zoom: 16,
      keLayar,
      dataSpasial: [],
      modeRekam: null,
      titikDraft: [],
      targetGoTo: null,
      gpsPos: null,
      petaKustomAktif: {
        id: "PDF-1",
        namaArea: "Peta Desa GeoPDF",
        basemapId: "esri",
        minLat: LAT_UJI - 0.01,
        maxLat: LAT_UJI + 0.01,
        minLng: LNG_UJI - 0.01,
        maxLng: LNG_UJI + 0.01,
        zoomMin: 12,
        zoomMax: 18,
        jumlahTile: 0,
        ukuranMb: 5.5,
        diunduhPada: "2026-11-19T14:00:00Z",
        jenisFile: "GeoPDF / GeoTIFF"
      }
    });
    expect(mockPdf.fillStyles).toContain("#ffffff");
  });
});
