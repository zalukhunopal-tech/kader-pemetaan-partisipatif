import React, { useState } from "react";
import {
  AkunPengguna,
  autentikasiLogin,
  daftarAkunBaru,
  muatSemuaAkun,
  resetKataSandi
} from "../lib/auth";
import { PeranPengguna } from "../types";
import {
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface AuthModalProps {
  onLoginSukses: (akun: AkunPengguna) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSukses }) => {
  const [mode, setMode] = useState<"login" | "daftar" | "lupa_password">(() =>
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
  const [peranDaftar, setPeranDaftar] = useState<PeranPengguna>("kader");
  const [desaDaftar, setDesaDaftar] = useState("");
  const [noHpDaftar, setNoHpDaftar] = useState("");
  const [kelompokDaftar, setKelompokDaftar] = useState("");
  const [lihatPasswordDaftar] = useState(false);

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
    }, 350);
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
    }, 400);
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
    }, 1200);
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
                      setEmailLupa(emailLogin);
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
                style={{
                  height: 44,
                  borderRadius: 10,
                  background: "#0d7344",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  marginTop: 4
                }}
              >
                Masuk
              </button>
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

              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Peran Akun *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPeranDaftar("kader")}
                    style={{
                      border: peranDaftar === "kader" ? "2px solid #0d7344" : "1.5px solid #cbd5e1",
                      background: peranDaftar === "kader" ? "#e8f5ee" : "#ffffff",
                      color: peranDaftar === "kader" ? "#0d7344" : "#475569",
                      padding: "8px",
                      borderRadius: 8,
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    🌿 Kader Lapangan
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
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    🛡️ Admin GIS
                  </button>
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
                    placeholder="Min. 6 karakter"
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

              <button
                type="submit"
                style={{
                  height: 42,
                  borderRadius: 10,
                  background: "#0d7344",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  marginTop: 4
                }}
              >
                Daftar & Masuk
              </button>
            </form>
          )}

          {/* 3. FORM LUPA KATA SANDI */}
          {mode === "lupa_password" && (
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center", marginBottom: 4 }}>
                <KeyRound size={28} color="#0d7344" />
                <h4 style={{ margin: "6px 0 2px", fontSize: "1rem" }}>Atur Ulang Kata Sandi</h4>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Email Terdaftar
                </label>
                <input
                  type="email"
                  required
                  placeholder="Alamat email"
                  value={emailLupa}
                  onChange={(e) => setEmailLupa(e.target.value)}
                  style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.88rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Kata Sandi Baru
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimal 6 karakter"
                  value={passwordBaru}
                  onChange={(e) => setPasswordBaru(e.target.value)}
                  style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.88rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ulangi kata sandi baru"
                  value={konfirmasiPasswordBaru}
                  onChange={(e) => setKonfirmasiPasswordBaru(e.target.value)}
                  style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.88rem" }}
                />
              </div>

              <button
                type="submit"
                style={{
                  height: 42,
                  borderRadius: 10,
                  background: "#0d7344",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer"
                }}
              >
                Simpan Kata Sandi
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
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                ← Kembali
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
