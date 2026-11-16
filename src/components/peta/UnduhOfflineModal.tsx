import React, { useEffect, useRef, useState } from "react";
import { Check, Download, X } from "lucide-react";
import { AreaPetaOffline, BasemapType } from "../../types";
import { buatId } from "../../lib/id";
import { hitungKotakKm } from "../../lib/cachePetaOtomatis";
import {
  BATAS_TILE_PER_AREA,
  KotakWilayah,
  SUMBER_TILE,
  daftarTile,
  hapusTile,
  hitungJumlahTile,
  isiTemplateTile,
  penyimpananTileDidukung,
  perkiraanUkuranMb,
  unduhTile,
  unduhanLayak
} from "../../lib/petaOffline";

export const DURASI_TAHAN_UNDUH_MS = 3000;
export const ZOOM_MAKS_UNDUH_OFFLINE = 18;
export const ZOOM_MIN_UNDUH_OFFLINE = 14;

export interface StatusHudUnduh {
  persen: number;
  selesai: boolean;
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
 * Keadaan pengunduh peta offline. Dipegang oleh peta (bukan oleh modal) supaya unduhan tetap berjalan
 * setelah modal ditutup dan progres lingkaran tampil langsung di peta interaktif.
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

  /** Membuka panel unduh untuk kotak 1 km x 1 km tepat di pusat layar peta dengan presisi sampai zoom 18. */
  const bukaModalUnduh = (kotak: KotakWilayah, _zoom?: number) => {
    const latPusat = (kotak.minLat + kotak.maxLat) / 2;
    const lngPusat = (kotak.minLng + kotak.maxLng) / 2;
    const kotak1Km = hitungKotakKm(latPusat, lngPusat, 1);
    const sumberAktif = basemap === "taktis" ? null : SUMBER_TILE[basemap];
    const zMax = sumberAktif ? Math.min(ZOOM_MAKS_UNDUH_OFFLINE, Math.max(ZOOM_MAKS_UNDUH_OFFLINE, sumberAktif.zoomMaks)) : ZOOM_MAKS_UNDUH_OFFLINE;
    const zMin = Math.max(13, zMax - 4);
    setKotakUnduh(kotak1Km);
    setZoomMinUnduh(zMin);
    setZoomMaksUnduh(zMax);
    setGalatUnduh(null);
    setKemajuanUnduh(null);
    setBukaModalOffline(true);
  };

  const sumberUnduh = basemap === "taktis" ? null : SUMBER_TILE[basemap];
  const jumlahTileUnduh = kotakUnduh && basemap !== "taktis" ? hitungJumlahTile(kotakUnduh, zoomMinUnduh, zoomMaksUnduh) : 0;
  const kelebihanTile = jumlahTileUnduh > BATAS_TILE_PER_AREA;
  const bisaUnduh = sumberUnduh !== null && penyimpananTileDidukung() && jumlahTileUnduh > 0 && !kelebihanTile;

  const handleUnduhAreaOffline = async () => {
    if (!bisaUnduh || !kotakUnduh || !sumberUnduh || basemap === "taktis" || sedangMengunduhTile) return;
    if (timerTutupHudRef.current !== null) {
      window.clearTimeout(timerTutupHudRef.current);
      timerTutupHudRef.current = null;
    }

    const daftarUrl = daftarTile(kotakUnduh, zoomMinUnduh, zoomMaksUnduh)
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
        namaArea: namaAreaOfflineBaru.trim() || `Area 1x1 km #${areaOffline.length + 1}`,
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

const RADIUS_HOLD = 58;
const KELILING_HOLD = 2 * Math.PI * RADIUS_HOLD;

export const UnduhOfflineModal: React.FC<UnduhOfflineModalProps> = ({ basemap, areaOffline, unduh, onBukaArea }) => {
  const {
    setBukaModalOffline,
    namaAreaOfflineBaru,
    setNamaAreaOfflineBaru,
    sedangMengunduhTile,
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
        <div className="modal-header">
          <h3>Unduh Peta Offline</h3>
          <button type="button" className="btn-icon-close" aria-label="Tutup" onClick={() => setBukaModalOffline(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="unduh-offline-body">
          <div className="unduh-chip-ringkas">
            <span>{basemap === "taktis" ? "Peta Taktis" : sumberUnduh?.nama}</span>
            <span>·</span>
            <strong>1 × 1 km</strong>
            <span>·</span>
            <span id="perkiraan-unduh">
              Zoom {zoomMaksUnduh}x ({jumlahTileUnduh} tile · ~{perkiraanMb.toFixed(1)} MB)
            </span>
          </div>

          <input
            type="text"
            className="form-input"
            placeholder="Masukkan nama area"
            value={namaAreaOfflineBaru}
            onChange={(e) => setNamaAreaOfflineBaru(e.target.value)}
          />

          <div className="unduh-hold-stage">
            <button
              type="button"
              className={`unduh-hold-circle ${sedangTahan ? "sedang-tahan" : ""} ${!bisaUnduh ? "nonaktif" : ""}`}
              disabled={!bisaUnduh || sedangMengunduhTile}
              aria-label="Tahan 3 detik untuk unduh peta 1x1 km"
              onPointerDown={mulaiTahan}
              onPointerUp={hentikanTahan}
              onPointerLeave={hentikanTahan}
              onPointerCancel={hentikanTahan}
              onTouchStart={mulaiTahan}
              onTouchEnd={hentikanTahan}
              onTouchCancel={hentikanTahan}
            >
              <svg className="unduh-hold-svg" viewBox="0 0 140 140" aria-hidden="true">
                <circle className="unduh-hold-track" cx="70" cy="70" r={RADIUS_HOLD} />
                <circle
                  className="unduh-hold-arc"
                  cx="70"
                  cy="70"
                  r={RADIUS_HOLD}
                  strokeDasharray={KELILING_HOLD}
                  strokeDashoffset={KELILING_HOLD * (1 - holdRasio)}
                />
              </svg>
              <div className="unduh-hold-core">
                <Download size={26} />
                <strong>{sedangTahan ? `${detikTersisa}d` : "Tahan 3 Detik"}</strong>
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
