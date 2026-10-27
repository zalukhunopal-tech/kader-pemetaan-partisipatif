import React, { useEffect, useState } from "react";
import {
  AreaPetaOffline,
  DataSpasialItem,
  KlaimUpahHOK,
  KonfigurasiGDrive,
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
  muatPengumuman,
  muatPesan,
  muatProfil,
  muatSertifikat,
  muatTugas,
  simpanAreaOffline,
  simpanDataSpasial,
  simpanKlaimUpah,
  simpanKonfigGDrive,
  simpanPengumuman,
  simpanPesan,
  simpanProfil,
  simpanSertifikat,
  simpanTugas
} from "./lib/storage";
import { hitungCapaianKader } from "./lib/rewardEngine";
import { sinkronkanDataKeGDrive } from "./lib/gdriveSync";
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
  Compass,
  Map,
  MessageSquare,
  ShieldCheck,
  Wifi,
  WifiOff
} from "lucide-react";

export const App: React.FC = () => {
  const [tabAktif, setTabAktif] = useState<MenuTab>("peta");
  const [peran, setPeran] = useState<PeranPengguna>("kader");
  const [sedangOnline, setSedangOnline] = useState<boolean>(true);

  const [profil, setProfil] = useState<ProfilKader>(() => muatProfil());
  const [dataSpasial, setDataSpasial] = useState<DataSpasialItem[]>(() =>
    muatDataSpasial()
  );
  const [areaOffline, setAreaOffline] = useState<AreaPetaOffline[]>(() =>
    muatAreaOffline()
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

  const capaian = hitungCapaianKader(dataSpasial, profil, false);
  const antreanLokalCount = dataSpasial.filter((d) => d.statusSinkron === "lokal").length;

  // Handler Simpan Data Spasial Baru dari Peta
  const handleSimpanDataBaru = (item: DataSpasialItem) => {
    setDataSpasial((prev) => [item, ...prev]);
  };

  // Handler Update Kondisi pada Objek Existing (PRD 3.1)
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

  return (
    <div className="app-shell">
      {/* TOPBAR UTAMA */}
      <header className="app-topbar">
        <div className="brand-box">
          <div className="brand-logo">
            <Compass size={22} />
          </div>
          <div>
            <div className="brand-title-row">
              <h1>GeoKader Partisipatif</h1>
              <span className="org-badge">{profil.desaWilayah}</span>
            </div>
            <p className="brand-sub">
              Survei Flora/Fauna, Pemetaan Wilayah Offline-First & Database Google Drive
            </p>
          </div>
        </div>

        {/* INDIKATOR PROGRES RINGKAS & PEMILIH PERAN (KADER / ADMIN) */}
        <div className="topbar-controls">
          <div
            className="mini-milestone-pill"
            onClick={() => setTabAktif("reward")}
            title="Klik untuk melihat progres Sertifikat & Upah HOK"
          >
            <span>📍 {capaian.totalPoinTitik}/50</span>
            <span>〰️ {capaian.totalTrackingKm}/5km</span>
            <span>⬢ {capaian.totalPoligonHa}/5Ha</span>
            <strong className="text-amber">🏆 {capaian.totalPaketSelesai} Paket</strong>
          </div>

          <button
            type="button"
            className={`conn-toggle-btn ${sedangOnline ? "online" : "offline"}`}
            onClick={() => setSedangOnline((o) => !o)}
            title="Klik untuk simulasi kondisi Sinyal Online vs Hutan Offline"
          >
            {sedangOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {sedangOnline ? "Sinyal Online" : "Hutan Offline"}
          </button>

          <div className="role-switcher">
            <button
              type="button"
              className={peran === "kader" ? "active" : ""}
              onClick={() => {
                setPeran("kader");
                if (tabAktif === "admin") setTabAktif("peta");
              }}
            >
              🌿 Akun Kader
            </button>
            <button
              type="button"
              className={peran === "admin" ? "active" : ""}
              onClick={() => {
                setPeran("admin");
                setTabAktif("admin");
              }}
            >
              🛠️ Panel Admin
            </button>
          </div>
        </div>
      </header>

      {/* ISI HALAMAN AKTIF */}
      <main className="app-main">
        {tabAktif === "peta" && (
          <InteractiveMap
            dataSpasial={dataSpasial}
            profil={profil}
            areaOffline={areaOffline}
            fokusKoordinat={fokusKoordinat}
            onSimpanDataBaru={handleSimpanDataBaru}
            onTambahPembaruanObjek={handleTambahPembaruanObjek}
            onSimpanAreaOffline={(a) => setAreaOffline((prev) => [a, ...prev])}
            onImporDataSpasial={(items) => setDataSpasial((prev) => [...items, ...prev])}
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
            onTerbitkanSertifikat={(sert) => setSertifikatList((prev) => [sert, ...prev])}
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

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="app-bottom-nav">
        <button
          type="button"
          className={`nav-tab ${tabAktif === "peta" ? "active" : ""}`}
          onClick={() => setTabAktif("peta")}
        >
          <Map size={19} />
          <span>Peta Survei</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${tabAktif === "data_sync" ? "active" : ""}`}
          onClick={() => setTabAktif("data_sync")}
        >
          <div className="nav-icon-wrap">
            <CloudUpload size={19} />
            {antreanLokalCount > 0 && (
              <span className="nav-badge">{antreanLokalCount}</span>
            )}
          </div>
          <span>GDrive Sync</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${tabAktif === "reward" ? "active" : ""}`}
          onClick={() => setTabAktif("reward")}
        >
          <Award size={19} />
          <span>Sertifikat & HOK</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${tabAktif === "tugas" ? "active" : ""}`}
          onClick={() => setTabAktif("tugas")}
        >
          <Bell size={19} />
          <span>Tugas & Info</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${tabAktif === "komunikasi" ? "active" : ""}`}
          onClick={() => setTabAktif("komunikasi")}
        >
          <MessageSquare size={19} />
          <span>Diskusi & Admin</span>
        </button>

        {peran === "admin" && (
          <button
            type="button"
            className={`nav-tab ${tabAktif === "admin" ? "active" : ""}`}
            onClick={() => setTabAktif("admin")}
          >
            <ShieldCheck size={19} />
            <span>Panel Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
};

export default App;
