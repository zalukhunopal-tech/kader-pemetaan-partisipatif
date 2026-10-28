import React from "react";
import { Lock, User } from "lucide-react";
import { AkunSesi } from "../lib/auth";
import { BATAS_DIAM_MS } from "../lib/gerbangAdmin";
import { VerifikasiIdentitas } from "./VerifikasiIdentitas";

interface GerbangAdminViewProps {
  sesi: AkunSesi;
  onTerbuka: (pesan: string) => void;
  onModeUser: () => void;
}

/**
 * Layar kunci mode admin: kewenangan admin dibuka ulang dengan PIN atau sidik jari/wajah selama kode
 * Google Authenticator terakhir masih berlaku (8 jam), selain itu dengan kode Authenticator.
 */
export const GerbangAdminView: React.FC<GerbangAdminViewProps> = ({ sesi, onTerbuka, onModeUser }) => (
  <div className="page-container">
    <div id="gerbang-admin" className="section-card gerbang-admin">
      <div className="gerbang-admin-ikon">
        <Lock size={26} aria-hidden="true" />
      </div>
      <h3>Mode Admin terkunci</h3>
      <p className="gerbang-admin-teks">
        Akses administrator dipisah dari akun user. Mode admin terkunci setelah aplikasi dibuka ulang, setelah{" "}
        {Math.round(BATAS_DIAM_MS / 60000)} menit tanpa aktivitas, atau setelah beralih ke Mode User. Buka lagi untuk{" "}
        {sesi.email}:
      </p>
      <VerifikasiIdentitas sesi={sesi} tujuan="admin" onBerhasil={onTerbuka} />
      <button type="button" className="btn-outline-sm gerbang-admin-tombol" onClick={onModeUser}>
        <User size={15} aria-hidden="true" /> Lanjut sebagai User
      </button>
    </div>
  </div>
);
