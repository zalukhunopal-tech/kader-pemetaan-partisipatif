import React, { useEffect, useState } from "react";
import { Fingerprint, LogOut, Radio } from "lucide-react";
import { AkunSesi } from "../lib/auth";
import { PANJANG_PIN, TujuanBuka, aturPin, daftarkanBiometrik } from "../lib/kunciCepat";
import { biometrikDidukung } from "../lib/webauthn";
import { VerifikasiIdentitas } from "./VerifikasiIdentitas";

/** Membuat PIN (dan bila didukung, sidik jari / pengenalan wajah) untuk membuka aplikasi */
export const SiapkanKunciCepat: React.FC<{ sesi: AkunSesi; onSelesai: (pesan: string) => void }> = ({ sesi, onSelesai }) => {
  const [pin, setPin] = useState("");
  const [ulang, setUlang] = useState("");
  const [bioDidukung, setBioDidukung] = useState(false);
  const [pakaiBio, setPakaiBio] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    let aktif = true;
    void biometrikDidukung().then((ya) => aktif && setBioDidukung(ya));
    return () => {
      aktif = false;
    };
  }, []);

  const angka = (v: string) => v.replace(/\D/g, "").slice(0, PANJANG_PIN);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat(null);
    if (pin !== ulang) {
      setGalat("Ulangi PIN tidak sama.");
      return;
    }
    setSibuk(true);
    try {
      const r = await aturPin(sesi, pin);
      if (!r.sukses) {
        setGalat(r.pesan);
        return;
      }
      if (bioDidukung && pakaiBio) {
        const b = await daftarkanBiometrik(sesi);
        onSelesai(b.sukses ? "🔒 PIN dan sidik jari / wajah aktif." : `🔒 PIN aktif. ${b.pesan}`);
        return;
      }
      onSelesai("🔒 PIN aktif.");
    } finally {
      setSibuk(false);
    }
  };

  const hanyaBiometrik = async () => {
    setGalat(null);
    setSibuk(true);
    try {
      const b = await daftarkanBiometrik(sesi);
      if (b.sukses) onSelesai("🔒 Sidik jari / wajah aktif. PIN bisa dibuat nanti di menu Keamanan.");
      else setGalat(b.pesan);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <form id="form-siapkan-pin" className="verifikasi-identitas" onSubmit={simpan}>
      <p className="verifikasi-teks">
        Buat <strong>PIN {PANJANG_PIN} angka</strong> untuk membuka Titik Tapak. Kode Google Authenticator cukup dimasukkan sekali setiap{" "}
        <strong>8 jam</strong>; di antaranya aplikasi dibuka dengan PIN
        {bioDidukung ? " atau sidik jari / pengenalan wajah" : ""}.
      </p>
      <label className="verifikasi-label" htmlFor="pin-baru">
        PIN baru
      </label>
      <input
        id="pin-baru"
        className="pin-input"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        pattern="[0-9]*"
        maxLength={PANJANG_PIN}
        autoFocus
        value={pin}
        onChange={(e) => setPin(angka(e.target.value))}
      />
      <label className="verifikasi-label" htmlFor="pin-ulang">
        Ulangi PIN
      </label>
      <input
        id="pin-ulang"
        className="pin-input"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        pattern="[0-9]*"
        maxLength={PANJANG_PIN}
        value={ulang}
        onChange={(e) => setUlang(angka(e.target.value))}
      />
      {bioDidukung && (
        <label className="verifikasi-centang">
          <input type="checkbox" checked={pakaiBio} onChange={(e) => setPakaiBio(e.target.checked)} />
          <span>Aktifkan juga sidik jari / pengenalan wajah perangkat ini</span>
        </label>
      )}
      {galat && (
        <div role="alert" className="verifikasi-galat">
          {galat}
        </div>
      )}
      <button
        type="submit"
        className="btn-primary verifikasi-tombol"
        disabled={sibuk || pin.length !== PANJANG_PIN || ulang.length !== PANJANG_PIN}
      >
        {sibuk ? "Menyimpan…" : "Simpan PIN"}
      </button>
      {bioDidukung && (
        <button type="button" className="verifikasi-tautan" onClick={() => void hanyaBiometrik()} disabled={sibuk}>
          <Fingerprint size={14} aria-hidden="true" /> Pakai sidik jari / wajah saja
        </button>
      )}
    </form>
  );
};

interface KunciAplikasiViewProps {
  sesi: AkunSesi;
  /** buka = aplikasi terkunci; siapkan = belum ada PIN/sidik jari */
  mode: "buka" | "siapkan";
  tujuan: TujuanBuka;
  sedangMerekam: boolean;
  onTerbuka: (pesan: string) => void;
  onKeluar: () => void;
}

/**
 * Layar kunci penuh di atas aplikasi. Isi aplikasi di belakangnya tidak dibongkar (formulir yang
 * belum disimpan tetap ada) tetapi tidak bisa disentuh dan disembunyikan dari pembaca layar.
 */
export const KunciAplikasiView: React.FC<KunciAplikasiViewProps> = ({ sesi, mode, tujuan, sedangMerekam, onTerbuka, onKeluar }) => (
  <div className="layar-kunci" role="dialog" aria-modal="true" aria-labelledby="judul-layar-kunci">
    <div className="layar-kunci-kartu">
      <div className="layar-kunci-kepala">
        <div className="layar-kunci-logo">
          <img src="./icon.svg" alt="" width={52} height={52} />
        </div>
        <h2 id="judul-layar-kunci">{mode === "siapkan" ? "Amankan Titik Tapak" : "Titik Tapak terkunci"}</h2>
        <p>
          {sesi.nama} · {sesi.email}
        </p>
      </div>
      <div className="layar-kunci-isi">
        {mode === "siapkan" ? (
          <SiapkanKunciCepat sesi={sesi} onSelesai={onTerbuka} />
        ) : (
          <VerifikasiIdentitas sesi={sesi} tujuan={tujuan} onBerhasil={onTerbuka} />
        )}
        {sedangMerekam && (
          <p className="layar-kunci-rekam">
            <Radio size={14} aria-hidden="true" /> Perekaman jalur tetap berjalan di latar belakang.
          </p>
        )}
      </div>
      <button type="button" className="layar-kunci-keluar" onClick={onKeluar}>
        <LogOut size={15} aria-hidden="true" /> Keluar dan masuk dengan akun lain
      </button>
    </div>
  </div>
);
