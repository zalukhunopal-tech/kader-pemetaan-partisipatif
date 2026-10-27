import React, { useState, useRef, useEffect } from "react";
import { PesanKomunikasi, ProfilKader } from "../types";
import {
  MapPin,
  Mic,
  Send,
  Users,
  ShieldAlert,
  Paperclip,
  Smile,
  CheckCheck,
  Clock,
  Search,
  Phone,
  MoreVertical,
  Volume2,
  Play,
  Pause,
  AlertTriangle,
  Compass
} from "lucide-react";

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
  const [menuLampiranTerbuka, setMenuLampiranTerbuka] = useState(false);
  const [bukaInputPin, setBukaInputPin] = useState(false);
  const [labelPin, setLabelPin] = useState("Temuan Lapangan");
  const [latPin, setLatPin] = useState("-0.9472");
  const [lngPin, setLngPin] = useState("100.4180");
  const [cariKata, setCariKata] = useState("");
  const [tampilCari, setTampilCari] = useState(false);
  const [audioMemutar, setAudioMemutar] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const daftarPesanSaluran = pesanList.filter((p) => {
    if (p.saluran !== saluranAktif) return false;
    if (cariKata.trim() && !p.teks.toLowerCase().includes(cariKata.toLowerCase())) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [daftarPesanSaluran.length, saluranAktif]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teksPesan.trim()) return;

    onKirimPesan(saluranAktif, teksPesan.trim());
    setTeksPesan("");
    setMenuLampiranTerbuka(false);
  };

  const kirimLokasiCepat = () => {
    const pin = {
      lat: Number(latPin) || -0.9472,
      lng: Number(lngPin) || 100.4180,
      label: labelPin.trim() || "Posisi GPS Lapangan"
    };
    onKirimPesan(
      saluranAktif,
      `📍 Berbagi Titik Koordinat: ${labelPin}`,
      pin
    );
    setBukaInputPin(false);
    setMenuLampiranTerbuka(false);
  };

  const kirimVoiceNote = () => {
    onKirimPesan(
      saluranAktif,
      "🎙️ Pesan Suara: Laporan kondisi jalur survei aman dan cuaca cerah.",
      undefined,
      12
    );
    setMenuLampiranTerbuka(false);
  };

  const kirimPeringatanCepat = (peringatan: string) => {
    onKirimPesan(saluranAktif, `⚠️ PERINGATAN LAPANGAN: ${peringatan}`);
    setMenuLampiranTerbuka(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 128px)",
        maxHeight: "840px",
        background: "#efeae2",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid #d1d7db",
        margin: "10px 12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
      }}
    >
      {/* 1. WHATSAPP/TELEGRAM TOPBAR HEADER */}
      <div
        style={{
          background: "#075e54",
          color: "#ffffff",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          zIndex: 10
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Avatar Chat */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: saluranAktif === "komunitas" ? "#128c7e" : "#0f766e",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid rgba(255,255,255,0.4)",
              fontWeight: 700,
              flexShrink: 0
            }}
          >
            {saluranAktif === "komunitas" ? <Users size={22} /> : <ShieldAlert size={22} />}
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1.2 }}>
              {saluranAktif === "komunitas"
                ? "Grup Koordinasi Kader Lapangan"
                : "Helpdesk Admin & Verifikasi GIS"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#a7f3d0", display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: sedangOnline ? "#22c55e" : "#eab308",
                  display: "inline-block"
                }}
              />
              {sedangOnline
                ? saluranAktif === "komunitas" ? "3 Kader online di wilayah" : "Admin standby (Respons Cepat)"
                : "Mode Offline (Antrean Otomatis)"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setTampilCari((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
            title="Cari Pesan"
          >
            <Search size={18} />
          </button>

          {/* Tab Selector Pill WA */}
          <div
            style={{
              display: "flex",
              background: "rgba(0,0,0,0.2)",
              borderRadius: 99,
              padding: 2
            }}
          >
            <button
              type="button"
              onClick={() => setSaluranAktif("komunitas")}
              style={{
                background: saluranAktif === "komunitas" ? "#ffffff" : "transparent",
                color: saluranAktif === "komunitas" ? "#075e54" : "#ffffff",
                border: "none",
                borderRadius: 99,
                padding: "4px 10px",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Kader
            </button>
            <button
              type="button"
              onClick={() => setSaluranAktif("admin")}
              style={{
                background: saluranAktif === "admin" ? "#ffffff" : "transparent",
                color: saluranAktif === "admin" ? "#075e54" : "#ffffff",
                border: "none",
                borderRadius: 99,
                padding: "4px 10px",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Admin
            </button>
          </div>
        </div>
      </div>

      {/* SEARCH BAR (JIKA DIAKTIFKAN) */}
      {tampilCari && (
        <div style={{ background: "#f0f2f5", padding: "6px 12px", borderBottom: "1px solid #d1d7db" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Cari pesan atau koordinat..."
            value={cariKata}
            onChange={(e) => setCariKata(e.target.value)}
            style={{ height: 34, fontSize: "0.85rem", borderRadius: 99 }}
            autoFocus
          />
        </div>
      )}

      {/* OFFLINE INDICATOR BAR */}
      {!sedangOnline && (
        <div
          style={{
            background: "#fef3c7",
            color: "#92400e",
            fontSize: "0.78rem",
            padding: "5px 14px",
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }}
        >
          <Clock size={13} /> Sinyal terputus. Pesan disimpan di memori HP dan otomatis terkirim saat online.
        </div>
      )}

      {/* 2. CHAT BUBBLE AREA (WHATSAPP PATTERN STYLE) */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          backgroundImage: "radial-gradient(#d1d7db 0.75px, transparent 0.75px)",
          backgroundSize: "16px 16px"
        }}
      >
        {/* Date Stamp */}
        <div style={{ textAlign: "center", margin: "4px 0" }}>
          <span
            style={{
              background: "#ffffff",
              padding: "4px 12px",
              borderRadius: 8,
              fontSize: "0.72rem",
              color: "#54656f",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              fontWeight: 600
            }}
          >
            HARI INI
          </span>
        </div>

        {daftarPesanSaluran.length === 0 ? (
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              background: "rgba(255,255,255,0.85)",
              padding: "18px 24px",
              borderRadius: "14px",
              maxWidth: 320,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
            }}
          >
            <div style={{ fontSize: "1.8rem", marginBottom: 6 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", marginBottom: 4 }}>
              Mulai Diskusi Lapangan
            </div>
            <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
              {saluranAktif === "komunitas"
                ? "Bagikan kabar temuan pohon, sarang satwa, mata air, atau titik koordinat GPS ke sesama kader."
                : "Konsultasikan batas survei, validasi data spasial, sertifikat, atau pencairan HOK ke admin GIS."}
            </div>
          </div>
        ) : (
          daftarPesanSaluran.map((m) => {
            const adalahSaya = m.idPengirim === profil.idKader;

            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: adalahSaya ? "flex-end" : "flex-start",
                  width: "100%"
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    minWidth: "120px",
                    background: adalahSaya ? "#d9fdd3" : "#ffffff",
                    borderRadius: adalahSaya ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                    padding: "8px 12px 6px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    position: "relative"
                  }}
                >
                  {/* Sender Name if not mine */}
                  {!adalahSaya && (
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        color: m.peranPengirim === "admin" ? "#0284c7" : "#0f766e",
                        marginBottom: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <span>{m.namaPengirim}</span>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 99,
                          background: m.peranPengirim === "admin" ? "#e0f2fe" : "#dcfce7",
                          color: m.peranPengirim === "admin" ? "#0369a1" : "#166534"
                        }}
                      >
                        {m.peranPengirim === "admin" ? "Admin" : m.desaPengirim}
                      </span>
                    </div>
                  )}

                  {/* Message Text */}
                  <div style={{ fontSize: "0.92rem", color: "#111b21", lineHeight: 1.4, wordBreak: "break-word" }}>
                    {m.teks}
                  </div>

                  {/* Audio Voice Note Bubble */}
                  {m.durasiSuaraDetik && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: adalahSaya ? "rgba(255,255,255,0.7)" : "#f0f2f5",
                        borderRadius: 99,
                        padding: "6px 12px",
                        marginTop: 6
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setAudioMemutar(audioMemutar === m.id ? null : m.id)
                        }
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "#075e54",
                          color: "#ffffff",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer"
                        }}
                      >
                        {audioMemutar === m.id ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                          {[6, 14, 22, 10, 18, 24, 12, 16, 20, 8, 14].map((h, i) => (
                            <span
                              key={i}
                              style={{
                                width: 3,
                                height: audioMemutar === m.id ? Math.max(4, (h * Math.sin(Date.now() / 200 + i)) % 24) : h,
                                background: "#075e54",
                                borderRadius: 99,
                                display: "inline-block"
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "#54656f", fontWeight: 600 }}>
                        0:{m.durasiSuaraDetik < 10 ? `0${m.durasiSuaraDetik}` : m.durasiSuaraDetik}
                      </span>
                    </div>
                  )}

                  {/* Pin Lokasi Spasial Attachment Card */}
                  {m.pinKoordinat && (
                    <div
                      style={{
                        marginTop: 8,
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff"
                      }}
                    >
                      <div
                        style={{
                          height: 65,
                          background: "linear-gradient(135deg, #064e3b, #0d7344)",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff"
                        }}
                      >
                        <MapPin size={28} color="#fbbf24" />
                        <span
                          style={{
                            position: "absolute",
                            bottom: 4,
                            right: 8,
                            fontSize: "0.68rem",
                            background: "rgba(0,0,0,0.5)",
                            padding: "2px 6px",
                            borderRadius: 4
                          }}
                        >
                          GPS Lapangan
                        </span>
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#181a19" }}>
                          {m.pinKoordinat.label}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "#64748b", fontFamily: "monospace" }}>
                          {m.pinKoordinat.lat.toFixed(5)}°, {m.pinKoordinat.lng.toFixed(5)}°
                        </div>
                        <button
                          type="button"
                          className="btn-primary-sm"
                          onClick={() =>
                            onLihatPinDiPeta(
                              m.pinKoordinat!.lat,
                              m.pinKoordinat!.lng,
                              m.pinKoordinat!.label
                            )
                          }
                          style={{
                            marginTop: 6,
                            width: "100%",
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4
                          }}
                        >
                          <Compass size={13} /> Buka di Peta
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Time & Double Checkmark Footer */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 4,
                      marginTop: 3,
                      fontSize: "0.68rem",
                      color: "#667781"
                    }}
                  >
                    <span>{m.waktu}</span>
                    {adalahSaya && (
                      <span>
                        {m.statusKirim === "antrean_offline" ? (
                          <Clock size={12} color="#8696a0" />
                        ) : (
                          <CheckCheck size={14} color="#53bdeb" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* POPUP MENU LAMPIRAN (WHATSAPP ATTACHMENT MENU) */}
      {menuLampiranTerbuka && (
        <div
          style={{
            background: "#ffffff",
            borderTop: "1px solid #d1d7db",
            padding: "12px 16px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px"
          }}
        >
          <button
            type="button"
            onClick={() => setBukaInputPin(true)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: "12px",
              padding: "10px 8px",
              color: "#166534",
              cursor: "pointer",
              fontSize: "0.76rem",
              fontWeight: 700
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#0d7344",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <MapPin size={18} />
            </div>
            Kirim Pin Lokasi
          </button>

          <button
            type="button"
            onClick={kirimVoiceNote}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              background: "#eff6ff",
              border: "1px solid #93c5fd",
              borderRadius: "12px",
              padding: "10px 8px",
              color: "#1e40af",
              cursor: "pointer",
              fontSize: "0.76rem",
              fontWeight: 700
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#2563eb",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Mic size={18} />
            </div>
            Pesan Suara
          </button>

          <button
            type="button"
            onClick={() => kirimPeringatanCepat("Kondisi cuaca hujan lebat / longsor di blok hulu.")}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "12px",
              padding: "10px 8px",
              color: "#92400e",
              cursor: "pointer",
              fontSize: "0.76rem",
              fontWeight: 700
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#d97706",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <AlertTriangle size={18} />
            </div>
            Peringatan Siaga
          </button>
        </div>
      )}

      {/* FORM MODAL BAGIKAN PIN LOKASI */}
      {bukaInputPin && (
        <div
          style={{
            background: "#ffffff",
            padding: "12px 16px",
            borderTop: "1px solid #d1d7db",
            boxShadow: "0 -4px 10px rgba(0,0,0,0.06)"
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 8, color: "#181a19" }}>
            📍 Bagikan Koordinat GPS Lapangan
          </div>
          <div className="form-row-3" style={{ gap: 8 }}>
            <div>
              <label style={{ fontSize: "0.72rem" }}>Label Temuan</label>
              <input
                type="text"
                className="form-input"
                style={{ height: 32, fontSize: "0.8rem" }}
                value={labelPin}
                onChange={(e) => setLabelPin(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem" }}>Latitude</label>
              <input
                type="text"
                className="form-input"
                style={{ height: 32, fontSize: "0.8rem" }}
                value={latPin}
                onChange={(e) => setLatPin(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem" }}>Longitude</label>
              <input
                type="text"
                className="form-input"
                style={{ height: 32, fontSize: "0.8rem" }}
                value={lngPin}
                onChange={(e) => setLngPin(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => setBukaInputPin(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-primary-sm"
              onClick={kirimLokasiCepat}
            >
              Kirim ke Obrolan
            </button>
          </div>
        </div>
      )}

      {/* 3. WHATSAPP STYLE INPUT BAR */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#f0f2f5",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          borderTop: "1px solid #d1d7db"
        }}
      >
        <button
          type="button"
          onClick={() => setMenuLampiranTerbuka((v) => !v)}
          style={{
            background: menuLampiranTerbuka ? "#d9fdd3" : "transparent",
            border: "none",
            color: "#54656f",
            width: 38,
            height: 38,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
          title="Lampirkan Lokasi GPS / Suara"
        >
          <Paperclip size={20} />
        </button>

        <input
          type="text"
          value={teksPesan}
          onChange={(e) => setTeksPesan(e.target.value)}
          placeholder={
            saluranAktif === "komunitas"
              ? "Ketik pesan ke grup kader..."
              : "Tulis pertanyaan / laporan ke Admin GIS..."
          }
          style={{
            flex: 1,
            height: 42,
            borderRadius: 99,
            border: "none",
            background: "#ffffff",
            padding: "0 16px",
            fontSize: "0.92rem",
            color: "#111b21",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            outline: "none"
          }}
        />

        <button
          type="submit"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "#00a884",
            color: "#ffffff",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,168,132,0.4)",
            flexShrink: 0
          }}
          title={teksPesan.trim() ? "Kirim Pesan" : "Rekam Pesan Suara"}
        >
          {teksPesan.trim() ? <Send size={18} /> : <Mic size={18} />}
        </button>
      </form>
    </div>
  );
};
