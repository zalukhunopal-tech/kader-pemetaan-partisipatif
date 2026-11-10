import React, { useState, useEffect } from "react";
import { Users, Search, Check, Shield, Award, MapPin, Route, Square, DollarSign, Filter, Save } from "lucide-react";
import { DataSpasialItem, ProfilKader, PeranPengguna } from "../types";
import { LogoSertifikatResmiSvg } from "./sertifikat/LogoSertifikatResmiSvg";
import { muatSemuaAkun } from "../lib/auth";
import { dihitungUntukCapaian } from "../lib/geoUtils";
import { hitungSkorKualitasData } from "../lib/kualitasData";

export interface MetrikKaderUser {
  idKader: string;
  nama: string;
  desaWilayah: string;
  kelompok: string;
  totalTitik: number;
  totalJalurKm: number;
  totalPoligonHa: number;
  skorKualitas: number; // 0 - 100
  level: number;
  tierNama: string;
  tierBadgeColor: string;
    terakhirAktif: string;
}

export function hitungLevelKaderOtomatis(titik: number, jalurKm: number, poligonHa: number): {
  level: number;
  tierNama: string;
  tierBadgeColor: string;
  skorXp: number;
} {
  // Sistem XP Gamifikasi Lapangan
  // 1 titik = 25 XP, 1 km jalur = 50 XP, 1 Ha poligon = 75 XP
  const skorXp = Math.round(titik * 25 + jalurKm * 50 + poligonHa * 75);

  let level = 1;
  let tierNama = "Kader Pemula";
  let tierBadgeColor = "#64748b";

  if (skorXp >= 2500) {
    level = Math.min(20, 16 + Math.floor((skorXp - 2500) / 500));
    tierNama = "Kader Ahli (GIS Specialist)";
    tierBadgeColor = "#7c3aed";
  } else if (skorXp >= 1200) {
    level = 11 + Math.floor((skorXp - 1200) / 260);
    tierNama = "Kader Utama (Lead Surveyor)";
    tierBadgeColor = "#0284c7";
  } else if (skorXp >= 400) {
    level = 6 + Math.floor((skorXp - 400) / 160);
    tierNama = "Kader Pelaksana";
    tierBadgeColor = "#0d7344";
  } else {
    level = 1 + Math.floor(skorXp / 100);
    tierNama = "Kader Pemula";
    tierBadgeColor = "#d97706";
  }

  return { level, tierNama, tierBadgeColor, skorXp };
}

interface PanelDataUserLevelProps {
  dataSpasial: DataSpasialItem[];
  peranPengguna?: PeranPengguna;
  profilSaya?: ProfilKader;
  onFokusPetaKader?: (lat: number, lng: number, nama: string) => void;
}


function hitungRerataKualitas(items: DataSpasialItem[]): number {
  if (items.length === 0) return 80;
  const total = items.reduce((acc, d) => acc + hitungSkorKualitasData(d).skor, 0);
  return Math.round(total / items.length);
}

export const PanelDataUserLevel: React.FC<PanelDataUserLevelProps> = ({
  dataSpasial,
  peranPengguna = "admin",
  profilSaya,
  onFokusPetaKader
}) => {
  const [kataKunci, setKataKunci] = useState("");
  const [filterTier, setFilterTier] = useState<string>("semua");

  // Kompilasi data direktori kader dari data spasial riil & profil
  const daftarKader = React.useMemo(() => {
    const petaKader = new Map<string, MetrikKaderUser>();

    // Tambahkan profil pengguna sendiri terlebih dahulu
    if (profilSaya) {
      const dataSaya = dataSpasial.filter((d) => d.idKader === profilSaya.idKader && dihitungUntukCapaian(d));
      const jmlTitik = dataSaya.filter((d) => d.jenisGeometri === "point").length;
      const jmlKm = dataSaya.reduce((acc, d) => acc + (d.panjangKm || 0), 0);
      const jmlHa = dataSaya.reduce((acc, d) => acc + (d.luasHa || 0), 0);
      const lvl = hitungLevelKaderOtomatis(jmlTitik, jmlKm, jmlHa);
      petaKader.set(profilSaya.idKader, {
        idKader: profilSaya.idKader,
        nama: profilSaya.nama,
        desaWilayah: profilSaya.desaWilayah,
        kelompok: profilSaya.kelompokMasyarakat || "Kader Lapangan",
        totalTitik: jmlTitik,
        totalJalurKm: Number(jmlKm.toFixed(2)),
        totalPoligonHa: Number(jmlHa.toFixed(2)),
        skorKualitas: hitungRerataKualitas(dataSaya),
        level: lvl.level,
        tierNama: lvl.tierNama,
        tierBadgeColor: lvl.tierBadgeColor,
        terakhirAktif: "Hari ini"
      });
    }

    // Ekstrak kader-kader lain dari riwayat data spasial
    dataSpasial.forEach((d) => {
      const id = d.idKader || "KADER-UMUM";
      if (!petaKader.has(id)) {
        const dataDia = dataSpasial.filter((x) => (x.idKader || "KADER-UMUM") === id && dihitungUntukCapaian(x));
        const jmlTitik = dataDia.filter((x) => x.jenisGeometri === "point").length;
        const jmlKm = dataDia.reduce((acc, x) => acc + (x.panjangKm || 0), 0);
        const jmlHa = dataDia.reduce((acc, x) => acc + (x.luasHa || 0), 0);
        const lvl = hitungLevelKaderOtomatis(jmlTitik, jmlKm, jmlHa);
        petaKader.set(id, {
          idKader: id,
          nama: d.namaKader || `Kader (${id})`,
          desaWilayah: d.desaWilayah || "Desa Tanjung Selor",
          kelompok: "Masyarakat Mitra Polhut",
          totalTitik: jmlTitik,
          totalJalurKm: Number(jmlKm.toFixed(2)),
          totalPoligonHa: Number(jmlHa.toFixed(2)),
          skorKualitas: hitungRerataKualitas(dataDia),
          level: lvl.level,
          tierNama: lvl.tierNama,
          tierBadgeColor: lvl.tierBadgeColor,
          terakhirAktif: d.createdAt ? new Date(d.createdAt).toLocaleDateString("id-ID") : "Baru saja"
        });
      }
    });

    // Muat semua akun kader/user riil terdaftar dari sistem autentikasi (tanpa akun dummy)
    try {
      const akunTerdaftar = muatSemuaAkun();
      akunTerdaftar.forEach((a) => {
        const id = a.idKader || a.email;
        if (!petaKader.has(id)) {
          const dataDia = dataSpasial.filter((x) => ((x.idKader || "") === a.idKader || (x.namaKader || "").toLowerCase() === a.nama.toLowerCase()) && dihitungUntukCapaian(x));
          const jmlTitik = dataDia.filter((x) => x.jenisGeometri === "point").length;
          const jmlKm = dataDia.reduce((acc, x) => acc + (x.panjangKm || 0), 0);
          const jmlHa = dataDia.reduce((acc, x) => acc + (x.luasHa || 0), 0);
          const lvl = hitungLevelKaderOtomatis(jmlTitik, jmlKm, jmlHa);
          const desaDasar = a.desaWilayah || (a.wilayah ? a.wilayah.desa : "Desa Binaan");
          const labelDesa =
            a.statusPersetujuan === "menunggu"
              ? `${desaDasar} • Menunggu Persetujuan Admin`
              : a.statusPersetujuan === "ditolak"
                ? `${desaDasar} • Pendaftaran Ditolak`
                : desaDasar;
          petaKader.set(id, {
            idKader: a.idKader || id,
            nama: a.nama,
            desaWilayah: labelDesa,
            kelompok: a.kelompokMasyarakat || (a.peran === "admin" ? "Administrator GIS" : "Kader Lapangan"),
            totalTitik: jmlTitik,
            totalJalurKm: Number(jmlKm.toFixed(2)),
            totalPoligonHa: Number(jmlHa.toFixed(2)),
            skorKualitas: hitungRerataKualitas(dataDia),
            level: lvl.level,
            tierNama: lvl.tierNama,
            tierBadgeColor: lvl.tierBadgeColor,
            terakhirAktif:
              a.statusPersetujuan === "menunggu"
                ? "Menunggu Persetujuan Admin"
                : dataDia.length > 0
                  ? "Aktif survei"
                  : "Terdaftar"
          });
        }
      });
    } catch {
      // Abaikan jika auth belum siap
    }

    return Array.from(petaKader.values());
  }, [dataSpasial, profilSaya]);

  const kaderTersaring = daftarKader.filter((k) => {
    const cocokTeks =
      !kataKunci.trim() ||
      k.nama.toLowerCase().includes(kataKunci.toLowerCase()) ||
      k.idKader.toLowerCase().includes(kataKunci.toLowerCase()) ||
      k.desaWilayah.toLowerCase().includes(kataKunci.toLowerCase());

    if (!cocokTeks) return false;
    if (filterTier === "pemula") return k.level <= 5;
    if (filterTier === "pelaksana") return k.level >= 6 && k.level <= 10;
    if (filterTier === "utama") return k.level >= 11 && k.level <= 15;
    if (filterTier === "ahli") return k.level >= 16;
    return true;
  });

  

  return (
    <div className="panel-data-user-level-container">
      {/* HEADER SECTION */}
      <div className="panel-user-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="panel-user-icon-badge">
            <Users size={22} className="text-emerald" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>
              Data User & Level Kader
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              Direktori kader terdaftar dan klasifikasi tingkatan otomatis (Level 1–20).
            </p>
          </div>
        </div>
      </div>

      

      {/* FILTER & PENCARIAN KADER */}
      <div className="panel-user-filter-bar">
        <div className="panel-search-box">
          <Search size={16} className="text-muted" />
          <input
            type="text"
            placeholder="Cari nama, ID kader, atau desa…"
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
          />
        </div>

        <div className="panel-tier-pills">
          <button
            type="button"
            className={`tier-pill ${filterTier === "semua" ? "active" : ""}`}
            onClick={() => setFilterTier("semua")}
          >
            Semua ({daftarKader.length})
          </button>
          <button
            type="button"
            className={`tier-pill ${filterTier === "pemula" ? "active" : ""}`}
            onClick={() => setFilterTier("pemula")}
          >
            Pemula (1–5)
          </button>
          <button
            type="button"
            className={`tier-pill ${filterTier === "pelaksana" ? "active" : ""}`}
            onClick={() => setFilterTier("pelaksana")}
          >
            Pelaksana (6–10)
          </button>
          <button
            type="button"
            className={`tier-pill ${filterTier === "utama" ? "active" : ""}`}
            onClick={() => setFilterTier("utama")}
          >
            Utama (11–15)
          </button>
          <button
            type="button"
            className={`tier-pill ${filterTier === "ahli" ? "active" : ""}`}
            onClick={() => setFilterTier("ahli")}
          >
            Ahli (16–20)
          </button>
        </div>
      </div>

      {/* DAFTAR KARTU KADER & KONTROL HOK */}
      <div className="panel-user-cards-grid">
        {kaderTersaring.map((kader) => {
          const tierRingkas = kader.tierNama.replace(/^Kader\s+/i, "");

          return (
            <div key={kader.idKader} className="kader-user-level-card">
              {/* TOP ROW: PROFIL & TIER LEVEL */}
              <div className="kader-card-top-row">
                <div className="kader-profile-wrap">
                  <div className="kader-avatar-circle" style={{ borderColor: kader.tierBadgeColor }}>
                    <span className="kader-avatar-lvl">{kader.level}</span>
                  </div>
                  <div className="kader-profile-info">
                    <h4 className="kader-name" title={kader.nama}>{kader.nama}</h4>
                    <div className="kader-id-desa">
                      <span className="kader-id-badge">{kader.idKader}</span>
                      <span className="kader-desa-badge" title={kader.desaWilayah}>{kader.desaWilayah}</span>
                    </div>
                  </div>
                </div>

                <div
                  className="kader-tier-badge"
                  title={`Level ${kader.level} • ${kader.tierNama}`}
                  style={{ backgroundColor: `${kader.tierBadgeColor}15`, color: kader.tierBadgeColor, borderColor: `${kader.tierBadgeColor}40` }}
                >
                  <LogoSertifikatResmiSvg size={14} warna={kader.tierBadgeColor} />
                  <span>Lvl {kader.level} • {tierRingkas}</span>
                </div>
              </div>

              {/* MIDDLE ROW: METRIK KINERJA */}
              <div className="kader-metrics-strip">
                <div className="metric-pill">
                  <MapPin size={13} className="text-emerald" />
                  <span><b>{kader.totalTitik}</b> Titik</span>
                </div>
                <div className="metric-pill">
                  <Route size={13} className="text-sky" />
                  <span><b>{kader.totalJalurKm}</b> km Jalur</span>
                </div>
                <div className="metric-pill">
                  <Square size={13} className="text-amber" />
                  <span><b>{kader.totalPoligonHa}</b> Ha Poligon</span>
                </div>
                <div className="metric-pill">
                  <Award size={13} className="text-purple" />
                  <span>Kualitas: <b>{kader.skorKualitas}%</b></span>
                </div>
              </div>

              </div>
          );
        })}

        {kaderTersaring.length === 0 && (
          <div className="kader-empty-state">
            <Users size={32} className="text-muted" />
            <p>Tidak ada data kader yang sesuai dengan pencarian atau filter tier.</p>
          </div>
        )}
      </div>
    </div>
  );
};
