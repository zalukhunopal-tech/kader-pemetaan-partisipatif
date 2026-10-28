import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DataSpasialItem,
  KlaimUpahHOK,
  PesanKomunikasi,
  ProfilKader,
  SertifikatKader,
  TugasPemetaan
} from "../types";
import {
  hitungCapaianKader,
  hitungPeringkatGis20Level,
  HasilPeringkatGis20,
  TARGET_POLIGON_HA,
  TARGET_TITIK,
  TARGET_TRACKING_KM
} from "../lib/rewardEngine";
import {
  Award,
  Banknote,
  Download,
  MapPin,
  Footprints,
  Maximize2,
  ShieldCheck,
  Sparkles,
  Settings,
  Printer,
  ArrowUpCircle,
  ArrowDownCircle,
  Layers,
  MessageSquare,
  CheckCircle2,
  Database
} from "lucide-react";

interface RewardViewProps {
  dataSpasial: DataSpasialItem[];
  profil: ProfilKader;
  sertifikatList: SertifikatKader[];
  klaimUpahList: KlaimUpahHOK[];
  pesanList?: PesanKomunikasi[];
  tugasList?: TugasPemetaan[];
  onUbahProfil: (p: ProfilKader) => void;
  onAjukanKlaimUpah: (paketKe: number, rincian: string) => void;
}

/**
 * Helper membungkus teks panjang di Canvas agar tidak pernah menabrak bingkai
 */
function gambarTeksTerbungkus(
  ctx: CanvasRenderingContext2D,
  teks: string,
  x: number,
  yAwal: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 2
): number {
  const kataKata = teks.split(" ");
  let baris = "";
  const daftarBaris: string[] = [];

  for (let i = 0; i < kataKata.length; i++) {
    const ujiBaris = baris ? `${baris} ${kataKata[i]}` : kataKata[i];
    const ukuran = ctx.measureText(ujiBaris);
    if (ukuran.width > maxWidth && baris) {
      daftarBaris.push(baris);
      baris = kataKata[i];
    } else {
      baris = ujiBaris;
    }
  }
  if (baris) daftarBaris.push(baris);

  const barisTampil = daftarBaris.slice(0, maxLines);
  barisTampil.forEach((b, idx) => {
    ctx.fillText(b, x, yAwal + idx * lineHeight);
  });

  return yAwal + (barisTampil.length - 1) * lineHeight;
}

/**
 * Merender Sertifikat ke Canvas beresolusi tinggi (1600 x 1131 px - Rasio A4 Landscape)
 * Digunakan bersama untuk:
 * 1. Preview langsung di layar PC maupun HP (100% identik, anti-berantakan)
 * 2. Cetak langsung (Print / Save as PDF)
 * 3. Unduh Gambar PNG Resolusi Tinggi
 */
function lukisSertifikatKeCanvas(
  canvas: HTMLCanvasElement,
  sert: SertifikatKader,
  peringkat: HasilPeringkatGis20,
  adalahPratinjau: boolean
) {
  const W = 1600;
  const H = 1131;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  // 1. Latar Belakang Hijau Zamrud Gelap Elegan
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#022c22");
  bg.addColorStop(0.5, "#064e3b");
  bg.addColorStop(1, "#03221a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Pola Guilloche / Lingkaran Halus Latar Belakang
  ctx.save();
  ctx.strokeStyle = "rgba(251, 191, 36, 0.05)";
  ctx.lineWidth = 2;
  for (let r = 180; r <= 780; r += 60) {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Bingkai Ornamen Emas Ganda Presisi
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 8;
  ctx.strokeRect(44, 44, W - 88, H - 88);

  ctx.strokeStyle = "rgba(251, 191, 36, 0.45)";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(62, 62, W - 124, H - 124);

  // Ornamen Sudut Bingkai
  const sudut = [
    [44, 44, 1, 1],
    [W - 44, 44, -1, 1],
    [44, H - 44, 1, -1],
    [W - 44, H - 44, -1, -1]
  ];
  ctx.fillStyle = "#fbbf24";
  sudut.forEach(([sx, sy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + dx * 42, sy);
    ctx.lineTo(sx + dx * 42, sy + dy * 10);
    ctx.lineTo(sx + dx * 10, sy + dy * 10);
    ctx.lineTo(sx + dx * 10, sy + dy * 42);
    ctx.lineTo(sx, sy + dy * 42);
    ctx.closePath();
    ctx.fill();
  });

  // 3. Header Instansi / Organisasi
  ctx.textAlign = "center";
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  gambarTeksTerbungkus(
    ctx,
    `★  ${(sert.namaOrganisasi || "KONSORSIUM PEMETAAN PARTISIPATIF NUSANTARA").toUpperCase()}  ★`,
    W / 2,
    140,
    1320,
    30,
    1
  );

  // Sub-header Program
  ctx.fillStyle = "#a7f3d0";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    "PROGRAM SERTIFIKASI KOMPETENSI SURVEI SPASIAL & PEMETAAN WILAYAH PARTISIPATIF",
    W / 2,
    178
  );

  // 4. Judul Utama Piagam
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 54px Georgia, 'Times New Roman', serif";
  ctx.fillText("SERTIFIKAT KADER PEMETAAN", W / 2, 250);

  // Nomor Register Sertifikat
  ctx.fillStyle = "#6ee7b7";
  ctx.font = "bold 20px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText(
    `NOMOR REGISTRASI: ${sert.nomorSertifikat}${adalahPratinjau ? " (PRATINJAU RESMI)" : ""}`,
    W / 2,
    292
  );

  // Garis Pemisah Emas Tengah
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 220, 318);
  ctx.lineTo(W / 2 + 220, 318);
  ctx.stroke();

  // 5. Pengantar Nama Penerima
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "italic 24px Georgia, serif";
  ctx.fillText(
    "Diberikan dengan bangga sebagai pengakuan kompetensi lapangan kepada:",
    W / 2,
    375
  );

  // Nama Kader (Otomatis sesuaikan ukuran font jika nama sangat panjang)
  const namaTampil = sert.namaKader || "Kader Pemetaan Partisipatif";
  let ukuranFontNama = 62;
  ctx.font = `bold ${ukuranFontNama}px Georgia, 'Times New Roman', serif`;
  while (ctx.measureText(namaTampil).width > 1260 && ukuranFontNama > 36) {
    ukuranFontNama -= 4;
    ctx.font = `bold ${ukuranFontNama}px Georgia, 'Times New Roman', serif`;
  }
  ctx.fillStyle = "#fbbf24";
  ctx.fillText(namaTampil, W / 2, 455);

  // Garis Bawah Nama
  const lebarNama = Math.min(1100, Math.max(420, ctx.measureText(namaTampil).width + 60));
  ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - lebarNama / 2, 474);
  ctx.lineTo(W / 2 + lebarNama / 2, 474);
  ctx.stroke();

  // Identitas ID, Wilayah & Peringkat Level GIS
  ctx.fillStyle = "#a7f3d0";
  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `ID Kader: ${sert.idKader}   •   Wilayah: ${sert.desaWilayah}   •   Peringkat GIS: Level ${peringkat.levelSaatIni.level}/20 (${peringkat.levelSaatIni.namaLevel})`,
    W / 2,
    518
  );

  // 6. Deskripsi Kompetensi & Capaian
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "23px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    "Telah memenuhi standar pengumpulan data geospasial, inventarisasi sumber daya desa, serta pemetaan partisipatif:",
    W / 2,
    585
  );

  // Kotak Lencana Capaian Terverifikasi
  const teksCapaian = `Capaian Kompetensi: ${sert.alasanCapaian}`;
  ctx.font = "bold 23px system-ui, -apple-system, sans-serif";
  const lebarKotak = Math.min(1300, Math.max(680, ctx.measureText(teksCapaian).width + 90));
  const xKotak = (W - lebarKotak) / 2;
  const yKotak = 615;
  const hKotak = 64;

  ctx.fillStyle = "rgba(251, 191, 36, 0.14)";
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(xKotak, yKotak, lebarKotak, hKotak, 32);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fde68a";
  gambarTeksTerbungkus(ctx, teksCapaian, W / 2, yKotak + 40, lebarKotak - 40, 26, 1);

  // 7. Bagian Bawah: Tanggal/Verifikasi (Kiri), Stempel Emas (Tengah), Penandatangan (Kanan)
  const yFooterTop = 835;

  // Kiri: Tanggal Terbit & Kode Verifikasi
  ctx.textAlign = "left";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 19px system-ui, -apple-system, sans-serif";
  ctx.fillText("DITERBITKAN & DISAHKAN PADA:", 130, yFooterTop);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  ctx.fillText(sert.tanggalTerbit, 130, yFooterTop + 34);

  ctx.fillStyle = "#6ee7b7";
  ctx.font = "18px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText(`ID Verifikasi: ${sert.id} • Skor GIS: ${peringkat.skorTotal} XP`, 130, yFooterTop + 68);

  //Garis bawah kiri
  ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(130, yFooterTop + 86);
  ctx.lineTo(520, yFooterTop + 86);
  ctx.stroke();

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "17px system-ui, -apple-system, sans-serif";
  ctx.fillText("Basis Data Spasial Komunitas Terverifikasi", 130, yFooterTop + 114);

  // Tengah: Stempel Segel Emas Resmi
  ctx.save();
  ctx.translate(W / 2, yFooterTop + 45);
  ctx.beginPath();
  ctx.arc(0, 0, 82, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(251, 191, 36, 0.14)";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#fbbf24";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 68, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#fde68a";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
  ctx.fillText("★ TERVERIFIKASI ★", 0, -18);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
  ctx.fillText("GIS & MAPPING", 0, 5);
  ctx.fillStyle = "#6ee7b7";
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  ctx.fillText(`LEVEL ${peringkat.levelSaatIni.level} / 20`, 0, 26);
  ctx.restore();

  // Kanan: Pejabat Penandatangan
  ctx.textAlign = "right";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 19px system-ui, -apple-system, sans-serif";
  ctx.fillText("MENGETAHUI & MENGESAHKAN,", W - 130, yFooterTop);

  // Tanda tangan kursif dekoratif
  ctx.fillStyle = "rgba(251, 191, 36, 0.85)";
  ctx.font = "italic 34px Georgia, serif";
  ctx.fillText(sert.ditandatanganiOleh.split(",")[0], W - 150, yFooterTop + 52);

  // Garis Tanda Tangan Kanan
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(W - 540, yFooterTop + 72);
  ctx.lineTo(W - 130, yFooterTop + 72);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  ctx.fillText(sert.ditandatanganiOleh, W - 130, yFooterTop + 102);

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "18px system-ui, -apple-system, sans-serif";
  ctx.fillText(sert.jabatanPenandatangan, W - 130, yFooterTop + 128);
}

export const RewardView: React.FC<RewardViewProps> = ({
  dataSpasial,
  profil,
  sertifikatList,
  klaimUpahList,
  pesanList = [],
  tugasList = [],
  onUbahProfil,
  onAjukanKlaimUpah
}) => {
  const certCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bukaPengaturan, setBukaPengaturan] = useState(false);

  const capaian = useMemo(
    () => hitungCapaianKader(dataSpasial, profil, false),
    [dataSpasial, profil]
  );

  const peringkatGis = useMemo(
    () => hitungPeringkatGis20Level(dataSpasial, profil, pesanList, tugasList),
    [dataSpasial, profil, pesanList, tugasList]
  );

  const sertifikatSaya = sertifikatList.find((s) => s.idKader === profil.idKader);

  const totalPoin = capaian.totalPoinTitik;
  const totalKm = capaian.totalTrackingKm;
  const totalHa = capaian.totalPoligonHa;
  const sudahTersertifikasi = Boolean(sertifikatSaya) || capaian.berhakSertifikat;

  // Objek sertifikat yang ditampilkan pada kanvas preview (menggunakan sertifikat resmi jika sudah terbit,
  // atau pratinjau langsung berbasis data profil kader agar preview selalu tampak identik di PC, HP & Cetak)
  const sertifikatTampil: SertifikatKader = useMemo(() => {
    if (sertifikatSaya) return sertifikatSaya;
    return {
      id: `CERT-${profil.idKader}`,
      nomorSertifikat: `042/SERT-KPP/X/${new Date().getFullYear()}`,
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      namaOrganisasi:
        profil.namaOrganisasi || "Konsorsium Pemetaan Partisipatif Nusantara",
      tanggalTerbit: new Date().toISOString().slice(0, 10),
      alasanCapaian:
        capaian.alasanSertifikat !== "Dalam Progres"
          ? capaian.alasanSertifikat
          : `Kompetensi Survei Spasial (${totalPoin} Titik, ${totalKm.toFixed(1)} km, ${totalHa.toFixed(1)} Ha)`,
      status: sudahTersertifikasi ? "diterbitkan" : "menunggu_admin",
      ditandatanganiOleh: "Ir. Hendra Wijaya, M.Sc.",
      jabatanPenandatangan: "Koordinator Program GIS & Pemetaan Partisipatif"
    };
  }, [sertifikatSaya, profil, capaian.alasanSertifikat, totalPoin, totalKm, totalHa, sudahTersertifikasi]);

  // Render kanvas pratinjau setiap kali data sertifikat atau level berubah
  useEffect(() => {
    if (certCanvasRef.current) {
      lukisSertifikatKeCanvas(
        certCanvasRef.current,
        sertifikatTampil,
        peringkatGis,
        !sertifikatSaya
      );
    }
  }, [sertifikatTampil, peringkatGis, sertifikatSaya]);

  // Unduh Sertifikat sebagai PNG Resolusi Tinggi (sama persis 1:1 dengan preview)
  const handleUnduhSertifikatPng = () => {
    const canvas = certCanvasRef.current;
    if (!canvas) return;
    lukisSertifikatKeCanvas(canvas, sertifikatTampil, peringkatGis, !sertifikatSaya);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sertifikat_Kader_${sertifikatTampil.namaKader.replace(/\s+/g, "_")}.png`;
    a.click();
  };

  // Cetak Sertifikat (100% sama persis dengan yang terlihat di layar HP maupun PC)
  const handleCetakSertifikat = () => {
    const canvas = certCanvasRef.current;
    if (!canvas) return;
    lukisSertifikatKeCanvas(canvas, sertifikatTampil, peringkatGis, !sertifikatSaya);
    const dataUrl = canvas.toDataURL("image/png");

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
          <title>Cetak Sertifikat - ${sertifikatTampil.namaKader}</title>
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
              background: #022c22;
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
          <img src="${dataUrl}" alt="Sertifikat Kader Pemetaan" onload="setTimeout(() => { window.print(); }, 250);" />
        </body>
      </html>
    `);
    win.document.close();
  };

  const {
    levelSaatIni,
    levelBerikutnya,
    levelSebelumnya,
    jumlahLevelDiBawah,
    jumlahLevelKeAtas,
    totalLevelMaksimal,
    skorTotal,
    skorMenujuLevelBerikutnya,
    persenProgresLevel,
    rincianSkor
  } = peringkatGis;

  return (
    <div className="page-container reward-page-wrap">
      {/* 1. HERO CARD: PROFIL KADER & PERINGKAT 20 LEVEL GIS (FOKUS LEVEL SAAT INI & JARAK LEVEL ATAS/BAWAH) */}
      <div className="reward-gis-hero-card">
        <div className="reward-gis-hero-top">
          {/* Identitas Kader */}
          <div className="reward-gis-identity">
            <div className="reward-gis-avatar" aria-hidden="true">
              <span style={{ fontSize: "1.9rem", lineHeight: 1 }}>{levelSaatIni.ikon}</span>
            </div>

            <div className="reward-gis-identity-text">
              <div className="reward-gis-badges">
                <span className="reward-id-badge">{profil.idKader}</span>
                <span className="reward-level-pill">
                  <ShieldCheck size={13} /> Level {levelSaatIni.level} dari {totalLevelMaksimal}
                </span>
                {sudahTersertifikasi && (
                  <span className="reward-cert-status-pill">✓ Tersertifikasi</span>
                )}
              </div>

              <h2 className="reward-kader-name">{profil.nama}</h2>
              <div className="reward-kader-sub">
                {profil.desaWilayah} • {profil.kelompokMasyarakat}
              </div>
            </div>
          </div>

          {/* Tombol Pengaturan Profil */}
          <button
            type="button"
            className="reward-settings-btn"
            onClick={() => setBukaPengaturan((v) => !v)}
          >
            <Settings size={15} />
            <span>Pengaturan Profil</span>
          </button>
        </div>

        {/* PANEL UTAMA POSISI LEVEL GIS SAAT INI (TIDAK MENAMPILKAN SEMUA 20 LEVEL SEKALIGUS) */}
        <div className="gis-level-focus-box">
          <div className="gis-level-current-header">
            <div className="gis-level-current-left">
              <div className="gis-level-tier-tag">{levelSaatIni.kategoriTier}</div>
              <div className="gis-level-title-row">
                <span className="gis-level-num-badge">LEVEL {levelSaatIni.level}</span>
                <strong className="gis-level-name-text">{levelSaatIni.namaLevel}</strong>
              </div>
              <p className="gis-level-desc">{levelSaatIni.deskripsiSingkat}</p>
            </div>

            <div className="gis-level-score-box">
              <span className="gis-score-label">Total Skor GIS</span>
              <strong className="gis-score-value">{skorTotal.toLocaleString("id-ID")} XP</strong>
              <small className="gis-score-sub">Multi-Indikator Aktif</small>
            </div>
          </div>

          {/* BAR PROGRES MENUJU LEVEL BERIKUTNYA */}
          <div className="gis-level-progress-wrap">
            <div className="gis-level-progress-labels">
              <span>
                Progres ke{" "}
                {levelBerikutnya
                  ? `Level ${levelBerikutnya.level} (${levelBerikutnya.namaLevel})`
                  : "Level Maksimal Tercapai"}
              </span>
              <strong>
                {levelBerikutnya
                  ? `Kurang ${skorMenujuLevelBerikutnya} XP lagi (${persenProgresLevel}%)`
                  : "100% (Level Puncak 20/20)"}
              </strong>
            </div>
            <div className="gis-level-progress-track">
              <div
                className="gis-level-progress-fill"
                style={{ width: `${persenProgresLevel}%` }}
              />
            </div>
          </div>

          {/* RINGKASAN BERAPA LEVEL KE BAWAH & BERAPA LEVEL LAGI KE ATAS */}
          <div className="gis-level-updown-grid">
            <div className="gis-updown-card down">
              <ArrowDownCircle size={22} className="gis-updown-icon down" />
              <div className="gis-updown-content">
                <div className="gis-updown-title">
                  {jumlahLevelDiBawah > 0
                    ? `${jumlahLevelDiBawah} Level di Bawah Telah Dilampaui`
                    : "Berada di Level Awal (0 Level di Bawah)"}
                </div>
                <div className="gis-updown-sub">
                  {levelSebelumnya
                    ? `1 Level di bawah: Lv.${levelSebelumnya.level} ${levelSebelumnya.namaLevel} (${levelSebelumnya.minSkor} XP)`
                    : "Mulai kumpulkan data & diskusi untuk naik level"}
                </div>
              </div>
            </div>

            <div className="gis-updown-card up">
              <ArrowUpCircle size={22} className="gis-updown-icon up" />
              <div className="gis-updown-content">
                <div className="gis-updown-title">
                  {jumlahLevelKeAtas > 0
                    ? `${jumlahLevelKeAtas} Level Lagi ke Atas (Menuju Level 20)`
                    : "Puncak Tertinggi Tercapai (Level 20 dari 20)"}
                </div>
                <div className="gis-updown-sub">
                  {levelBerikutnya
                    ? `Target terdekat: Lv.${levelBerikutnya.level} ${levelBerikutnya.namaLevel} (Target ${levelBerikutnya.minSkor} XP)`
                    : "Anda telah mencapai level tertinggi Maestro GIS Nusantara"}
                </div>
              </div>
            </div>
          </div>

          {/* RINCIAN 5 PILAR PENENTU LEVEL GIS (DATA, VARIASI, DISKUSI, KUALITAS, TUGAS) */}
          <div className="gis-pillars-grid">
            <div className="gis-pillar-chip">
              <Database size={14} />
              <div>
                <span>Volume Data ({rincianSkor.detailStatistik.totalObjek} objek)</span>
                <strong>+{rincianSkor.skorVolumeData} XP</strong>
              </div>
            </div>

            <div className="gis-pillar-chip">
              <Layers size={14} />
              <div>
                <span>
                  Variasi ({rincianSkor.detailStatistik.kategoriUnik}/6 kat •{" "}
                  {rincianSkor.detailStatistik.geometriUnik}/3 geom)
                </span>
                <strong>+{rincianSkor.skorVariasiData} XP</strong>
              </div>
            </div>

            <div className="gis-pillar-chip">
              <MessageSquare size={14} />
              <div>
                <span>
                  Keaktifan Diskusi ({rincianSkor.detailStatistik.pesanDiskusi} pesan •{" "}
                  {rincianSkor.detailStatistik.pinDibagikan} pin)
                </span>
                <strong>+{rincianSkor.skorDiskusi} XP</strong>
              </div>
            </div>

            <div className="gis-pillar-chip">
              <CheckCircle2 size={14} />
              <div>
                <span>
                  Kualitas & Tugas ({rincianSkor.detailStatistik.dataBerfoto} foto •{" "}
                  {rincianSkor.detailStatistik.tugasSelesai} tugas)
                </span>
                <strong>+{rincianSkor.skorKualitasData + rincianSkor.skorTugas} XP</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. INFOGRAFIS 3 KARTU TARGET SPASIAL */}
      <div className="section-card">
        <div className="section-header-flex" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: "1.02rem" }}>
            🎯 Progres 1 Paket Capaian Lapangan
          </h3>
          <span className="text-xs text-muted">
            Syarat 1 Paket: 50 Titik ATAU 5,0 km ATAU 5,0 Ha
          </span>
        </div>

        <div className="reward-targets-grid">
          {/* 1. Titik Koordinat */}
          <div className="reward-target-card green">
            <div className="reward-target-icon green">
              <MapPin size={22} />
            </div>
            <div className="reward-target-body">
              <div className="reward-target-head">
                <strong>Titik Koordinat</strong>
                <span>
                  {totalPoin} / {TARGET_TITIK}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill emerald"
                  style={{ width: `${Math.min(100, (totalPoin / TARGET_TITIK) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 2. Tracking Line */}
          <div className="reward-target-card blue">
            <div className="reward-target-icon blue">
              <Footprints size={22} />
            </div>
            <div className="reward-target-body">
              <div className="reward-target-head">
                <strong>Jejak Tracking</strong>
                <span>
                  {totalKm.toFixed(1)} / {TARGET_TRACKING_KM.toFixed(1)} km
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill sky"
                  style={{
                    width: `${Math.min(100, (totalKm / TARGET_TRACKING_KM) * 100)}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3. Poligon Area */}
          <div className="reward-target-card amber">
            <div className="reward-target-icon amber">
              <Maximize2 size={22} />
            </div>
            <div className="reward-target-body">
              <div className="reward-target-head">
                <strong>Poligon Wilayah</strong>
                <span>
                  {totalHa.toFixed(1)} / {TARGET_POLIGON_HA.toFixed(1)} Ha
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill amber"
                  style={{
                    width: `${Math.min(100, (totalHa / TARGET_POLIGON_HA) * 100)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PREVIEW & CETAK SERTIFIKAT RESMI (KONSISTEN 1:1 DI PC, HP, DAN CETAK/PRINT) */}
      <div className="section-card certificate-section-card">
        <div className="certificate-header-bar">
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
              <Award size={20} color="#0d7344" /> Preview & Cetak Sertifikat Kader Pemetaan
            </h3>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              Tampilan pratinjau presisi rasio A4 Landscape — hasil lihat di HP, PC, dan hasil cetak dijamin sama persis.
            </p>
          </div>

          <div className="certificate-action-btns">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={handleCetakSertifikat}
            >
              <Printer size={14} /> Cetak / Simpan PDF
            </button>
            <button
              type="button"
              className="btn-primary-sm"
              onClick={handleUnduhSertifikatPng}
            >
              <Download size={14} /> Unduh Piagam (.PNG)
            </button>
          </div>
        </div>

        {/* WADAH RASIO KUNCI A4 LANDSCAPE (ANTI-BERANTAKAN DI LAYAR KECIL MAUPUN BESAR) */}
        <div className="certificate-canvas-stage" id="certificate-print-area">
          <canvas
            ref={certCanvasRef}
            className="certificate-wysiwyg-canvas"
            aria-label={`Pratinjau Sertifikat Kader Pemetaan atas nama ${sertifikatTampil.namaKader}`}
          />
        </div>

        <div className="certificate-status-footnote">
          <span>
            Status:{" "}
            <strong>
              {sertifikatSaya
                ? "✅ Sertifikat Resmi Diterbitkan Admin"
                : sudahTersertifikasi
                ? "✅ Syarat Terpenuhi (Siap Disahkan Admin)"
                : "👁️ Mode Pratinjau Aktif (Selesaikan 1 Paket untuk Pengesahan Resmi)"}
            </strong>
          </span>
          <span>No. Reg: {sertifikatTampil.nomorSertifikat}</span>
        </div>
      </div>

      {/* 4. TIKET INSENTIF HOK */}
      <div className="section-card">
        <div className="section-header-flex" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "1.02rem" }}>
              <Banknote size={20} color="#0d7344" /> Tiket Insentif Harian (1 HOK)
            </h3>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              Hak upah kerja Rp {profil.tarifHokRupiah.toLocaleString("id-ID")} setiap menyelesaikan 2x paket capaian
            </p>
          </div>

          {capaian.jumlahHakUpahHok > klaimUpahList.length && (
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() =>
                onAjukanKlaimUpah(
                  (klaimUpahList.length + 1) * 2,
                  `Capaian ${capaian.totalPoinTitik} titik, ${capaian.totalTrackingKm.toFixed(1)} km, ${capaian.totalPoligonHa.toFixed(1)} Ha`
                )
              }
            >
              <Sparkles size={14} /> Klaim 1 HOK
            </button>
          )}
        </div>

        {klaimUpahList.length > 0 ? (
          <div className="hok-list">
            {klaimUpahList.map((k) => (
              <div key={k.id} className="hok-item">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>
                    Tiket {k.id} • Paket Ke-{k.paketKe} (1 HOK)
                  </div>
                  <div className="text-xs text-muted">{k.rincianBukti}</div>
                </div>

                <div className="hok-item-right">
                  <div className="hok-nominal">
                    Rp {k.nominalRupiah.toLocaleString("id-ID")}
                  </div>
                  <span className={`badge-sync status-${k.status}`}>
                    {k.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "0.84rem", background: "#f8faf9", borderRadius: 12 }}>
            Belum ada klaim 1 HOK. Kumpulkan data survei untuk mengajukan insentif kerja.
          </div>
        )}
      </div>

      {/* 5. DRAWER PENGATURAN IDENTITAS PROFIL KADER */}
      {bukaPengaturan && (
        <div className="section-card">
          <h4 style={{ margin: "0 0 12px", fontSize: "0.96rem", color: "#181a19" }}>
            ⚙️ Pengaturan Identitas & Skema Capaian Kader
          </h4>
          <div className="form-row-3">
            <div>
              <label>Nama Lengkap di Sertifikat</label>
              <input
                type="text"
                className="form-input"
                value={profil.nama}
                onChange={(e) => onUbahProfil({ ...profil, nama: e.target.value })}
              />
            </div>
            <div>
              <label>Desa / Wilayah</label>
              <input
                type="text"
                className="form-input"
                value={profil.desaWilayah}
                onChange={(e) => onUbahProfil({ ...profil, desaWilayah: e.target.value })}
              />
            </div>
            <div>
              <label>Organisasi Penerbit</label>
              <input
                type="text"
                className="form-input"
                value={profil.namaOrganisasi}
                onChange={(e) => onUbahProfil({ ...profil, namaOrganisasi: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row-2" style={{ marginTop: 10 }}>
            <div>
              <label>Kelompok Masyarakat / KTH</label>
              <input
                type="text"
                className="form-input"
                value={profil.kelompokMasyarakat}
                onChange={(e) => onUbahProfil({ ...profil, kelompokMasyarakat: e.target.value })}
              />
            </div>
            <div>
              <label>Mode Kombinasi Progres</label>
              <select
                className="form-input"
                value={profil.modeKombinasiTarget}
                onChange={(e) =>
                  onUbahProfil({
                    ...profil,
                    modeKombinasiTarget: e.target.value as ProfilKader["modeKombinasiTarget"]
                  })
                }
              >
                <option value="per_kategori">Penuh per Kategori (50 Titik / 5 km / 5 Ha)</option>
                <option value="gabungan_proporsional">Gabungan Proporsional Lintas Geometri</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
