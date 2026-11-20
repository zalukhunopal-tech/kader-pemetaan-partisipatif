import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download } from "lucide-react";
import { AreaPetaOffline, BasemapType } from "../../types";
import { buatId } from "../../lib/id";
import { hitungKotakKm } from "../../lib/cachePetaOtomatis";
import {
  BATAS_TILE_PER_AREA,
  CakupanOverlayOffline,
  KotakWilayah,
  SUMBER_TILE,
  TileXYZ,
  daftarTile,
  hapusTile,
  isiTemplateTile,
  penyimpananTileDidukung,
  simpanCakupanOverlayOffline,
  sumberUnduhOfflineEfektif,
  unduhTile,
  unduhanLayak
} from "../../lib/petaOffline";

export const DURASI_TAHAN_UNDUH_MS = 3000;
export const JANGKAUAN_UNDUH_KM = 10;
export const ZOOM_MAKS_UNDUH_OFFLINE = 20;
export const ZOOM_MIN_UNDUH_OFFLINE = 10;

export interface StatusHudUnduh {
  persen: number;
  selesai: boolean;
}

/**
 * Menyusun piramida tile berpusat di titik bidik untuk area 10 x 10 km sampai ketelitian zoom 20x:
 * - 10 x 10 km penuh pada zoom 10..15 (orientasi & navigasi koridor luas)
 * - 4 x 4 km menengah pada zoom 16..17
 * - 1.5 x 1.5 km detail pada zoom 18
 * - 0.5 x 0.5 km presisi tinggi di pusat area pada zoom 19..20 (atau batas zoom penyedia)
 */
export function daftarTilePiramida10KmZoom20(latPusat: number, lngPusat: number, zoomMaksSumber: number): TileXYZ[] {
  const zMaxEfektif = Math.min(ZOOM_MAKS_UNDUH_OFFLINE, Math.max(18, zoomMaksSumber));
  const lapisan: { sisiKm: number; zMin: number; zMax: number }[] = [
    { sisiKm: 10, zMin: ZOOM_MIN_UNDUH_OFFLINE, zMax: Math.min(15, zMaxEfektif) },
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
 * Keadaan pengunduh peta offline. Hasil unduhan langsung menjadi overlay citra halus
 * di Peta Interaktif tanpa membuat lapisan atau item peta tersendiri.
 */
export function useUnduhAreaOffline(
  basemap: BasemapType,
  _areaOffline: AreaPetaOffline[],
  _onSimpanAreaOffline?: (area: AreaPetaOffline) => void,
  onPesanStatus?: (pesan: string) => void,
  onOverlayTersimpan?: (cakupan: CakupanOverlayOffline) => void
) {
  const [bukaModalOffline, setBukaModalOffline] = useState<boolean>(false);
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

  /** Membuka tombol lingkaran tahan 3 detik untuk area 10 x 10 km di pusat tampilan peta. */
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
  const sumberEfektif = useMemo(() => sumberUnduhOfflineEfektif(basemap), [basemap]);
  const daftarTileTarget = useMemo(() => {
    if (!pusatUnduh || !sumberEfektif) return [];
    return daftarTilePiramida10KmZoom20(pusatUnduh.lat, pusatUnduh.lng, sumberEfektif.zoomMaks);
  }, [pusatUnduh, sumberEfektif]);

  const jumlahTileUnduh = daftarTileTarget.length;
  const kelebihanTile = jumlahTileUnduh > BATAS_TILE_PER_AREA;
  const bisaUnduh = sumberEfektif !== null && penyimpananTileDidukung() && jumlahTileUnduh > 0 && !kelebihanTile;

  const handleUnduhAreaOffline = async () => {
    if (!bisaUnduh || !kotakUnduh || !sumberEfektif || basemap === "taktis" || sedangMengunduhTile) return;
    if (timerTutupHudRef.current !== null) {
      window.clearTimeout(timerTutupHudRef.current);
      timerTutupHudRef.current = null;
    }

    const daftarUrl: string[] = [];
    const cadanganPerUrl = new Map<string, string[]>();
    for (const t of daftarTileTarget) {
      const utama = isiTemplateTile(sumberEfektif.template, t.z, t.x, t.y);
      if (!utama) continue;
      daftarUrl.push(utama);
      if (sumberEfektif.templateCadangan.length > 0) {
        const cad = sumberEfektif.templateCadangan
          .map((tpl) => isiTemplateTile(tpl, t.z, t.x, t.y))
          .filter((u): u is string => Boolean(u) && u !== utama);
        if (cad.length > 0) cadanganPerUrl.set(utama, cad);
      }
    }

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
        pembuatUrlCadangan: (u) => cadanganPerUrl.get(u) ?? [],
        onKemajuan: (selesai, total, gagal) => {
          setKemajuanUnduh({ selesai, total, gagal });
          const persen = total > 0 ? Math.max(1, Math.min(99, Math.round((selesai / total) * 100))) : 1;
          setStatusHud({ persen, selesai: false });
        }
      });
      if (!unduhanLayak(hasil, daftarUrl.length)) {
        await hapusTile(hasil.urlBaru);
        setStatusHud(null);
        const pesanGagal = hasil.dihentikan
          ? "Unduhan dibatalkan."
          : hasil.kuotaPenuh
            ? "Penyimpanan perangkat penuh."
            : "Unduhan citra gagal. Periksa koneksi lalu coba lagi.";
        setGalatUnduh(pesanGagal);
        onPesanStatus?.(pesanGagal);
        return;
      }

      // Simpan langsung sebagai overlay citra offline di Peta Interaktif tanpa membuat lapisan/item peta tersendiri
      const jumlahTersimpan = hasil.tersimpan + hasil.sudahAda;
      const zoomMaxTersimpan = Math.min(zoomMaksUnduh, sumberEfektif.zoomMaks);
      const cakupanBaru: CakupanOverlayOffline = {
        id: buatId("OVL"),
        basemapId: sumberEfektif.basemapEfektif,
        ...kotakUnduh,
        zoomMin: zoomMinUnduh,
        zoomMax: zoomMaxTersimpan,
        templateTile: sumberEfektif.template,
        jumlahTile: jumlahTersimpan,
        ukuranMb: Number((hasil.byte / 1_000_000).toFixed(2)),
        diunduhPada: new Date().toISOString()
      };
      simpanCakupanOverlayOffline(cakupanBaru);
      onOverlayTersimpan?.(cakupanBaru);

      setStatusHud({ persen: 100, selesai: true });
      onPesanStatus?.("Citra offline siap dipakai langsung di Peta Interaktif.");
      timerTutupHudRef.current = window.setTimeout(() => {
        setStatusHud(null);
        timerTutupHudRef.current = null;
      }, 4500);
    } catch {
      setStatusHud(null);
      const pesan = "Unduhan citra offline gagal. Coba lagi.";
      setGalatUnduh(pesan);
      onPesanStatus?.(pesan);
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
    sedangMengunduhTile,
    pusatUnduh,
    zoomMinUnduh,
    zoomMaksUnduh,
    kemajuanUnduh,
    statusHud,
    galatUnduh,
    sumberUnduh,
    sumberEfektif,
    jumlahTileUnduh,
    kelebihanTile,
    bisaUnduh,
    handleUnduhAreaOffline,
    batalkanUnduhan: () => batalUnduhRef.current?.abort()
  };
}

interface UnduhOfflineModalProps {
  unduh: ReturnType<typeof useUnduhAreaOffline>;
}

const RADIUS_HOLD = 62;
const KELILING_HOLD = 2 * Math.PI * RADIUS_HOLD;

/**
 * Tampilan unduh peta offline minimalis: hanya menampilkan lingkaran yang ditekan selama 3 detik
 * tanpa keterangan tambahan atau isian nama peta.
 */
export const UnduhOfflineModal: React.FC<UnduhOfflineModalProps> = ({ unduh }) => {
  const { setBukaModalOffline, sedangMengunduhTile, bisaUnduh, handleUnduhAreaOffline } = unduh;

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

  return (
    <div
      className="modal-backdrop unduh-hold-backdrop"
      role="dialog"
      aria-label="Tahan 3 detik"
      onClick={() => setBukaModalOffline(false)}
    >
      <button
        type="button"
        className={`unduh-hold-circle ${sedangTahan ? "sedang-tahan" : ""} ${!bisaUnduh ? "nonaktif" : ""}`}
        disabled={!bisaUnduh || sedangMengunduhTile}
        aria-label="Tahan 3 detik"
        style={{ userSelect: "none", WebkitUserSelect: "none", touchAction: "none" }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
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
          <Download size={32} />
          <strong>{sedangTahan ? `${detikTersisa}d` : "3d"}</strong>
        </div>
      </button>
    </div>
  );
};

export function ikonSelesaiUnduh() {
  return <Check size={12} strokeWidth={3} />;
}
