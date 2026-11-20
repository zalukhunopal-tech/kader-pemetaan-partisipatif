import { useEffect, useRef, useState } from "react";
import { AreaPetaOffline, BasemapType } from "../types";
import {
  EVENT_OVERLAY_OFFLINE_DIPERBARUI,
  MAKS_SLOT_CACHE_OTOMATIS,
  SlotCachePetaOtomatis,
  TUNDA_UNDUH_OTOMATIS_MS,
  cariSlotMencakup,
  jalankanAutoCache10Km,
  muatSlotAutoCache,
  perluPerbaruiCacheOtomatis
} from "./cachePetaOtomatis";
import { basemapBawaan } from "./petaOffline";
import { EVENT_POSISI_PETA_DIPERBARUI, POSISI_AWAL_PETA, bacaPosisiPeta } from "./posisiPeta";

export type FaseUnduhOtomatis = "siap" | "menunggu" | "mengunduh" | "belum_offline" | "gagal";

export interface StatusNotifCitraOffline {
  fase: FaseUnduhOtomatis;
  /** true jika lokasi user saat ini belum diunduh atau sudah melewati 30 hari */
  perluPeringatan: boolean;
  /** Persentase unduhan 0..100 */
  persen: number;
  tileSelesai: number;
  tileTotal: number;
  /** Sisa detik tunggu (dari 180 detik / 3 menit) */
  sisaDetikTunggu: number;
  totalDetikTunggu: number;
  posisi: { lat: number; lng: number };
  daftarKotak: SlotCachePetaOtomatis[];
  kotakAktif: SlotCachePetaOtomatis | null;
  maksKotak: number;
  pesanGalat?: string;
}

export interface OpsiUnduhPetaOtomatis {
  aktif: boolean;
  sedangOnline: boolean;
  areaOffline: AreaPetaOffline[];
  basemap?: BasemapType;
  /** Posisi eksternal opsional (mis. untuk uji otomatis) */
  posisiAwal?: { lat: number; lng: number };
  /** Jeda tunggu sebelum mulai mengunduh otomatis (bawaan 3 menit) */
  tundaMs?: number;
}

export function formatHitungMundur(detik: number): string {
  const d = Math.max(0, Math.ceil(detik));
  const menit = Math.floor(d / 60);
  const sisa = d % 60;
  return `${menit}:${String(sisa).padStart(2, "0")}`;
}

/**
 * Mengelola pengunduhan citra peta offline otomatis 10 x 10 km saat aplikasi dibuka:
 * - Menunggu 3 menit agar posisi GPS/peta menyesuaikan lokasi terkini user.
 * - Menyimpan hingga 3 kotak persegi 10 x 10 km (overlap diperbolehkan), bertahan 30 hari.
 * - Menyediakan status peringatan & progres untuk notifikasi di sebelah indikator jaringan.
 */
export function useUnduhPetaOtomatis({
  aktif,
  sedangOnline,
  areaOffline,
  basemap: basemapProp,
  posisiAwal,
  tundaMs = TUNDA_UNDUH_OTOMATIS_MS
}: OpsiUnduhPetaOtomatis): StatusNotifCitraOffline {
  const totalDetikTunggu = Math.max(1, Math.ceil(tundaMs / 1000));

  const [posisi, setPosisi] = useState<{ lat: number; lng: number }>(() => {
    if (posisiAwal) return posisiAwal;
    const tersimpan = bacaPosisiPeta();
    return tersimpan ? { lat: tersimpan.lat, lng: tersimpan.lng } : POSISI_AWAL_PETA;
  });

  const [basemapAktif, setBasemapAktif] = useState<BasemapType>(() => {
    if (basemapProp && basemapProp !== "taktis") return basemapProp;
    const tersimpan = bacaPosisiPeta()?.basemap;
    return tersimpan && tersimpan !== "taktis" ? tersimpan : basemapBawaan();
  });

  const [daftarKotak, setDaftarKotak] = useState<SlotCachePetaOtomatis[]>(() => muatSlotAutoCache());
  const [fase, setFase] = useState<FaseUnduhOtomatis>(() => {
    const awal = posisiAwal ?? bacaPosisiPeta() ?? POSISI_AWAL_PETA;
    const bm = basemapProp && basemapProp !== "taktis" ? basemapProp : basemapBawaan();
    const butuh = perluPerbaruiCacheOtomatis(muatSlotAutoCache(), bm, awal.lat, awal.lng);
    if (!butuh) return "siap";
    return sedangOnline ? "menunggu" : "belum_offline";
  });
  const [persen, setPersen] = useState<number>(0);
  const [tileSelesai, setTileSelesai] = useState<number>(0);
  const [tileTotal, setTileTotal] = useState<number>(0);
  const [sisaDetikTunggu, setSisaDetikTunggu] = useState<number>(totalDetikTunggu);
  const [pesanGalat, setPesanGalat] = useState<string | undefined>(undefined);
  const [tikEvaluasi, setTikEvaluasi] = useState<number>(0);

  const posisiRef = useRef(posisi);
  posisiRef.current = posisi;
  const basemapRef = useRef(basemapAktif);
  basemapRef.current = basemapAktif;
  const areaOfflineRef = useRef(areaOffline);
  areaOfflineRef.current = areaOffline;
  const gpsNyataAdaRef = useRef<boolean>(false);

  const sedangMengunduhRef = useRef<boolean>(false);
  const sedangMenungguRef = useRef<boolean>(false);
  const timerTundaRef = useRef<number | null>(null);
  const intervalMundurRef = useRef<number | null>(null);
  const timerUlangRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const aktifRef = useRef<boolean>(aktif);
  aktifRef.current = aktif;
  const onlineRef = useRef<boolean>(sedangOnline);
  onlineRef.current = sedangOnline;

  const bersihkanTimer = () => {
    if (timerTundaRef.current !== null) {
      window.clearTimeout(timerTundaRef.current);
      timerTundaRef.current = null;
    }
    if (intervalMundurRef.current !== null) {
      window.clearInterval(intervalMundurRef.current);
      intervalMundurRef.current = null;
    }
    if (timerUlangRef.current !== null) {
      window.clearTimeout(timerUlangRef.current);
      timerUlangRef.current = null;
    }
    sedangMenungguRef.current = false;
  };

  // Sinkronkan posisiAwal bila diberikan secara eksplisit
  useEffect(() => {
    if (posisiAwal) {
      setPosisi(posisiAwal);
    }
  }, [posisiAwal?.lat, posisiAwal?.lng]);

  useEffect(() => {
    if (basemapProp && basemapProp !== "taktis") {
      setBasemapAktif(basemapProp);
    }
  }, [basemapProp]);

  // Pantau GPS perangkat agar selalu menyesuaikan posisi terkini user saat membuka aplikasi
  useEffect(() => {
    if (!aktif || typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    let watchId: number | null = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            gpsNyataAdaRef.current = true;
            setPosisi({ lat, lng });
          }
        },
        () => {
          // GPS ditolak/tidak tersedia: tetap pakai posisi peta terakhir
        },
        { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 }
      );
    } catch {
      // Abaikan bila geolocation tidak didukung di lingkungan uji
    }
    return () => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {
          // Abaikan
        }
      }
    };
  }, [aktif]);

  // Dengarkan perubahan posisi peta & pembaruan overlay
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saatPosisiPeta = (e: Event) => {
      const detail = (e as CustomEvent<{ lat?: number; lng?: number; basemap?: BasemapType }>).detail;
      if (!detail) return;
      if (detail.basemap && detail.basemap !== "taktis") {
        setBasemapAktif(detail.basemap);
      }
      if (!gpsNyataAdaRef.current && typeof detail.lat === "number" && typeof detail.lng === "number") {
        setPosisi({ lat: detail.lat, lng: detail.lng });
      }
    };
    const saatOverlayBaru = () => {
      setDaftarKotak(muatSlotAutoCache());
    };
    window.addEventListener(EVENT_POSISI_PETA_DIPERBARUI, saatPosisiPeta);
    window.addEventListener(EVENT_OVERLAY_OFFLINE_DIPERBARUI, saatOverlayBaru);
    return () => {
      window.removeEventListener(EVENT_POSISI_PETA_DIPERBARUI, saatPosisiPeta);
      window.removeEventListener(EVENT_OVERLAY_OFFLINE_DIPERBARUI, saatOverlayBaru);
    };
  }, []);

  // Pemeriksaan berkala tiap 60 detik untuk mendeteksi masa berlaku 30 hari yang berakhir saat aplikasi terbuka
  useEffect(() => {
    if (!aktif) return;
    const id = window.setInterval(() => {
      setDaftarKotak(muatSlotAutoCache());
      setTikEvaluasi((t) => t + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [aktif]);

  // Siklus evaluasi otomatis: cek cakupan 10x10 km (<30 hari) -> tunggu 3 menit -> unduh otomatis
  useEffect(() => {
    if (!aktif) {
      bersihkanTimer();
      abortRef.current?.abort();
      abortRef.current = null;
      sedangMengunduhRef.current = false;
      return;
    }

    const slotsSekarang = muatSlotAutoCache();
    setDaftarKotak(slotsSekarang);
    const butuhUnduh = perluPerbaruiCacheOtomatis(slotsSekarang, basemapAktif, posisi.lat, posisi.lng);

    if (!butuhUnduh) {
      bersihkanTimer();
      if (!sedangMengunduhRef.current) {
        setFase("siap");
        setPersen(100);
        setPesanGalat(undefined);
      }
      return;
    }

    if (!sedangOnline) {
      bersihkanTimer();
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      sedangMengunduhRef.current = false;
      setFase("belum_offline");
      setPersen(0);
      setPesanGalat(undefined);
      return;
    }

    // Jika sedang mengunduh atau sudah dalam hitung mundur 3 menit, biarkan berlanjut memakai posisiRef terbaru
    if (sedangMengunduhRef.current || sedangMenungguRef.current) {
      return;
    }

    // Mulai fase tunggu 3 menit agar posisi user menyesuaikan posisi terkini
    sedangMenungguRef.current = true;
    const selesaiTungguPada = Date.now() + tundaMs;
    setFase("menunggu");
    setPersen(0);
    setTileSelesai(0);
    setTileTotal(0);
    setPesanGalat(undefined);
    setSisaDetikTunggu(totalDetikTunggu);

    intervalMundurRef.current = window.setInterval(() => {
      const sisa = Math.max(0, Math.ceil((selesaiTungguPada - Date.now()) / 1000));
      setSisaDetikTunggu(sisa);
    }, 1000);

    timerTundaRef.current = window.setTimeout(() => {
      bersihkanTimer();
      if (!aktifRef.current || !onlineRef.current) return;

      const posisiTerbaru = posisiRef.current;
      const bmTerbaru = basemapRef.current;
      const slotsTerbaru = muatSlotAutoCache();
      if (!perluPerbaruiCacheOtomatis(slotsTerbaru, bmTerbaru, posisiTerbaru.lat, posisiTerbaru.lng)) {
        setDaftarKotak(slotsTerbaru);
        setFase("siap");
        setPersen(100);
        return;
      }

      const ac = new AbortController();
      abortRef.current = ac;
      sedangMengunduhRef.current = true;
      setFase("mengunduh");
      setPersen(1);
      setTileSelesai(0);
      setTileTotal(0);
      setPesanGalat(undefined);

      void jalankanAutoCache10Km({
        basemap: bmTerbaru,
        lat: posisiTerbaru.lat,
        lng: posisiTerbaru.lng,
        online: true,
        areaOffline: areaOfflineRef.current,
        sinyal: ac.signal,
        onKemajuan: (selesai, total) => {
          setTileSelesai(selesai);
          setTileTotal(total);
          const p = total > 0 ? Math.max(1, Math.min(99, Math.round((selesai / total) * 100))) : 1;
          setPersen(p);
        }
      })
        .then((hasil) => {
          sedangMengunduhRef.current = false;
          abortRef.current = null;
          const terbaru = muatSlotAutoCache();
          setDaftarKotak(terbaru);
          if (hasil.status === "diperbarui" || hasil.status === "segar") {
            setFase("siap");
            setPersen(100);
            setPesanGalat(undefined);
          } else if (hasil.status === "gagal") {
            setFase("gagal");
            setPersen(0);
            setPesanGalat("Unduhan citra tertunda karena jaringan. Mencoba ulang otomatis.");
            if (aktifRef.current && onlineRef.current) {
              timerUlangRef.current = window.setTimeout(() => {
                timerUlangRef.current = null;
                setTikEvaluasi((t) => t + 1);
              }, tundaMs);
            }
          } else if (!onlineRef.current) {
            setFase("belum_offline");
          }
        })
        .catch(() => {
          sedangMengunduhRef.current = false;
          abortRef.current = null;
          setFase("gagal");
          setPersen(0);
          setPesanGalat("Unduhan citra tertunda. Mencoba ulang otomatis.");
        });
    }, tundaMs);
  }, [aktif, sedangOnline, posisi.lat, posisi.lng, basemapAktif, tundaMs, totalDetikTunggu, tikEvaluasi]);

  // Bersihkan seluruh timer & unduhan hanya saat hook dilepas
  useEffect(
    () => () => {
      bersihkanTimer();
      abortRef.current?.abort();
      abortRef.current = null;
      sedangMengunduhRef.current = false;
    },
    []
  );

  const kotakAktif = cariSlotMencakup(daftarKotak, basemapAktif, posisi.lat, posisi.lng, true) ?? null;
  const perluPeringatan = kotakAktif === null;

  return {
    fase: kotakAktif ? "siap" : fase,
    perluPeringatan,
    persen: kotakAktif ? 100 : persen,
    tileSelesai,
    tileTotal,
    sisaDetikTunggu,
    totalDetikTunggu,
    posisi,
    daftarKotak,
    kotakAktif,
    maksKotak: MAKS_SLOT_CACHE_OTOMATIS,
    pesanGalat
  };
}
