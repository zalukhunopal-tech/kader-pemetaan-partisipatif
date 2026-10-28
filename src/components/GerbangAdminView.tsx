import React, { useState } from "react";
import { Lock, ShieldCheck, User } from "lucide-react";
import { AkunSesi, bukaGerbangAdminDenganKode } from "../lib/auth";
import { BATAS_DIAM_MS } from "../lib/gerbangAdmin";

interface GerbangAdminViewProps {
  sesi: AkunSesi;
  onTerbuka: (pesan: string) => void;
  onModeUser: () => void;
}

/** Layar kunci mode admin: kewenangan admin dibuka ulang dengan kode Google Authenticator */
export const GerbangAdminView: React.FC<GerbangAdminViewProps> = ({ sesi, onTerbuka, onModeUser }) => {
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState<string | null>(null);

  const buka = (e: React.FormEvent) => {
    e.preventDefault();
    const r = bukaGerbangAdminDenganKode(sesi, kode);
    if (!r.sukses) {
      setGalat(r.pesan);
      setKode("");
      return;
    }
    setGalat(null);
    onTerbuka(r.pesan);
  };

  return (
    <div className="page-container">
      <form id="gerbang-admin" className="section-card gerbang-admin" onSubmit={buka}>
        <div className="gerbang-admin-ikon">
          <Lock size={26} aria-hidden="true" />
        </div>
        <h3>Mode Admin terkunci</h3>
        <p className="gerbang-admin-teks">
          Akses administrator dipisah dari akun user. Untuk keamanan, mode admin terkunci setelah aplikasi dibuka ulang,
          setelah {Math.round(BATAS_DIAM_MS / 60000)} menit tanpa aktivitas, atau setelah beralih ke Mode User.
        </p>
        <p className="gerbang-admin-teks">
          Masukkan kode 6 digit dari <strong>Google Authenticator</strong> untuk {sesi.email}.
        </p>
        <input
          id="kode-gerbang-admin"
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={14}
          placeholder="123 456"
          value={kode}
          onChange={(e) => setKode(e.target.value)}
          className="form-input gerbang-admin-input"
          autoFocus
        />
        {galat && (
          <div role="alert" className="gerbang-admin-galat">
            {galat}
          </div>
        )}
        <button type="submit" className="btn-primary gerbang-admin-tombol">
          <ShieldCheck size={16} aria-hidden="true" /> Buka Mode Admin
        </button>
        <button type="button" className="btn-outline-sm gerbang-admin-tombol" onClick={onModeUser}>
          <User size={15} aria-hidden="true" /> Lanjut sebagai User
        </button>
      </form>
    </div>
  );
};
