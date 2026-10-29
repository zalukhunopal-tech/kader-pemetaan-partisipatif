import { useMuatGambar } from "../lib/useMuatGambar";
import { kompresFotoKeDataUrl } from "../lib/foto";
import { lukisSertifikatKeCanvas } from "../lib/kanvasSertifikat";
import { DEFAULT_PENANDATANGAN_SERTIFIKAT } from "../lib/sertifikatBawaan";
import { CincinProgresSvg, KunciLevelSvg, SiluetOrangSvg } from "./sertifikat/IkonSertifikat";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DataSpasialItem,
  LogoSertifikatItem,
  PenandatanganSertifikatItem,
  PeranPengguna,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  TugasPemetaan
} from "../types";
import {
  DAFTAR_20_LEVEL_GIS,
  hitungCapaianKader,
  hitungPeringkatGis20Level,
  TARGET_POLIGON_HA,
  TARGET_TITIK,
  TARGET_TRACKING_KM
} from "../lib/rewardEngine";
import {
  Award,
  Download,
  ShieldCheck,
  Settings,
  Printer,
  Camera,
  UserCheck,
  Trash2,
  PenTool,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Image as ImageIcon,
  FileText
} from "lucide-react";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface RewardViewProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  peran?: PeranPengguna;
  sertifikatList: SertifikatKader[];
  pesanList?: PesanKomunikasi[];
  tugasList?: TugasPemetaan[];
  onUbahProfil: (p: ProfilKader) => void;
  onUbahPenandatanganSertifikat?: (nama: string, jabatan: string) => void;
}

export const RewardView: React.FC<RewardViewProps> = ({
  dataSpasial,
  profil,
  peran = "kader",
  sertifikatList,
  pesanList = [],
  tugasList = [],
  onUbahProfil,
  onUbahPenandatanganSertifikat
}) => {
  const certCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);
  const [bukaPengaturan, setBukaPengaturan] = useState(false);
  const [bukaAturSertifikat, setBukaAturSertifikat] = useState(false);

  // Kemajuan yang terlihat kader memakai semua data; kelayakan sertifikat hanya dari data terverifikasi
  const capaian = useMemo(() => hitungCapaianKader(dataSpasial, profil, false), [dataSpasial, profil]);
  const capaianTerverifikasi = useMemo(() => hitungCapaianKader(dataSpasial, profil, true), [dataSpasial, profil]);

  const peringkatGis = useMemo(
    () => hitungPeringkatGis20Level(dataSpasial, profil, pesanList, tugasList),
    [dataSpasial, profil, pesanList, tugasList]
  );

  const { levelSaatIni, persenProgresLevel } = peringkatGis;

  // State navigasi level ke kiri / ke kanan (1 s/d 20)
  // Level yang dilihat (geser kiri/kanan) kembali ke level saat ini begitu kader naik level
  const [levelDipilih, setLevelDipilih] = useState<{ untukLevel: number; nomor: number } | null>(null);
  const nomorLevelDilihat = levelDipilih && levelDipilih.untukLevel === levelSaatIni.level ? levelDipilih.nomor : levelSaatIni.level;
  const setNomorLevelDilihat = (nomor: number) => setLevelDipilih({ untukLevel: levelSaatIni.level, nomor });

  const infoLevelDilihat = DAFTAR_20_LEVEL_GIS.find((l) => l.level === nomorLevelDilihat) || levelSaatIni;
  const apakahLevelTerkunci = nomorLevelDilihat > levelSaatIni.level;

  const levelKiri = nomorLevelDilihat > 1 ? DAFTAR_20_LEVEL_GIS.find((l) => l.level === nomorLevelDilihat - 1) || null : null;
  const levelKanan =
    nomorLevelDilihat < DAFTAR_20_LEVEL_GIS.length ? DAFTAR_20_LEVEL_GIS.find((l) => l.level === nomorLevelDilihat + 1) || null : null;

  const sertifikatSaya = sertifikatList.find((s) => s.idKader === profil.idKader);

  const totalPoin = capaian.totalPoinTitik;
  const totalKm = capaian.totalTrackingKm;
  const totalHa = capaian.totalPoligonHa;
  // Tersertifikasi hanya bila admin sudah menerbitkan; capaian saja belum cukup
  const sudahTersertifikasi = Boolean(sertifikatSaya);

  const fotoSertifikatBase64 = sertifikatSaya?.fotoKaderBase64 || profil.fotoKaderBase64 || "";

  const logoListAktif: LogoSertifikatItem[] = useMemo(() => {
    if (profil.logoSertifikatList) {
      return profil.logoSertifikatList;
    }
    if (sertifikatSaya?.logoSertifikatList) {
      return sertifikatSaya.logoSertifikatList;
    }
    return [];
  }, [profil.logoSertifikatList, sertifikatSaya?.logoSertifikatList]);

  const temaKegiatanAktif =
    profil.temaKegiatanSertifikat ??
    sertifikatSaya?.temaKegiatanSertifikat ??
    "Inventarisasi dan Verifikasi Data Geospasial Wilayah Desa Rimba Hijau";

  const handleUbahTemaKegiatan = (teks: string) => {
    onUbahProfil({
      ...profil,
      temaKegiatanSertifikat: teks
    });
  };

  const penandatanganListAktif: PenandatanganSertifikatItem[] = useMemo(() => {
    if (profil.penandatanganList && profil.penandatanganList.length > 0) {
      return profil.penandatanganList;
    }
    if (sertifikatSaya?.penandatanganList && sertifikatSaya.penandatanganList.length > 0) {
      return sertifikatSaya.penandatanganList;
    }
    return DEFAULT_PENANDATANGAN_SERTIFIKAT;
  }, [profil.penandatanganList, sertifikatSaya?.penandatanganList]);

  // Foto kader, logo, dan tanda tangan dimuat menjadi gambar untuk kanvas sertifikat
  const gambarFoto = useMuatGambar([{ id: "foto", src: fotoSertifikatBase64 || undefined }]);
  const fotoElement = gambarFoto.foto ?? null;
  const logoImagesMap = useMuatGambar(logoListAktif.map((l) => ({ id: l.id, src: l.imageBase64 })));
  const ttdImagesMap = useMuatGambar(penandatanganListAktif.map((p) => ({ id: p.id, src: p.tandaTanganBase64 })));

  const sertifikatTampil: SertifikatKader = useMemo(() => {
    const pejabatUtama = penandatanganListAktif[0];
    const namaPenandatangan =
      pejabatUtama?.nama ||
      sertifikatSaya?.ditandatanganiOleh ||
      profil.namaPenandatanganSertifikat ||
      "Dr. Ir. Jonni Marwa, S.Hut., M.Si.";
    const jabatanPenandatangan =
      pejabatUtama?.jabatan || sertifikatSaya?.jabatanPenandatangan || profil.jabatanPenandatanganSertifikat || "Koordinator Wilayah";

    if (sertifikatSaya) {
      return {
        ...sertifikatSaya,
        ditandatanganiOleh: namaPenandatangan,
        jabatanPenandatangan,
        fotoKaderBase64: fotoSertifikatBase64 || undefined,
        logoSertifikatList: logoListAktif,
        penandatanganList: penandatanganListAktif,
        temaKegiatanSertifikat: temaKegiatanAktif
      };
    }
    return {
      id: `CERT-${profil.idKader}`,
      nomorSertifikat: "Belum diterbitkan",
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      namaOrganisasi: profil.namaOrganisasi || "Sertifikat Kader Pemetaan Partisipatif",
      tanggalTerbit: new Date().toISOString().slice(0, 10),
      alasanCapaian: capaianTerverifikasi.alasanSertifikat,
      status: "menunggu_admin",
      ditandatanganiOleh: namaPenandatangan,
      jabatanPenandatangan,
      fotoKaderBase64: fotoSertifikatBase64 || undefined,
      logoSertifikatList: logoListAktif,
      penandatanganList: penandatanganListAktif,
      temaKegiatanSertifikat: temaKegiatanAktif
    };
  }, [
    sertifikatSaya,
    profil,
    fotoSertifikatBase64,
    logoListAktif,
    penandatanganListAktif,
    temaKegiatanAktif,
    capaianTerverifikasi.alasanSertifikat
  ]);

  useEffect(() => {
    if (certCanvasRef.current) {
      lukisSertifikatKeCanvas(certCanvasRef.current, sertifikatTampil, fotoElement, logoImagesMap, ttdImagesMap);
    }
  }, [sertifikatTampil, fotoElement, logoImagesMap, ttdImagesMap]);

  const handlePilihFotoSertifikat = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await kompresFotoKeDataUrl(file, 480);
      onUbahProfil({ ...profil, fotoKaderBase64: dataUrl });
    } catch {
      alert("Gagal memuat foto. Silakan pilih file gambar lain.");
    } finally {
      e.target.value = "";
    }
  };

  const handleHapusFotoSertifikat = () => {
    onUbahProfil({ ...profil, fotoKaderBase64: undefined });
  };

  // Handler Kelola Logo Sertifikat
  const handleTambahLogo = () => {
    const warnaPalet = ["#eab308", "#38bdf8", "#22c55e", "#a855f7", "#f97316"];
    const itemBaru: LogoSertifikatItem = {
      id: `logo-${Date.now()}`,
      nama: `Logo Mitra ${logoListAktif.length + 1}`,
      warnaAksen: warnaPalet[logoListAktif.length % warnaPalet.length]
    };
    onUbahProfil({
      ...profil,
      logoSertifikatList: [...logoListAktif, itemBaru]
    });
  };

  const handleUbahLogo = (id: string, patch: Partial<LogoSertifikatItem>) => {
    const baru = logoListAktif.map((l) => (l.id === id ? { ...l, ...patch } : l));
    onUbahProfil({ ...profil, logoSertifikatList: baru });
  };

  const handleUnggahGambarLogo = async (id: string, file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await kompresFotoKeDataUrl(file, 260);
      handleUbahLogo(id, { imageBase64: dataUrl });
    } catch {
      alert("Gagal memuat gambar logo.");
    }
  };

  const handleHapusLogo = (id: string) => {
    const baru = logoListAktif.filter((l) => l.id !== id);
    onUbahProfil({ ...profil, logoSertifikatList: baru });
  };

  // Handler Kelola Penandatangan Sertifikat
  const handleTambahPenandatangan = () => {
    const itemBaru: PenandatanganSertifikatItem = {
      id: `sign-${Date.now()}`,
      jabatan: "Koordinator Lapangan",
      instansi: profil.desaWilayah || "Lembaga Pemetaan Desa",
      nama: "Nama Pejabat, S.Hut., M.Si."
    };
    const baru = [...penandatanganListAktif, itemBaru];
    onUbahProfil({
      ...profil,
      penandatanganList: baru
    });
  };

  const handleUbahPenandatanganItem = (id: string, patch: Partial<PenandatanganSertifikatItem>) => {
    const baru = penandatanganListAktif.map((p) => (p.id === id ? { ...p, ...patch } : p));
    onUbahProfil({
      ...profil,
      penandatanganList: baru,
      namaPenandatanganSertifikat: baru[0]?.nama,
      jabatanPenandatanganSertifikat: baru[0]?.jabatan
    });
    if (baru[0]) {
      onUbahPenandatanganSertifikat?.(baru[0].nama, baru[0].jabatan);
    }
  };

  const handleUnggahGambarTtd = async (id: string, file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await kompresFotoKeDataUrl(file, 360);
      handleUbahPenandatanganItem(id, { tandaTanganBase64: dataUrl });
    } catch {
      alert("Gagal memuat gambar tanda tangan.");
    }
  };

  const handleHapusPenandatangan = (id: string) => {
    if (penandatanganListAktif.length <= 1) return;
    const baru = penandatanganListAktif.filter((p) => p.id !== id);
    onUbahProfil({
      ...profil,
      penandatanganList: baru
    });
  };

  const handleUnduhSertifikatPng = () => {
    const canvas = certCanvasRef.current;
    if (!canvas || !sertifikatSaya) return;
    lukisSertifikatKeCanvas(canvas, sertifikatTampil, fotoElement, logoImagesMap, ttdImagesMap);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sertifikat_${sertifikatTampil.namaKader.replace(/\s+/g, "_")}.png`;
    a.click();
  };

  const handleCetakSertifikat = () => {
    const canvas = certCanvasRef.current;
    if (!canvas || !sertifikatSaya) return;
    lukisSertifikatKeCanvas(canvas, sertifikatTampil, fotoElement, logoImagesMap, ttdImagesMap);
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl.startsWith("data:image/png;base64,")) return;

    const win = window.open("", "_blank");
    if (!win) {
      window.print();
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${escapeHtml(`Cetak Sertifikat - ${sertifikatTampil.namaKader}`)}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              height: 100%;
              background: #cbd5e1;
              display: flex;
              align-items: center;
              justify-content: center;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            img {
              width: 100%;
              height: 100%;
              max-width: 297mm;
              max-height: 210mm;
              object-fit: contain;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="Sertifikat" onload="setTimeout(() => { window.print(); }, 250);" />
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="page-container reward-page-clean">
      {/* INPUT FILE TERSEMBUNYI UNTUK FOTO KADER DI SERTIFIKAT */}
      <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePilihFotoSertifikat} />

      {/* 1. KARTU LEVEL KADER (GESER KIRI / KANAN DENGAN IKON KUNCI UNTUK LEVEL BELUM TERBUKA, TANPA XP) */}
      <div className="section-card reward-gis-hero-card">
        <div className="visual-profile-bar">
          <div className="visual-profile-left">
            <button
              type="button"
              className="visual-avatar-emblem avatar-silhouette-btn"
              onClick={() => inputFotoRef.current?.click()}
              title="Unggah foto kader"
            >
              {fotoSertifikatBase64 ? (
                <img src={fotoSertifikatBase64} alt={profil.nama} className="visual-avatar-photo" />
              ) : (
                <SiluetOrangSvg size={38} />
              )}
              <span className="visual-avatar-cam-badge">
                <Camera size={11} />
              </span>
            </button>
            <div>
              <div className="visual-profile-badges">
                <span className="visual-pill-id">{profil.idKader}</span>
                {sudahTersertifikasi && (
                  <span className="visual-pill-verified">
                    <ShieldCheck size={12} /> Tersertifikasi
                  </span>
                )}
              </div>
              <h2 className="visual-profile-name">{profil.nama}</h2>
              <span className="visual-profile-loc">{profil.desaWilayah}</span>
            </div>
          </div>

          <button type="button" className="visual-icon-gear-btn" onClick={() => setBukaPengaturan((v) => !v)} title="Profil">
            <Settings size={18} />
          </button>
        </div>

        {/* NAVIGASI LEVEL KE KIRI & KE KANAN DENGAN GAMBAR KUNCI UNTUK LEVEL DI ATASNYA */}
        <div className="visual-level-carousel">
          {/* TOMBOL LEVEL KIRI */}
          <button
            type="button"
            className={`visual-level-side-btn ${!levelKiri ? "disabled" : ""}`}
            disabled={!levelKiri}
            onClick={() => levelKiri && setNomorLevelDilihat(levelKiri.level)}
            title={levelKiri ? `Lihat Level ${levelKiri.level}` : "Level Awal"}
          >
            <ChevronLeft size={20} className="side-arrow-icon" />
            {levelKiri ? (
              <div className="side-level-badge">
                {levelKiri.level > levelSaatIni.level ? (
                  <KunciLevelSvg size={26} warna="#94a3b8" />
                ) : (
                  <span className="side-level-unlocked-num">Lv.{levelKiri.level}</span>
                )}
                <span className="side-level-caption">{levelKiri.level > levelSaatIni.level ? "Terkunci" : `Level ${levelKiri.level}`}</span>
              </div>
            ) : (
              <div className="side-level-badge muted">
                <span className="side-level-caption">Awal</span>
              </div>
            )}
          </button>

          {/* MEDALI TENGAH: TERBUKA JIKA <= LEVEL SAAT INI, GAMBAR KUNCI JIKA BELUM NAIK LEVEL */}
          <div className="visual-current-level-center">
            {apakahLevelTerkunci ? (
              <>
                <div className="visual-medal-svg-wrap locked-medal">
                  <svg width="96" height="96" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      fill="rgba(2, 44, 34, 0.8)"
                      stroke="rgba(148, 163, 184, 0.35)"
                      strokeWidth="5"
                      strokeDasharray="6 5"
                    />
                    <circle cx="50" cy="50" r="34" fill="rgba(15, 23, 42, 0.75)" stroke="#fbbf24" strokeWidth="2" />
                  </svg>
                  <div className="locked-medal-center-icon">
                    <KunciLevelSvg size={40} warna="#fbbf24" />
                  </div>
                </div>
                <div className="visual-current-level-title locked-title">
                  <Lock size={14} /> Level {infoLevelDilihat.level} Terkunci
                </div>
                <button
                  type="button"
                  className="visual-current-status-pill locked-pill"
                  onClick={() => setNomorLevelDilihat(levelSaatIni.level)}
                >
                  Belum terbuka • Kembali ke Level {levelSaatIni.level}
                </button>
              </>
            ) : (
              <>
                <div className="visual-medal-svg-wrap">
                  <svg width="96" height="96" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="goldMedal" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fde68a" />
                        <stop offset="50%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="44" fill="rgba(2, 44, 34, 0.7)" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      fill="none"
                      stroke="url(#goldMedal)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 44}
                      strokeDashoffset={2 * Math.PI * 44 * (1 - persenProgresLevel / 100)}
                      transform="rotate(-90 50 50)"
                    />
                    <circle cx="50" cy="50" r="34" fill="url(#goldMedal)" />
                    <text x="50" y="46" textAnchor="middle" fill="#022c22" fontSize="12" fontWeight="900">
                      LEVEL
                    </text>
                    <text x="50" y="68" textAnchor="middle" fill="#022c22" fontSize="24" fontWeight="900">
                      {infoLevelDilihat.level}
                    </text>
                  </svg>
                </div>
                <div className="visual-current-level-title">{infoLevelDilihat.namaLevel}</div>
                <div className="visual-current-status-pill">
                  {infoLevelDilihat.level === levelSaatIni.level ? `Level Aktif • Progres ${persenProgresLevel}%` : "Level Telah Terbuka"}
                </div>
              </>
            )}
          </div>

          {/* TOMBOL LEVEL KANAN (DIBERI GAMBAR KUNCI JIKA BELUM NAIK LEVEL) */}
          <button
            type="button"
            className={`visual-level-side-btn ${!levelKanan ? "disabled" : ""}`}
            disabled={!levelKanan}
            onClick={() => levelKanan && setNomorLevelDilihat(levelKanan.level)}
            title={
              levelKanan
                ? levelKanan.level > levelSaatIni.level
                  ? `Level ${levelKanan.level} Terkunci`
                  : `Lihat Level ${levelKanan.level}`
                : "Level Puncak"
            }
          >
            {levelKanan ? (
              <div className="side-level-badge">
                {levelKanan.level > levelSaatIni.level ? (
                  <KunciLevelSvg size={28} warna="#fbbf24" />
                ) : (
                  <span className="side-level-unlocked-num">Lv.{levelKanan.level}</span>
                )}
                <span className="side-level-caption">
                  {levelKanan.level > levelSaatIni.level ? `Lv.${levelKanan.level} Terkunci` : `Level ${levelKanan.level}`}
                </span>
              </div>
            ) : (
              <div className="side-level-badge muted">
                <span className="side-level-caption">Puncak</span>
              </div>
            )}
            <ChevronRight size={20} className="side-arrow-icon" />
          </button>
        </div>
      </div>

      {/* 2. GRAFIK CINCIN VISUAL: CAPAIAN SPASIAL (TITIK, JALUR, POLIGON) */}
      <div className="visual-rings-grid">
        <CincinProgresSvg
          persen={(totalPoin / TARGET_TITIK) * 100}
          warna="#0d7344"
          nilai={`${totalPoin}/${TARGET_TITIK}`}
          label="Titik"
          ikon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          }
        />

        <CincinProgresSvg
          persen={(totalKm / TARGET_TRACKING_KM) * 100}
          warna="#0284c7"
          nilai={`${totalKm.toFixed(1)}/${TARGET_TRACKING_KM} km`}
          label="Jalur"
          ikon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="6" r="3" />
              <path d="M8.5 16.5C11 14 10 10 15.5 7.5" strokeDasharray="3 2" />
            </svg>
          }
        />

        <CincinProgresSvg
          persen={(totalHa / TARGET_POLIGON_HA) * 100}
          warna="#d97706"
          nilai={`${totalHa.toFixed(1)}/${TARGET_POLIGON_HA} Ha`}
          label="Poligon"
          ikon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="12 3 21 8 18 19 6 19 3 8" />
            </svg>
          }
        />
      </div>

      <p id="capaian-terverifikasi" className="text-muted" style={{ margin: "-4px 4px 0", fontSize: "0.8rem", textAlign: "center" }}>
        Terverifikasi admin: {capaianTerverifikasi.totalPoinTitik} titik • {capaianTerverifikasi.totalTrackingKm.toFixed(1)} km •{" "}
        {capaianTerverifikasi.totalPoligonHa.toFixed(1)} Ha
      </p>

      {/* 3. PREVIEW SERTIFIKAT BERGAMBAR + TOMBOL ATUR FOTO, LOGO & TANDA TANGAN */}
      <div className="section-card certificate-section-card">
        <div className="certificate-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={20} color="#0d7344" />
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Sertifikat</h3>
          </div>
          {peran === "admin" && (
            <button
              type="button"
              className="btn-outline-sm cert-admin-btn"
              onClick={() => setBukaAturSertifikat((v) => !v)}
              title="Atur Logo, Tanda Tangan, dan Tema Sertifikat (Khusus Admin)"
            >
              <PenTool size={14} /> {bukaAturSertifikat ? "Tutup Editor" : "Atur Logo & TTD"}
            </button>
          )}
        </div>

        {/* Aksi sertifikat: baris tombol berukuran sama (ikon di atas label), lalu Unduh selebar kartu */}
        <div className="sertifikat-aksi" id="aksi-sertifikat">
          <div className="sertifikat-aksi-baris">
            <button
              type="button"
              className="sertifikat-aksi-tombol"
              onClick={() => inputFotoRef.current?.click()}
              title="Foto untuk sertifikat"
            >
              <Camera size={18} aria-hidden="true" />
              <span>{fotoSertifikatBase64 ? "Ganti Foto" : "Tambah Foto"}</span>
            </button>
            {fotoSertifikatBase64 && (
              <button
                type="button"
                className="sertifikat-aksi-tombol bahaya"
                onClick={handleHapusFotoSertifikat}
                title="Hapus foto dari sertifikat"
              >
                <Trash2 size={18} aria-hidden="true" />
                <span>Hapus Foto</span>
              </button>
            )}
            <button
              type="button"
              className="sertifikat-aksi-tombol"
              onClick={handleCetakSertifikat}
              disabled={!sertifikatSaya}
              title={sertifikatSaya ? "Cetak sertifikat" : "Tersedia setelah admin menerbitkan sertifikat"}
            >
              <Printer size={18} aria-hidden="true" />
              <span>Cetak</span>
            </button>
          </div>
          <button
            type="button"
            className="btn-primary-sm btn-unduh-sertifikat sertifikat-unduh"
            onClick={handleUnduhSertifikatPng}
            disabled={!sertifikatSaya}
            title={sertifikatSaya ? "Unduh sertifikat (PNG)" : "Tersedia setelah admin menerbitkan sertifikat"}
          >
            <Download size={16} aria-hidden="true" /> Unduh Sertifikat
          </button>
        </div>

        <p id="status-sertifikat" className="text-muted" style={{ margin: "0 0 10px", fontSize: "0.84rem" }}>
          {sertifikatSaya
            ? `Sertifikat ${sertifikatSaya.nomorSertifikat} sudah diterbitkan.`
            : capaianTerverifikasi.berhakSertifikat
              ? "Capaian terverifikasi sudah memenuhi satu paket. Menunggu admin menerbitkan sertifikat."
              : "Sertifikat diterbitkan admin setelah data Anda yang memenuhi satu paket (50 titik, 5 km jalur, atau 5 Ha poligon) diverifikasi."}
        </p>

        <div className="certificate-canvas-stage" id="certificate-print-area">
          <canvas ref={certCanvasRef} className="certificate-wysiwyg-canvas" aria-label={`Sertifikat ${sertifikatTampil.namaKader}`} />
        </div>

        {/* PANEL ATUR & TAMBAH LOGO, TTD, SERTA TEMA SERTIFIKAT (KHUSUS ADMIN) */}
        {peran === "admin" && bukaAturSertifikat && (
          <div className="cert-customizer-panel">
            <div className="cert-admin-banner-info">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="badge-admin-only">Khusus Admin</span>
                <strong>Pengaturan Tampilan Sertifikat Resmi</strong>
              </div>
              <small style={{ color: "#64748b" }}>
                Pengaturan logo, tanda tangan pejabat, dan teks tema kegiatan hanya dapat diakses dan diubah oleh akun Administrator.
              </small>
            </div>

            {/* A. TEMA / DESKRIPSI KEGIATAN DI BAWAH 'SEBAGAI KADER DESA' (KHUSUS ADMIN) */}
            <div className="cert-customizer-section">
              <div className="cert-customizer-head">
                <div className="cert-admin-signer-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={15} color="#0d7344" />
                  <strong>Teks Kegiatan (Di Bawah 'Sebagai Kader Desa')</strong>
                </div>
              </div>
              <div className="cert-theme-input-box">
                <input
                  type="text"
                  className="form-input"
                  placeholder='Contoh: "Inventarisasi dan Verifikasi Data Geospasial Wilayah Desa Rimba Hijau"'
                  value={temaKegiatanAktif}
                  onChange={(e) => handleUbahTemaKegiatan(e.target.value)}
                />
                <small style={{ color: "#64748b" }}>
                  Teks ini dicetak tepat di baris bawah <em>"Sebagai Kader Desa"</em> pada sertifikat. Font otomatis menyesuaikan panjang
                  kalimat agar proporsional di PC maupun HP.
                </small>
              </div>
            </div>

            {/* B. PENGATURAN & TAMBAH LOGO SERTIFIKAT */}
            <div className="cert-customizer-section" style={{ marginTop: 12 }}>
              <div className="cert-customizer-head">
                <div className="cert-admin-signer-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <ImageIcon size={15} color="#0284c7" />
                  <strong>Logo Header ({logoListAktif.length})</strong>
                </div>
                <button type="button" className="btn-primary-sm" onClick={handleTambahLogo}>
                  <Plus size={13} /> Tambah Logo
                </button>
              </div>

              {logoListAktif.length === 0 ? (
                <div className="cert-empty-hint">
                  Belum ada logo yang dimasukkan. Klik <strong>+ Tambah Logo</strong> lalu unggah file gambar logo agar ditampilkan pada
                  header sertifikat dan mengaktifkan kode QR verifikasi.
                </div>
              ) : (
                <div className="cert-logo-editor-grid">
                  {logoListAktif.map((logo, idx) => (
                    <div key={logo.id} className="cert-logo-editor-item">
                      <div className="cert-logo-preview-thumb">
                        {logo.imageBase64 ? (
                          <img src={logo.imageBase64} alt={logo.nama} />
                        ) : (
                          <span>{(logo.nama || `L${idx + 1}`).slice(0, 3).toUpperCase()}</span>
                        )}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nama/Instansi Logo"
                        value={logo.nama}
                        onChange={(e) => handleUbahLogo(logo.id, { nama: e.target.value })}
                      />
                      <label
                        className="btn-outline-sm"
                        style={{ margin: 0, cursor: "pointer", whiteSpace: "nowrap" }}
                        title="Unggah Gambar Logo"
                      >
                        <ImageIcon size={13} /> Gambar
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            handleUnggahGambarLogo(logo.id, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button type="button" className="btn-danger-sm" onClick={() => handleHapusLogo(logo.id)} title="Hapus Logo">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* C. PENGATURAN & TAMBAH TANDA TANGAN PEJABAT */}
            <div className="cert-customizer-section" style={{ marginTop: 12 }}>
              <div className="cert-customizer-head">
                <div className="cert-admin-signer-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <PenTool size={15} color="#0284c7" />
                  <strong>Tanda Tangan Pejabat ({penandatanganListAktif.length})</strong>
                </div>
                <button type="button" className="btn-primary-sm" onClick={handleTambahPenandatangan}>
                  <Plus size={13} /> Tambah Penandatangan
                </button>
              </div>

              <div className="cert-signer-editor-list">
                {penandatanganListAktif.map((sig, idx) => (
                  <div key={sig.id} className="cert-signer-editor-card">
                    <div className="cert-signer-card-top">
                      <strong>Penandatangan #{idx + 1}</strong>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <label
                          className="btn-outline-sm"
                          style={{ margin: 0, cursor: "pointer", whiteSpace: "nowrap" }}
                          title="Unggah Gambar Tanda Tangan / Stempel"
                        >
                          <PenTool size={12} /> {sig.tandaTanganBase64 ? "Ganti TTD" : "Unggah TTD"}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              handleUnggahGambarTtd(sig.id, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {sig.tandaTanganBase64 && (
                          <button
                            type="button"
                            className="btn-outline-sm"
                            onClick={() =>
                              handleUbahPenandatanganItem(sig.id, {
                                tandaTanganBase64: undefined
                              })
                            }
                            title="Hapus gambar TTD"
                          >
                            Hapus TTD
                          </button>
                        )}
                        {penandatanganListAktif.length > 1 && (
                          <button
                            type="button"
                            className="btn-danger-sm"
                            onClick={() => handleHapusPenandatangan(sig.id)}
                            title="Hapus Penandatangan"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="form-row-3">
                      <div>
                        <label>Jabatan</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Mis. Dekan / Ketua Umum"
                          value={sig.jabatan}
                          onChange={(e) =>
                            handleUbahPenandatanganItem(sig.id, {
                              jabatan: e.target.value
                            })
                          }
                        />
                      </div>
                      <div>
                        <label>Instansi / Lembaga</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Mis. Indonesia Mapping Community"
                          value={sig.instansi}
                          onChange={(e) =>
                            handleUbahPenandatanganItem(sig.id, {
                              instansi: e.target.value
                            })
                          }
                        />
                      </div>
                      <div>
                        <label>Nama & Gelar</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nama lengkap & gelar"
                          value={sig.nama}
                          onChange={(e) =>
                            handleUbahPenandatanganItem(sig.id, {
                              nama: e.target.value
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. DRAWER PENGATURAN PROFIL */}
      {bukaPengaturan && (
        <div className="section-card">
          <h4 style={{ margin: "0 0 10px", fontSize: "0.94rem", display: "flex", alignItems: "center", gap: 6 }}>
            <UserCheck size={16} color="#0d7344" /> Profil
          </h4>
          <div className="form-row-3">
            <div>
              <label>Nama</label>
              <input
                type="text"
                className="form-input"
                value={profil.nama}
                onChange={(e) => onUbahProfil({ ...profil, nama: e.target.value })}
              />
            </div>
            <div>
              <label>Wilayah</label>
              <input
                type="text"
                className="form-input"
                value={profil.desaWilayah}
                onChange={(e) => onUbahProfil({ ...profil, desaWilayah: e.target.value })}
              />
            </div>
            <div>
              <label>Organisasi</label>
              <input
                type="text"
                className="form-input"
                value={profil.namaOrganisasi}
                onChange={(e) => onUbahProfil({ ...profil, namaOrganisasi: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn-primary-sm" onClick={() => inputFotoRef.current?.click()}>
              <Camera size={14} /> {fotoSertifikatBase64 ? "Ubah Foto" : "Pilih Foto"}
            </button>
            {fotoSertifikatBase64 && (
              <button type="button" className="btn-outline-sm" onClick={handleHapusFotoSertifikat}>
                <Trash2 size={14} /> Hapus Foto
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
