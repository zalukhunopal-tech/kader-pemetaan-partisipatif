import React, { useState, useEffect } from "react";
import { Users, Search, Check, Shield, Award, MapPin, Route, Square, DollarSign, Filter, Save } from "lucide-react";
import { DataSpasialItem, ProfilKader, PeranPengguna } from "../types";
import { LogoSertifikatResmiSvg } from "./sertifikat/LogoSertifikatResmiSvg";
import { muatSemuaAkun } from "../lib/auth";

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
  hokDisetujuiRp: number;
  catatanHok?: string;
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

const STORAGE_KEY_HOK = "geokader_alokasi_hok_admin_v1";

export const PanelDataUserLevel: React.FC<PanelDataUserLevelProps> = ({
  dataSpasial,
  peranPengguna = "admin",
  profilSaya,
  onFokusPetaKader
}) => {
  const [kataKunci, setKataKunci] = useState("");
  const [filterTier, setFilterTier] = useState<string>("semua");
  const [alokasiHokStore, setAlokasiHokStore] = useState<Record<string, { nominalRp: number; catatan: string }>>(() => {
    try {
      const tersimpan = localStorage.getItem(STORAGE_KEY_HOK);
      return tersimpan ? JSON.parse(tersimpan) : {};
    } catch {
      return {};
    }
  });

  const [inputHok, setInputHok] = useState<Record<string, string>>({});
  const [inputCatatan, setInputCatatan] = useState<Record<string, string>>({});
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Kompilasi data direktori kader dari data spasial riil & profil
  const daftarKader = React.useMemo(() => {
    const petaKader = new Map<string, MetrikKaderUser>();

    // Tambahkan profil pengguna sendiri terlebih dahulu
    if (profilSaya) {
      const dataSaya = dataSpasial.filter((d) => d.idKader === profilSaya.idKader);
      const jmlTitik = dataSaya.filter((d) => d.jenisGeometri === "point").length;
      const jmlKm = dataSaya.reduce((acc, d) => acc + (d.panjangKm || 0), 0);
      const jmlHa = dataSaya.reduce((acc, d) => acc + (d.luasHa || 0), 0);
      const lvl = hitungLevelKaderOtomatis(jmlTitik, jmlKm, jmlHa);
      const alokasi = alokasiHokStore[profilSaya.idKader] || { nominalRp: Math.round(jmlKm * 15000 + jmlTitik * 10000), catatan: "HOK Standar Lapangan" };

      petaKader.set(profilSaya.idKader, {
        idKader: profilSaya.idKader,
        nama: profilSaya.nama,
        desaWilayah: profilSaya.desaWilayah,
        kelompok: profilSaya.kelompokMasyarakat || "Kader Lapangan",
        totalTitik: jmlTitik,
        totalJalurKm: Number(jmlKm.toFixed(2)),
        totalPoligonHa: Number(jmlHa.toFixed(2)),
        skorKualitas: dataSaya.length > 0 ? 95 : 80,
        level: lvl.level,
        tierNama: lvl.tierNama,
        tierBadgeColor: lvl.tierBadgeColor,
        hokDisetujuiRp: alokasi.nominalRp,
        catatanHok: alokasi.catatan,
        terakhirAktif: "Hari ini"
      });
    }

    // Ekstrak kader-kader lain dari riwayat data spasial
    dataSpasial.forEach((d) => {
      const id = d.idKader || "KADER-UMUM";
      if (!petaKader.has(id)) {
        const dataDia = dataSpasial.filter((x) => (x.idKader || "KADER-UMUM") === id);
        const jmlTitik = dataDia.filter((x) => x.jenisGeometri === "point").length;
        const jmlKm = dataDia.reduce((acc, x) => acc + (x.panjangKm || 0), 0);
        const jmlHa = dataDia.reduce((acc, x) => acc + (x.luasHa || 0), 0);
        const lvl = hitungLevelKaderOtomatis(jmlTitik, jmlKm, jmlHa);
        const alokasi = alokasiHokStore[id] || { nominalRp: Math.round(jmlKm * 15000 + jmlTitik * 10000), catatan: "Insentif Standar Patroli" };

        petaKader.set(id, {
          idKader: id,
          nama: d.namaKader || `Kader (${id})`,
          desaWilayah: d.desaWilayah || "Desa Tanjung Selor",
          kelompok: "Masyarakat Mitra Polhut",
          totalTitik: jmlTitik,
          totalJalurKm: Number(jmlKm.toFixed(2)),
          totalPoligonHa: Number(jmlHa.toFixed(2)),
          skorKualitas: 92,
          level: lvl.level,
          tierNama: lvl.tierNama,
          tierBadgeColor: lvl.tierBadgeColor,
          hokDisetujuiRp: alokasi.nominalRp,
          catatanHok: alokasi.catatan,
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
          const dataDia = dataSpasial.filter((x) => (x.idKader || "") === a.idKader || (x.namaKader || "").toLowerCase() === a.nama.toLowerCase());
          const jmlTitik = dataDia.filter((x) => x.jenisGeometri === "point").length;
          const jmlKm = dataDia.reduce((acc, x) => acc + (x.panjangKm || 0), 0);
          const jmlHa = dataDia.reduce((acc, x) => acc + (x.luasHa || 0), 0);
          const lvl = hitungLevelKaderOtomatis(jmlTitik, jmlKm, jmlHa);
          const alokasi = alokasiHokStore[id] || { nominalRp: Math.round(jmlKm * 15000 + jmlTitik * 10000), catatan: "HOK Standar Lapangan" };

          petaKader.set(id, {
            idKader: a.idKader || id,
            nama: a.nama,
            desaWilayah: a.desaWilayah || (a.wilayah ? a.wilayah.desa : "Desa Binaan"),
            kelompok: a.kelompokMasyarakat || (a.peran === "admin" ? "Administrator GIS" : "Kader Lapangan"),
            totalTitik: jmlTitik,
            totalJalurKm: Number(jmlKm.toFixed(2)),
            totalPoligonHa: Number(jmlHa.toFixed(2)),
            skorKualitas: dataDia.length > 0 ? 95 : 85,
            level: lvl.level,
            tierNama: lvl.tierNama,
            tierBadgeColor: lvl.tierBadgeColor,
            hokDisetujuiRp: alokasi.nominalRp,
            catatanHok: alokasi.catatan,
            terakhirAktif: dataDia.length > 0 ? "Aktif survei" : "Terdaftar"
          });
        }
      });
    } catch {
      // Abaikan jika auth belum siap
    }

    return Array.from(petaKader.values());
  }, [dataSpasial, profilSaya, alokasiHokStore]);

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

  const handleSimpanHok = (idKader: string, namaKader: string) => {
    const nominalTeks = inputHok[idKader];
    const nominal = nominalTeks !== undefined ? parseInt(nominalTeks.replace(/\D/g, ""), 10) : undefined;
    const catatan = inputCatatan[idKader];

    if (nominal === undefined && catatan === undefined) return;

    const kaderLama = alokasiHokStore[idKader] || { nominalRp: 0, catatan: "" };
    const nextNominal = nominal !== undefined && !isNaN(nominal) ? nominal : kaderLama.nominalRp;
    const nextCatatan = catatan !== undefined ? catatan : kaderLama.catatan;

    const nextStore = {
      ...alokasiHokStore,
      [idKader]: { nominalRp: nextNominal, catatan: nextCatatan }
    };

    setAlokasiHokStore(nextStore);
    try {
      localStorage.setItem(STORAGE_KEY_HOK, JSON.stringify(nextStore));
    } catch {
      //
    }

    setPesanSukses(`✓ HOK untuk ${namaKader} berhasil ditetapkan: Rp ${nextNominal.toLocaleString("id-ID")}`);
    setTimeout(() => setPesanSukses(null), 4000);
  };

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
              Direktori kader terdaftar, klasifikasi tingkatan otomatis (Level 1–20), dan kendali insentif HOK.
            </p>
          </div>
        </div>
      </div>

      {pesanSukses && (
        <div className="alert-banner-success" style={{ margin: "10px 0" }}>
          <Check size={16} /> <span>{pesanSukses}</span>
        </div>
      )}

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
            Pemula (Lvl 1–5)
          </button>
          <button
            type="button"
            className={`tier-pill ${filterTier === "pelaksana" ? "active" : ""}`}
            onClick={() => setFilterTier("pelaksana")}
          >
            Pelaksana (Lvl 6–10)
          </button>
          <button
            type="button"
            className={`tier-pill ${filterTier === "utama" ? "active" : ""}`}
            onClick={() => setFilterTier("utama")}
          >
            Utama (Lvl 11–15)
          </button>
          <button
            type="button"
            className={`tier-pill ${filterTier === "ahli" ? "active" : ""}`}
            onClick={() => setFilterTier("ahli")}
          >
            Ahli (Lvl 16–20)
          </button>
        </div>
      </div>

      {/* DAFTAR KARTU KADER & KONTROL HOK */}
      <div className="panel-user-cards-grid">
        {kaderTersaring.map((kader) => {
          const nominalInput = inputHok[kader.idKader] ?? kader.hokDisetujuiRp.toString();
          const catatanInput = inputCatatan[kader.idKader] ?? (kader.catatanHok || "");

          return (
            <div key={kader.idKader} className="kader-user-level-card">
              {/* TOP ROW: PROFIL & TIER LEVEL */}
              <div className="kader-card-top-row">
                <div className="kader-profile-wrap">
                  <div className="kader-avatar-circle" style={{ borderColor: kader.tierBadgeColor }}>
                    <span className="kader-avatar-lvl">{kader.level}</span>
                  </div>
                  <div className="kader-profile-info">
                    <h4 className="kader-name">{kader.nama}</h4>
                    <div className="kader-id-desa">
                      <span className="kader-id-badge">{kader.idKader}</span>
                      <span className="kader-desa-badge">{kader.desaWilayah}</span>
                    </div>
                  </div>
                </div>

                <div className="kader-tier-badge" style={{ backgroundColor: `${kader.tierBadgeColor}15`, color: kader.tierBadgeColor, borderColor: `${kader.tierBadgeColor}40` }}>
                  <LogoSertifikatResmiSvg size={14} warna={kader.tierBadgeColor} />
                  <span>Level {kader.level} • {kader.tierNama}</span>
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

              {/* BOTTOM ROW: KONTROL PENENTUAN HOK MANUAL OLEH ADMIN */}
              <div className="kader-hok-admin-control">
                <div className="hok-control-title">
                  <DollarSign size={14} className="text-emerald" />
                  <span>Penetapan Alokasi HOK (Hari Orang Kerja):</span>
                </div>

                <div className="hok-inputs-flex">
                  <div className="hok-input-nominal-wrap">
                    <span className="hok-rp-label">Rp</span>
                    <input
                      type="text"
                      className="hok-input-nominal"
                      value={nominalInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setInputHok((prev) => ({ ...prev, [kader.idKader]: val }));
                      }}
                      placeholder="Nominal HOK"
                    />
                  </div>

                  <input
                    type="text"
                    className="hok-input-notes"
                    value={catatanInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputCatatan((prev) => ({ ...prev, [kader.idKader]: val }));
                    }}
                    placeholder="Catatan verifikasi penugasan..."
                  />

                  <button
                    type="button"
                    className="btn-hok-save"
                    onClick={() => handleSimpanHok(kader.idKader, kader.nama)}
                    title="Simpan & Setujui Alokasi HOK"
                  >
                    <Save size={14} />
                    <span>Setujui HOK</span>
                  </button>
                </div>

                <div className="hok-approved-status">
                  <span className="hok-curr-badge">HOK Disetujui: <b>Rp {kader.hokDisetujuiRp.toLocaleString("id-ID")}</b></span>
                  {kader.catatanHok && <span className="hok-approved-note">• {kader.catatanHok}</span>}
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
