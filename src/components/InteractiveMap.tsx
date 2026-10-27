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
  Compass,
  Crosshair,
  Download,
  FileUp,
  Layers,
  MapPin,
  Navigation,
  Play,
  Plus,
  Route,
  Square,
  Check,
  X,
  Camera,
  RefreshCw,
  Eye
} from "lucide-react";

interface InteractiveMapProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  areaOffline: AreaPetaOffline[];
  fokusKoordinat?: { lat: number; lng: number; label?: string } | null;
  onSimpanDataBaru: (item: DataSpasialItem) => void;
  onTambahPembaruanObjek: (
    idData: string,
    kondisiTerbaru: string,
    catatan: string,
    fotoBase64?: string
  ) => void;
  onSimpanAreaOffline: (area: AreaPetaOffline) => void;
  onImporDataSpasial: (items: DataSpasialItem[]) => void;
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

function getTileUrl(basemap: BasemapType, z: number, x: number, y: number): string | null {
  const maxTile = Math.pow(2, z);
  const normX = ((x % maxTile) + maxTile) % maxTile;
  if (y < 0 || y >= maxTile) return null;
  if (basemap === "satelit") {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${normX}`;
  }
  if (basemap === "osm") {
    return `https://tile.openstreetmap.org/${z}/${normX}/${y}.png`;
  }
  if (basemap === "topo") {
    return `https://a.tile.opentopomap.org/${z}/${normX}/${y}.png`;
  }
  return null;
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
  onSimpanDataBaru,
  onTambahPembaruanObjek,
  onSimpanAreaOffline,
  onImporDataSpasial
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileCacheRef = useRef<Map<string, HTMLImageElement | "loading" | "error">>(new Map());

  // Posisi tengah peta (Default: Desa Rimba Lestari)
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: -0.9475,
    lng: 100.4192
  });
  const [zoom, setZoom] = useState<number>(15);
  const [basemap, setBasemap] = useState<BasemapType>("satelit");
  const [formatKoord, setFormatKoord] = useState<FormatKoordinat>("DD");
  const [renderTick, setRenderTick] = useState<number>(0);

  // Navigasi & Posisi GPS Kader
  const [gpsPos, setGpsPos] = useState<KoordinatTitik>({
    lat: -0.9478,
    lng: 100.4185,
    elevasi: 418,
    akurasi: 2.8
  });
  const [kompasDerajat, setKompasDerajat] = useState<number>(65);
  const [targetGoTo, setTargetGoTo] = useState<{
    lat: number;
    lng: number;
    judul: string;
  } | null>(null);

  // Mode Perekaman Spasial
  const [modeRekam, setModeRekam] = useState<JenisGeometri | null>(null);
  const [titikDraft, setTitikDraft] = useState<KoordinatTitik[]>([]);
  const [autoTrackingAktif, setAutoTrackingAktif] = useState<boolean>(false);
  const [bukaModalForm, setBukaModalForm] = useState<boolean>(false);

  // State Form Atribut Survei
  const [kategoriInput, setKategoriInput] = useState<KategoriSurvei>("Flora");
  const [judulInput, setJudulInput] = useState<string>("");
  const [namaLokalInput, setNamaLokalInput] = useState<string>("");
  const [namaIlmiahInput, setNamaIlmiahInput] = useState<string>("");
  const [jumlahIndividuInput, setJumlahIndividuInput] = useState<string>("1");
  const [manfaatInput, setManfaatInput] = useState<string>("");
  const [kondisiInput, setKondisiInput] = useState<string>("Sehat / Baik");
  const [deskripsiInput, setDeskripsiInput] = useState<string>("");
  const [fotoInput, setFotoInput] = useState<string>("");

  // Inspeksi Objek Existing & Update Kondisi
  const [objekTerpilih, setObjekTerpilih] = useState<DataSpasialItem | null>(null);
  const [kondisiUpdateInput, setKondisiUpdateInput] = useState<string>("");
  const [catatanUpdateInput, setCatatanUpdateInput] = useState<string>("");

  // Modal Offline Downloader
  const [bukaModalOffline, setBukaModalOffline] = useState<boolean>(false);
  const [namaAreaOfflineBaru, setNamaAreaOfflineBaru] = useState<string>(
    "Blok Survei Hutan Desa"
  );
  const [sedangMengunduhTile, setSedangMengunduhTile] = useState<boolean>(false);

  // Panning interaksi
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

  // Efek apabila fokusKoordinat berubah dari Tugas atau Chat
  useEffect(() => {
    if (fokusKoordinat) {
      setCenter({ lat: fokusKoordinat.lat, lng: fokusKoordinat.lng });
      setZoom(16);
      if (fokusKoordinat.label) {
        setTargetGoTo({
          lat: fokusKoordinat.lat,
          lng: fokusKoordinat.lng,
          judul: fokusKoordinat.label
        });
      }
    }
  }, [fokusKoordinat]);

  // Simulasi Auto-Walk Tracking GPS di lapangan
  useEffect(() => {
    if (!autoTrackingAktif || modeRekam === null) return;
    const timer = window.setInterval(() => {
      setGpsPos((prev) => {
        const nextLat = prev.lat + (Math.random() - 0.35) * 0.00045;
        const nextLng = prev.lng + (Math.random() - 0.3) * 0.00045;
        const nextElev = Math.round((prev.elevasi || 410) + (Math.random() - 0.45) * 4);
        const ptBaru: KoordinatTitik = {
          lat: nextLat,
          lng: nextLng,
          elevasi: nextElev,
          akurasi: Number((2.2 + Math.random() * 1.5).toFixed(1)),
          timestamp: new Date().toISOString()
        };
        setTitikDraft((old) => [...old, ptBaru]);
        setCenter({ lat: nextLat, lng: nextLng });
        return ptBaru;
      });
      setKompasDerajat((d) => (d + Math.round((Math.random() - 0.5) * 20) + 360) % 360);
    }, 1800);
    return () => clearInterval(timer);
  }, [autoTrackingAktif, modeRekam]);

  // Konversi Lat/Lng ke piksel layar Canvas
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

  // Gambar Peta di Canvas
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

    // 1. Latar Belakang Taktis / Kontur Hutan (Fallback & Mode Taktis)
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

    // 2. Muat & Gambar Tile Peta Satelit / OSM / Topo (jika bukan mode taktis murni)
    const centerTx = lngToTileX(center.lng, zoom);
    const centerTy = latToTileY(center.lat, zoom);
    const startTileX = Math.floor(centerTx - W / (2 * TILE_SIZE)) - 1;
    const endTileX = Math.ceil(centerTx + W / (2 * TILE_SIZE)) + 1;
    const startTileY = Math.floor(centerTy - H / (2 * TILE_SIZE)) - 1;
    const endTileY = Math.ceil(centerTy + H / (2 * TILE_SIZE)) + 1;

    if (basemap !== "taktis") {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
          const url = getTileUrl(basemap, zoom, tx, ty);
          if (!url) continue;
          const drawX = Math.round(W / 2 + (tx - centerTx) * TILE_SIZE);
          const drawY = Math.round(H / 2 + (ty - centerTy) * TILE_SIZE);

          const cached = tileCacheRef.current.get(url);
          if (cached && cached !== "loading" && cached !== "error") {
            ctx.drawImage(cached, drawX, drawY, TILE_SIZE, TILE_SIZE);
          } else if (!cached) {
            tileCacheRef.current.set(url, "loading");
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              tileCacheRef.current.set(url, img);
              setRenderTick((t) => t + 1);
            };
            img.onerror = () => {
              tileCacheRef.current.set(url, "error");
            };
            img.src = url;
          }
        }
      }
    }

    // 3. Gambar Garis Kontur Topografi & Sungai Simulasi (selalu tampil halus agar di mode offline/sandbox tetap informatif)
    ctx.save();
    ctx.strokeStyle =
      basemap === "taktis" ? "rgba(16, 185, 129, 0.25)" : "rgba(52, 211, 153, 0.14)";
    ctx.lineWidth = 1;
    const peakPoints = [
      { lat: -0.943, lng: 100.422, label: "Puncak Kabut (540 mdpl)" },
      { lat: -0.951, lng: 100.414, label: "Bukit Damar (410 mdpl)" }
    ];
    peakPoints.forEach((pk) => {
      const p = latLngToPixel(pk.lat, pk.lng, W, H);
      for (let r = 35; r <= 240; r += 35) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 1.35, r * 0.9, 0.35, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(167, 243, 208, 0.55)";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText(`▲ ${pk.label}`, p.x - 40, p.y - 8);
    });

    // Aliran Sungai Jernih
    const riverCoords = [
      { lat: -0.938, lng: 100.412 },
      { lat: -0.944, lng: 100.415 },
      { lat: -0.9491, lng: 100.4151 },
      { lat: -0.9518, lng: 100.4235 },
      { lat: -0.956, lng: 100.429 }
    ];
    ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    riverCoords.forEach((rc, idx) => {
      const rp = latLngToPixel(rc.lat, rc.lng, W, H);
      if (idx === 0) ctx.moveTo(rp.x, rp.y);
      else ctx.lineTo(rp.x, rp.y);
    });
    ctx.stroke();
    ctx.restore();

    // 4. Gambar Kisi Koordinat (Coordinate Grid)
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
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

    // 5. Gambar Poligon, Jalur Tracking, dan Titik yang sudah tersimpan
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

        // Label Luas Ha di tengah poligon
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
        // Lingkaran luar halo jika terpilih
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

        // Label nama titik
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

    // 6. Gambar Draft Sedang Direkam (Garis / Poligon / Titik)
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

    // 7. Garis Navigasi Go-To Waypoint (Jika aktif)
    if (targetGoTo) {
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

    // 8. Posisi GPS Biru Kader Saat Ini
    const gpsPx = latLngToPixel(gpsPos.lat, gpsPos.lng, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(gpsPx.x, gpsPx.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(56, 189, 248, 0.22)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gpsPx.x, gpsPx.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#0ea5e9";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.restore();

    // 9. Bidikan Tengah (Crosshair Avenza/AlpineQuest)
    ctx.save();
    const cx = W / 2;
    const cy = H / 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(cx + 22, cy);
    ctx.moveTo(cx, cy - 22);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx, cy + 22);
    ctx.stroke();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
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
    objekTerpilih,
    targetGoTo,
    renderTick
  ]);

  // Event handler Geser Peta & Klik Objek di Peta
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

      // Jika sedang dalam mode rekam garis/poligon, klik di peta bisa menambah titik, atau cek klik pada objek existing
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

  // Tambah titik dari posisi bidikan tengah (Crosshair)
  const tambahTitikBidikan = () => {
    const pt: KoordinatTitik = {
      lat: Number(center.lat.toFixed(6)),
      lng: Number(center.lng.toFixed(6)),
      elevasi: Math.round(400 + (center.lat + 0.95) * 2500),
      akurasi: gpsPos.akurasi || 3.0,
      timestamp: new Date().toISOString()
    };
    if (modeRekam === "point") {
      setTitikDraft([pt]);
      setBukaModalForm(true);
    } else {
      setTitikDraft((prev) => [...prev, pt]);
    }
  };

  // Mulai mode rekam
  const mulaiModeRekam = (jenis: JenisGeometri) => {
    setObjekTerpilih(null);
    setModeRekam(jenis);
    setAutoTrackingAktif(false);
    if (jenis === "point") {
      const pt: KoordinatTitik = {
        lat: Number(center.lat.toFixed(6)),
        lng: Number(center.lng.toFixed(6)),
        elevasi: gpsPos.elevasi || 420,
        akurasi: gpsPos.akurasi || 2.8,
        timestamp: new Date().toISOString()
      };
      setTitikDraft([pt]);
      setKategoriInput("Flora");
      setBukaModalForm(true);
    } else {
      setTitikDraft([
        {
          lat: Number(center.lat.toFixed(6)),
          lng: Number(center.lng.toFixed(6)),
          elevasi: gpsPos.elevasi || 420,
          akurasi: gpsPos.akurasi || 2.8,
          timestamp: new Date().toISOString()
        }
      ]);
      setKategoriInput(jenis === "polygon" ? "Wilayah Adat / Lahan" : "Flora");
    }
  };

  // Unggah Foto Lapangan & Kompres ke Base64
  const handlePilihFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFotoInput(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Simpan Data Spasial Baru
  const handleSimpanForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeRekam || titikDraft.length === 0) return;

    const panjangKm = modeRekam === "point" ? 0 : hitungPanjangGarisKm(titikDraft);
    const luasHa = modeRekam === "polygon" ? hitungLuasPoligonHa(titikDraft) : 0;

    const itemBaru: DataSpasialItem = {
      id: `SPS-${Date.now().toString().slice(-5)}`,
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
      deskripsi: deskripsiInput.trim() || "Direkam langsung di lapangan oleh kader.",
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
    setBukaModalForm(false);
    setModeRekam(null);
    setTitikDraft([]);
    setAutoTrackingAktif(false);
    setJudulInput("");
    setNamaLokalInput("");
    setNamaIlmiahInput("");
    setManfaatInput("");
    setDeskripsiInput("");
    setFotoInput("");
  };

  // Impor file GeoJSON
  const handleImporFileSpasial = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const json = JSON.parse(text);
        if (json. features && Array.isArray(json.features)) {
          const hasilImpor: DataSpasialItem[] = json.features.map(
            (f: Record<string, any>, idx: number) => {
              const geomType = f.geometry?.type;
              let jenis: JenisGeometri = "point";
              let koord: KoordinatTitik[] = [];
              if (geomType === "Point") {
                jenis = "point";
                const [lng, lat, ele] = f.geometry.coordinates;
                koord = [{ lat, lng, elevasi: ele || 400 }];
              } else if (geomType === "LineString") {
                jenis = "line";
                koord = f.geometry.coordinates.map((c: number[]) => ({
                  lat: c[1],
                  lng: c[0],
                  elevasi: c[2] || 400
                }));
              } else if (geomType === "Polygon") {
                jenis = "polygon";
                const ring = f.geometry.coordinates[0] || [];
                koord = ring.slice(0, -1).map((c: number[]) => ({
                  lat: c[1],
                  lng: c[0],
                  elevasi: c[2] || 400
                }));
              }
              return {
                id: `IMP-${Date.now()}-${idx}`,
                idKader: profil.idKader,
                namaKader: profil.nama,
                desaWilayah: profil.desaWilayah,
                jenisGeometri: jenis,
                kategori: (f.properties?.kategori as KategoriSurvei) || "Flora",
                judul: f.properties?.judul || f.properties?.name || `Impor #${idx + 1}`,
                namaLokal: f.properties?.namaLokal || "",
                deskripsi: f.properties?.deskripsi || "Hasil impor file GeoJSON",
                koordinat: koord,
                panjangKm: jenis === "line" ? hitungPanjangGarisKm(koord) : 0,
                luasHa: jenis === "polygon" ? hitungLuasPoligonHa(koord) : 0,
                statusSinkron: "lokal",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                riwayatPembaruan: []
              };
            }
          );
          onImporDataSpasial(hasilImpor);
        }
      } catch {
        alert("Format file tidak dikenali. Gunakan file .geojson standar.");
      }
    };
    reader.readAsText(file);
  };

  // Unduh Area Peta Offline
  const handleUnduhAreaOffline = () => {
    setSedangMengunduhTile(true);
    setTimeout(() => {
      const areaBaru: AreaPetaOffline = {
        id: `OFF-${Date.now()}`,
        namaArea: namaAreaOfflineBaru || "Area Hutan Desa",
        basemapId: basemap,
        minLat: Number((center.lat - 0.015).toFixed(4)),
        maxLat: Number((center.lat + 0.015).toFixed(4)),
        minLng: Number((center.lng - 0.015).toFixed(4)),
        maxLng: Number((center.lng + 0.015).toFixed(4)),
        zoomMin: 13,
        zoomMax: 18,
        jumlahTile: 960,
        ukuranMb: 19.5,
        diunduhPada: new Date().toISOString(),
        jenisFile: "XYZ Tiles"
      };
      onSimpanAreaOffline(areaBaru);
      setSedangMengunduhTile(false);
      setBukaModalOffline(false);
    }, 900);
  };

  const panjangDraftKm = hitungPanjangGarisKm(titikDraft);
  const luasDraftHa = hitungLuasPoligonHa(titikDraft);

  const jarakKeTargetMeter = targetGoTo
    ? Math.round(hitungJarakMeter(gpsPos, targetGoTo))
    : 0;
  const bearingKeTarget = targetGoTo
    ? hitungBearingDerajat(gpsPos, targetGoTo)
    : 0;

  return (
    <div className="map-module-wrapper">
      {/* BARIS STATUS GPS, KOMPAS & KOORDINAT BIDIKAN (ALA AVENZA / ALPINEQUEST) */}
      <div className="gps-hud-bar">
        <div className="gps-hud-item">
          <Crosshair size={15} className="text-emerald" />
          <span className="hud-coord">
            {formatKoordinatTeks(center.lat, center.lng, formatKoord)}
          </span>
          <button
            type="button"
            className="hud-badge-btn"
            onClick={() =>
              setFormatKoord((f) => (f === "DD" ? "DMS" : f === "DMS" ? "UTM" : "DD"))
            }
            title="Ubah Format Koordinat (DD / DMS / UTM)"
          >
            {formatKoord}
          </button>
        </div>

        <div className="gps-hud-metrics">
          <span className="hud-pill">
            📡 GPS ±{gpsPos.akurasi} m • {gpsPos.elevasi} mdpl
          </span>
          <span className="hud-pill">
            <Compass size={14} /> {kompasDerajat}° {namaArahKompas(kompasDerajat)}
          </span>
        </div>
      </div>

      {/* BANNER NAVIGASI GO-TO WAYPOINT JIKA AKTIF */}
      {targetGoTo && (
        <div className="goto-nav-banner">
          <div>
            <strong>🎯 Navigasi Go-To: {targetGoTo.judul}</strong>
            <div className="goto-nav-sub">
              Jarak lurus:{" "}
              <b>
                {jarakKeTargetMeter >= 1000
                  ? `${(jarakKeTargetMeter / 1000).toFixed(2)} km`
                  : `${jarakKeTargetMeter} meter`}
              </b>{" "}
              • Arah Kompas: <b>{bearingKeTarget}° ({namaArahKompas(bearingKeTarget)})</b>
            </div>
          </div>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => setTargetGoTo(null)}
          >
            Hentikan Navigasi
          </button>
        </div>
      )}

      {/* KANVAS PETA INTERAKTIF */}
      <div className="map-canvas-container">
        <canvas
          ref={canvasRef}
          className="map-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* PEMILIH BASEMAP DI POJOK KIRI ATAS */}
        <div className="map-overlay-top-left">
          <div className="basemap-switcher">
            <Layers size={15} />
            {(
              [
                { id: "satelit", label: "Satelit Gratis" },
                { id: "topo", label: "Topografi" },
                { id: "osm", label: "OSM" },
                { id: "taktis", label: "Kontur Offline" }
              ] as { id: BasemapType; label: string }[]
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                className={`basemap-btn ${basemap === b.id ? "active" : ""}`}
                onClick={() => setBasemap(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* TOMBOL ZOOM & LOKASI SAYA DI KANAN ATAS */}
        <div className="map-overlay-top-right">
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => setZoom((z) => Math.min(19, z + 1))}
            title="Perbesar Peta"
          >
            +
          </button>
          <span className="zoom-indicator">Z{zoom}</span>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => setZoom((z) => Math.max(11, z - 1))}
            title="Perkecil Peta"
          >
            −
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => setCenter({ lat: gpsPos.lat, lng: gpsPos.lng })}
            title="Pusatkan ke GPS Saya"
          >
            <Navigation size={16} />
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => setBukaModalOffline(true)}
            title="Unduh Peta Satelit Offline / Impor GeoPDF"
          >
            <Download size={16} />
          </button>
          <label
            className="map-ctrl-btn"
            title="Impor File Spasial (GeoJSON / KML / GPX)"
            style={{ cursor: "pointer" }}
          >
            <FileUp size={16} />
            <input
              type="file"
              accept=".geojson,.json"
              style={{ display: "none" }}
              onChange={handleImporFileSpasial}
            />
          </label>
        </div>

        {/* PANEL KONTROL SAAT SEDANG MEREKAM GARIS TRACKING ATAU POLIGON */}
        {modeRekam && modeRekam !== "point" && (
          <div className="recording-active-bar">
            <div className="recording-metrics">
              <span className="rec-dot" />
              <div>
                <strong>
                  {modeRekam === "line"
                    ? `Merekam Jalur Tracking (${titikDraft.length} titik)`
                    : `Memetakan Poligon Wilayah (${titikDraft.length} sudut)`}
                </strong>
                <div className="rec-sub">
                  {modeRekam === "line" ? (
                    <>
                      Panjang Otomatis: <b>{panjangDraftKm} km</b> (Target 1 Paket: 5,0 km)
                    </>
                  ) : (
                    <>
                      Luas Otomatis: <b>{luasDraftHa} Ha</b> • Keliling: {panjangDraftKm} km (Target: 5,0 Ha)
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="recording-actions">
              <button
                type="button"
                className="btn-tool"
                onClick={tambahTitikBidikan}
              >
                <Plus size={15} /> +Titik Bidikan
              </button>
              <button
                type="button"
                className={`btn-tool ${autoTrackingAktif ? "active-walk" : ""}`}
                onClick={() => setAutoTrackingAktif((a) => !a)}
              >
                <Play size={15} /> {autoTrackingAktif ? "Jeda Jalan GPS" : "Auto-Track GPS"}
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
                <Check size={15} /> Selesai & Simpan
              </button>
              <button
                type="button"
                className="btn-danger-sm"
                onClick={() => {
                  setModeRekam(null);
                  setTitikDraft([]);
                  setAutoTrackingAktif(false);
                }}
              >
                <X size={15} /> Batal
              </button>
            </div>
          </div>
        )}

        {/* BILAH ALAT PEREKAMAN LAPANGAN (BAWAH PETA) */}
        {!modeRekam && (
          <div className="map-bottom-toolbar">
            <button
              type="button"
              className="record-action-btn point"
              onClick={() => mulaiModeRekam("point")}
            >
              <MapPin size={18} />
              <div>
                <span>Ambil Titik (Waypoint)</span>
                <small>Flora, Fauna, Air, Batas</small>
              </div>
            </button>

            <button
              type="button"
              className="record-action-btn line"
              onClick={() => mulaiModeRekam("line")}
            >
              <Route size={18} />
              <div>
                <span>Rekam Tracking (Jalur)</span>
                <small>Hitung jarak otomatis (km)</small>
              </div>
            </button>

            <button
              type="button"
              className="record-action-btn polygon"
              onClick={() => mulaiModeRekam("polygon")}
            >
              <Square size={18} />
              <div>
                <span>Petakan Poligon (Area)</span>
                <small>Hitung luas otomatis (Ha)</small>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* PANEL DETAIL OBJEK EXISTING & PEMBARUAN DATA (KETIKA OBJEK DIKLIK DI PETA) */}
      {objekTerpilih && (
        <div className="inspector-card">
          <div className="inspector-header">
            <div>
              <span className="badge-kategori">{objekTerpilih.kategori}</span>
              <span className={`badge-sync status-${objekTerpilih.statusSinkron}`}>
                {objekTerpilih.statusSinkron === "lokal"
                  ? "📱 Tersimpan di HP (Belum Sinkron)"
                  : objekTerpilih.statusSinkron === "tersinkron"
                  ? "☁️ Tersinkron ke GDrive"
                  : "✅ Terverifikasi Admin"}
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
              <ul className="inspector-meta">
                {objekTerpilih.namaLokal && (
                  <li>
                    <strong>Nama Lokal / Ilmiah:</strong> {objekTerpilih.namaLokal}{" "}
                    {objekTerpilih.namaIlmiah ? `(${objekTerpilih.namaIlmiah})` : ""}
                  </li>
                )}
                {objekTerpilih.manfaatMasyarakat && (
                  <li>
                    <strong>Manfaat Masyarakat:</strong> {objekTerpilih.manfaatMasyarakat}
                  </li>
                )}
                {objekTerpilih.kondisiAncaman && (
                  <li>
                    <strong>Kondisi / Ancaman:</strong> {objekTerpilih.kondisiAncaman}
                  </li>
                )}
                {objekTerpilih.jenisGeometri === "line" && (
                  <li>
                    <strong>Panjang Jalur Tracking:</strong> {objekTerpilih.panjangKm} km
                  </li>
                )}
                {objekTerpilih.jenisGeometri === "polygon" && (
                  <li>
                    <strong>Luas Wilayah Poligon:</strong> {objekTerpilih.luasHa} Hektare (Ha)
                  </li>
                )}
                <li>
                  <strong>Koordinat Utama:</strong>{" "}
                  {formatKoordinatTeks(
                    objekTerpilih.koordinat[0].lat,
                    objekTerpilih.koordinat[0].lng,
                    formatKoord
                  )}
                </li>
              </ul>

              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
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
                  <Navigation size={14} /> Navigasi Go-To ke Titik Ini
                </button>
              </div>
            </div>

            {/* Form Update Kondisi Terbaru (Sesuai PRD 3.1: Pembaruan Data Existing) */}
            <div className="inspector-update-box">
              <h5>
                <RefreshCw size={14} /> Perbarui Kondisi Objek (Update Data Existing)
              </h5>
              {objekTerpilih.riwayatPembaruan.length > 0 && (
                <div className="update-history-list">
                  {objekTerpilih.riwayatPembaruan.map((u) => (
                    <div key={u.id} className="update-history-item">
                      <small>
                        {u.tanggal.slice(0, 10)} oleh <b>{u.olehKader}</b>
                      </small>
                      <div>{u.kondisiTerbaru}</div>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="text"
                className="form-input"
                placeholder="Kondisi terbaru (mis. Pohon sedang berbuah lebat)"
                value={kondisiUpdateInput}
                onChange={(e) => setKondisiUpdateInput(e.target.value)}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Catatan tambahan tindak lanjut..."
                value={catatanUpdateInput}
                onChange={(e) => setCatatanUpdateInput(e.target.value)}
                style={{ marginTop: "6px" }}
              />
              <button
                type="button"
                className="btn-primary-sm"
                style={{ marginTop: "8px", width: "100%" }}
                onClick={() => {
                  if (!kondisiUpdateInput.trim()) return;
                  onTambahPembaruanObjek(
                    objekTerpilih.id,
                    kondisiUpdateInput.trim(),
                    catatanUpdateInput.trim()
                  );
                  setKondisiUpdateInput("");
                  setCatatanUpdateInput("");
                }}
              >
                + Simpan Pembaruan Kondisi (+1 Poin Capaian)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAFTAR RINGKAS OBJEK DI PETA AGAR MUDAH DIKLIK / MENUJU KE LOKASI */}
      <div className="map-feature-strip">
        <span className="strip-label">
          <Eye size={14} /> Objek Terpetakan ({dataSpasial.length}):
        </span>
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
            {d.judul.slice(0, 22)}
          </button>
        ))}
      </div>

      {/* MODAL FORM PENYIMPANAN ATRIBUT SURVEI LAPANGAN */}
      {bukaModalForm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>
                {modeRekam === "point"
                  ? "📍 Simpan Titik Koordinat (Waypoint)"
                  : modeRekam === "line"
                  ? `〰️ Simpan Jalur Tracking (${panjangDraftKm} km)`
                  : `⬢ Simpan Poligon Wilayah (${luasDraftHa} Ha)`}
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
                    <option value="Flora">🌿 Flora (Tumbuhan / Pohon)</option>
                    <option value="Fauna">🐾 Fauna (Satwa / Jejak)</option>
                    <option value="Mata Air">💧 Mata Air / Hidrologi</option>
                    <option value="Tanda Batas">🪧 Tanda Batas Wilayah</option>
                    <option value="Wilayah Adat / Lahan">⬢ Wilayah Adat / Kebun</option>
                    <option value="Ancaman / Temuan">⚠️ Ancaman / Temuan Lain</option>
                  </select>
                </div>
                <div>
                  <label>Judul / Nama Objek *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Mis. Pohon Damar Besar Blok Ulu"
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
                    placeholder="Mis. Damar / Meranti"
                    value={namaLokalInput}
                    onChange={(e) => setNamaLokalInput(e.target.value)}
                  />
                </div>
                <div>
                  <label>Nama Ilmiah (Opsional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Mis. Agathis dammara"
                    value={namaIlmiahInput}
                    onChange={(e) => setNamaIlmiahInput(e.target.value)}
                  />
                </div>
                <div>
                  <label>Jumlah Individu</label>
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
                  <label>Manfaat bagi Masyarakat</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Mis. Getah damar, sumber air bersih, pohon pakan"
                    value={manfaatInput}
                    onChange={(e) => setManfaatInput(e.target.value)}
                  />
                </div>
                <div>
                  <label>Kondisi / Ancaman</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Mis. Sehat, aman dari pembalakan"
                    value={kondisiInput}
                    onChange={(e) => setKondisiInput(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label>Deskripsi Lapangan Lengkap</label>
                <textarea
                  rows={2}
                  className="form-input"
                  placeholder="Catat ciri lokasi, kemiringan lereng, atau kesepakatan warga..."
                  value={deskripsiInput}
                  onChange={(e) => setDeskripsiInput(e.target.value)}
                />
              </div>

              <div className="form-photo-box">
                <label className="btn-upload-photo">
                  <Camera size={16} /> Ambil / Lampirkan Foto Dokumentasi (Geotagging)
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={handlePilihFoto}
                  />
                </label>
                {fotoInput && (
                  <span className="photo-ready-badge">✓ Foto terlampir siap sinkron GDrive</span>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => setBukaModalForm(false)}
                >
                  Kembali ke Peta
                </button>
                <button type="submit" className="btn-primary">
                  💾 Simpan ke Memori HP (Offline-First)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PENGUNDUH PETA SATELIT OFFLINE & GEOPDF */}
      {bukaModalOffline && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>📥 Pengunduh Area Peta Satelit Offline & GeoPDF</h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setBukaModalOffline(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-form">
              <p className="text-muted">
                Simpan citra satelit kotak wilayah kerja saat ini ke memori HP agar tetap bisa
                dipakai di tengah hutan tanpa sinyal seluler.
              </p>

              <div>
                <label>Nama Area Peta Offline</label>
                <input
                  type="text"
                  className="form-input"
                  value={namaAreaOfflineBaru}
                  onChange={(e) => setNamaAreaOfflineBaru(e.target.value)}
                />
              </div>

              <div className="offline-bbox-preview">
                <div>
                  <strong>Batas Wilayah (Bounding Box):</strong>{" "}
                  {(center.lat - 0.015).toFixed(4)}° s/d {(center.lat + 0.015).toFixed(4)}° LS,{" "}
                  {(center.lng - 0.015).toFixed(4)}° s/d {(center.lng + 0.015).toFixed(4)}° BT
                </div>
                <div>
                  <strong>Rentang Zoom:</strong> Z13 – Z18 (Estimasi 960 Tile • ±19,5 MB)
                </div>
              </div>

              <button
                type="button"
                className="btn-primary"
                disabled={sedangMengunduhTile}
                onClick={handleUnduhAreaOffline}
              >
                {sedangMengunduhTile
                  ? "⏳ Mengunduh & Menyimpan Tile Satelit ke Memori HP..."
                  : "⬇️ Unduh Paket Peta Satelit Sekarang"}
              </button>

              <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "12px 0" }} />

              <h4>Paket Peta Offline Tersimpan di HP ({areaOffline.length})</h4>
              <div className="offline-list">
                {areaOffline.map((a) => (
                  <div key={a.id} className="offline-item">
                    <div>
                      <strong>{a.namaArea}</strong>
                      <small>
                        {a.jenisFile} • Zoom {a.zoomMin}–{a.zoomMax} ({a.jumlahTile} tile,{" "}
                        {a.ukuranMb} MB)
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
                      Buka Area
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
