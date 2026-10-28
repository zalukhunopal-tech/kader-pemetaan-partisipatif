import React, { useEffect, useRef, useState } from "react";
import {
  AreaPetaOffline,
  DataSpasialItem,
  KaderAktifPresence,
  KonfigurasiGDrive,
  LapisanSpasial,
  MenuTab,
  PembaruanObjek,
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
import { AkunSesi, muatSesiPengguna, simpanSesiPengguna } from "./lib/auth";
import { sinkronkanDataKeGDrive, urlAppsScriptValid } from "./lib/gdriveSync";
import { adalahDataSimulasi, dihitungUntukCapaian } from "./lib/geoUtils";
import { buatId } from "./lib/id";
import { fiturKeDataSpasial, parseBerkas, ringkasDilewati } from "./lib/impor";
import { hapusTileArea } from "./lib/petaOffline";
import { formatUkuranByte, perkiraanPenyimpanan, PerkiraanPenyimpanan, useStatusPenyimpanan } from "./lib/penyimpanan";
import { cekPembaruanBaru, hitungPembaruanSah } from "./lib/rewardEngine";
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
import { GantiSandiModal } from "./components/GantiSandiModal";
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
  Watch,
  KeyRound
} from "lucide-react";

export const App: React.FC = () => {
  // Sesi Pengguna Login
  const [sesiPengguna, setSesiPengguna] = useState<AkunSesi | null>(() =>
    muatSesiPengguna()
  );

  // Role & Session State
  // Admin boleh beralih ke tampilan kader, tetapi peran admin hanya berlaku untuk akun admin
  const [peranTampilan, setPeranTampilan] = useState<PeranPengguna>(() =>
    sesiPengguna ? sesiPengguna.peran : "kader"
  );
  const adalahAkunAdmin = sesiPengguna?.peran === "admin";
  const peran: PeranPengguna = adalahAkunAdmin ? peranTampilan : "kader";
  const [tabAktif, setTabAktif] = useState<MenuTab>(() =>
    sesiPengguna && sesiPengguna.peran === "admin" ? "admin" : "pustaka"
  );
  // Status jaringan nyata dari browser; tombol "Online/Offline" hanya menambah mode offline manual
  const [jaringanTersedia, setJaringanTersedia] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [modeOfflineManual, setModeOfflineManual] = useState<boolean>(false);
  const sedangOnline = jaringanTersedia && !modeOfflineManual;

  // Sub-halaman penuh & menu
  const [bukaPemberitahuan, setBukaPemberitahuan] = useState<boolean>(false);
  const [bukaPengaturanEkspor, setBukaPengaturanEkspor] = useState<boolean>(false);
  const [bukaMenuTitikTiga, setBukaMenuTitikTiga] = useState<boolean>(false);
  const [bukaSmartwatch, setBukaSmartwatch] = useState<boolean>(false);
  const [bukaGantiSandi, setBukaGantiSandi] = useState<boolean>(false);
  const [modePilihPustaka, setModePilihPustaka] = useState<boolean>(false);
  const [notifToast, setNotifToast] = useState<string | null>(null);
  const statusPenyimpanan = useStatusPenyimpanan();
  const [ruangPenyimpanan, setRuangPenyimpanan] = useState<PerkiraanPenyimpanan | null>(null);

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
  const [pesanSinkronGagal, setPesanSinkronGagal] = useState<boolean>(false);
  const sinkronBerjalanRef = useRef<boolean>(false);

  // Status Perekaman Data di Latar Belakang (Global di Semua Tab)
  const rekamLatar = usePerekamLatar();
  const [detikRekamTick, setDetikRekamTick] = useState<number>(0);

  useEffect(() => {
    if (rekamLatar.status !== "merekam") return;
    const t = window.setInterval(() => setDetikRekamTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [rekamLatar.status]);

  // Simpan perubahan ke LocalStorage (Offline-First)
  // Pantau sisa ruang penyimpanan agar pengguna diperingatkan sebelum data baru tak bisa disimpan
  useEffect(() => {
    let aktif = true;
    const periksa = () => {
      perkiraanPenyimpanan().then((r) => {
        if (aktif) setRuangPenyimpanan(r);
      });
    };
    periksa();
    const t = setInterval(periksa, 60_000);
    return () => {
      aktif = false;
      clearInterval(t);
    };
  }, [statusPenyimpanan.kuotaPenuh]);

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

  // Ikuti perubahan koneksi dari browser
  useEffect(() => {
    const naik = () => setJaringanTersedia(true);
    const turun = () => setJaringanTersedia(false);
    window.addEventListener("online", naik);
    window.addEventListener("offline", turun);
    return () => {
      window.removeEventListener("online", naik);
      window.removeEventListener("offline", turun);
    };
  }, []);

  const antreanLokalCount = dataSpasial.filter((d) => d.statusSinkron === "lokal").length;

  const tampilkanToast = (pesan: string) => {
    setNotifToast(pesan);
    setTimeout(() => setNotifToast(null), 3200);
  };

  // Handler Login Berhasil
  const handleLoginSukses = (akun: AkunSesi) => {
    setSesiPengguna(akun);
    setPeranTampilan(akun.peran);
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
    if (peranBaru === "admin" && !adalahAkunAdmin) {
      tampilkanToast("Akun ini tidak memiliki akses Administrator GIS.");
      return;
    }
    setPeranTampilan(peranBaru);
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
    tampilkanToast(
      adalahDataSimulasi(item)
        ? `✓ "${item.judul}" disimpan sebagai data simulasi (tidak dihitung ke capaian).`
        : `✓ "${item.judul}" disimpan ke Lapisan & memori HP.`
    );
  };

  // Handler Impor Berkas (GeoJSON, KML, GPX): fitur divalidasi, yang tidak valid dilewati dan
  // dilaporkan. Data impor ditandai dan baru dihitung ke capaian setelah diverifikasi admin.
  const handleImporBerkas = (namaBerkas: string, isi: string): boolean => {
    try {
      const hasil = parseBerkas(namaBerkas, isi);
      const konteks = {
        idKader: profil.idKader,
        namaKader: profil.nama,
        desaWilayah: profil.desaWilayah
      };
      const items = hasil.fitur.map((f) => fiturKeDataSpasial(f, konteks));
      const catatan = hasil.dilewati.length > 0 ? ` ${hasil.dilewati.length} dilewati: ${ringkasDilewati(hasil.dilewati)}.` : "";
      if (items.length === 0) {
        tampilkanToast(`⚠️ Tidak ada objek yang bisa diimpor dari ${namaBerkas}.${catatan}`);
        return false;
      }
      setDataSpasial((prev) => [...items, ...prev]);
      tampilkanToast(
        `✓ ${items.length} objek ${hasil.format} diimpor.${catatan} Dihitung ke capaian setelah diverifikasi admin.`
      );
      return true;
    } catch (err) {
      tampilkanToast(`⚠️ ${err instanceof Error ? err.message : "Berkas tidak dapat dibaca."}`);
      return false;
    }
  };

  // Hapus area peta offline; tile yang tersimpan ikut dihapus (kecuali yang dipakai area lain)
  const handleHapusAreaOffline = (id: string) => {
    const area = areaOffline.find((a) => a.id === id);
    if (!area) return;
    setAreaOffline((prev) => prev.filter((a) => a.id !== id));
    if (area.unduhanNyata) {
      void hapusTileArea(area, areaOffline).then((n) =>
        tampilkanToast(`✓ Peta "${area.namaArea}" dihapus (${n} tile dibersihkan).`)
      );
    }
  };

  // Handler Update Kondisi pada Objek Existing
  const handleTambahPembaruanObjek = (
    idData: string,
    kondisiTerbaru: string,
    catatan: string,
    fotoBase64?: string
  ): boolean => {
    const objek = dataSpasial.find((d) => d.id === idData);
    if (!objek) return false;

    // Satu pembaruan per objek per 24 jam, dan isinya harus berubah
    const cek = cekPembaruanBaru(objek, kondisiTerbaru, catatan);
    if (!cek.boleh) {
      tampilkanToast(`⚠️ ${cek.alasan}`);
      return false;
    }

    const pembaruan: PembaruanObjek = {
      id: buatId("UPD"),
      tanggal: new Date().toISOString(),
      idKader: profil.idKader,
      olehKader: profil.nama,
      kondisiTerbaru,
      catatan,
      fotoBase64
    };
    const objekBaru: DataSpasialItem = {
      ...objek,
      riwayatPembaruan: [...objek.riwayatPembaruan, pembaruan]
    };
    const dapatPoin =
      dihitungUntukCapaian(objek) &&
      hitungPembaruanSah(objekBaru) > hitungPembaruanSah(objek);

    setDataSpasial((prev) =>
      prev.map((d) =>
        d.id === idData
          ? {
              ...d,
              kondisiAncaman: kondisiTerbaru,
              updatedAt: pembaruan.tanggal,
              riwayatPembaruan: [...d.riwayatPembaruan, pembaruan]
            }
          : d
      )
    );
    tampilkanToast(
      dapatPoin
        ? "✓ Pembaruan kondisi objek berhasil disimpan (+1 Poin)."
        : "✓ Pembaruan kondisi objek disimpan (tidak menambah poin)."
    );
    return true;
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
    tampilkanToast(`✓ Tugas "${tugasBaru.judul}" disimpan di perangkat ini.`);
  };

  // Handler Hapus Tugas
  const handleHapusTugas = (id: string) => {
    setTugasList((prev) => prev.filter((t) => t.id !== id));
    tampilkanToast("✓ Tugas pemetaan dihapus.");
  };

  // Handler Sinkronisasi ke Google Drive & Sheets
  const handleSinkronkanSekarang = async (otomatis: boolean = false) => {
    if (sinkronBerjalanRef.current) return;
    if (!sedangOnline) {
      if (!otomatis) {
        setPesanSinkronGagal(true);
        setPesanSinkron(
          jaringanTersedia
            ? "⚠️ Mode offline manual aktif. Data tetap aman di HP; matikan mode offline untuk mengunggah."
            : "⚠️ Tidak ada koneksi internet. Data tetap aman di HP dan akan diunggah saat sinyal tersedia."
        );
      }
      return;
    }
    sinkronBerjalanRef.current = true;
    setSedangSinkron(true);
    if (!otomatis) setPesanSinkron(null);
    try {
      const res = await sinkronkanDataKeGDrive(dataSpasial, konfigGDrive);
      // Hanya data yang dikonfirmasi tersimpan oleh Apps Script yang berubah status
      if (res.idTersinkron.length > 0) {
        const diterima = new Set(res.idTersinkron);
        setDataSpasial((prev) =>
          prev.map((d) =>
            diterima.has(d.id) && d.statusSinkron === "lokal"
              ? { ...d, statusSinkron: "tersinkron" }
              : d
          )
        );
        setKonfigGDrive((prev) => ({
          ...prev,
          terakhirSinkron: new Date().toLocaleString("id-ID")
        }));
      }
      // Sinkron otomatis diam bila belum diatur; hasil lain selalu ditampilkan
      if (!(otomatis && res.belumDiatur)) {
        setPesanSinkronGagal(!res.sukses);
        setPesanSinkron(res.pesan);
        if (otomatis) {
          tampilkanToast(
            res.sukses
              ? `☁️ ${res.idTersinkron.length} data tersinkron otomatis.`
              : "⚠️ Sinkronisasi otomatis belum berhasil. Data tetap aman di HP."
          );
        }
      }
    } finally {
      sinkronBerjalanRef.current = false;
      setSedangSinkron(false);
    }
  };

  // Sinkron otomatis: saat ada internet dan ada antrean. Satu percobaan per perubahan antrean
  // atau koneksi, jadi server yang gagal tidak membuat percobaan berulang tanpa henti.
  useEffect(() => {
    if (!sesiPengguna) return;
    if (!sedangOnline || !konfigGDrive.autoSyncSaatOnline) return;
    if (!urlAppsScriptValid(konfigGDrive.webAppUrl) || antreanLokalCount === 0) return;
    const t = window.setTimeout(() => {
      void handleSinkronkanSekarang(true);
    }, 2000);
    return () => window.clearTimeout(t);
  }, [sedangOnline, konfigGDrive.autoSyncSaatOnline, konfigGDrive.webAppUrl, antreanLokalCount, !!sesiPengguna]);

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
      id: buatId("MSG"),
      saluran,
      idPengirim: peran === "admin" ? "ADMIN-01" : profil.idKader,
      namaPengirim: peran === "admin" ? "Admin GIS Organisasi" : profil.nama,
      peranPengirim: peran,
      desaPengirim: peran === "admin" ? "Pusat" : profil.desaWilayah,
      teks,
      waktu: new Date().toTimeString().slice(0, 5),
      statusKirim: "tersimpan",
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
                  onClick={() => setModeOfflineManual((m) => !m)}
                  title={
                    jaringanTersedia
                      ? "Ketuk untuk beralih mode offline manual (tidak mengunggah)"
                      : "Tidak ada koneksi internet"
                  }
                >
                  {sedangOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  <span>
                    {!jaringanTersedia ? "Offline" : modeOfflineManual ? "Offline (manual)" : "Online"}
                  </span>
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

              <button
                type="button"
                className="avenza-overflow-item"
                onClick={() => {
                  setBukaMenuTitikTiga(false);
                  setBukaGantiSandi(true);
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

      {/* PERINGATAN PENYIMPANAN: data baru yang tidak tersimpan harus terlihat, bukan hilang senyap */}
      {(statusPenyimpanan.galat || (ruangPenyimpanan && ruangPenyimpanan.persen >= 80)) && (
        <div className="banner-penyimpanan" role="alert">
          <strong>⚠ {statusPenyimpanan.galat ? "Data terbaru mungkin belum tersimpan" : "Penyimpanan perangkat hampir penuh"}</strong>
          <span>
            {statusPenyimpanan.galat ??
              `Terpakai ${formatUkuranByte(ruangPenyimpanan!.pakaiByte)} dari ${formatUkuranByte(ruangPenyimpanan!.kuotaByte)} (${Math.round(ruangPenyimpanan!.persen)}%).`}{" "}
            Ekspor atau sinkronkan data sekarang, lalu hapus peta offline atau objek yang tidak diperlukan.
          </span>
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
            onHapusAreaOffline={handleHapusAreaOffline}
            onTambahLapisan={(l) => {
              setLapisanList((prev) => [l, ...prev]);
              tampilkanToast(`✓ "${l.nama}" berhasil dibuat.`);
            }}
            onHapusLapisan={(id) =>
              setLapisanList((prev) => prev.filter((l) => l.id !== id))
            }
            onImporBerkas={handleImporBerkas}
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
            onImporBerkas={handleImporBerkas}
            onBukaSmartwatch={() => setBukaSmartwatch(true)}
          />
        )}

        {tabAktif === "data_sync" && (
          <DatabaseSyncView
            dataSpasial={dataSpasial}
            konfigGDrive={konfigGDrive}
            sedangSinkron={sedangSinkron}
            pesanSinkron={pesanSinkron}
            pesanSinkronGagal={pesanSinkronGagal}
            sedangOnline={sedangOnline}
            onSinkronkanSekarang={() => void handleSinkronkanSekarang(false)}
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
            onKirimPesan={handleKirimPesan}
            onLihatPinDiPeta={handleFokusKePeta}
          />
        )}

        {tabAktif === "admin" && peran === "admin" && (
          <AdminDashboardView
            dataSpasial={dataSpasial}
            profilKader={profil}
            sertifikatList={sertifikatList}
            tugasList={tugasList}
            kaderAktifList={kaderAktifList}
            sesiAdmin={sesiPengguna}
            onVerifikasiData={(id: string, status: StatusSinkron, catatan?: string) =>
              setDataSpasial((prev) =>
                prev.map((d) =>
                  d.id === id ? { ...d, statusSinkron: status, catatanAdmin: catatan } : d
                )
              )
            }
            onUbahDataSpasial={handleUbahDataSpasial}
            onHapusDataSpasial={handleHapusDataSpasial}
            onTerbitkanSertifikat={(sert) => {
              // Satu sertifikat per kader dan nomor tidak boleh kembar
              if (
                sertifikatList.some(
                  (s) => s.idKader === sert.idKader || s.nomorSertifikat === sert.nomorSertifikat
                )
              ) {
                tampilkanToast("⚠️ Sertifikat tidak diterbitkan: kader sudah punya sertifikat atau nomor kembar.");
                return;
              }
              setSertifikatList((prev) => [sert, ...prev]);
              tampilkanToast(`✓ Sertifikat ${sert.nomorSertifikat} diterbitkan untuk ${sert.namaKader}.`);
            }}
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

      {bukaGantiSandi && sesiPengguna && (
        <GantiSandiModal
          email={sesiPengguna.email}
          onTutup={() => setBukaGantiSandi(false)}
          onSukses={() => {
            setBukaGantiSandi(false);
            tampilkanToast("✓ Kata sandi berhasil diganti.");
          }}
        />
      )}

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
