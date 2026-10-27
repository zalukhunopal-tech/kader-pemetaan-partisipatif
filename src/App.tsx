import React, { useEffect, useState } from "react";
import {
  AreaPetaOffline,
  DataSpasialItem,
  KlaimUpahHOK,
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
  muatKlaimUpah,
  muatKonfigGDrive,
  muatLapisan,
  muatPengumuman,
  muatPesan,
  muatProfil,
  muatSertifikat,
  muatTugas,
  simpanAreaOffline,
  simpanDataSpasial,
  simpanKlaimUpah,
  simpanKonfigGDrive,
  simpanLapisan,
  simpanPengumuman,
  simpanPesan,
  simpanProfil,
  simpanSertifikat,
  simpanTugas
} from "./lib/storage";
import { sinkronkanDataKeGDrive } from "./lib/gdriveSync";
import { PustakaView } from "./components/PustakaView";
import { PemberitahuanView } from "./components/PemberitahuanView";
import { PengaturanEksporView } from "./components/PengaturanEksporView";
import { InteractiveMap } from "./components/InteractiveMap";
import { DatabaseSyncView } from "./components/DatabaseSyncView";
import { RewardView } from "./components/RewardView";
import { TugasPengumumanView } from "./components/TugasPengumumanView";
import { KomunikasiView } from "./components/KomunikasiView";
import { AdminDashboardView } from "./components/AdminDashboardView";
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
  WifiOff
} from "lucide-react";

export const App: React.FC = () => {
  // Default membuka halaman Pustaka sesuai tangkapan layar UI utama
  const [tabAktif, setTabAktif] = useState<MenuTab>("pustaka");
  const [peran, setPeran] = useState<PeranPengguna>("kader");
  const [sedangOnline, setSedangOnline] = useState<boolean>(true);

  // Sub-halaman penuh & menu titik tiga (Screenshot 2, 3, 4)
  const [bukaPemberitahuan, setBukaPemberitahuan] = useState<boolean>(false);
  const [bukaPengaturanEkspor, setBukaPengaturanEkspor] = useState<boolean>(false);
  const [bukaMenuTitikTiga, setBukaMenuTitikTiga] = useState<boolean>(false);
  const [modePilihPustaka, setModePilihPustaka] = useState<boolean>(false);
  const [notifToast, setNotifToast] = useState<string | null>(null);

  const [profil, setProfil] = useState<ProfilKader>(() => muatProfil());
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
  const [klaimUpahList, setKlaimUpahList] = useState<KlaimUpahHOK[]>(() =>
    muatKlaimUpah()
  );
  const [pengumumanList, setPengumumanList] = useState<PengumumanBroadcast[]>(() =>
    muatPengumuman()
  );
  const [tugasList, setTugasList] = useState<TugasPemetaan[]>(() => muatTugas());
  const [pesanList, setPesanList] = useState<PesanKomunikasi[]>(() => muatPesan());
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

  // Simpan perubahan ke LocalStorage (Offline-First)
  useEffect(() => simpanProfil(profil), [profil]);
  useEffect(() => simpanDataSpasial(dataSpasial), [dataSpasial]);
  useEffect(() => simpanAreaOffline(areaOffline), [areaOffline]);
  useEffect(() => simpanLapisan(lapisanList), [lapisanList]);
  useEffect(() => simpanSertifikat(sertifikatList), [sertifikatList]);
  useEffect(() => simpanKlaimUpah(klaimUpahList), [klaimUpahList]);
  useEffect(() => simpanPengumuman(pengumumanList), [pengumumanList]);
  useEffect(() => simpanTugas(tugasList), [tugasList]);
  useEffect(() => simpanPesan(pesanList), [pesanList]);
  useEffect(() => simpanKonfigGDrive(konfigGDrive), [konfigGDrive]);

  // Saat kembali ke area bersinyal (Online), kirim pesan antrean offline otomatis
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

  // Handler Simpan Data Spasial Baru dari Peta
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

  // Handler Kirim Pesan Chat / Helpdesk
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

  const judulHalamanUtama: Record<MenuTab, string> = {
    pustaka: "Pustaka",
    peta: "Temukan",
    data_sync: "GDrive & Ekspor",
    reward: "Sertifikat & HOK",
    tugas: "Tugas & Info",
    komunikasi: "Diskusi Kader",
    admin: "Panel Admin"
  };

  // Apabila layar penuh Pemberitahuan (Screenshot 2) aktif
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

  // Apabila layar penuh Pengaturan Ekspor (Screenshot 4) aktif
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
      {/* TOPBAR UTAMA BERGAYA AVENZA MAPS (SCREENSHOT 1, 3, 5) */}
      <header className="avenza-topbar">
        <div className="avenza-topbar-left">
          <h1
            className="avenza-topbar-title"
            onClick={() => setTabAktif("pustaka")}
          >
            {judulHalamanUtama[tabAktif]}
          </h1>
          <button
            type="button"
            className={`avenza-conn-chip ${sedangOnline ? "online" : "offline"}`}
            onClick={() => setSedangOnline((o) => !o)}
            title="Klik untuk beralih mode Sinyal Online / Hutan Offline"
          >
            {sedangOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{sedangOnline ? "Online" : "Offline"}</span>
          </button>
        </div>

        {/* 4 IKON AKSI KANAN ATAS SESUAI SCREENSHOT: USER-CHECK, LONCENG, EKSPOR/SHARE, TITIK TIGA */}
        <div className="avenza-topbar-actions">
          <button
            type="button"
            className={`avenza-icon-btn ${tabAktif === "reward" ? "active" : ""}`}
            onClick={() => setTabAktif("reward")}
            title="Akun Kader, Progres Sertifikat & Klaim Upah HOK"
          >
            <UserCheck size={23} strokeWidth={2} />
          </button>

          <button
            type="button"
            className="avenza-icon-btn"
            onClick={() => setBukaPemberitahuan(true)}
            title="Pemberitahuan"
          >
            <Bell size={22} strokeWidth={2} />
          </button>

          <button
            type="button"
            className="avenza-icon-btn"
            onClick={() => setBukaPengaturanEkspor(true)}
            title="Pengaturan Ekspor (.kml / .geojson / .gpx)"
          >
            <Share size={22} strokeWidth={2} />
          </button>

          <div
            className="avenza-more-menu-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="avenza-icon-btn"
              onClick={() => setBukaMenuTitikTiga((v) => !v)}
              title="Menu Lainnya"
            >
              <MoreVertical size={22} strokeWidth={2} />
            </button>

            {/* DROPDOWN MENU TITIK TIGA PERSIS SCREENSHOT 3 */}
            {bukaMenuTitikTiga && (
              <div className="avenza-overflow-menu">
                <button
                  type="button"
                  className="avenza-overflow-item"
                  onClick={() => {
                    setBukaMenuTitikTiga(false);
                    setTabAktif("pustaka");
                    setModePilihPustaka(true);
                  }}
                >
                  Pilih
                </button>
                <button
                  type="button"
                  className="avenza-overflow-item"
                  onClick={() => {
                    setBukaMenuTitikTiga(false);
                    tampilkanToast(
                      `✓ Semua ${areaOffline.length} peta kerja & ${lapisanList.length} lapisan sudah versi terbaru.`
                    );
                  }}
                >
                  Periksa pembaruan peta
                </button>
                <button
                  type="button"
                  className="avenza-overflow-item"
                  onClick={() => {
                    setBukaMenuTitikTiga(false);
                    setTabAktif("data_sync");
                  }}
                >
                  Pengaturan
                </button>
                <div className="avenza-overflow-divider" />
                <button
                  type="button"
                  className="avenza-overflow-item"
                  onClick={() => {
                    setBukaMenuTitikTiga(false);
                    const nextPeran = peran === "kader" ? "admin" : "kader";
                    setPeran(nextPeran);
                    if (nextPeran === "admin") setTabAktif("admin");
                    else setTabAktif("pustaka");
                  }}
                >
                  {peran === "kader"
                    ? "Buka Panel Admin GIS"
                    : "Kembali ke Mode Kader"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* TOAST FEEDBACK RINGKAS */}
      {notifToast && <div className="avenza-toast">{notifToast}</div>}

      {/* ISI HALAMAN AKTIF */}
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
            sertifikatList={sertifikatList}
            klaimUpahList={klaimUpahList}
            onUbahProfil={setProfil}
            onAjukanKlaimUpah={(paketKe, rincian) => {
              const klaimBaru: KlaimUpahHOK = {
                id: `HOK-${Date.now().toString().slice(-4)}`,
                idKader: profil.idKader,
                namaKader: profil.nama,
                desaWilayah: profil.desaWilayah,
                paketKe,
                jumlahHok: 1,
                nominalRupiah: profil.tarifHokRupiah,
                rincianBukti: rincian,
                tanggalKlaim: new Date().toISOString().slice(0, 10),
                status: "diajukan"
              };
              setKlaimUpahList((prev) => [klaimBaru, ...prev]);
            }}
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
            klaimUpahList={klaimUpahList}
            onVerifikasiData={(id: string, status: StatusSinkron, catatan?: string) =>
              setDataSpasial((prev) =>
                prev.map((d) =>
                  d.id === id ? { ...d, statusSinkron: status, catatanAdmin: catatan } : d
                )
              )
            }
            onTerbitkanSertifikat={(sert) =>
              setSertifikatList((prev) => [sert, ...prev])
            }
            onUpdateStatusKlaimHok={(id, status, catatanAdmin) =>
              setKlaimUpahList((prev) =>
                prev.map((k) => (k.id === id ? { ...k, status, catatanAdmin } : k))
              )
            }
            onTambahPengumuman={(p) => setPengumumanList((prev) => [p, ...prev])}
            onTambahTugas={(t) => setTugasList((prev) => [t, ...prev])}
            onBalasPesanAdmin={(teks) => {
              handleKirimPesan("admin", teks);
            }}
          />
        )}
      </main>

      {/* BOTTOM NAVIGATION BAR SESUAI SCREENSHOT (PUSTAKA & TEMUKAN + AKSES FITUR KADER) */}
      <nav className="avenza-bottom-nav">
        <button
          type="button"
          className={`avenza-nav-item ${tabAktif === "pustaka" ? "active" : ""}`}
          onClick={() => setTabAktif("pustaka")}
        >
          <Folder
            size={22}
            fill={tabAktif === "pustaka" ? "#0d7344" : "none"}
          />
          <span>Pustaka</span>
        </button>

        <button
          type="button"
          className={`avenza-nav-item ${tabAktif === "peta" ? "active" : ""}`}
          onClick={() => setTabAktif("peta")}
        >
          <Map size={22} />
          <span>Temukan</span>
        </button>

        <button
          type="button"
          className={`avenza-nav-item ${tabAktif === "data_sync" ? "active" : ""}`}
          onClick={() => setTabAktif("data_sync")}
        >
          <div className="nav-icon-wrap">
            <CloudUpload size={22} />
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
          <Award size={22} />
          <span>Sertifikat</span>
        </button>

        <button
          type="button"
          className={`avenza-nav-item ${tabAktif === "komunikasi" ? "active" : ""}`}
          onClick={() => setTabAktif("komunikasi")}
        >
          <MessageSquare size={22} />
          <span>Diskusi</span>
        </button>

        {peran === "admin" && (
          <button
            type="button"
            className={`avenza-nav-item ${tabAktif === "admin" ? "active" : ""}`}
            onClick={() => setTabAktif("admin")}
          >
            <ShieldCheck size={22} />
            <span>Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
};

export default App;
