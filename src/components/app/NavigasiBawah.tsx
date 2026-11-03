import React, { useCallback, useRef } from "react";
import { Folder, Map, MessageSquare, ShieldCheck, User } from "lucide-react";
import { LogoSertifikatResmiSvg } from "../sertifikat/LogoSertifikatResmiSvg";
import { MenuTab, PeranPengguna } from "../../types";

interface NavigasiBawahProps {
  peran: PeranPengguna;
  tabAktif: MenuTab;
  setTabAktif: (tab: MenuTab) => void;
  /** Jumlah data yang belum terunggah (sinkronisasi otomatis berjalan di latar belakang) */
  antreanLokalCount: number;
  onModeUser: () => void;
}

/**
 * Bilah navigasi bawah Titik Tapak
 * Bersih, elegan, tanpa menu sinkronisasi manual karena sinkronisasi 100% otomatis di latar belakang.
 */
export const NavigasiBawah: React.FC<NavigasiBawahProps> = ({ peran, tabAktif, setTabAktif, onModeUser }) => {
  const roNavRef = useRef<ResizeObserver | null>(null);
  const ukurBilahBawah = useCallback((el: HTMLElement | null) => {
    roNavRef.current?.disconnect();
    roNavRef.current = null;
    if (!el) return;
    const atur = () => document.documentElement.style.setProperty("--tinggi-nav", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    atur();
    if (typeof ResizeObserver !== "undefined") {
      roNavRef.current = new ResizeObserver(atur);
      roNavRef.current.observe(el);
    }
  }, []);

  return (
    <nav className="avenza-bottom-nav" ref={ukurBilahBawah}>
      {peran === "kader" ? (
        // NAVIGASI KHUSUS AKUN USER (KADER)
        <>
          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "pustaka" ? "active" : ""}`}
            onClick={() => setTabAktif("pustaka")}
          >
            <Folder size={20} fill={tabAktif === "pustaka" ? "#0d7344" : "none"} />
            <span>Pustaka</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "peta" ? "active" : ""}`}
            onClick={() => setTabAktif("peta")}
          >
            <Map size={20} />
            <span>Temukan</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "reward" ? "active" : ""}`}
            onClick={() => setTabAktif("reward")}
          >
            <LogoSertifikatResmiSvg
              size={21}
              variant={tabAktif === "reward" ? "zamrud" : "monokrom"}
              warna={tabAktif === "reward" ? "#0d7344" : "#64748b"}
            />
            <span>Sertifikat</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "komunikasi" ? "active" : ""}`}
            onClick={() => setTabAktif("komunikasi")}
          >
            <MessageSquare size={20} />
            <span>Diskusi</span>
          </button>
        </>
      ) : (
        // NAVIGASI KHUSUS AKUN ADMIN
        <>
          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "admin" ? "active" : ""}`}
            onClick={() => setTabAktif("admin")}
          >
            <ShieldCheck size={20} color={tabAktif === "admin" ? "#0284c7" : "#64748b"} />
            <span style={{ color: tabAktif === "admin" ? "#0284c7" : "#64748b" }}>Admin</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "peta" ? "active" : ""}`}
            onClick={() => setTabAktif("peta")}
          >
            <Map size={20} />
            <span>Temukan</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "komunikasi" ? "active" : ""}`}
            onClick={() => setTabAktif("komunikasi")}
          >
            <MessageSquare size={20} />
            <span>Diskusi</span>
          </button>

          <button type="button" className="avenza-nav-item" onClick={onModeUser} style={{ color: "#0d7344" }}>
            <User size={20} />
            <span>Mode User</span>
          </button>
        </>
      )}
    </nav>
  );
};
