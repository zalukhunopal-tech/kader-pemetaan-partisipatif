import React, { useState } from "react";
import { AkunPengguna, autentikasiLogin, daftarAkunBaru, resetKataSandi } from "../lib/auth";
import { PeranPengguna } from "../types";
import {
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface AuthModalProps {
  onLoginSukses: (akun: AkunPengguna) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSukses }) => {
  const [mode, setMode] = useState<"login" | "daftar" | "lupa_password">("login");

  // Form Login
  const [emailLogin, setEmailLogin] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [lihatPasswordLogin, setLihatPasswordLogin] = useState(false);

  // Form Daftar
  const [namaDaftar, setNamaDaftar] = useState("");
  const [emailDaftar, setEmailDaftar] = useState("");
  const [passwordDaftar, setPasswordDaftar] = useState("");
  const [konfirmasiPasswordDaftar, setKonfirmasiPasswordDaftar] = useState("");
  const [peranDaftar, setPeranDaftar] = useState<PeranPengguna>("kader");
  const [desaDaftar, setDesaDaftar] = useState("Desa Rimba Lestari");
  const [noHpDaftar, setNoHpDaftar] = useState("");
  const [kelompokDaftar, setKelompokDaftar] = useState("KTH Mandiri");
  const [lihatPasswordDaftar, setLihatPasswordDaftar] = useState(false);

  // Form Lupa Password
  const [emailLupa, setEmailLupa] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPasswordBaru, setKonfirmasiPasswordBaru] = useState("");

  // Feedback State
  const [pesanError, setPesanError] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  const resetAlert = () => {
    setPesanError(null);
    setPesanSukses(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();

    if (!emailLogin.trim() || !passwordLogin.trim()) {
      setPesanError("Harap masukkan email dan kata sandi.");
      return;
    }

    const res = autentikasiLogin(emailLogin, passwordLogin);
    if (!res.sukses || !res.akun) {
      setPesanError(res.pesan);
      return;
    }

    setPesanSukses(res.pesan);
    setTimeout(() => {
      onLoginSukses(res.akun!);
    }, 400);
  };

  const handleDaftar = (e: React.FormEvent) => {
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

    if (passwordDaftar.length < 6) {
      setPesanError("Kata sandi minimal 6 karakter.");
      return;
    }

    const res = daftarAkunBaru({
      nama: namaDaftar,
      email: emailDaftar,
      kataSandi: passwordDaftar,
      peran: peranDaftar,
      desaWilayah: desaDaftar,
      noHp: noHpDaftar,
      kelompokMasyarakat: kelompokDaftar
    });

    if (!res.sukses || !res.akun) {
      setPesanError(res.pesan);
      return;
    }

    setPesanSukses(res.pesan);
    setTimeout(() => {
      onLoginSukses(res.akun!);
    }, 500);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();

    if (!emailLupa.trim() || !passwordBaru.trim()) {
      setPesanError("Harap masukkan email dan kata sandi baru.");
      return;
    }

    if (passwordBaru !== konfirmasiPasswordBaru) {
      setPesanError("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    if (passwordBaru.length < 6) {
      setPesanError("Kata sandi baru minimal 6 karakter.");
      return;
    }

    const res = resetKataSandi(emailLupa, passwordBaru);
    if (!res.sukses) {
      setPesanError(res.pesan);
      return;
    }

    setPesanSukses(res.pesan);
    setTimeout(() => {
      setEmailLogin(emailLupa);
      setPasswordLogin(passwordBaru);
      setMode("login");
      resetAlert();
    }, 1500);
  };

  const isiCepatDemo = (role: "admin" | "kader") => {
    resetAlert();
    if (role === "admin") {
      setEmailLogin("admin@geokader.id");
      setPasswordLogin("admin123");
    } else {
      setEmailLogin("kader@geokader.id");
      setPasswordLogin("kader123");
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
        padding: "16px",
        overflowY: "auto"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
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
            padding: "24px 20px 20px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.15)",
              border: "2px solid #34d399",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)"
            }}
          >
            <Compass size={32} color="#fbbf24" />
          </div>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.45rem", fontWeight: 800, letterSpacing: 0.5 }}>
            GeoKader
          </h2>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#a7f3d0", maxWidth: 340, marginInline: "auto" }}>
            Aplikasi Survei & Pemetaan Partisipatif Kader Masyarakat
          </p>

          {/* TABS SELECTOR */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "rgba(0, 0, 0, 0.2)",
              borderRadius: 99,
              padding: 3,
              marginTop: 18
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
                padding: "8px 14px",
                borderRadius: 99,
                fontWeight: 700,
                fontSize: "0.84rem",
                cursor: "pointer",
                transition: "all 0.2s"
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
                padding: "8px 14px",
                borderRadius: 99,
                fontWeight: 700,
                fontSize: "0.84rem",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              Daftar Akun
            </button>
          </div>
        </div>

        {/* BODY FORM */}
        <div style={{ padding: "20px 24px 24px" }}>
          {/* PESAN ALERT */}
          {pesanError && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16
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
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16
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
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                  Alamat Email
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={17} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="email"
                    required
                    placeholder="nama@geokader.id"
                    value={emailLogin}
                    onChange={(e) => setEmailLogin(e.target.value)}
                    style={{
                      width: "100%",
                      height: 44,
                      padding: "0 12px 0 38px",
                      borderRadius: 10,
                      border: "1.5px solid #cbd5e1",
                      fontSize: "0.92rem",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                    Kata Sandi
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("lupa_password");
                      setEmailLupa(emailLogin);
                      resetAlert();
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#0d7344",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    Lupa Kata Sandi?
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <Lock size={17} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type={lihatPasswordLogin ? "text" : "password"}
                    required
                    placeholder="Masukkan kata sandi..."
                    value={passwordLogin}
                    onChange={(e) => setPasswordLogin(e.target.value)}
                    style={{
                      width: "100%",
                      height: 44,
                      padding: "0 40px 0 38px",
                      borderRadius: 10,
                      border: "1.5px solid #cbd5e1",
                      fontSize: "0.92rem",
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
                    {lihatPasswordLogin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  height: 46,
                  borderRadius: 10,
                  background: "#0d7344",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  marginTop: 6,
                  boxShadow: "0 4px 12px rgba(13, 115, 68, 0.3)"
                }}
              >
                Masuk ke Aplikasi
              </button>

              {/* DEMO QUICK FILL */}
              <div style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", marginBottom: 8, textAlign: "center" }}>
                  AKSES CEPAT DEMO:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => isiCepatDemo("admin")}
                    style={{
                      background: "#f0f9ff",
                      border: "1.5px solid #bae6fd",
                      color: "#0369a1",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5
                    }}
                  >
                    <Shield size={14} /> Akun Admin
                  </button>

                  <button
                    type="button"
                    onClick={() => isiCepatDemo("kader")}
                    style={{
                      background: "#f0fdf4",
                      border: "1.5px solid #bbf7d0",
                      color: "#166534",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5
                    }}
                  >
                    <User size={14} /> Akun User / Kader
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* 2. FORM PENDAFTARAN AKUN BARU */}
          {mode === "daftar" && (
            <form onSubmit={handleDaftar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Nama Lengkap *
                </label>
                <div style={{ position: "relative" }}>
                  <User size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={namaDaftar}
                    onChange={(e) => setNamaDaftar(e.target.value)}
                    style={{ width: "100%", height: 40, padding: "0 12px 0 36px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.88rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Alamat Email *
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="email"
                    required
                    placeholder="nama@email.com"
                    value={emailDaftar}
                    onChange={(e) => setEmailDaftar(e.target.value)}
                    style={{ width: "100%", height: 40, padding: "0 12px 0 36px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.88rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Pilih Peran Akun *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPeranDaftar("kader")}
                    style={{
                      border: peranDaftar === "kader" ? "2px solid #0d7344" : "1.5px solid #cbd5e1",
                      background: peranDaftar === "kader" ? "#e8f5ee" : "#ffffff",
                      color: peranDaftar === "kader" ? "#0d7344" : "#475569",
                      padding: "8px",
                      borderRadius: 8,
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "center"
                    }}
                  >
                    🌿 User (Kader Lapangan)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPeranDaftar("admin")}
                    style={{
                      border: peranDaftar === "admin" ? "2px solid #0284c7" : "1.5px solid #cbd5e1",
                      background: peranDaftar === "admin" ? "#e0f2fe" : "#ffffff",
                      color: peranDaftar === "admin" ? "#0369a1" : "#475569",
                      padding: "8px",
                      borderRadius: 8,
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "center"
                    }}
                  >
                    🛡️ Admin GIS (Koordinator)
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Desa / Wilayah
                  </label>
                  <input
                    type="text"
                    placeholder="Desa Rimba Lestari"
                    value={desaDaftar}
                    onChange={(e) => setDesaDaftar(e.target.value)}
                    style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.85rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    No. HP / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="0812-xxxx-xxxx"
                    value={noHpDaftar}
                    onChange={(e) => setNoHpDaftar(e.target.value)}
                    style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Kata Sandi *
                  </label>
                  <input
                    type={lihatPasswordDaftar ? "text" : "password"}
                    required
                    placeholder="Min. 6 digit"
                    value={passwordDaftar}
                    onChange={(e) => setPasswordDaftar(e.target.value)}
                    style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.85rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Konfirmasi *
                  </label>
                  <input
                    type={lihatPasswordDaftar ? "text" : "password"}
                    required
                    placeholder="Ulangi kata sandi"
                    value={konfirmasiPasswordDaftar}
                    onChange={(e) => setKonfirmasiPasswordDaftar(e.target.value)}
                    style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  height: 44,
                  borderRadius: 10,
                  background: "#0d7344",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.92rem",
                  cursor: "pointer",
                  marginTop: 6
                }}
              >
                Daftar & Masuk Sekarang
              </button>

              <div style={{ textAlign: "center", fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>
                Sudah punya akun?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    resetAlert();
                  }}
                  style={{ border: "none", background: "transparent", color: "#0d7344", fontWeight: 700, cursor: "pointer" }}
                >
                  Masuk di sini
                </button>
              </div>
            </form>
          )}

          {/* 3. FORM LUPA KATA SANDI */}
          {mode === "lupa_password" && (
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ textAlign: "center", marginBottom: 4 }}>
                <KeyRound size={32} color="#0d7344" />
                <h4 style={{ margin: "6px 0 2px", fontSize: "1.05rem" }}>Atur Ulang Kata Sandi</h4>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                  Masukkan email terdaftar dan buat kata sandi baru untuk akun Anda.
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Alamat Email Terdaftar
                </label>
                <input
                  type="email"
                  required
                  placeholder="nama@email.com"
                  value={emailLupa}
                  onChange={(e) => setEmailLupa(e.target.value)}
                  style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.9rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Kata Sandi Baru (Minimal 6 Karakter)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ketik kata sandi baru..."
                  value={passwordBaru}
                  onChange={(e) => setPasswordBaru(e.target.value)}
                  style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.9rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ulangi kata sandi baru..."
                  value={konfirmasiPasswordBaru}
                  onChange={(e) => setKonfirmasiPasswordBaru(e.target.value)}
                  style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.9rem" }}
                />
              </div>

              <button
                type="submit"
                style={{
                  height: 44,
                  borderRadius: 10,
                  background: "#0d7344",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.92rem",
                  cursor: "pointer",
                  marginTop: 6
                }}
              >
                Simpan Kata Sandi Baru
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  resetAlert();
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                ← Kembali ke Halaman Masuk
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
