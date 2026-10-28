import React, { useState } from "react";
import { X } from "lucide-react";
import { MIN_PANJANG_SANDI, ubahKataSandi } from "../lib/auth";

interface GantiSandiModalProps {
  email: string;
  onTutup: () => void;
  onSukses: () => void;
}

export const GantiSandiModal: React.FC<GantiSandiModalProps> = ({ email, onTutup, onSukses }) => {
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangProses, setSedangProses] = useState(false);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat(null);
    if (baru !== ulang) {
      setGalat("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }
    setSedangProses(true);
    try {
      const hasil = await ubahKataSandi(email, lama, baru);
      if (!hasil.sukses) {
        setGalat(hasil.pesan);
        return;
      }
      onSukses();
    } finally {
      setSedangProses(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onTutup}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔑 Ganti Kata Sandi</h3>
          <button type="button" className="btn-icon-close" onClick={onTutup} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <form className="modal-form" id="form-ganti-sandi-menu" onSubmit={simpan}>
          <div>
            <label htmlFor="sandi-lama">Kata sandi saat ini</label>
            <input id="sandi-lama" type="password" className="form-input" autoComplete="current-password" required value={lama} onChange={(e) => setLama(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sandi-baru-menu">Kata sandi baru</label>
            <input id="sandi-baru-menu" type="password" className="form-input" autoComplete="new-password" required placeholder={`Minimal ${MIN_PANJANG_SANDI} karakter`} value={baru} onChange={(e) => setBaru(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sandi-baru-ulang-menu">Ulangi kata sandi baru</label>
            <input id="sandi-baru-ulang-menu" type="password" className="form-input" autoComplete="new-password" required value={ulang} onChange={(e) => setUlang(e.target.value)} />
          </div>
          {galat && (
            <div role="alert" className="alert-banner-success" style={{ margin: 0, background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" }}>
              {galat}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={sedangProses}>
            {sedangProses ? "Menyimpan…" : "Simpan Kata Sandi"}
          </button>
        </form>
      </div>
    </div>
  );
};
