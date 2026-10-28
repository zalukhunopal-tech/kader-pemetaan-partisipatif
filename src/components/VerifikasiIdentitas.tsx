import React, { useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { AkunSesi, bukaGerbangAdminDenganKode, sisaMasaTotp, verifikasiKodeAuthenticator } from "../lib/auth";
import { PANJANG_PIN, TujuanBuka, bukaDenganBiometrik, bukaDenganPin, metodeKunciCepat } from "../lib/kunciCepat";

interface VerifikasiIdentitasProps {
  sesi: AkunSesi;
  tujuan: TujuanBuka;
  onBerhasil: (pesan: string) => void;
}

/**
 * Membuktikan identitas pemilik sesi: PIN atau sidik jari/wajah selama kode Google Authenticator
 * terakhir masih berlaku (8 jam), selain itu kode Authenticator (atau kode pemulihan).
 * Dipakai layar kunci aplikasi dan layar Mode Admin terkunci.
 */
export const VerifikasiIdentitas: React.FC<VerifikasiIdentitasProps> = ({ sesi, tujuan, onBerhasil }) => {
  const metode = metodeKunciCepat(sesi.email);
  const masaBerlaku = sisaMasaTotp(sesi.email) > 0;
  const bisaCepat = masaBerlaku && (metode.pin || metode.biometrik);
  const [mode, setMode] = useState<"cepat" | "kode">(bisaCepat ? "cepat" : "kode");
  const [pin, setPin] = useState("");
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const sudahCobaBiometrik = useRef(false);

  const hasil = (r: { sukses: boolean; pesan: string; perluAuthenticator?: boolean }) => {
    if (r.sukses) {
      setGalat(null);
      onBerhasil(r.pesan);
      return;
    }
    setGalat(r.pesan);
    if (r.perluAuthenticator) setMode("kode");
  };

  const kirimPin = async (nilai: string) => {
    setSibuk(true);
    try {
      const r = await bukaDenganPin(sesi, nilai, tujuan);
      setPin("");
      hasil(r);
    } finally {
      setSibuk(false);
    }
  };

  const pakaiBiometrik = async (diam = false) => {
    setSibuk(true);
    try {
      const r = await bukaDenganBiometrik(sesi, tujuan);
      // percobaan otomatis yang dibatalkan/ditolak browser tidak perlu menampilkan galat
      if (r.sukses || !diam || r.perluAuthenticator) hasil(r);
    } finally {
      setSibuk(false);
    }
  };

  // Sidik jari/wajah langsung ditawarkan sekali saat layar muncul (ref menjaga agar hanya sekali)
  useEffect(() => {
    if (mode !== "cepat" || !metode.biometrik || sudahCobaBiometrik.current) return;
    sudahCobaBiometrik.current = true;
    void pakaiBiometrik(true);
    // Sekali saja per tampilan layar; fungsi pakaiBiometrik dibuat ulang tiap render dan sengaja tidak jadi pemicu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, metode.biometrik]);

  const kirimKode = (e: React.FormEvent) => {
    e.preventDefault();
    const r =
      tujuan === "admin"
        ? bukaGerbangAdminDenganKode(sesi, kode)
        : verifikasiKodeAuthenticator(sesi, kode, { bukaAdmin: tujuan === "aplikasi+admin" });
    setKode("");
    hasil(r);
  };

  if (mode === "cepat") {
    return (
      <div className="verifikasi-identitas" id="verifikasi-cepat">
        {metode.pin && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pin.length === PANJANG_PIN) void kirimPin(pin);
            }}
          >
            <label htmlFor="pin-buka" className="verifikasi-label">
              Masukkan PIN {PANJANG_PIN} angka
            </label>
            <input
              id="pin-buka"
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]*"
              maxLength={PANJANG_PIN}
              autoFocus={!metode.biometrik}
              disabled={sibuk}
              value={pin}
              aria-describedby={galat ? "galat-verifikasi" : undefined}
              onChange={(e) => {
                const angka = e.target.value.replace(/\D/g, "").slice(0, PANJANG_PIN);
                setPin(angka);
                if (angka.length === PANJANG_PIN) void kirimPin(angka);
              }}
            />
          </form>
        )}
        {metode.biometrik && (
          <button type="button" className="btn-biometrik" onClick={() => void pakaiBiometrik()} disabled={sibuk}>
            <Fingerprint size={22} aria-hidden="true" /> Buka dengan sidik jari / wajah
          </button>
        )}
        {galat && (
          <div role="alert" id="galat-verifikasi" className="verifikasi-galat">
            {galat}
          </div>
        )}
        <button type="button" className="verifikasi-tautan" onClick={() => (setGalat(null), setMode("kode"))}>
          Lupa PIN? Pakai kode Google Authenticator
        </button>
      </div>
    );
  }

  return (
    <form className="verifikasi-identitas" id="verifikasi-kode" onSubmit={kirimKode}>
      <p className="verifikasi-teks">
        {masaBerlaku ? (
          <>
            Masukkan kode 6 digit dari <strong>Google Authenticator</strong>.
          </>
        ) : (
          <>
            <ShieldCheck size={15} aria-hidden="true" /> Kode <strong>Google Authenticator</strong> berlaku 8 jam dan sudah habis. Masukkan
            kode 6 digit terbaru.
          </>
        )}
      </p>
      <input
        id="kode-verifikasi"
        className="form-input kode-verifikasi-input"
        type="text"
        inputMode="text"
        autoComplete="one-time-code"
        maxLength={14}
        placeholder="123 456"
        autoFocus
        value={kode}
        onChange={(e) => setKode(e.target.value)}
      />
      {galat && (
        <div role="alert" className="verifikasi-galat">
          {galat}
        </div>
      )}
      <button type="submit" className="btn-primary verifikasi-tombol">
        <KeyRound size={16} aria-hidden="true" /> Verifikasi
      </button>
      <p className="verifikasi-catatan">
        HP dengan Authenticator hilang? Ketik salah satu <strong>kode pemulihan</strong> di kolom ini.
      </p>
      {bisaCepat && (
        <button type="button" className="verifikasi-tautan" onClick={() => (setGalat(null), setMode("cepat"))}>
          ← Pakai PIN atau sidik jari / wajah
        </button>
      )}
    </form>
  );
};
