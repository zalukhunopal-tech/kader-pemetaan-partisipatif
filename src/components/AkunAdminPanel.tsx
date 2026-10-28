import React, { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { AkunSesi, aturUlangSandiOlehAdmin, muatSemuaAkun } from "../lib/auth";

interface AkunAdminPanelProps {
  sesiAdmin: AkunSesi | null;
}

/** Daftar akun di perangkat ini dan pengaturan ulang kata sandi oleh admin (pengganti "lupa sandi") */
export const AkunAdminPanel: React.FC<AkunAdminPanelProps> = ({ sesiAdmin }) => {
  const [versi, setVersi] = useState(0);
  const [hasil, setHasil] = useState<{ email: string; nama: string; sandi: string } | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);
  const akun = muatSemuaAkun(); // dibaca ulang setiap render agar status terbaru tampil
  void versi;

  const aturUlang = async (email: string, nama: string) => {
    setGalat(null);
    setHasil(null);
    setTersalin(false);
    const r = await aturUlangSandiOlehAdmin(sesiAdmin, email);
    if (!r.sukses || !r.sandiSementara) {
      setGalat(r.pesan);
      return;
    }
    setHasil({ email, nama, sandi: r.sandiSementara });
    setVersi((v) => v + 1);
  };

  const salin = async () => {
    if (!hasil) return;
    try {
      await navigator.clipboard.writeText(hasil.sandi);
      setTersalin(true);
    } catch {
      // clipboard tidak tersedia: sandi tetap terlihat dan bisa disalin manual
    }
  };

  return (
    <div className="section-card" id="panel-akun-admin">
      <h3 style={{ margin: "0 0 4px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
        <KeyRound size={18} color="#0d7344" /> Akun di perangkat ini ({akun.length})
      </h3>
      <p className="text-muted" style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>
        Kata sandi tidak bisa diatur ulang sendiri tanpa verifikasi. Admin membuat sandi sementara; pemilik akun
        wajib menggantinya saat masuk.
      </p>

      {hasil && (
        <div
          role="status"
          className="alert-banner-success"
          style={{ margin: "0 0 10px" }}
        >
          Sandi sementara untuk <strong>{hasil.nama}</strong> ({hasil.email}):{" "}
          <code id="sandi-sementara" style={{ fontSize: "1rem", fontWeight: 700, userSelect: "all" }}>{hasil.sandi}</code>
          <button type="button" className="btn-outline-sm" style={{ marginLeft: 8 }} onClick={() => void salin()}>
            <Copy size={13} /> {tersalin ? "Tersalin" : "Salin"}
          </button>
          <div style={{ marginTop: 4, fontSize: "0.78rem" }}>
            Sandi ini hanya ditampilkan sekali. Sampaikan langsung kepada pemilik akun.
          </div>
        </div>
      )}
      {galat && (
        <div role="alert" className="alert-banner-success" style={{ margin: "0 0 10px", background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" }}>
          {galat}
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Akun</th>
              <th>Peran</th>
              <th>Status</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {akun.map((a) => (
              <tr key={a.email}>
                <td>
                  <strong>{a.nama}</strong>
                  <div className="text-xs text-muted">{a.email}</div>
                </td>
                <td>{a.peran === "admin" ? "Admin" : "Kader"}</td>
                <td className="text-xs">{a.wajibGantiSandi ? "Wajib ganti sandi" : "Aktif"}</td>
                <td>
                  <button
                    type="button"
                    className="btn-outline-sm"
                    disabled={a.email.toLowerCase() === sesiAdmin?.email.toLowerCase()}
                    title={
                      a.email.toLowerCase() === sesiAdmin?.email.toLowerCase()
                        ? "Ganti sandi Anda sendiri lewat menu Kata sandi"
                        : "Buat sandi sementara"
                    }
                    onClick={() => void aturUlang(a.email, a.nama)}
                  >
                    Atur ulang sandi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
