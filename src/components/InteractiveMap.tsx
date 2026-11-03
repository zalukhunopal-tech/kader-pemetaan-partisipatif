import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AreaPetaOffline, BasemapType, DataSpasialItem, FormatKoordinat, JenisGeometri, KoordinatTitik, ProfilKader } from "../types";
import {
  formatKoordinatTeks,
  hitungBearingDerajat,
  hitungJarakMeter,
  hitungLuasPoligonHa,
  hitungPanjangGarisKm,
  namaArahKompas,
  snapKeVertex,
  validasiGeometri
} from "../lib/geoUtils";
import { durasiRekamMs, formatDurasi, perekamLatar, usePerekamLatar } from "../lib/perekamLatar";
import { bacaPosisiPeta, POSISI_AWAL_PETA, simpanPosisiPeta, ZOOM_MAKS_PETA, ZOOM_MIN_PETA } from "../lib/posisiPeta";
import { PecahanDunia, jepitZoom, langkahZoomRoda, pecahanDiLayar, pusatUntukJangkar, zoomCubit } from "../lib/zoomPeta";
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
import { RailAlatPeta } from "./peta/RailAlatPeta";
import { ChipKoordinatPeta } from "./peta/ChipKoordinatPeta";
import { bacaSistemKoordinat, simpanSistemKoordinat, SistemKoordinat } from "../lib/sistemKoordinat";
import { LOGO_GOOGLE, ambilAtribusiGoogle, pantauSesiGoogle } from "../lib/googleTiles";
import { aktifkanKompas, selisihArah, titikDariBidikan, usePosisiPerangkat } from "../lib/posisiPerangkat";
import { ArrowLeft, Compass, Crosshair, Info, Layers, MapPin, Navigation, Plus, Route, Search, Square, X, PenTool, Edit3 } from "lucide-react";

interface InteractiveMapProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  areaOffline: AreaPetaOffline[];
  petaKustomAktif?: AreaPetaOffline | null;
  onTutupPetaKustom?: () => void;
  onPilihPetaKustom?: (area: AreaPetaOffline) => void;
  fokusKoordinat?: { lat: number; lng: number; label?: string } | null;
  /** Dipanggil setelah fokus dipakai, agar fokus lama tidak menimpa posisi terakhir saat peta dibuka lagi */
  onFokusDipakai?: () => void;
  onSimpanDataBaru: (item: DataSpasialItem) => void;
  onTambahPembaruanObjek: (idData: string, kondisiTerbaru: string, catatan: string, fotoBase64?: string) => boolean;
  onSimpanAreaOffline: (area: AreaPetaOffline) => void;
  onImporBerkas: (namaBerkas: string, isi: string) => boolean;
  onHapusAreaOffline?: (id: string) => void;
}

/** Format nama peta agar tidak melebar atau meluap keluar layar (Avenza style) */
export function formatJudulAvenza(nama: string, maxLen = 22): string {
  if (nama.length <= maxLen) return nama;
  return nama.slice(0, maxLen - 3) + "...";
}

/**
 * Menghitung proyeksi dari koordinat piksel layar ke kanvas lokal
 * saat peta dalam rotasi kompas 2D (rotateZ).
 */
function layarKeKanvas(
  screenX: number,
  screenY: number,
  containerW: number,
  containerH: number,
  canvasW: number,
  canvasH: number,
  bearing: number
): { x: number; y: number } {
  const x0 = screenX - containerW / 2;
  const y0 = screenY - containerH / 2;
  const bRad = (bearing * Math.PI) / 180;
  const u = x0 * Math.cos(bRad) - y0 * Math.sin(bRad);
  const v = x0 * Math.sin(bRad) + y0 * Math.cos(bRad);
  return {
    x: canvasW / 2 + u,
    y: canvasH / 2 + v
  };
}

/** Hitung panjang batang dan label skala peta dinamis (Avenza Maps style) */
function hitungSkalaPeta(lat: number, zoom: number): { label: string; lebarPx: number } {
  const meterPerPiksel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const targetMeter = 100 * meterPerPiksel;
  const opsiMeter = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
  let terpilih = opsiMeter[0];
  for (const m of opsiMeter) {
    if (m <= targetMeter * 1.45) {
      terpilih = m;
    } else {
      break;
    }
  }
  const lebarPx = Math.max(52, Math.min(160, Math.round(terpilih / meterPerPiksel)));
  const label = terpilih >= 1000 ? `${terpilih / 1000} km` : `${terpilih} m`;
  return { label, lebarPx };
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  dataSpasial,
  profil,
  areaOffline,
  petaKustomAktif,
  onTutupPetaKustom,
  onPilihPetaKustom,
  fokusKoordinat,
  onFokusDipakai,
  onSimpanDataBaru,
  onTambahPembaruanObjek,
  onSimpanAreaOffline,
  onImporBerkas,
  onHapusAreaOffline
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileCacheRef = useRef<Map<string, HTMLImageElement | "loading" | "error">>(new Map());
  const [bukaInfoPetaKustom, setBukaInfoPetaKustom] = useState<boolean>(false);
  const [cariKoordInput, setCariKoordInput] = useState<string>("");
  const [cariKoordTerbuka, setCariKoordTerbuka] = useState<boolean>(false);
  const [galatPencarian, setGalatPencarian] = useState("");
  const cariKoordinat = () => {
    const match = cariKoordInput.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
    if (!match || Math.abs(Number(match[1])) > 85 || Math.abs(Number(match[2])) > 180) {
      setGalatPencarian("Masukkan lintang −85 sampai 85 dan bujur −180 sampai 180, misalnya −6.1754, 106.8272.");
      return;
    }
    setCenter({ lat: Number(match[1]), lng: Number(match[2]) });
    setCariKoordTerbuka(false);
    setGalatPencarian("");
  };

  // Peta dibuka di posisi, zoom, dan basemap terakhir (bukan lokasi bawaan)
  const [posisiTersimpan] = useState(() => bacaPosisiPeta());
  const [center, setCenter] = useState<{ lat: number; lng: number }>(() =>
    posisiTersimpan ? { lat: posisiTersimpan.lat, lng: posisiTersimpan.lng } : POSISI_AWAL_PETA
  );
  const [zoom, setZoom] = useState<number>(() => posisiTersimpan?.zoom ?? 15);
  // Rotasi arah peta (0-359°)
  const [bearing, setBearing] = useState<number>(() => posisiTersimpan?.bearing ?? 0);
  // Mode Orientasi Otomatis (peta berputar mengikuti sensor arah hadap/kompas perangkat)
  const [modeIkutiKompas, setModeIkutiKompas] = useState<boolean>(false);

  // Pelacak klik tombol navigasi gabungan: 1x klik = pusatkan posisi, 2x klik = ikuti arah kompas
  const lastGpsClickRef = useRef<number>(0);
  const clickTimeoutRef = useRef<number | null>(null);

  // Ukuran sisi persegi canvas 3D (selalu melingkupi seluruh viewport HP pada sudut rotasi 0-360° dan tilt 0-60°)
  const [ukuranCanvas, setUkuranCanvas] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const diag = Math.hypot(window.innerWidth, window.innerHeight);
      return Math.max(1600, Math.ceil(diag * 2.2));
    }
    return 1400;
  });

  useLayoutEffect(() => {
    const el = wadahPetaRef.current;
    if (!el) return;
    const hitungUkuran = () => {
      const rect = el.getBoundingClientRect();
      const diag = Math.hypot(rect.width || window.innerWidth, rect.height || window.innerHeight);
      const side = Math.max(1600, Math.ceil(diag * 2.2));
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
  const [sistemKoord, setSistemKoord] = useState<SistemKoordinat>(() => bacaSistemKoordinat());
  const [renderTick, setRenderTick] = useState<number>(0);

  // State UI Clean Mode: fitur disembunyikan agar tidak menghalangi peta di HP
  const [bukaMenuPeta, setBukaMenuPeta] = useState<boolean>(false);
const [bukaAlatRekam, setBukaAlatRekam] = useState<boolean>(false);
  const [modePetaBersih, setModePetaBersih] = useState<boolean>(false);
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
  const form = useFormSurvei(profil.idKader);
  const simpanGeometri = form.simpanGeometri;
  const [snapAktif, setSnapAktif] = useState(true);
  const [pesanSalin, setPesanSalin] = useState("");
  const [modeRekam, setModeRekam] = useState<JenisGeometri | null>(() =>
    rekamLatar.status !== "idle" && rekamLatar.jenis ? rekamLatar.jenis : (form.rekaman?.jenis ?? null)
  );
  const [titikDraft, setTitikDraft] = useState<KoordinatTitik[]>(() =>
    rekamLatar.status !== "idle" ? rekamLatar.titik : (form.rekaman?.titik ?? [])
  );
  const [bukaModalForm, setBukaModalForm] = useState<boolean>(false);
  const [detikTick, setDetikTick] = useState<number>(0);
  useEffect(() => {
    simpanGeometri(modeRekam, titikDraft);
  }, [modeRekam, titikDraft, simpanGeometri]);

  // Simpan posisi peta (ditunda sedikit) dan pastikan tersimpan saat aplikasi ditutup/disembunyikan
  const posisiRef = useRef({ ...center, zoom, basemap, bearing: bearingAktif });
  const bearingRef = useRef(bearing);
  const zoomRef = useRef(zoom);
  const centerRef = useRef(center);
  useLayoutEffect(() => {
    bearingRef.current = bearingAktif;
    zoomRef.current = zoom;
    centerRef.current = center;
    posisiRef.current = { ...center, zoom, basemap, bearing: bearingAktif };
  }, [center, zoom, basemap, bearingAktif]);
  useEffect(() => {
    const t = window.setTimeout(() => simpanPosisiPeta(posisiRef.current), 300);
    return () => window.clearTimeout(t);
  }, [center, zoom, basemap, bearingAktif]);
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
        const tinggiNav = window.matchMedia("(min-width: 768px)").matches ? 0 : nav ? nav.getBoundingClientRect().height : 0;
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
  }, [petaKustomAktif, targetGoTo]);

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
      const frame = requestAnimationFrame(() => {
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
      });
      return () => cancelAnimationFrame(frame);
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

    // 1. Latar Belakang Peta: Jika partisi Lembar Peta Kustom aktif, gunakan meja netral terisolasi tanpa basemap
    if (petaKustomAktif) {
      ctx.fillStyle = "#4a4d52";
      ctx.fillRect(0, 0, W, H);
    } else {
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
    }

    // 2. Muat & Gambar Tile Peta Satelit / OSM / Topo (HANYA PADA PARTISI PETA DASAR ONLINE)
    // Pemisahan tegas: saat partisi lembar peta aktif, tile basemap TIDAK digambar agar tidak bercampur!
    if (!petaKustomAktif && basemap !== "taktis") {
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
      kompasDerajat,
      petaKustomAktif,
      saatGambarSiap: () => setRenderTick((t) => t + 1)
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
    petaKustomAktif,
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
      pitchAwal: 0,
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

    // Interaksi 2 jari (Zoom Cubit & Putar Rotasi Peta)
    if (duaJariRef.current && jariRef.current.size >= 2) {
      const jaris = Array.from(jariRef.current.entries());
      const p1Entry = jaris.find(([id]) => id === duaJariRef.current?.startP1.id) || jaris[0];
      const p2Entry = jaris.find(([id]) => id === duaJariRef.current?.startP2.id) || jaris[1];
      if (!p1Entry || !p2Entry) return;

      const p1 = p1Entry[1];
      const p2 = p2Entry[1];
      const jarakKini = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      const sudutKini = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX) * (180 / Math.PI);

      const { jarakAwal, sudutAwal, bearingAwal, zoomAwal, jangkar } = duaJariRef.current;

      let deltaSudut = sudutKini - sudutAwal;
      while (deltaSudut > 180) deltaSudut -= 360;
      while (deltaSudut < -180) deltaSudut += 360;
      const absDeltaSudut = Math.abs(deltaSudut);
      const deltaJarak = Math.abs(jarakKini - jarakAwal);

      // Klasifikasi Intent Gestur
      if (duaJariRef.current.mode === "undecided") {
        if (absDeltaSudut > 8 && jarakKini > 40) {
          duaJariRef.current.mode = "rotate_zoom";
        } else if (deltaJarak > 18) {
          duaJariRef.current.mode = "zoom_only";
        }
      }

      if (duaJariRef.current.mode === "rotate_zoom") {
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

    // Rotasi translasi layar ke koordinat peta lokal (2D)
    const rad = (bearingRef.current * Math.PI) / 180;
    const localDx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localDy = dx * Math.sin(rad) + dy * Math.cos(rad);

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

        if (bearingAktif !== 0) {
          ptLayar = layarKeKanvas(clickX, clickY, rect.width, rect.height, cW, cH, bearingAktif);
        }

        let objekKena = false;
        for (const item of dataSpasial) {
          const refCoord = item.koordinat[0];
          if (!refCoord) continue;
          const p = latLngToPixel(refCoord.lat, refCoord.lng, cW, cH);
          const dist = Math.hypot(ptLayar.x - p.x, ptLayar.y - p.y);
          if (dist <= 28) {
            setObjekTerpilih(item);
            objekKena = true;
            return;
          }
        }

        // 1-Click Clean Map Mode toggle saat kanvas peta diketuk tanpa menyeret
        if (!objekKena) {
          setModePetaBersih((v) => !v);
        }
      }
    }
  };

  const tambahTitikBidikan = () => {
    const brut = titikDariBidikan(center, posisiNyata);
    const pt =
      snapAktif && modeRekam === "polygon"
        ? snapKeVertex(
            brut,
            dataSpasial.flatMap((d) => d.koordinat),
            5
          )
        : brut;
    if (modeRekam === "point") {
      setTitikDraft([pt]);
      setBukaModalForm(true);
    } else {
      perekamLatar.tambahTitik(pt);
    }
  };

  const mulaiModeRekam = (jenis: JenisGeometri) => {
    setBukaMenuPeta(false);
    setObjekTerpilih(null);
    setModeRekam(jenis);
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
    if (!modeRekam || titikDraft.length === 0 || validasiGeometri(modeRekam, titikDraft).length > 0) return;
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
  const skalaInfo = hitungSkalaPeta(center.lat, zoom);

  return (
    <div className={`map-module-wrapper clean-map-mode temukan-field ${petaKustomAktif ? "avenza-custom-active" : ""} ${modePetaBersih ? "clean-map-immersion" : ""}`}>
      {/* HEADER BAR KHUSUS LEMBAR PETA GEOPDF (AVENZA MAPS STYLE) */}
      {petaKustomAktif && (
        <header className="avenza-map-header-bar">
          <button
            type="button"
            className="avenza-head-btn"
            onClick={onTutupPetaKustom}
            title="Kembali ke Pustaka Peta"
            aria-label="Kembali"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="avenza-head-title-wrap">
            <span className="avenza-head-title" title={petaKustomAktif.namaArea}>
              {formatJudulAvenza(petaKustomAktif.namaArea)}
            </span>
          </div>
          <div className="avenza-head-actions">
            <button
              type="button"
              className="avenza-head-btn"
              title="Informasi Lembar Peta GeoPDF"
              onClick={() => setBukaInfoPetaKustom(true)}
              aria-label="Info Peta"
            >
              <Info size={20} />
            </button>
            <button
              type="button"
              className="avenza-head-btn"
              title="Cari Koordinat / Wilayah"
              onClick={() => setCariKoordTerbuka((v) => !v)}
              aria-label="Cari di Peta"
            >
              <Search size={20} />
            </button>
          </div>
        </header>
      )}



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
        <div className="map-canvas-viewport">
          <div
            className="map-canvas-inner"
            style={{
              width: `${ukuranCanvas}px`,
              height: `${ukuranCanvas}px`,
              position: "absolute",
              left: "50%",
              top: "50%",
              marginLeft: `${-ukuranCanvas / 2}px`,
              marginTop: `${-ukuranCanvas / 2}px`,
              transform: bearingAktif !== 0 ? `rotateZ(${-bearingAktif}deg)` : undefined,
              transformOrigin: "50% 50%",
              transition: modeIkutiKompas ? "transform 0.15s ease-out" : "none"
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

        {modeRekam && <div className="bidikan-peta" aria-hidden="true"><Crosshair size={24} /></div>}

        {/* CHIP KOORDINAT SIMPEL & MENARIK (GANTI SISTEM KOORDINAT DD, DDM, DMS, UTM, TM-3) */}
        <ChipKoordinatPeta
          posisi={posisiNyata}
          teksMenunggu={infoGps.teks}
          sistem={sistemKoord}
          onGantiSistem={(s) => {
            setSistemKoord(s);
            simpanSistemKoordinat(s);
          }}
          onSalin={(teks) => {
            if (navigator.clipboard) {
              void navigator.clipboard
                .writeText(teks)
                .then(() => setPesanSalin("Koordinat disalin: " + teks))
                .catch(() => setPesanSalin("Gagal menyalin koordinat"));
            }
          }}
          rekam={rekamLatar.status !== "idle" ? formatDurasi(durasiRekamMs(rekamLatar)) : null}
        />

        {/* PENCARIAN KOORDINAT / OBJEK MENGAPUNG (TIDAK MEMOTONG TINGGI KANVAS) */}
        {cariKoordTerbuka && (
          <section className="temukan-search-floating" aria-label="Pencarian peta">
            <form
              className="avenza-map-search-bar"
              onSubmit={(e) => {
                e.preventDefault();
                cariKoordinat();
              }}
            >
              <Search size={16} />
              <input
                autoFocus
                aria-label="Koordinat atau nama objek"
                placeholder="−6.1754, 106.8272 atau nama objek"
                value={cariKoordInput}
                onChange={(e) => {
                  setCariKoordInput(e.target.value);
                  setGalatPencarian("");
                }}
              />
              <button type="submit">Cari</button>
              <button type="button" aria-label="Tutup pencarian peta" onClick={() => setCariKoordTerbuka(false)}>
                <X size={16} />
              </button>
            </form>
            {galatPencarian && <p className="temukan-search-error" role="alert">{galatPencarian}</p>}
            {cariKoordInput.trim() &&
              dataSpasial
                .filter((d) => d.judul.toLocaleLowerCase().includes(cariKoordInput.trim().toLocaleLowerCase()))
                .slice(0, 6)
                .map((d) => (
                  <button
                    className="temukan-search-result"
                    type="button"
                    key={d.id}
                    onClick={() => {
                      if (d.koordinat[0]) setCenter(d.koordinat[0]);
                      setObjekTerpilih(d);
                      setCariKoordTerbuka(false);
                    }}
                  >
                    <MapPin size={15} />
                    <span>
                      {d.judul}
                      <small>{d.jenisGeometri === "point" ? "Titik" : d.jenisGeometri === "line" ? "Jalur" : "Poligon"}</small>
                    </span>
                  </button>
                ))}
          </section>
        )}

        {pesanSalin && (
          <span className="field-map-message" role="status">
            {pesanSalin}
          </span>
        )}
        {/* TOP-RIGHT GLASSMORPHIC CONTROL POD (Layers, Orientasi Kompas, Basemap, Cari) */}
        <div className="map-hud-pod top-right map-overlay-top-right">
          <button
            type="button"
            className={`map-hud-btn map-ctrl-btn ${bukaMenuPeta ? "active active-ctrl" : ""}`}
            onClick={() => { setObjekTerpilih(null); setBukaMenuPeta((v) => !v); }}
            title="Peta Dasar & Lapisan"
          >
            <Layers size={20} />
          </button>

          <button
            type="button"
            aria-label={infoKompas.teks}
            className={`map-hud-btn map-ctrl-btn ${bearingAktif !== 0 ? "active" : ""}`}
            onClick={() => {
              if (bearingAktif !== 0) {
                setBearing(0);
                setModeIkutiKompas(false);
              } else {
                void aktifkanKompas();
                setModeIkutiKompas(true);
              }
            }}
            title={bearingAktif !== 0 ? "Ketuk untuk reset peta tegak ke Utara (0°)" : "Aktifkan kompas sensor"}
          >
            <Compass
              size={20}
              style={{
                transform: `rotate(${-bearingAktif}deg)`,
                transition: "transform 0.15s ease-out"
              }}
            />
          </button>

          <button
            type="button"
            className={`map-hud-btn map-ctrl-btn ${cariKoordTerbuka ? "active" : ""}`}
            onClick={() => setCariKoordTerbuka((v) => !v)}
            title="Cari Koordinat / Nama Objek"
          >
            <Search size={18} />
          </button>
        </div>

        {/* INTEGRASI TOOL PENGAMBILAN TITIK, JALUR, DAN POLIGON KE DALAM KONTROL ZOOM (RAIL ALAT PETA) */}
        <RailAlatPeta
          modeRekam={modeRekam}
          gpsTersedia={Boolean(gpsPos)}
          ikutiKompas={modeIkutiKompas}
          onGps={() => {
            const now = Date.now();
            const selisih = now - lastGpsClickRef.current;
            lastGpsClickRef.current = now;

            if (clickTimeoutRef.current) {
              window.clearTimeout(clickTimeoutRef.current);
              clickTimeoutRef.current = null;
            }

            if (selisih < 350) {
              void aktifkanKompas();
              setModeIkutiKompas(true);
              if (gpsPos) setCenter({ lat: gpsPos.lat, lng: gpsPos.lng });
            } else {
              clickTimeoutRef.current = window.setTimeout(() => {
                if (modeIkutiKompas) {
                  setModeIkutiKompas(false);
                  setBearing(0);
                }
                if (gpsPos) setCenter({ lat: gpsPos.lat, lng: gpsPos.lng });
              }, 220);
            }
          }}
          onZoomMasuk={() => setZoom((z) => Math.min(ZOOM_MAKS_PETA, Math.floor(z + 0.01) + 1))}
          onZoomKeluar={() => setZoom((z) => Math.max(ZOOM_MIN_PETA, Math.ceil(z - 0.01) - 1))}
          onPilihAlat={(jenis) => mulaiModeRekam(jenis)}
          onAlatAktif={(jenis) => {
            if (jenis === "point") setBukaModalForm(true);
          }}
        />

        {/* POPOVER LAPISAN & ALAT PETA (HANYA TAMPIL SAAT TOMBOL LAYERS DIKETUK) */}
        {bukaMenuPeta && (
          <PanelLapisanPeta
            basemap={basemap}
            jumlahObjek={dataSpasial.length}
            tampilDaftarObjek={tampilDaftarObjek}
            areaOffline={areaOffline}
            petaKustomAktif={petaKustomAktif}
            onPilihBasemap={setBasemap}
            onUnduhOffline={() => unduh.bukaModalUnduh(hitungKotakTerlihat(), zoom)}
            onPilihBerkas={handleImporFileSpasial}
            onAlihDaftarObjek={() => setTampilDaftarObjek((v) => !v)}
            onTutup={() => setBukaMenuPeta(false)}
            onPilihPetaKustom={onPilihPetaKustom}
            onTutupPetaKustom={onTutupPetaKustom}
            onHapusAreaOffline={onHapusAreaOffline}
            center={center}
          />
        )}

        {/* BARIS BAWAH PETA: atribusi (wajib menurut lisensi) di kiri bawah, tombol rekam/panel rekam di kanan.
            Bila tidak muat dalam satu baris (layar sempit, huruf besar, panel rekam), tombol naik ke atas
            atribusi sehingga tidak pernah saling menutupi. */}
        <div className="map-bawah">
          {/* Atribusi sumber peta: jika lembar peta kustom terisolasi, sembunyikan atribusi tile online */}
          {petaKustomAktif ? (
            <div id="atribusi-peta" className="map-atribusi map-atribusi-custom">
              <span>Lembar Peta: {formatJudulAvenza(petaKustomAktif.namaArea, 26)} • WGS 84</span>
            </div>
          ) : basemap === "google" ? (
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
              snapAktif={snapAktif}
              onToggleSnap={() => setSnapAktif((v) => !v)}
              onTambahTitik={tambahTitikBidikan}
              onSimpan={() => setBukaModalForm(true)}
              onBatal={() => {
                perekamLatar.batal();
                setModeRekam(null);
                setTitikDraft([]);
              }}
            />
          )}
        </div>

        {/* BATANG SKALA DINAMIS (AVENZA MAPS STYLE) */}
        <div className="avenza-scale-bar-wrap">
          <div className="avenza-scale-bar-text">{skalaInfo.label}</div>
          <div className="avenza-scale-bar-ruler" style={{ width: `${skalaInfo.lebarPx}px` }}>
            <div className="avenza-scale-tick-left" />
            <div className="avenza-scale-line" />
            <div className="avenza-scale-tick-right" />
          </div>
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

      {modeRekam === "point" && !bukaModalForm && (
        <div className="field-resume-draft">
          <button type="button" className="btn-primary" onClick={() => setBukaModalForm(true)}>
            Lanjutkan draf titik
          </button>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => {
              setModeRekam(null);
              setTitikDraft([]);
              form.kosongkan();
            }}
          >
            Buang draf
          </button>
        </div>
      )}
      {/* MODAL FORM PENYIMPANAN ATRIBUT SURVEI LAPANGAN */}
      {bukaModalForm && (
        <FormSurveiModal
          form={form}
          modeRekam={modeRekam}
          profil={profil}
          koordinat={titikDraft}
          galatGeometri={modeRekam ? validasiGeometri(modeRekam, titikDraft).join(" ") : undefined}
          onHasilAveraging={(hasil) => {
            setTitikDraft([hasil.titik]);
            setCenter(hasil.titik);
          }}
          panjangDraftKm={panjangDraftKm}
          luasDraftHa={luasDraftHa}
          onSimpan={handleSimpanForm}
          onTutup={() => {
            setBukaModalForm(false);
          }}
          sistemKoordinat={sistemKoord}
          onGantiSistemKoordinat={setSistemKoord}
          onUbahKoordinat={(titikBaru: KoordinatTitik) => {
            setTitikDraft([titikBaru]);
            setCenter(titikBaru);
          }}
        />
      )}

      {/* MODAL PENGUNDUH PETA SATELIT OFFLINE */}
      {unduh.bukaModalOffline && <UnduhOfflineModal basemap={basemap} areaOffline={areaOffline} unduh={unduh} onBukaArea={setCenter} />}

      {/* MODAL INFORMASI PETA GEOPDF KUSTOM */}
      {bukaInfoPetaKustom && petaKustomAktif && (
        <div className="modal-backdrop" onClick={() => setBukaInfoPetaKustom(false)}>
          <div className="modal-content avenza-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Informasi Peta Georeferensi</h3>
              <button type="button" className="modal-close-btn" onClick={() => setBukaInfoPetaKustom(false)} aria-label="Tutup">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="avenza-info-row">
                <span className="info-label">Nama Berkas Peta</span>
                <span className="info-val" style={{ fontWeight: 600 }}>
                  {petaKustomAktif.namaArea}
                </span>
              </div>
              <div className="avenza-info-row">
                <span className="info-label">Format Dokumen</span>
                <span className="info-val">{petaKustomAktif.jenisFile || "GeoPDF / GeoTIFF"}</span>
              </div>
              <div className="avenza-info-row">
                <span className="info-label">Ukuran Berkas</span>
                <span className="info-val">{petaKustomAktif.ukuranMb.toFixed(1).replace(".", ",")} MB</span>
              </div>
              <div className="avenza-info-row">
                <span className="info-label">Status Georeferensi</span>
                <span className="info-val text-emerald" style={{ fontWeight: 700 }}>
                  {petaKustomAktif.statusTeks || "Pada peta (Tersinkronisasi GPS)"}
                </span>
              </div>
              <div className="avenza-info-row">
                <span className="info-label">Sistem Koordinat (CRS)</span>
                <span className="info-val">WGS 1984 / UTM Zona 50N</span>
              </div>
              <div className="avenza-info-row">
                <span className="info-label">Batas Geografis</span>
                <span className="info-val">
                  Lat: {petaKustomAktif.minLat.toFixed(4)}° s/d {petaKustomAktif.maxLat.toFixed(4)}°<br />
                  Lng: {petaKustomAktif.minLng.toFixed(4)}° s/d {petaKustomAktif.maxLng.toFixed(4)}°
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-primary" onClick={() => setBukaInfoPetaKustom(false)}>
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
