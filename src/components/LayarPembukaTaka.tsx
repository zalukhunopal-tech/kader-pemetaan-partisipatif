import React, { useEffect, useState } from "react";
import { LogoTitikTapak } from "./LogoTitikTapak";

interface LayarPembukaTakaProps {
  onSelesai: () => void;
}

const KUNCI_SPLASH_SESI = "geokader_taka_splash_tampil_v1";

export function sudahTampilSplashTakaSesiIni(): boolean {
  if (import.meta.env.MODE === "test") return true;
  try {
    // Pada mode PWA terpasang (Android/iOS standalone), sistem operasi sudah menampilkan layar pembuka bawaan
    // sehingga layar pembuka React tidak ditampilkan ulang (mencegah logo muncul dua kali)
    const adalahStandalone =
      typeof window !== "undefined" &&
      ((typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (adalahStandalone) return true;
    return sessionStorage.getItem(KUNCI_SPLASH_SESI) === "1";
  } catch {
    return false;
  }
}

export function tandaiSplashTakaSudahTampil(): void {
  try {
    sessionStorage.setItem(KUNCI_SPLASH_SESI, "1");
  } catch {
    // abaikan bila sessionStorage dibatasi
  }
}

function deteksiModeLayarLandscape(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(min-width: 768px)").matches;
}

/**
 * Layar Pembuka (Splash Screen) Aplikasi Titik Tapak
 * Latar hitam pekat keseluruhan (#000000) dengan logo aplikasi di tengah tanpa garis tepi putih
 * dan label tunggal "Titik Tapak" dengan tipografi tebal dan estetik.
 */
export const LayarPembukaTaka: React.FC<LayarPembukaTakaProps> = ({ onSelesai }) => {
  const [landscape, setLandscape] = useState<boolean>(() => deteksiModeLayarLandscape());
  const [keluar, setKeluar] = useState<boolean>(false);

  // onSelesai dari induk adalah fungsi baru di setiap render; disimpan di ref supaya pewaktu tutup
  // otomatis tidak diulang dari nol setiap kali aplikasi menggambar ulang (dulu layar pembuka bisa
  // menutupi layar Buat PIN tanpa batas waktu setelah masuk).
  const onSelesaiRef = React.useRef(onSelesai);
  useEffect(() => {
    onSelesaiRef.current = onSelesai;
  }, [onSelesai]);
  const sudahDitutup = React.useRef(false);

  const tutupSplash = React.useCallback(() => {
    if (sudahDitutup.current) return;
    sudahDitutup.current = true;
    tandaiSplashTakaSudahTampil();
    setKeluar(true);
    window.setTimeout(() => {
      onSelesaiRef.current();
    }, 260);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const ubah = () => setLandscape(mq.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", ubah);
      return () => mq.removeEventListener("change", ubah);
    }
    return undefined;
  }, []);

  // Otomatis masuk ke aplikasi setelah layar pembuka tampil singkat
  useEffect(() => {
    const timer = window.setTimeout(() => {
      tutupSplash();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [tutupSplash]);

  const sumberVideo = landscape ? "./taka/taka_splash_landscape.mp4" : "./taka/taka_splash_portrait.mp4";

  return (
    <div
      id="layar-pembuka-taka"
      className={`taka-splash-overlay ${landscape ? "mode-pc" : "mode-mobile"} ${keluar ? "fade-out" : ""}`}
      role="dialog"
      aria-label="Layar Pembuka Titik Tapak"
      onClick={tutupSplash}
    >
      <div className="taka-splash-stage">
        <div className="taka-splash-video-frame">
          <video
            key={sumberVideo}
            id="video-splash-taka"
            className="taka-splash-video"
            src={sumberVideo}
            muted
            playsInline
            preload="none"
            aria-hidden="true"
          />

          <div className="taka-splash-center-brand">
            <LogoTitikTapak size={112} withBackground={false} className="taka-splash-logo" />
            <h1 className="taka-splash-title brand-title-estetik">Titik Tapak</h1>
          </div>
        </div>
      </div>
    </div>
  );
};
