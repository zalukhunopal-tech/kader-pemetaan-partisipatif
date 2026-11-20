import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
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
import { sisaHariSlot } from "../../lib/cachePetaOtomatis";
import { StatusNotifCitraOffline, formatHitungMundur } from "../../lib/useUnduhPetaOtomatis";
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

  const persenTunggu =
    statusCitraOffline && statusCitraOffline.totalDetikTunggu > 0
      ? Math.max(
          2,
          Math.min(
            100,
            Math.round(
              ((statusCitraOffline.totalDetikTunggu - statusCitraOffline.sisaDetikTunggu) /
                statusCitraOffline.totalDetikTunggu) *
                100
            )
          )
        )
      : 0;

  const judulNotifOffline = (() => {
    if (!statusCitraOffline) return "";
    switch (statusCitraOffline.fase) {
      case "mengunduh":
        return "Mengunduh citra offline (10 × 10 km)";
      case "menunggu":
        return "Lokasi belum diunduh";
      case "belum_offline":
        return "Lokasi belum diunduh (Offline)";
      case "gagal":
        return "Unduhan citra tertunda";
      default:
        return "Citra offline lokasi ini siap";
    }
  })();

  const ketNotifOffline = (() => {
    if (!statusCitraOffline) return "";
    switch (statusCitraOffline.fase) {
      case "mengunduh":
        return statusCitraOffline.tileTotal > 0
          ? `${statusCitraOffline.tileSelesai.toLocaleString("id-ID")} dari ${statusCitraOffline.tileTotal.toLocaleString("id-ID")} tile (${statusCitraOffline.persen}%)`
          : `Menyiapkan citra wilayah (${statusCitraOffline.persen}%)`;
      case "menunggu":
        return `Menyesuaikan posisi terkini. Unduhan otomatis dimulai dalam ${formatHitungMundur(statusCitraOffline.sisaDetikTunggu)}.`;
      case "belum_offline":
        return "Perangkat sedang offline. Citra 10 × 10 km akan diunduh otomatis saat terhubung jaringan.";
      case "gagal":
        return statusCitraOffline.pesanGalat || "Koneksi terganggu. Mencoba ulang otomatis saat jaringan stabil.";
      default: {
        const sisa = statusCitraOffline.kotakAktif ? sisaHariSlot(statusCitraOffline.kotakAktif) : 30;
        return `Cakupan 10 × 10 km aktif langsung di peta · Sisa ${sisa} hari dari 30 hari.`;
      }
    }
  })();

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
          className={`avenza-notif-offline-btn ${statusCitraOffline.perluPeringatan ? "peringatan" : "siap"} ${statusCitraOffline.fase === "mengunduh" ? "mengunduh" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setBukaMenuTitikTiga(false);
            setBukaNotifOffline((v) => !v);
          }}
          aria-label={
            statusCitraOffline.fase === "mengunduh"
              ? `Notifikasi progres unduh citra offline ${statusCitraOffline.persen}%`
              : statusCitraOffline.perluPeringatan
                ? "Peringatan lokasi belum diunduh untuk mode offline"
                : "Notifikasi citra offline siap"
          }
          title={judulNotifOffline}
        >
          <Bell size={15} />
          {statusCitraOffline.fase === "mengunduh" ? (
            <span className="avenza-notif-pct">{statusCitraOffline.persen}%</span>
          ) : statusCitraOffline.perluPeringatan ? (
            <span className="avenza-notif-warn-badge" aria-label="Peringatan lokasi belum diunduh">
              !
            </span>
          ) : (
            <span className="avenza-notif-ok-dot" aria-hidden="true" />
          )}
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
          aria-label="Notifikasi citra offline"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="notif-hp-header">
            <div className="notif-hp-app-meta">
              <img src="./taka/taka_avatar_256.png" alt="" className="notif-hp-app-icon" />
              <strong>Titik Tapak</strong>
              <span className="notif-hp-dot">·</span>
              <span>Citra Offline</span>
            </div>
            <button
              type="button"
              className="notif-hp-close"
              onClick={() => setBukaNotifOffline(false)}
              aria-label="Tutup notifikasi"
            >
              <X size={16} />
            </button>
          </div>

          <div className="notif-hp-body">
            <div
              className={`notif-hp-status-icon fase-${statusCitraOffline.fase}`}
              aria-hidden="true"
            >
              {statusCitraOffline.fase === "siap" ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
            </div>
            <div className="notif-hp-content">
              <div className="notif-hp-title-row">
                <h4>{judulNotifOffline}</h4>
                {statusCitraOffline.fase === "mengunduh" && (
                  <span className="notif-hp-badge-pct">{statusCitraOffline.persen}%</span>
                )}
                {statusCitraOffline.fase === "menunggu" && (
                  <span className="notif-hp-badge-wait">
                    {formatHitungMundur(statusCitraOffline.sisaDetikTunggu)}
                  </span>
                )}
              </div>
              <p className="notif-hp-desc">{ketNotifOffline}</p>

              {(statusCitraOffline.fase === "mengunduh" || statusCitraOffline.fase === "menunggu") && (
                <div
                  className="notif-hp-progress-track"
                  role="progressbar"
                  aria-valuenow={statusCitraOffline.fase === "mengunduh" ? statusCitraOffline.persen : persenTunggu}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`notif-hp-progress-fill fase-${statusCitraOffline.fase}`}
                    style={{
                      width: `${statusCitraOffline.fase === "mengunduh" ? statusCitraOffline.persen : persenTunggu}%`
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="notif-hp-slots">
            <div className="notif-hp-slots-head">
              <span>
                Kotak tersimpan: {statusCitraOffline.daftarKotak.length} / {statusCitraOffline.maksKotak}
              </span>
              <span>10 × 10 km · 30 hari</span>
            </div>
            <div className="notif-hp-slot-pills">
              {Array.from({ length: statusCitraOffline.maksKotak }).map((_, idx) => {
                const slot = statusCitraOffline.daftarKotak[idx];
                const sisa = slot ? sisaHariSlot(slot) : 0;
                return (
                  <div key={slot?.id ?? `kosong-${idx}`} className={`notif-hp-slot-pill ${slot ? "terisi" : "kosong"}`}>
                    <strong>Kotak {idx + 1}</strong>
                    <span>{slot ? `Sisa ${sisa} hari` : "Kosong"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="notif-hp-footer">
            <button
              type="button"
              className="notif-hp-link-btn"
              onClick={() => {
                setBukaNotifOffline(false);
                onBukaPemberitahuan();
              }}
            >
              Lihat semua pemberitahuan
            </button>
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
