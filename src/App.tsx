import { selesaikanKonflik } from "./lib/gdriveBertahap";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  AreaPetaOffline,
  DataSpasialItem,
  ItemPencadanganSpasial,
  KaderAktifPresence,
  LapisanSpasial,
  MenuTab,
  PembaruanObjek,
  PenandatanganSertifikatItem,
  PengumumanBroadcast,
  PeranPengguna,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  StatusGDrive,
  StatusSinkron,
  TugasPemetaan
} from "./types";
import {
  muatAreaOffline,
  muatDataSpasial,
  muatKaderAktif,
  muatStatusGDrive,
  muatLapisan,
  muatPencadanganSpasial,
  muatPengumuman,
  muatPesan,
  muatProfil,
  muatSertifikat,
  muatTugas,
  simpanAreaOffline,
  simpanDataSpasial,
  simpanKaderAktif,
  simpanStatusGDrive,
  simpanLapisan,
  simpanPencadanganSpasial,
  simpanPengumuman,
  simpanPesan,
  simpanProfil,
  simpanSertifikat,
  simpanTugas
} from "./lib/storage";
import {
  AkunSesi,
  aksesAdminSah,
  capWilayah,
  muatSesiPengguna,
  simpanSesiPengguna,
  sinkronkanDaftarAkunGDrive,
  sisaMasaTotp,
  verifikasiKunciSesiAktif
} from "./lib/auth";
import { catatAktivitasAdmin, gerbangAdminTerbuka, kunciGerbangAdmin, useVersiGerbangAdmin } from "./lib/gerbangAdmin";
import { aplikasiTerbuka, catatAktivitasAplikasi, kunciAplikasi, useVersiKunciAplikasi } from "./lib/kunciAplikasi";
import { metodeKunciCepat } from "./lib/kunciCepat";
import {
  gdriveTerpasang,
  hapusPermanenCadanganGDrive,
  perbaruiStatusVerifikasiGDrive,
  pindahKePencadanganGDrive,
  pulihkanDariPencadanganGDrive,
  sinkronkanDataKeGDrive,
  tarikStatusDatabaseGDrive,
  terapkanHasilSinkron,
  useAutoSyncGDrive
} from "./lib/gdriveSync";
import {
  pindahkanKePencadangan,
  pisahkanPencadanganKedaluwarsa,
  pulihkanItemDariPencadangan,
  rekonsiliasiDatabaseDenganGDrive
} from "./lib/pencadanganData";
import { adalahDataSimulasi, dihitungUntukCapaian } from "./lib/geoUtils";
import { hitungSkorKualitasData } from "./lib/kualitasData";
import { buatId } from "./lib/id";
import { abaikanGeserDari, arahGeser, Sentuhan, tabTujuan } from "./lib/geserTab";
import { fiturKeDataSpasial, parseBerkas, ringkasDilewati } from "./lib/impor";
import { hapusTileArea } from "./lib/petaOffline";
import { muatSemuaArsipPetaKeProtokol, hapusArsipPeta, rehidrasiArsipGeoPdf } from "./lib/penyimpananPetaLuring";
import { perkiraanPenyimpanan, PerkiraanPenyimpanan, useStatusPenyimpanan } from "./lib/penyimpanan";
import { cekPembaruanBaru, hitungPembaruanSah } from "./lib/rewardEngine";
import { perekamLatar, usePerekamLatar } from "./lib/perekamLatar";
import { kunciOrientasiLayar } from "./lib/posisiPerangkat";
import { AuthModal } from "./components/AuthModal";
import { PustakaView } from "./components/PustakaView";
import { PemberitahuanView } from "./components/PemberitahuanView";
import { PengaturanEksporView } from "./components/PengaturanEksporView";
import { KonteksEkspor } from "./lib/eksporFilter";
import { InteractiveMap } from "./components/InteractiveMap";
import { DatabaseSyncView } from "./components/DatabaseSyncView";
import { RewardView } from "./components/RewardView";
import { TugasPengumumanView } from "./components/TugasPengumumanView";
import { KomunikasiView } from "./components/KomunikasiView";
import { AdminDashboardView } from "./components/AdminDashboardView";
import { GantiSandiModal } from "./components/GantiSandiModal";
import { GerbangAdminView } from "./components/GerbangAdminView";
import { KunciAplikasiView } from "./components/KunciAplikasiView";
import { PengaturanKunciModal } from "./components/PengaturanKunciModal";
import { BannerInstal } from "./components/InstalAplikasi";
import { MenuAtas } from "./components/app/MenuAtas";
import { BannerModeAdmin, BannerPenyimpanan, BannerPerekaman } from "./components/app/BannerAplikasi";
import { NavigasiBawah } from "./components/app/NavigasiBawah";
import { LayarPembukaTaka, sudahTampilSplashTakaSesiIni } from "./components/LayarPembukaTaka";
import { BantuanBugView } from "./components/BantuanBugView";
import { pasangPenangkapBugGlobal, useInventarisBug } from "./lib/inventarisBug";
import { pasangPenjagaKembali, pastikanRiwayatPenjaga, PESAN_TEKAN_KEMBALI_LAGI, userSudahAktif } from "./lib/penjagaKembali";
import { sinkronkanLapisanDenganItem } from "./lib/tematik";
import { sinkronkanLapisanDariTugas } from "./lib/skemaTugas";
import { PullToRefresh } from "./components/common/PullToRefresh";

export const App: React.FC = () => {
  const [tampilSplashTaka, setTampilSplashTaka] = useState<boolean>(() => !sudahTampilSplashTakaSesiIni());
  // Sesi Pengguna Login
  const [sesiPengguna, setSesiPengguna] = useState<AkunSesi | null>(() => muatSesiPengguna());

  // Role & Session State
  // Admin boleh beralih ke tampilan kader, tetapi peran admin hanya berlaku untuk akun admin
  const [peranTampilan, setPeranTampilan] = useState<PeranPengguna>(() => (sesiPengguna ? sesiPengguna.peran : "kader"));
  const adalahAkunAdmin = sesiPengguna?.peran === "admin";
  const peran: PeranPengguna = adalahAkunAdmin ? peranTampilan : "kader";
  // Pemisahan admin dan user, dua lapis:
  // lapis 1 (tampilan): konten admin hanya dirender saat aksesAdmin;
  // lapis 2 (aksi): setiap aksi admin memeriksa ulang data akun terkini dan gerbang admin di memori
  // (dibuka dengan kode Authenticator, terkunci saat dimuat ulang, diam, atau beralih ke Mode User).
  useVersiGerbangAdmin();
  const gerbangTerbuka = adalahAkunAdmin && gerbangAdminTerbuka(sesiPengguna?.email);
  const modeAdminTerkunci = adalahAkunAdmin && peranTampilan === "admin" && !gerbangTerbuka;
  const aksesAdmin = adalahAkunAdmin && peranTampilan === "admin" && gerbangTerbuka;

  // Kunci aplikasi: kode Google Authenticator berlaku 8 jam; di antaranya aplikasi yang terkunci
  // (dibuka ulang atau diam 15 menit) dibuka dengan PIN atau sidik jari/wajah.
  useVersiKunciAplikasi();
  const [, setVersiKeamanan] = useState(0);
  const segarkanKeamanan = () => setVersiKeamanan((v) => v + 1);
  const emailSesi = sesiPengguna?.email;
  const metodeCepat = metodeKunciCepat(emailSesi);
  const layarKunci: "buka" | "siapkan" | null = !sesiPengguna
    ? null
    : !aplikasiTerbuka(emailSesi) || sisaMasaTotp(emailSesi) <= 0
      ? "buka"
      : !metodeCepat.pin && !metodeCepat.biometrik
        ? "siapkan"
        : null;
  const [bukaKeamanan, setBukaKeamanan] = useState<boolean>(false);
  const [tabAktif, setTabAktif] = useState<MenuTab>(() => {
    const bawaan: MenuTab = "peta";
    // Pintasan aplikasi terpasang (mis. tekan lama ikon > "Peta") membuka ?tab=...
    try {
      const diminta = new URLSearchParams(window.location.search).get("tab");
      const boleh: MenuTab[] = ["pustaka", "peta", "data_sync", "reward", "tugas", "komunikasi"];
      if (diminta && boleh.includes(diminta as MenuTab)) {
        window.history.replaceState(null, "", window.location.pathname);
        return diminta as MenuTab;
      }
    } catch {
      // abaikan
    }
    return bawaan;
  });
  // Status jaringan nyata dari browser; tombol "Online/Offline" hanya menambah mode offline manual
  const [jaringanTersedia, setJaringanTersedia] = useState<boolean>(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [modeOfflineManual, setModeOfflineManual] = useState<boolean>(false);
  const sedangOnline = jaringanTersedia && !modeOfflineManual;

  // Sub-halaman penuh & menu
  const [bukaPemberitahuan, setBukaPemberitahuan] = useState<boolean>(false);
  const [bukaPengaturanEkspor, setBukaPengaturanEkspor] = useState<boolean>(false);
  const [bukaBantuan, setBukaBantuan] = useState<boolean>(false);
  const [konteksEkspor, setKonteksEkspor] = useState<KonteksEkspor | null>(null);
  const [bukaMenuTitikTiga, setBukaMenuTitikTiga] = useState<boolean>(false);
  const [bukaGantiSandi, setBukaGantiSandi] = useState<boolean>(false);
  const [modePilihPustaka, setModePilihPustaka] = useState<boolean>(false);
  const inventarisBug = useInventarisBug();
  const konteksBugRef = useRef<{ lokasi?: string; pengguna?: string }>({});
  useEffect(() => {
    konteksBugRef.current = { lokasi: tabAktif, pengguna: sesiPengguna?.nama };
  }, [tabAktif, sesiPengguna?.nama]);
  useEffect(() => pasangPenangkapBugGlobal(() => konteksBugRef.current), []);
  // id naik setiap toast baru, sehingga efek di bawah memulai ulang hitung mundurnya
  const [notifToast, setNotifToast] = useState<{ pesan: string; id: number; urungkan?: () => void } | null>(null);
  /** Toast singkat; dengan `urungkan`, toast memuat tombol Urungkan dan tampil lebih lama */
  const tampilkanToast = useCallback(
    (pesan: string, urungkan?: () => void) => setNotifToast((lama) => ({ pesan, id: (lama?.id ?? 0) + 1, urungkan })),
    []
  );
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

  const [dataSpasial, setDataSpasial] = useState<DataSpasialItem[]>(() => muatDataSpasial());
  const [pencadanganList, setPencadanganList] = useState<ItemPencadanganSpasial[]>(
    () => pisahkanPencadanganKedaluwarsa(muatPencadanganSpasial()).aktif
  );
  const [sedangRekonsiliasi, setSedangRekonsiliasi] = useState<boolean>(false);
  const [areaOffline, setAreaOffline] = useState<AreaPetaOffline[]>(() => muatAreaOffline());
  const [tugasList, setTugasList] = useState<TugasPemetaan[]>(() => muatTugas());
  const [lapisanList, setLapisanList] = useState<LapisanSpasial[]>(() => sinkronkanLapisanDariTugas(muatLapisan(), muatTugas()));
  const [lapisanAktifId, setLapisanAktifId] = useState<string | null>(null);

  // Lapisan dan tugas yang dapat diakses oleh sesi pengguna aktif (agar tidak bercampur tugas antar-kader)
  const lapisanListUntukUser = useMemo(() => {
    if (sesiPengguna?.peran === "admin") return lapisanList;
    return lapisanList.filter((l) => {
      if (!l.tugasId) return true;
      if (!l.targetKader || l.targetKader.length === 0 || l.targetKader.includes("*")) return true;
      const id = sesiPengguna?.idKader?.toLowerCase();
      const email = sesiPengguna?.email?.toLowerCase();
      const nama = sesiPengguna?.nama?.toLowerCase();
      return l.targetKader.some((k) => {
        const target = k.toLowerCase().trim();
        return (id && target === id) || (email && target === email) || (nama && target === nama);
      });
    });
  }, [lapisanList, sesiPengguna]);

  const tugasListUntukUser = useMemo(() => {
    if (sesiPengguna?.peran === "admin") return tugasList;
    return tugasList.filter((t) => {
      if (!t.targetKader || t.targetKader.length === 0 || t.targetKader.includes("*")) return true;
      const id = sesiPengguna?.idKader?.toLowerCase();
      const email = sesiPengguna?.email?.toLowerCase();
      const nama = sesiPengguna?.nama?.toLowerCase();
      return t.targetKader.some((k) => {
        const target = k.toLowerCase().trim();
        return (id && target === id) || (email && target === email) || (nama && target === nama);
      });
    });
  }, [tugasList, sesiPengguna]);
  const [sertifikatList, setSertifikatList] = useState<SertifikatKader[]>(() => muatSertifikat());
  const [pengumumanList, setPengumumanList] = useState<PengumumanBroadcast[]>(() => muatPengumuman());
  const [pesanList, setPesanList] = useState<PesanKomunikasi[]>(() => muatPesan());
  const [pesanDibacaCount, setPesanDibacaCount] = useState<number>(() => {
    try {
      const v = localStorage.getItem("geokader_terakhir_baca_pesan_v1");
      return v !== null ? parseInt(v, 10) : muatPesan().length;
    } catch {
      return 0;
    }
  });

  const adaPesanBaru = tabAktif !== "komunikasi" && pesanList.length > pesanDibacaCount;

  // Bila pengguna berada di tab komunikasi, tandai semua pesan telah terbaca
  useEffect(() => {
    if (tabAktif === "komunikasi") {
      setPesanDibacaCount(pesanList.length);
      try {
        localStorage.setItem("geokader_terakhir_baca_pesan_v1", pesanList.length.toString());
      } catch {
        // Abaikan
      }
    }
  }, [tabAktif, pesanList.length]);

  // Sinkronisasi pesan antar tab browser
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "geokader_pesan" || e.key === "geokader_pesan_v5") {
        const pesanTerbaru = muatPesan();
        setPesanList(pesanTerbaru);
        if (tabAktif !== "komunikasi") {
          const pesanTerakhir = pesanTerbaru[pesanTerbaru.length - 1];
          if (pesanTerakhir) {
            tampilkanToast(
              `💬 Pesan baru dari ${pesanTerakhir.namaPengirim}: "${pesanTerakhir.teks.slice(0, 35)}${pesanTerakhir.teks.length > 35 ? "…" : ""}"`
            );
          }
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [tabAktif]);
  const [kaderAktifList] = useState<KaderAktifPresence[]>(() => muatKaderAktif());
  const [statusGDrive, setStatusGDrive] = useState<StatusGDrive>(() => muatStatusGDrive());

  const [petaKustomAktif, setPetaKustomAktif] = useState<AreaPetaOffline | null>(null);
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
  useEffect(() => simpanPencadanganSpasial(pencadanganList), [pencadanganList]);
  useEffect(() => simpanAreaOffline(areaOffline), [areaOffline]);
  useEffect(() => simpanLapisan(lapisanList), [lapisanList]);
  useEffect(() => simpanSertifikat(sertifikatList), [sertifikatList]);
  useEffect(() => simpanPengumuman(pengumumanList), [pengumumanList]);
  useEffect(() => simpanTugas(tugasList), [tugasList]);
  useEffect(() => simpanPesan(pesanList), [pesanList]);
  useEffect(() => simpanKaderAktif(kaderAktifList), [kaderAktifList]);
  useEffect(() => simpanStatusGDrive(statusGDrive), [statusGDrive]);

  // Inisialisasi protokol peta luring (PMTiles & MBTiles) serta rehidrasi GeoPDF dari penyimpanan IndexedDB
  useEffect(() => {
    kunciOrientasiLayar();
    void muatSemuaArsipPetaKeProtokol();
    void rehidrasiArsipGeoPdf().then((petaPulih) => {
      const ids = Object.keys(petaPulih);
      if (ids.length === 0) return;
      setAreaOffline((lama) =>
        lama.map((area) => {
          const pulih = petaPulih[area.id];
          if (!pulih) return area;
          return {
            ...area,
            petaKustomDataUrl: pulih.dataUrl,
            thumbnailDataUrl: area.thumbnailDataUrl || pulih.thumbnailDataUrl
          };
        })
      );
    });
  }, []);

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

  const handleTandaiTersinkron = useCallback((idTersinkron: string[]) => {
    setDataSpasial((lama) => {
      const set = new Set(idTersinkron);
      const next = lama.map((d) =>
        set.has(d.id) ? { ...d, statusSinkron: "tersinkron" as const, updatedAt: new Date().toISOString() } : d
      );
      simpanDataSpasial(next);
      return next;
    });
  }, []);

  const autoSync = useAutoSyncGDrive(dataSpasial, handleTandaiTersinkron);
  const antreanLokalCount = dataSpasial.filter((d) => d.statusSinkron === "lokal").length;

  // Toast hilang 3,2 detik setelah toast TERAKHIR (toast baru membatalkan hitung mundur yang lama)
  useEffect(() => {
    if (!notifToast) return;
    const t = window.setTimeout(() => setNotifToast(null), notifToast.urungkan ? 6000 : 3200);
    return () => window.clearTimeout(t);
  }, [notifToast]);

  // Cegah keluar langsung pada tekanan tombol Back pertama: tutup panel anak jika ada,
  // atau minta pengguna menekan Back 2 kali dalam 2 detik sebelum keluar dari aplikasi.
  const tutupLapisanTeratasRef = useRef<() => boolean>(() => false);
  tutupLapisanTeratasRef.current = () => {
    if (!sesiPengguna || layarKunci !== null) return false;
    if (bukaMenuTitikTiga) {
      setBukaMenuTitikTiga(false);
      return true;
    }
    if (bukaKeamanan) {
      setBukaKeamanan(false);
      return true;
    }
    if (bukaGantiSandi) {
      setBukaGantiSandi(false);
      return true;
    }
    if (bukaBantuan) {
      setBukaBantuan(false);
      return true;
    }
    if (bukaPengaturanEkspor) {
      setBukaPengaturanEkspor(false);
      setKonteksEkspor(null);
      return true;
    }
    if (bukaPemberitahuan) {
      setBukaPemberitahuan(false);
      return true;
    }
    if (tabAktif === "pustaka" && modePilihPustaka) {
      setModePilihPustaka(false);
      return true;
    }
    if (tabAktif !== "peta") {
      setTabAktif("peta");
      return true;
    }
    return false;
  };

  useEffect(
    () =>
      pasangPenjagaKembali({
        onTutupLapisanTeratas: () => tutupLapisanTeratasRef.current(),
        onPeringatanKeluar: () => tampilkanToast(PESAN_TEKAN_KEMBALI_LAGI)
      }),
    [tampilkanToast]
  );

  // Pastikan riwayat penjaga tombol Back terpasang setiap kali pindah dari tab home (Peta Interaktif) atau membuka sub-halaman
  useEffect(() => {
    if (!userSudahAktif()) return;
    if (
      tabAktif !== "peta" ||
      bukaPemberitahuan ||
      bukaPengaturanEkspor ||
      bukaBantuan ||
      bukaGantiSandi ||
      bukaKeamanan ||
      bukaMenuTitikTiga
    ) {
      pastikanRiwayatPenjaga();
    }
  }, [tabAktif, bukaPemberitahuan, bukaPengaturanEkspor, bukaBantuan, bukaGantiSandi, bukaKeamanan, bukaMenuTitikTiga]);

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
    setTabAktif("peta");
    tampilkanToast(`✓ Selamat datang, ${akun.nama} (${akun.peran === "admin" ? "Admin GIS" : "Kader Lapangan"})!`);
  };

  // Handler Logout
  const handleLogout = () => {
    perekamLatar.batal();
    kunciGerbangAdmin();
    kunciAplikasi();
    simpanSesiPengguna(null);
    setSesiPengguna(null);
    setTabAktif("peta");
    setBukaKeamanan(false);
    tampilkanToast("Anda telah keluar dari aplikasi Titik Tapak.");
  };

  // Switch Peran Pengguna (Admin vs User/Kader)
  const gantiPeranAkun = (peranBaru: PeranPengguna) => {
    if (peranBaru === "admin" && !adalahAkunAdmin) {
      tampilkanToast("Akun ini tidak memiliki akses Administrator GIS.");
      return;
    }
    setPeranTampilan(peranBaru);
    // Keluar dari mode admin selalu mengunci gerbang; kembali ke mode admin meminta kode Authenticator lagi
    if (peranBaru === "kader") kunciGerbangAdmin();
    if (peranBaru === "admin") {
      setTabAktif("admin");
      tampilkanToast("🛡️ Beralih ke Akun Administrator GIS.");
    } else {
      setTabAktif("peta");
      tampilkanToast("👤 Beralih ke Akun Kader Lapangan (User).");
    }
  };

  // Geser kiri/kanan di area konten untuk berpindah tab (mengikuti urutan bilah navigasi bawah)
  const urutanTab: MenuTab[] =
    peran === "admin" ? ["admin", "peta", "data_sync", "komunikasi"] : ["pustaka", "peta", "data_sync", "reward", "komunikasi"];
  const awalGeserRef = useRef<Sentuhan | null>(null);
  const [animasiGeser, setAnimasiGeser] = useState<"kiri" | "kanan" | null>(null);
  const handleGeserMulai = (e: React.TouchEvent) => {
    const t = e.touches[0];
    awalGeserRef.current = e.touches.length === 1 && !abaikanGeserDari(e.target) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
  };
  const handleGeserSelesai = (e: React.TouchEvent) => {
    const awal = awalGeserRef.current;
    awalGeserRef.current = null;
    const t = e.changedTouches[0];
    if (!awal || !t) return;
    const arah = arahGeser(awal, { x: t.clientX, y: t.clientY, t: Date.now() });
    const tujuan = tabTujuan(urutanTab, tabAktif, arah);
    if (tujuan === tabAktif) return;
    setAnimasiGeser(arah === 1 ? "kiri" : "kanan");
    setTabAktif(tujuan);
  };
  useEffect(() => {
    if (!animasiGeser) return;
    const t = window.setTimeout(() => setAnimasiGeser(null), 260);
    return () => window.clearTimeout(t);
  }, [animasiGeser, tabAktif]);

  /** Lapis 2: setiap aksi admin diperiksa ulang; bila tidak sah, mode admin dikunci dan aksi dibatalkan */
  const wajibAdmin =
    <A extends unknown[]>(aksi: (...args: A) => void) =>
    (...args: A) => {
      if (peranTampilan !== "admin" || !aksesAdminSah(sesiPengguna)) {
        kunciGerbangAdmin();
        tampilkanToast("⛔ Aksi admin ditolak: mode admin terkunci atau sesi tidak sah.");
        return;
      }
      catatAktivitasAdmin();
      aksi(...args);
    };

  const handleLogoutRef = useRef<(() => void) | null>(null);
  handleLogoutRef.current = handleLogout;

  // Kunci aplikasi, gerbang admin, masa 8 jam, & validasi sesi tunggal diperiksa berkala
  const masaTotpHabisRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!emailSesi) return;
    let aktif = true;
    const periksaSesiTunggal = async () => {
      if (!aktif || !sesiPengguna) return;
      if (sesiPengguna.peran === "admin") {
        void sinkronkanDaftarAkunGDrive();
      }
      const res = await verifikasiKunciSesiAktif(sesiPengguna);
      if (aktif && !res.sah) {
        handleLogoutRef.current?.();
        tampilkanToast("⛔ Sesi dihentikan: akun dipakai perangkat lain atau dilepas Administrator.");
      }
    };
    const periksa = () => {
      // keduanya mengunci sendiri (dan memberi tahu App) bila batas diam terlewati
      aplikasiTerbuka(emailSesi);
      gerbangAdminTerbuka(emailSesi);
      // masa 8 jam tidak punya pemberitahuan sendiri: gambar ulang hanya saat statusnya berubah
      const habis = sisaMasaTotp(emailSesi) <= 0;
      if (habis !== masaTotpHabisRef.current) {
        masaTotpHabisRef.current = habis;
        segarkanKeamanan();
      }
    };
    const saatTampil = () => {
      if (document.visibilityState === "visible") {
        periksa();
        void periksaSesiTunggal();
      }
    };
    void periksaSesiTunggal();
    const t = window.setInterval(periksa, 15_000);
    const tSesi = window.setInterval(() => {
      void periksaSesiTunggal();
    }, 30_000);
    document.addEventListener("visibilitychange", saatTampil);
    return () => {
      aktif = false;
      window.clearInterval(t);
      window.clearInterval(tSesi);
      document.removeEventListener("visibilitychange", saatTampil);
    };
  }, [emailSesi, sesiPengguna, tampilkanToast]);

  // Isi aplikasi di belakang layar kunci tetap terpasang (formulir tidak hilang) tetapi tidak bisa
  // disentuh, difokus, atau dibaca pembaca layar
  const bungkusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (bungkusRef.current) bungkusRef.current.inert = layarKunci !== null;
  });

  // Handler Ubah Nama & Jabatan Penandatangan Sertifikat oleh Admin
  const handleUbahPenandatanganSertifikat = (
    namaPenandatangan: string,
    jabatanPenandatangan: string,
    daftarPenandatangan?: PenandatanganSertifikatItem[]
  ) => {
    setProfil((prev) => ({
      ...prev,
      namaPenandatanganSertifikat: daftarPenandatangan?.[0]?.nama || namaPenandatangan,
      jabatanPenandatanganSertifikat: daftarPenandatangan?.[0]?.jabatan || jabatanPenandatangan,
      ...(daftarPenandatangan && daftarPenandatangan.length > 0 ? { penandatanganList: daftarPenandatangan } : {})
    }));
    setSertifikatList((prev) =>
      prev.map((s) => ({
        ...s,
        ditandatanganiOleh: daftarPenandatangan?.[0]?.nama || namaPenandatangan,
        jabatanPenandatangan: daftarPenandatangan?.[0]?.jabatan || jabatanPenandatangan,
        ...(daftarPenandatangan && daftarPenandatangan.length > 0 ? { penandatanganList: daftarPenandatangan } : {})
      }))
    );
  };

  // Handler Simpan Data Spasial Baru dari Peta (User Feature)
  const handleSimpanDataBaru = (item: DataSpasialItem) => {
    const berikutnya = [item, ...dataSpasial];
    setDataSpasial(berikutnya);
    if (item.tematik) {
      setLapisanList((lama) => sinkronkanLapisanDenganItem(lama, item, berikutnya));
    }
    tampilkanToast(
      adalahDataSimulasi(item)
        ? `✓ "${item.judul}" disimpan sebagai data simulasi (tidak dihitung ke capaian).`
        : item.tematik
          ? `✓ "${item.judul}" masuk ke kolam tematik "${item.tematik}".`
          : `✓ "${item.judul}" disimpan ke peta (non-tematik).`
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
        desaWilayah: profil.desaWilayah,
        ...capWilayah(profil.idKader)
      };
      const items = hasil.fitur.map((f) => fiturKeDataSpasial(f, konteks));
      const catatan = hasil.dilewati.length > 0 ? ` ${hasil.dilewati.length} dilewati: ${ringkasDilewati(hasil.dilewati)}.` : "";
      if (items.length === 0) {
        tampilkanToast(`⚠️ Tidak ada objek yang bisa diimpor dari ${namaBerkas}.${catatan}`);
        return false;
      }
      setDataSpasial((prev) => [...items, ...prev]);
      tampilkanToast(`✓ ${items.length} objek ${hasil.format} diimpor.${catatan} Dihitung ke capaian setelah diverifikasi admin.`);
      return true;
    } catch (err) {
      tampilkanToast(`⚠️ ${err instanceof Error ? err.message : "Berkas tidak dapat dibaca."}`);
      return false;
    }
  };

  // Hapus area peta offline; tile yang tersimpan ikut dihapus (kecuali yang dipakai area lain)
  // Berkas peta dan tile baru dibersihkan setelah waktu Urungkan habis (atau saat halaman ditutup)
  const hapusPetaTertunda = useRef(new Map<string, { timer: number; jalankan: () => void }>());
  useEffect(() => {
    const jalankanSemua = () => {
      hapusPetaTertunda.current.forEach((h) => {
        window.clearTimeout(h.timer);
        h.jalankan();
      });
      hapusPetaTertunda.current.clear();
      setTabAktif("peta");
    };
    window.addEventListener("pagehide", jalankanSemua);
    return () => window.removeEventListener("pagehide", jalankanSemua);
  }, []);
  const handleHapusAreaOffline = (id: string) => {
    const indeks = areaOffline.findIndex((a) => a.id === id);
    const area = areaOffline[indeks];
    if (!area) return;
    const daftarSebelum = areaOffline;
    setAreaOffline((prev) => prev.filter((a) => a.id !== id));
    const jalankan = () => {
      hapusPetaTertunda.current.delete(id);
      void hapusArsipPeta(id);
      if (area.unduhanNyata) void hapusTileArea(area, daftarSebelum);
    };
    hapusPetaTertunda.current.set(id, { timer: window.setTimeout(jalankan, 6500), jalankan });
    tampilkanToast(`Peta "${area.namaArea}" dihapus.`, () => {
      const tertunda = hapusPetaTertunda.current.get(id);
      if (tertunda) window.clearTimeout(tertunda.timer);
      hapusPetaTertunda.current.delete(id);
      setAreaOffline((prev) => (prev.some((a) => a.id === id) ? prev : [...prev.slice(0, indeks), area, ...prev.slice(indeks)]));
    });
  };

  // Handler Update Kondisi pada Objek Existing
  const handleTambahPembaruanObjek = (idData: string, kondisiTerbaru: string, catatan: string, fotoBase64?: string): boolean => {
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
    const dapatPoin = dihitungUntukCapaian(objek) && hitungPembaruanSah(objekBaru) > hitungPembaruanSah(objek);

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
      dapatPoin ? "✓ Pembaruan kondisi objek berhasil disimpan (+1 Poin)." : "✓ Pembaruan kondisi objek disimpan (tidak menambah poin)."
    );
    return true;
  };

  // Handler Ubah Data Spasial oleh Admin (Admin Feature)
  const handleUbahDataSpasial = (dataDiubah: DataSpasialItem) => {
    setDataSpasial((prev) => prev.map((d) => (d.id === dataDiubah.id ? { ...dataDiubah, updatedAt: new Date().toISOString() } : d)));
    tampilkanToast(`✓ Data "${dataDiubah.judul}" berhasil diperbarui oleh Admin.`);
  };

  // Handler Perbarui Data Spasial langsung dari Peta Interaktif (edit nama, koordinat, deskripsi, corak, elevasi, foto, lapisan)
  const handlePerbaruiDataDariPeta = (dataDiubah: DataSpasialItem) => {
    const lama = dataSpasial.find((d) => d.id === dataDiubah.id);
    if (!lama) return;
    const bolehAdmin = aksesAdmin && aksesAdminSah(sesiPengguna);
    if (!bolehAdmin && lama.idKader && lama.idKader !== profil.idKader) {
      tampilkanToast("⛔ Hanya pemilik data atau Admin yang dapat mengubah objek ini.");
      return;
    }
    const statusBerikut: StatusSinkron =
      !bolehAdmin && lama.statusSinkron === "tersinkron" ? "lokal" : dataDiubah.statusSinkron;
    const itemFinal: DataSpasialItem = {
      ...dataDiubah,
      statusSinkron: statusBerikut,
      updatedAt: new Date().toISOString()
    };
    itemFinal.kualitasData = hitungSkorKualitasData(itemFinal);
    setDataSpasial((prev) => prev.map((d) => (d.id === itemFinal.id ? itemFinal : d)));
    tampilkanToast(`✓ Perubahan "${itemFinal.judul}" disimpan.`);
  };

  // Handler Hapus Data Spasial oleh Admin -> pindah ke Pencadangan 90 Hari (lokal + Google Drive Pencadangan_90_Hari)
  const handleHapusDataSpasial = (id: string) => {
    const indeks = dataSpasial.findIndex((d) => d.id === id);
    const item = dataSpasial[indeks];
    if (!item) return;

    const entri = pindahkanKePencadangan(item, sesiPengguna?.nama || "Admin GIS");
    setDataSpasial((prev) => prev.filter((d) => d.id !== id));
    setPencadanganList((prev) => [entri, ...prev.filter((p) => p.id !== id)]);

    if (gdriveTerpasang() && sedangOnline && (item.statusSinkron === "tersinkron" || item.statusSinkron === "terverifikasi")) {
      void pindahKePencadanganGDrive(entri).then((res) => {
        if (res.sukses) {
          setPencadanganList((prev) => prev.map((p) => (p.id === id ? { ...p, statusGDrive: "di_pencadangan" } : p)));
        }
      });
    }

    tampilkanToast(`Data "${item.judul}" dipindahkan ke Pencadangan 90 Hari (tidak lagi dihitung ke level).`, () => {
      setPencadanganList((prev) => prev.filter((p) => p.id !== id));
      setDataSpasial((prev) => (prev.some((d) => d.id === id) ? prev : [...prev.slice(0, indeks), item, ...prev.slice(indeks)]));
      if (gdriveTerpasang() && sedangOnline && (item.statusSinkron === "tersinkron" || item.statusSinkron === "terverifikasi")) {
        void pulihkanDariPencadanganGDrive(entri);
      }
    });
  };

  // Handler Pulihkan Data dari Pencadangan 90 Hari ke Database Aktif
  const handlePulihkanCadangan = (id: string) => {
    const entri = pencadanganList.find((p) => p.id === id);
    if (!entri) return;
    const itemPulih = pulihkanItemDariPencadangan(entri);
    setPencadanganList((prev) => prev.filter((p) => p.id !== id));
    setDataSpasial((prev) => (prev.some((d) => d.id === id) ? prev : [itemPulih, ...prev]));
    if (gdriveTerpasang() && sedangOnline && entri.statusGDrive !== "lokal_saja") {
      void pulihkanDariPencadanganGDrive(entri);
    }
    tampilkanToast(`✓ "${itemPulih.judul}" dipulihkan kembali ke database aktif.`);
  };

  // Handler Hapus Permanen dari Pencadangan 90 Hari
  const handleHapusPermanenCadangan = (id: string) => {
    const entri = pencadanganList.find((p) => p.id === id);
    if (!entri) return;
    setPencadanganList((prev) => prev.filter((p) => p.id !== id));
    if (gdriveTerpasang() && sedangOnline && entri.statusGDrive !== "lokal_saja") {
      void hapusPermanenCadanganGDrive(id);
    }
    tampilkanToast(`🗑️ "${entri.data.judul}" dihapus secara permanen.`);
  };

  // Sinkronkan perubahan status pencadangan tertunda & rekonsiliasi status aktif dengan Google Drive
  const jalankanRekonsiliasiGDrive = async (otomatis = false) => {
    if (!gdriveTerpasang() || !sedangOnline || sedangRekonsiliasi) {
      if (!otomatis) {
        tampilkanToast(
          !gdriveTerpasang()
            ? "Koneksi Google Drive belum dipasang pada build ini."
            : "Perangkat sedang offline; pengecekan database GDrive ditunda."
        );
      }
      return;
    }
    setSedangRekonsiliasi(true);
    try {
      // 1. Bersihkan entri lokal yang sudah lewat 90 hari
      const hasilRetensi = pisahkanPencadanganKedaluwarsa(pencadanganList);
      for (const kadaluarsa of hasilRetensi.kedaluwarsa) {
        if (kadaluarsa.statusGDrive !== "lokal_saja") {
          await hapusPermanenCadanganGDrive(kadaluarsa.id);
        }
      }

      // 2. Dorong pemindahan ke pencadangan yang sempat tertunda saat offline
      const cadanganTersinkron = await Promise.all(
        hasilRetensi.aktif.map(async (entri) => {
          if (entri.statusGDrive === "menunggu_pindah") {
            const res = await pindahKePencadanganGDrive(entri);
            if (res.sukses) return { ...entri, statusGDrive: "di_pencadangan" as const };
          }
          return entri;
        })
      );

      // 3. Tarik daftar ID aktif & pencadangan asli dari spreadsheet Google Drive
      const tarik = await tarikStatusDatabaseGDrive();
      if (tarik.sukses && tarik.snapshot) {
        const rek = rekonsiliasiDatabaseDenganGDrive(dataSpasial, cadanganTersinkron, tarik.snapshot);
        setDataSpasial(rek.dataAktif);
        setPencadanganList(rek.pencadangan);
        if (!otomatis) {
          tampilkanToast(
            `✓ Database GDrive dicek: ${rek.dataAktif.length} aktif, ${rek.pencadangan.length} di pencadangan` +
              (rek.jumlahDipindahKeCadangan + rek.jumlahDihapusDariLokal > 0
                ? ` (${rek.jumlahDipindahKeCadangan + rek.jumlahDihapusDariLokal} disesuaikan).`
                : ".")
          );
        }
      } else {
        setPencadanganList(cadanganTersinkron);
        if (!otomatis) tampilkanToast(`⚠️ ${tarik.pesan || "Belum dapat membaca status database GDrive."}`);
      }
    } finally {
      setSedangRekonsiliasi(false);
    }
  };

  // Handler Tambah Tugas Baru oleh Admin (Admin Feature)
  const handleTambahTugas = (tugasBaru: TugasPemetaan) => {
    const daftarTugasBaru = [tugasBaru, ...tugasList];
    setTugasList(daftarTugasBaru);
    setLapisanList((prev) => sinkronkanLapisanDariTugas(prev, daftarTugasBaru));
    tampilkanToast(`✓ Tugas "${tugasBaru.judul}" disimpan dan ditautkan ke menu Lapisan.`);
  };

  // Handler Ubah Tugas dan Skema Isian oleh Admin
  const handleUbahTugas = (tugasDiubah: TugasPemetaan) => {
    const daftarTugasBaru = tugasList.map((t) => (t.id === tugasDiubah.id ? tugasDiubah : t));
    setTugasList(daftarTugasBaru);
    setLapisanList((prev) => sinkronkanLapisanDariTugas(prev, daftarTugasBaru));
    tampilkanToast(`✓ Perubahan tugas "${tugasDiubah.judul}" dan skema lapisan disimpan.`);
  };

  // Handler Hapus Tugas
  const handleHapusTugas = (id: string) => {
    const indeks = tugasList.findIndex((t) => t.id === id);
    const tugas = tugasList[indeks];
    const daftarTugasBaru = tugasList.filter((t) => t.id !== id);
    setTugasList(daftarTugasBaru);
    setLapisanList((prev) => sinkronkanLapisanDariTugas(prev, daftarTugasBaru));
    if (lapisanAktifId === `LAP-TGS-${id}`) {
      setLapisanAktifId(null);
    }
    if (!tugas) return;
    tampilkanToast(`Tugas "${tugas.judul}" dihapus.`, () => {
      setTugasList((prev) => {
        const pulih = prev.some((t) => t.id === id) ? prev : [...prev.slice(0, indeks), tugas, ...prev.slice(indeks)];
        setLapisanList((l) => sinkronkanLapisanDariTugas(l, pulih));
        return pulih;
      });
    });
  };

  // Handler Klaim / Verifikasi Penyelesaian Tugas (Kader mengajukan -> Admin memverifikasi untuk +60 poin)
  const handleTandaiTugasSelesai = (id: string) => {
    if (aksesAdmin && aksesAdminSah(sesiPengguna)) {
      setTugasList((prev) => prev.map((t) => (t.id === id ? { ...t, status: "selesai" } : t)));
      tampilkanToast("✓ Tugas pemetaan diverifikasi selesai oleh Admin.");
      return;
    }
    setTugasList((prev) => prev.map((t) => (t.id === id && t.status === "aktif" ? { ...t, status: "menunggu_verifikasi" } : t)));
    tampilkanToast("✓ Tugas diajukan selesai dan menunggu verifikasi Admin GIS.");
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
      const res = await sinkronkanDataKeGDrive(dataSpasial);
      if (res.konfirmasi || res.konflik) {
        setDataSpasial((prev) => terapkanHasilSinkron(prev, res));
      }
      // Hanya data yang dikonfirmasi tersimpan oleh Apps Script yang berubah status
      if (res.idTersinkron.length > 0) {
        const diterima = new Set(res.idTersinkron);
        if (!res.konfirmasi)
          setDataSpasial((prev) =>
            prev.map((d) => (diterima.has(d.id) && d.statusSinkron === "lokal" ? { ...d, statusSinkron: "tersinkron" } : d))
          );
        setStatusGDrive({ terakhirSinkron: new Date().toLocaleString("id-ID") });
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

  // Sinkron otomatis (selalu aktif bila Google Drive terpasang di build ini): saat ada internet dan ada
  // antrean. Satu percobaan per perubahan antrean atau koneksi, jadi server yang gagal tidak membuat
  // percobaan berulang tanpa henti.
  const adaSesi = sesiPengguna !== null;
  useEffect(() => {
    if (!adaSesi || !sedangOnline || !gdriveTerpasang() || antreanLokalCount === 0) return;
    const t = window.setTimeout(() => {
      void handleSinkronkanSekarang(true);
    }, 2000);
    return () => window.clearTimeout(t);
    // Sengaja hanya dipicu perubahan koneksi dan antrean (bukan setiap render ulang),
    // sehingga satu perubahan menghasilkan paling banyak satu percobaan sinkron otomatis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedangOnline, antreanLokalCount, adaSesi]);

  const pendingCadanganCount = pencadanganList.filter((c) => c.statusGDrive === "menunggu_pindah").length;
  useEffect(() => {
    if (!adaSesi || !sedangOnline || !gdriveTerpasang() || pendingCadanganCount === 0) return;
    const t = window.setTimeout(() => {
      void jalankanRekonsiliasiGDrive(true);
    }, 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedangOnline, pendingCadanganCount, adaSesi]);

  // Handler Pull to Refresh Global: menarik layar ke bawah menyegarkan dan menyinkronkan data
  const handleRefreshGlobal = async () => {
    try {
      if (gdriveTerpasang() && sedangOnline) {
        await handleSinkronkanSekarang(false);
        await sinkronkanDaftarAkunGDrive();
        if (aksesAdmin) {
          await jalankanRekonsiliasiGDrive(false);
        }
      } else {
        // Muat ulang state lokal bila luring
        setDataSpasial(muatDataSpasial());
        setTugasList(muatTugas());
        setPencadanganList(muatPencadanganSpasial());
        setLapisanList(sinkronkanLapisanDariTugas(muatLapisan(), muatTugas()));
      }
      tampilkanToast("🔄 Data berhasil diperbarui.");
    } catch {
      tampilkanToast("⚠️ Gagal menyegarkan data. Periksa koneksi internet.");
    }
  };

  // Handler Fokus ke Titik Koordinat di Peta (dan aktifkan lapisan tugas bila dipicu dari kartu Tugas)
  const handleFokusKePeta = (lat: number, lng: number, label: string, tugasId?: string) => {
    if (tugasId) {
      setLapisanAktifId(`LAP-TGS-${tugasId}`);
    }
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
      setFokusKoordinat({ lat, lng, label });
    }
    setTabAktif("peta");
  };

  // Handler Kirim Pesan Chat / WhatsApp Style
  const handleKirimPesan = (
    saluran: "komunitas" | "admin",
    teks: string,
    pinKoordinat?: { lat: number; lng: number; label: string },
    durasiSuaraDetik?: number,
    kustomPengirim?: {
      idPengirim?: string;
      namaPengirim?: string;
      peranPengirim?: PeranPengguna;
      desaPengirim?: string;
      eskalasiAdmin?: boolean;
      audioDataUrl?: string;
    }
  ) => {
    const msgBaru: PesanKomunikasi = {
      id: buatId("MSG"),
      saluran,
      idPengirim: kustomPengirim?.idPengirim ?? (aksesAdmin ? "ADMIN-01" : profil.idKader),
      namaPengirim: kustomPengirim?.namaPengirim ?? (aksesAdmin ? "Admin GIS Organisasi" : profil.nama),
      peranPengirim: kustomPengirim?.peranPengirim ?? (aksesAdmin ? "admin" : "kader"),
      desaPengirim: kustomPengirim?.desaPengirim ?? (aksesAdmin ? "Pusat" : profil.desaWilayah),
      teks,
      waktu: new Date().toTimeString().slice(0, 5),
      statusKirim: "tersimpan",
      pinKoordinat,
      durasiSuaraDetik,
      audioDataUrl: kustomPengirim?.audioDataUrl,
      eskalasiAdmin: kustomPengirim?.eskalasiAdmin
    };
    setPesanList((prev) => [...prev, msgBaru]);
    if (tabAktif !== "komunikasi") {
      tampilkanToast(`💬 Pesan baru dari ${msgBaru.namaPengirim}: "${teks.slice(0, 35)}${teks.length > 35 ? "…" : ""}"`);
    }
  };

  const handleHapusPesan = (idPesan: string) => {
    const target = pesanList.find((p) => p.id === idPesan);
    if (!target) return;
    const bolehAdmin = aksesAdmin && aksesAdminSah(sesiPengguna);
    if (!bolehAdmin && target.idPengirim !== profil.idKader) {
      tampilkanToast("⛔ Anda hanya dapat menghapus pesan milik Anda sendiri.");
      return;
    }
    setPesanList((prev) => prev.filter((p) => p.id !== idPesan));
    tampilkanToast("Pesan dihapus dari obrolan.");
  };

  const handleTeruskanPesan = (pesan: PesanKomunikasi, saluranTujuan: "komunitas" | "admin") => {
    handleKirimPesan(
      saluranTujuan,
      pesan.teks,
      pesan.pinKoordinat,
      pesan.durasiSuaraDetik,
      pesan.audioDataUrl ? { audioDataUrl: pesan.audioDataUrl } : undefined
    );
    tampilkanToast(`Pesan diteruskan ke ${saluranTujuan === "komunitas" ? "Grup Komunitas" : "Admin GIS"}.`);
  };

  const handleEskalasiKeAdmin = (pertanyaan: string, namaKader: string) => {
    tampilkanToast(`📢 Pertanyaan diteruskan ke Admin Nopal: "${pertanyaan.slice(0, 45)}..."`);
    const notif: PengumumanBroadcast = {
      id: buatId("NTF"),
      judul: `[Eskalasi AI] Pertanyaan dari ${namaKader}`,
      isi: `Kader ${namaKader} menanyakan hal di luar cakupan bot atau membutuhkan konfirmasi langsung admin:\n\n"${pertanyaan}"\n\nSilakan cek tab Komunikasi > Saluran Admin untuk membalas secara langsung.`,
      kategori: "Info Umum",
      targetDesa: "Semua Wilayah",
      olehAdmin: "Asisten AI",
      tanggal: new Date().toISOString().slice(0, 10),
      penting: true
    };
    setPengumumanList((prev) => [notif, ...prev]);
  };

  const renderToast = (global = false) => {
    if (!notifToast) return null;
    const kelasPeta = !global && tabAktif === "peta" ? "di-peta" : "";
    const kelasGlobal = global ? "toast-global" : "";
    const kelasAksi = notifToast.urungkan ? "ada-aksi" : "";
    const toast = (
      <div className={`avenza-toast ${kelasGlobal} ${kelasPeta} ${kelasAksi}`.trim()} role="status">
        <span>{notifToast.pesan}</span>
        {notifToast.urungkan && (
          <button
            type="button"
            className="toast-urungkan"
            onClick={() => {
              notifToast.urungkan?.();
              setNotifToast(null);
            }}
          >
            Urungkan
          </button>
        )}
      </div>
    );
    const wadahPeta = !global && tabAktif === "peta" ? document.querySelector(".avz-hud-tengah") : null;
    return wadahPeta ? createPortal(toast, wadahPeta) : toast;
  };

  // JIKA PENGGUNA BELUM LOGIN, TAMPILKAN PORTAL LOGIN & DAFTAR LENGKAP
  if (!sesiPengguna) {
    return (
      <>
        {tampilSplashTaka && <LayarPembukaTaka onSelesai={() => setTampilSplashTaka(false)} />}
        <AuthModal onLoginSukses={handleLoginSukses} onBukaSplashTaka={() => setTampilSplashTaka(true)} />
        {renderToast(true)}
      </>
    );
  }

  const lapisKunci = layarKunci && (
    <KunciAplikasiView
      sesi={sesiPengguna}
      mode={layarKunci}
      tujuan={peran === "admin" ? "aplikasi+admin" : "aplikasi"}
      sedangMerekam={rekamLatar.status !== "idle" && !rekamLatar.modeGambarUkur}
      onTerbuka={(pesan) => {
        segarkanKeamanan();
        setTabAktif("peta");
        tampilkanToast(pesan.startsWith("🔒") ? pesan : `🔓 ${pesan}`);
      }}
      onKeluar={handleLogout}
    />
  );
  const denganKunci = (isi: React.ReactNode, denganToastGlobal = false) => (
    <>
      {tampilSplashTaka && <LayarPembukaTaka onSelesai={() => setTampilSplashTaka(false)} />}
      <div ref={bungkusRef} className="bungkus-terkunci" aria-hidden={layarKunci ? true : undefined}>
        {isi}
      </div>
      {lapisKunci}
      {(layarKunci !== null || denganToastGlobal) && renderToast(true)}
    </>
  );

  if (bukaPemberitahuan) {
    return denganKunci(
      <PemberitahuanView
        pengumumanList={pengumumanList}
        tugasList={tugasListUntukUser}
        onTutup={() => setBukaPemberitahuan(false)}
        onBukaTargetDiPeta={handleFokusKePeta}
        onTandaiTugasSelesai={handleTandaiTugasSelesai}
      />,
      true
    );
  }

  if (bukaPengaturanEkspor) {
    return denganKunci(
      <PengaturanEksporView
        dataSpasial={dataSpasial}
        areaOffline={areaOffline}
        konteksEkspor={konteksEkspor}
        onTutup={() => {
          setBukaPengaturanEkspor(false);
          setKonteksEkspor(null);
        }}
      />,
      true
    );
  }

  if (bukaBantuan) {
    return denganKunci(
      <BantuanBugView
        tabAsal={tabAktif}
        namaPengguna={sesiPengguna.nama}
        onPesan={tampilkanToast}
        onTutup={() => setBukaBantuan(false)}
      />,
      true
    );
  }

  const catatAktivitas = () => {
    catatAktivitasAdmin();
    catatAktivitasAplikasi();
  };

  return denganKunci(
    <div
      className={`app-shell ${tabAktif === "peta" ? "peta-layar-penuh" : ""}`}
      onClick={() => {
        if (bukaMenuTitikTiga) setBukaMenuTitikTiga(false);
      }}
      onPointerDownCapture={catatAktivitas}
      onKeyDownCapture={catatAktivitas}
    >
      {/* TOPBAR BERSIH: JUDUL TUNGGAL DI KIRI, TOOLBAR DISEMBUNYIKAN HINGGA DIKLIK AGAR TIDAK MENIMPA TEKS */}
      <MenuAtas
        tabAktif={tabAktif}
        setTabAktif={setTabAktif}
        peran={peran}
        adalahAkunAdmin={adalahAkunAdmin}
        gantiPeranAkun={gantiPeranAkun}
        bukaMenuTitikTiga={bukaMenuTitikTiga}
        setBukaMenuTitikTiga={setBukaMenuTitikTiga}
        sedangOnline={sedangOnline}
        jaringanTersedia={jaringanTersedia}
        modeOfflineManual={modeOfflineManual}
        setModeOfflineManual={setModeOfflineManual}
        tampilkanToast={tampilkanToast}
        onBukaPemberitahuan={() => setBukaPemberitahuan(true)}
        onBukaEkspor={() => {
          setKonteksEkspor(null);
          setBukaPengaturanEkspor(true);
        }}
        onModePilihPustaka={() => setModePilihPustaka(true)}
        onBukaKeamanan={() => setBukaKeamanan(true)}
        onBukaGantiSandi={() => setBukaGantiSandi(true)}
        onBukaBantuan={() => setBukaBantuan(true)}
        jumlahBug={inventarisBug.length}
        onKeluar={handleLogout}
        autoSync={autoSync}
        onBukaSplashTaka={() => setTampilSplashTaka(true)}
      />
      {/* Penanda jelas bahwa sedang di mode admin, dengan kunci manual */}
      {aksesAdmin && (
        <BannerModeAdmin
          onKunci={() => {
            kunciGerbangAdmin();
            tampilkanToast("🔒 Mode admin dikunci.");
          }}
        />
      )}

      {/* TANDA SEDANG MEREKAM DI LATAR BELAKANG (di tab lain; bukan untuk mode Gambar dan Ukur) */}
      {rekamLatar.status !== "idle" && !rekamLatar.modeGambarUkur && tabAktif !== "peta" && (
        <BannerPerekaman
          rekamLatar={rekamLatar}
          detikRekamTick={detikRekamTick}
          petaTerbuka={false}
          onBukaPeta={() => setTabAktif("peta")}
        />
      )}

      {tabAktif === "pustaka" && <BannerInstal onSelesai={tampilkanToast} />}

      {/* PERINGATAN PENYIMPANAN: data baru yang tidak tersimpan harus terlihat, bukan hilang senyap */}
      <BannerPenyimpanan statusPenyimpanan={statusPenyimpanan} ruangPenyimpanan={ruangPenyimpanan} />

      {/* TOAST FEEDBACK */}
      {/* Di tab peta, toast tinggal di sel tengah grid HUD peta agar tidak menutupi kontrol peta (CLAUDE.md, Aturan UI) */}
      {layarKunci === null && renderToast(false)}

      {/* KONTEN UTAMA SESUAI PERAN & TAB AKTIF */}
      <main
        className={`app-main ${animasiGeser ? `geser-${animasiGeser}` : ""}`}
        onTouchStart={handleGeserMulai}
        onTouchEnd={handleGeserSelesai}
        onTouchCancel={() => (awalGeserRef.current = null)}
      >
        {/* Saat layar kunci aplikasi tampil, gerbang admin tidak ikut dirender: satu PIN membuka keduanya */}
        {modeAdminTerkunci && sesiPengguna && !layarKunci && (
          <GerbangAdminView
            sesi={sesiPengguna}
            onTerbuka={(pesan) => {
              tampilkanToast(`🛡️ ${pesan}`);
              setTabAktif("admin");
            }}
            onModeUser={() => gantiPeranAkun("kader")}
          />
        )}
        {!modeAdminTerkunci && (
          tabAktif === "peta" ? (
            <InteractiveMap
              dataSpasial={dataSpasial}
              lapisanList={lapisanListUntukUser}
              lapisanAktifId={lapisanAktifId}
              onPilihLapisanAktif={setLapisanAktifId}
              profil={profil}
              areaOffline={areaOffline}
              petaKustomAktif={petaKustomAktif}
              onTutupPetaKustom={() => {
                setPetaKustomAktif(null);
              }}
              onPilihPetaKustom={(a) => {
                setPetaKustomAktif(a);
                setFokusKoordinat({
                  lat: (a.minLat + a.maxLat) / 2,
                  lng: (a.minLng + a.maxLng) / 2
                });
              }}
              fokusKoordinat={fokusKoordinat}
              onFokusDipakai={() => setFokusKoordinat(null)}
              onSimpanDataBaru={handleSimpanDataBaru}
              onPerbaruiData={handlePerbaruiDataDariPeta}
              onTambahPembaruanObjek={handleTambahPembaruanObjek}
              onSimpanAreaOffline={(a) => setAreaOffline((prev) => [a, ...prev])}
              onHapusAreaOffline={handleHapusAreaOffline}
              onHapusData={handleHapusDataSpasial}
              onImporBerkas={handleImporBerkas}
              sedangOnline={sedangOnline}
              onKembali={() => setTabAktif(peran === "admin" ? "admin" : "pustaka")}
            />
          ) : (
            <PullToRefresh onRefresh={handleRefreshGlobal}>
              {tabAktif === "pustaka" && (
              <PustakaView
                areaOffline={areaOffline}
                lapisanList={lapisanListUntukUser}
                dataSpasial={dataSpasial}
                sesiPengguna={sesiPengguna}
                modePilihAktif={modePilihPustaka}
                onMatikanModePilih={() => setModePilihPustaka(false)}
                onBukaPetaDasar={() => {
                  setPetaKustomAktif(null);
                  setLapisanAktifId(null);
                  setTabAktif("peta");
                }}
                onBukaLapisanDiPeta={(lapisan) => {
                  setPetaKustomAktif(null);
                  setLapisanAktifId(lapisan.id);
                  const cocokTugas = lapisan.tugasId ? tugasList.find((t) => t.id === lapisan.tugasId) : undefined;
                  if (cocokTugas?.koordinatAcuan) {
                    setFokusKoordinat({
                      lat: cocokTugas.koordinatAcuan.lat,
                      lng: cocokTugas.koordinatAcuan.lng,
                      label: cocokTugas.judul
                    });
                  }
                  setTabAktif("peta");
                  tampilkanToast(`Lapisan "${lapisan.nama}" aktif di Peta.`);
                }}
                onBukaAreaPeta={(area) => {
                  setPetaKustomAktif(area);
                  setFokusKoordinat({
                    lat: (area.minLat + area.maxLat) / 2,
                    lng: (area.minLng + area.maxLng) / 2
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
                onHapusLapisan={(id) => setLapisanList((prev) => prev.filter((l) => l.id !== id))}
                onImporBerkas={handleImporBerkas}
                onBukaPengaturanEkspor={(konteks) => {
                  setKonteksEkspor(konteks ?? null);
                  setBukaPengaturanEkspor(true);
                }}
              />
            )}

            {tabAktif === "data_sync" && (
              <DatabaseSyncView
                dataSpasial={dataSpasial}
                areaOffline={areaOffline}
                onResolusiKonflik={(id, pilihan, gabungan) => {
                  try {
                    const d = dataSpasial.find((v) => v.id === id);
                    if (!d?.konflikSinkron) return;
                    if (!aksesAdminSah(muatSesiPengguna()) && d.idKader !== muatSesiPengguna()?.idKader) {
                      tampilkanToast("Hanya pemilik data atau admin yang dapat menyelesaikan konflik.");
                      return;
                    }
                    const hasil = selesaikanKonflik(d.konflikSinkron, pilihan, gabungan);
                    setDataSpasial((prev) => prev.map((v) => (v.id === id ? hasil : v)));
                    tampilkanToast("Pilihan konflik disimpan.");
                  } catch (e) {
                    tampilkanToast(e instanceof Error ? e.message : "Konflik belum dapat diselesaikan.");
                  }
                }}
                terakhirSinkron={statusGDrive.terakhirSinkron}
                sedangSinkron={sedangSinkron}
                pesanSinkron={pesanSinkron}
                pesanSinkronGagal={pesanSinkronGagal}
                sedangOnline={sedangOnline}
                onSinkronkanSekarang={() => void handleSinkronkanSekarang(false)}
                onFokusKePeta={handleFokusKePeta}
              />
            )}

            {tabAktif === "reward" && (
              <RewardView
                dataSpasial={dataSpasial}
                pencadanganList={pencadanganList}
                profil={profil}
                peran={aksesAdmin ? "admin" : "kader"}
                sertifikatList={sertifikatList}
                pesanList={pesanList}
                tugasList={tugasListUntukUser}
                onUbahProfil={setProfil}
                onUbahPenandatanganSertifikat={wajibAdmin(handleUbahPenandatanganSertifikat)}
              />
            )}

            {tabAktif === "tugas" && (
              <TugasPengumumanView
                pengumumanList={pengumumanList}
                tugasList={tugasListUntukUser}
                onBukaTargetDiPeta={handleFokusKePeta}
                onTandaiTugasSelesai={handleTandaiTugasSelesai}
              />
            )}

            {tabAktif === "komunikasi" && (
              <KomunikasiView
                pesanList={pesanList}
                profil={profil}
                peranPengguna={peran}
                onKirimPesan={handleKirimPesan}
                onHapusPesan={handleHapusPesan}
                onTeruskanPesan={handleTeruskanPesan}
                onLihatPinDiPeta={handleFokusKePeta}
                onEskalasiKeAdmin={handleEskalasiKeAdmin}
              />
            )}

            {tabAktif === "admin" && aksesAdmin && (
              <AdminDashboardView
                dataSpasial={dataSpasial}
                pencadanganList={pencadanganList}
                profilKader={profil}
                sertifikatList={sertifikatList}
                tugasList={tugasList}
                kaderAktifList={kaderAktifList}
                sesiAdmin={sesiPengguna}
                onVerifikasiData={wajibAdmin((id: string, status: StatusSinkron, catatan?: string) => {
                  setDataSpasial((prev) => prev.map((d) => (d.id === id ? { ...d, statusSinkron: status, catatanAdmin: catatan } : d)));
                  if (gdriveTerpasang() && sedangOnline) {
                    void perbaruiStatusVerifikasiGDrive(id, status, catatan);
                  }
                })}
                onUbahDataSpasial={wajibAdmin(handleUbahDataSpasial)}
                onHapusDataSpasial={wajibAdmin(handleHapusDataSpasial)}
                onPulihkanCadangan={wajibAdmin(handlePulihkanCadangan)}
                onHapusPermanenCadangan={wajibAdmin(handleHapusPermanenCadangan)}
                onRekonsiliasiGDrive={wajibAdmin(() => void jalankanRekonsiliasiGDrive(false))}
                sedangRekonsiliasi={sedangRekonsiliasi}
                onTerbitkanSertifikat={wajibAdmin((sert: SertifikatKader) => {
                  // Satu sertifikat per kader dan nomor tidak boleh kembar
                  if (sertifikatList.some((s) => s.idKader === sert.idKader || s.nomorSertifikat === sert.nomorSertifikat)) {
                    tampilkanToast("⚠️ Sertifikat tidak diterbitkan: kader sudah punya sertifikat atau nomor kembar.");
                    return;
                  }
                  setSertifikatList((prev) => [sert, ...prev]);
                  tampilkanToast(`✓ Sertifikat ${sert.nomorSertifikat} diterbitkan untuk ${sert.namaKader}.`);
                })}
                onUbahPenandatanganSertifikat={wajibAdmin(
                  (nama: string, jabatan: string, daftarPenandatangan?: PenandatanganSertifikatItem[]) => {
                    handleUbahPenandatanganSertifikat(nama, jabatan, daftarPenandatangan);
                    tampilkanToast(
                      daftarPenandatangan && daftarPenandatangan.length > 1
                        ? `✓ Keempat penandatangan sertifikat berhasil disimpan.`
                        : `✓ Penandatangan sertifikat diubah menjadi: ${nama}`
                    );
                  }
                )}
                onTambahPengumuman={wajibAdmin((p: PengumumanBroadcast) => setPengumumanList((prev) => [p, ...prev]))}
                onTambahTugas={wajibAdmin(handleTambahTugas)}
                onUbahTugas={wajibAdmin(handleUbahTugas)}
                onVerifikasiTugas={wajibAdmin((id: string) => {
                  setTugasList((prev) => prev.map((t) => (t.id === id ? { ...t, status: "selesai" } : t)));
                  tampilkanToast("✓ Penyelesaian tugas diverifikasi oleh Admin (+60 poin level).");
                })}
                onHapusTugas={wajibAdmin(handleHapusTugas)}
                onBalasPesanAdmin={wajibAdmin((teks: string) => handleKirimPesan("admin", teks))}
                onFokusKePeta={handleFokusKePeta}
              />
            )}
          </PullToRefresh>
        ))}
      </main>

      {bukaKeamanan && sesiPengguna && (
        <PengaturanKunciModal
          sesi={sesiPengguna}
          onTutup={() => setBukaKeamanan(false)}
          onPesan={(pesan) => {
            segarkanKeamanan();
            tampilkanToast(pesan);
          }}
          onKunciSekarang={() => {
            setBukaKeamanan(false);
            kunciGerbangAdmin();
            kunciAplikasi();
          }}
        />
      )}

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

      {/* BOTTOM NAVIGATION: BERBEDA UNTUK AKUN ADMIN DAN AKUN USER */}
      <NavigasiBawah
        peran={peran}
        tabAktif={tabAktif}
        setTabAktif={setTabAktif}
        antreanLokalCount={antreanLokalCount}
        onModeUser={() => gantiPeranAkun("kader")}
        adaPesanBaru={adaPesanBaru}
      />
    </div>
  );
};

export default App;
