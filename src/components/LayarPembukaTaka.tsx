import React, { useEffect, useState } from "react";

interface LayarPembukaTakaProps {
  onSelesai: () => void;
}

const KUNCI_SPLASH_SESI = "geokader_taka_splash_tampil_v1";

export function sudahTampilSplashTakaSesiIni(): boolean {
  if (import.meta.env.MODE === "test") return true;
  try {
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
 * Layar Pembuka (Splash Screen) Interaktif Maskot TAKA
 * Menyesuaikan video secara otomatis:
 * - Mobile / HP (Portrait): `./taka/taka_splash_portrait.mp4`
 * - PC / Tablet / Landscape: `./taka/taka_splash_landscape.mp4`
 */
export const LayarPembukaTaka: React.FC<LayarPembukaTakaProps> = ({ onSelesai }) => {
  const [landscape, setLandscape] = useState<boolean>(() => deteksiModeLayarLandscape());
  const [keluar, setKeluar] = useState<boolean>(false);
  const [videoGagal, setVideoGagal] = useState<boolean>(false);

  const tutupSplash = React.useCallback(() => {
    tandaiSplashTakaSudahTampil();
    setKeluar(true);
    window.setTimeout(() => {
      onSelesai();
    }, 280);
  }, [onSelesai]);

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

  // Batas waktu aman otomatis agar layar pembuka tidak pernah menahan pengguna terlalu lama
  useEffect(() => {
    const timer = window.setTimeout(() => {
      tutupSplash();
    }, 5500);
    return () => window.clearTimeout(timer);
  }, [tutupSplash]);

  const sumberVideo = landscape ? "./taka/taka_splash_landscape.mp4" : "./taka/taka_splash_portrait.mp4";

  return (
    <div
      id="layar-pembuka-taka"
      className={`taka-splash-overlay ${landscape ? "mode-pc" : "mode-mobile"} ${keluar ? "fade-out" : ""}`}
      role="dialog"
      aria-label="Layar Pembuka Titik Tapak bersama Maskot Taka"
    >
      <div className="taka-splash-stage">
        <div className="taka-splash-video-frame">
          {!videoGagal ? (
            <video
              key={sumberVideo}
              id="video-splash-taka"
              className="taka-splash-video"
              src={sumberVideo}
              poster="./taka/taka_avatar_512.png"
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={tutupSplash}
              onError={() => setVideoGagal(true)}
            />
          ) : (
            <div className="taka-splash-fallback">
              <img src="./taka/taka_master.png" alt="Maskot Taka Titik Tapak" className="taka-splash-fallback-img" />
            </div>
          )}

          <div className="taka-splash-gradient" />

          <div className="taka-splash-hud">
            <div className="taka-splash-brand">
              <img src="./taka/taka_avatar_256.png" alt="Taka" className="taka-splash-avatar" />
              <div className="taka-splash-text">
                <div className="taka-splash-badge">MASKOT RESMI • TAKA</div>
                <h2>Titik Tapak</h2>
                <p>Setiap titik punya cerita, setiap tapak punya makna.</p>
              </div>
            </div>

            <button
              type="button"
              id="lewati-splash-taka"
              className="taka-splash-skip-btn"
              onClick={tutupSplash}
            >
              Lanjut ▸
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
