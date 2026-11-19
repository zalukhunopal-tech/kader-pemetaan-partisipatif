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
  setelUlangCacheUntukUji,
  sumberUnduhOfflineEfektif,
  unduhTile
} from "../lib/petaOffline";
import { gambarLapisanPeta, latToTileY, lngToTileX } from "../lib/petaKanvas";
import { setelUlangPenyimpananUntukUji } from "../lib/penyimpanan";
import { AreaPetaOffline, BasemapType, ProfilKader } from "../types";

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

describe("Perbaikan Unduh Area Offline Citra: Bebas Layar Putih, Fallback CORS & Overzoom Offline", () => {
  beforeEach(() => {
    setelUlangPenyimpananUntukUji();
    setelUlangCacheUntukUji();
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

  it("2. Alur lengkap useUnduhAreaOffline menyimpan tile nyata ke Cache API dan membuat AreaPetaOffline bertipe XYZ Tiles yang dikenali adalahPetaTileOffline", async () => {
    const cacheIsi = pasangCacheTiruan();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array(300), { status: 200, headers: { "content-type": "image/jpeg" } }))
    );

    const areaTersimpan: AreaPetaOffline[] = [];
    const pesanToast: string[] = [];
    let apiUnduh: ReturnType<typeof useUnduhAreaOffline> | null = null;

    function Harness({ basemap }: { basemap: BasemapType }) {
      const unduh = useUnduhAreaOffline(basemap, areaTersimpan, (a) => areaTersimpan.push(a), (p) => pesanToast.push(p));
      apiUnduh = unduh;
      return unduh.bukaModalOffline ? (
        <UnduhOfflineModal basemap={basemap} areaOffline={areaTersimpan} unduh={unduh} onBukaArea={vi.fn()} />
      ) : null;
    }

    pasang(<Harness basemap="google" />);
    act(() => {
      apiUnduh!.bukaModalUnduh({ minLat: LAT_UJI - 0.01, maxLat: LAT_UJI + 0.01, minLng: LNG_UJI - 0.01, maxLng: LNG_UJI + 0.01 });
    });

    const piramida = daftarTilePiramida10KmZoom20(LAT_UJI, LNG_UJI, 19);
    expect(piramida.some((t) => t.z === 10)).toBe(true);
    expect(piramida.some((t) => t.z === 15)).toBe(true);
    expect(piramida.some((t) => t.z === 19)).toBe(true);

    await act(async () => {
      await apiUnduh!.handleUnduhAreaOffline();
    });

    expect(areaTersimpan).toHaveLength(1);
    const area = areaTersimpan[0];
    expect(area.jenisFile).toBe("XYZ Tiles");
    expect(area.unduhanNyata).toBe(true);
    expect(area.jumlahTile).toBe(piramida.length);
    expect(area.ukuranMb).toBeGreaterThan(0);
    expect(area.templateTile).toContain("World_Imagery");
    expect(adalahPetaTileOffline(area)).toBe(true);
    expect(cacheIsi.size).toBe(piramida.length);
    expect(pesanToast.some((p) => p.includes("tersimpan untuk mode offline"))).toBe(true);
  });

  it("3. Membuka hasil download area offline di InteractiveMap saat OFFLINE total menggambar citra tile dari Cache API dan TIDAK menampilkan layar putih", async () => {
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

    // Simulasi kondisi benar-benar OFFLINE: setiap fetch jaringan gagal!
    const fetchOffline = vi.fn(async () => {
      throw new TypeError("Failed to fetch (offline)");
    });
    vi.stubGlobal("fetch", fetchOffline);

    const areaOfflineHasil: AreaPetaOffline = {
      id: "OFF-TEST-01",
      namaArea: "Area Long Bawan Offline",
      basemapId: "esri",
      minLat: LAT_UJI - 0.045,
      maxLat: LAT_UJI + 0.045,
      minLng: LNG_UJI - 0.045,
      maxLng: LNG_UJI + 0.045,
      zoomMin: 10,
      zoomMax: 19,
      jumlahTile: 25,
      ukuranMb: 12.4,
      diunduhPada: "2026-11-19T14:00:00Z",
      jenisFile: "XYZ Tiles",
      unduhanNyata: true,
      templateTile: templateEsri
    };

    pasang(
      <InteractiveMap
        dataSpasial={[]}
        profil={PROFIL_UJI}
        areaOffline={[areaOfflineHasil]}
        petaKustomAktif={areaOfflineHasil}
        fokusKoordinat={{ lat: LAT_UJI, lng: LNG_UJI }}
        sedangOnline={false}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    await tungguAsync(8);

    // 1. Citra tile BENAR-BENAR digambar ke kanvas dari Cache API tanpa jaringan!
    expect(drawImageCalls.length).toBeGreaterThan(0);
    // 2. Tidak pernah meminta jaringan saat offline
    expect(fetchOffline).not.toHaveBeenCalled();
    // 3. TIDAK ADA layar kertas putih GeoPDF (#f8f9fa) atau meja abu-abu GeoPDF (#4a4d52) yang menutupi citra!
    expect(fillStyles).not.toContain("#f8f9fa");
    expect(fillStyles).not.toContain("#4a4d52");
    // 4. Batas area offline digambar sebagai garis tepi putus-putus saja (strokeRect), bukan blok putih
    expect(strokeRectCalls.length).toBeGreaterThan(0);
  });

  it("4. Mode offline di zoom tinggi yang tidak tercakup tile detail otomatis memakai fallback tile induk (overzoom) dari Cache API tanpa layar kosong", async () => {
    const cacheIsi = pasangCacheTiruan();
    const { ctx, drawImageCalls } = buatMockCanvasCtx();
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

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      })
    );

    const areaOfflineHasil: AreaPetaOffline = {
      id: "OFF-OVERZOOM-01",
      namaArea: "Area Pinggir 10km",
      basemapId: "esri",
      minLat: LAT_UJI - 0.045,
      maxLat: LAT_UJI + 0.045,
      minLng: LNG_UJI - 0.045,
      maxLng: LNG_UJI + 0.045,
      zoomMin: 10,
      zoomMax: 19,
      jumlahTile: 9,
      ukuranMb: 2.1,
      diunduhPada: "2026-11-19T14:00:00Z",
      jenisFile: "XYZ Tiles",
      unduhanNyata: true,
      templateTile: templateEsri
    };

    pasang(
      <InteractiveMap
        dataSpasial={[]}
        profil={PROFIL_UJI}
        areaOffline={[areaOfflineHasil]}
        petaKustomAktif={areaOfflineHasil}
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
  });

  it("5. gambarLapisanPeta tidak menutup citra XYZ Tiles dengan kertas putih, namun tetap menggambar lembar GeoPDF asli", () => {
    const keLayar = (lat: number, lng: number) => ({
      x: 200 + (lng - LNG_UJI) * 5000,
      y: 200 - (lat - LAT_UJI) * 5000
    });

    // A. Area unduhan XYZ Tiles -> tidak melukis kertas putih (#ffffff / #f8f9fa)
    const mockXyz = buatMockCanvasCtx();
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
      petaKustomAktif: {
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
      }
    });
    expect(mockXyz.fillStyles).not.toContain("#ffffff");
    expect(mockXyz.fillStyles).not.toContain("#f8f9fa");
    expect(mockXyz.strokeRectCalls.length).toBe(1);

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
