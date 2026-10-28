import React, { useEffect, useRef, useState } from "react";
import {
  AreaPetaOffline,
  BasemapType,
  DataSpasialItem,
  FormatKoordinat,
  JenisGeometri,
  KategoriSurvei,
  KoordinatTitik,
  ProfilKader
} from "../types";
import {
  formatKoordinatTeks,
  hitungBearingDerajat,
  hitungJarakMeter,
  hitungLuasPoligonHa,
  hitungPanjangGarisKm,
  namaArahKompas
} from "../lib/geoUtils";
import {
  perekamLatar,
  usePerekamLatar,
  durasiRekamMs,
  formatDurasi
} from "../lib/perekamLatar";
import { JEDA_PEMBARUAN_JAM } from "../lib/rewardEngine";
import { buatId } from "../lib/id";
import { kompresFoto, perkiraBytesDataUrl } from "../lib/foto";
import { bacaPosisiPeta, POSISI_AWAL_PETA, simpanPosisiPeta } from "../lib/posisiPeta";
import {
  BATAS_TILE_PER_AREA,
  KotakWilayah,
  NAMA_ENV_SUMBER,
  SUMBER_TILE,
  daftarTile,
  hapusTile,
  hitungJumlahTile,
  isiTemplateTile,
  muatGambarTile,
  laporHasilTile,
  zoomSumber,
  penyimpananTileDidukung,
  perkiraanUkuranMb,
  ukuranPenyimpanan,
  unduhTile,
  unduhanLayak,
  urlTile
} from "../lib/petaOffline";
import {
  StatePosisiPerangkat,
  aktifkanKompas,
  selisihArah,
  titikDariBidikan,
  usePosisiPerangkat
} from "../lib/posisiPerangkat";
import {
  Crosshair,
  Download,
  FileUp,
  Layers,
  MapPin,
  Navigation,
  Play,
  Pause,
  Plus,
  Route,
  Square,
  Check,
  X,
  Camera,
  RefreshCw,
  Eye,
  Radio,
  Watch,
  Compass
} from "lucide-react";

interface InteractiveMapProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  areaOffline: AreaPetaOffline[];
  fokusKoordinat?: { lat: number; lng: number; label?: string } | null;
  /** Dipanggil setelah fokus dipakai, agar fokus lama tidak menimpa posisi terakhir saat peta dibuka lagi */
  onFokusDipakai?: () => void;
  onSimpanDataBaru: (item: DataSpasialItem) => void;
  onTambahPembaruanObjek: (
    idData: string,
    kondisiTerbaru: string,
    catatan: string,
    fotoBase64?: string
  ) => boolean;
  onSimpanAreaOffline: (area: AreaPetaOffline) => void;
  onImporBerkas: (namaBerkas: string, isi: string) => boolean;
  onBukaSmartwatch?: () => void;
}

const TILE_SIZE = 256;


function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
}

function tileXToLng(tx: number, zoom: number): number {
  return (tx / Math.pow(2, zoom)) * 360 - 180;
}

function tileYToLat(ty: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * ty) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function teksStatusGps(p: StatePosisiPerangkat, simulasi: boolean): { teks: string; peringatan: boolean } {
  if (simulasi) return { teks: "SIMULASI", peringatan: true };
  switch (p.statusGps) {
    case "aktif":
      return p.posisi?.akurasi !== undefined && p.posisi.akurasi > 50
        ? { teks: `±${Math.round(p.posisi.akurasi)} m (lemah)`, peringatan: true }
        : { teks: `±${p.posisi?.akurasi ?? "?"} m`, peringatan: false };
    case "ditolak":
      return { teks: "GPS ditolak", peringatan: true };
    case "tidak_tersedia":
      return { teks: "GPS tidak tersedia", peringatan: true };
    case "galat":
      return { teks: "Sinyal GPS hilang", peringatan: true };
    default:
      return { teks: "Mencari GPS…", peringatan: true };
  }
}

function teksStatusKompas(p: StatePosisiPerangkat): { teks: string; peringatan: boolean; perluKetuk: boolean } {
  switch (p.statusKompas) {
    case "perlu_izin":
      return { teks: "Aktifkan kompas", peringatan: true, perluKetuk: true };
    case "ditolak":
      return { teks: "Kompas ditolak", peringatan: true, perluKetuk: false };
    case "tidak_tersedia":
      return { teks: "Kompas tidak tersedia", peringatan: true, perluKetuk: false };
    default:
      return { teks: "Kompas…", peringatan: false, perluKetuk: false };
  }
}

const WARNA_KATEGORI: Record<KategoriSurvei, string> = {
  Flora: "#10b981",
  Fauna: "#f59e0b",
  "Mata Air": "#38bdf8",
  "Tanda Batas": "#a855f7",
  "Ancaman / Temuan": "#ef4444",
  "Wilayah Adat / Lahan": "#fbbf24"
};

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
  const [basemap, setBasemap] = useState<BasemapType>(() => posisiTersimpan?.basemap ?? "satelit");
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
  const gpsPos: KoordinatTitik | null =
    simulasiAktif && rekamLatar.posisiTerakhir ? rekamLatar.posisiTerakhir : perangkat.posisi;
  const posisiNyata = perangkat.statusGps === "aktif" ? perangkat.posisi : null;
  const kompasDerajat: number | undefined = perangkat.arahDerajat ?? undefined;
  const [modeRekam, setModeRekam] = useState<JenisGeometri | null>(() =>
    rekamLatar.status !== "idle" && rekamLatar.jenis ? rekamLatar.jenis : null
  );
  const [titikDraft, setTitikDraft] = useState<KoordinatTitik[]>(() =>
    rekamLatar.status !== "idle" ? rekamLatar.titik : []
  );
  const [bukaModalForm, setBukaModalForm] = useState<boolean>(false);
  const [detikTick, setDetikTick] = useState<number>(0);

  // Simpan posisi peta (ditunda sedikit) dan pastikan tersimpan saat aplikasi ditutup/disembunyikan
  const posisiRef = useRef({ ...center, zoom, basemap });
  posisiRef.current = { ...center, zoom, basemap };
  useEffect(() => {
    const t = window.setTimeout(() => simpanPosisiPeta(posisiRef.current), 300);
    return () => window.clearTimeout(t);
  }, [center, zoom, basemap]);
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

  // State Form Atribut Survei
  const [kategoriInput, setKategoriInput] = useState<KategoriSurvei>("Flora");
  const [judulInput, setJudulInput] = useState<string>("");
  const [namaLokalInput, setNamaLokalInput] = useState<string>("");
  const [namaIlmiahInput, setNamaIlmiahInput] = useState<string>("");
  const [jumlahIndividuInput, setJumlahIndividuInput] = useState<string>("1");
  const [manfaatInput, setManfaatInput] = useState<string>("");
  const [kondisiInput, setKondisiInput] = useState<string>("");
  const [deskripsiInput, setDeskripsiInput] = useState<string>("");
  const [fotoInput, setFotoInput] = useState<string>("");
  const [galatFoto, setGalatFoto] = useState<string | null>(null);
  const [memprosesFoto, setMemprosesFoto] = useState<boolean>(false);

  // Inspeksi Objek Existing
  const [objekTerpilih, setObjekTerpilih] = useState<DataSpasialItem | null>(null);
  const [kondisiUpdateInput, setKondisiUpdateInput] = useState<string>("");
  const [catatanUpdateInput, setCatatanUpdateInput] = useState<string>("");

  // Modal Offline Downloader
  const [bukaModalOffline, setBukaModalOffline] = useState<boolean>(false);
  const [namaAreaOfflineBaru, setNamaAreaOfflineBaru] = useState<string>("");
  const [sedangMengunduhTile, setSedangMengunduhTile] = useState<boolean>(false);
  const [kotakUnduh, setKotakUnduh] = useState<KotakWilayah | null>(null);
  const [zoomMinUnduh, setZoomMinUnduh] = useState<number>(13);
  const [zoomMaksUnduh, setZoomMaksUnduh] = useState<number>(17);
  const [kemajuanUnduh, setKemajuanUnduh] = useState<{ selesai: number; total: number; gagal: number } | null>(null);
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);
  const [ruangPenyimpanan, setRuangPenyimpanan] = useState<{ pakaiMb: number; kuotaMb: number } | null>(null);
  const batalUnduhRef = useRef<AbortController | null>(null);

  // Unduhan yang sedang berjalan dihentikan bila peta ditutup (tile yang sudah masuk dibersihkan)
  useEffect(() => () => batalUnduhRef.current?.abort(), []);

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

  // Hanya pada pemakaian pertama (belum ada posisi tersimpan): pindahkan peta ke fix GPS pertama.
  // Setelah itu peta selalu dibuka di posisi terakhir; tombol "Pusatkan ke GPS" tetap tersedia.
  const sudahPusatRef = useRef(posisiTersimpan !== null);
  useEffect(() => {
    if (fokusKoordinat) {
      sudahPusatRef.current = true; // lokasi yang dituju menang atas pemusatan GPS otomatis
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
  }, [fokusKoordinat]);

  useEffect(() => {
    if (sudahPusatRef.current || !perangkat.posisi || fokusKoordinat) return;
    sudahPusatRef.current = true;
    setCenter({ lat: perangkat.posisi.lat, lng: perangkat.posisi.lng });
  }, [perangkat.posisi, fokusKoordinat]);

  const latLngToPixel = (
    lat: number,
    lng: number,
    width: number,
    height: number
  ): { x: number; y: number } => {
    const centerTx = lngToTileX(center.lng, zoom);
    const centerTy = latToTileY(center.lat, zoom);
    const ptTx = lngToTileX(lng, zoom);
    const ptTy = latToTileY(lat, zoom);
    return {
      x: width / 2 + (ptTx - centerTx) * TILE_SIZE,
      y: height / 2 + (ptTy - centerTy) * TILE_SIZE
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

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
      const startTileX = Math.floor(centerTx - W / (2 * ukuranTile)) - 1;
      const endTileX = Math.ceil(centerTx + W / (2 * ukuranTile)) + 1;
      const startTileY = Math.floor(centerTy - H / (2 * ukuranTile)) - 1;
      const endTileY = Math.ceil(centerTy + H / (2 * ukuranTile)) + 1;
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

    // 3. Kisi Koordinat Halus (Tanpa label contoh/dummy)
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    const stepGrid = 128;
    for (let gx = (W / 2) % stepGrid; gx < W; gx += stepGrid) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = (H / 2) % stepGrid; gy < H; gy += stepGrid) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Gambar Objek Spasial yang Sudah Tersimpan
    dataSpasial.forEach((item) => {
      const color = WARNA_KATEGORI[item.kategori] || "#10b981";
      const isSelected = objekTerpilih?.id === item.id;

      if (item.jenisGeometri === "polygon" && item.koordinat.length >= 3) {
        ctx.save();
        ctx.beginPath();
        item.koordinat.forEach((k, idx) => {
          const p = latLngToPixel(k.lat, k.lng, W, H);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = isSelected ? "rgba(251, 191, 36, 0.38)" : "rgba(16, 185, 129, 0.24)";
        ctx.fill();
        ctx.strokeStyle = isSelected ? "#fbbf24" : color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();

        const avgLat =
          item.koordinat.reduce((a, b) => a + b.lat, 0) / item.koordinat.length;
        const avgLng =
          item.koordinat.reduce((a, b) => a + b.lng, 0) / item.koordinat.length;
        const centerPoly = latLngToPixel(avgLat, avgLng, W, H);
        ctx.fillStyle = "rgba(6, 20, 17, 0.85)";
        ctx.fillRect(centerPoly.x - 58, centerPoly.y - 18, 116, 32);
        ctx.strokeStyle = color;
        ctx.strokeRect(centerPoly.x - 58, centerPoly.y - 18, 116, 32);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(item.judul.slice(0, 18), centerPoly.x, centerPoly.y - 4);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillText(`${item.luasHa} Ha`, centerPoly.x, centerPoly.y + 10);
        ctx.restore();
      } else if (item.jenisGeometri === "line" && item.koordinat.length >= 2) {
        ctx.save();
        ctx.beginPath();
        item.koordinat.forEach((k, idx) => {
          const p = latLngToPixel(k.lat, k.lng, W, H);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = isSelected ? "#fbbf24" : "#38bdf8";
        ctx.lineWidth = isSelected ? 4 : 3;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        const mid = item.koordinat[Math.floor(item.koordinat.length / 2)];
        const mp = latLngToPixel(mid.lat, mid.lng, W, H);
        ctx.fillStyle = "rgba(6, 20, 17, 0.88)";
        ctx.fillRect(mp.x - 42, mp.y - 12, 84, 22);
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${item.panjangKm} km`, mp.x, mp.y + 3);
        ctx.restore();
      } else if (item.jenisGeometri === "point" && item.koordinat[0]) {
        const p = latLngToPixel(item.koordinat[0].lat, item.koordinat[0].lng, W, H);
        ctx.save();
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(251, 191, 36, 0.35)";
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "rgba(6, 20, 17, 0.82)";
        const label = item.namaLokal || item.judul.slice(0, 16);
        const tw = ctx.measureText(label).width + 12;
        ctx.fillRect(p.x - tw / 2, p.y + 12, tw, 18);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, p.x, p.y + 24);
        ctx.restore();
      }
    });

    // 5. Gambar Draft Sedang Direkam
    if (modeRekam && titikDraft.length > 0) {
      ctx.save();
      ctx.beginPath();
      titikDraft.forEach((k, idx) => {
        const p = latLngToPixel(k.lat, k.lng, W, H);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (modeRekam === "polygon" && titikDraft.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = "rgba(251, 191, 36, 0.28)";
        ctx.fill();
      }
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.stroke();

      titikDraft.forEach((k, idx) => {
        const p = latLngToPixel(k.lat, k.lng, W, H);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = idx === titikDraft.length - 1 ? "#ef4444" : "#fbbf24";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      ctx.restore();
    }

    // 6. Garis Navigasi Go-To
    if (targetGoTo && gpsPos) {
      const fromP = latLngToPixel(gpsPos.lat, gpsPos.lng, W, H);
      const toP = latLngToPixel(targetGoTo.lat, targetGoTo.lng, W, H);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(fromP.x, fromP.y);
      ctx.lineTo(toP.x, toP.y);
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Posisi GPS Biru (hanya bila perangkat sudah memberi posisi)
    if (gpsPos) {
      const gpsPx = latLngToPixel(gpsPos.lat, gpsPos.lng, W, H);
      // Lingkaran akurasi digambar sesuai skala peta (meter per piksel pada zoom ini)
      const meterPerPiksel = (156543.03392 * Math.cos((gpsPos.lat * Math.PI) / 180)) / Math.pow(2, zoom);
      const radiusAkurasi = gpsPos.akurasi
        ? Math.min(240, Math.max(16, gpsPos.akurasi / meterPerPiksel))
        : 16;
      ctx.save();
      ctx.beginPath();
      ctx.arc(gpsPx.x, gpsPx.y, radiusAkurasi, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.22)";
      ctx.fill();
      if (kompasDerajat !== undefined) {
        const sudut = ((kompasDerajat - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(gpsPx.x, gpsPx.y);
        ctx.arc(gpsPx.x, gpsPx.y, 34, sudut - 0.45, sudut + 0.45);
        ctx.closePath();
        ctx.fillStyle = "rgba(14, 165, 233, 0.5)";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(gpsPx.x, gpsPx.y, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = "#0ea5e9";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.restore();
    }

    // 8. Bidikan Tengah (Crosshair)
    ctx.save();
    const cx = W / 2;
    const cy = H / 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy + 18);
    ctx.stroke();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [
    center,
    zoom,
    basemap,
    dataSpasial,
    titikDraft,
    modeRekam,
    gpsPos,
    kompasDerajat,
    objekTerpilih,
    targetGoTo,
    renderTick
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (bukaMenuPeta) setBukaMenuPeta(false);
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
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    const startTx = lngToTileX(dragRef.current.startLng, zoom);
    const startTy = latToTileY(dragRef.current.startLat, zoom);
    const newLng = tileXToLng(startTx - dx / TILE_SIZE, zoom);
    const newLat = tileYToLat(startTy - dy / TILE_SIZE, zoom);
    setCenter({
      lat: Math.max(-85, Math.min(85, newLat)),
      lng: Math.max(-180, Math.min(180, newLng))
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;

    if (!wasMoved && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (!modeRekam) {
        for (const item of dataSpasial) {
          const refCoord = item.koordinat[0];
          if (!refCoord) continue;
          const p = latLngToPixel(refCoord.lat, refCoord.lng, rect.width, rect.height);
          const dist = Math.hypot(clickX - p.x, clickY - p.y);
          if (dist <= 24) {
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
      setKategoriInput("Flora");
      setBukaModalForm(true);
    } else {
      setTitikDraft([ptAwal]);
      setKategoriInput(jenis === "polygon" ? "Wilayah Adat / Lahan" : "Flora");
      // Mulai perekaman di latar belakang agar tetap merekam walaupun pindah tab
      perekamLatar.mulai(jenis, [ptAwal]);
    }
  };

  const handlePilihFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setGalatFoto(null);
    setMemprosesFoto(true);
    // Foto dikecilkan dulu: foto kamera mentah (beberapa MB) akan memenuhi kuota penyimpanan perangkat
    kompresFoto(file)
      .then((dataUrl) => setFotoInput(dataUrl))
      .catch((err: unknown) => {
        setFotoInput("");
        setGalatFoto(err instanceof Error ? err.message : "Foto tidak dapat diproses.");
      })
      .finally(() => {
        setMemprosesFoto(false);
        input.value = "";
      });
  };

  const handleSimpanForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeRekam || titikDraft.length === 0) return;

    const panjangKm = modeRekam === "point" ? 0 : hitungPanjangGarisKm(titikDraft);
    const luasHa = modeRekam === "polygon" ? hitungLuasPoligonHa(titikDraft) : 0;

    const itemBaru: DataSpasialItem = {
      id: buatId("SPS"),
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      jenisGeometri: modeRekam,
      kategori: kategoriInput,
      judul:
        judulInput.trim() ||
        `${kategoriInput} - ${namaLokalInput || new Date().toLocaleDateString("id-ID")}`,
      namaLokal: namaLokalInput.trim() || undefined,
      namaIlmiah: namaIlmiahInput.trim() || undefined,
      jumlahIndividu: Number(jumlahIndividuInput) || 1,
      manfaatMasyarakat: manfaatInput.trim() || undefined,
      kondisiAncaman: kondisiInput.trim() || undefined,
      deskripsi: deskripsiInput.trim() || "Direkam langsung di lapangan.",
      koordinat: titikDraft,
      panjangKm,
      luasHa,
      kompasDerajat,
      fotoBase64: fotoInput || undefined,
      namaFileFoto: `${kategoriInput.toUpperCase().replace(/\W+/g, "_")}_${profil.idKader}_${Date.now()}.jpg`,
      statusSinkron: "lokal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      riwayatPembaruan: []
    };

    onSimpanDataBaru(itemBaru);
    perekamLatar.selesai();
    setBukaModalForm(false);
    setModeRekam(null);
    setTitikDraft([]);
    setJudulInput("");
    setNamaLokalInput("");
    setNamaIlmiahInput("");
    setManfaatInput("");
    setKondisiInput("");
    setDeskripsiInput("");
    setFotoInput("");
    setGalatFoto(null);
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
  const hitungKotakTerlihat = (): KotakWilayah => {
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
  };

  const bukaModalUnduh = () => {
    setKotakUnduh(hitungKotakTerlihat());
    setZoomMinUnduh(Math.max(10, zoom - 2));
    setZoomMaksUnduh(Math.min(18, zoom + 2));
    setGalatUnduh(null);
    setKemajuanUnduh(null);
    void ukuranPenyimpanan().then(setRuangPenyimpanan);
    setBukaModalOffline(true);
  };

  const sumberUnduh = basemap === "taktis" ? null : SUMBER_TILE[basemap];
  const jumlahTileUnduh = kotakUnduh && basemap !== "taktis" ? hitungJumlahTile(kotakUnduh, zoomMinUnduh, zoomMaksUnduh) : 0;
  const kelebihanTile = jumlahTileUnduh > BATAS_TILE_PER_AREA;
  const bisaUnduh =
    sumberUnduh !== null &&
    sumberUnduh.bolehUnduh &&
    penyimpananTileDidukung() &&
    jumlahTileUnduh > 0 &&
    !kelebihanTile;

  const handleUnduhAreaOffline = async () => {
    if (!bisaUnduh || !kotakUnduh || !sumberUnduh || basemap === "taktis") return;
    const daftarUrl = daftarTile(kotakUnduh, zoomMinUnduh, zoomMaksUnduh)
      .map((t) => isiTemplateTile(sumberUnduh.template, t.z, t.x, t.y))
      .filter((u): u is string => u !== null);

    const pengendali = new AbortController();
    batalUnduhRef.current = pengendali;
    setSedangMengunduhTile(true);
    setGalatUnduh(null);
    setKemajuanUnduh({ selesai: 0, total: daftarUrl.length, gagal: 0 });
    try {
      const hasil = await unduhTile(daftarUrl, {
        sinyal: pengendali.signal,
        onKemajuan: (selesai, total, gagal) => setKemajuanUnduh({ selesai, total, gagal })
      });
      if (!unduhanLayak(hasil, daftarUrl.length)) {
        await hapusTile(hasil.urlBaru); // kembalikan penyimpanan seperti semula
        setGalatUnduh(
          hasil.dihentikan
            ? "Unduhan dibatalkan. Tile yang sudah masuk dibersihkan."
            : hasil.kuotaPenuh
            ? "Penyimpanan HP penuh. Kosongkan ruang atau pilih area dan zoom yang lebih kecil."
            : `Unduhan gagal: ${hasil.gagal + hasil.tidakAda} dari ${daftarUrl.length} tile tidak dapat diambil. Periksa koneksi dan sumber tile, lalu coba lagi.`
        );
        return;
      }
      onSimpanAreaOffline({
        id: buatId("OFF"),
        namaArea: namaAreaOfflineBaru.trim() || `Peta Offline ${areaOffline.length + 1}`,
        basemapId: basemap,
        ...kotakUnduh,
        zoomMin: zoomMinUnduh,
        zoomMax: zoomMaksUnduh,
        jumlahTile: hasil.tersimpan + hasil.sudahAda,
        ukuranMb: Number((hasil.byte / 1_000_000).toFixed(2)),
        jumlahGagal: hasil.gagal + hasil.tidakAda,
        diunduhPada: new Date().toISOString(),
        jenisFile: "XYZ Tiles",
        unduhanNyata: true,
        templateTile: sumberUnduh.template
      });
      setNamaAreaOfflineBaru("");
      setBukaModalOffline(false);
    } catch {
      setGalatUnduh("Unduhan terhenti karena galat tak terduga. Coba lagi.");
    } finally {
      setSedangMengunduhTile(false);
      setKemajuanUnduh(null);
      batalUnduhRef.current = null;
    }
  };

  const panjangDraftKm = hitungPanjangGarisKm(titikDraft);
  const luasDraftHa = hitungLuasPoligonHa(titikDraft);

  const jarakKeTargetMeter =
    targetGoTo && gpsPos ? Math.round(hitungJarakMeter(gpsPos, targetGoTo)) : null;
  const bearingKeTarget = targetGoTo && gpsPos ? hitungBearingDerajat(gpsPos, targetGoTo) : null;
  const belokKeTarget =
    bearingKeTarget !== null && kompasDerajat !== undefined
      ? selisihArah(bearingKeTarget, kompasDerajat)
      : null;
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
                  {jarakKeTargetMeter >= 1000
                    ? `${(jarakKeTargetMeter / 1000).toFixed(2)} km`
                    : `${jarakKeTargetMeter} m`}{" "}
                  • {bearingKeTarget}° ({namaArahKompas(bearingKeTarget)})
                  {belokKeTarget !== null &&
                    (Math.abs(belokKeTarget) < 10
                      ? " • lurus"
                      : ` • belok ${Math.abs(belokKeTarget)}° ke ${belokKeTarget > 0 ? "kanan" : "kiri"}`)}
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => setTargetGoTo(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {/* KANVAS PETA INTERAKTIF FULL-VIEW DAN CLEAN DI MOBILE */}
      <div className="map-canvas-container clean-canvas">
        {/* Atribusi sumber peta wajib tampil menurut lisensi/ketentuan penyedia */}
        {basemap !== "taktis" && (
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
        )}
        <canvas
          ref={canvasRef}
          className="map-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* PILL KOORDINAT RINGKAS DI KIRI ATAS (KETUK UNTUK GANTI DD/DMS/UTM) */}
        <div className="map-clean-top-left">
          <button
            type="button"
            className="map-coord-mini-pill"
            onClick={() =>
              setFormatKoord((f) => (f === "DD" ? "DMS" : f === "DMS" ? "UTM" : "DD"))
            }
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
                {kompasDerajat !== undefined
                  ? `${kompasDerajat}° ${namaArahKompas(kompasDerajat).split(" ")[0]}`
                  : infoKompas.teks}
              </span>
            </button>
          </div>
        </div>

        {/* TOMBOL KONTROL RINGKAS DI KANAN ATAS (TIDAK MENGHALANGI PETA) */}
        <div className="map-overlay-top-right">
          {onBukaSmartwatch && (
            <button
              type="button"
              className="map-ctrl-btn smartwatch-map-btn"
              onClick={onBukaSmartwatch}
              title="Mode Smartwatch"
            >
              <Watch size={16} />
            </button>
          )}
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
            onClick={() => setZoom((z) => Math.min(19, z + 1))}
            title="Perbesar"
          >
            +
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => setZoom((z) => Math.max(11, z - 1))}
            title="Perkecil"
          >
            −
          </button>
        </div>

        {/* POPOVER LAPISAN & ALAT PETA (HANYA TAMPIL SAAT TOMBOL LAYERS DIKETUK) */}
        {bukaMenuPeta && (
          <div className="map-layers-popover">
            <div className="map-popover-head">
              <strong>Peta</strong>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setBukaMenuPeta(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="map-basemap-grid">
              {(
                [
                  { id: "satelit", label: `🛰️ ${SUMBER_TILE.satelit.nama}` },
                  { id: "topo", label: `⛰️ ${SUMBER_TILE.topo.nama}` },
                  { id: "osm", label: `🗺️ ${SUMBER_TILE.osm.nama}` },
                  { id: "taktis", label: "🧭 Kontur" }
                ] as { id: BasemapType; label: string }[]
              ).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`map-basemap-Option ${basemap === b.id ? "active" : ""}`}
                  onClick={() => {
                    setBasemap(b.id);
                    setBukaMenuPeta(false);
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
            {basemap !== "taktis" && (
              <p className="map-lisensi-info" id="info-lisensi-peta">
                <strong>Lisensi:</strong> {SUMBER_TILE[basemap].lisensi}
              </p>
            )}

            <div className="map-popover-actions">
              <button
                type="button"
                className="btn-outline-sm"
                style={{ width: "100%" }}
                onClick={() => {
                  setBukaMenuPeta(false);
                  bukaModalUnduh();
                }}
              >
                <Download size={14} /> Unduh Area Offline
              </button>

              <label
                className="btn-outline-sm"
                style={{ width: "100%", cursor: "pointer" }}
              >
                <FileUp size={14} /> Impor GeoJSON / KML / GPX
                <input
                  type="file"
                  accept=".geojson,.json,.kml,.gpx"
                  style={{ display: "none" }}
                  onChange={handleImporFileSpasial}
                />
              </label>

              {dataSpasial.length > 0 && (
                <button
                  type="button"
                  className="btn-outline-sm"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setTampilDaftarObjek((v) => !v);
                    setBukaMenuPeta(false);
                  }}
                >
                  <Eye size={14} /> {tampilDaftarObjek ? "Sembunyikan" : "Lihat"} Daftar Objek ({dataSpasial.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* PANEL KONTROL SAAT SEDANG MEREKAM GARIS TRACKING ATAU POLIGON (LATAR BELAKANG) */}
        {modeRekam && modeRekam !== "point" && (
          <div className="recording-active-bar">
            <div className="recording-metrics">
              <span
                className={`rec-dot ${rekamLatar.status === "dijeda" ? "paused" : ""}`}
              />
              <div>
                <div className="rec-status-badge-inline">
                  <Radio size={12} />
                  <span>
                    {rekamLatar.status === "dijeda"
                      ? "REKAMAN DIJEDA"
                      : "SEDANG MEREKAM (LATAR BELAKANG)"}
                  </span>
                  <span className="rec-timer-chip" data-tick={detikTick}>
                    {formatDurasi(durasiRekamMs(rekamLatar))}
                  </span>
                </div>
                <strong>
                  {modeRekam === "line"
                    ? `Jalur (${titikDraft.length} titik • ${panjangDraftKm} km)`
                    : `Poligon (${titikDraft.length} sudut • ${luasDraftHa} Ha)`}
                </strong>
              </div>
            </div>

            <div className="recording-actions">
              <button
                type="button"
                className="btn-tool"
                onClick={tambahTitikBidikan}
                title="Tambah titik dari bidikan tengah peta"
              >
                <Plus size={14} /> +Titik
              </button>
              <button
                type="button"
                className={`btn-tool ${rekamLatar.status === "merekam" ? "active-walk" : ""}`}
                onClick={() =>
                  rekamLatar.status === "merekam"
                    ? perekamLatar.jeda()
                    : perekamLatar.lanjutkan()
                }
              >
                {rekamLatar.status === "merekam" ? (
                  <>
                    <Pause size={14} /> Jeda
                  </>
                ) : (
                  <>
                    <Play size={14} /> Lanjut
                  </>
                )}
              </button>
              <button
                type="button"
                className={`btn-tool ${rekamLatar.autoGpsAktif ? "active-walk" : ""}`}
                onClick={() => perekamLatar.toggleAutoGps()}
                title="Mode demo: menambah titik acak tanpa GPS. Data simulasi tidak dihitung ke capaian dan skor."
              >
                <Radio size={14} /> {rekamLatar.autoGpsAktif ? "Simulasi ON" : "Simulasi OFF"}
              </button>
              <button
                type="button"
                className="btn-primary-sm"
                disabled={
                  (modeRekam === "line" && titikDraft.length < 2) ||
                  (modeRekam === "polygon" && titikDraft.length < 3)
                }
                onClick={() => setBukaModalForm(true)}
              >
                <Check size={14} /> Simpan
              </button>
              <button
                type="button"
                className="btn-danger-sm"
                onClick={() => {
                  perekamLatar.batal();
                  setModeRekam(null);
                  setTitikDraft([]);
                }}
                title="Batalkan perekaman"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* TOMBOL REKAM RINGKAS YANG BISA DISEMBUNYIKAN AGAR TIDAK MENGHALANGI PETA */}
        {!modeRekam && (
          <div className="map-clean-bottom-bar">
            {!bukaAlatRekam ? (
              <button
                type="button"
                className="map-fab-record-trigger"
                onClick={() => setBukaAlatRekam(true)}
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>Rekam Lokasi</span>
              </button>
            ) : (
              <div className="map-compact-record-pills">
                <button
                  type="button"
                  className="compact-rec-pill"
                  onClick={() => mulaiModeRekam("point")}
                >
                  <MapPin size={15} />
                  <span>Titik</span>
                </button>
                <button
                  type="button"
                  className="compact-rec-pill"
                  onClick={() => mulaiModeRekam("line")}
                >
                  <Route size={15} />
                  <span>Jalur</span>
                </button>
                <button
                  type="button"
                  className="compact-rec-pill"
                  onClick={() => mulaiModeRekam("polygon")}
                >
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

      {/* PANEL DETAIL OBJEK EXISTING KETIKA DIKLIK DI PETA */}
      {objekTerpilih && (
        <div className="inspector-card">
          <div className="inspector-header">
            <div>
              <span className="badge-kategori">{objekTerpilih.kategori}</span>
              <span className={`badge-sync status-${objekTerpilih.statusSinkron}`}>
                {objekTerpilih.statusSinkron.toUpperCase()}
              </span>
              <h4>{objekTerpilih.judul}</h4>
            </div>
            <button
              type="button"
              className="btn-icon-close"
              onClick={() => setObjekTerpilih(null)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="inspector-grid">
            <div>
              <p className="inspector-desc">{objekTerpilih.deskripsi}</p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="btn-primary-sm"
                  onClick={() =>
                    setTargetGoTo({
                      lat: objekTerpilih.koordinat[0].lat,
                      lng: objekTerpilih.koordinat[0].lng,
                      judul: objekTerpilih.judul
                    })
                  }
                >
                  <Navigation size={14} /> Navigasi Go-To
                </button>
              </div>
            </div>

            <div className="inspector-update-box">
              <h5>
                <RefreshCw size={14} /> Perbarui Kondisi
              </h5>
              <input
                type="text"
                className="form-input"
                placeholder="Kondisi terbaru..."
                value={kondisiUpdateInput}
                onChange={(e) => setKondisiUpdateInput(e.target.value)}
              />
              <p className="text-xs text-muted" style={{ margin: "6px 0 0" }}>
                Satu pembaruan per objek setiap {JEDA_PEMBARUAN_JAM} jam.
              </p>
              <button
                type="button"
                className="btn-primary-sm"
                style={{ marginTop: "8px", width: "100%" }}
                onClick={() => {
                  if (!kondisiUpdateInput.trim()) return;
                  const diterima = onTambahPembaruanObjek(
                    objekTerpilih.id,
                    kondisiUpdateInput.trim(),
                    catatanUpdateInput.trim()
                  );
                  if (diterima) {
                    setKondisiUpdateInput("");
                    setCatatanUpdateInput("");
                  }
                }}
              >
                + Simpan Pembaruan
              </button>
            </div>
          </div>
        </div>
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
              {d.jenisGeometri === "point"
                ? "📍"
                : d.jenisGeometri === "line"
                ? "〰️"
                : "⬢"}{" "}
              {d.judul.slice(0, 20)}
            </button>
          ))}
        </div>
      )}

      {/* MODAL FORM PENYIMPANAN ATRIBUT SURVEI LAPANGAN */}
      {bukaModalForm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>
                {modeRekam === "point"
                  ? "📍 Simpan Titik Lokasi"
                  : modeRekam === "line"
                  ? `〰️ Simpan Jalur (${panjangDraftKm} km)`
                  : `⬢ Simpan Poligon (${luasDraftHa} Ha)`}
              </h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setBukaModalForm(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSimpanForm} className="modal-form">
              <div className="form-row-2">
                <div>
                  <label>Kategori Survei</label>
                  <select
                    className="form-input"
                    value={kategoriInput}
                    onChange={(e) => setKategoriInput(e.target.value as KategoriSurvei)}
                  >
                    <option value="Flora">🌿 Flora</option>
                    <option value="Fauna">🐾 Fauna</option>
                    <option value="Mata Air">💧 Mata Air</option>
                    <option value="Tanda Batas">🪧 Tanda Batas</option>
                    <option value="Wilayah Adat / Lahan">⬢ Wilayah Adat / Lahan</option>
                    <option value="Ancaman / Temuan">⚠️ Ancaman / Temuan</option>
                  </select>
                </div>
                <div>
                  <label>Nama Objek *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Masukkan nama objek"
                    value={judulInput}
                    onChange={(e) => setJudulInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div>
                  <label>Nama Lokal</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nama lokal"
                    value={namaLokalInput}
                    onChange={(e) => setNamaLokalInput(e.target.value)}
                  />
                </div>
                <div>
                  <label>Nama Ilmiah</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Opsional"
                    value={namaIlmiahInput}
                    onChange={(e) => setNamaIlmiahInput(e.target.value)}
                  />
                </div>
                <div>
                  <label>Jumlah</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={jumlahIndividuInput}
                    onChange={(e) => setJumlahIndividuInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div>
                  <label>Manfaat</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Manfaat bagi masyarakat"
                    value={manfaatInput}
                    onChange={(e) => setManfaatInput(e.target.value)}
                  />
                </div>
                <div>
                  <label>Kondisi</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Kondisi saat ini"
                    value={kondisiInput}
                    onChange={(e) => setKondisiInput(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label>Catatan Lapangan</label>
                <textarea
                  rows={2}
                  className="form-input"
                  placeholder="Catatan tambahan..."
                  value={deskripsiInput}
                  onChange={(e) => setDeskripsiInput(e.target.value)}
                />
              </div>

              <div className="form-photo-box">
                <label className="btn-upload-photo">
                  <Camera size={16} /> Lampirkan Foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={handlePilihFoto}
                  />
                </label>
                {memprosesFoto && <span className="photo-ready-badge">Memproses foto…</span>}
                {!memprosesFoto && fotoInput && (
                  <span className="photo-ready-badge">✓ Foto siap ({Math.round(perkiraBytesDataUrl(fotoInput) / 1024)} KB)</span>
                )}
                {galatFoto && (
                  <span role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>
                    {galatFoto}
                  </span>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => setBukaModalForm(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  Simpan Lokasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PENGUNDUH PETA SATELIT OFFLINE */}
      {bukaModalOffline && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>📥 Unduh Peta Offline</h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setBukaModalOffline(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-form">
              {basemap === "taktis" || sumberUnduh === null ? (
                <p className="text-muted" style={{ fontSize: "0.84rem", margin: 0 }}>
                  Peta Kontur digambar langsung oleh aplikasi dan sudah tersedia tanpa internet. Pilih
                  Satelit, Topografi, atau OSM bila ingin mengunduh tile.
                </p>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: "0.84rem" }}>
                    Area: bagian peta yang terlihat sekarang. Sumber:{" "}
                    <strong>{{ satelit: "Satelit", topo: "Topografi", osm: "OSM" }[basemap]}</strong>.
                  </p>

                  {!sumberUnduh.bolehUnduh && (
                    <div
                      className="alert-banner-success"
                      style={{ margin: 0, background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}
                    >
                      {sumberUnduh.alasanTidakBoleh} Untuk mengunduh, pasang penyedia tile yang lisensinya
                      mengizinkan lewat <code>VITE_TILE_URL_{NAMA_ENV_SUMBER[basemap]}</code> dan{" "}
                      <code>VITE_TILE_UNDUH_{NAMA_ENV_SUMBER[basemap]}=true</code> di berkas{" "}
                      <code>.env</code>, lalu bangun ulang aplikasi.
                    </div>
                  )}

                  {!penyimpananTileDidukung() && (
                    <div
                      className="alert-banner-success"
                      style={{ margin: 0, background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}
                    >
                      Penyimpanan offline membutuhkan HTTPS atau localhost. Buka aplikasi lewat alamat aman.
                    </div>
                  )}

                  {sumberUnduh.bolehUnduh && penyimpananTileDidukung() && (
                    <>
                      <div>
                        <label>Nama Area Peta Offline</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Masukkan nama area"
                          value={namaAreaOfflineBaru}
                          disabled={sedangMengunduhTile}
                          onChange={(e) => setNamaAreaOfflineBaru(e.target.value)}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label htmlFor="zoom-min-unduh">Zoom terjauh</label>
                          <select
                            id="zoom-min-unduh"
                            className="form-input"
                            value={zoomMinUnduh}
                            disabled={sedangMengunduhTile}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setZoomMinUnduh(v);
                              if (v > zoomMaksUnduh) setZoomMaksUnduh(v);
                            }}
                          >
                            {Array.from({ length: 9 }, (_, i) => 10 + i).map((z) => (
                              <option key={z} value={z}>{z}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="zoom-maks-unduh">Zoom terdekat</label>
                          <select
                            id="zoom-maks-unduh"
                            className="form-input"
                            value={zoomMaksUnduh}
                            disabled={sedangMengunduhTile}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setZoomMaksUnduh(v);
                              if (v < zoomMinUnduh) setZoomMinUnduh(v);
                            }}
                          >
                            {Array.from({ length: 9 }, (_, i) => 10 + i).map((z) => (
                              <option key={z} value={z}>{z}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <p
                        id="perkiraan-unduh"
                        style={{ margin: 0, fontSize: "0.84rem", color: kelebihanTile ? "#b91c1c" : undefined }}
                      >
                        {kelebihanTile
                          ? `${jumlahTileUnduh.toLocaleString("id-ID")} tile melebihi batas ${BATAS_TILE_PER_AREA.toLocaleString("id-ID")} per area. Perbesar peta (zoom in) atau kurangi zoom terdekat.`
                          : `${jumlahTileUnduh.toLocaleString("id-ID")} tile, perkiraan ±${perkiraanUkuranMb(jumlahTileUnduh, basemap).toFixed(1)} MB.`}
                        {ruangPenyimpanan &&
                          ` Penyimpanan HP: ${ruangPenyimpanan.pakaiMb.toFixed(0)} MB terpakai dari ${ruangPenyimpanan.kuotaMb.toFixed(0)} MB.`}
                      </p>
                    </>
                  )}
                </>
              )}

              {galatUnduh && (
                <div
                  className="alert-banner-success"
                  style={{ margin: 0, background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" }}
                >
                  {galatUnduh}
                </div>
              )}

              {kemajuanUnduh && (
                <div>
                  <progress
                    value={kemajuanUnduh.selesai}
                    max={Math.max(1, kemajuanUnduh.total)}
                    style={{ width: "100%" }}
                  />
                  <small className="text-muted" id="kemajuan-unduh">
                    {kemajuanUnduh.selesai.toLocaleString("id-ID")} dari {kemajuanUnduh.total.toLocaleString("id-ID")} tile
                    {kemajuanUnduh.gagal > 0 ? `, ${kemajuanUnduh.gagal} gagal` : ""}. Biarkan layar ini terbuka.
                  </small>
                </div>
              )}

              {sedangMengunduhTile ? (
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => batalUnduhRef.current?.abort()}
                >
                  Batalkan Unduhan
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!bisaUnduh}
                  onClick={() => void handleUnduhAreaOffline()}
                >
                  ⬇️ Unduh Sekarang
                </button>
              )}

              {areaOffline.length > 0 && (
                <div className="offline-list" style={{ marginTop: 8 }}>
                  {areaOffline.map((a) => (
                    <div key={a.id} className="offline-item">
                      <div>
                        <strong>{a.namaArea}</strong>
                        <small>
                          {a.unduhanNyata
                            ? `${a.jumlahTile.toLocaleString("id-ID")} tile • ${a.ukuranMb} MB`
                            : "Catatan saja, tile tidak tersimpan"}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn-outline-sm"
                        onClick={() => {
                          setCenter({
                            lat: (a.minLat + a.maxLat) / 2,
                            lng: (a.minLng + a.maxLng) / 2
                          });
                          setBukaModalOffline(false);
                        }}
                      >
                        Buka
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
