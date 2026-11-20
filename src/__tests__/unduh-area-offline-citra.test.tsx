// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveMap } from "../components/InteractiveMap";
import {
  daftarTilePiramida10KmZoom20,
  UnduhOfflineModal,
  useUnduhAreaOffline
} from "../components/peta/UnduhOfflineModal";
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
import { AreaPetaOffline, BasemapType, LapisanSpasial, ProfilKader } from "../types";

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

describe("Perbaikan Unduh Area Offline Citra: Overlay Halus Langsung di Peta Interaktif dan Lingkaran Tahan 3 Detik", () => {
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

    // Google tanpa kunci API (mt1.google.com) memblokir fetch CORS -> dialihkan otomatis ke Esri HD yang mendukung CORS
    const dariGoogle = sumberUnduhOfflineEfektif("google");
    expect(dariGoogle).not.toBeNull();
    expect(dariGoogle!.template).toContain("World_Imagery");
    expect(dariGoogle!.template).not.toContain("google.com/vt/");
    expect(dariGoogle!.dialihkanDariGoogle).toBe(true);

    // Simulasi server utama error 500, cadangan berhasil 200 -> tersimpan di Cache API di bawah kunci URL utama!
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

  it("2. Modal unduh hanya menampilkan lingkaran tahan 3 detik tanpa teks/isian nama peta, dan hasil unduhan disimpan sebagai overlay langsung tanpa membuat lapisan tersendiri", async () => {
    const cacheIsi = pasangCacheTiruan();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array(300), { status: 200, headers: { "content-type": "image/jpeg" } }))
    );

    const onSimpanAreaOffline = vi.fn();
    const pesanToast: string[] = [];
    let apiUnduh: ReturnType<typeof useUnduhAreaOffline> | null = null;

    function Harness({ basemap }: { basemap: BasemapType }) {
      const unduh = useUnduhAreaOffline(basemap, [], onSimpanAreaOffline, (p) => pesanToast.push(p));
      apiUnduh = unduh;
      return unduh.bukaModalOffline ? <UnduhOfflineModal unduh={unduh} /> : null;
    }

    const rootEl = pasang(<Harness basemap="google" />);
    act(() => {
      apiUnduh!.bukaModalUnduh({ minLat: LAT_UJI - 0.01, maxLat: LAT_UJI + 0.01, minLng: LNG_UJI - 0.01, maxLng: LNG_UJI + 0.01 });
    });

    // Tampilan modal minimalis: HANYA lingkaran tahan 3 detik tanpa keterangan download peta atau isian nama peta
    expect(rootEl.querySelector("button.unduh-hold-circle")).not.toBeNull();
    expect(rootEl.querySelector("input")).toBeNull();
    expect(rootEl.querySelector(".unduh-stats-grid")).toBeNull();
    expect(rootEl.querySelector(".offline-list")).toBeNull();
    expect(rootEl.textContent).not.toContain("Unduh Peta Offline");
    expect(rootEl.textContent).not.toContain("Masukkan nama area");
    expect(rootEl.textContent).not.toContain("10 × 10 km");

    const piramida = daftarTilePiramida10KmZoom20(LAT_UJI, LNG_UJI, 19);
    expect(piramida.some((t) => t.z === 10)).toBe(true);
    expect(piramida.some((t) => t.z === 15)).toBe(true);
    expect(piramida.some((t) => t.z === 19)).toBe(true);

    await act(async () => {
      await apiUnduh!.handleUnduhAreaOffline();
    });

    // Tidak membuat lapisan atau item peta tersendiri di Pustaka Peta
    expect(onSimpanAreaOffline).not.toHaveBeenCalled();

    // Cakupan overlay offline tersimpan langsung dan seluruh tile ada di Cache API
    const daftarOverlay = muatCakupanOverlayOffline();
    expect(daftarOverlay).toHaveLength(1);
    const ov = daftarOverlay[0];
    expect(ov.jumlahTile).toBe(piramida.length);
    expect(ov.ukuranMb).toBeGreaterThan(0);
    expect(ov.templateTile).toContain("World_Imagery");
    expect(cacheIsi.size).toBe(piramida.length);
    expect(pesanToast.some((p) => p.includes("Peta Interaktif"))).toBe(true);
  });

  it("3. Hasil download langsung overlay halus di Peta Interaktif saat OFFLINE total bersama Lapisan Peta survei, tanpa garis atau warna tambahan", async () => {
    const cacheIsi = pasangCacheTiruan();
    const { ctx, fillStyles, drawImageCalls, strokeRectCalls } = buatMockCanvasCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);

    const templateEsri = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const zoomTarget = 16;
    const cx = Math.floor(lngToTileX(LNG_UJI, zoomTarget));
    const cy = Math.floor(latToTileY(LAT_UJI, zoomTarget));

    // Isi Cache API untuk grid 5x5 tile di sekitar titik pusat pada zoom 16
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const u = isiTemplateTile(templateEsri, zoomTarget, cx + dx, cy + dy);
        if (u) {
          cacheIsi.set(u, new Response(new Uint8Array(256), { status: 200, headers: { "content-type": "image/jpeg" } }));
        }
      }
    }

    // Daftarkan cakupan overlay offline (tanpa petaKustomAktif / tanpa lapisan peta tambahan)
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
      jumlahTile: 25,
      ukuranMb: 12.4,
      diunduhPada: "2026-11-20T10:00:00Z"
    });

    // Simulasi kondisi benar-benar OFFLINE: setiap fetch jaringan gagal!
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

    await tungguAsync(8);

    // 1. Citra tile langsung ter-overlay ke kanvas Peta Interaktif saat lapisan survei aktif tanpa jaringan
    expect(drawImageCalls.length).toBeGreaterThan(0);
    // 2. Tidak pernah meminta jaringan saat offline
    expect(fetchOffline).not.toHaveBeenCalled();
    // 3. Tidak ada layar kertas putih GeoPDF (#f8f9fa / #4a4d52)
    expect(fillStyles).not.toContain("#f8f9fa");
    expect(fillStyles).not.toContain("#4a4d52");
    // 4. Tidak ada garis kotak batas tambahan yang membingungkan di atas citra
    expect(strokeRectCalls.length).toBe(0);
  });

  it("4. Overlay offline di Peta Interaktif pada zoom tinggi otomatis memakai fallback tile induk (overzoom) dari Cache API tanpa layar kosong", async () => {
    const cacheIsi = pasangCacheTiruan();
    const { ctx, drawImageCalls, strokeRectCalls } = buatMockCanvasCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);

    const templateEsri = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    // Hanya tile zoom 14 yang ada di Cache API (simulasi pinggir area 10x10 km), tetapi peta dibuka di zoom 16!
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
      id: "OVL-OVERZOOM-01",
      basemapId: "esri",
      minLat: LAT_UJI - 0.045,
      maxLat: LAT_UJI + 0.045,
      minLng: LNG_UJI - 0.045,
      maxLng: LNG_UJI + 0.045,
      zoomMin: 10,
      zoomMax: 19,
      templateTile: templateEsri,
      jumlahTile: 9,
      ukuranMb: 2.1,
      diunduhPada: "2026-11-20T10:00:00Z"
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      })
    );

    pasang(
      <InteractiveMap
        dataSpasial={[]}
        profil={PROFIL_UJI}
        areaOffline={[]}
        petaKustomAktif={null}
        fokusKoordinat={{ lat: LAT_UJI, lng: LNG_UJI }}
        sedangOnline={false}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    await tungguAsync(10);

    // drawImage 9 argumen = menggambar potongan sub-kuadran dari tile induk zoom 14 ke layar zoom 16!
    const panggilanOverzoom = drawImageCalls.filter((args) => args.length === 9);
    expect(panggilanOverzoom.length).toBeGreaterThan(0);
    expect(strokeRectCalls.length).toBe(0);
  });

  it("5. gambarLapisanPeta tidak menutup citra XYZ Tiles dengan kertas putih maupun garis kotak tambahan, namun tetap menggambar lembar GeoPDF asli", () => {
    const keLayar = (lat: number, lng: number) => ({
      x: 200 + (lng - LNG_UJI) * 5000,
      y: 200 - (lat - LAT_UJI) * 5000
    });

    // A. Area unduhan XYZ Tiles -> murni tanpa kertas putih dan tanpa garis batas kotak tambahan
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

    // B. Lembar peta GeoPDF (non-tile) -> tetap digambar seperti biasa
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
