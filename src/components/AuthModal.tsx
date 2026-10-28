import React, { useState } from "react";
import {
  AkunSesi,
  MIN_PANJANG_SANDI,
  adaAdmin,
  autentikasiLogin,
  buatAdminPertama,
  mulaiPendaftaranTotp,
  muatSemuaAkun,
  selesaikanPendaftaranTotp,
  simpanSesiPengguna,
  ubahKataSandi
} from "../lib/auth";
import { rahasiaUntukTampil } from "../lib/totp";
import { KodeQrSvg } from "./KodeQrSvg";
import { TombolInstal } from "./InstalAplikasi";
import { AlertCircle, CheckCircle2, Compass, Copy, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Smartphone } from "lucide-react";

interface AuthModalProps {
  onLoginSukses: (akun: AkunSesi) => void;
}

type Mode = "login" | "kode_totp" | "daftar_totp" | "kode_pemulihan" | "ganti_sandi" | "setup_admin" | "lupa_password";

const gayaLabel: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 };
const gayaInput: React.CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: "1.5px solid #cbd5e1",
  fontSize: "0.88rem",
  outline: "none"
};
const gayaInputIkon: React.CSSProperties = { ...gayaInput, padding: "0 12px 0 36px" };
const gayaTombol = (sibuk: boolean): React.CSSProperties => ({
  height: 44,
  borderRadius: 10,
  background: "#0d7344",
  color: "#ffffff",
  border: "none",
  fontWeight: 700,
  fontSize: "0.9rem",
  cursor: sibuk ? "wait" : "pointer",
  opacity: sibuk ? 0.7 : 1
});
const gayaTautan: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#64748b",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer"
};
const gayaIkonKiri: React.CSSProperties = { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" };

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSukses }) => {
  // Tidak ada pendaftaran mandiri. Perangkat tanpa Administrator menampilkan penyiapan awal.
  const [mode, setMode] = useState<Mode>(() => (muatSemuaAkun().length === 0 ? "setup_admin" : "login"));

  const [emailLogin, setEmailLogin] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [lihatPassword, setLihatPassword] = useState(false);
  const [kode, setKode] = useState("");

  // Penyiapan Administrator pertama
  const kodeAdminDiperlukan = Boolean((import.meta.env.VITE_KODE_ADMIN ?? "").trim());
  const [adm, setAdm] = useState({ nama: "", email: "", desa: "", noHp: "", sandi: "", ulang: "", kodeAktivasi: "" });

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
    pindah("login");
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

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAlert();
    if (adm.sandi !== adm.ulang) {
      setPesanError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setSedangProses(true);
    try {
      const res = await buatAdminPertama(
        { nama: adm.nama, email: adm.email, kataSandi: adm.sandi, desaWilayah: adm.desa, noHp: adm.noHp },
        adm.kodeAktivasi
      );
      if (!res.sukses) {
        setPesanError(res.pesan);
        return;
      }
      setEmailLogin(adm.email.trim().toLowerCase());
      setPasswordLogin(adm.sandi);
      await mulaiDaftarTotp(adm.email, adm.sandi);
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

  const butuhAdminPertama = !adaAdmin();

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
          <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 800 }}>Titik Tapak</h2>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#a7f3d0" }}>Pemetaan Partisipatif Masyarakat</p>
        </div>

        <div style={{ padding: "18px" }}>
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
                {sedangProses ? "Memeriksa…" : "Lanjut"}
              </button>

              <p style={{ margin: 0, fontSize: "0.74rem", color: "#64748b", textAlign: "center", lineHeight: 1.45 }}>
                Akun dibuat oleh Administrator. Setelah sandi, Anda memasukkan kode dari Google Authenticator.
              </p>

              {butuhAdminPertama && (
                <button
                  type="button"
                  id="buka-setup-admin"
                  onClick={() => pindah("setup_admin")}
                  style={{ ...gayaTautan, color: "#0369a1" }}
                >
                  Perangkat ini belum punya Administrator: buat Administrator pertama
                </button>
              )}
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

          {/* 5. PENYIAPAN ADMINISTRATOR PERTAMA (hanya selama perangkat belum punya admin) */}
          {mode === "setup_admin" && (
            <form id="form-setup-admin" onSubmit={handleSetupAdmin} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: "0.78rem",
                  color: "#1e3a8a",
                  lineHeight: 1.5
                }}
              >
                <strong>Penyiapan awal.</strong> Perangkat ini belum punya Administrator. Buat akun Administrator pertama; akun kader
                selanjutnya dibuat oleh Administrator dari menu Admin &gt; Akun. Tidak ada pendaftaran mandiri.
              </div>
              <div>
                <label style={gayaLabel}>Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap"
                  value={adm.nama}
                  onChange={(e) => setAdm({ ...adm, nama: e.target.value })}
                  style={gayaInput}
                />
              </div>
              <div>
                <label style={gayaLabel}>Email *</label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="Alamat email"
                  value={adm.email}
                  onChange={(e) => setAdm({ ...adm, email: e.target.value })}
                  style={gayaInput}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
                <div>
                  <label style={gayaLabel}>Desa / Wilayah</label>
                  <input
                    type="text"
                    placeholder="Nama desa/wilayah"
                    value={adm.desa}
                    onChange={(e) => setAdm({ ...adm, desa: e.target.value })}
                    style={gayaInput}
                  />
                </div>
                <div>
                  <label style={gayaLabel}>No. HP</label>
                  <input
                    type="text"
                    placeholder="Nomor telepon"
                    value={adm.noHp}
                    onChange={(e) => setAdm({ ...adm, noHp: e.target.value })}
                    style={gayaInput}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
                <div>
                  <label style={gayaLabel}>Kata Sandi *</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder={`Min. ${MIN_PANJANG_SANDI} karakter`}
                    value={adm.sandi}
                    onChange={(e) => setAdm({ ...adm, sandi: e.target.value })}
                    style={gayaInput}
                  />
                </div>
                <div>
                  <label style={gayaLabel}>Konfirmasi *</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Ulangi sandi"
                    value={adm.ulang}
                    onChange={(e) => setAdm({ ...adm, ulang: e.target.value })}
                    style={gayaInput}
                  />
                </div>
              </div>
              {kodeAdminDiperlukan && (
                <input
                  id="kode-aktivasi"
                  type="password"
                  autoComplete="off"
                  placeholder="Kode aktivasi administrator"
                  value={adm.kodeAktivasi}
                  onChange={(e) => setAdm({ ...adm, kodeAktivasi: e.target.value })}
                  style={{ ...gayaInput, border: "1.5px solid #93c5fd" }}
                />
              )}
              <button type="submit" disabled={sedangProses} style={gayaTombol(sedangProses)}>
                {sedangProses ? "Menyimpan…" : "Buat Administrator"}
              </button>
              {muatSemuaAkun().length > 0 && (
                <button type="button" onClick={kembaliKeLogin} style={gayaTautan}>
                  ← Kembali ke halaman masuk
                </button>
              )}
            </form>
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
  );
};
