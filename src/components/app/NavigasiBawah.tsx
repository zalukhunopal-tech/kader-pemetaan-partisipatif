import React, { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Folder, Map, MessageSquare, ShieldCheck, User } from "lucide-react";
import { LogoSertifikatResmiSvg } from "../sertifikat/LogoSertifikatResmiSvg";
import { MenuTab, PeranPengguna } from "../../types";

const TRANSISI_INDIKATOR_NAV = {
  type: "spring" as const,
  stiffness: 460,
  damping: 36,
  mass: 0.75
};

interface NavigasiBawahProps {
  peran: PeranPengguna;
  tabAktif: MenuTab;
  setTabAktif: (tab: MenuTab) => void;
  /** Jumlah data yang belum terunggah (sinkronisasi otomatis berjalan di latar belakang) */
  antreanLokalCount: number;
  onModeUser: () => void;
  adaPesanBaru?: boolean;
}

/**
 * Bilah navigasi bawah Titik Tapak
 * Bersih, elegan, tanpa menu sinkronisasi manual karena sinkronisasi 100% otomatis di latar belakang.
 */
export const NavigasiBawah: React.FC<NavigasiBawahProps> = ({ peran, tabAktif, setTabAktif, onModeUser, adaPesanBaru = false }) => {
  const roNavRef = useRef<ResizeObserver | null>(null);
  const rafNavRef = useRef<number | null>(null);
  const ukurBilahBawah = useCallback((el: HTMLElement | null) => {
    if (rafNavRef.current !== null) {
      cancelAnimationFrame(rafNavRef.current);
      rafNavRef.current = null;
    }
    roNavRef.current?.disconnect();
    roNavRef.current = null;
    if (!el) return;
    const atur = () => {
      if (rafNavRef.current !== null) cancelAnimationFrame(rafNavRef.current);
      rafNavRef.current = requestAnimationFrame(() => {
        const tinggi = window.matchMedia("(min-width: 768px)").matches ? 0 : Math.ceil(el.getBoundingClientRect().height);
        document.documentElement.style.setProperty("--tinggi-nav", `${tinggi}px`);
      });
    };
    atur();
    if (typeof ResizeObserver !== "undefined") {
      roNavRef.current = new ResizeObserver(() => {
        atur();
      });
      roNavRef.current.observe(el);
    }
  }, []);

  const renderIndikatorAktif = (aktif: boolean, varianAdmin = false) =>
    aktif ? (
      <motion.span
        layoutId={`nav-indikator-aktif-${peran}`}
        className={`avenza-nav-active-pill ${varianAdmin ? "admin" : ""}`}
        transition={TRANSISI_INDIKATOR_NAV}
        aria-hidden="true"
      />
    ) : null;

  return (
    <nav className="avenza-bottom-nav" ref={ukurBilahBawah} aria-label="Navigasi utama">
      <div className="desktop-nav-brand">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 2 }}>
          <img src="./taka/taka_avatar_256.png" alt="Maskot Taka" className="taka-sidebar-mascot" />
          <strong>
            Titik Tapak<span>●</span>
          </strong>
        </div>
        <small>JEJAK BAIK UNTUK BUMI</small>
      </div>
      {peran === "kader" ? (
        // NAVIGASI KHUSUS AKUN USER (KADER)
        <>
          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "pustaka" ? "active" : ""}`}
            onClick={() => setTabAktif("pustaka")}
          >
            {renderIndikatorAktif(tabAktif === "pustaka")}
            <Folder size={20} fill={tabAktif === "pustaka" ? "#0d7344" : "none"} />
            <span>Pustaka</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "peta" ? "active" : ""}`}
            onClick={() => setTabAktif("peta")}
          >
            {renderIndikatorAktif(tabAktif === "peta")}
            <Map size={20} />
            <span>Peta</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "reward" ? "active" : ""}`}
            onClick={() => setTabAktif("reward")}
          >
            {renderIndikatorAktif(tabAktif === "reward")}
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
            {renderIndikatorAktif(tabAktif === "komunikasi")}
            <div className="nav-icon-wrap">
              <MessageSquare size={20} />
              {adaPesanBaru && <span className="nav-notif-dot" aria-label="Ada pesan baru" />}
            </div>
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
            {renderIndikatorAktif(tabAktif === "admin", true)}
            <ShieldCheck size={20} color={tabAktif === "admin" ? "#0284c7" : "#64748b"} />
            <span style={{ color: tabAktif === "admin" ? "#0284c7" : "#64748b" }}>Admin</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "peta" ? "active" : ""}`}
            onClick={() => setTabAktif("peta")}
          >
            {renderIndikatorAktif(tabAktif === "peta")}
            <Map size={20} />
            <span>Peta</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "komunikasi" ? "active" : ""}`}
            onClick={() => setTabAktif("komunikasi")}
          >
            {renderIndikatorAktif(tabAktif === "komunikasi")}
            <div className="nav-icon-wrap">
              <MessageSquare size={20} />
              {adaPesanBaru && <span className="nav-notif-dot" aria-label="Ada pesan baru" />}
            </div>
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
