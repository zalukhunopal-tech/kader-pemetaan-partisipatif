import React, { useEffect, useState } from "react";
import { Fingerprint, KeyRound, Lock, ShieldCheck, X } from "lucide-react";
import { AkunSesi, sisaMasaTotp } from "../lib/auth";
import { PANJANG_PIN, aturPin, daftarkanBiometrik, gantiPin, hapusBiometrik, metodeKunciCepat } from "../lib/kunciCepat";
import { biometrikDidukung } from "../lib/webauthn";

interface PengaturanKunciModalProps {
  sesi: AkunSesi;
  onTutup: () => void;
  onPesan: (pesan: string) => void;
  onKunciSekarang: () => void;
}

const angka = (v: string) => v.replace(/\D/g, "").slice(0, PANJANG_PIN);

/** Menu Keamanan: masa berlaku Authenticator, PIN, sidik jari / wajah, dan kunci sekarang */
export const PengaturanKunciModal: React.FC<PengaturanKunciModalProps> = ({ sesi, onTutup, onPesan, onKunciSekarang }) => {
  const [versi, setVersi] = useState(0);
  const metode = metodeKunciCepat(sesi.email);
  const sisa = sisaMasaTotp(sesi.email);
  const [bioDidukung, setBioDidukung] = useState(false);
  const [pinLama, setPinLama] = useState("");
  const [pinBaru, setPinBaru] = useState("");
  const [pinUlang, setPinUlang] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    let aktif = true;
    void biometrikDidukung().then((ya) => aktif && setBioDidukung(ya));
    return () => {
      aktif = false;
    };
  }, []);

  const segarkan = (pesan: string) => {
    setVersi(versi + 1);
    setPinLama("");
    setPinBaru("");
    setPinUlang("");
    setGalat(null);
    onPesan(pesan);
  };

  const simpanPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat(null);
    if (pinBaru !== pinUlang) {
      setGalat("Ulangi PIN tidak sama.");
      return;
    }
    setSibuk(true);
    try {
      const r = metode.pin ? await gantiPin(sesi, pinLama, pinBaru) : await aturPin(sesi, pinBaru);
      if (r.sukses) segarkan(metode.pin ? "🔒 PIN diganti." : "🔒 PIN dibuat.");
      else setGalat(r.pesan);
    } finally {
      setSibuk(false);
    }
  };

  const aturBiometrik = async () => {
    setGalat(null);
    setSibuk(true);
    try {
      const r = metode.biometrik ? hapusBiometrik(sesi) : await daftarkanBiometrik(sesi);
      if (r.sukses) segarkan(`🔒 ${r.pesan}`);
      else setGalat(r.pesan);
    } finally {
      setSibuk(false);
    }
  };

  const berlakuSampai = new Date(Date.now() + sisa).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="modal-backdrop" onClick={onTutup}>
      <div
        className="modal-card"
        id="pengaturan-kunci"
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-pengaturan-kunci"
        onClick={(e) => e.stopPropagation()}
        data-versi={versi}
      >
        <div className="modal-header">
          <h3 id="judul-pengaturan-kunci">🔐 Keamanan</h3>
          <button type="button" className="btn-icon-close" onClick={onTutup} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <ul className="keamanan-status">
          <li>
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Google Authenticator: {sisa > 0 ? <>berlaku sampai pukul <strong>{berlakuSampai}</strong> (8 jam sejak kode terakhir)</> : "perlu kode baru"}
            </span>
          </li>
          <li>
            <KeyRound size={16} aria-hidden="true" />
            <span>PIN: {metode.pin ? "aktif" : "belum dibuat"}</span>
          </li>
          <li>
            <Fingerprint size={16} aria-hidden="true" />
            <span>
              Sidik jari / wajah:{" "}
              {metode.biometrik ? "aktif" : bioDidukung ? "belum aktif" : "tidak tersedia di perangkat/browser ini (perlu HTTPS dan sensor)"}
            </span>
          </li>
        </ul>

        <form className="keamanan-form" onSubmit={simpanPin}>
          <strong>{metode.pin ? "Ganti PIN" : "Buat PIN"}</strong>
          {metode.pin && (
            <input
              aria-label="PIN lama"
              placeholder="PIN lama"
              className="pin-input pin-input-kecil"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={PANJANG_PIN}
              value={pinLama}
              onChange={(e) => setPinLama(angka(e.target.value))}
            />
          )}
          <input
            aria-label="PIN baru"
            placeholder="PIN baru"
            className="pin-input pin-input-kecil"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={PANJANG_PIN}
            value={pinBaru}
            onChange={(e) => setPinBaru(angka(e.target.value))}
          />
          <input
            aria-label="Ulangi PIN baru"
            placeholder="Ulangi PIN baru"
            className="pin-input pin-input-kecil"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={PANJANG_PIN}
            value={pinUlang}
            onChange={(e) => setPinUlang(angka(e.target.value))}
          />
          <button type="submit" className="btn-primary-sm" disabled={sibuk}>
            {metode.pin ? "Simpan PIN baru" : "Buat PIN"}
          </button>
        </form>

        {(metode.biometrik || bioDidukung) && (
          <button type="button" className="btn-outline-sm keamanan-tombol" onClick={() => void aturBiometrik()} disabled={sibuk}>
            <Fingerprint size={15} aria-hidden="true" />{" "}
            {metode.biometrik ? "Matikan sidik jari / wajah" : "Aktifkan sidik jari / wajah"}
          </button>
        )}

        {galat && (
          <div role="alert" className="verifikasi-galat">
            {galat}
          </div>
        )}

        <button type="button" className="btn-outline-sm keamanan-tombol" onClick={onKunciSekarang}>
          <Lock size={15} aria-hidden="true" /> Kunci aplikasi sekarang
        </button>
        <p className="keamanan-catatan">
          Aplikasi terkunci sendiri saat dibuka ulang dan setelah 15 menit tanpa aktivitas. PIN salah 5 kali menonaktifkan
          PIN sampai kode Google Authenticator dimasukkan lagi.
        </p>
      </div>
    </div>
  );
};
