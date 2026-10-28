import React, { useEffect, useState } from "react";
import {
  AreaPetaOffline,
  DataSpasialItem,
  KaderAktifPresence,
  KonfigurasiGDrive,
  LapisanSpasial,
  MenuTab,
  PengumumanBroadcast,
  PeranPengguna,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  StatusSinkron,
  TugasPemetaan
} from "./types";
import {
  muatAreaOffline,
  muatDataSpasial,
  muatKaderAktif,
  muatKonfigGDrive,
  muatLapisan,
  muatPengumuman,
  muatPesan,
  muatProfil,
  muatSertifikat,
  muatTugas,
  simpanAreaOffline,
  simpanDataSpasial,
  simpanKaderAktif,
  simpanKonfigGDrive,
  simpanLapisan,
  simpanPengumuman,
  simpanPesan,
  simpanProfil,
  simpanSertifikat,
  simpanTugas
} from "./lib/storage";
import { AkunPengguna, muatSesiPengguna, simpanSesiPengguna } from "./lib/auth";
import { sinkronkanDataKeGDrive } from "./lib/gdriveSync";
import {
  perekamLatar,
  usePerekamLatar,
  durasiRekamMs,
  formatDurasi,
  ringkasanRekam
} from "./lib/perekamLatar";
import { AuthModal } from "./components/AuthModal";
import { PustakaView } from "./components/PustakaView";
import { PemberitahuanView } from "./components/PemberitahuanView";
import { PengaturanEksporView } from "./components/PengaturanEksporView";
import { InteractiveMap } from "./components/InteractiveMap";
import { DatabaseSyncView } from "./components/DatabaseSyncView";
import { RewardView } from "./components/RewardView";
import { TugasPengumumanView } from "./components/TugasPengumumanView";
import { KomunikasiView } from "./components/KomunikasiView";
import { AdminDashboardView } from "./components/AdminDashboardView";
import { SmartwatchModal } from "./components/SmartwatchModal";
import {
  Award,
  Bell,
  CloudUpload,
  Folder,
  Map,
  MessageSquare,
  MoreVertical,
  Share,
  ShieldCheck,
  UserCheck,
  Wifi,
  WifiOff,
  User,
  Shield,
  LogOut,
  Radio,
  Pause,
  Play,
  Watch
} from "lucide-react";

export const App: React.FC = () => {
  // Sesi Pengguna Login
  const [sesiPengguna, setSesiPengguna] = useState<AkunPengguna | null>(() =>
    muatSesiPengguna()
  );

  // Role & Session State
  const [peran, setPeran] = useState<PeranPengguna>(() =>
    sesiPengguna ? sesiPengguna.peran : "kader"
  );
  const [tabAktif, setTabAktif] = useState<MenuTab>(() =>
    sesiPengguna && sesiPengguna.peran === "admin" ? "admin" : "pustaka"
  );
  const [sedangOnline, setSedangOnline] = useState<boolean>(true);

  // Sub-halaman penuh & menu
  const [bukaPemberitahuan, setBukaPemberitahuan] = useState<boolean>(false);
  const [bukaPengaturanEkspor, setBukaPengaturanEkspor] = useState<boolean>(false);
  const [bukaMenuTitikTiga, setBukaMenuTitikTiga] = useState<boolean>(false);
  const [bukaSmartwatch, setBukaSmartwatch] = useState<boolean>(false);
  const [modePilihPustaka, setModePilihPustaka] = useState<boolean>(false);
  const [notifToast, setNotifToast] = useState<string | null>(null);

  // Data Store
  const [profil, setProfil] = useState<ProfilKader>(() => {
    const prof = muatProfil();
    if (sesiPengguna) {
      return {
        ...prof,
        idKader: sesiPengguna.idKader,
        nama: sesiPengguna.nama,
        desaWilayah: sesiPengguna.desaWilayah,
        noHp: sesiPengguna.noHp,
        kelompokMasyarakat: sesiPengguna.kelompokMasyarakat,
        namaOrganisasi: sesiPengguna.namaOrganisasi
      };
    }
    return prof;
  });

  const [dataSpasial, setDataSpasial] = useState<DataSpasialItem[]>(() =>
    muatDataSpasial()
  );
  const [areaOffline, setAreaOffline] = useState<AreaPetaOffline[]>(() =>
    muatAreaOffline()
  );
  const [lapisanList, setLapisanList] = useState<LapisanSpasial[]>(() =>
    muatLapisan()
  );
  const [sertifikatList, setSertifikatList] = useState<SertifikatKader[]>(() =>
    muatSertifikat()
  );
  const [pengumumanList, setPengumumanList] = useState<PengumumanBroadcast[]>(() =>
    muatPengumuman()
  );
  const [tugasList, setTugasList] = useState<TugasPemetaan[]>(() => muatTugas());
  const [pesanList, setPesanList] = useState<PesanKomunikasi[]>(() => muatPesan());
  const [kaderAktifList, setKaderAktifList] = useState<KaderAktifPresence[]>(() =>
    muatKaderAktif()
  );
  const [konfigGDrive, setKonfigGDrive] = useState<KonfigurasiGDrive>(() =>
    muatKonfigGDrive()
  );

  const [fokusKoordinat, setFokusKoordinat] = useState<{
    lat: number;
    lng: number;
    label?: string;
  } | null>(null);
  const [sedangSinkron, setSedangSinkron] = useState<boolean>(false);
  const [pesanSinkron, setPesanSinkron] = useState<string | null>(null);

  // Status Perekaman Data di Latar Belakang (Global di Semua Tab)
  const rekamLatar = usePerekamLatar();
  const [detikRekamTick, setDetikRekamTick] = useState<number>(0);

  useEffect(() => {
    if (rekamLatar.status !== "merekam") return;
    const t = window.setInterval(() => setDetikRekamTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [rekamLatar.status]);

  // Simpan perubahan ke LocalStorage (Offline-First)
  useEffect(() => simpanProfil(profil), [profil]);
  useEffect(() => simpanDataSpasial(dataSpasial), [dataSpasial]);
  useEffect(() => simpanAreaOffline(areaOffline), [areaOffline]);
  useEffect(() => simpanLapisan(lapisanList), [lapisanList]);
  useEffect(() => simpanSertifikat(sertifikatList), [sertifikatList]);
  useEffect(() => simpanPengumuman(pengumumanList), [pengumumanList]);
  useEffect(() => simpanTugas(tugasList), [tugasList]);
  useEffect(() => simpanPesan(pesanList), [pesanList]);
  useEffect(() => simpanKaderAktif(kaderAktifList), [kaderAktifList]);
  useEffect(() => simpanKonfigGDrive(konfigGDrive), [konfigGDrive]);

  // Saat online, kirim pesan antrean
  useEffect(() => {
    if (sedangOnline) {
      setPesanList((prev) =>
        prev.map((m) =>
          m.statusKirim === "antrean_offline" ? { ...m, statusKirim: "terkirim" } : m
        )
      );
    }
  }, [sedangOnline]);

  const antreanLokalCount = dataSpasial.filter((d) => d.statusSinkron === "lokal").length;

  const tampilkanToast = (pesan: string) => {
    setNotifToast(pesan);
    setTimeout(() => setNotifToast(null), 3200);
  };

  // Handler Login Berhasil
  const handleLoginSukses = (akun: AkunPengguna) => {
    setSesiPengguna(akun);
    setPeran(akun.peran);
    setProfil((prev) => ({
      ...prev,
      idKader: akun.idKader,
      nama: akun.nama,
      desaWilayah: akun.desaWilayah,
      noHp: akun.noHp,
      kelompokMasyarakat: akun.kelompokMasyarakat,
      namaOrganisasi: akun.namaOrganisasi
    }));
    if (akun.peran === "admin") {
      setTabAktif("admin");
    } else {
      setTabAktif("pustaka");
    }
    tampilkanToast(
      `✓ Selamat datang, ${akun.nama} (${akun.peran === "admin" ? "Admin GIS" : "Kader Lapangan"})!`
    );
  };

  // Handler Logout
  const handleLogout = () => {
    simpanSesiPengguna(null);
    setSesiPengguna(null);
    tampilkanToast("Anda telah keluar dari aplikasi GeoKader.");
  };

  // Switch Peran Pengguna (Admin vs User/Kader)
  const gantiPeranAkun = (peranBaru: PeranPengguna) => {
    setPeran(peranBaru);
    if (peranBaru === "admin") {
      setTabAktif("admin");
      tampilkanToast("🛡️ Beralih ke Akun Administrator GIS.");
    } else {
      setTabAktif("pustaka");
      tampilkanToast("👤 Beralih ke Akun Kader Lapangan (User).");
    }
  };

  // Handler Ubah Nama & Jabatan Penandatangan Sertifikat oleh Admin
  const handleUbahPenandatanganSertifikat = (
    namaPenandatangan: string,
    jabatanPenandatangan: string
  ) => {
    setProfil((prev) => ({
      ...prev,
      namaPenandatanganSertifikat: namaPenandatangan,
      jabatanPenandatanganSertifikat: jabatanPenandatangan
    }));
    setSertifikatList((prev) =>
      prev.map((s) => ({
        ...s,
        ditandatanganiOleh: namaPenandatangan,
        jabatanPenandatangan
      }))
    );
  };

  // Handler Simpan Data Spasial Baru dari Peta (User Feature)
  const handleSimpanDataBaru = (item: DataSpasialItem) => {
    setDataSpasial((prev) => [item, ...prev]);
    tampilkanToast(`✓ "${item.judul}" disimpan ke Lapisan & memori HP.`);
  };

  // Handler Update Kondisi pada Objek Existing
  const handleTambahPembaruanObjek = (
    idData: string,
    kondisiTerbaru: string,
    catatan: string,
    fotoBase64?: string
  ) => {
    setDataSpasial((prev) =>
      prev.map((d) => {
        if (d.id !== idData) return d;
        return {
          ...d,
          kondisiAncaman: kondisiTerbaru,
          updatedAt: new Date().toISOString(),
          riwayatPembaruan: [
            ...d.riwayatPembaruan,
            {
              id: `UPD-${Date.now().toString().slice(-4)}`,
              tanggal: new Date().toISOString(),
              olehKader: profil.nama,
              kondisiTerbaru,
              catatan,
              fotoBase64
            }
          ]
        };
      })
    );
    tampilkanToast("✓ Pembaruan kondisi objek berhasil disimpan (+1 Poin).");
  };

  // Handler Ubah Data Spasial oleh Admin (Admin Feature)
  const handleUbahDataSpasial = (dataDiubah: DataSpasialItem) => {
    setDataSpasial((prev) =>
      prev.map((d) =>
        d.id === dataDiubah.id
          ? { ...dataDiubah, updatedAt: new Date().toISOString() }
          : d
      )
    );
    tampilkanToast(`✓ Data "${dataDiubah.judul}" berhasil diperbarui oleh Admin.`);
  };

  // Handler Hapus Data Spasial oleh Admin (Admin Feature)
  const handleHapusDataSpasial = (id: string) => {
    setDataSpasial((prev) => prev.filter((d) => d.id !== id));
    tampilkanToast("✓ Data spasial berhasil dihapus.");
  };

  // Handler Tambah Tugas Baru oleh Admin (Admin Feature)
  const handleTambahTugas = (tugasBaru: TugasPemetaan) => {
    setTugasList((prev) => [tugasBaru, ...prev]);
    tampilkanToast(`✓ Tugas "${tugasBaru.judul}" dikirim ke peta kader.`);
  };

  // Handler Hapus Tugas
  const handleHapusTugas = (id: string) => {
    setTugasList((prev) => prev.filter((t) => t.id !== id));
    tampilkanToast("✓ Tugas pemetaan dihapus.");
  };

  // Handler Sinkronisasi ke Google Drive & Sheets
  const handleSinkronkanSekarang = async () => {
    if (!sedangOnline) {
      setPesanSinkron(
        "⚠️ Perangkat sedang dalam Mode Offline. Data tetap tersimpan aman di memori HP dan akan diunggah saat sinyal tersedia."
      );
      return;
    }
    setSedangSinkron(true);
    setPesanSinkron(null);
    const res = await sinkronkanDataKeGDrive(dataSpasial, konfigGDrive);
    if (res.sukses && res.idTersinkron.length > 0) {
      setDataSpasial((prev) =>
        prev.map((d) =>
          res.idTersinkron.includes(d.id) ? { ...d, statusSinkron: "tersinkron" } : d
        )
      );
      setKonfigGDrive((prev) => ({
        ...prev,
        terakhirSinkron: new Date().toLocaleString("id-ID")
      }));
    }
    setPesanSinkron(res.pesan);
    setSedangSinkron(false);
  };

  // Handler Fokus ke Titik Koordinat di Peta
  const handleFokusKePeta = (lat: number, lng: number, label: string) => {
    setFokusKoordinat({ lat, lng, label });
    setTabAktif("peta");
  };

  // Handler Kirim Pesan Chat / WhatsApp Style
  const handleKirimPesan = (
    saluran: "komunitas" | "admin",
    teks: string,
    pinKoordinat?: { lat: number; lng: number; label: string },
    durasiSuaraDetik?: number
  ) => {
    const msgBaru: PesanKomunikasi = {
      id: `MSG-${Date.now().toString().slice(-5)}`,
      saluran,
      idPengirim: peran === "admin" ? "ADMIN-01" : profil.idKader,
      namaPengirim: peran === "admin" ? "Admin GIS Organisasi" : profil.nama,
      peranPengirim: peran,
      desaPengirim: peran === "admin" ? "Pusat" : profil.desaWilayah,
      teks,
      waktu: new Date().toTimeString().slice(0, 5),
      statusKirim: sedangOnline ? "terkirim" : "antrean_offline",
      pinKoordinat,
      durasiSuaraDetik
    };
    setPesanList((prev) => [...prev, msgBaru]);
  };

  // JIKA PENGGUNA BELUM LOGIN, TAMPILKAN PORTAL LOGIN & DAFTAR LENGKAP
  if (!sesiPengguna) {
    return <AuthModal onLoginSukses={handleLoginSukses} />;
  }

  const judulHalamanUtama: Record<MenuTab, string> = {
    pustaka: "Pustaka",
    peta: "Temukan",
    data_sync: "Sinkronisasi",
    reward: "Sertifikat",
    tugas: "Tugas",
    komunikasi: "Diskusi",
    admin: "Admin"
  };

  if (bukaPemberitahuan) {
    return (
      <PemberitahuanView
        pengumumanList={pengumumanList}
        tugasList={tugasList}
        onTutup={() => setBukaPemberitahuan(false)}
        onBukaTargetDiPeta={handleFokusKePeta}
        onTandaiTugasSelesai={(id) =>
          setTugasList((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: "selesai" } : t))
          )
        }
      />
    );
  }

  if (bukaPengaturanEkspor) {
    return (
      <PengaturanEksporView
        dataSpasial={dataSpasial}
        onTutup={() => setBukaPengaturanEkspor(false)}
      />
    );
  }

  return (
    <div
      className="app-shell"
      onClick={() => {
        if (bukaMenuTitikTiga) setBukaMenuTitikTiga(false);
      }}
    >
      {/* TOPBAR BERSIH: JUDUL TUNGGAL DI KIRI, TOOLBAR DISEMBUNYIKAN HINGGA DIKLIK AGAR TIDAK MENIMPA TEKS */}
      <header className="avenza-topbar">
        <div className="avenza-topbar-left">
          <h1
            className="avenza-topbar-title"
            onClick={() => setTabAktif(peran === "admin" ? "admin" : "pustaka")}
          >
            {judulHalamanUtama[tabAktif]}
          </h1>
        </div>

        <div
          className="avenza-topbar-actions"
          onClick={(e) => e.stopPropagation()}
        >
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
                  onClick={() => setSedangOnline((o) => !o)}
                >
                  {sedangOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  <span>{sedangOnline ? "Online" : "Offline"}</span>
                </button>

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
              </div>

              <div className="avenza-overflow-divider" />

              <button
                type="button"
                className="avenza-overflow-item"
                onClick={() => {
                  setBukaMenuTitikTiga(false);
                  setBukaSmartwatch(true);
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
                  setBukaPemberitahuan(true);
                }}
              >
                <Bell size={16} /> Pemberitahuan
              </button>

              <button
                type="button"
                className="avenza-overflow-item"
                onClick={() => {
                  setBukaMenuTitikTiga(false);
                  setBukaPengaturanEkspor(true);
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
                  setModePilihPustaka(true);
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

              <button
                type="button"
                className="avenza-overflow-item"
                style={{ color: "#dc2626", fontWeight: 700 }}
                onClick={() => {
                  setBukaMenuTitikTiga(false);
                  handleLogout();
                }}
              >
                <LogOut size={16} /> Keluar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* TANDA SEDANG MEREKAM DI LATAR BELAKANG (MUNCUL DI SEMUA TAB) */}
      {rekamLatar.status !== "idle" && (
        <div
          className={`global-rec-banner ${rekamLatar.status === "dijeda" ? "paused" : ""}`}
          data-tick={detikRekamTick}
        >
          <div className="global-rec-left" onClick={() => setTabAktif("peta")}>
            <span className="global-rec-pulse-dot" />
            <Radio size={15} />
            <div className="global-rec-text">
              <strong>
                {rekamLatar.status === "merekam"
                  ? "SEDANG MEREKAM DI LATAR BELAKANG"
                  : "PEREKAMAN LATAR DIJEDA"}
              </strong>
              <span>
                {formatDurasi(durasiRekamMs(rekamLatar))} • {ringkasanRekam(rekamLatar)}
              </span>
            </div>
          </div>

          <div className="global-rec-actions">
            <button
              type="button"
              className="global-rec-btn"
              onClick={() =>
                rekamLatar.status === "merekam"
                  ? perekamLatar.jeda()
                  : perekamLatar.lanjutkan()
              }
            >
              {rekamLatar.status === "merekam" ? (
                <>
                  <Pause size={13} /> Jeda
                </>
              ) : (
                <>
                  <Play size={13} /> Lanjut
                </>
              )}
            </button>
            {tabAktif !== "peta" && (
              <button
                type="button"
                className="global-rec-btn primary"
                onClick={() => setTabAktif("peta")}
              >
                Buka Peta
              </button>
            )}
          </div>
        </div>
      )}

      {/* TOAST FEEDBACK */}
      {notifToast && <div className="avenza-toast">{notifToast}</div>}

      {/* KONTEN UTAMA SESUAI PERAN & TAB AKTIF */}
      <main className="app-main">
        {tabAktif === "pustaka" && (
          <PustakaView
            areaOffline={areaOffline}
            lapisanList={lapisanList}
            dataSpasial={dataSpasial}
            modePilihAktif={modePilihPustaka}
            onMatikanModePilih={() => setModePilihPustaka(false)}
            onBukaPetaDasar={() => setTabAktif("peta")}
            onBukaAreaPeta={(area) => {
              setFokusKoordinat({
                lat: (area.minLat + area.maxLat) / 2,
                lng: (area.minLng + area.maxLng) / 2,
                label: area.namaArea
              });
              setTabAktif("peta");
            }}
            onTambahAreaOffline={(a) => {
              setAreaOffline((prev) => [a, ...prev]);
              tampilkanToast(`✓ Peta "${a.namaArea}" ditambahkan ke Pustaka.`);
            }}
            onHapusAreaOffline={(id) =>
              setAreaOffline((prev) => prev.filter((a) => a.id !== id))
            }
            onTambahLapisan={(l) => {
              setLapisanList((prev) => [l, ...prev]);
              tampilkanToast(`✓ "${l.nama}" berhasil dibuat.`);
            }}
            onHapusLapisan={(id) =>
              setLapisanList((prev) => prev.filter((l) => l.id !== id))
            }
            onImporDataSpasial={(items) => {
              setDataSpasial((prev) => [...items, ...prev]);
              tampilkanToast(`✓ ${items.length} objek spasial berhasil diimpor.`);
            }}
            onBukaPengaturanEkspor={() => setBukaPengaturanEkspor(true)}
          />
        )}

        {tabAktif === "peta" && (
          <InteractiveMap
            dataSpasial={dataSpasial}
            profil={profil}
            areaOffline={areaOffline}
            fokusKoordinat={fokusKoordinat}
            onSimpanDataBaru={handleSimpanDataBaru}
            onTambahPembaruanObjek={handleTambahPembaruanObjek}
            onSimpanAreaOffline={(a) => setAreaOffline((prev) => [a, ...prev])}
            onImporDataSpasial={(items) =>
              setDataSpasial((prev) => [...items, ...prev])
            }
            onBukaSmartwatch={() => setBukaSmartwatch(true)}
          />
        )}

        {tabAktif === "data_sync" && (
          <DatabaseSyncView
            dataSpasial={dataSpasial}
            konfigGDrive={konfigGDrive}
            sedangSinkron={sedangSinkron}
            pesanSinkron={pesanSinkron}
            onSinkronkanSekarang={handleSinkronkanSekarang}
            onSimpanKonfigGDrive={setKonfigGDrive}
            onFokusKePeta={handleFokusKePeta}
          />
        )}

        {tabAktif === "reward" && (
          <RewardView
            dataSpasial={dataSpasial}
            profil={profil}
            peran={peran}
            sertifikatList={sertifikatList}
            pesanList={pesanList}
            tugasList={tugasList}
            onUbahProfil={setProfil}
            onUbahPenandatanganSertifikat={handleUbahPenandatanganSertifikat}
          />
        )}

        {tabAktif === "tugas" && (
          <TugasPengumumanView
            pengumumanList={pengumumanList}
            tugasList={tugasList}
            onBukaTargetDiPeta={handleFokusKePeta}
            onTandaiTugasSelesai={(id) =>
              setTugasList((prev) =>
                prev.map((t) => (t.id === id ? { ...t, status: "selesai" } : t))
              )
            }
          />
        )}

        {tabAktif === "komunikasi" && (
          <KomunikasiView
            pesanList={pesanList}
            profil={profil}
            sedangOnline={sedangOnline}
            onKirimPesan={handleKirimPesan}
            onLihatPinDiPeta={handleFokusKePeta}
          />
        )}

        {tabAktif === "admin" && (
          <AdminDashboardView
            dataSpasial={dataSpasial}
            profilKader={profil}
            sertifikatList={sertifikatList}
            tugasList={tugasList}
            kaderAktifList={kaderAktifList}
            onVerifikasiData={(id: string, status: StatusSinkron, catatan?: string) =>
              setDataSpasial((prev) =>
                prev.map((d) =>
                  d.id === id ? { ...d, statusSinkron: status, catatanAdmin: catatan } : d
                )
              )
            }
            onUbahDataSpasial={handleUbahDataSpasial}
            onHapusDataSpasial={handleHapusDataSpasial}
            onTerbitkanSertifikat={(sert) =>
              setSertifikatList((prev) => [sert, ...prev])
            }
            onUbahPenandatanganSertifikat={(nama, jabatan) => {
              handleUbahPenandatanganSertifikat(nama, jabatan);
              tampilkanToast(`✓ Penandatangan sertifikat diubah menjadi: ${nama}`);
            }}
            onTambahPengumuman={(p) => setPengumumanList((prev) => [p, ...prev])}
            onTambahTugas={handleTambahTugas}
            onHapusTugas={handleHapusTugas}
            onBalasPesanAdmin={(teks) => handleKirimPesan("admin", teks)}
            onFokusKePeta={handleFokusKePeta}
          />
        )}
      </main>

      {/* MODAL SMARTWATCH BLUETOOTH */}
      {bukaSmartwatch && (
        <SmartwatchModal
          dataSpasial={dataSpasial}
          profil={profil}
          onSimpanDataBaru={handleSimpanDataBaru}
          onTutup={() => setBukaSmartwatch(false)}
        />
      )}

      {/* BOTTOM NAVIGATION: BERBEDA UNTUK AKUN ADMIN DAN AKUN USER */}
      <nav className="avenza-bottom-nav">
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
              className={`avenza-nav-item ${tabAktif === "data_sync" ? "active" : ""}`}
              onClick={() => setTabAktif("data_sync")}
            >
              <div className="nav-icon-wrap">
                <CloudUpload size={20} />
                {antreanLokalCount > 0 && (
                  <span className="nav-badge">{antreanLokalCount}</span>
                )}
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
              <span>Peta Survei</span>
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

            <button
              type="button"
              className="avenza-nav-item"
              onClick={() => gantiPeranAkun("kader")}
              style={{ color: "#0d7344" }}
            >
              <User size={20} />
              <span>Mode User</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
};

export default App;
