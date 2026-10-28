import React, { useState } from "react";
import {
  AKUN_UJI_AKTIF,
  AkunSesi,
  MIN_PANJANG_SANDI,
  adaAdmin,
  autentikasiLogin,
  daftarAdminPertama,
  daftarAkunBaru,
  muatSemuaAkun,
  ubahKataSandi
} from "../lib/auth";
import {
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Shield,
  ArrowRight
} from "lucide-react";

interface AuthModalProps {
  onLoginSukses: (akun: AkunSesi) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSukses }) => {
  const [mode, setMode] = useState<"login" | "daftar" | "lupa_password" | "ganti_sandi">(() =>
    muatSemuaAkun().length === 0 ? "daftar" : "login"
  );

  // Form Login
  const [emailLogin, setEmailLogin] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [lihatPasswordLogin, setLihatPasswordLogin] = useState(false);

  // Form Daftar (tanpa data contoh)
  const [namaDaftar, setNamaDaftar] = useState("");
  const [emailDaftar, setEmailDaftar] = useState("");
  const [passwordDaftar, setPasswordDaftar] = useState("");
  const [konfirmasiPasswordDaftar, setKonfirmasiPasswordDaftar] = useState("");
  const [desaDaftar, setDesaDaftar] = useState("");
  const [noHpDaftar, setNoHpDaftar] = useState("");
  const [kelompokDaftar, setKelompokDaftar] = useState("");
  const [lihatPasswordDaftar] = useState(false);

  // Penyiapan awal: admin pertama di perangkat ini (hanya selama belum ada admin)
  const butuhAdminPertama = !adaAdmin();
  const kodeAdminDiperlukan = Boolean((import.meta.env.VITE_KODE_ADMIN ?? "").trim());
  const [jadiAdmin, setJadiAdmin] = useState(false);
  const [kodeAktivasi, setKodeAktivasi] = useState("");

  // Ganti kata sandi (wajib untuk sandi bawaan atau sementara)
  const [sandiBaruGanti, setSandiBaruGanti] = useState("");
  const [konfirmasiSandiGanti, setKonfirmasiSandiGanti] = useState("");

  // Feedback State
  const [pesanError, setPesanError] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [sedangProses, setSedangProses] = useState(false);

  const resetAlert = () => {
    setPesanError(null);
    setPesanSukses(null);
  };

  const selesaiLogin = (akun: AkunSesi, jeda = 350) => {
    setTimeout(() => onLoginSukses(akun), jeda);
  };

  const prosesLogin = async (email: string, sandi: string, pesanSelamat?: (nama: string) => string) => {
    setSedangProses(true);
    try {
      const res = await autentikasiLogin(email, sandi);
      if (res.wajibGantiSandi) {
        setMode("ganti_sandi");
        setSandiBaruGanti("");
        setKonfirmasiSandiGanti("");
        setPesanError(res.pesan);
        return;
      }
      if (!res.sukses || !res.akun) {
        setPesanError(res.pesan);
        return;
      }
      setPesanSukses(pesanSelamat ? pesanSelamat(res.akun.nama) : res.pesan);
      selesaiLogin(res.akun);
    } finally {
      setSedangProses(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    if (!emailLogin.trim() || !passwordLogin.trim()) {
      setPesanError("Harap masukkan email dan kata sandi.");
      return;
    }
    await prosesLogin(emailLogin, passwordLogin);
  };

  const handleQuickLogin = async (email: string, pass: string) => {
    setEmailLogin(email);
    setPasswordLogin(pass);
    resetAlert();
    await prosesLogin(email, pass, (nama) => `✓ Berhasil masuk sebagai ${nama}`);
  };

  const handleDaftar = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();

    if (!namaDaftar.trim() || !emailDaftar.trim() || !passwordDaftar.trim()) {
      setPesanError("Harap isi semua kolom wajib.");
      return;
    }
    if (passwordDaftar !== konfirmasiPasswordDaftar) {
      setPesanError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    const data = {
      nama: namaDaftar,
      email: emailDaftar,
      kataSandi: passwordDaftar,
      desaWilayah: desaDaftar,
      noHp: noHpDaftar,
      kelompokMasyarakat: kelompokDaftar
    };
    setSedangProses(true);
    try {
      const res =
        butuhAdminPertama && jadiAdmin
          ? await daftarAdminPertama(data, kodeAktivasi)
          : await daftarAkunBaru(data);
      if (!res.sukses || !res.akun) {
        setPesanError(res.pesan);
        return;
      }
      setPesanSukses(res.pesan);
      selesaiLogin(res.akun, 400);
    } finally {
      setSedangProses(false);
    }
  };

  const handleGantiSandi = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    if (sandiBaruGanti !== konfirmasiSandiGanti) {
      setPesanError("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }
    setSedangProses(true);
    try {
      const res = await ubahKataSandi(emailLogin, passwordLogin, sandiBaruGanti);
      if (!res.sukses) {
        setPesanError(res.pesan);
        return;
      }
      await prosesLogin(emailLogin, sandiBaruGanti, () => "Kata sandi diganti. Selamat datang!");
    } finally {
      setSedangProses(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "linear-gradient(135deg, #022c22 0%, #064e3b 50%, #042f2e 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
        overflowY: "auto"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
          margin: "auto"
        }}
      >
        {/* HEADER BRANDING */}
        <div
          style={{
            background: "linear-gradient(135deg, #064e3b, #0d7344)",
            color: "#ffffff",
            padding: "20px 16px 18px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.15)",
              border: "2px solid #34d399",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8
            }}
          >
            <Compass size={26} color="#fbbf24" />
          </div>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 800 }}>
            GeoKader
          </h2>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#a7f3d0" }}>
            Pemetaan Partisipatif Masyarakat
          </p>

          {/* TABS SELECTOR */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "rgba(0, 0, 0, 0.2)",
              borderRadius: 99,
              padding: 3,
              marginTop: 14
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode("login");
                resetAlert();
              }}
              style={{
                border: "none",
                background: mode === "login" ? "#ffffff" : "transparent",
                color: mode === "login" ? "#064e3b" : "#ffffff",
                padding: "8px 12px",
                borderRadius: 99,
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer"
              }}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("daftar");
                resetAlert();
              }}
              style={{
                border: "none",
                background: mode === "daftar" ? "#ffffff" : "transparent",
                color: mode === "daftar" ? "#064e3b" : "#ffffff",
                padding: "8px 12px",
                borderRadius: 99,
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer"
              }}
            >
              Daftar Akun
            </button>
          </div>
        </div>

        {/* BODY FORM */}
        <div style={{ padding: "18px" }}>
          {pesanError && (
            <div
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

          {/* 1. FORM LOGIN */}
          {mode === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Email
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="email"
                    required
                    placeholder="Masukkan alamat email"
                    value={emailLogin}
                    onChange={(e) => setEmailLogin(e.target.value)}
                    style={{
                      width: "100%",
                      height: 42,
                      padding: "0 12px 0 36px",
                      borderRadius: 10,
                      border: "1.5px solid #cbd5e1",
                      fontSize: "0.88rem",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155", margin: 0 }}>
                    Kata Sandi
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("lupa_password");
                      resetAlert();
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#0d7344",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    Lupa Kata Sandi?
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type={lihatPasswordLogin ? "text" : "password"}
                    required
                    placeholder="Masukkan kata sandi"
                    value={passwordLogin}
                    onChange={(e) => setPasswordLogin(e.target.value)}
                    style={{
                      width: "100%",
                      height: 42,
                      padding: "0 40px 0 36px",
                      borderRadius: 10,
                      border: "1.5px solid #cbd5e1",
                      fontSize: "0.88rem",
                      outline: "none"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setLihatPasswordLogin((v) => !v)}
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
                    {lihatPasswordLogin ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={sedangProses}
                style={{
                  height: 44,
                  borderRadius: 10,
                  background: "#0d7344",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: sedangProses ? "wait" : "pointer",
                  marginTop: 4,
                  opacity: sedangProses ? 0.7 : 1
                }}
              >
                {sedangProses ? "Memeriksa…" : "Masuk"}
              </button>

              {/* KARTU AKUN UJI: hanya ada di build pengembangan */}
              {AKUN_UJI_AKTIF && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px dashed #cbd5e1"
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <KeyRound size={14} color="#0d7344" />
                  <span>Akun uji (build pengembangan):</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  {/* AKUN DUMMY USER / KADER */}
                  <button
                    type="button"
                    onClick={() => void handleQuickLogin("kader@geokader.id", "kader123")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#f0fdf4",
                      border: "1.5px solid #86efac",
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "#dcfce7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#166534",
                          flexShrink: 0
                        }}
                      >
                        <User size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#166534" }}>
                          Akun Kader (User Lapangan)
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#15803d" }}>
                          kader@geokader.id • Sandi: <strong>kader123</strong>
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: "#166534",
                        color: "#ffffff",
                        padding: "5px 9px",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      Masuk <ArrowRight size={12} />
                    </span>
                  </button>

                  {/* AKUN DUMMY ADMIN */}
                  <button
                    type="button"
                    onClick={() => void handleQuickLogin("admin@geokader.id", "admin123")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#f0f9ff",
                      border: "1.5px solid #7dd3fc",
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "#e0f2fe",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#0369a1",
                          flexShrink: 0
                        }}
                      >
                        <Shield size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#0369a1" }}>
                          Akun Administrator GIS
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#0284c7" }}>
                          admin@geokader.id • Sandi: <strong>admin123</strong>
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: "#0284c7",
                        color: "#ffffff",
                        padding: "5px 9px",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      Masuk <ArrowRight size={12} />
                    </span>
                  </button>
                </div>
              </div>
              )}
            </form>
          )}

          {/* 2. FORM PENDAFTARAN AKUN BARU */}
          {mode === "daftar" && (
            <form onSubmit={handleDaftar} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Nama Lengkap *
                </label>
                <div style={{ position: "relative" }}>
                  <User size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="text"
                    required
                    placeholder="Nama lengkap"
                    value={namaDaftar}
                    onChange={(e) => setNamaDaftar(e.target.value)}
                    style={{ width: "100%", height: 40, padding: "0 12px 0 36px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.86rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Email *
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="email"
                    required
                    placeholder="Alamat email"
                    value={emailDaftar}
                    onChange={(e) => setEmailDaftar(e.target.value)}
                    style={{ width: "100%", height: 40, padding: "0 12px 0 36px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.86rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Desa / Wilayah
                  </label>
                  <input
                    type="text"
                    placeholder="Nama desa/wilayah"
                    value={desaDaftar}
                    onChange={(e) => setDesaDaftar(e.target.value)}
                    style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.84rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Kelompok / Organisasi
                  </label>
                  <input
                    type="text"
                    placeholder="Nama kelompok"
                    value={kelompokDaftar}
                    onChange={(e) => setKelompokDaftar(e.target.value)}
                    style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.84rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  No. HP / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Nomor telepon aktif"
                  value={noHpDaftar}
                  onChange={(e) => setNoHpDaftar(e.target.value)}
                  style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.84rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Kata Sandi *
                  </label>
                  <input
                    type={lihatPasswordDaftar ? "text" : "password"}
                    required
                    placeholder={`Min. ${MIN_PANJANG_SANDI} karakter`}
                    value={passwordDaftar}
                    onChange={(e) => setPasswordDaftar(e.target.value)}
                    style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.84rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Konfirmasi *
                  </label>
                  <input
                    type={lihatPasswordDaftar ? "text" : "password"}
                    required
                    placeholder="Ulangi sandi"
                    value={konfirmasiPasswordDaftar}
                    onChange={(e) => setKonfirmasiPasswordDaftar(e.target.value)}
                    style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.84rem" }}
                  />
                </div>
              </div>

              {butuhAdminPertama && (
                <div
                  id="blok-admin-pertama"
                  style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px", fontSize: "0.78rem", color: "#1e3a8a" }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                    <input
                      id="jadi-admin"
                      type="checkbox"
                      checked={jadiAdmin}
                      onChange={(e) => setJadiAdmin(e.target.checked)}
                    />
                    Jadikan akun ini Administrator GIS
                  </label>
                  <div style={{ marginTop: 4 }}>
                    Belum ada Administrator di perangkat ini. Centang hanya di perangkat koordinator/admin; pilihan ini
                    hilang setelah Administrator pertama dibuat. Kader biasa tidak perlu mencentangnya.
                  </div>
                  {jadiAdmin && kodeAdminDiperlukan && (
                    <input
                      id="kode-aktivasi"
                      type="password"
                      autoComplete="off"
                      placeholder="Kode aktivasi administrator"
                      value={kodeAktivasi}
                      onChange={(e) => setKodeAktivasi(e.target.value)}
                      style={{ width: "100%", height: 38, marginTop: 8, padding: "0 10px", borderRadius: 8, border: "1.5px solid #93c5fd", fontSize: "0.84rem" }}
                    />
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={sedangProses}
                style={{
                  height: 42,
                  borderRadius: 10,
                  background: "#0d7344",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: sedangProses ? "wait" : "pointer",
                  marginTop: 4,
                  opacity: sedangProses ? 0.7 : 1
                }}
              >
                {sedangProses ? "Menyimpan…" : butuhAdminPertama && jadiAdmin ? "Daftar sebagai Administrator" : "Daftar"}
              </button>
            </form>
          )}

          {/* 3. LUPA KATA SANDI: tidak ada reset mandiri tanpa verifikasi */}
          {mode === "lupa_password" && (
            <div id="info-lupa-sandi" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 4 }}>
                <KeyRound size={28} color="#0d7344" />
                <h4 style={{ margin: "6px 0 2px", fontSize: "1rem" }}>Lupa kata sandi</h4>
              </div>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "#334155", lineHeight: 1.5 }}>
                Kata sandi tidak bisa diatur ulang sendiri tanpa verifikasi. Hubungi Administrator GIS Anda: admin
                akan membuat kata sandi sementara untuk akun Anda, dan Anda wajib menggantinya saat masuk.
              </p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5 }}>
                Jika Anda satu-satunya Administrator dan lupa sandi, data di perangkat ini harus dipulihkan dengan
                mengosongkan data aplikasi.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  resetAlert();
                }}
                style={{ border: "none", background: "transparent", color: "#64748b", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
              >
                ← Kembali
              </button>
            </div>
          )}

          {/* 4. GANTI KATA SANDI (WAJIB UNTUK SANDI BAWAAN ATAU SEMENTARA) */}
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
                value={sandiBaruGanti}
                onChange={(e) => setSandiBaruGanti(e.target.value)}
                style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.88rem" }}
              />
              <input
                id="sandi-baru-ulang"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Ulangi kata sandi baru"
                value={konfirmasiSandiGanti}
                onChange={(e) => setKonfirmasiSandiGanti(e.target.value)}
                style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.88rem" }}
              />
              <button
                type="submit"
                disabled={sedangProses}
                style={{ height: 42, borderRadius: 10, background: "#0d7344", color: "#ffffff", border: "none", fontWeight: 700, fontSize: "0.9rem", cursor: sedangProses ? "wait" : "pointer", opacity: sedangProses ? 0.7 : 1 }}
              >
                {sedangProses ? "Menyimpan…" : "Simpan dan Masuk"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setPasswordLogin("");
                  resetAlert();
                }}
                style={{ border: "none", background: "transparent", color: "#64748b", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
              >
                ← Batal
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
