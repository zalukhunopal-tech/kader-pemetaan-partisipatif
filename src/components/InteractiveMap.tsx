import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AreaPetaOffline, BasemapType, DataSpasialItem, FormatKoordinat, JenisGeometri, KoordinatTitik, ProfilKader } from "../types";
import {
  formatKoordinatTeks,
  hitungBearingDerajat,
  hitungJarakMeter,
  hitungLuasPoligonHa,
  hitungPanjangGarisKm,
  namaArahKompas
} from "../lib/geoUtils";
import { perekamLatar, usePerekamLatar } from "../lib/perekamLatar";
import { bacaPosisiPeta, POSISI_AWAL_PETA, simpanPosisiPeta, ZOOM_MAKS_PETA, ZOOM_MIN_PETA } from "../lib/posisiPeta";
import {
  PecahanDunia,
  jepitZoom,
  langkahZoomRoda,
  pecahanDiLayar,
  pusatUntukJangkar,
  zoomCubit
} from "../lib/zoomPeta";
import {
  KotakWilayah,
  SUMBER_TILE,
  basemapBawaan,
  basemapTersedia,
  muatGambarTile,
  laporHasilTile,
  zoomSumber,
  urlTile
} from "../lib/petaOffline";
import {
  TILE_SIZE,
  gambarLapisanPeta,
  latToTileY,
  lngToTileX,
  teksStatusGps,
  teksStatusKompas,
  tileXToLng,
  tileYToLat
} from "../lib/petaKanvas";
import { InspektorObjek } from "./peta/InspektorObjek";
import { PanelLapisanPeta } from "./peta/PanelLapisanPeta";
import { PanelPerekaman } from "./peta/PanelPerekaman";
import { FormSurveiModal, useFormSurvei } from "./peta/FormSurveiModal";
import { UnduhOfflineModal, useUnduhAreaOffline } from "./peta/UnduhOfflineModal";
import { LOGO_GOOGLE, ambilAtribusiGoogle, pantauSesiGoogle } from "../lib/googleTiles";
import { aktifkanKompas, selisihArah, titikDariBidikan, usePosisiPerangkat } from "../lib/posisiPerangkat";
import { Crosshair, Layers, MapPin, Navigation, Plus, Route, Square, X, Watch, Compass } from "lucide-react";

interface InteractiveMapProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  areaOffline: AreaPetaOffline[];
  fokusKoordinat?: { lat: number; lng: number; label?: string } | null;
  /** Dipanggil setelah fokus dipakai, agar fokus lama tidak menimpa posisi terakhir saat peta dibuka lagi */
  onFokusDipakai?: () => void;
  onSimpanDataBaru: (item: DataSpasialItem) => void;
  onTambahPembaruanObjek: (idData: string, kondisiTerbaru: string, catatan: string, fotoBase64?: string) => boolean;
  onSimpanAreaOffline: (area: AreaPetaOffline) => void;
  onImporBerkas: (namaBerkas: string, isi: string) => boolean;
  onBukaSmartwatch?: () => void;
}


/**
 * Menghitung proyeksi terbalik dari koordinat piksel layar ke kanvas lokal
 * saat peta dalam transformasi 3D (perspective, rotateX, rotateZ).
 */
function layarKeKanvas(
  screenX: number,
  screenY: number,
  containerW: number,
  containerH: number,
  canvasW: number,
  canvasH: number,
  pitch: number,
  bearing: number
): { x: number; y: number } | null {
  const x0 = screenX - containerW / 2;
  const y0 = screenY - containerH / 2;
  const d = 1000; // perspective distance (px)
  const pRad = (pitch * Math.PI) / 180;
  const denom = d + y0 * Math.tan(pRad);
  if (denom <= 10) return null; // di luar horizon pandang
  const t = d / denom;
  const X = t * x0;
  const Y = t * y0;
  const yPrime = Y / Math.max(0.1, Math.cos(pRad));
  const xPrime = X;
  const bRad = (bearing * Math.PI) / 180;
  const u = xPrime * Math.cos(bRad) - yPrime * Math.sin(bRad);
  const v = xPrime * Math.sin(bRad) + yPrime * Math.cos(bRad);
  return {
    x: canvasW / 2 + u,
    y: canvasH / 2 + v
  };
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  dataSpasial,
  profil,
  areaOffline,
  fokusKoordinat,
  onFokusDipakai,
  onSimpanDataBaru,
  onTambahPembaruanObjek,
  onSimpanAreaOffline,
  onImporBerkas,
  onBukaSmartwatch
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileCacheRef = useRef<Map<string, HTMLImageElement | "loading" | "error">>(new Map());

  // Peta dibuka di posisi, zoom, dan basemap terakhir (bukan lokasi bawaan)
  const [posisiTersimpan] = useState(() => bacaPosisiPeta());
  const [center, setCenter] = useState<{ lat: number; lng: number }>(() =>
    posisiTersimpan ? { lat: posisiTersimpan.lat, lng: posisiTersimpan.lng } : POSISI_AWAL_PETA
  );
  const [zoom, setZoom] = useState<number>(() => posisiTersimpan?.zoom ?? 15);
  // Perspektif 3D (kemiringan 0-60°) dan rotasi arah peta (0-359°)
  const [pitch, setPitch] = useState<number>(() => posisiTersimpan?.pitch ?? 0);
  const [bearing, setBearing] = useState<number>(() => posisiTersimpan?.bearing ?? 0);
  // Mode Kompas Otomatis (Avenza Maps Style): peta berputar dinamis mengikuti sensor arah hadap HP
  const [modeIkutiKompas, setModeIkutiKompas] = useState<boolean>(false);

  // Ukuran sisi persegi canvas 3D (selalu melingkupi seluruh viewport HP pada sudut rotasi 0-360° dan tilt 0-60°)
  const [ukuranCanvas, setUkuranCanvas] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const diag = Math.hypot(window.innerWidth, window.innerHeight);
      return Math.max(1200, Math.ceil(diag * 1.85));
    }
    return 1400;
  });

  useLayoutEffect(() => {
    const el = wadahPetaRef.current;
    if (!el) return;
    const hitungUkuran = () => {
      const rect = el.getBoundingClientRect();
      const diag = Math.hypot(rect.width || window.innerWidth, rect.height || window.innerHeight);
      const side = Math.max(1200, Math.ceil(diag * 1.85));
      setUkuranCanvas((prev) => (Math.abs(prev - side) > 20 ? side : prev));
    };
    hitungUkuran();
    window.addEventListener("resize", hitungUkuran);
    return () => window.removeEventListener("resize", hitungUkuran);
  }, []);

  // Peta dasar terakhir dipakai lagi bila masih tersedia (kunci API bisa dicabut); selain itu citra paling tajam
  const [basemap, setBasemap] = useState<BasemapType>(() =>
    posisiTersimpan && basemapTersedia(posisiTersimpan.basemap) ? posisiTersimpan.basemap : basemapBawaan()
  );
  const [atribusiGoogle, setAtribusiGoogle] = useState<string | null>(null);
  const [logoGoogleGagal, setLogoGoogleGagal] = useState(false);
  // Naik setiap kali sesi tile Google siap atau gagal, supaya peta digambar ulang
  const [versiGoogle, setVersiGoogle] = useState(0);
  useEffect(() => pantauSesiGoogle(() => setVersiGoogle((v) => v + 1)), []);
  const [formatKoord, setFormatKoord] = useState<FormatKoordinat>("DD");
  const [renderTick, setRenderTick] = useState<number>(0);

  // State UI Clean Mode: fitur disembunyikan agar tidak menghalangi peta di HP
  const [bukaMenuPeta, setBukaMenuPeta] = useState<boolean>(false);
  const [bukaAlatRekam, setBukaAlatRekam] = useState<boolean>(false);
  const [tampilDaftarObjek, setTampilDaftarObjek] = useState<boolean>(false);

  // Navigasi: posisi GPS dan arah kompas dari sensor perangkat (null selama belum ada data)
  const perangkat = usePosisiPerangkat();
  const [targetGoTo, setTargetGoTo] = useState<{
    lat: number;
    lng: number;
    judul: string;
  } | null>(null);

  // Mode Perekaman Spasial (terhubung dengan Perekam Latar Belakang)
  const rekamLatar = usePerekamLatar();
  const simulasiAktif = rekamLatar.autoGpsAktif && rekamLatar.status === "merekam";
  // Selama mode simulasi (demo), titik biru mengikuti jalur simulasi; selain itu hanya GPS asli
  const gpsPos: KoordinatTitik | null = simulasiAktif && rekamLatar.posisiTerakhir ? rekamLatar.posisiTerakhir : perangkat.posisi;
  const posisiNyata = perangkat.statusGps === "aktif" ? perangkat.posisi : null;
  const kompasDerajat: number | undefined = perangkat.arahDerajat ?? undefined;

  // Rotasi peta aktif: mengikuti sensor kompas HP jika mode kompas aktif, atau rotasi manual (Avenza Maps mode)
  const bearingAktif = modeIkutiKompas && kompasDerajat !== undefined ? kompasDerajat : bearing;
  const [modeRekam, setModeRekam] = useState<JenisGeometri | null>(() =>
    rekamLatar.status !== "idle" && rekamLatar.jenis ? rekamLatar.jenis : null
  );
  const [titikDraft, setTitikDraft] = useState<KoordinatTitik[]>(() => (rekamLatar.status !== "idle" ? rekamLatar.titik : []));
  const [bukaModalForm, setBukaModalForm] = useState<boolean>(false);
  const [detikTick, setDetikTick] = useState<number>(0);

  // Simpan posisi peta (ditunda sedikit) dan pastikan tersimpan saat aplikasi ditutup/disembunyikan
  const posisiRef = useRef({ ...center, zoom, basemap, pitch, bearing: bearingAktif });
  const pitchRef = useRef(pitch);
  const bearingRef = useRef(bearing);
  const zoomRef = useRef(zoom);
  const centerRef = useRef(center);
  useLayoutEffect(() => {
    pitchRef.current = pitch;
    bearingRef.current = bearingAktif;
    zoomRef.current = zoom;
    centerRef.current = center;
    posisiRef.current = { ...center, zoom, basemap, pitch, bearing: bearingAktif };
  }, [center, zoom, basemap, pitch, bearingAktif]);
  useEffect(() => {
    const t = window.setTimeout(() => simpanPosisiPeta(posisiRef.current), 300);
    return () => window.clearTimeout(t);
  }, [center, zoom, basemap, pitch, bearingAktif]);
  useEffect(() => {
    const simpan = () => simpanPosisiPeta(posisiRef.current);
    const saatTersembunyi = () => {
      if (document.visibilityState === "hidden") simpan();
    };
    window.addEventListener("pagehide", simpan);
    document.addEventListener("visibilitychange", saatTersembunyi);
    return () => {
      simpan();
      window.removeEventListener("pagehide", simpan);
      document.removeEventListener("visibilitychange", saatTersembunyi);
    };
  }, []);

  // Sinkronkan titik dari perekam latar belakang ke peta secara real-time
  useEffect(() => {
    if (rekamLatar.status !== "idle" && rekamLatar.jenis) {
      // Menyalin state dari store perekam di luar React (yang tetap merekam saat peta tidak tampil)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModeRekam(rekamLatar.jenis);
      setTitikDraft(rekamLatar.titik);
      if (rekamLatar.posisiTerakhir && rekamLatar.autoGpsAktif && rekamLatar.status === "merekam") {
        setCenter({
          lat: rekamLatar.posisiTerakhir.lat,
          lng: rekamLatar.posisiTerakhir.lng
        });
      }
    }
  }, [rekamLatar]);

  // Detak timer durasi saat sedang merekam
  useEffect(() => {
    if (rekamLatar.status !== "merekam") return;
    const t = window.setInterval(() => setDetikTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [rekamLatar.status]);

  // Isian form atribut survei
  const form = useFormSurvei();

  // Inspeksi Objek Existing
  const [objekTerpilih, setObjekTerpilih] = useState<DataSpasialItem | null>(null);
  const [kondisiUpdateInput, setKondisiUpdateInput] = useState<string>("");

  // Modal Offline Downloader
  const unduh = useUnduhAreaOffline(basemap, areaOffline, onSimpanAreaOffline);

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startLat: number;
    startLng: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startLat: 0,
    startLng: 0,
    moved: false
  });

  // Jari yang sedang menyentuh peta dan keadaan awal interaksi 2 jari dengan intent lock
  const jariRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const duaJariRef = useRef<{
    startP1: { x: number; y: number; id: number };
    startP2: { x: number; y: number; id: number };
    jarakAwal: number;
    sudutAwal: number;
    midAwal: { x: number; y: number };
    pitchAwal: number;
    bearingAwal: number;
    zoomAwal: number;
    jangkar: PecahanDunia;
    mode: "undecided" | "tilt" | "rotate_zoom" | "zoom_only";
  } | null>(null);

  // Tinggi peta = sisa layar di bawah peta sampai bilah navigasi bawah (yang tingginya ikut ukuran
  // huruf HP), supaya atribusi dan tombol Rekam Lokasi tidak pernah tertutup bilah bawah
  const wadahPetaRef = useRef<HTMLDivElement | null>(null);
  const [tinggiPeta, setTinggiPeta] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = wadahPetaRef.current;
    if (!el) return;
    let bingkai = 0;
    const hitung = () => {
      cancelAnimationFrame(bingkai);
      bingkai = requestAnimationFrame(() => {
        const atas = el.getBoundingClientRect().top + window.scrollY;
        const nav = document.querySelector<HTMLElement>(".avenza-bottom-nav");
        const tinggiNav = nav ? nav.getBoundingClientRect().height : 0;
        const tinggi = Math.max(280, Math.floor(window.innerHeight - atas - tinggiNav - 10));
        setTinggiPeta((lama) => (lama !== null && Math.abs(lama - tinggi) < 2 ? lama : tinggi));
      });
    };
    hitung();
    window.addEventListener("resize", hitung);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(hitung) : null;
    ro?.observe(document.body);
    const nav = document.querySelector<HTMLElement>(".avenza-bottom-nav");
    if (nav) ro?.observe(nav);
    return () => {
      cancelAnimationFrame(bingkai);
      window.removeEventListener("resize", hitung);
      ro?.disconnect();
    };
  }, []);

  // Roda tetikus dan cubit trackpad (PC/laptop): perbesar/perkecil di sekitar penunjuk.
  // Didaftarkan manual karena onWheel React bersifat pasif dan tidak bisa mencegah gulir halaman.
  useEffect(() => {
    const kanvas = canvasRef.current;
    if (!kanvas) return;
    const saatRoda = (e: WheelEvent) => {
      e.preventDefault();
      const rect = kanvas.getBoundingClientRect();
      const titik = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const kini = posisiRef.current;
      const zBaru = jepitZoom(kini.zoom + langkahZoomRoda(e.deltaY, e.deltaMode, e.ctrlKey));
      if (zBaru === kini.zoom) return;
      const pusatBaru = pusatUntukJangkar(
        pecahanDiLayar(kini, kini.zoom, titik, rect.width, rect.height),
        zBaru,
        titik,
        rect.width,
        rect.height
      );
      posisiRef.current = { ...kini, ...pusatBaru, zoom: zBaru }; // event berikutnya bisa datang sebelum render
      setZoom(zBaru);
      setCenter(pusatBaru);
    };
    kanvas.addEventListener("wheel", saatRoda, { passive: false });
    return () => kanvas.removeEventListener("wheel", saatRoda);
  }, []);

  // Hanya pada pemakaian pertama (belum ada posisi tersimpan): pindahkan peta ke fix GPS pertama.
  // Setelah itu peta selalu dibuka di posisi terakhir; tombol "Pusatkan ke GPS" tetap tersedia.
  const sudahPusatRef = useRef(posisiTersimpan !== null);
  useEffect(() => {
    if (fokusKoordinat) {
      sudahPusatRef.current = true; // lokasi yang dituju menang atas pemusatan GPS otomatis
      // Permintaan fokus dari tab lain dipakai sekali lalu dikosongkan lewat onFokusDipakai
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCenter({ lat: fokusKoordinat.lat, lng: fokusKoordinat.lng });
      setZoom(16);
      if (fokusKoordinat.label) {
        setTargetGoTo({
          lat: fokusKoordinat.lat,
          lng: fokusKoordinat.lng,
          judul: fokusKoordinat.label
        });
      }
      onFokusDipakai?.();
    }
  }, [fokusKoordinat, onFokusDipakai]);

  useEffect(() => {
    if (sudahPusatRef.current || !perangkat.posisi || fokusKoordinat) return;
    sudahPusatRef.current = true;
    setCenter({ lat: perangkat.posisi.lat, lng: perangkat.posisi.lng });
  }, [perangkat.posisi, fokusKoordinat]);

  const latLngToPixel = useCallback(
    (lat: number, lng: number, width: number, height: number): { x: number; y: number } => {
      const centerTx = lngToTileX(center.lng, zoom);
      const centerTy = latToTileY(center.lat, zoom);
      const ptTx = lngToTileX(lng, zoom);
      const ptTy = latToTileY(lat, zoom);
      return {
        x: width / 2 + (ptTx - centerTx) * TILE_SIZE,
        y: height / 2 + (ptTy - centerTy) * TILE_SIZE
      };
    },
    [center, zoom]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Gunakan ukuran persegi ukuranCanvas agar seluruh sudut tertutup tanpa celah pada sudut apa pun
    const W = ukuranCanvas;
    const H = ukuranCanvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.scale(dpr, dpr);

    // 1. Latar Belakang Peta
    const grad = ctx.createLinearGradient(0, 0, W, H);
    if (basemap === "satelit") {
      grad.addColorStop(0, "#071f18");
      grad.addColorStop(0.5, "#0a291f");
      grad.addColorStop(1, "#051611");
    } else if (basemap === "topo") {
      grad.addColorStop(0, "#1c2826");
      grad.addColorStop(1, "#121d1b");
    } else {
      grad.addColorStop(0, "#0b1724");
      grad.addColorStop(1, "#071018");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 2. Muat & Gambar Tile Peta Satelit / OSM / Topo
    // Di atas zoom maksimum penyedia (mis. Sentinel-2 sampai z13), tile zoom tertinggi diperbesar
    if (basemap !== "taktis") {
      const zTile = zoomSumber(basemap, zoom);
      const ukuranTile = TILE_SIZE * Math.pow(2, zoom - zTile);
      const centerTx = lngToTileX(center.lng, zTile);
      const centerTy = latToTileY(center.lat, zTile);
      // Sumber berkuota (Google/Esri) hanya meminta tile yang tampil, tanpa tile cadangan di tepi
      const tepi = SUMBER_TILE[basemap].berkuota ? 0 : 1;
      const startTileX = Math.floor(centerTx - W / (2 * ukuranTile)) - tepi;
      const endTileX = Math.floor(centerTx + W / (2 * ukuranTile)) + tepi;
      const startTileY = Math.floor(centerTy - H / (2 * ukuranTile)) - tepi;
      const endTileY = Math.floor(centerTy + H / (2 * ukuranTile)) + tepi;
      for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
          const url = urlTile(basemap, zTile, tx, ty);
          if (!url) continue;
          const drawX = Math.round(W / 2 + (tx - centerTx) * ukuranTile);
          const drawY = Math.round(H / 2 + (ty - centerTy) * ukuranTile);
          const sisi = Math.ceil(ukuranTile);

          const cached = tileCacheRef.current.get(url);
          if (cached && cached !== "loading" && cached !== "error") {
            ctx.drawImage(cached, drawX, drawY, sisi, sisi);
          } else if (!cached) {
            tileCacheRef.current.set(url, "loading");
            // Tile yang sudah diunduh dibaca dari penyimpanan offline; selain itu dari jaringan
            const basemapTile = basemap;
            muatGambarTile(url).then(
              (img) => {
                tileCacheRef.current.set(url, img);
                laporHasilTile(basemapTile, true);
                setRenderTick((t) => t + 1);
              },
              () => {
                tileCacheRef.current.set(url, "error");
                // Templat cadangan dipakai bila templat utama terus gagal walau online
                if (laporHasilTile(basemapTile, false)) setRenderTick((t) => t + 1);
                // Coba lagi pada penggambaran berikutnya (mis. setelah koneksi kembali)
                window.setTimeout(() => {
                  if (tileCacheRef.current.get(url) === "error") tileCacheRef.current.delete(url);
                }, 15000);
              }
            );
          }
        }
      }
    }

    gambarLapisanPeta(ctx, {
      W,
      H,
      zoom,
      keLayar: (lat, lng) => latLngToPixel(lat, lng, W, H),
      dataSpasial,
      idTerpilih: objekTerpilih?.id,
      modeRekam,
      titikDraft,
      targetGoTo,
      gpsPos,
      kompasDerajat
    });
  }, [
    center,
    zoom,
    latLngToPixel,
    tinggiPeta,
    versiGoogle,
    basemap,
    dataSpasial,
    titikDraft,
    modeRekam,
    gpsPos,
    kompasDerajat,
    objekTerpilih,
    targetGoTo,
    ukuranCanvas,
    renderTick
  ]);

  /** Dua jari menyentuh: inisialisasi gestur 2 jari dengan intent locking (Avenza & Google Earth style) */
  const mulaiDuaJari = (kanvas: HTMLElement) => {
    setModeIkutiKompas(false); // interaksi gestur manual menonaktifkan mode ikuti sensor otomatis
    const jaris = Array.from(jariRef.current.entries());
    if (jaris.length < 2) return;
    const [p1Entry, p2Entry] = jaris;
    const p1 = { x: p1Entry[1].clientX, y: p1Entry[1].clientY, id: p1Entry[0] };
    const p2 = { x: p2Entry[1].clientX, y: p2Entry[1].clientY, id: p2Entry[0] };
    const jarak = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const sudut = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const rect = wadahPetaRef.current?.getBoundingClientRect() || kanvas.getBoundingClientRect();
    const titikLayar = { x: midX - rect.left, y: midY - rect.top };

    duaJariRef.current = {
      startP1: p1,
      startP2: p2,
      jarakAwal: Math.max(10, jarak),
      sudutAwal: sudut,
      midAwal: { x: midX, y: midY },
      pitchAwal: pitchRef.current,
      bearingAwal: bearingRef.current,
      zoomAwal: zoomRef.current,
      jangkar: pecahanDiLayar(centerRef.current, zoomRef.current, titikLayar, rect.width, rect.height),
      mode: "undecided"
    };
    dragRef.current.active = false;
    dragRef.current.moved = true; // gestur 2 jari tidak pernah dianggap ketukan objek
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (bukaMenuPeta) setBukaMenuPeta(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // browser lama: geser tetap berjalan selama pointer di atas kanvas
    }
    jariRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    if (jariRef.current.size === 2) {
      mulaiDuaJari(e.currentTarget);
      return;
    }
    if (jariRef.current.size > 2) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startLat: center.lat,
      startLng: center.lng,
      moved: false
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (jariRef.current.has(e.pointerId)) {
      jariRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    // Interaksi 2 jari dengan Gesture Intent Lock (Google Earth & Avenza Maps standard)
    if (duaJariRef.current && jariRef.current.size >= 2) {
      const jaris = Array.from(jariRef.current.entries());
      const p1Entry = jaris.find(([id]) => id === duaJariRef.current?.startP1.id) || jaris[0];
      const p2Entry = jaris.find(([id]) => id === duaJariRef.current?.startP2.id) || jaris[1];
      if (!p1Entry || !p2Entry) return;

      const p1 = p1Entry[1];
      const p2 = p2Entry[1];
      const jarakKini = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      const sudutKini = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX) * (180 / Math.PI);

      const { startP1, startP2, jarakAwal, sudutAwal, pitchAwal, bearingAwal, zoomAwal, jangkar } = duaJariRef.current;

      const dy1 = p1.clientY - startP1.y;
      const dy2 = p2.clientY - startP2.y;
      const dx1 = p1.clientX - startP1.x;
      const dx2 = p2.clientX - startP2.x;
      const avgDy = (dy1 + dy2) / 2;
      const diffDy = Math.abs(dy1 - dy2);
      const diffDx = Math.abs(dx1 - dx2);

      let deltaSudut = sudutKini - sudutAwal;
      while (deltaSudut > 180) deltaSudut -= 360;
      while (deltaSudut < -180) deltaSudut += 360;
      const absDeltaSudut = Math.abs(deltaSudut);
      const deltaJarak = Math.abs(jarakKini - jarakAwal);

      // 1. Klasifikasi Intent Gestur untuk mencegah konflik gerakan
      if (duaJariRef.current.mode === "undecided") {
        // TILT 3D: Geser 2 jari paralel ke atas/bawah bersamaan (Google Earth)
        if (Math.abs(avgDy) > 16 && diffDy < 34 && diffDx < 34 && absDeltaSudut < 12 && deltaJarak < 32) {
          duaJariRef.current.mode = "tilt";
        }
        // ROTASI: Putar 2 jari secara melingkar (Avenza Maps)
        else if (absDeltaSudut > 8 && jarakKini > 40) {
          duaJariRef.current.mode = "rotate_zoom";
        }
        // ZOOM: Cubit 2 jari (Pinch)
        else if (deltaJarak > 22 && absDeltaSudut < 8) {
          duaJariRef.current.mode = "zoom_only";
        }
      }

      // 2. Eksekusi gerakan sesuai mode yang terkunci
      if (duaJariRef.current.mode === "tilt") {
        // Kunci rotasi dan zoom: HANYA ubah pitch kemiringan 3D
        const deltaPitch = -avgDy * 0.28;
        const pitchBaru = Math.min(60, Math.max(0, Math.round(pitchAwal + deltaPitch)));
        setPitch(pitchBaru);
        return;
      }

      if (duaJariRef.current.mode === "rotate_zoom") {
        // Kunci pitch: HANYA ubah rotasi arah peta dan zoom cubit
        let bearingBaru = Math.round(bearingAwal + deltaSudut) % 360;
        if (bearingBaru < 0) bearingBaru += 360;
        setBearing(bearingBaru);

        if (Math.abs(jarakKini / jarakAwal - 1) > 0.04) {
          const rect = wadahPetaRef.current?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
          const midKini = { x: (p1.clientX + p2.clientX) / 2 - rect.left, y: (p1.clientY + p2.clientY) / 2 - rect.top };
          const zBaru = zoomCubit(zoomAwal, jarakAwal, jarakKini);
          setZoom(zBaru);
          setCenter(pusatUntukJangkar(jangkar, zBaru, midKini, rect.width, rect.height));
        }
        return;
      }

      if (duaJariRef.current.mode === "zoom_only") {
        // Kunci pitch: HANYA ubah zoom cubit
        const rect = wadahPetaRef.current?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
        const midKini = { x: (p1.clientX + p2.clientX) / 2 - rect.left, y: (p1.clientY + p2.clientY) / 2 - rect.top };
        const zBaru = zoomCubit(zoomAwal, jarakAwal, jarakKini);
        setZoom(zBaru);
        setCenter(pusatUntukJangkar(jangkar, zBaru, midKini, rect.width, rect.height));

        if (absDeltaSudut > 14) {
          duaJariRef.current.mode = "rotate_zoom";
        }
        return;
      }

      return;
    }

    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
      setModeIkutiKompas(false); // geser manual menonaktifkan mode kompas otomatis
    }

    // Rotasi dan proyeksi translasi layar ke koordinat peta lokal (memperhitungkan rotasi & kemiringan 3D)
    const rad = (bearingRef.current * Math.PI) / 180;
    const pitchRad = (pitchRef.current * Math.PI) / 180;
    const cosP = Math.max(0.2, Math.cos(pitchRad));
    const dyGround = dy / cosP;
    const localDx = dx * Math.cos(rad) - dyGround * Math.sin(rad);
    const localDy = dx * Math.sin(rad) + dyGround * Math.cos(rad);

    const startTx = lngToTileX(dragRef.current.startLng, zoom);
    const startTy = latToTileY(dragRef.current.startLat, zoom);
    const newLng = tileXToLng(startTx - localDx / TILE_SIZE, zoom);
    const newLat = tileYToLat(startTy - localDy / TILE_SIZE, zoom);
    setCenter({
      lat: Math.max(-85, Math.min(85, newLat)),
      lng: Math.max(-180, Math.min(180, newLng))
    });
  };

  /** Satu jari diangkat dari interaksi 2 jari: jari yang tersisa melanjutkan geser peta */
  const akhiriJari = (e: React.PointerEvent<HTMLCanvasElement>): boolean => {
    jariRef.current.delete(e.pointerId);
    if (!duaJariRef.current) return false;
    if (jariRef.current.size >= 2) {
      mulaiDuaJari(e.currentTarget);
      return true;
    }
    duaJariRef.current = null;
    const sisa = Array.from(jariRef.current.values())[0];
    if (sisa) {
      dragRef.current = {
        active: true,
        startX: sisa.clientX,
        startY: sisa.clientY,
        startLat: center.lat,
        startLng: center.lng,
        moved: true
      };
    } else {
      dragRef.current.active = false;
    }
    return true;
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!akhiriJari(e)) dragRef.current.active = false;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (akhiriJari(e)) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;

    if (!wasMoved && canvasRef.current) {
      const rect = wadahPetaRef.current?.getBoundingClientRect() || canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (!modeRekam) {
        const cW = ukuranCanvas;
        const cH = ukuranCanvas;
        let ptLayar = {
          x: cW / 2 + (clickX - rect.width / 2),
          y: cH / 2 + (clickY - rect.height / 2)
        };

        if (pitch > 0 || bearingAktif !== 0) {
          const inv = layarKeKanvas(clickX, clickY, rect.width, rect.height, cW, cH, pitch, bearingAktif);
          if (inv) ptLayar = inv;
        }

        for (const item of dataSpasial) {
          const refCoord = item.koordinat[0];
          if (!refCoord) continue;
          const p = latLngToPixel(refCoord.lat, refCoord.lng, cW, cH);
          const dist = Math.hypot(ptLayar.x - p.x, ptLayar.y - p.y);
          if (dist <= 28) {
            setObjekTerpilih(item);
            return;
          }
        }
      }
    }
  };

  const tambahTitikBidikan = () => {
    const pt = titikDariBidikan(center, posisiNyata);
    if (modeRekam === "point") {
      setTitikDraft([pt]);
      setBukaModalForm(true);
    } else {
      perekamLatar.tambahTitik(pt);
    }
  };

  const mulaiModeRekam = (jenis: JenisGeometri) => {
    setObjekTerpilih(null);
    setModeRekam(jenis);
    setBukaAlatRekam(false);
    const ptAwal = titikDariBidikan(center, posisiNyata);
    if (jenis === "point") {
      setTitikDraft([ptAwal]);
      form.setKategoriInput("Flora");
      setBukaModalForm(true);
    } else {
      setTitikDraft([ptAwal]);
      form.setKategoriInput(jenis === "polygon" ? "Wilayah Adat / Lahan" : "Flora");
      // Mulai perekaman di latar belakang agar tetap merekam walaupun pindah tab
      perekamLatar.mulai(jenis, [ptAwal]);
    }
  };

  const handleSimpanForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeRekam || titikDraft.length === 0) return;
    onSimpanDataBaru(form.susunItem(profil, modeRekam, titikDraft, kompasDerajat));
    perekamLatar.selesai();
    setBukaModalForm(false);
    setModeRekam(null);
    setTitikDraft([]);
    form.kosongkan();
  };

  const handleImporFileSpasial = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (onImporBerkas(file.name, String(reader.result || ""))) setBukaMenuPeta(false);
      input.value = ""; // izinkan memilih berkas yang sama lagi
    };
    reader.onerror = () => {
      onImporBerkas(file.name, "");
      input.value = "";
    };
    reader.readAsText(file);
  };

  // Kotak wilayah = bagian peta yang terlihat di layar saat modal dibuka
  const hitungKotakTerlihat = useCallback((): KotakWilayah => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const W = rect?.width || 360;
    const H = rect?.height || 480;
    const cTx = lngToTileX(center.lng, zoom);
    const cTy = latToTileY(center.lat, zoom);
    return {
      minLng: tileXToLng(cTx - W / 2 / TILE_SIZE, zoom),
      maxLng: tileXToLng(cTx + W / 2 / TILE_SIZE, zoom),
      maxLat: tileYToLat(cTy - H / 2 / TILE_SIZE, zoom),
      minLat: tileYToLat(cTy + H / 2 / TILE_SIZE, zoom)
    };
  }, [center, zoom]);

  // Hak cipta citra Google mengikuti area yang tampil; diambil setelah peta berhenti bergerak
  useEffect(() => {
    if (basemap !== "google") return;
    let batal = false;
    const t = window.setTimeout(() => {
      const k = hitungKotakTerlihat();
      void ambilAtribusiGoogle({ utara: k.maxLat, selatan: k.minLat, timur: k.maxLng, barat: k.minLng }, zoom).then((teks) => {
        if (!batal && teks) setAtribusiGoogle(teks);
      });
    }, 700);
    return () => {
      batal = true;
      window.clearTimeout(t);
    };
  }, [basemap, zoom, versiGoogle, hitungKotakTerlihat]);

  const panjangDraftKm = hitungPanjangGarisKm(titikDraft);
  const luasDraftHa = hitungLuasPoligonHa(titikDraft);

  const jarakKeTargetMeter = targetGoTo && gpsPos ? Math.round(hitungJarakMeter(gpsPos, targetGoTo)) : null;
  const bearingKeTarget = targetGoTo && gpsPos ? hitungBearingDerajat(gpsPos, targetGoTo) : null;
  const belokKeTarget = bearingKeTarget !== null && kompasDerajat !== undefined ? selisihArah(bearingKeTarget, kompasDerajat) : null;
  const infoGps = teksStatusGps(perangkat, simulasiAktif);
  const infoKompas = teksStatusKompas(perangkat);

  return (
    <div className="map-module-wrapper clean-map-mode">
      {/* BANNER NAVIGASI GO-TO WAYPOINT JIKA AKTIF */}
      {targetGoTo && (
        <div className="goto-nav-banner">
          <div>
            <strong>🎯 {targetGoTo.judul}</strong>
            <div className="goto-nav-sub">
              {jarakKeTargetMeter === null || bearingKeTarget === null ? (
                "Menunggu posisi GPS…"
              ) : (
                <>
                  {jarakKeTargetMeter >= 1000 ? `${(jarakKeTargetMeter / 1000).toFixed(2)} km` : `${jarakKeTargetMeter} m`} •{" "}
                  {bearingKeTarget}° ({namaArahKompas(bearingKeTarget)})
                  {belokKeTarget !== null &&
                    (Math.abs(belokKeTarget) < 10
                      ? " • lurus"
                      : ` • belok ${Math.abs(belokKeTarget)}° ke ${belokKeTarget > 0 ? "kanan" : "kiri"}`)}
                </>
              )}
            </div>
          </div>
          <button type="button" className="btn-outline-sm" onClick={() => setTargetGoTo(null)}>
            Tutup
          </button>
        </div>
      )}

      {/* KANVAS PETA INTERAKTIF FULL-VIEW DAN CLEAN DI MOBILE */}
      <div
        className="map-canvas-container clean-canvas"
        ref={wadahPetaRef}
        style={tinggiPeta !== null ? { height: tinggiPeta } : undefined}
      >
        <div className="map-canvas-3d-viewport">
          <div
            className="map-canvas-3d-inner"
            style={{
              width: `${ukuranCanvas}px`,
              height: `${ukuranCanvas}px`,
              left: "50%",
              top: "50%",
              marginLeft: `${-ukuranCanvas / 2}px`,
              marginTop: `${-ukuranCanvas / 2}px`,
              transform: `perspective(1000px) rotateX(${pitch}deg) rotateZ(${-bearingAktif}deg)`,
              transformOrigin: "50% 50%"
            }}
          >
            <canvas
              ref={canvasRef}
              className="map-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            />
          </div>
        </div>

        {/* PILL KOORDINAT RINGKAS DI KIRI ATAS (KETUK UNTUK GANTI DD/DMS/UTM) */}
        <div className="map-clean-top-left">
          <button
            type="button"
            className="map-coord-mini-pill"
            onClick={() => setFormatKoord((f) => (f === "DD" ? "DMS" : f === "DMS" ? "UTM" : "DD"))}
            title="Ketuk untuk ubah format koordinat (DD / DMS / UTM)"
          >
            <Crosshair size={13} className="text-emerald" />
            <span>{formatKoordinatTeks(center.lat, center.lng, formatKoord)}</span>
            <small style={infoGps.peringatan ? { color: "#fbbf24" } : undefined}>{infoGps.teks}</small>
          </button>
          <div style={{ marginTop: 6 }}>
            <button
              type="button"
              className="map-coord-mini-pill"
              onClick={infoKompas.perluKetuk ? () => void aktifkanKompas() : undefined}
              style={{ cursor: infoKompas.perluKetuk ? "pointer" : "default" }}
              title={infoKompas.perluKetuk ? "Ketuk untuk mengizinkan sensor kompas" : "Arah atas layar HP"}
            >
              <Compass size={13} className="text-emerald" />
              <span style={infoKompas.peringatan ? { color: "#fbbf24" } : undefined}>
                {kompasDerajat !== undefined ? `${kompasDerajat}° ${namaArahKompas(kompasDerajat).split(" ")[0]}` : infoKompas.teks}
              </span>
            </button>
          </div>
        </div>

        {/* TOMBOL KONTROL RINGKAS DI KANAN ATAS (TIDAK MENGHALANGI PETA) */}
        <div className="map-overlay-top-right">
          {onBukaSmartwatch && (
            <button type="button" className="map-ctrl-btn smartwatch-map-btn" onClick={onBukaSmartwatch} title="Mode Smartwatch">
              <Watch size={16} />
            </button>
          )}

          {/* Tombol Kompas Peta Avenza Style:
              - Jika berputar / 3D: Ketuk untuk Reset ke Utara (0°) & 2D Datar
              - Jika normal: Ketuk untuk Mode Kompas HP (Peta Berputar Otomatis Mengikuti Sensor HP) */}
          <button
            type="button"
            className={`map-ctrl-btn compass-ctrl-btn ${modeIkutiKompas ? "compass-mode-active" : (bearingAktif !== 0 || pitch !== 0) ? "compass-rotated" : ""}`}
            onClick={() => {
              if (modeIkutiKompas) {
                setModeIkutiKompas(false);
                setBearing(0);
                setPitch(0);
              } else if (bearingAktif !== 0 || pitch !== 0) {
                setModeIkutiKompas(false);
                setBearing(0);
                setPitch(0);
              } else {
                setModeIkutiKompas(true);
              }
            }}
            title={
              modeIkutiKompas
                ? "Mode Kompas Sensor HP Aktif. Ketuk untuk matikan."
                : (bearingAktif !== 0 || pitch !== 0)
                ? `Rotasi: ${bearingAktif}°, Kemiringan: ${pitch}°. Ketuk untuk reset ke Utara (0°) & 2D Datar.`
                : "Ketuk untuk Mode Kompas Sensor HP (Otomatis Putar Saat Berjalan)"
            }
          >
            <Compass
              size={18}
              style={{
                transform: `rotate(${-bearingAktif}deg)`,
                transition: "transform 0.15s ease-out",
                color: modeIkutiKompas ? "#10b981" : (bearingAktif !== 0 || pitch !== 0) ? "#ef4444" : "#475569"
              }}
            />
          </button>

          {/* Tombol Cepat Alih Mode 2D / 3D (Google Earth Style) */}
          <button
            type="button"
            className={`map-ctrl-btn toggle-3d-btn ${pitch > 0 ? "active-3d" : ""}`}
            onClick={() => setPitch((p) => (p > 0 ? 0 : 45))}
            title={pitch > 0 ? "Beralih ke Peta Datar 2D" : "Beralih ke Perspektif Peta 3D (45°)"}
          >
            <span style={{ fontSize: "0.72rem", fontWeight: 800 }}>{pitch > 0 ? "2D" : "3D"}</span>
          </button>

          <button
            type="button"
            className={`map-ctrl-btn ${bukaMenuPeta ? "active-ctrl" : ""}`}
            onClick={() => setBukaMenuPeta((v) => !v)}
            title="Lapisan Peta & Alat Offline"
          >
            <Layers size={17} />
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => gpsPos && setCenter({ lat: gpsPos.lat, lng: gpsPos.lng })}
            disabled={!gpsPos}
            style={gpsPos ? undefined : { opacity: 0.45 }}
            title={gpsPos ? "Pusatkan ke GPS Saya" : "Menunggu posisi GPS"}
          >
            <Navigation size={16} />
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAKS_PETA, Math.floor(z + 0.01) + 1))}
            title="Perbesar"
          >
            +
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN_PETA, Math.ceil(z - 0.01) - 1))}
            title="Perkecil"
          >
            −
          </button>
        </div>

        {/* POPOVER LAPISAN & ALAT PETA (HANYA TAMPIL SAAT TOMBOL LAYERS DIKETUK) */}
        {bukaMenuPeta && (
          <PanelLapisanPeta
            basemap={basemap}
            jumlahObjek={dataSpasial.length}
            tampilDaftarObjek={tampilDaftarObjek}
            pitch={pitch}
            bearing={bearingAktif}
            modeIkutiKompas={modeIkutiKompas}
            onAlihModeIkutiKompas={() => setModeIkutiKompas((v) => !v)}
            onUbahPitch={(p) => setPitch(p)}
            onUbahBearing={(b) => {
              setModeIkutiKompas(false);
              setBearing(b);
            }}
            onReset3D={() => {
              setModeIkutiKompas(false);
              setPitch(0);
              setBearing(0);
            }}
            onPilihBasemap={setBasemap}
            onUnduhOffline={() => unduh.bukaModalUnduh(hitungKotakTerlihat(), zoom)}
            onPilihBerkas={handleImporFileSpasial}
            onAlihDaftarObjek={() => setTampilDaftarObjek((v) => !v)}
            onTutup={() => setBukaMenuPeta(false)}
          />
        )}

        {/* BARIS BAWAH PETA: atribusi (wajib menurut lisensi) di kiri bawah, tombol rekam/panel rekam di kanan.
            Bila tidak muat dalam satu baris (layar sempit, huruf besar, panel rekam), tombol naik ke atas
            atribusi sehingga tidak pernah saling menutupi. */}
        <div className="map-bawah">
          {/* Atribusi sumber peta wajib tampil menurut lisensi/ketentuan penyedia */}
          {basemap === "google" ? (
            // Ketentuan Google: logo Google tidak boleh tertutup dan teks hak cipta dari Google wajib tampil
            <div id="atribusi-peta" className="map-atribusi map-atribusi-google">
              {logoGoogleGagal ? (
                <strong className="map-logo-google-teks">Google</strong>
              ) : (
                <img
                  className="map-logo-google"
                  src={LOGO_GOOGLE}
                  alt="Google"
                  height={18}
                  draggable={false}
                  onError={() => setLogoGoogleGagal(true)}
                />
              )}
              <a href={SUMBER_TILE.google.tautanLisensi} target="_blank" rel="noopener noreferrer" title={SUMBER_TILE.google.lisensi}>
                {atribusiGoogle ?? "Citra © Google"}
              </a>
            </div>
          ) : (
            basemap !== "taktis" && (
              <a
                id="atribusi-peta"
                className="map-atribusi"
                href={SUMBER_TILE[basemap].tautanLisensi || undefined}
                target="_blank"
                rel="noopener noreferrer"
                title={SUMBER_TILE[basemap].lisensi}
              >
                {SUMBER_TILE[basemap].atribusi}
              </a>
            )
          )}
          {/* PANEL KONTROL SAAT SEDANG MEREKAM GARIS TRACKING ATAU POLIGON (LATAR BELAKANG) */}
          {modeRekam && modeRekam !== "point" && (
            <PanelPerekaman
              rekamLatar={rekamLatar}
              modeRekam={modeRekam}
              jumlahTitik={titikDraft.length}
              panjangDraftKm={panjangDraftKm}
              luasDraftHa={luasDraftHa}
              detikTick={detikTick}
              onTambahTitik={tambahTitikBidikan}
              onSimpan={() => setBukaModalForm(true)}
              onBatal={() => {
                perekamLatar.batal();
                setModeRekam(null);
                setTitikDraft([]);
              }}
            />
          )}
          {/* TOMBOL REKAM RINGKAS YANG BISA DISEMBUNYIKAN AGAR TIDAK MENGHALANGI PETA */}
          {!modeRekam && (
            <div className="map-clean-bottom-bar">
              {!bukaAlatRekam ? (
                <button type="button" className="map-fab-record-trigger" onClick={() => setBukaAlatRekam(true)}>
                  <Plus size={18} strokeWidth={2.5} />
                  <span>Rekam Lokasi</span>
                </button>
              ) : (
                <div className="map-compact-record-pills">
                  <button type="button" className="compact-rec-pill" onClick={() => mulaiModeRekam("point")}>
                    <MapPin size={15} />
                    <span>Titik</span>
                  </button>
                  <button type="button" className="compact-rec-pill" onClick={() => mulaiModeRekam("line")}>
                    <Route size={15} />
                    <span>Jalur</span>
                  </button>
                  <button type="button" className="compact-rec-pill" onClick={() => mulaiModeRekam("polygon")}>
                    <Square size={15} />
                    <span>Poligon</span>
                  </button>
                  <button
                    type="button"
                    className="compact-rec-close"
                    onClick={() => setBukaAlatRekam(false)}
                    title="Sembunyikan alat rekam"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PANEL DETAIL OBJEK EXISTING KETIKA DIKLIK DI PETA */}
      {objekTerpilih && (
        <InspektorObjek
          objek={objekTerpilih}
          kondisiUpdateInput={kondisiUpdateInput}
          setKondisiUpdateInput={setKondisiUpdateInput}
          onTambahPembaruanObjek={onTambahPembaruanObjek}
          onGoTo={setTargetGoTo}
          onTutup={() => setObjekTerpilih(null)}
        />
      )}

      {/* DAFTAR OBJEK (HANYA MUNCUL JIKA DIAKTIFKAN DARI MENU LAYERS) */}
      {tampilDaftarObjek && dataSpasial.length > 0 && (
        <div className="map-feature-strip">
          {dataSpasial.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`strip-chip ${objekTerpilih?.id === d.id ? "active" : ""}`}
              onClick={() => {
                setObjekTerpilih(d);
                if (d.koordinat[0]) {
                  setCenter({ lat: d.koordinat[0].lat, lng: d.koordinat[0].lng });
                }
              }}
            >
              {d.jenisGeometri === "point" ? "📍" : d.jenisGeometri === "line" ? "〰️" : "⬢"} {d.judul.slice(0, 20)}
            </button>
          ))}
        </div>
      )}

      {/* MODAL FORM PENYIMPANAN ATRIBUT SURVEI LAPANGAN */}
      {bukaModalForm && (
        <FormSurveiModal
          form={form}
          modeRekam={modeRekam}
          panjangDraftKm={panjangDraftKm}
          luasDraftHa={luasDraftHa}
          onSimpan={handleSimpanForm}
          onTutup={() => {
            setBukaModalForm(false);
            if (modeRekam === "point") {
              setModeRekam(null);
              setTitikDraft([]);
            }
          }}
        />
      )}

      {/* MODAL PENGUNDUH PETA SATELIT OFFLINE */}
      {unduh.bukaModalOffline && <UnduhOfflineModal basemap={basemap} areaOffline={areaOffline} unduh={unduh} onBukaArea={setCenter} />}
    </div>
  );
};
