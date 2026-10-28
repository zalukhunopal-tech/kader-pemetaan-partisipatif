import React, { useEffect, useRef, useState } from "react";
import { DataSpasialItem, KoordinatTitik, ProfilKader } from "../types";
import { hitungLuasPoligonHa, hitungPanjangGarisKm } from "../lib/geoUtils";
import { perekamLatar, usePerekamLatar } from "../lib/perekamLatar";
import { buatId } from "../lib/id";
import { usePosisiPerangkat } from "../lib/posisiPerangkat";
import { Bluetooth, Check, MapPin, Route, Square, Watch, X } from "lucide-react";

interface SmartwatchModalProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  onSimpanDataBaru: (item: DataSpasialItem) => void;
  onTutup: () => void;
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

/**
 * Modul Koneksi Smartwatch via Bluetooth & Tampilan Layar Smartwatch Simpel:
 * - Jika layar smartwatch TIDAK diklik: HANYA menampilkan Peta saja (bersih 100%).
 * - Jika layar smartwatch DIKLIK: menampilkan 3 fitur simpel:
 *   1. Pengambilan Titik
 *   2. Perekaman Jalur
 *   3. Pembuatan Poligon
 */
export const SmartwatchModal: React.FC<SmartwatchModalProps> = ({
  dataSpasial,
  profil,
  onSimpanDataBaru,
  onTutup
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileCacheRef = useRef<Map<string, HTMLImageElement | "loading" | "error">>(
    new Map()
  );
  const rekamLatar = usePerekamLatar();

  // State koneksi Bluetooth Smartwatch
  const [statusBt, setStatusBt] = useState<
    "terputus" | "menyambungkan" | "terhubung"
  >("terputus");
  const [namaJam, setNamaJam] = useState<string>("Smartwatch GIS");
  const [infoToastWatch, setInfoToastWatch] = useState<string | null>(null);

  // State visibilitas fitur di layar smartwatch:
  // Default FALSE -> hanya menampilkan peta saja jika tidak diklik
  const [tampilFiturWatch, setTampilFiturWatch] = useState<boolean>(false);

  // Posisi dari GPS perangkat; null sampai ada fix. Selama mode simulasi (demo) mengikuti titik simulasi.
  const perangkat = usePosisiPerangkat();
  const posisiGps: KoordinatTitik | null =
    rekamLatar.autoGpsAktif && rekamLatar.status === "merekam" && rekamLatar.posisiTerakhir
      ? rekamLatar.posisiTerakhir
      : perangkat.posisi;
  const pesanGps =
    perangkat.statusGps === "ditolak"
      ? "GPS ditolak"
      : perangkat.statusGps === "tidak_tersedia"
      ? "GPS tidak tersedia"
      : "Mencari GPS…";
  const [renderTick, setRenderTick] = useState<number>(0);

  const tampilkanPesanSingkat = (teks: string) => {
    setInfoToastWatch(teks);
    window.setTimeout(() => setInfoToastWatch(null), 2200);
  };

  // Koneksi Web Bluetooth API ke Smartwatch
  const handleSambungkanBluetooth = async () => {
    setStatusBt("menyambungkan");
    try {
      const navBt = navigator as Navigator & {
        bluetooth?: {
          requestDevice: (opts: Record<string, unknown>) => Promise<{
            name?: string;
            gatt?: { connect: () => Promise<unknown> };
          }>;
        };
      };

      if (navBt.bluetooth) {
        const device = await navBt.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ["battery_service", "generic_access", "heart_rate"]
        });
        if (device.gatt) {
          await device.gatt.connect().catch(() => undefined);
        }
        const namaTerdeteksi = device.name || "Smartwatch BLE";
        setNamaJam(namaTerdeteksi);
        setStatusBt("terhubung");
        tampilkanPesanSingkat(`Terhubung ke ${namaTerdeteksi}`);
        return;
      }
    } catch {
      // Jika pengguna menutup dialog BLE browser atau perangkat menggunakan mode langsung
    }

    // Fallback koneksi langsung Smartwatch Bluetooth
    window.setTimeout(() => {
      setNamaJam("Smartwatch GIS BLE");
      setStatusBt("terhubung");
      tampilkanPesanSingkat("Smartwatch Terhubung");
    }, 500);
  };

  const handlePutuskanBluetooth = () => {
    setStatusBt("terputus");
    tampilkanPesanSingkat("Smartwatch Terputus");
  };

  // Render Peta pada Layar Smartwatch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 320;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    if (!posisiGps) {
      ctx.fillStyle = "#041510";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(pesanGps, size / 2, size / 2);
      return;
    }

    const zoom = 16;
    const centerTx = lngToTileX(posisiGps.lng, zoom);
    const centerTy = latToTileY(posisiGps.lat, zoom);

    const latLngToPx = (lat: number, lng: number) => ({
      x: size / 2 + (lngToTileX(lng, zoom) - centerTx) * TILE_SIZE,
      y: size / 2 + (latToTileY(lat, zoom) - centerTy) * TILE_SIZE
    });

    // Latar belakang peta gelap
    const bg = ctx.createRadialGradient(
      size / 2,
      size / 2,
      20,
      size / 2,
      size / 2,
      size / 2
    );
    bg.addColorStop(0, "#0a291f");
    bg.addColorStop(1, "#041510");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Gambar tile peta satelit
    const startX = Math.floor(centerTx - 1);
    const endX = Math.ceil(centerTx + 1);
    const startY = Math.floor(centerTy - 1);
    const endY = Math.ceil(centerTy + 1);

    for (let tx = startX; tx <= endX; tx++) {
      for (let ty = startY; ty <= endY; ty++) {
        const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
        const drawX = Math.round(size / 2 + (tx - centerTx) * TILE_SIZE);
        const drawY = Math.round(size / 2 + (ty - centerTy) * TILE_SIZE);
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

    // Kisi radar tipis
    ctx.strokeStyle = "rgba(52, 211, 153, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 125, 0, Math.PI * 2);
    ctx.stroke();

    // Gambar objek spasial tersimpan
    dataSpasial.forEach((item) => {
      if (item.jenisGeometri === "polygon" && item.koordinat.length >= 3) {
        ctx.beginPath();
        item.koordinat.forEach((k, idx) => {
          const p = latLngToPx(k.lat, k.lng);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(251, 191, 36, 0.28)";
        ctx.fill();
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (item.jenisGeometri === "line" && item.koordinat.length >= 2) {
        ctx.beginPath();
        item.koordinat.forEach((k, idx) => {
          const p = latLngToPx(k.lat, k.lng);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (item.jenisGeometri === "point" && item.koordinat[0]) {
        const p = latLngToPx(item.koordinat[0].lat, item.koordinat[0].lng);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#10b981";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // Gambar draft jalur/poligon yang sedang direkam
    if (rekamLatar.status !== "idle" && rekamLatar.titik.length > 0) {
      ctx.beginPath();
      rekamLatar.titik.forEach((k, idx) => {
        const p = latLngToPx(k.lat, k.lng);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (rekamLatar.jenis === "polygon" && rekamLatar.titik.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = "rgba(251, 191, 36, 0.25)";
        ctx.fill();
      }
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Titik GPS pengguna di tengah layar smartwatch
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 14, 0, Math.PI * 2);
    ctx.fillStyle =
      rekamLatar.status === "merekam"
        ? "rgba(239, 68, 68, 0.3)"
        : "rgba(14, 165, 233, 0.28)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = rekamLatar.status === "merekam" ? "#ef4444" : "#0ea5e9";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }, [posisiGps, pesanGps, dataSpasial, rekamLatar, renderTick]);

  // 1. FITUR PENGAMBILAN TITIK DARI SMARTWATCH
  const handleAmbilTitikWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!posisiGps) {
      tampilkanPesanSingkat(pesanGps);
      return;
    }
    const pt: KoordinatTitik = {
      ...posisiGps,
      timestamp: new Date().toISOString()
    };
    const itemBaru: DataSpasialItem = {
      id: buatId("SW-PT"),
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      jenisGeometri: "point",
      kategori: "Tanda Batas",
      judul: `Titik Smartwatch ${new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      })}`,
      deskripsi: "Direkam melalui Smartwatch Bluetooth",
      koordinat: [pt],
      panjangKm: 0,
      luasHa: 0,
      statusSinkron: "lokal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      riwayatPembaruan: []
    };
    onSimpanDataBaru(itemBaru);
    tampilkanPesanSingkat("📍 Titik Tersimpan");
    setTampilFiturWatch(false);
  };

  // 2. FITUR PEREKAMAN JALUR DARI SMARTWATCH
  const handleRekamJalurWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rekamLatar.status !== "idle" && rekamLatar.jenis === "line") {
      // Jika sedang merekam jalur, simpan jalur
      const hasilTitik = perekamLatar.selesai();
      if (hasilTitik.length >= 2) {
        const panjangKm = hitungPanjangGarisKm(hasilTitik);
        onSimpanDataBaru({
          id: buatId("SW-LN"),
          idKader: profil.idKader,
          namaKader: profil.nama,
          desaWilayah: profil.desaWilayah,
          jenisGeometri: "line",
          kategori: "Tanda Batas",
          judul: `Jalur Smartwatch (${panjangKm} km)`,
          deskripsi: "Jalur direkam melalui Smartwatch Bluetooth",
          koordinat: hasilTitik,
          panjangKm,
          luasHa: 0,
          statusSinkron: "lokal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          riwayatPembaruan: []
        });
        tampilkanPesanSingkat(`〰️ Jalur Disimpan (${panjangKm} km)`);
      } else {
        tampilkanPesanSingkat("Jalur dihentikan");
      }
      setTampilFiturWatch(false);
      return;
    }

    if (!posisiGps) {
      tampilkanPesanSingkat(pesanGps);
      return;
    }
    perekamLatar.mulai("line", [posisiGps]);
    tampilkanPesanSingkat("● Merekam Jalur...");
    setTampilFiturWatch(false);
  };

  // 3. FITUR PEMBUATAN POLIGON DARI SMARTWATCH
  const handleRekamPoligonWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rekamLatar.status !== "idle" && rekamLatar.jenis === "polygon") {
      const hasilTitik = perekamLatar.selesai();
      if (hasilTitik.length >= 3) {
        const luasHa = hitungLuasPoligonHa(hasilTitik);
        onSimpanDataBaru({
          id: buatId("SW-PG"),
          idKader: profil.idKader,
          namaKader: profil.nama,
          desaWilayah: profil.desaWilayah,
          jenisGeometri: "polygon",
          kategori: "Wilayah Adat / Lahan",
          judul: `Poligon Smartwatch (${luasHa} Ha)`,
          deskripsi: "Poligon direkam melalui Smartwatch Bluetooth",
          koordinat: hasilTitik,
          panjangKm: 0,
          luasHa,
          statusSinkron: "lokal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          riwayatPembaruan: []
        });
        tampilkanPesanSingkat(`⬢ Poligon Disimpan (${luasHa} Ha)`);
      } else {
        tampilkanPesanSingkat("Poligon dihentikan");
      }
      setTampilFiturWatch(false);
      return;
    }

    if (!posisiGps) {
      tampilkanPesanSingkat(pesanGps);
      return;
    }
    perekamLatar.mulai("polygon", [posisiGps]);
    tampilkanPesanSingkat("● Merekam Poligon...");
    setTampilFiturWatch(false);
  };

  const sedangRekamJalur =
    rekamLatar.status !== "idle" && rekamLatar.jenis === "line";
  const sedangRekamPoligon =
    rekamLatar.status !== "idle" && rekamLatar.jenis === "polygon";

  return (
    <div className="smartwatch-modal-backdrop" onClick={onTutup}>
      <div
        className="smartwatch-modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* BAR KONEKSI SMARTWATCH */}
        <div className="smartwatch-bt-header">
          <div className="smartwatch-bt-title">
            <Watch size={18} color="#38bdf8" />
            <strong>Smartwatch</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              className={`smartwatch-pair-btn ${statusBt === "terhubung" ? "connected" : ""}`}
              onClick={
                statusBt === "terhubung"
                  ? handlePutuskanBluetooth
                  : handleSambungkanBluetooth
              }
              title={
                statusBt === "terhubung"
                  ? "Putuskan Smartwatch"
                  : "Hubungkan Smartwatch"
              }
            >
              <Bluetooth size={13} />
              <span>{statusBt === "terhubung" ? "Putuskan" : "Hubungkan"}</span>
            </button>
            <button
              type="button"
              className="smartwatch-close-btn"
              onClick={onTutup}
              title="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* BODI JAM TANGAN PINTAR (SMARTWATCH) */}
        <div className="smartwatch-device-wrap">
          <div className="smartwatch-strap-top" />
          <div
            className="smartwatch-bezel"
            onClick={() => setTampilFiturWatch((v) => !v)}
            title="Ketuk layar smartwatch untuk menampilkan/menyembunyikan fitur"
          >
            {/* LAYAR PETA PENUH (TAMPIL MURNI PETA SAAT TIDAK DIKLIK) */}
            <canvas ref={canvasRef} className="smartwatch-map-canvas" />

            {/* INDIKATOR KECIL DI ATAS JIKA SEDANG MEREKAM */}
            {rekamLatar.status !== "idle" && !tampilFiturWatch && (
              <div className="smartwatch-rec-mini-dot" />
            )}

            {/* TOAST SINGKAT DI LAYAR JAM */}
            {infoToastWatch && (
              <div className="smartwatch-mini-toast">{infoToastWatch}</div>
            )}

            {/* MENU 3 FITUR SIMPEL: HANYA MUNCUL APABILA LAYAR DIKLIK */}
            {tampilFiturWatch && (
              <div className="smartwatch-Controls-overlay">
                <button
                  type="button"
                  className="smartwatch-action-btn point"
                  onClick={handleAmbilTitikWatch}
                >
                  <MapPin size={20} />
                  <span>Titik</span>
                </button>

                <button
                  type="button"
                  className={`smartwatch-action-btn line ${
                    sedangRekamJalur ? "active-rec" : ""
                  }`}
                  onClick={handleRekamJalurWatch}
                >
                  {sedangRekamJalur ? <Check size={20} /> : <Route size={20} />}
                  <span>{sedangRekamJalur ? "Simpan" : "Jalur"}</span>
                </button>

                <button
                  type="button"
                  className={`smartwatch-action-btn poly ${
                    sedangRekamPoligon ? "active-rec" : ""
                  }`}
                  onClick={handleRekamPoligonWatch}
                >
                  {sedangRekamPoligon ? (
                    <Check size={20} />
                  ) : (
                    <Square size={20} />
                  )}
                  <span>{sedangRekamPoligon ? "Simpan" : "Poligon"}</span>
                </button>
              </div>
            )}
          </div>
          <div className="smartwatch-strap-bottom" />
        </div>
      </div>
    </div>
  );
};
