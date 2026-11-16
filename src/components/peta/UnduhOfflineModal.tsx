import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Compass, Download, HardDrive, Layers, Maximize2, X, ZoomIn } from "lucide-react";
import { AreaPetaOffline, BasemapType } from "../../types";
import { buatId } from "../../lib/id";
import { hitungKotakKm } from "../../lib/cachePetaOtomatis";
import {
  BATAS_TILE_PER_AREA,
  KotakWilayah,
  SUMBER_TILE,
  TileXYZ,
  daftarTile,
  hapusTile,
  isiTemplateTile,
  penyimpananTileDidukung,
  perkiraanUkuranMb,
  unduhTile,
  unduhanLayak
} from "../../lib/petaOffline";

export const DURASI_TAHAN_UNDUH_MS = 3000;
export const JANGKAUAN_UNDUH_KM = 10;
export const ZOOM_MAKS_UNDUH_OFFLINE = 20;
export const ZOOM_MIN_UNDUH_OFFLINE = 12;

export interface StatusHudUnduh {
  persen: number;
  selesai: boolean;
}

/**
 * Menyusun piramida tile berpusat di titik bidik untuk area 10 x 10 km sampai ketelitian zoom 20x:
 * - 10 x 10 km penuh pada zoom 12..15 (orientasi & navigasi koridor luas)
 * - 4 x 4 km menengah pada zoom 16..17
 * - 1.5 x 1.5 km detail pada zoom 18
 * - 0.5 x 0.5 km presisi tinggi di pusat area pada zoom 19..20 (atau batas zoom penyedia)
 */
export function daftarTilePiramida10KmZoom20(latPusat: number, lngPusat: number, zoomMaksSumber: number): TileXYZ[] {
  const zMaxEfektif = Math.min(ZOOM_MAKS_UNDUH_OFFLINE, Math.max(18, zoomMaksSumber));
  const lapisan: { sisiKm: number; zMin: number; zMax: number }[] = [
    { sisiKm: 10, zMin: 12, zMax: Math.min(15, zMaxEfektif) },
    { sisiKm: 4, zMin: 16, zMax: Math.min(17, zMaxEfektif) },
    { sisiKm: 1.5, zMin: 18, zMax: Math.min(18, zMaxEfektif) },
    { sisiKm: 0.5, zMin: 19, zMax: zMaxEfektif }
  ];
  const hasil: TileXYZ[] = [];
  const dilihat = new Set<string>();
  for (const lap of lapisan) {
    if (lap.zMin > lap.zMax) continue;
    const kotak = hitungKotakKm(latPusat, lngPusat, lap.sisiKm);
    for (const t of daftarTile(kotak, lap.zMin, lap.zMax)) {
      const k = `${t.z}/${t.x}/${t.y}`;
      if (!dilihat.has(k)) {
        dilihat.add(k);
        hasil.push(t);
      }
    }
  }
  return hasil;
}

/** Menentukan warna lingkaran & visibilitas checklist sesuai rentang persen (1-30 merah, 30-60 kuning, 60-90 hijau muda, 90-100 hijau + checklist). */
export function kategoriProgressUnduh(persen: number, selesai = false): {
  warna: string;
  tampilChecklist: boolean;
  fase: "merah" | "kuning" | "hijau-muda" | "hijau";
} {
  const p = Math.max(1, Math.min(100, Math.round(persen)));
  if (selesai || p >= 90) {
    return { warna: "#16a34a", tampilChecklist: true, fase: "hijau" };
  }
  if (p >= 60) {
    return { warna: "#4ade80", tampilChecklist: false, fase: "hijau-muda" };
  }
  if (p >= 30) {
    return { warna: "#eab308", tampilChecklist: false, fase: "kuning" };
  }
  return { warna: "#ef4444", tampilChecklist: false, fase: "merah" };
}

/**
 * Keadaan pengunduh peta offline. Dipegang oleh peta agar unduhan berjalan
 * di latar belakang setelah modal ditutup dan progres tampil langsung di HUD peta.
 */
export function useUnduhAreaOffline(
  basemap: BasemapType,
  areaOffline: AreaPetaOffline[],
  onSimpanAreaOffline: (area: AreaPetaOffline) => void
) {
  const [bukaModalOffline, setBukaModalOffline] = useState<boolean>(false);
  const [namaAreaOfflineBaru, setNamaAreaOfflineBaru] = useState<string>("");
  const [sedangMengunduhTile, setSedangMengunduhTile] = useState<boolean>(false);
  const [kotakUnduh, setKotakUnduh] = useState<KotakWilayah | null>(null);
  const [pusatUnduh, setPusatUnduh] = useState<{ lat: number; lng: number } | null>(null);
  const [zoomMinUnduh, setZoomMinUnduh] = useState<number>(ZOOM_MIN_UNDUH_OFFLINE);
  const [zoomMaksUnduh, setZoomMaksUnduh] = useState<number>(ZOOM_MAKS_UNDUH_OFFLINE);
  const [kemajuanUnduh, setKemajuanUnduh] = useState<{ selesai: number; total: number; gagal: number } | null>(null);
  const [statusHud, setStatusHud] = useState<StatusHudUnduh | null>(null);
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);
  const batalUnduhRef = useRef<AbortController | null>(null);
  const timerTutupHudRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      batalUnduhRef.current?.abort();
      if (timerTutupHudRef.current !== null) window.clearTimeout(timerTutupHudRef.current);
    },
    []
  );

  /** Membuka panel unduh untuk jangkauan 10 x 10 km di pusat area peta hingga zoom 20x. */
  const bukaModalUnduh = (kotak: KotakWilayah, _zoom?: number) => {
    const latPusat = (kotak.minLat + kotak.maxLat) / 2;
    const lngPusat = (kotak.minLng + kotak.maxLng) / 2;
    const kotak10Km = hitungKotakKm(latPusat, lngPusat, JANGKAUAN_UNDUH_KM);
    setKotakUnduh(kotak10Km);
    setPusatUnduh({ lat: latPusat, lng: lngPusat });
    setZoomMinUnduh(ZOOM_MIN_UNDUH_OFFLINE);
    setZoomMaksUnduh(ZOOM_MAKS_UNDUH_OFFLINE);
    setGalatUnduh(null);
    setKemajuanUnduh(null);
    setBukaModalOffline(true);
  };

  const sumberUnduh = basemap === "taktis" ? null : SUMBER_TILE[basemap];
  const daftarTileTarget = useMemo(() => {
    if (!pusatUnduh || !sumberUnduh) return [];
    return daftarTilePiramida10KmZoom20(pusatUnduh.lat, pusatUnduh.lng, sumberUnduh.zoomMaks);
  }, [pusatUnduh, sumberUnduh]);

  const jumlahTileUnduh = daftarTileTarget.length;
  const kelebihanTile = jumlahTileUnduh > BATAS_TILE_PER_AREA;
  const bisaUnduh = sumberUnduh !== null && penyimpananTileDidukung() && jumlahTileUnduh > 0 && !kelebihanTile;

  const handleUnduhAreaOffline = async () => {
    if (!bisaUnduh || !kotakUnduh || !sumberUnduh || basemap === "taktis" || sedangMengunduhTile) return;
    if (timerTutupHudRef.current !== null) {
      window.clearTimeout(timerTutupHudRef.current);
      timerTutupHudRef.current = null;
    }

    const daftarUrl = daftarTileTarget
      .map((t) => isiTemplateTile(sumberUnduh.template, t.z, t.x, t.y))
      .filter((u): u is string => u !== null);

    const pengendali = new AbortController();
    batalUnduhRef.current = pengendali;
    setSedangMengunduhTile(true);
    setGalatUnduh(null);
    setKemajuanUnduh({ selesai: 0, total: daftarUrl.length, gagal: 0 });
    setStatusHud({ persen: 1, selesai: false });
    setBukaModalOffline(false);

    try {
      const hasil = await unduhTile(daftarUrl, {
        sinyal: pengendali.signal,
        onKemajuan: (selesai, total, gagal) => {
          setKemajuanUnduh({ selesai, total, gagal });
          const persen = total > 0 ? Math.max(1, Math.min(99, Math.round((selesai / total) * 100))) : 1;
          setStatusHud({ persen, selesai: false });
        }
      });
      if (!unduhanLayak(hasil, daftarUrl.length)) {
        await hapusTile(hasil.urlBaru);
        setStatusHud(null);
        setGalatUnduh(
          hasil.dihentikan
            ? "Unduhan dibatalkan."
            : hasil.kuotaPenuh
              ? "Penyimpanan perangkat penuh."
              : "Unduhan gagal. Periksa koneksi lalu coba lagi."
        );
        return;
      }
      onSimpanAreaOffline({
        id: buatId("OFF"),
        namaArea: namaAreaOfflineBaru.trim() || `Area 10x10 km #${areaOffline.length + 1}`,
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
      setStatusHud({ persen: 100, selesai: true });
      timerTutupHudRef.current = window.setTimeout(() => {
        setStatusHud(null);
        timerTutupHudRef.current = null;
      }, 5000);
    } catch {
      setStatusHud(null);
      setGalatUnduh("Unduhan gagal. Coba lagi.");
    } finally {
      setSedangMengunduhTile(false);
      setKemajuanUnduh(null);
      batalUnduhRef.current = null;
    }
  };

  return {
    bukaModalOffline,
    setBukaModalOffline,
    bukaModalUnduh,
    namaAreaOfflineBaru,
    setNamaAreaOfflineBaru,
    sedangMengunduhTile,
    pusatUnduh,
    zoomMinUnduh,
    zoomMaksUnduh,
    kemajuanUnduh,
    statusHud,
    galatUnduh,
    sumberUnduh,
    jumlahTileUnduh,
    kelebihanTile,
    bisaUnduh,
    handleUnduhAreaOffline,
    batalkanUnduhan: () => batalUnduhRef.current?.abort()
  };
}

interface UnduhOfflineModalProps {
  basemap: BasemapType;
  areaOffline: AreaPetaOffline[];
  unduh: ReturnType<typeof useUnduhAreaOffline>;
  onBukaArea: (pusat: { lat: number; lng: number }) => void;
}

const RADIUS_HOLD = 62;
const KELILING_HOLD = 2 * Math.PI * RADIUS_HOLD;

export const UnduhOfflineModal: React.FC<UnduhOfflineModalProps> = ({ basemap, areaOffline, unduh, onBukaArea }) => {
  const {
    setBukaModalOffline,
    namaAreaOfflineBaru,
    setNamaAreaOfflineBaru,
    sedangMengunduhTile,
    pusatUnduh,
    zoomMaksUnduh,
    galatUnduh,
    sumberUnduh,
    jumlahTileUnduh,
    bisaUnduh,
    handleUnduhAreaOffline,
    batalkanUnduhan
  } = unduh;

  const [holdRasio, setHoldRasio] = useState(0);
  const [sedangTahan, setSedangTahan] = useState(false);
  const timerHoldRef = useRef<number | null>(null);
  const mulaiHoldRef = useRef<number>(0);
  const terpicuRef = useRef<boolean>(false);

  const hentikanTahan = () => {
    if (timerHoldRef.current !== null) {
      window.clearInterval(timerHoldRef.current);
      timerHoldRef.current = null;
    }
    setSedangTahan(false);
    setHoldRasio(0);
  };

  useEffect(() => () => hentikanTahan(), []);

  const mulaiTahan = () => {
    if (!bisaUnduh || sedangMengunduhTile || timerHoldRef.current !== null) return;
    terpicuRef.current = false;
    mulaiHoldRef.current = Date.now();
    setSedangTahan(true);
    setHoldRasio(0.02);
    timerHoldRef.current = window.setInterval(() => {
      const berlalu = Date.now() - mulaiHoldRef.current;
      const rasio = Math.min(1, berlalu / DURASI_TAHAN_UNDUH_MS);
      setHoldRasio(rasio);
      if (rasio >= 1 && !terpicuRef.current) {
        terpicuRef.current = true;
        hentikanTahan();
        void handleUnduhAreaOffline();
      }
    }, 30);
  };

  const detikTersisa = Math.max(1, Math.ceil(((1 - holdRasio) * DURASI_TAHAN_UNDUH_MS) / 1000));
  const perkiraanMb = basemap !== "taktis" ? perkiraanUkuranMb(jumlahTileUnduh, basemap) : 0;

  return (
    <div className="modal-backdrop" onClick={() => setBukaModalOffline(false)}>
      <div className="modal-card unduh-offline-card" onClick={(e) => e.stopPropagation()}>
        <div className="unduh-hero-banner">
          <div className="unduh-hero-top">
            <span className="unduh-hero-badge">
              <Layers size={13} /> {basemap === "taktis" ? "Peta Taktis" : sumberUnduh?.nama}
            </span>
            <button type="button" className="unduh-close-btn" aria-label="Tutup" onClick={() => setBukaModalOffline(false)}>
              <X size={18} />
            </button>
          </div>
          <h3>Unduh Peta Offline</h3>
          {pusatUnduh && (
            <div className="unduh-hero-coord">
              <Compass size={13} />
              <span>
                {pusatUnduh.lat.toFixed(5)}°, {pusatUnduh.lng.toFixed(5)}°
              </span>
            </div>
          )}
        </div>

        <div className="unduh-offline-body">
          <div className="unduh-stats-grid">
            <div className="unduh-stat-tile">
              <Maximize2 size={16} />
              <strong>10 × 10 km</strong>
              <small>Jangkauan</small>
            </div>
            <div className="unduh-stat-tile">
              <ZoomIn size={16} />
              <strong>{zoomMaksUnduh}x</strong>
              <small>Ketelitian</small>
            </div>
            <div className="unduh-stat-tile" id="perkiraan-unduh">
              <HardDrive size={16} />
              <strong>{jumlahTileUnduh} tile</strong>
              <small>~{perkiraanMb.toFixed(1)} MB</small>
            </div>
          </div>

          <input
            type="text"
            className="form-input unduh-nama-input"
            placeholder="Masukkan nama area"
            value={namaAreaOfflineBaru}
            onChange={(e) => setNamaAreaOfflineBaru(e.target.value)}
          />

          <div className="unduh-hold-stage">
            <button
              type="button"
              className={`unduh-hold-circle ${sedangTahan ? "sedang-tahan" : ""} ${!bisaUnduh ? "nonaktif" : ""}`}
              disabled={!bisaUnduh || sedangMengunduhTile}
              aria-label="Tahan 3 detik untuk unduh peta 10x10 km"
              onPointerDown={mulaiTahan}
              onPointerUp={hentikanTahan}
              onPointerLeave={hentikanTahan}
              onPointerCancel={hentikanTahan}
              onTouchStart={mulaiTahan}
              onTouchEnd={hentikanTahan}
              onTouchCancel={hentikanTahan}
            >
              <svg className="unduh-hold-svg" viewBox="0 0 152 152" aria-hidden="true">
                <circle className="unduh-hold-track" cx="76" cy="76" r={RADIUS_HOLD} />
                <circle
                  className="unduh-hold-arc"
                  cx="76"
                  cy="76"
                  r={RADIUS_HOLD}
                  strokeDasharray={KELILING_HOLD}
                  strokeDashoffset={KELILING_HOLD * (1 - holdRasio)}
                />
              </svg>
              <div className="unduh-hold-core">
                <Download size={28} />
                <strong>{sedangTahan ? `${detikTersisa}d` : "Tahan 3 Detik"}</strong>
                <span>{sedangTahan ? "Mengunci…" : "10×10 km · 20x"}</span>
              </div>
            </button>
          </div>

          {sedangMengunduhTile && (
            <button type="button" className="btn-outline-sm" onClick={batalkanUnduhan}>
              Batalkan
            </button>
          )}

          {galatUnduh && (
            <p className="field-error" role="alert" style={{ margin: 0, textAlign: "center" }}>
              {galatUnduh}
            </p>
          )}

          {areaOffline.length > 0 && (
            <div className="offline-list" style={{ marginTop: 4 }}>
              {areaOffline.map((a) => (
                <div key={a.id} className="offline-item">
                  <div>
                    <strong>{a.namaArea}</strong>
                    <small>
                      {a.jumlahTile.toLocaleString("id-ID")} tile · {a.ukuranMb} MB
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn-outline-sm"
                    onClick={() => {
                      onBukaArea({
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
  );
};

export function ikonSelesaiUnduh() {
  return <Check size={12} strokeWidth={3} />;
}
