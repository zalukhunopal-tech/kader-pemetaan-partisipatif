import React, { useState } from "react";
import {
  AkunSesi,
  MIN_PANJANG_SANDI,
  adaAdmin,
  autentikasiLogin,
  buatAdminPertama,
  mulaiPendaftaranEmail,
  mulaiPendaftaranTotp,
  selesaikanPendaftaranTotp,
  simpanSesiPengguna,
  ubahKataSandi,
  verifikasiKodeEmailPendaftaran
} from "../lib/auth";
import { rahasiaUntukTampil } from "../lib/totp";
import { useWallpaperLoginHarian } from "../lib/wallpaperLogin";
import { KodeQrSvg } from "./KodeQrSvg";
import { TombolInstal } from "./InstalAplikasi";
import { AlertCircle, CheckCircle2, Copy, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Smartphone, UserPlus } from "lucide-react";

interface AuthModalProps {
  onLoginSukses: (akun: AkunSesi) => void;
  onBukaSplashTaka?: () => void;
}

type Mode =
  | "setup_admin"
  | "login"
  | "daftar_akun"
  | "verifikasi_email"
  | "kode_totp"
  | "daftar_totp"
  | "kode_pemulihan"
  | "ganti_sandi"
  | "lupa_password";

const gayaLabel: React.CSSProperties = {
  display: "block",
  fontSize: "0.78rem",
  fontWeight: 700,
  color: "#334155",
  marginBottom: 5
};
const gayaInput: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 12px",
  borderRadius: 10,
  border: "1.5px solid #cbd5e1",
  fontSize: "0.88rem",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  boxSizing: "border-box"
};
const gayaInputIkon: React.CSSProperties = { ...gayaInput, padding: "0 12px 0 38px" };
const gayaTombol = (sibuk: boolean): React.CSSProperties => ({
  width: "100%",
  height: 46,
  borderRadius: 10,
  background: "#0d7344",
  color: "#ffffff",
  border: "none",
  fontWeight: 700,
  fontSize: "0.92rem",
  cursor: sibuk ? "wait" : "pointer",
  opacity: sibuk ? 0.7 : 1,
  boxShadow: "0 2px 8px rgba(13, 115, 68, 0.25)"
});
const gayaTautan: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#64748b",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer"
};
const gayaIkonKiri: React.CSSProperties = {
  position: "absolute",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
  pointerEvents: "none"
};

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSukses, onBukaSplashTaka }) => {
  // Wallpaper harian otomatis dari Google Drive yang berganti tiap hari
  const { urlGambar } = useWallpaperLoginHarian();

  // Perangkat baru yang belum memiliki akun admin membuka penyiapan Administrator pertama
  const [mode, setMode] = useState<Mode>(() => (adaAdmin() ? "login" : "setup_admin"));

  const [emailLogin, setEmailLogin] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [lihatPassword, setLihatPassword] = useState(false);
  const [kode, setKode] = useState("");

  // Penyiapan Administrator Pertama
  const [namaSetup, setNamaSetup] = useState("");
  const [emailSetup, setEmailSetup] = useState("");
  const [desaSetup, setDesaSetup] = useState("");
  const [hpSetup, setHpSetup] = useState("");
  const [sandiSetup, setSandiSetup] = useState("");
  const [sandiSetupUlang, setSandiSetupUlang] = useState("");
  const [kodeAktivasi, setKodeAktivasi] = useState("");
  const perluKodeAktivasi = Boolean((import.meta.env.VITE_KODE_ADMIN ?? "").trim());

  // Pendaftaran Akun Baru dengan Verifikasi Email
  const [namaDaftar, setNamaDaftar] = useState("");
  const [emailDaftar, setEmailDaftar] = useState("");
  const [desaDaftar, setDesaDaftar] = useState("");
  const [hpDaftar, setHpDaftar] = useState("");
  const [kelompokDaftar, setKelompokDaftar] = useState("");
  const [sandiDaftar, setSandiDaftar] = useState("");
  const [sandiDaftarUlang, setSandiDaftarUlang] = useState("");
  const [kodeOtpEmail, setKodeOtpEmail] = useState("");
  const [infoOtpEmail, setInfoOtpEmail] = useState<{
    email: string;
    kodeVerifikasi?: string;
    terkirimServer?: boolean;
    mxHost?: string | null;
  } | null>(null);

  // Ganti sandi wajib
  const [sandiBaru, setSandiBaru] = useState("");
  const [sandiBaruUlang, setSandiBaruUlang] = useState("");

  // Pendaftaran Authenticator
  const [totp, setTotp] = useState<{ rahasia: string; uri: string } | null>(null);
  const [kodeKonfirmasi, setKodeKonfirmasi] = useState("");
  const [hasilDaftar, setHasilDaftar] = useState<{ akun: AkunSesi; kodePemulihan: string[] } | null>(null);
  const [sudahDisimpan, setSudahDisimpan] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  const [pesanError, setPesanError] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [sedangProses, setSedangProses] = useState(false);

  const resetAlert = () => {
    setPesanError(null);
    setPesanSukses(null);
  };
  const pindah = (m: Mode) => {
    resetAlert();
    setMode(m);
  };
  const kembaliKeLogin = () => {
    setPasswordLogin("");
    setKode("");
    setTotp(null);
    pindah(adaAdmin() ? "login" : "setup_admin");
  };

  const masukKeAplikasi = (akun: AkunSesi, pesan: string, jeda = 350) => {
    setPesanSukses(pesan);
    setTimeout(() => onLoginSukses(akun), jeda);
  };

  /** Mengarahkan hasil langkah sandi ke layar berikutnya */
  const lanjutDariSandi = async (email: string, sandi: string, kodeTotp = ""): Promise<void> => {
    const res = await autentikasiLogin(email, sandi, kodeTotp);
    if (res.wajibGantiSandi) {
      setSandiBaru("");
      setSandiBaruUlang("");
      setMode("ganti_sandi");
      setPesanError(res.pesan);
      return;
    }
    if (res.perluDaftarTotp) {
      await mulaiDaftarTotp(email, sandi);
      return;
    }
    if (res.perluKodeTotp) {
      setMode("kode_totp");
      setKode("");
      if (kodeTotp) setPesanError(res.pesan);
      else setPesanError(null);
      return;
    }
    if (!res.sukses || !res.akun) {
      setPesanError(res.pesan);
      return;
    }
    masukKeAplikasi(res.akun, res.pesan);
  };

  const mulaiDaftarTotp = async (email: string, sandi: string) => {
    const r = await mulaiPendaftaranTotp(email, sandi);
    if (!r.sukses || !r.rahasia || !r.uri) {
      setPesanError(r.pesan);
      setMode("login");
      return;
    }
    setTotp({ rahasia: r.rahasia, uri: r.uri });
    setKodeKonfirmasi("");
    setMode("daftar_totp");
    setPesanError(null);
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    if (sandiSetup !== sandiSetupUlang) {
      setPesanError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setSedangProses(true);
    try {
      const res = await buatAdminPertama(
        {
          nama: namaSetup,
          email: emailSetup,
          desaWilayah: desaSetup,
          noHp: hpSetup,
          kataSandi: sandiSetup
        },
        kodeAktivasi
      );
      if (!res.sukses) {
        setPesanError(res.pesan);
        return;
      }
      setEmailLogin(emailSetup);
      setPasswordLogin(sandiSetup);
      await mulaiDaftarTotp(emailSetup, sandiSetup);
    } finally {
      setSedangProses(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    if (!emailLogin.trim() || !passwordLogin) {
      setPesanError("Harap masukkan email dan kata sandi.");
      return;
    }
    setSedangProses(true);
    try {
      await lanjutDariSandi(emailLogin, passwordLogin);
    } finally {
      setSedangProses(false);
    }
  };

  const handleKodeTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    if (!kode.trim()) {
      setPesanError("Masukkan kode dari Google Authenticator atau kode pemulihan.");
      return;
    }
    setSedangProses(true);
    try {
      await lanjutDariSandi(emailLogin, passwordLogin, kode);
    } finally {
      setSedangProses(false);
    }
  };

  const handleGantiSandi = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    if (sandiBaru !== sandiBaruUlang) {
      setPesanError("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }
    setSedangProses(true);
    try {
      const res = await ubahKataSandi(emailLogin, passwordLogin, sandiBaru);
      if (!res.sukses) {
        setPesanError(res.pesan);
        return;
      }
      setPasswordLogin(sandiBaru);
      await lanjutDariSandi(emailLogin, sandiBaru);
    } finally {
      setSedangProses(false);
    }
  };

  const handleKonfirmasiTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    if (!totp) return;
    setSedangProses(true);
    try {
      const res = await selesaikanPendaftaranTotp(emailLogin, passwordLogin, totp.rahasia, kodeKonfirmasi);
      if (!res.sukses || !res.akun || !res.kodePemulihan) {
        setPesanError(res.pesan);
        return;
      }
      setHasilDaftar({ akun: res.akun, kodePemulihan: res.kodePemulihan });
      setSudahDisimpan(false);
      setTersalin(false);
      setMode("kode_pemulihan");
    } finally {
      setSedangProses(false);
    }
  };

  const salinKodePemulihan = async () => {
    if (!hasilDaftar) return;
    try {
      await navigator.clipboard.writeText(hasilDaftar.kodePemulihan.join("\n"));
      setTersalin(true);
    } catch {
      // clipboard tidak tersedia: kode tetap terlihat dan bisa disalin manual
    }
  };

  const lanjutSetelahKodePemulihan = () => {
    if (!hasilDaftar) return;
    simpanSesiPengguna(hasilDaftar.akun); // sesi baru dibuat setelah kode pemulihan diakui tersimpan
    setPasswordLogin("");
    masukKeAplikasi(hasilDaftar.akun, `Selamat datang, ${hasilDaftar.akun.nama}!`, 150);
  };

  const handleMulaiDaftarEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    if (sandiDaftar !== sandiDaftarUlang) {
      setPesanError("Konfirmasi kata sandi pendaftaran tidak cocok.");
      return;
    }
    setSedangProses(true);
    try {
      const res = await mulaiPendaftaranEmail({
        nama: namaDaftar,
        email: emailDaftar,
        desaWilayah: desaDaftar,
        noHp: hpDaftar,
        kelompokMasyarakat: kelompokDaftar,
        kataSandi: sandiDaftar
      });
      if (!res.sukses) {
        setPesanError(res.pesan);
        return;
      }
      setInfoOtpEmail({
        email: res.email ?? emailDaftar.trim().toLowerCase(),
        kodeVerifikasi: res.kodeVerifikasi,
        terkirimServer: res.terkirimServer,
        mxHost: res.mxHost
      });
      setKodeOtpEmail("");
      setMode("verifikasi_email");
      setPesanSukses(res.pesan);
    } finally {
      setSedangProses(false);
    }
  };

  const handleVerifikasiEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    const targetEmail = infoOtpEmail?.email || emailDaftar;
    if (!kodeOtpEmail.trim()) {
      setPesanError("Masukkan kode verifikasi email 6 digit.");
      return;
    }
    setSedangProses(true);
    try {
      const res = await verifikasiKodeEmailPendaftaran(targetEmail, kodeOtpEmail);
      if (!res.sukses) {
        setPesanError(res.pesan);
        return;
      }
      setEmailLogin(targetEmail);
      setPasswordLogin("");
      setKodeOtpEmail("");
      setInfoOtpEmail(null);
      setMode("login");
      setPesanSukses(res.pesan);
    } finally {
      setSedangProses(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      style={{
        backgroundImage: urlGambar
          ? `linear-gradient(135deg, rgba(2, 44, 34, 0.90), rgba(4, 47, 46, 0.95)), url(${urlGambar})`
          : "linear-gradient(135deg, #022c22 0%, #064e3b 50%, #042f2e 100%)"
      }}
    >
      <div className="auth-card">
        {/* PANEL KIRI KHUSUS DESKTOP DENGAN WALLPAPER HARIAN */}
        <div
          className="auth-hero"
          style={{
            backgroundImage: urlGambar ? `url(${urlGambar})` : undefined
          }}
        >
          <div className="auth-hero-overlay" />
          <div className="auth-hero-content">
            <div>
              <div className="auth-hero-brand">
                <img src="./icon.svg" alt="" width={44} height={44} style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.3))" }} />
                <div>
                  <h1>Titik Tapak</h1>
                  <p>Pemetaan Partisipatif</p>
                </div>
              </div>
              <div
                className="taka-auth-mascot-card"
                onClick={() => onBukaSplashTaka?.()}
                style={{ cursor: onBukaSplashTaka ? "pointer" : "default" }}
                title="Maskot Resmi Taka — Ketuk untuk memutar layar pembuka"
              >
                <img src="./taka/taka_master.png" alt="Maskot Taka" className="taka-auth-mascot-img" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#8fce43", letterSpacing: "0.02em" }}>
                    Bersama TAKA • Penjelajah Lapangan
                  </div>
                  <div style={{ fontSize: "0.73rem", color: "#e7f4de", lineHeight: 1.35, marginTop: 2 }}>
                    “Setiap titik punya cerita, setiap tapak punya makna.”
                  </div>
                </div>
              </div>
              <div className="auth-feature-list">
                <div className="auth-feature-item">
                  <div className="auth-feature-title">🌿 Survei Keanekaragaman Hayati</div>
                  <div className="auth-feature-desc">
                    Pencatatan flora, fauna, mata air, dan batas wilayah adat langsung dari kader lapangan.
                  </div>
                </div>
                <div className="auth-feature-item">
                  <div className="auth-feature-title">📡 Tetap jalan tanpa sinyal</div>
                  <div className="auth-feature-desc">
                    Bekerja tanpa sinyal seluler di hutan pedalaman dengan sinkronisasi otomatis Google Drive.
                  </div>
                </div>
                <div className="auth-feature-item">
                  <div className="auth-feature-title">🔒 Keamanan Terverifikasi</div>
                  <div className="auth-feature-desc">
                    Verifikasi dua langkah dengan Google Authenticator, ditambah PIN untuk melindungi data desa.
                  </div>
                </div>
              </div>
            </div>
            <div className="auth-hero-footer">
              <span>Titik Tapak v1.0</span>
              <span>Jejak Baik Untuk Bumi</span>
            </div>
          </div>
        </div>

        {/* PANEL KANAN: FORM LOGIN & IDENTIFIKASI */}
        <div className="auth-form-panel">
          {/* HEADER MOBILE (Hanya tampil di layar kecil < 768px) */}
          <div
            className="auth-mobile-header"
            style={{
              backgroundImage: urlGambar
                ? `linear-gradient(to bottom, rgba(2, 44, 34, 0.5) 0%, rgba(4, 47, 46, 0.92) 100%), url(${urlGambar})`
                : "linear-gradient(135deg, #064e3b, #0d7344)",
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          >
            <div
              style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: onBukaSplashTaka ? "pointer" : "default" }}
              onClick={() => onBukaSplashTaka?.()}
              title="Maskot Taka — Ketuk untuk memutar layar pembuka"
            >
              <img src="./icon.svg" alt="" width={48} height={48} />
              <img
                src="./taka/taka_avatar_256.png"
                alt="Maskot Taka"
                width={48}
                height={48}
                style={{ borderRadius: "50%", objectFit: "contain" }}
              />
            </div>
            <h2>Titik Tapak</h2>
            <p>Pemetaan Partisipatif Masyarakat</p>
          </div>

          {/* DESKTOP FORM HEADER */}
          <div className="auth-desktop-header">
            <h2>
              {mode === "setup_admin"
                ? "Inisialisasi Sistem"
                : mode === "daftar_akun"
                  ? "Daftar Akun Baru"
                  : mode === "verifikasi_email"
                    ? "Autentikasi Email Pendaftaran"
                    : "Masuk ke Titik Tapak"}
            </h2>
            <p>
              {mode === "setup_admin"
                ? "Daftarkan akun administrator utama pertama untuk perangkat ini."
                : mode === "daftar_akun"
                  ? "Daftarkan email asli Anda untuk verifikasi dan persetujuan Administrator."
                  : mode === "verifikasi_email"
                    ? "Masukkan kode OTP 6 digit untuk membuktikan keaslian email Anda."
                    : "Silakan masukkan email dan kata sandi akun Anda."}
            </p>
          </div>

          <div className="auth-body">
          {pesanError && (
            <div
              role="alert"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{pesanError}</span>
            </div>
          )}
          {pesanSukses && (
            <div
              role="status"
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{pesanSukses}</span>
            </div>
          )}

          {/* 0. PENYIAPAN ADMINISTRATOR PERTAMA (PERANGKAT BARU) */}
          {mode === "setup_admin" && (
            <form id="form-setup-admin" onSubmit={handleSetupAdmin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ textAlign: "center", marginBottom: 2 }}>
                <UserPlus size={26} color="#0d7344" />
                <h4 style={{ margin: "4px 0 2px", fontSize: "0.98rem" }}>Siapkan Administrator Pertama</h4>
                <p style={{ margin: 0, fontSize: "0.76rem", color: "#64748b", lineHeight: 1.4 }}>
                  Perangkat ini belum memiliki akun. Buat akun Administrator pertama lalu daftarkan Google Authenticator.
                </p>
              </div>
              <input
                type="text"
                required
                placeholder="Nama lengkap"
                value={namaSetup}
                onChange={(e) => setNamaSetup(e.target.value)}
                style={gayaInput}
              />
              <input
                type="email"
                required
                placeholder="Alamat email"
                value={emailSetup}
                onChange={(e) => setEmailSetup(e.target.value)}
                style={gayaInput}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Nama desa/wilayah"
                  value={desaSetup}
                  onChange={(e) => setDesaSetup(e.target.value)}
                  style={gayaInput}
                />
                <input
                  type="text"
                  placeholder="Nomor telepon"
                  value={hpSetup}
                  onChange={(e) => setHpSetup(e.target.value)}
                  style={gayaInput}
                />
              </div>
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder={`Kata sandi (min. ${MIN_PANJANG_SANDI} karakter)`}
                value={sandiSetup}
                onChange={(e) => setSandiSetup(e.target.value)}
                style={gayaInput}
              />
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="Ulangi kata sandi"
                value={sandiSetupUlang}
                onChange={(e) => setSandiSetupUlang(e.target.value)}
                style={gayaInput}
              />
              {perluKodeAktivasi && (
                <input
                  type="text"
                  required
                  placeholder="Kode aktivasi administrator"
                  value={kodeAktivasi}
                  onChange={(e) => setKodeAktivasi(e.target.value)}
                  style={gayaInput}
                />
              )}
              <button type="submit" disabled={sedangProses} style={gayaTombol(sedangProses)}>
                {sedangProses ? "Menyiapkan…" : "Buat Administrator"}
              </button>
            </form>
          )}

          {/* 1. MASUK */}
          {mode === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={gayaLabel}>Email</label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={gayaIkonKiri} />
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="Masukkan alamat email"
                    value={emailLogin}
                    onChange={(e) => setEmailLogin(e.target.value)}
                    style={gayaInputIkon}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ ...gayaLabel, margin: 0 }}>Kata Sandi</label>
                  <button
                    type="button"
                    onClick={() => pindah("lupa_password")}
                    style={{ ...gayaTautan, color: "#0d7344", fontSize: "0.75rem", padding: 0 }}
                  >
                    Lupa Kata Sandi?
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={gayaIkonKiri} />
                  <input
                    type={lihatPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Masukkan kata sandi"
                    value={passwordLogin}
                    onChange={(e) => setPasswordLogin(e.target.value)}
                    style={{ ...gayaInputIkon, padding: "0 40px 0 36px" }}
                  />
                  <button
                    type="button"
                    aria-label={lihatPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    onClick={() => setLihatPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "#64748b",
                      cursor: "pointer"
                    }}
                  >
                    {lihatPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={sedangProses} style={{ ...gayaTombol(sedangProses), marginTop: 4 }}>
                {sedangProses ? "Memeriksa…" : "Lanjut ke Titik Tapak"}
              </button>

              <button
                type="button"
                id="tombol-menu-daftar"
                onClick={() => pindah("daftar_akun")}
                style={{ ...gayaTautan, color: "#0d7344", textAlign: "center", padding: "2px 0" }}
              >
                Belum punya akun? Daftar di sini
              </button>

              <p style={{ margin: 0, fontSize: "0.74rem", color: "#64748b", textAlign: "center", lineHeight: 1.45 }}>
                Akses aman dengan verifikasi 2 langkah (Google Authenticator) untuk admin dan kader lapangan.
              </p>
            </form>
          )}

          {/* 1B. PENDAFTARAN AKUN BARU DENGAN VERIFIKASI EMAIL */}
          {mode === "daftar_akun" && (
            <form id="form-daftar-akun" onSubmit={handleMulaiDaftarEmail} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ textAlign: "center", marginBottom: 2 }}>
                <UserPlus size={26} color="#0d7344" />
                <h4 style={{ margin: "4px 0 2px", fontSize: "0.98rem" }}>Daftar Akun Baru</h4>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4 }}>
                  Gunakan email asli yang aktif. Setelah email terverifikasi, akun akan masuk ke daftar akun dan menunggu persetujuan Administrator sebelum aktif.
                </p>
              </div>
              <input
                id="daftar-nama"
                type="text"
                required
                placeholder="Nama lengkap"
                value={namaDaftar}
                onChange={(e) => setNamaDaftar(e.target.value)}
                style={gayaInput}
              />
              <input
                id="daftar-email"
                type="email"
                required
                placeholder="Alamat email asli (mis. nama@gmail.com)"
                value={emailDaftar}
                onChange={(e) => setEmailDaftar(e.target.value)}
                style={gayaInput}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  id="daftar-desa"
                  type="text"
                  placeholder="Nama desa/wilayah"
                  value={desaDaftar}
                  onChange={(e) => setDesaDaftar(e.target.value)}
                  style={gayaInput}
                />
                <input
                  id="daftar-hp"
                  type="text"
                  placeholder="Nomor telepon / WA"
                  value={hpDaftar}
                  onChange={(e) => setHpDaftar(e.target.value)}
                  style={gayaInput}
                />
              </div>
              <input
                id="daftar-kelompok"
                type="text"
                placeholder="Kelompok masyarakat / instansi"
                value={kelompokDaftar}
                onChange={(e) => setKelompokDaftar(e.target.value)}
                style={gayaInput}
              />
              <input
                id="daftar-sandi"
                type="password"
                required
                autoComplete="new-password"
                placeholder={`Kata sandi (min. ${MIN_PANJANG_SANDI} karakter)`}
                value={sandiDaftar}
                onChange={(e) => setSandiDaftar(e.target.value)}
                style={gayaInput}
              />
              <input
                id="daftar-sandi-ulang"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Ulangi kata sandi"
                value={sandiDaftarUlang}
                onChange={(e) => setSandiDaftarUlang(e.target.value)}
                style={gayaInput}
              />
              <button type="submit" disabled={sedangProses} style={gayaTombol(sedangProses)}>
                {sedangProses ? "Mengautentikasi Email…" : "Kirim Kode Verifikasi Email"}
              </button>
              <button type="button" onClick={kembaliKeLogin} style={gayaTautan}>
                ← Sudah punya akun? Masuk
              </button>
            </form>
          )}

          {/* 1C. VERIFIKASI KODE OTP EMAIL ASLI */}
          {mode === "verifikasi_email" && (
            <form id="form-verifikasi-email" onSubmit={handleVerifikasiEmail} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 2 }}>
                <Mail size={28} color="#0d7344" />
                <h4 style={{ margin: "6px 0 2px", fontSize: "1rem" }}>Verifikasi Email Pendaftaran</h4>
                <div style={{ fontSize: "0.78rem", color: "#0d7344", fontWeight: 700 }}>{infoOtpEmail?.email || emailDaftar}</div>
                {infoOtpEmail?.mxHost && (
                  <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 2 }}>
                    Server MX terautentikasi: {infoOtpEmail.mxHost}
                  </div>
                )}
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#334155", lineHeight: 1.5 }}>
                Masukkan <strong>kode verifikasi 6 digit</strong> untuk mengautentikasi bahwa alamat email ini asli dan aktif.
              </p>
              {infoOtpEmail?.kodeVerifikasi && !infoOtpEmail.terkirimServer && (
                <div
                  id="info-kode-otp-email"
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontSize: "0.75rem",
                    color: "#334155",
                    lineHeight: 1.45
                  }}
                >
                  <div>
                    Kode autentikasi sesi email Anda:{" "}
                    <strong
                      id="nilai-kode-otp-email"
                      style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9rem", color: "#0d7344", letterSpacing: "0.08em" }}
                    >
                      {infoOtpEmail.kodeVerifikasi}
                    </strong>
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setKodeOtpEmail(infoOtpEmail.kodeVerifikasi ?? "")}
                      style={{ ...gayaTautan, color: "#0d7344", fontSize: "0.73rem", padding: 0 }}
                    >
                      Gunakan kode ini
                    </button>
                    <a
                      href={`mailto:${encodeURIComponent(infoOtpEmail.email)}?subject=${encodeURIComponent(
                        `Kode Verifikasi Email Titik Tapak: ${infoOtpEmail.kodeVerifikasi}`
                      )}&body=${encodeURIComponent(
                        `Halo ${namaDaftar},\n\nKode verifikasi pendaftaran email Titik Tapak Anda adalah: ${infoOtpEmail.kodeVerifikasi}\n\nSetelah diverifikasi, akun Anda akan menunggu persetujuan Administrator sebelum aktif.`
                      )}`}
                      style={{ ...gayaTautan, color: "#475569", fontSize: "0.73rem", textDecoration: "underline" }}
                    >
                      Kirim salinan ke aplikasi email
                    </a>
                  </div>
                </div>
              )}
              <input
                id="input-otp-email"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                required
                placeholder="6 digit kode OTP"
                value={kodeOtpEmail}
                onChange={(e) => setKodeOtpEmail(e.target.value)}
                style={{ ...gayaInput, height: 48, textAlign: "center", fontSize: "1.2rem", letterSpacing: "0.18em", fontWeight: 700 }}
              />
              <button type="submit" disabled={sedangProses} style={gayaTombol(sedangProses)}>
                {sedangProses ? "Memverifikasi…" : "Daftarkan Akun"}
              </button>
              <p style={{ margin: 0, fontSize: "0.73rem", color: "#64748b", textAlign: "center", lineHeight: 1.45 }}>
                Catatan: Akun yang sudah diverifikasi akan tampil di daftar akun, namun <strong>belum bisa aktif</strong> sebelum disetujui Administrator.
              </p>
              <button type="button" onClick={() => pindah("daftar_akun")} style={gayaTautan}>
                ← Ubah email atau kirim ulang
              </button>
            </form>
          )}

          {/* 2. KODE AUTHENTICATOR */}
          {mode === "kode_totp" && (
            <form id="form-kode-totp" onSubmit={handleKodeTotp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 2 }}>
                <ShieldCheck size={30} color="#0d7344" />
                <h4 style={{ margin: "6px 0 2px", fontSize: "1rem" }}>Verifikasi dua langkah</h4>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{emailLogin}</div>
              </div>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#334155", lineHeight: 1.5 }}>
                Buka <strong>Google Authenticator</strong> di HP, lalu masukkan kode 6 digit untuk Titik Tapak.
              </p>
              <input
                id="kode-totp"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                maxLength={14}
                placeholder="123 456"
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                style={{ ...gayaInput, height: 48, textAlign: "center", fontSize: "1.25rem", letterSpacing: "0.18em", fontWeight: 700 }}
              />
              <button type="submit" disabled={sedangProses} style={gayaTombol(sedangProses)}>
                {sedangProses ? "Memeriksa…" : "Masuk"}
              </button>
              <p style={{ margin: 0, fontSize: "0.74rem", color: "#64748b", lineHeight: 1.45 }}>
                HP hilang atau Authenticator tidak bisa dibuka? Ketik salah satu <strong>kode pemulihan</strong> (bentuk{" "}
                <code>ABCDE-FGH23</code>) di kolom ini. Tiap kode hanya berlaku sekali.
              </p>
              <button type="button" onClick={kembaliKeLogin} style={gayaTautan}>
                ← Kembali
              </button>
            </form>
          )}

          {/* 3. PENDAFTARAN AUTHENTICATOR */}
          {mode === "daftar_totp" && totp && (
            <form id="form-daftar-totp" onSubmit={handleKonfirmasiTotp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 2 }}>
                <Smartphone size={30} color="#0d7344" />
                <h4 style={{ margin: "6px 0 2px", fontSize: "1rem" }}>Pasang Google Authenticator</h4>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{emailLogin}</div>
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem", color: "#334155", lineHeight: 1.6 }}>
                <li>
                  Pasang <strong>Google Authenticator</strong> di HP (Play Store atau App Store).
                </li>
                <li>
                  Pilih <strong>+</strong> lalu <strong>Pindai kode QR</strong> dan arahkan ke kode di bawah.
                </li>
                <li>Ketik kode 6 digit yang muncul untuk Titik Tapak, lalu tekan Aktifkan.</li>
              </ol>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div id="qr-totp">
                  <KodeQrSvg isi={totp.uri} ukuran={200} label="Kode QR untuk Google Authenticator" />
                </div>
              </div>
              <div style={{ fontSize: "0.74rem", color: "#475569", textAlign: "center" }}>
                Tidak bisa memindai? Pilih <em>Masukkan kunci setelan</em> lalu ketik kunci ini:
                <div
                  id="kunci-totp"
                  style={{
                    marginTop: 4,
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    userSelect: "all",
                    wordBreak: "break-all"
                  }}
                >
                  {rahasiaUntukTampil(totp.rahasia)}
                </div>
              </div>
              <input
                id="kode-konfirmasi-totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                required
                placeholder="Kode 6 digit"
                value={kodeKonfirmasi}
                onChange={(e) => setKodeKonfirmasi(e.target.value)}
                style={{ ...gayaInput, height: 46, textAlign: "center", fontSize: "1.2rem", letterSpacing: "0.18em", fontWeight: 700 }}
              />
              <button type="submit" disabled={sedangProses} style={gayaTombol(sedangProses)}>
                {sedangProses ? "Memeriksa…" : "Aktifkan Authenticator"}
              </button>
              <button type="button" onClick={kembaliKeLogin} style={gayaTautan}>
                ← Batal
              </button>
            </form>
          )}

          {/* 4. KODE PEMULIHAN (SEKALI TAMPIL) */}
          {mode === "kode_pemulihan" && hasilDaftar && (
            <div id="panel-kode-pemulihan" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 2 }}>
                <ShieldCheck size={30} color="#0d7344" />
                <h4 style={{ margin: "6px 0 2px", fontSize: "1rem" }}>Authenticator aktif</h4>
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#334155", lineHeight: 1.5 }}>
                Simpan <strong>kode pemulihan</strong> ini di tempat aman (mis. dicetak). Kode ini satu-satunya jalan masuk bila HP hilang,
                dan <strong>hanya ditampilkan sekarang</strong>. Tiap kode berlaku sekali.
              </p>
              <div
                id="daftar-kode-pemulihan"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 10,
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  textAlign: "center"
                }}
              >
                {hasilDaftar.kodePemulihan.map((k) => (
                  <span key={k} style={{ userSelect: "all" }}>
                    {k}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void salinKodePemulihan()}
                style={{
                  ...gayaTombol(false),
                  background: "#ffffff",
                  color: "#0d7344",
                  border: "1.5px solid #0d7344",
                  height: 38,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                <Copy size={14} /> {tersalin ? "Tersalin" : "Salin semua kode"}
              </button>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.8rem", color: "#334155" }}>
                <input
                  id="kode-sudah-disimpan"
                  type="checkbox"
                  checked={sudahDisimpan}
                  onChange={(e) => setSudahDisimpan(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                Saya sudah menyimpan kode pemulihan ini.
              </label>
              <button
                type="button"
                id="lanjut-setelah-pemulihan"
                disabled={!sudahDisimpan}
                onClick={lanjutSetelahKodePemulihan}
                style={{ ...gayaTombol(false), opacity: sudahDisimpan ? 1 : 0.5, cursor: sudahDisimpan ? "pointer" : "not-allowed" }}
              >
                Lanjut ke aplikasi
              </button>
            </div>
          )}

          {/* 6. LUPA KATA SANDI: tidak ada reset mandiri tanpa verifikasi */}
          {mode === "lupa_password" && (
            <div id="info-lupa-sandi" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 4 }}>
                <KeyRound size={28} color="#0d7344" />
                <h4 style={{ margin: "6px 0 2px", fontSize: "1rem" }}>Lupa kata sandi atau HP hilang</h4>
              </div>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "#334155", lineHeight: 1.5 }}>
                Kata sandi tidak bisa diatur ulang sendiri tanpa verifikasi. Hubungi Administrator GIS Anda: admin akan membuat kata sandi
                sementara, dan Anda wajib menggantinya saat masuk.
              </p>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "#334155", lineHeight: 1.5 }}>
                HP dengan Google Authenticator hilang? Masuk memakai salah satu <strong>kode pemulihan</strong>, atau minta admin menghapus
                Authenticator Anda lalu daftarkan yang baru saat masuk.
              </p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5 }}>
                Jika Anda satu-satunya Administrator dan kehilangan sandi atau kode pemulihan, data di perangkat ini hanya bisa dipulihkan
                dengan mengosongkan data aplikasi.
              </p>
              <button type="button" onClick={kembaliKeLogin} style={gayaTautan}>
                ← Kembali
              </button>
            </div>
          )}

          {/* 7. GANTI KATA SANDI (WAJIB UNTUK SANDI BAWAAN ATAU SEMENTARA) */}
          {mode === "ganti_sandi" && (
            <form id="form-ganti-sandi" onSubmit={handleGantiSandi} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 4 }}>
                <KeyRound size={28} color="#0d7344" />
                <h4 style={{ margin: "6px 0 2px", fontSize: "1rem" }}>Buat kata sandi baru</h4>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{emailLogin}</div>
              </div>
              <input
                id="sandi-baru"
                type="password"
                required
                autoComplete="new-password"
                placeholder={`Kata sandi baru (min. ${MIN_PANJANG_SANDI} karakter)`}
                value={sandiBaru}
                onChange={(e) => setSandiBaru(e.target.value)}
                style={gayaInput}
              />
              <input
                id="sandi-baru-ulang"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Ulangi kata sandi baru"
                value={sandiBaruUlang}
                onChange={(e) => setSandiBaruUlang(e.target.value)}
                style={gayaInput}
              />
              <button type="submit" disabled={sedangProses} style={gayaTombol(sedangProses)}>
                {sedangProses ? "Menyimpan…" : "Simpan dan Lanjut"}
              </button>
              <button type="button" onClick={kembaliKeLogin} style={gayaTautan}>
                ← Batal
              </button>
            </form>
          )}
        </div>
        {(mode === "login" || mode === "setup_admin") && (
          <div className="auth-instal">
            <TombolInstal className="auth-instal-tombol" label="Pasang Titik Tapak di HP ini" />
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
