import React, { useCallback, useRef } from "react";
import { Award, CloudUpload, Folder, Map, MessageSquare, ShieldCheck, User } from "lucide-react";
import { MenuTab, PeranPengguna } from "../../types";

interface NavigasiBawahProps {
  peran: PeranPengguna;
  tabAktif: MenuTab;
  setTabAktif: (tab: MenuTab) => void;
  /** Jumlah data yang belum terunggah, tampil sebagai lencana di GDrive */
  antreanLokalCount: number;
  onModeUser: () => void;
}

/** Bilah navigasi bawah: berbeda untuk akun admin dan akun user */
export const NavigasiBawah: React.FC<NavigasiBawahProps> = ({ peran, tabAktif, setTabAktif, antreanLokalCount, onModeUser }) => {
  // Tinggi bilah bawah yang sebenarnya (membesar bila ukuran huruf HP diperbesar) dipakai CSS untuk
  // ruang bawah halaman, tombol mengambang, dan tinggi peta, supaya tidak ada yang tertutup bilah bawah.
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

          <button type="button" className={`avenza-nav-item ${tabAktif === "peta" ? "active" : ""}`} onClick={() => setTabAktif("peta")}>
            <Map size={20} />
            <span>Temukan</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "data_sync" ? "active" : ""}`}
            onClick={() => setTabAktif("data_sync")}
          >
            <div className="nav-icon-wrap">
              <CloudUpload size={20} />
              {antreanLokalCount > 0 && <span className="nav-badge">{antreanLokalCount}</span>}
            </div>
            <span>GDrive</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "reward" ? "active" : ""}`}
            onClick={() => setTabAktif("reward")}
          >
            <Award size={20} />
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
          <button type="button" className={`avenza-nav-item ${tabAktif === "admin" ? "active" : ""}`} onClick={() => setTabAktif("admin")}>
            <ShieldCheck size={20} color={tabAktif === "admin" ? "#0284c7" : "#64748b"} />
            <span style={{ color: tabAktif === "admin" ? "#0284c7" : "#64748b" }}>Admin</span>
          </button>

          <button type="button" className={`avenza-nav-item ${tabAktif === "peta" ? "active" : ""}`} onClick={() => setTabAktif("peta")}>
            <Map size={20} />
            <span>Temukan</span>
          </button>

          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "data_sync" ? "active" : ""}`}
            onClick={() => setTabAktif("data_sync")}
          >
            <CloudUpload size={20} />
            <span>GDrive</span>
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
