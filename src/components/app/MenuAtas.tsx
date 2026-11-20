import React, { useEffect, useState } from "react";
import {
  Bell,
  CloudUpload,
  Fingerprint,
  HelpCircle,
  KeyRound,
  LogOut,
  MoreVertical,
  Share,
  Shield,
  User,
  UserCheck,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { MenuTab, PeranPengguna } from "../../types";
import { StateAutoSync } from "../../lib/gdriveSync";
import { StatusNotifCitraOffline } from "../../lib/useUnduhPetaOtomatis";
import { TombolInstal } from "../InstalAplikasi";

const JUDUL_TAB: Record<MenuTab, string> = {
  pustaka: "Pustaka",
  peta: "Peta",
  data_sync: "Sinkronisasi",
  reward: "Sertifikat",
  tugas: "Tugas",
  komunikasi: "Diskusi",
  admin: "Admin"
};

interface MenuAtasProps {
  tabAktif: MenuTab;
  setTabAktif: (tab: MenuTab) => void;
  peran: PeranPengguna;
  adalahAkunAdmin: boolean;
  gantiPeranAkun: (peranBaru: PeranPengguna) => void;
  bukaMenuTitikTiga: boolean;
  setBukaMenuTitikTiga: React.Dispatch<React.SetStateAction<boolean>>;
  sedangOnline: boolean;
  jaringanTersedia: boolean;
  modeOfflineManual: boolean;
  setModeOfflineManual: React.Dispatch<React.SetStateAction<boolean>>;
  tampilkanToast: (pesan: string) => void;
  onBukaPemberitahuan: () => void;
  onBukaEkspor: () => void;
  onModePilihPustaka?: () => void;
  onBukaKeamanan: () => void;
  onBukaGantiSandi: () => void;
  onBukaBantuan?: () => void;
  jumlahBug?: number;
  onKeluar: () => void;
  autoSync?: StateAutoSync;
  onBukaSplashTaka?: () => void;
  statusCitraOffline?: StatusNotifCitraOffline;
}

/** Bilah atas: judul halaman, indikator koneksi, notifikasi citra offline, dan tombol Menu */
export const MenuAtas: React.FC<MenuAtasProps> = ({
  tabAktif,
  setTabAktif,
  peran,
  adalahAkunAdmin,
  gantiPeranAkun,
  bukaMenuTitikTiga,
  setBukaMenuTitikTiga,
  sedangOnline,
  jaringanTersedia,
  modeOfflineManual,
  setModeOfflineManual,
  tampilkanToast,
  onBukaPemberitahuan,
  onBukaEkspor,
  onBukaKeamanan,
  onBukaGantiSandi,
  onBukaBantuan,
  jumlahBug = 0,
  onKeluar,
  onBukaSplashTaka,
  statusCitraOffline
}) => {
  const [bukaNotifOffline, setBukaNotifOffline] = useState(false);

  useEffect(() => {
    if (!bukaNotifOffline) return;
    const saatEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBukaNotifOffline(false);
    };
    window.addEventListener("keydown", saatEsc);
    return () => window.removeEventListener("keydown", saatEsc);
  }, [bukaNotifOffline]);

  const sudahDiunduh = Boolean(statusCitraOffline && !statusCitraOffline.perluPeringatan);
  const sedangMengunduh = statusCitraOffline?.fase === "mengunduh";
  const persenProgress = sudahDiunduh ? 100 : sedangMengunduh ? statusCitraOffline?.persen ?? 0 : 0;

  return (
  <header className="avenza-topbar">
    <div className="avenza-topbar-left">
      <img
        src="./taka/taka_avatar_256.png"
        alt="Maskot Taka"
        className="taka-topbar-mascot"
        onClick={() => onBukaSplashTaka?.()}
        title="Maskot Taka — Ketuk untuk melihat layar pembuka"
      />
      <h1 className="avenza-topbar-title" onClick={() => setTabAktif(peran === "admin" ? "admin" : "pustaka")}>
        {JUDUL_TAB[tabAktif]}
      </h1>
      <button
        type="button"
        className={`avenza-conn-chip ${sedangOnline ? "online" : "offline"}`}
        onClick={() => setModeOfflineManual((m) => !m)}
        title={jaringanTersedia ? "Ketuk untuk beralih mode offline manual" : "Tidak ada koneksi internet"}
        style={{ marginLeft: 6 }}
      >
        {sedangOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
        <span>{!jaringanTersedia ? "Offline" : modeOfflineManual ? "Luring (Manual)" : "Online"}</span>
      </button>

      {statusCitraOffline && (
        <button
          type="button"
          className={`avenza-notif-offline-btn ${sudahDiunduh ? "siap" : "belum"} ${sedangMengunduh ? "mengunduh" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setBukaMenuTitikTiga(false);
            setBukaNotifOffline((v) => !v);
          }}
          aria-label={
            sedangMengunduh
              ? `Progres unduh peta offline ${persenProgress}%`
              : sudahDiunduh
                ? "Peta offline sudah diunduh"
                : "Peta offline belum diunduh"
          }
          title={sedangMengunduh ? `Mengunduh ${persenProgress}%` : sudahDiunduh ? "Sudah diunduh" : "Belum diunduh"}
        >
          <Bell size={15} />
          {sedangMengunduh && <span className="avenza-notif-pct">{persenProgress}%</span>}
        </button>
      )}
    </div>

    {bukaNotifOffline && statusCitraOffline && (
      <>
        <div
          className="notif-hp-backdrop"
          onClick={() => setBukaNotifOffline(false)}
          aria-hidden="true"
        />
        <div
          className="notif-hp-card"
          role="dialog"
          aria-label="Progres unduh peta offline"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="notif-hp-simple-row">
            <span className={`notif-hp-dot-status ${sudahDiunduh ? "siap" : "belum"}`} aria-hidden="true" />
            <strong className="notif-hp-simple-label">
              {sedangMengunduh
                ? `Mengunduh ${persenProgress}%`
                : sudahDiunduh
                  ? "Sudah diunduh"
                  : "Belum diunduh"}
            </strong>
            <button
              type="button"
              className="notif-hp-close"
              onClick={() => setBukaNotifOffline(false)}
              aria-label="Tutup"
            >
              <X size={15} />
            </button>
          </div>
          <div
            className="notif-hp-progress-track"
            role="progressbar"
            aria-valuenow={persenProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`notif-hp-progress-fill ${sudahDiunduh ? "siap" : "belum"}`}
              style={{ width: `${persenProgress}%` }}
            />
          </div>
        </div>
      </>
    )}

    <div className="avenza-topbar-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`avenza-toolbar-toggle-btn ${bukaMenuTitikTiga ? "active" : ""}`}
        onClick={() => setBukaMenuTitikTiga((v) => !v)}
        title="Buka Toolbar"
      >
        <MoreVertical size={16} strokeWidth={2.4} />
        <span>Menu</span>
      </button>

      {bukaMenuTitikTiga && (
        <div className="avenza-overflow-menu toolbar-popover">
          {/* BARIS CHIP KONEKSI & PERAN DI DALAM TOOLBAR POPOVER */}
          <div className="toolbar-popover-chips">
            <button
              type="button"
              className={`avenza-conn-chip ${sedangOnline ? "online" : "offline"}`}
              onClick={() => setModeOfflineManual((m) => !m)}
              title={jaringanTersedia ? "Ketuk untuk beralih mode offline manual (tidak mengunggah)" : "Tidak ada koneksi internet"}
            >
              {sedangOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span>{!jaringanTersedia ? "Offline" : modeOfflineManual ? "Offline (manual)" : "Online"}</span>
            </button>

            {adalahAkunAdmin && (
              <button
                type="button"
                className={`avenza-role-chip ${peran === "admin" ? "admin" : "kader"}`}
                onClick={() => {
                  setBukaMenuTitikTiga(false);
                  gantiPeranAkun(peran === "admin" ? "kader" : "admin");
                }}
              >
                {peran === "admin" ? <Shield size={12} /> : <User size={12} />}
                <span>{peran === "admin" ? "Admin" : "User"}</span>
              </button>
            )}
          </div>

          <div className="avenza-overflow-divider" />

          <button
            type="button"
            className="avenza-overflow-item"
            onClick={() => {
              setBukaMenuTitikTiga(false);
              setTabAktif("reward");
            }}
          >
            <UserCheck size={16} /> Sertifikat
          </button>

          <button
            type="button"
            className="avenza-overflow-item"
            onClick={() => {
              setBukaMenuTitikTiga(false);
              onBukaPemberitahuan();
            }}
          >
            <Bell size={16} /> Pemberitahuan
          </button>

          <button
            type="button"
            className="avenza-overflow-item"
            onClick={() => {
              setBukaMenuTitikTiga(false);
              onBukaEkspor();
            }}
          >
            <Share size={16} /> Ekspor
          </button>

          <button
            type="button"
            className="avenza-overflow-item"
            onClick={() => {
              setBukaMenuTitikTiga(false);
              setTabAktif("data_sync");
            }}
          >
            <CloudUpload size={16} /> Sinkronisasi
          </button>

          <div className="avenza-overflow-divider" />

          {adalahAkunAdmin && (
            <button
              type="button"
              className="avenza-overflow-item"
              style={{ color: peran === "kader" ? "#0284c7" : "#0d7344", fontWeight: 700 }}
              onClick={() => {
                setBukaMenuTitikTiga(false);
                gantiPeranAkun(peran === "kader" ? "admin" : "kader");
              }}
            >
              {peran === "kader" ? "🛡️ Mode Admin" : "👤 Mode User"}
            </button>
          )}

          <TombolInstal className="avenza-overflow-item" onSelesai={tampilkanToast} />

          <button
            type="button"
            className="avenza-overflow-item"
            onClick={() => {
              setBukaMenuTitikTiga(false);
              onBukaKeamanan();
            }}
          >
            <Fingerprint size={16} /> Kunci aplikasi
          </button>

          <button
            type="button"
            className="avenza-overflow-item"
            onClick={() => {
              setBukaMenuTitikTiga(false);
              onBukaGantiSandi();
            }}
          >
            <KeyRound size={16} /> Kata sandi
          </button>

          <button
            type="button"
            className="avenza-overflow-item"
            onClick={() => {
              setBukaMenuTitikTiga(false);
              onBukaBantuan?.();
            }}
          >
            <HelpCircle size={16} /> <span>Bantuan</span>
            {jumlahBug > 0 && <span className="menu-bug-badge">{jumlahBug}</span>}
          </button>

          <button
            type="button"
            className="avenza-overflow-item"
            style={{ color: "#dc2626", fontWeight: 700 }}
            onClick={() => {
              setBukaMenuTitikTiga(false);
              onKeluar();
            }}
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      )}
    </div>
  </header>
  );
};
