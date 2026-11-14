import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AreaPetaOffline, BasemapType, DataSpasialItem, JenisGeometri, KoordinatTitik, ProfilKader } from "../types";
import { singkatkanLabelPeta } from "../lib/labelPeta";
import {
  eksporKeGeoJSON,
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
  URUTAN_BASEMAP,
  basemapBawaan,
  basemapTersedia,
  isiTemplateTile,
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
import { namaBasemap, pratinjauBasemap } from "./peta/PanelLapisanPeta";
import { PanelPerekaman } from "./peta/PanelPerekaman";
import { FormSurveiModal, useFormSurvei } from "./peta/FormSurveiModal";
import { UnduhOfflineModal, useUnduhAreaOffline } from "./peta/UnduhOfflineModal";
import { useTombolEsc } from "../lib/useTombolEsc";
import {
  bacaSistemKoordinat,
  DAFTAR_SISTEM_KOORDINAT,
  formatKoordinat,
  keTm3,
  keUtm,
  ribuan,
  simpanSistemKoordinat,
  SistemKoordinat
} from "../lib/sistemKoordinat";
import { LOGO_GOOGLE, ambilAtribusiGoogle, pantauSesiGoogle } from "../lib/googleTiles";
import { aktifkanKompas, selisihArah, titikDariBidikan, usePosisiPerangkat } from "../lib/posisiPerangkat";
import {
  ArrowLeft,
  Check,
  Compass,
  Copy,
  Crosshair,
  Hexagon,
  Info,
  Layers,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  MoreVertical,
  Navigation,
  Navigation2,
  Plus,
  Route,
  Satellite,
  Search,
  Share,
  Sliders,
  Trash2,
  X
} from "lucide-react";

/** Menghasilkan format derajat kompas dan arah kardinal adaptif ala Avenza Maps (mis. '359° U', '280° B') */
export function formatArahKardinal(deg: number): string {
  const b = ((Math.round(deg) % 360) + 360) % 360;
  if (b >= 337.5 || b < 22.5) return `${b}° U`;
  if (b >= 22.5 && b < 67.5) return `${b}° TL`;
  if (b >= 67.5 && b < 112.5) return `${b}° T`;
  if (b >= 112.5 && b < 157.5) return `${b}° TG`;
  if (b >= 157.5 && b < 202.5) return `${b}° S`;
  if (b >= 202.5 && b < 247.5) return `${b}° BD`;
  if (b >= 247.5 && b < 292.5) return `${b}° B`;
  return `${b}° BL`;
}

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
  /** Tombol kembali di bilah judul peta (bila bukan lembar peta kustom) */
  onKembali?: () => void;
  onHapusAreaOffline?: (id: string) => void;
}

/** Format nama peta agar ringkas, adaptif, dan tidak meluap keluar layar */
export function formatJudulAvenza(nama: string, maxLen = 24): string {
  return singkatkanLabelPeta(nama, maxLen);
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

/** Uraikan masukan teks menjadi koordinat lat & lng yang valid (DD, kardinal LU/LS/BT/BB/N/S/E/W) */
export function uraikanTeksKoordinat(teks: string): { lat: number; lng: number } | null {
  const t = teks.trim();
  if (!t) return null;

  // Format DD angka biasa: contoh "-6.1754, 106.8272" atau "2.857270 117.377476"
  const mDD = t.match(/^([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)$/);
  if (mDD) {
    const a = parseFloat(mDD[1]);
    const b = parseFloat(mDD[2]);
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
      return { lat: a, lng: b };
    }
    if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
      return { lat: b, lng: a };
    }
  }

  // Format kardinal: contoh "2.857270° LU, 117.377476° BT" atau "2.857270N 117.377476E"
  const polaKardinal = /([+-]?\d+(?:\.\d+)?)\s*°?\s*(LU|LS|BT|BB|N|S|E|W)/gi;
  const temuan = [...t.matchAll(polaKardinal)];
  if (temuan.length === 2) {
    let lat: number | null = null;
    let lng: number | null = null;
    for (const item of temuan) {
      const val = parseFloat(item[1]);
      const arah = item[2].toUpperCase();
      if (arah === "LU" || arah === "N") lat = Math.abs(val);
      else if (arah === "LS" || arah === "S") lat = -Math.abs(val);
      else if (arah === "BT" || arah === "E") lng = Math.abs(val);
      else if (arah === "BB" || arah === "W") lng = -Math.abs(val);
    }
    if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

/** Titik di dalam poligon (ray casting pada lintang/bujur) untuk Monitor Geofences */
function titikDalamPoligon(t: { lat: number; lng: number }, poly: { lat: number; lng: number }[]): boolean {
  let dalam = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.lat > t.lat !== b.lat > t.lat && t.lng < ((b.lng - a.lng) * (t.lat - a.lat)) / (b.lat - a.lat) + a.lng) dalam = !dalam;
  }
  return dalam;
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
  onHapusAreaOffline,
  onKembali
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileCacheRef = useRef<Map<string, HTMLImageElement | "loading" | "error">>(new Map());
  const detailGeoPdfRef = useRef<{
    id: string;
    canvas: HTMLCanvasElement;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null>(null);
  const [cariKoordInput, setCariKoordInput] = useState<string>("");
  const [cariKoordTerbuka, setCariKoordTerbuka] = useState<boolean>(false);
  const [galatPencarian, setGalatPencarian] = useState("");
  const [koordinatDipilih, setKoordinatDipilih] = useState<{ lat: number; lng: number; label?: string } | null>(null);

  const cariKoordinat = (teksKhusus?: string) => {
    setGalatPencarian("");
    const masukan = (teksKhusus ?? cariKoordInput).trim();
    if (!masukan) return;

    // 1. Coba uraikan sebagai format titik koordinat
    const titik = uraikanTeksKoordinat(masukan);
    if (titik) {
      setCenter(titik);
      setZoom((z) => Math.max(z, 16));
      setKoordinatDipilih({ lat: titik.lat, lng: titik.lng, label: "Koordinat Dicari" });
      setCariKoordTerbuka(false);
      setPesanSalin(`Menuju ke koordinat: ${titik.lat.toFixed(6)}, ${titik.lng.toFixed(6)}`);
      return;
    }

    // 2. Coba cocokkan dengan nama objek yang tersimpan
    const cocok = dataSpasial.find((d) => d.judul.toLowerCase().includes(masukan.toLowerCase()));
    if (cocok && cocok.koordinat[0]) {
      const t = cocok.koordinat[0];
      setCenter(t);
      setZoom((z) => Math.max(z, 16));
      setObjekTerpilih(cocok);
      setKoordinatDipilih({ lat: t.lat, lng: t.lng, label: cocok.judul });
      setCariKoordTerbuka(false);
      setPesanSalin(`Menuju ke objek: ${cocok.judul}`);
      return;
    }

    setGalatPencarian("Koordinat tidak valid. Contoh: 2.857270, 117.377476 atau nama objek.");
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
  const [modeIkutiGps, setModeIkutiGps] = useState<"mati" | "posisi" | "kompas">("mati");
  const modeIkutiKompas = modeIkutiGps === "kompas";
  const setModeIkutiKompas = (v: boolean | ((old: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(modeIkutiGps === "kompas") : v;
    setModeIkutiGps(next ? "kompas" : "mati");
  };

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
  const [sistemKoord, setSistemKoord] = useState<SistemKoordinat>(() => bacaSistemKoordinat());
  const [renderTick, setRenderTick] = useState<number>(0);

  // Mode peta bersih: ketuk area kosong peta untuk menyembunyikan kontrol
  const [modePetaBersih, setModePetaBersih] = useState<boolean>(false);
  // Panel-panel gaya Avenza Maps
  const [bukaPilihBasemap, setBukaPilihBasemap] = useState<boolean>(false);
  const [bukaHalamanLapisan, setBukaHalamanLapisan] = useState<boolean>(false);
  const [lapisanTerbuka, setLapisanTerbuka] = useState<boolean>(false);
  const [cariLapisanTerbuka, setCariLapisanTerbuka] = useState<boolean>(false);
  const [cariLapisanInput, setCariLapisanInput] = useState<string>("");
  const [menuLapisan, setMenuLapisan] = useState<"kepala" | "lapisan" | null>(null);
  const [navSubView, setNavSubView] = useState<"menu" | "fitur" | "koordinat">("menu");
  const [navKoordInput, setNavKoordInput] = useState<string>("");
  const inputImporRef = useRef<HTMLInputElement | null>(null);
  const [formatPillId, setFormatPillId] = useState<string>(() => {
    const s = bacaSistemKoordinat();
    return s === "DMS" ? "wgs84_dms" : s === "DDM" ? "wgs84_ddm" : s === "UTM" ? "wgs84_utm" : s === "TM3" ? "srgi_tm3" : "wgs84_desimal";
  });

  /** Unduh semua objek lapangan sebagai GeoJSON (Ekspor lapisan) */
  const unduhGeoJson = () => {
    const blob = new Blob([eksporKeGeoJSON(dataSpasial)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lapisan_data_lapangan_${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPesanSalin(`Lapisan diekspor (${dataSpasial.length} objek).`);
  };

  // State UI Avenza Maps (sesuai referensi video antarmuka pengguna)
  const [bukaDrawerGps, setBukaDrawerGps] = useState<boolean>(false);
  const [tabDrawerGps, setTabDrawerGps] = useState<"lokasi" | "pelacakan" | "navigasi">("lokasi");
  const [bukaMenuAlat, setBukaMenuAlat] = useState<boolean>(false);
  const [bukaSalinKoord, setBukaSalinKoord] = useState<boolean>(false);
  const [bukaInfoPetaModal, setBukaInfoPetaModal] = useState<boolean>(false);

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
  // Pesan singkat di peta hilang sendiri setelah beberapa detik (seperti toast Avenza)
  useEffect(() => {
    if (!pesanSalin) return;
    const t = window.setTimeout(() => setPesanSalin(""), 4000);
    return () => window.clearTimeout(t);
  }, [pesanSalin]);
  const [modeRekam, setModeRekam] = useState<JenisGeometri | null>(() =>
    rekamLatar.status !== "idle" && rekamLatar.jenis ? rekamLatar.jenis : (form.rekaman?.jenis ?? null)
  );
  const [titikDraft, setTitikDraft] = useState<KoordinatTitik[]>(() =>
    rekamLatar.status !== "idle" ? rekamLatar.titik : (form.rekaman?.titik ?? [])
  );
  const [bukaModalForm, setBukaModalForm] = useState<boolean>(false);
  useEffect(() => {
    if ((modeIkutiGps === "posisi" || modeIkutiGps === "kompas") && gpsPos) {
      setCenter({ lat: gpsPos.lat, lng: gpsPos.lng });
    }
  }, [modeIkutiGps, gpsPos?.lat, gpsPos?.lng]);

  useEffect(() => {
    if (!gpsPos) return;
    const interval = setInterval(() => {
      setRenderTick((t) => t + 1);
    }, 80);
    return () => clearInterval(interval);
  }, [Boolean(gpsPos)]);

  useEffect(() => {
    if (modeRekam) {
      setModePetaBersih(false);
    }
  }, [modeRekam]);

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
        const tinggi = Math.max(280, Math.floor(window.innerHeight - atas - tinggiNav));
        setTinggiPeta((lama) => (lama !== null && Math.abs(lama - tinggi) < 2 ? lama : tinggi));
      });
    };
    hitung();
    window.addEventListener("resize", hitung);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => hitung()) : null;
    const induk = el.parentElement;
    if (induk) ro?.observe(induk);
    const nav = document.querySelector<HTMLElement>(".avenza-bottom-nav");
    if (nav) ro?.observe(nav);
    // Banner di atas peta (mis. "Sedang merekam di latar belakang") menggeser peta ke bawah tanpa
    // mengubah ukuran induknya; pantau juga tinggi halaman agar bilah alat tidak tertutup bilah navigasi.
    ro?.observe(document.body);
    return () => {
      cancelAnimationFrame(bingkai);
      window.removeEventListener("resize", hitung);
      ro?.disconnect();
    };
  }, [petaKustomAktif, targetGoTo, rekamLatar.status]);

  // Jika lembar peta kustom dibuka/dipilih, bersihkan garis panduan targetGoTo
  useEffect(() => {
    if (petaKustomAktif) {
      setTargetGoTo(null);
    }
  }, [petaKustomAktif?.id]);

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
      setKoordinatDipilih(null);
      setModeIkutiGps("mati");
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
    const targetW = Math.round(W * dpr);
    const targetH = Math.round(H * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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

    // 2.1 Muat Tile Archive PMTiles / MBTiles jika peta kustom offline aktif berformat tile
    const adalahTileArchive = Boolean(
      petaKustomAktif &&
      ((petaKustomAktif.petaKustomUrl &&
        (petaKustomAktif.petaKustomUrl.startsWith("pmtiles://") || petaKustomAktif.petaKustomUrl.startsWith("mbtiles://"))) ||
        (petaKustomAktif.templateTile &&
          (petaKustomAktif.templateTile.startsWith("pmtiles://") || petaKustomAktif.templateTile.startsWith("mbtiles://"))))
    );

    if (adalahTileArchive && petaKustomAktif) {
      const templateArchive = petaKustomAktif.templateTile || petaKustomAktif.petaKustomUrl || "";
      const zTile = Math.round(zoom);
      const ukuranTile = TILE_SIZE * Math.pow(2, zoom - zTile);
      const centerTx = lngToTileX(center.lng, zTile);
      const centerTy = latToTileY(center.lat, zTile);
      const startTileX = Math.floor(centerTx - W / (2 * ukuranTile)) - 1;
      const endTileX = Math.floor(centerTx + W / (2 * ukuranTile)) + 1;
      const startTileY = Math.floor(centerTy - H / (2 * ukuranTile)) - 1;
      const endTileY = Math.floor(centerTy + H / (2 * ukuranTile)) + 1;
      for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
          const url = isiTemplateTile(templateArchive, zTile, tx, ty);
          if (!url) continue;
          const drawX = Math.round(W / 2 + (tx - centerTx) * ukuranTile);
          const drawY = Math.round(H / 2 + (ty - centerTy) * ukuranTile);
          const sisi = Math.ceil(ukuranTile);
          const cached = tileCacheRef.current.get(url);
          if (cached && cached !== "loading" && cached !== "error") {
            ctx.drawImage(cached, drawX, drawY, sisi, sisi);
          } else if (!cached) {
            tileCacheRef.current.set(url, "loading");
            muatGambarTile(url).then(
              (img) => {
                tileCacheRef.current.set(url, img);
                setRenderTick((t) => t + 1);
              },
              () => {
                tileCacheRef.current.set(url, "error");
              }
            );
          }
        }
      }
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

    if (petaKustomAktif && detailGeoPdfRef.current && detailGeoPdfRef.current.id === petaKustomAktif.id && zoom >= 15) {
      const det = detailGeoPdfRef.current;
      const pNW = latLngToPixel(det.maxLat, det.minLng, W, H);
      const pSE = latLngToPixel(det.minLat, det.maxLng, W, H);
      const dW = pSE.x - pNW.x;
      const dH = pSE.y - pNW.y;
      if (dW > 4 && dH > 4) {
        ctx.drawImage(det.canvas, pNW.x, pNW.y, dW, dH);
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

  // Render progresif detail tajam (High-DPI) untuk lembar GeoPDF saat pengguna berhenti menggeser/memperbesar (debounce 180ms)
  useEffect(() => {
    if (!petaKustomAktif || zoom < 15) {
      detailGeoPdfRef.current = null;
      return;
    }
    const isGeoPdf =
      petaKustomAktif.formatGeoref === "iso32000" ||
      petaKustomAktif.formatGeoref === "ogc-lgi" ||
      petaKustomAktif.thumbnailType === "geopdf_sheet";
    if (!isGeoPdf) return;

    let dibatalkan = false;
    let renderTaskAktif: { cancel: () => void } | null = null;

    const timer = window.setTimeout(async () => {
      try {
        const { ambilArsipPeta } = await import("../lib/penyimpananPetaLuring");
        const arsip = await ambilArsipPeta(petaKustomAktif.id);
        if (dibatalkan || !arsip || !arsip.berkas) return;

        const { bacaReferensiGeoPdf, muatPdfJs } = await import("../lib/geoPdf");
        const buffer = await arsip.berkas.arrayBuffer();
        if (dibatalkan) return;
        const ref = await bacaReferensiGeoPdf(buffer);
        if (dibatalkan) return;

        const pdfjs = await muatPdfJs();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
        try {
          if (dibatalkan) return;
          const hal = Math.min(pdf.numPages, Math.max(1, (ref.indeksHalaman ?? 0) + 1));
          const page = await pdf.getPage(hal);
          const vp1 = page.getViewport({ scale: 1 });
          const [x1, y1, x2, y2] = ref.bbox;
          const bboxW = Math.max(1, x2 - x1);
          const bboxH = Math.max(1, y2 - y1);
          const targetDim = Math.min(3072, Math.round(1024 * Math.pow(1.35, Math.min(4, zoom - 14))));
          const scale = Math.min(targetDim / Math.max(bboxW, bboxH), 5);
          const viewport = page.getViewport({ scale });

          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = Math.max(1, Math.round(viewport.width));
          pageCanvas.height = Math.max(1, Math.round(viewport.height));
          const pageCtx = pageCanvas.getContext("2d");
          if (!pageCtx || dibatalkan) return;
          pageCtx.fillStyle = "#ffffff";
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

          const task = page.render({ canvasContext: pageCtx, canvas: pageCanvas, viewport });
          renderTaskAktif = task;
          await task.promise;
          if (dibatalkan) return;

          const sx = Math.max(0, Math.round(x1 * scale));
          const sy = Math.max(0, Math.round((vp1.height - y2) * scale));
          const sw = Math.min(pageCanvas.width - sx, Math.max(1, Math.round(bboxW * scale)));
          const sh = Math.min(pageCanvas.height - sy, Math.max(1, Math.round(bboxH * scale)));

          const cropCanvas = document.createElement("canvas");
          cropCanvas.width = sw;
          cropCanvas.height = sh;
          const cropCtx = cropCanvas.getContext("2d");
          if (!cropCtx) return;
          cropCtx.drawImage(pageCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

          detailGeoPdfRef.current = {
            id: petaKustomAktif.id,
            canvas: cropCanvas,
            minLat: ref.minLat,
            maxLat: ref.maxLat,
            minLng: ref.minLng,
            maxLng: ref.maxLng
          };
          setRenderTick((t) => t + 1);
        } finally {
          await (pdf as { destroy?: () => Promise<void> }).destroy?.();
        }
      } catch {
        // Abaikan jika render progresif dibatalkan atau gagal
      }
    }, 180);

    return () => {
      dibatalkan = true;
      window.clearTimeout(timer);
      if (renderTaskAktif) {
        try {
          renderTaskAktif.cancel();
        } catch {
          //
        }
      }
    };
  }, [petaKustomAktif?.id, zoom]);

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
    const dx0 = midX - rect.left - rect.width / 2;
    const dy0 = midY - rect.top - rect.height / 2;
    const rad0 = (bearingRef.current * Math.PI) / 180;
    const titikLayar = {
      x: rect.width / 2 + dx0 * Math.cos(rad0) - dy0 * Math.sin(rad0),
      y: rect.height / 2 + dx0 * Math.sin(rad0) + dy0 * Math.cos(rad0)
    };

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
    setBukaMenuAlat(false);
    setBukaSalinKoord(false);
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
      startLat: centerRef.current.lat,
      startLng: centerRef.current.lng,
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

      // Rotasi peta dua jari: orientasi peta berputar searah putaran kedua jari pengguna
      let bearingKini = bearingAwal;
      if (absDeltaSudut >= 2) {
        bearingKini = Math.round(bearingAwal - deltaSudut) % 360;
        if (bearingKini < 0) bearingKini += 360;
        setBearing(bearingKini);
        setModeIkutiKompas(false);
        setModeIkutiGps("mati");
        setKoordinatDipilih(null);
      }

      // Perbesar/perkecil (pinch zoom) dan geser posisi jangkar dua jari secara mulus sesuai rotasi
      if (jarakKini > 20) {
        const rect = wadahPetaRef.current?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
        const dxKini = (p1.clientX + p2.clientX) / 2 - rect.left - rect.width / 2;
        const dyKini = (p1.clientY + p2.clientY) / 2 - rect.top - rect.height / 2;
        const radKini = (bearingKini * Math.PI) / 180;
        const midKini = {
          x: rect.width / 2 + dxKini * Math.cos(radKini) - dyKini * Math.sin(radKini),
          y: rect.height / 2 + dxKini * Math.sin(radKini) + dyKini * Math.cos(radKini)
        };
        const zBaru = zoomCubit(zoomAwal, jarakAwal, jarakKini);
        setZoom(zBaru);
        setCenter(pusatUntukJangkar(jangkar, zBaru, midKini, rect.width, rect.height));
        setModeIkutiKompas(false);
        setModeIkutiGps("mati");
        setKoordinatDipilih(null);
      }
      return;
    }

    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
      setModeIkutiKompas(false); // geser manual menonaktifkan mode kompas otomatis
      setModeIkutiGps("mati");
      setKoordinatDipilih(null);
    }

    // Rotasi translasi layar ke koordinat peta lokal (2D)
    const rad = (bearingRef.current * Math.PI) / 180;
    const localDx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localDy = dx * Math.sin(rad) + dy * Math.cos(rad);

    const zAktif = zoomRef.current;
    const startTx = lngToTileX(dragRef.current.startLng, zAktif);
    const startTy = latToTileY(dragRef.current.startLat, zAktif);
    const newLng = tileXToLng(startTx - localDx / TILE_SIZE, zAktif);
    const newLat = tileYToLat(startTy - localDy / TILE_SIZE, zAktif);
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
        startLat: centerRef.current.lat,
        startLng: centerRef.current.lng,
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
      if (modePetaBersih) {
        setModePetaBersih(false);
        return;
      }

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

        const jarakKeSegmen = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number => {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
          let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
          t = Math.max(0, Math.min(1, t));
          return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
        };

        const diDalamPoligon = (pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean => {
          let inside = false;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x,
              yi = poly[i].y;
            const xj = poly[j].x,
              yj = poly[j].y;
            const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
          }
          return inside;
        };

        let objekKena = false;
        for (const item of dataSpasial) {
          const pikselCoords = item.koordinat.map((k) => latLngToPixel(k.lat, k.lng, cW, cH));
          // 1. Cek semua vertex (<= 28px)
          for (const p of pikselCoords) {
            if (Math.hypot(ptLayar.x - p.x, ptLayar.y - p.y) <= 28) {
              setObjekTerpilih(item);
              objekKena = true;
              return;
            }
          }
          // 2. Cek Poligon (centroid, point-in-polygon, ruas tepi <= 18px)
          if (item.jenisGeometri === "polygon" && pikselCoords.length >= 3) {
            const cX = pikselCoords.reduce((a, b) => a + b.x, 0) / pikselCoords.length;
            const cY = pikselCoords.reduce((a, b) => a + b.y, 0) / pikselCoords.length;
            if (Math.hypot(ptLayar.x - cX, ptLayar.y - cY) <= 36 || diDalamPoligon(ptLayar, pikselCoords)) {
              setObjekTerpilih(item);
              objekKena = true;
              return;
            }
            for (let i = 0; i < pikselCoords.length; i++) {
              const next = (i + 1) % pikselCoords.length;
              if (jarakKeSegmen(ptLayar, pikselCoords[i], pikselCoords[next]) <= 18) {
                setObjekTerpilih(item);
                objekKena = true;
                return;
              }
            }
          }
          // 3. Cek Garis (titik tengah <= 36px, ruas segmen <= 18px)
          if (item.jenisGeometri === "line" && pikselCoords.length >= 2) {
            const midIdx = Math.floor(pikselCoords.length / 2);
            const midP = pikselCoords[midIdx];
            if (midP && Math.hypot(ptLayar.x - midP.x, ptLayar.y - midP.y) <= 36) {
              setObjekTerpilih(item);
              objekKena = true;
              return;
            }
            for (let i = 0; i < pikselCoords.length - 1; i++) {
              if (jarakKeSegmen(ptLayar, pikselCoords[i], pikselCoords[i + 1]) <= 18) {
                setObjekTerpilih(item);
                objekKena = true;
                return;
              }
            }
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
    setBukaMenuAlat(false);
    setObjekTerpilih(null);
    setModeRekam(jenis);
    const ptAwal = titikDariBidikan(center, posisiNyata);
    if (jenis === "point") {
      setTitikDraft([ptAwal]);
      form.setKategoriInput("Biodiversitas");
      setBukaModalForm(false);
    } else {
      setTitikDraft([ptAwal]);
      form.setKategoriInput(jenis === "polygon" ? "Wilayah Adat / Lahan" : "Biodiversitas");
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
      if (onImporBerkas(file.name, String(reader.result || ""))) setBukaHalamanLapisan(false);
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

  // Tombol lokasi bertahap: 1x pusatkan dan ikuti posisi, 2x peta ikut arah kompas
  const onGps = () => {
    if (petaKustomAktif && gpsPos) {
      const diDalam =
        gpsPos.lat >= petaKustomAktif.minLat &&
        gpsPos.lat <= petaKustomAktif.maxLat &&
        gpsPos.lng >= petaKustomAktif.minLng &&
        gpsPos.lng <= petaKustomAktif.maxLng;
      if (!diDalam) {
        const tengah = {
          lat: (petaKustomAktif.minLat + petaKustomAktif.maxLat) / 2,
          lng: (petaKustomAktif.minLng + petaKustomAktif.maxLng) / 2
        };
        const jarakKm = (hitungJarakMeter(gpsPos, tengah) / 1000).toFixed(1).replace(".", ",");
        setPesanSalin(`Posisi Anda di luar area peta ini (±${jarakKm} km dari tengah peta).`);
      }
    }
    if (koordinatDipilih) setKoordinatDipilih(null);

    // Alur Tombol GPS Bertahap (Sequential Toggle):
    // Klik 1: Jika belum di posisi sekarang -> ke posisi sekarang & hadap Utara tegak (bearing: 0)
    // (setModeIkutiKompas(false) tidak dipanggil di sini: ia menimpa "posisi" menjadi "mati")
    if (modeIkutiGps !== "posisi") {
      setModeIkutiGps("posisi");
      setBearing(0);
      if (gpsPos) setCenter({ lat: gpsPos.lat, lng: gpsPos.lng });
    } else {
      // Klik 2: Jika sudah di posisi sekarang -> arah peta mengikuti kompas sensor HP
      setModeIkutiGps("kompas");
      setModeIkutiKompas(true);
      void aktifkanKompas();
      if (gpsPos) setCenter({ lat: gpsPos.lat, lng: gpsPos.lng });
    }
  };

  const cLat = center.lat;
  const cLng = center.lng;
  const utmHasil = keUtm(cLat, cLng);
  const tm3Hasil = keTm3(cLat, cLng);
  const fDms = formatKoordinat(cLat, cLng, "DMS");
  const fDdm = formatKoordinat(cLat, cLng, "DDM");

  const daftarFormatSalin = [
    {
      id: "wgs84_desimal",
      nama: "Lintang, Bujur - WGS 84",
      nilai: `${cLat.toFixed(6)}, ${cLng.toFixed(6)}`,
      salin: `${cLat.toFixed(7)}, ${cLng.toFixed(7)}`,
      sistem: "DD" as SistemKoordinat
    },
    {
      id: "wgs84_ne",
      nama: "Lintang, Bujur (N / E) - WGS 84",
      nilai: `${Math.abs(cLat).toFixed(6)} ${cLat >= 0 ? "N" : "S"}, ${Math.abs(cLng).toFixed(6)} ${cLng >= 0 ? "E" : "W"}`,
      salin: `${Math.abs(cLat).toFixed(6)} ${cLat >= 0 ? "N" : "S"}, ${Math.abs(cLng).toFixed(6)} ${cLng >= 0 ? "E" : "W"}`,
      sistem: "DD" as SistemKoordinat
    },
    {
      id: "wgs84_dms",
      nama: "Derajat, Menit, Detik (DMS) - WGS 84",
      nilai: fDms.ringkas,
      salin: fDms.salin,
      sistem: "DMS" as SistemKoordinat
    },
    {
      id: "wgs84_ddm",
      nama: "Derajat, Menit Desimal (DDM) - WGS 84",
      nilai: fDdm.ringkas,
      salin: fDdm.salin,
      sistem: "DDM" as SistemKoordinat
    },
    {
      id: "wgs84_utm",
      nama: "UTM - WGS 84",
      nilai: utmHasil ? `${utmHasil.zona}  ${ribuan(utmHasil.x)} E  ${ribuan(utmHasil.y)} N` : "Di luar zona UTM",
      salin: utmHasil ? `UTM ${utmHasil.zona} ${utmHasil.x.toFixed(0)} ${utmHasil.y.toFixed(0)}` : "",
      sistem: "UTM" as SistemKoordinat
    },
    {
      id: "srgi_tm3",
      nama: "TM-3 Indonesia - SRGI2013",
      nilai: tm3Hasil ? `${tm3Hasil.zona}  X ${tm3Hasil.x.toFixed(1)}  Y ${tm3Hasil.y.toFixed(1)}` : "Di luar zona TM-3",
      salin: tm3Hasil ? `TM-3 ${tm3Hasil.zona} ${tm3Hasil.x.toFixed(2)} ${tm3Hasil.y.toFixed(2)}` : "",
      sistem: "TM3" as SistemKoordinat
    }
  ];

  // ---------- Nilai tampilan gaya Avenza Maps ----------
  const putaran = Math.round(((bearingAktif % 360) + 360) % 360);
  const judulPeta =
    putaran !== 0 ? formatArahKardinal(putaran) : petaKustomAktif ? formatJudulAvenza(petaKustomAktif.namaArea) : namaBasemap(basemap);
  const formatPill = daftarFormatSalin.find((f) => f.id === formatPillId) ?? daftarFormatSalin[0];
  const arahHadap = kompasDerajat ?? null;
  const posisiGpsTeks = posisiNyata ? formatKoordinat(posisiNyata.lat, posisiNyata.lng, sistemKoord).ringkas : "---";
  const kecepatanKmj = gpsPos?.kecepatan !== undefined ? (gpsPos.kecepatan * 3.6).toFixed(2).replace(".", ",") : "0,00";
  const durasiRekamTeks = rekamLatar.status !== "idle" ? formatDurasi(durasiRekamMs(rekamLatar)) : "---";
  const jamRekam = rekamLatar.status !== "idle" ? durasiRekamMs(rekamLatar) / 3_600_000 : 0;
  const kecepatanRataTeks = jamRekam > 0 && panjangDraftKm > 0 ? (panjangDraftKm / jamRekam).toFixed(2).replace(".", ",") : "---";
  /** Pilihan peta dasar di lembar pemilih (Kontur Taktis tidak ditawarkan lagi) */
  const pilihanBasemap = URUTAN_BASEMAP.filter((id) => id !== "taktis" && basemapTersedia(id));
  const batalkanRekaman = () => {
    perekamLatar.batal();
    setModeRekam(null);
    setTitikDraft([]);
  };
  const tutupSemuaPanel = () => {
    setBukaMenuAlat(false);
    setBukaSalinKoord(false);
    setBukaPilihBasemap(false);
  };
  // Esc menutup lapisan paling atas milik peta: menu titik tiga → halaman → lembar → menu kecil
  const adaLapisanTerbuka =
    menuLapisan !== null ||
    bukaHalamanLapisan ||
    bukaInfoPetaModal ||
    cariKoordTerbuka ||
    bukaDrawerGps ||
    bukaPilihBasemap ||
    bukaSalinKoord ||
    bukaMenuAlat;
  useTombolEsc(adaLapisanTerbuka, () => {
    if (menuLapisan !== null) setMenuLapisan(null);
    else if (bukaHalamanLapisan) setBukaHalamanLapisan(false);
    else if (bukaInfoPetaModal) setBukaInfoPetaModal(false);
    else if (cariKoordTerbuka) setCariKoordTerbuka(false);
    else if (bukaDrawerGps) setBukaDrawerGps(false);
    else tutupSemuaPanel();
  });
  const jatuhkanPin = () => {
    tutupSemuaPanel();
    setObjekTerpilih(null);
    const pt: KoordinatTitik = { ...titikDariBidikan(center, posisiNyata), timestamp: new Date().toISOString() };
    setModeRekam("point");
    setTitikDraft([pt]);
    form.setKategoriInput("Biodiversitas");
    setBukaModalForm(true);
  };
  const tujuKoordinat = (teks: string): boolean => {
    const t = uraikanTeksKoordinat(teks);
    if (!t) return false;
    setTargetGoTo({ lat: t.lat, lng: t.lng, judul: `${t.lat.toFixed(6)}, ${t.lng.toFixed(6)}` });
    return true;
  };
  const daftarCari = cariKoordInput.trim()
    ? dataSpasial.filter((d) => d.judul.toLowerCase().includes(cariKoordInput.trim().toLowerCase())).slice(0, 30)
    : dataSpasial.slice(0, 30);
  const objekLapisan = cariLapisanInput.trim()
    ? dataSpasial.filter((d) => d.judul.toLowerCase().includes(cariLapisanInput.trim().toLowerCase()))
    : dataSpasial;
  const kompasRose = (ukuran: number) => {
    const arah = arahHadap ?? putaran;
    return (
      <svg viewBox="0 0 200 200" width={ukuran} height={ukuran} className="avz-compass-rose-svg" aria-hidden="true">
        <g transform={`rotate(${-arah} 100 100)`} style={{ transition: "transform 0.2s ease-out" }}>
          <circle cx="100" cy="100" r="84" fill="none" stroke="#a6a6a6" strokeWidth="26" />
          {Array.from({ length: 12 }).map((_, i) => (
            <text
              key={i}
              x="100"
              y="25"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="11"
              fontWeight="700"
              transform={`rotate(${i * 30} 100 100)`}
            >
              {i === 0 ? "" : i * 30}
            </text>
          ))}
          <polygon points="100,6 108,22 92,22" fill="#e53935" />
          <text x="100" y="58" textAnchor="middle" fill="#e53935" fontSize="20" fontWeight="800" transform="rotate(0 100 100)">
            N
          </text>
          <text x="148" y="107" textAnchor="middle" fill="#3a3a3a" fontSize="20" fontWeight="800">
            E
          </text>
          <text x="100" y="156" textAnchor="middle" fill="#3a3a3a" fontSize="20" fontWeight="800">
            S
          </text>
          <text x="52" y="107" textAnchor="middle" fill="#3a3a3a" fontSize="20" fontWeight="800">
            W
          </text>
        </g>
        <circle cx="100" cy="100" r="62" fill="none" stroke="#ececec" strokeWidth="1.5" />
        <text x="100" y="108" textAnchor="middle" fill="#047a48" fontSize="22" fontWeight="700">
          {Math.round(arah)}°
        </text>
      </svg>
    );
  };

  return (
    <div
      className={`map-module-wrapper avz-peta clean-map-mode temukan-field ${petaKustomAktif ? "avenza-custom-active" : ""} ${modePetaBersih ? "clean-map-immersion" : ""} ${modeRekam && modeRekam !== "point" ? "sedang-merekam" : ""}`}
    >
      {/* BILAH JUDUL (Avenza Maps): kembali · nama peta (atau arah putaran, mis. "265° B") · info · cari */}
      <header className={`avz-titlebar ${petaKustomAktif ? "avenza-map-header-bar" : ""}`}>
        <button
          type="button"
          className="avenza-head-btn"
          onClick={() => (petaKustomAktif ? onTutupPetaKustom?.() : onKembali?.())}
          title={petaKustomAktif ? "Kembali ke Pustaka Peta" : "Kembali"}
          aria-label="Kembali"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="avenza-head-title avz-titlebar-teks" title={petaKustomAktif ? petaKustomAktif.namaArea : namaBasemap(basemap)}>
          {judulPeta}
        </h2>
        <div className="avenza-head-actions">
          <button
            type="button"
            className="avenza-head-btn"
            title="Info peta"
            aria-label="Info Peta"
            onClick={() => {
              tutupSemuaPanel();
              setBukaInfoPetaModal(true);
            }}
          >
            <Info size={23} />
          </button>
          <button
            type="button"
            className="avenza-head-btn"
            title="Cari Koordinat / Nama Objek"
            aria-label="Cari di Peta"
            onClick={() => {
              tutupSemuaPanel();
              setCariKoordTerbuka(true);
            }}
          >
            <Search size={23} />
          </button>
        </div>
      </header>

      {/* NAVIGASI KE TUJUAN */}
      {targetGoTo && (
        <div className="goto-nav-banner">
          <div>
            <strong>{targetGoTo.judul}</strong>
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
            Selesai
          </button>
        </div>
      )}

      <div
        className="map-canvas-container clean-canvas"
        ref={wadahPetaRef}
        style={tinggiPeta !== null ? ({ height: tinggiPeta, "--avz-tinggi": `${tinggiPeta}px` } as React.CSSProperties) : undefined}
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

        {/* Bidikan tengah peta: lingkaran dengan empat garis bidik dan titik pusat */}
        <div className={`bidikan-peta avz-bidikan ${modeRekam ? "aktif" : ""}`} aria-hidden="true">
          <div className="avz-reticle-circle" />
          <span className="avz-bidikan-h" />
          <span className="avz-bidikan-v" />
          <span className="avz-bidikan-titik" />
        </div>

        {/* HUD PETA: satu grid (atas · tengah · bawah · bilah bawah) sehingga kontrol tidak pernah bertumpuk */}
        <div className="avz-hud">
          <div className="avz-hud-atas">
            <button
              type="button"
              className="avz-bulat avz-quick-basemap-btn"
              title="Pilih peta dasar"
              aria-label="Pilih peta dasar"
              aria-expanded={bukaPilihBasemap}
              onClick={() => {
                setBukaMenuAlat(false);
                setBukaSalinKoord(false);
                setBukaPilihBasemap(true);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              >
                <rect x="8" y="3" width="13" height="13" rx="2.5" />
                <path d="M16 19.5a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 19.5v-8A2.5 2.5 0 0 1 5.5 9" />
                <path d="M11 13.5l7.5-7.5M11 9l3-3M15 13.5l3-3" strokeLinecap="round" />
              </svg>
            </button>
            <div className="avz-hud-kanan">
              <button
                type="button"
                className={`avz-bulat avz-nav-arrow-btn rail-gps-btn ${modeIkutiGps === "posisi" ? "active mode-posisi" : modeIkutiGps === "kompas" ? "active mode-kompas" : ""}`}
                onClick={onGps}
                disabled={!gpsPos}
                title={gpsPos ? "1x: pusatkan ke posisi saya · 2x: peta ikuti arah" : "Menunggu posisi GPS"}
                aria-label="Posisi saya (mencari lokasi terkini)"
              >
                {modeIkutiGps === "kompas" ? (
                  <Navigation2 size={24} fill="currentColor" />
                ) : (
                  <Navigation size={22} fill={modeIkutiGps === "posisi" ? "currentColor" : "none"} />
                )}
              </button>
              {(putaran !== 0 || modeIkutiKompas) && (
                <div className="map-hud-pod avz-kompas-pod">
                  <button
                    type="button"
                    aria-label={infoKompas.teks}
                    className={`avz-bulat avz-kompas ${modeIkutiKompas ? "ikuti" : ""}`}
                    onClick={() => {
                      setBearing(0);
                      setModeIkutiKompas(false);
                    }}
                    title="Ketuk untuk tegak ke utara"
                  >
                    <svg
                      viewBox="0 0 40 40"
                      width="38"
                      height="38"
                      aria-hidden="true"
                      style={{ transform: `rotate(${-bearingAktif}deg)`, transition: "transform 0.15s ease-out" }}
                    >
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#c9c9c9" strokeWidth="1" strokeDasharray="1.5 2.6" />
                      <polygon points="20,7 23.5,20 16.5,20" fill="#e53935" />
                      <polygon points="20,33 23.5,20 16.5,20" fill="#9e9e9e" />
                      <text x="20" y="23.6" textAnchor="middle" fontSize="9" fontWeight="800" fill="#202020">
                        N
                      </text>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="avz-hud-tengah">
            {pesanSalin && (
              <span className="field-map-message" role="status">
                {pesanSalin}
              </span>
            )}
          </div>

          <div className="avz-hud-bawah">
            <div className="map-bawah">
              <div className="avz-skala-atribusi">
                <div className="avenza-scale-bar-wrap">
                  <div className="avenza-scale-bar-text">{skalaInfo.label}</div>
                  <div className="avenza-scale-bar-ruler" style={{ width: `${skalaInfo.lebarPx}px` }} />
                </div>
                {petaKustomAktif ? (
                  <div id="atribusi-peta" className="map-atribusi map-atribusi-custom">
                    <span>Lembar Peta: {formatJudulAvenza(petaKustomAktif.namaArea, 26)}</span>
                  </div>
                ) : basemap === "google" ? (
                  <div id="atribusi-peta" className="map-atribusi map-atribusi-google">
                    {logoGoogleGagal ? (
                      <strong className="map-logo-google-teks">Google</strong>
                    ) : (
                      <img
                        className="map-logo-google"
                        src={LOGO_GOOGLE}
                        alt="Google"
                        height={14}
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
              </div>
              {/* Tombol besar: jatuhkan pin di titik bidikan */}
              <button
                type="button"
                className="avz-fab-pin"
                onClick={jatuhkanPin}
                title="Jatuhkan pin di titik bidikan"
                aria-label="Tambah titik"
              >
                <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                  <path d="M12 2.5a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7z" fill="#047a48" />
                  <circle cx="12" cy="9.6" r="2.6" fill="#ffffff" />
                </svg>
              </button>
            </div>
          </div>

          {/* KAKI HUD: status rekam oranye (jalur/area) tepat di atas bilah bawah, lalu bilah bawah */}
          <div className="avz-hud-kaki">
            {modeRekam && modeRekam !== "point" && (
              <PanelPerekaman
                rekamLatar={rekamLatar}
                modeRekam={modeRekam}
                jumlahTitik={titikDraft.length}
                panjangDraftKm={panjangDraftKm}
                luasDraftHa={luasDraftHa}
                detikTick={detikTick}
                onTambahTitik={tambahTitikBidikan}
                onBukaPanel={() => {
                  tutupSemuaPanel();
                  setTabDrawerGps("pelacakan");
                  setBukaDrawerGps(true);
                }}
                onSimpan={() => {
                  setBukaDrawerGps(false);
                  setBukaModalForm(true);
                }}
                onBatal={batalkanRekaman}
              />
            )}
            {/* BILAH BAWAH: alat · koordinat bidikan · lapisan; pegangan di atasnya membuka panel GPS */}
            <div className="avz-bottom-pill-bar">
              <button
                type="button"
                className="avz-pegangan"
                aria-label="Buka panel lokasi, pelacakan, dan navigasi"
                onClick={() => {
                  tutupSemuaPanel();
                  setTabDrawerGps("lokasi");
                  setBukaDrawerGps(true);
                }}
              >
                <span aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`avz-pill-btn ${bukaMenuAlat ? "active" : ""}`}
                title="Alat peta"
                aria-label="Alat peta"
                aria-expanded={bukaMenuAlat}
                onClick={() => {
                  setBukaSalinKoord(false);
                  setBukaMenuAlat((v) => !v);
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  <g transform="rotate(-45 12 12)">
                    <rect x="3" y="5.2" width="18" height="5.2" rx="1" />
                    <path d="M7 5.2v2.2M10.5 5.2v1.6M14 5.2v2.2M17.5 5.2v1.6" />
                    <path d="M7.5 13.6h13.5v5.2H7.5L3 16.2z" />
                    <path d="M7.5 13.6v5.2" />
                  </g>
                </svg>
              </button>
              <button
                type="button"
                className="avz-pill-koordinat"
                title="Format dan salin koordinat"
                onClick={() => {
                  setBukaMenuAlat(false);
                  setBukaSalinKoord((v) => !v);
                }}
              >
                <span className="field-telemetry-coordinate">{formatPill.nilai}</span>
              </button>
              <button
                type="button"
                className="avz-pill-btn"
                title="Lapisan peta"
                aria-label="Lapisan peta"
                onClick={() => {
                  tutupSemuaPanel();
                  setCariLapisanInput("");
                  setBukaHalamanLapisan(true);
                }}
              >
                <Layers size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* MENU ALAT (muncul dari tombol alat di kiri bawah) */}
        {bukaMenuAlat && (
          <>
            <div className="avz-tutup-transparan" onClick={() => setBukaMenuAlat(false)} aria-hidden="true" />
            <div className="avz-tool-popup-menu" role="menu">
              <button type="button" role="menuitem" className="avz-tool-popup-item" onClick={() => mulaiModeRekam("polygon")}>
                Gambar dan Ukur
              </button>
              <button type="button" role="menuitem" className="avz-tool-popup-item" onClick={() => mulaiModeRekam("line")}>
                Rekam Jalur GPS
              </button>
              <button
                type="button"
                role="menuitem"
                className="avz-tool-popup-item"
                onClick={() => {
                  setBukaMenuAlat(false);
                  setNavSubView("menu");
                  setTabDrawerGps("navigasi");
                  setBukaDrawerGps(true);
                }}
              >
                Bernavigasi ke Tujuan
              </button>
              <button
                type="button"
                role="menuitem"
                className="avz-tool-popup-item"
                onClick={() => {
                  setBukaMenuAlat(false);
                  setCariKoordTerbuka(true);
                }}
              >
                Cari Menurut Koordinat
              </button>
              <button
                type="button"
                role="menuitem"
                className="avz-tool-popup-item"
                title="Buka form titik; rata-rata GPS ada di bagian Koordinat"
                onClick={jatuhkanPin}
              >
                Rata-rata Plot GPS
              </button>
              <button
                type="button"
                role="menuitem"
                className="avz-tool-popup-item"
                onClick={() => {
                  setBukaMenuAlat(false);
                  if (!posisiNyata) {
                    setPesanSalin("Geofence: posisi GPS belum tersedia.");
                    return;
                  }
                  const area = dataSpasial.filter((d) => d.jenisGeometri === "polygon" && titikDalamPoligon(posisiNyata, d.koordinat));
                  setPesanSalin(
                    area.length
                      ? `Geofence: Anda berada di dalam ${area.map((a) => a.judul).join(", ")}.`
                      : "Geofence: Anda di luar semua area yang tersimpan."
                  );
                }}
              >
                Monitor Geofences
              </button>
              <a
                role="menuitem"
                className="avz-tool-popup-item"
                href={`https://www.google.com/maps?q=${center.lat.toFixed(6)},${center.lng.toFixed(6)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setBukaMenuAlat(false)}
              >
                Lihat di Google Maps
              </a>
              <button type="button" role="menuitem" className="avz-tool-popup-item" onClick={jatuhkanPin}>
                Tandai Foto
              </button>
            </div>
          </>
        )}

        {/* PILIH FORMAT DAN SALIN KOORDINAT */}
        {bukaSalinKoord && (
          <>
            <div className="avz-tutup-transparan" onClick={() => setBukaSalinKoord(false)} aria-hidden="true" />
            <div className="avz-coord-modal" role="dialog" aria-label="Format koordinat">
              <div className="avz-coord-kepala">
                <button
                  type="button"
                  className="avz-coord-salin"
                  onClick={() => {
                    if (navigator.clipboard) {
                      void navigator.clipboard
                        .writeText(formatPill.salin)
                        .then(() => setPesanSalin("Koordinat disalin: " + formatPill.salin))
                        .catch(() => setPesanSalin("Gagal menyalin koordinat"));
                    }
                    setBukaSalinKoord(false);
                  }}
                >
                  <span>Salin koordinat</span>
                  <Copy size={22} />
                </button>
                <button type="button" className="avz-coord-tutup" aria-label="Tutup" title="Tutup" onClick={() => setBukaSalinKoord(false)}>
                  <X size={22} />
                </button>
              </div>
              {[
                { grup: "Lintang, Bujur. - WGS 84", ids: ["wgs84_desimal", "wgs84_ne", "wgs84_dms", "wgs84_ddm"] },
                { grup: "UTM - WGS 84", ids: ["wgs84_utm"] },
                { grup: "TM-3 - SRGI2013", ids: ["srgi_tm3"] }
              ].map((g) => (
                <div key={g.grup} className="avz-coord-grup">
                  <span className="avz-coord-grup-judul">{g.grup}</span>
                  {daftarFormatSalin
                    .filter((f) => g.ids.includes(f.id))
                    .map((f) => (
                      <button
                        type="button"
                        key={f.id}
                        role="radio"
                        aria-checked={formatPillId === f.id}
                        className="avz-coord-opsi"
                        onClick={() => {
                          setFormatPillId(f.id);
                          setSistemKoord(f.sistem);
                          simpanSistemKoordinat(f.sistem);
                        }}
                      >
                        <span>{f.nilai}</span>
                        <span className={`avz-radio-oranye ${formatPillId === f.id ? "aktif" : ""}`} aria-hidden="true" />
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* PEMILIH PETA DASAR (kartu bergambar) */}
      {bukaPilihBasemap && (
        <div className="avz-sheet-latar" onClick={() => setBukaPilihBasemap(false)}>
          <div className="avz-sheet avz-basemap-sheet" role="dialog" aria-label="Pilih peta dasar" onClick={(e) => e.stopPropagation()}>
            <span className="avz-sheet-pegangan" aria-hidden="true" />
            <div className="avz-basemap-grid" style={{ "--jumlah": pilihanBasemap.length } as React.CSSProperties}>
              {pilihanBasemap.map((id) => {
                const aktif = basemap === id && !petaKustomAktif;
                return (
                  <button
                    type="button"
                    key={id}
                    className={`map-basemap-Option avz-basemap-kartu ${aktif ? "active" : ""}`}
                    aria-pressed={aktif}
                    onClick={() => {
                      if (petaKustomAktif) onTutupPetaKustom?.();
                      setBasemap(id);
                      setBukaPilihBasemap(false);
                    }}
                  >
                    <img src={pratinjauBasemap(id)} alt="" className="avz-basemap-kartu-img" draggable={false} />
                    <span className="avz-basemap-kartu-label">{namaBasemap(id)}</span>
                    {aktif && (
                      <span className="avz-basemap-kartu-cek" aria-hidden="true">
                        <Check size={16} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PANEL LOKASI · PELACAKAN · NAVIGASI */}
      {bukaDrawerGps && (
        <div className="avz-sheet-latar avz-sheet-latar-bening" onClick={() => setBukaDrawerGps(false)}>
          <div className="avz-sheet avz-gps-drawer" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="avz-sheet-pegangan avz-sheet-pegangan-tombol"
              aria-label="Tutup panel"
              onClick={() => setBukaDrawerGps(false)}
            >
              <span aria-hidden="true" />
            </button>
            <div className="avz-gps-tabs-header" role="tablist">
              {(
                [
                  ["lokasi", "Lokasi"],
                  ["pelacakan", "Pelacakan"],
                  ["navigasi", "Navigasi"]
                ] as const
              ).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  role="tab"
                  aria-selected={tabDrawerGps === id}
                  className={`avz-gps-tab-btn ${tabDrawerGps === id ? "active" : ""}`}
                  onClick={() => {
                    setTabDrawerGps(id);
                    setNavSubView("menu");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tabDrawerGps === "lokasi" && (
              <div className="avz-gps-tab-body">
                <div className="avz-gps-coord-hero">
                  <h3 className="avz-gps-coord-title">{posisiGpsTeks}</h3>
                  <span className="avz-gps-coord-subtitle">{posisiNyata ? "Lokasi Saat Ini" : infoGps.teks}</span>
                  <span className={`avz-gps-status ${posisiNyata ? "aktif" : ""}`} title={infoGps.teks} aria-hidden="true">
                    <Satellite size={24} />
                  </span>
                </div>
                <div className="avz-gps-kompas-baris">
                  <div className="avz-gps-arah">
                    <strong className="hijau">{bearingKeTarget !== null ? bearingKeTarget : "---"}</strong>
                    <span>Arah titik (DEG)</span>
                  </div>
                  {kompasRose(170)}
                  <div className="avz-gps-arah">
                    <strong className="oranye">{arahHadap !== null ? Math.round(arahHadap) : "---"}</strong>
                    <span>Arah (DEG)</span>
                  </div>
                </div>
                <div className="avz-gps-metrics-grid">
                  <div className="avz-gps-metric-item">
                    <strong className="avz-metric-val">{kecepatanKmj}</strong>
                    <span className="avz-metric-label">Kecepatan (Km/j)</span>
                  </div>
                  <div className="avz-gps-metric-item">
                    <strong className="avz-metric-val">
                      {gpsPos?.elevasi !== undefined ? gpsPos.elevasi.toFixed(2).replace(".", ",") : "---"}
                    </strong>
                    <span className="avz-metric-label">Ketinggian (M)</span>
                  </div>
                  <div className="avz-gps-metric-item">
                    <strong className="avz-metric-val">
                      {gpsPos?.akurasi !== undefined ? gpsPos.akurasi.toFixed(2).replace(".", ",") : "---"}
                    </strong>
                    <span className="avz-metric-label">Akurasi Horizontal (M)</span>
                  </div>
                  <div className="avz-gps-metric-item">
                    <strong className="avz-metric-val">---</strong>
                    <span className="avz-metric-label">Akurasi Vertikal (M)</span>
                  </div>
                </div>
                <div className="avz-gps-bottom-actions">
                  <button
                    type="button"
                    className={`avz-gps-action-outline-btn ${!modeIkutiKompas && putaran === 0 ? "aktif" : ""}`}
                    onClick={() => {
                      setBearing(0);
                      setModeIkutiKompas(false);
                    }}
                  >
                    <Navigation2 size={18} />
                    <span>Arah ke Atas</span>
                  </button>
                  <button
                    type="button"
                    className={`avz-gps-action-outline-btn ${modeIkutiKompas ? "aktif" : ""}`}
                    onClick={() => {
                      void aktifkanKompas();
                      setModeIkutiKompas(true);
                    }}
                  >
                    <Compass size={18} />
                    <span>Orientasi peta</span>
                  </button>
                </div>
              </div>
            )}

            {tabDrawerGps === "pelacakan" && (
              <div className="avz-gps-tab-body">
                <div className="avz-gps-coord-hero">
                  <h3 className="avz-gps-coord-title">
                    {rekamLatar.status === "idle"
                      ? "Siap Melacak"
                      : modeRekam === "polygon"
                        ? rekamLatar.status === "dijeda"
                          ? "Area Dijeda"
                          : "Menggambar Area"
                        : rekamLatar.status === "dijeda"
                          ? "Pelacakan Dijeda"
                          : "Sedang Melacak"}
                  </h3>
                  <span className="avz-gps-coord-subtitle">
                    {rekamLatar.status === "idle" ? "Untuk merekam, tekan tombol mulai" : "Perekaman tetap berjalan walau pindah layar"}
                  </span>
                </div>
                <div className="avz-gps-kompas-baris">
                  <div className="avz-gps-arah">
                    <strong className="hijau">{bearingKeTarget !== null ? bearingKeTarget : "---"}</strong>
                    <span>Arah titik (DEG)</span>
                  </div>
                  {kompasRose(170)}
                  <div className="avz-gps-arah">
                    <strong className="oranye">{arahHadap !== null ? Math.round(arahHadap) : "---"}</strong>
                    <span>Arah (DEG)</span>
                  </div>
                </div>
                <div className="avz-gps-metrics-grid">
                  <div className="avz-gps-metric-item">
                    <strong className="avz-metric-val">{kecepatanKmj}</strong>
                    <span className="avz-metric-label">Kecepatan (Km/j)</span>
                  </div>
                  <div className="avz-gps-metric-item">
                    <strong className="avz-metric-val">
                      {rekamLatar.status === "idle"
                        ? "---"
                        : (modeRekam === "polygon" ? luasDraftHa : panjangDraftKm).toFixed(2).replace(".", ",")}
                    </strong>
                    <span className="avz-metric-label">{modeRekam === "polygon" ? "Luas: (Ha)" : "Jarak: (Km)"}</span>
                  </div>
                  <div className="avz-gps-metric-item">
                    <strong className="avz-metric-val">{kecepatanRataTeks}</strong>
                    <span className="avz-metric-label">Kecepatan Rata-rata</span>
                  </div>
                  <div className="avz-gps-metric-item">
                    <strong className="avz-metric-val" data-tick={detikTick}>
                      {durasiRekamTeks}
                    </strong>
                    <span className="avz-metric-label">Durasi</span>
                  </div>
                </div>
                {rekamLatar.status === "idle" ? (
                  <button type="button" className="avz-gps-btn-primary" onClick={() => mulaiModeRekam("line")}>
                    Mulai Pelacakan
                  </button>
                ) : (
                  <>
                    {/* Saat merekam, tombol Mulai berganti menjadi Jeda dan Hentikan (seperti Avenza) */}
                    <div className="avz-gps-bottom-actions">
                      <button
                        type="button"
                        className="avz-gps-action-outline-btn"
                        onClick={() => (rekamLatar.status === "merekam" ? perekamLatar.jeda() : perekamLatar.lanjutkan())}
                      >
                        <span>{rekamLatar.status === "merekam" ? "Jeda" : "Lanjutkan"}</span>
                      </button>
                      <button
                        type="button"
                        className="avz-gps-btn-primary avz-gps-btn-sejajar avz-gps-btn-hentikan"
                        disabled={titikDraft.length < (modeRekam === "polygon" ? 3 : 2)}
                        title={titikDraft.length < (modeRekam === "polygon" ? 3 : 2) ? "Titik belum cukup" : "Hentikan lalu simpan"}
                        onClick={() => {
                          setBukaDrawerGps(false);
                          setBukaModalForm(true);
                        }}
                      >
                        Hentikan
                      </button>
                    </div>
                    <div className="avz-gps-opsi-rekam">
                      <button type="button" onClick={tambahTitikBidikan}>
                        Tambah titik
                      </button>
                      <button type="button" disabled={!titikDraft.length} onClick={() => perekamLatar.hapusTitikTerakhir()}>
                        Urungkan
                      </button>
                      <button type="button" disabled={!rekamLatar.redoVertex?.length} onClick={() => perekamLatar.ulangiVertex()}>
                        Ulangi
                      </button>
                      {modeRekam === "polygon" && (
                        <button type="button" aria-pressed={snapAktif} onClick={() => setSnapAktif((v) => !v)}>
                          Snap {snapAktif ? "aktif" : "mati"}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-pressed={rekamLatar.autoGpsAktif}
                        title="Mode simulasi: menambah titik acak tanpa GPS lapangan"
                        onClick={() => perekamLatar.toggleAutoGps()}
                      >
                        Simulasi {rekamLatar.autoGpsAktif ? "aktif" : "mati"}
                      </button>
                      <button
                        type="button"
                        className="avz-opsi-bahaya"
                        onClick={() => {
                          batalkanRekaman();
                          setBukaDrawerGps(false);
                        }}
                      >
                        Batalkan
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {tabDrawerGps === "navigasi" && (
              <div className="avz-gps-tab-body avz-nav-body">
                {navSubView === "menu" && (
                  <div className="avz-nav-options-list">
                    {[
                      {
                        id: "proyek",
                        label: "Tujuan Proyek",
                        Ikon: Crosshair,
                        aksi: () => {
                          setTargetGoTo({ lat: center.lat, lng: center.lng, judul: "Titik bidikan" });
                          setBukaDrawerGps(false);
                        }
                      },
                      { id: "fitur", label: "Bernavigasi Ke Fitur", Ikon: MapPin, aksi: () => setNavSubView("fitur") },
                      { id: "koordinat", label: "Masukkan Koordinat", Ikon: Sliders, aksi: () => setNavSubView("koordinat") },
                      {
                        id: "rute",
                        label: "Buat Rute",
                        Ikon: Route,
                        aksi: () => {
                          setBukaDrawerGps(false);
                          mulaiModeRekam("line");
                        }
                      }
                    ].map(({ id, label, Ikon, aksi }) => (
                      <button type="button" key={id} className="avz-nav-option-row" onClick={aksi}>
                        <span className="avz-nav-option-icon">
                          <Ikon size={22} />
                        </span>
                        <span className="avz-nav-option-text">{label}</span>
                      </button>
                    ))}
                    {targetGoTo && (
                      <button type="button" className="avz-nav-option-row" onClick={() => setTargetGoTo(null)}>
                        <span className="avz-nav-option-icon">
                          <X size={22} />
                        </span>
                        <span className="avz-nav-option-text">Hentikan Navigasi</span>
                      </button>
                    )}
                  </div>
                )}
                {navSubView === "fitur" && (
                  <div className="avz-nav-options-list">
                    <button type="button" className="avz-nav-kembali" onClick={() => setNavSubView("menu")}>
                      <ArrowLeft size={18} /> Bernavigasi Ke Fitur
                    </button>
                    {dataSpasial.length === 0 && <p className="avz-nav-kosong">Belum ada objek di lapisan.</p>}
                    {dataSpasial.map((d) => (
                      <button
                        type="button"
                        key={d.id}
                        className="avz-nav-option-row"
                        disabled={!d.koordinat[0]}
                        onClick={() => {
                          const k = d.koordinat[0];
                          setTargetGoTo({ lat: k.lat, lng: k.lng, judul: d.judul });
                          setBukaDrawerGps(false);
                        }}
                      >
                        <span className="avz-nav-option-icon">
                          {d.jenisGeometri === "point" ? (
                            <MapPin size={20} />
                          ) : d.jenisGeometri === "line" ? (
                            <Route size={20} />
                          ) : (
                            <Hexagon size={20} />
                          )}
                        </span>
                        <span className="avz-nav-option-text">{d.judul}</span>
                      </button>
                    ))}
                  </div>
                )}
                {navSubView === "koordinat" && (
                  <form
                    className="avz-nav-koordinat"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (tujuKoordinat(navKoordInput)) {
                        setBukaDrawerGps(false);
                        setNavKoordInput("");
                      } else setPesanSalin("Koordinat tidak valid. Contoh: 2.857270, 117.377476");
                    }}
                  >
                    <button type="button" className="avz-nav-kembali" onClick={() => setNavSubView("menu")}>
                      <ArrowLeft size={18} /> Masukkan Koordinat
                    </button>
                    <input
                      className="avz-input"
                      autoFocus
                      value={navKoordInput}
                      onChange={(e) => setNavKoordInput(e.target.value)}
                      placeholder="Contoh: 2.857270, 117.377476"
                      aria-label="Koordinat tujuan"
                    />
                    <button type="submit" className="avz-gps-btn-primary">
                      Navigasi
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HALAMAN CARI ("Telusuri...") */}
      {cariKoordTerbuka && (
        <div className="avz-halaman" role="dialog" aria-label="Telusuri">
          <form
            className="avz-halaman-kepala avz-cari-kepala"
            onSubmit={(e) => {
              e.preventDefault();
              cariKoordinat();
            }}
          >
            <button
              type="button"
              className="avenza-head-btn"
              aria-label="Kembali"
              onClick={() => {
                setCariKoordTerbuka(false);
                setGalatPencarian("");
              }}
            >
              <ArrowLeft size={24} />
            </button>
            <input
              autoFocus
              className="avz-cari-input coord-chip-search-input"
              placeholder="Telusuri..."
              aria-label="Titik koordinat atau nama objek"
              value={cariKoordInput}
              onChange={(e) => {
                setCariKoordInput(e.target.value);
                setGalatPencarian("");
              }}
            />
          </form>
          <div className="avz-halaman-isi">
            {galatPencarian && (
              <p className="avz-cari-galat" role="alert">
                {galatPencarian}
              </p>
            )}
            {uraikanTeksKoordinat(cariKoordInput) && (
              <button type="button" className="avz-daftar-baris" onClick={() => cariKoordinat()}>
                <Crosshair size={20} />
                <span>
                  <strong>Menuju koordinat</strong>
                  <small>{cariKoordInput.trim()}</small>
                </span>
              </button>
            )}
            {daftarCari.map((d) => (
              <button
                type="button"
                key={d.id}
                className="avz-daftar-baris coord-chip-saran-item"
                onClick={() => {
                  const t = d.koordinat[0];
                  if (!t) return;
                  setCenter(t);
                  setZoom((z) => Math.max(z, 16));
                  setObjekTerpilih(d);
                  setCariKoordTerbuka(false);
                }}
              >
                {d.jenisGeometri === "point" ? (
                  <MapPin size={20} />
                ) : d.jenisGeometri === "line" ? (
                  <Route size={20} />
                ) : (
                  <Hexagon size={20} />
                )}
                <span>
                  <strong>{d.judul}</strong>
                  <small>{d.kategori}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* HALAMAN LAPISAN PETA */}
      {bukaHalamanLapisan && (
        <div className="avz-halaman avz-halaman-lapisan" role="dialog" aria-label="Lapisan Peta">
          <div className="avz-halaman-kepala">
            <button type="button" className="avenza-head-btn" aria-label="Kembali" onClick={() => setBukaHalamanLapisan(false)}>
              <ArrowLeft size={24} />
            </button>
            {cariLapisanTerbuka ? (
              <input
                autoFocus
                className="avz-cari-input"
                placeholder="Telusuri objek..."
                aria-label="Cari objek di lapisan"
                value={cariLapisanInput}
                onChange={(e) => setCariLapisanInput(e.target.value)}
              />
            ) : (
              <h2>Lapisan Peta</h2>
            )}
            <div className="avenza-head-actions">
              <button
                type="button"
                className="avenza-head-btn"
                aria-label="Cari objek"
                onClick={() => {
                  setCariLapisanTerbuka((v) => !v);
                  setLapisanTerbuka(true);
                }}
              >
                <Search size={22} />
              </button>
              <button type="button" className="avenza-head-btn" aria-label="Bagikan lapisan (GeoJSON)" onClick={unduhGeoJson}>
                <Share size={22} />
              </button>
              <button
                type="button"
                className="avenza-head-btn"
                aria-label="Menu lainnya"
                onClick={() => setMenuLapisan((m) => (m === "kepala" ? null : "kepala"))}
              >
                <MoreVertical size={22} />
              </button>
            </div>
          </div>
          <div className="avz-halaman-isi">
            <h3 className="avz-seksi-judul">Lapisan tertaut</h3>
            <div className="avz-lapisan-baris">
              <button
                type="button"
                className="avz-lapisan-utama"
                onClick={() => setLapisanTerbuka((v) => !v)}
                aria-expanded={lapisanTerbuka}
              >
                <span className="avz-lapisan-ikon">
                  <Layers size={24} />
                </span>
                <span className="avz-lapisan-teks">
                  <strong>Data lapangan</strong>
                  <small>Objek {dataSpasial.length}</small>
                  <em>Aktif</em>
                </span>
              </button>
              <button
                type="button"
                className="avz-titik-tiga"
                aria-label="Menu lapisan"
                onClick={() => setMenuLapisan((m) => (m === "lapisan" ? null : "lapisan"))}
              >
                <MoreHorizontal size={22} />
              </button>
            </div>
            {lapisanTerbuka && (
              <div className="avz-objek-daftar">
                {objekLapisan.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    className="avz-daftar-baris strip-chip"
                    onClick={() => {
                      setObjekTerpilih(d);
                      if (d.koordinat[0]) setCenter({ lat: d.koordinat[0].lat, lng: d.koordinat[0].lng });
                      setBukaHalamanLapisan(false);
                    }}
                  >
                    {d.jenisGeometri === "point" ? (
                      <MapPin size={20} />
                    ) : d.jenisGeometri === "line" ? (
                      <Route size={20} />
                    ) : (
                      <Hexagon size={20} />
                    )}
                    <span>
                      <strong>{d.judul}</strong>
                      <small>
                        {d.kategori}
                        {d.jenisGeometri === "line" ? ` · ${d.panjangKm} km` : d.jenisGeometri === "polygon" ? ` · ${d.luasHa} Ha` : ""}
                      </small>
                    </span>
                  </button>
                ))}
                {objekLapisan.length === 0 && <p className="avz-nav-kosong">Tidak ada objek.</p>}
              </div>
            )}

            {areaOffline.length > 0 && (
              <>
                <h3 className="avz-seksi-judul">Lembar peta</h3>
                {areaOffline.map((item) => {
                  const sedangAktif = petaKustomAktif?.id === item.id;
                  return (
                    <div key={item.id} className={`avz-lapisan-baris pustaka-offline-item-card ${sedangAktif ? "active-map" : ""}`}>
                      <button
                        type="button"
                        className="avz-lapisan-utama btn-pustaka-action"
                        onClick={() => {
                          if (sedangAktif) onTutupPetaKustom?.();
                          else onPilihPetaKustom?.(item);
                          setBukaHalamanLapisan(false);
                        }}
                      >
                        <span className="avz-lapisan-ikon">
                          <MapIcon size={22} />
                        </span>
                        <span className="avz-lapisan-teks">
                          <strong>{item.namaArea}</strong>
                          <small>
                            {item.jenisFile || "GeoPDF"} · {item.ukuranMb.toFixed(1).replace(".", ",")} MB
                          </small>
                          <em>{sedangAktif ? "Dibuka" : "Buka di peta"}</em>
                        </span>
                      </button>
                      {onHapusAreaOffline && (
                        <button
                          type="button"
                          className="avz-titik-tiga"
                          aria-label={`Hapus ${item.namaArea}`}
                          onClick={() => onHapusAreaOffline(item.id)}
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {menuLapisan && (
            <>
              <div className="avz-tutup-transparan" onClick={() => setMenuLapisan(null)} aria-hidden="true" />
              <div className={`avz-menu-melayang ${menuLapisan === "kepala" ? "dari-kepala" : "dari-lapisan"}`} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuLapisan(null);
                    unduhGeoJson();
                  }}
                >
                  Ekspor
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuLapisan(null);
                    setLapisanTerbuka((v) => !v);
                  }}
                >
                  {lapisanTerbuka ? "Sembunyikan objek" : "Lihat objek"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuLapisan(null);
                    setBukaHalamanLapisan(false);
                    unduh.bukaModalUnduh(hitungKotakTerlihat(), zoom);
                  }}
                >
                  Unduh area offline
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuLapisan(null);
                    inputImporRef.current?.click();
                  }}
                >
                  Impor berkas
                </button>
              </div>
            </>
          )}

          {/* Tombol oranye: impor GeoJSON / KML / GPX sebagai lapisan */}
          <label className="avz-fab-oranye" title="Impor GeoJSON, KML, atau GPX" aria-label="Impor lapisan">
            <Plus size={30} strokeWidth={2.5} />
            <input ref={inputImporRef} type="file" accept=".geojson,.json,.kml,.gpx" hidden onChange={handleImporFileSpasial} />
          </label>
        </div>
      )}

      {/* HALAMAN INFO PETA */}
      {bukaInfoPetaModal && (
        <div className="avz-halaman avz-map-info-modal" role="dialog" aria-label="Info Peta">
          <div className="avz-halaman-kepala">
            <button type="button" className="avenza-head-btn" aria-label="Kembali" onClick={() => setBukaInfoPetaModal(false)}>
              <ArrowLeft size={24} />
            </button>
            <h2>Peta</h2>
          </div>
          <div className="avz-halaman-isi avz-info-isi">
            <h3 className="avz-info-seksi">Detail</h3>
            <label className="avz-kolom-garis">
              <span>Nama</span>
              <input readOnly value={petaKustomAktif ? petaKustomAktif.namaArea : namaBasemap(basemap)} />
            </label>
            <h3 className="avz-info-seksi">Info</h3>
            {petaKustomAktif ? (
              <>
                <p>Tanggal Diimpor: {new Date(petaKustomAktif.diunduhPada).toLocaleString("id-ID")}</p>
                <p>Format: {petaKustomAktif.jenisFile || "GeoPDF / GeoTIFF"}</p>
                <p>Ukuran: {petaKustomAktif.ukuranMb.toFixed(1).replace(".", ",")} MB</p>
                <p>Status: {petaKustomAktif.statusTeks || "Pada peta (Tersinkronisasi GPS)"}</p>
                {petaKustomAktif.formatGeoref && (
                  <p>
                    Georeferensi:{" "}
                    {
                      {
                        iso32000: "ISO 32000 (/VP Measure GEO)",
                        "ogc-lgi": "OGC TerraGo (/LGIDict)",
                        geotiff: "GeoTIFF Raster (tag 33550, 33922)",
                        mbtiles: "MBTiles SQLite Tile Archive",
                        pmtiles: "PMTiles Protomaps Archive",
                        manual: "Kalibrasi Manual 2 Sudut"
                      }[petaKustomAktif.formatGeoref]
                    }
                  </p>
                )}
                {petaKustomAktif.metodeTransformasi && (
                  <p>
                    Transformasi:{" "}
                    {
                      {
                        "afin-proyeksi": "Regresi Afin Terproyeksi",
                        "afin-geografis": "Regresi Afin Geografis",
                        homografi: "Homografi Projektif 3×3 (DLT)"
                      }[petaKustomAktif.metodeTransformasi]
                    }
                  </p>
                )}
                {petaKustomAktif.sisaMeter !== undefined && petaKustomAktif.sisaMeter !== null && (
                  <p>
                    Selisih di titik kontrol:{" "}
                    {petaKustomAktif.sisaMeter < 0.1 ? "< 0,1 m (akurat)" : `±${petaKustomAktif.sisaMeter.toFixed(1).replace(".", ",")} m`}
                  </p>
                )}
                <p>
                  Batas: Lat {petaKustomAktif.minLat.toFixed(4)}° s/d {petaKustomAktif.maxLat.toFixed(4)}°, Lng{" "}
                  {petaKustomAktif.minLng.toFixed(4)}° s/d {petaKustomAktif.maxLng.toFixed(4)}°
                </p>
              </>
            ) : (
              <>
                <p>Penerbit: {basemap === "taktis" ? "Titik Tapak (gambar offline)" : SUMBER_TILE[basemap].atribusi}</p>
                {basemap !== "taktis" && SUMBER_TILE[basemap].tautanLisensi && (
                  <a className="avz-info-tautan" href={SUMBER_TILE[basemap].tautanLisensi} target="_blank" rel="noopener noreferrer">
                    {SUMBER_TILE[basemap].lisensi}
                  </a>
                )}
                {basemap !== "taktis" && SUMBER_TILE[basemap].catatanPakai && (
                  <p id="info-lisensi-peta" className="avz-info-kecil">
                    {SUMBER_TILE[basemap].catatanPakai}
                  </p>
                )}
              </>
            )}
            <pre className="avz-wkt-box">
              {petaKustomAktif
                ? petaKustomAktif.crsDeskripsi || petaKustomAktif.crs || "WGS 84"
                : `PROJCS["WGS 84 / Pseudo-Mercator",
    GEOGCS["WGS 84",
        DATUM["WGS_1984",
            SPHEROID["WGS 84",6378137,298.257223563,
                AUTHORITY["EPSG","7030"]],
            AUTHORITY["EPSG","6326"]],
        PRIMEM["Greenwich",0,
            AUTHORITY["EPSG","8901"]],
        UNIT["degree",0.0174532925199433,
            AUTHORITY["EPSG","9122"]],
        AUTHORITY["EPSG","4326"]],
    PROJECTION["Mercator_1SP"],
    UNIT["metre",1,
        AUTHORITY["EPSG","9001"]],
    AUTHORITY["EPSG","3857"]]`}
            </pre>
            <p className="avz-info-kecil">Zum saat ini: {zoom.toFixed(1).replace(".", ",")}</p>
          </div>
        </div>
      )}

      {/* PANEL DETAIL OBJEK EXISTING KETIKA DIKLIK DI PETA */}
      {objekTerpilih && (
        <InspektorObjek
          objek={objekTerpilih}
          kondisiUpdateInput={kondisiUpdateInput}
          setKondisiUpdateInput={setKondisiUpdateInput}
          onTambahPembaruanObjek={onTambahPembaruanObjek}
          onGoTo={(t) => {
            setTargetGoTo(t);
            setObjekTerpilih(null);
          }}
          onTutup={() => setObjekTerpilih(null)}
          onPesan={setPesanSalin}
        />
      )}

      {/* FORM SIMPAN ("Pin dijatuhkan", jalur, area) */}
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
            // Pin yang belum disimpan dibuang saat form ditutup (seperti Avenza)
            if (modeRekam === "point") {
              setModeRekam(null);
              setTitikDraft([]);
            }
          }}
          sistemKoordinat={sistemKoord}
          onGantiSistemKoordinat={setSistemKoord}
          onUbahKoordinat={(titikBaru: KoordinatTitik) => {
            setTitikDraft([titikBaru]);
            setCenter(titikBaru);
          }}
        />
      )}

      {/* MODAL PENGUNDUH PETA OFFLINE */}
      {unduh.bukaModalOffline && <UnduhOfflineModal basemap={basemap} areaOffline={areaOffline} unduh={unduh} onBukaArea={setCenter} />}
    </div>
  );
};
