import React, { useState } from "react";
import { PesanKomunikasi, ProfilKader } from "../types";
import { MapPin, MessageSquare, Mic, Send, ShieldQuestion, Users, Wifi, WifiOff } from "lucide-react";

interface KomunikasiViewProps {
  pesanList: PesanKomunikasi[];
  profil: ProfilKader;
  sedangOnline: boolean;
  onKirimPesan: (
    saluran: "komunitas" | "admin",
    teks: string,
    pinKoordinat?: { lat: number; lng: number; label: string },
    durasiSuaraDetik?: number
  ) => void;
  onLihatPinDiPeta: (lat: number, lng: number, label: string) => void;
}

export const KomunikasiView: React.FC<KomunikasiViewProps> = ({
  pesanList,
  profil,
  sedangOnline,
  onKirimPesan,
  onLihatPinDiPeta
}) => {
  const [saluranAktif, setSaluranAktif] = useState<"komunitas" | "admin">("komunitas");
  const [teksPesan, setTeksPesan] = useState("");
  const [lampirkanPin, setLampirkanPin] = useState(false);
  const [labelPin, setLabelPin] = useState("Titik Temuan Lapangan");
  const [latPin, setLatPin] = useState("-0.9475");
  const [lngPin, setLngPin] = useState("100.4192");

  const daftarPesanSaluran = pesanList.filter((p) => p.saluran === saluranAktif);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teksPesan.trim()) return;
    const pin = lampirkanPin
      ? {
          lat: Number(latPin) || -0.9475,
          lng: Number(lngPin) || 100.4192,
          label: labelPin || "Pin Lokasi Kader"
        }
      : undefined;
    onKirimPesan(saluranAktif, teksPesan.trim(), pin);
    setTeksPesan("");
    setLampirkanPin(false);
  };

  return (
    <div className="page-container">
      <div className="section-card chat-layout-card">
        {/* PILIH SALURAN KOMUNIKASI */}
        <div className="chat-channel-tabs">
          <button
            type="button"
            className={`channel-tab ${saluranAktif === "komunitas" ? "active" : ""}`}
            onClick={() => setSaluranAktif("komunitas")}
          >
            <Users size={17} />
            <div>
              <strong>Ruang Diskusi Sesama Kader</strong>
              <small>Berbagi lokasi temuan & kabar lapangan antar-desa</small>
            </div>
          </button>

          <button
            type="button"
            className={`channel-tab ${saluranAktif === "admin" ? "active" : ""}`}
            onClick={() => setSaluranAktif("admin")}
          >
            <ShieldQuestion size={17} />
            <div>
              <strong>Saluran Tanya Admin (Helpdesk)</strong>
              <small>Konsultasi batas survei, verifikasi GDrive, Sertifikat & HOK</small>
            </div>
          </button>
        </div>

        <div className="chat-status-bar">
          <span>
            <MessageSquare size={14} />{" "}
            {saluranAktif === "komunitas"
              ? `Grup Komunitas Kader (${profil.desaWilayah})`
              : "Pesan Langsung ke Tim Admin & GIS Organisasi"}
          </span>
          <span className="text-xs">
            {sedangOnline ? (
              <span className="text-emerald">
                <Wifi size={13} /> Online (Terkirim Langsung)
              </span>
            ) : (
              <span className="text-amber">
                <WifiOff size={13} /> Mode Offline (Masuk Antrean Otomatis)
              </span>
            )}
          </span>
        </div>

        {/* DAFTAR PESAN */}
        <div className="chat-messages-box">
          {daftarPesanSaluran.map((m) => {
            const adalahSaya = m.idPengirim === profil.idKader;
            return (
              <div
                key={m.id}
                className={`chat-bubble-row ${adalahSaya ? "mine" : "theirs"}`}
              >
                <div className="chat-bubble">
                  <div className="chat-sender">
                    <strong>{m.namaPengirim}</strong>
                    <span className="chat-role-badge">
                      {m.peranPengirim === "admin" ? "🛠️ Admin" : `🌿 ${m.desaPengirim}`}
                    </span>
                  </div>
                  <p className="chat-text">{m.teks}</p>

                  {m.durasiSuaraDetik && (
                    <div className="voice-note-pill">
                      🎙️ Rekaman Suara Lapangan ({m.durasiSuaraDetik} dtk)
                    </div>
                  )}

                  {m.pinKoordinat && (
                    <div className="chat-pin-attachment">
                      <div>
                        <MapPin size={14} /> <b>{m.pinKoordinat.label}</b> (
                        {m.pinKoordinat.lat.toFixed(4)}°, {m.pinKoordinat.lng.toFixed(4)}°)
                      </div>
                      <button
                        type="button"
                        className="btn-outline-sm"
                        onClick={() =>
                          onLihatPinDiPeta(
                            m.pinKoordinat!.lat,
                            m.pinKoordinat!.lng,
                            m.pinKoordinat!.label
                          )
                        }
                      >
                        Buka di Peta
                      </button>
                    </div>
                  )}

                  <div className="chat-time">
                    {m.waktu} •{" "}
                    {m.statusKirim === "antrean_offline"
                      ? "⏳ Menunggu Sinyal (Offline Queue)"
                      : "✓✓ Terkirim"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* OPSI LAMPIRKAN PIN KOORDINAT */}
        {lampirkanPin && (
          <div className="pin-attach-drawer">
            <div className="form-row-3">
              <div>
                <label>Nama Titik Lokasi</label>
                <input
                  type="text"
                  className="form-input"
                  value={labelPin}
                  onChange={(e) => setLabelPin(e.target.value)}
                />
              </div>
              <div>
                <label>Latitude</label>
                <input
                  type="text"
                  className="form-input"
                  value={latPin}
                  onChange={(e) => setLatPin(e.target.value)}
                />
              </div>
              <div>
                <label>Longitude</label>
                <input
                  type="text"
                  className="form-input"
                  value={lngPin}
                  onChange={(e) => setLngPin(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* FORM INPUT PESAN */}
        <form onSubmit={handleSubmit} className="chat-input-bar">
          <button
            type="button"
            className={`btn-tool ${lampirkanPin ? "active-walk" : ""}`}
            onClick={() => setLampirkanPin((v) => !v)}
            title="Bagikan Pin Lokasi / Waypoint di Chat"
          >
            <MapPin size={16} /> Pin Peta
          </button>
          <button
            type="button"
            className="btn-tool"
            onClick={() =>
              onKirimPesan(
                saluranAktif,
                "🎙️ [Pesan Suara Lapangan: Laporan kondisi jalur survei aman]",
                undefined,
                14
              )
            }
            title="Kirim Voice Note Cepat"
          >
            <Mic size={16} /> Suara
          </button>
          <input
            type="text"
            className="form-input chat-text-input"
            placeholder={
              saluranAktif === "komunitas"
                ? "Tulis pesan diskusi ke sesama kader..."
                : "Tulis pertanyaan atau laporan ke Admin..."
            }
            value={teksPesan}
            onChange={(e) => setTeksPesan(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            <Send size={16} /> Kirim
          </button>
        </form>
      </div>
    </div>
  );
};
