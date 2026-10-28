import React from "react";
import {
  Bell,
  CloudUpload,
  Fingerprint,
  Folder,
  KeyRound,
  LogOut,
  MoreVertical,
  Share,
  Shield,
  User,
  UserCheck,
  Watch,
  Wifi,
  WifiOff
} from "lucide-react";
import { MenuTab, PeranPengguna } from "../../types";
import { TombolInstal } from "../InstalAplikasi";

const JUDUL_TAB: Record<MenuTab, string> = {
  pustaka: "Pustaka",
  peta: "Temukan",
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
  onBukaSmartwatch: () => void;
  onBukaPemberitahuan: () => void;
  onBukaEkspor: () => void;
  onModePilihPustaka: () => void;
  onBukaKeamanan: () => void;
  onBukaGantiSandi: () => void;
  onKeluar: () => void;
}

/** Bilah atas: judul halaman dan tombol Menu yang membuka toolbar (koneksi, peran, dan semua aksi akun) */
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
  onBukaSmartwatch,
  onBukaPemberitahuan,
  onBukaEkspor,
  onModePilihPustaka,
  onBukaKeamanan,
  onBukaGantiSandi,
  onKeluar
}) => (
  <header className="avenza-topbar">
    <div className="avenza-topbar-left">
      <h1 className="avenza-topbar-title" onClick={() => setTabAktif(peran === "admin" ? "admin" : "pustaka")}>
        {JUDUL_TAB[tabAktif]}
      </h1>
    </div>

    <div className="avenza-topbar-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`avenza-toolbar-toggle-btn ${bukaMenuTitikTiga ? "active" : ""}`}
        onClick={() => setBukaMenuTitikTiga((v) => !v)}
        title="Buka Toolbar"
      >
        <MoreVertical size={19} strokeWidth={2.2} />
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
              onBukaSmartwatch();
            }}
          >
            <Watch size={16} /> Smartwatch
          </button>

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
              setTabAktif("pustaka");
              onModePilihPustaka();
            }}
          >
            <Folder size={16} /> Pilih
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
            <Fingerprint size={16} /> PIN & sidik jari
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
