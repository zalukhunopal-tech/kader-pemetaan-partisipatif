import { usePosisiPerangkat } from "../lib/posisiPerangkat";
import React, { useState, useRef, useEffect } from "react";
import { PeranPengguna, PesanKomunikasi, ProfilKader } from "../types";
import { CatatanPerangkat } from "./CatatanPerangkat";
import {
  MapPin,
  Mic,
  Send,
  Users,
  ShieldAlert,
  Paperclip,
  Check,
  Search,
  Play,
  Pause,
  AlertTriangle,
  Compass,
  Bot,
  Sparkles,
  Reply,
  Copy,
  Forward,
  Trash2,
  X
} from "lucide-react";

interface KomunikasiViewProps {
  pesanList: PesanKomunikasi[];
  profil: ProfilKader;
  peranPengguna?: PeranPengguna;
  onKirimPesan: (
    saluran: "komunitas" | "admin",
    teks: string,
    pinKoordinat?: { lat: number; lng: number; label: string },
    durasiSuaraDetik?: number,
    kustomPengirim?: {
      idPengirim?: string;
      namaPengirim?: string;
      peranPengirim?: PeranPengguna;
      desaPengirim?: string;
      eskalasiAdmin?: boolean;
      audioDataUrl?: string;
    }
  ) => void;
  onHapusPesan?: (idPesan: string) => void;
  onTeruskanPesan?: (pesan: PesanKomunikasi, saluranTujuan: "komunitas" | "admin") => void;
  onLihatPinDiPeta: (lat: number, lng: number, label: string) => void;
  onEskalasiKeAdmin?: (pertanyaan: string, namaKader: string) => void;
}

export const KomunikasiView: React.FC<KomunikasiViewProps> = ({
  pesanList,
  profil,
  peranPengguna,
  onKirimPesan,
  onHapusPesan,
  onTeruskanPesan,
  onLihatPinDiPeta,
  onEskalasiKeAdmin
}) => {
  const perangkat = usePosisiPerangkat();
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
  const [detikPutar, setDetikPutar] = useState(0);
  const [sedangRekamSuara, setSedangRekamSuara] = useState(false);
  const [detikRekamSuara, setDetikRekamSuara] = useState(0);
  const [modeTanpaMikrofon, setModeTanpaMikrofon] = useState(false);
  const [geminiSedangMengetik, setGeminiSedangMengetik] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRekamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const detikRekamRef = useRef(0);

  // State WhatsApp: Pesan Terpilih (tekan tahan), Balasan (quote), Modal Teruskan, & Notifikasi Toast
  const [pesanTerpilih, setPesanTerpilih] = useState<PesanKomunikasi | null>(null);
  const [balasPesan, setBalasPesan] = useState<PesanKomunikasi | null>(null);
  const [modalTeruskanTerbuka, setModalTeruskanTerbuka] = useState(false);
  const [toastTeks, setToastTeks] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!toastTeks) return;
    const t = setTimeout(() => setToastTeks(null), 2400);
    return () => clearTimeout(t);
  }, [toastTeks]);

  // Deteksi Tekan-Tahan (Long-Press 450ms) pada balon pesan seperti WhatsApp
  const handlePointerDown = (pesan: PesanKomunikasi, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setPesanTerpilih(pesan);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(40);
        } catch (_) {}
      }
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  const handleContextMenu = (pesan: PesanKomunikasi, e: React.MouseEvent) => {
    e.preventDefault();
    setPesanTerpilih(pesan);
  };

  const handleAksiSalin = async () => {
    if (!pesanTerpilih) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pesanTerpilih.teks);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = pesanTerpilih.teks;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setToastTeks("✓ Pesan disalin ke papan klip");
    } catch (_) {
      setToastTeks("✓ Pesan disalin");
    }
    setPesanTerpilih(null);
  };

  const handleAksiBalas = () => {
    if (!pesanTerpilih) return;
    setBalasPesan(pesanTerpilih);
    setPesanTerpilih(null);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleAksiBukaTeruskan = () => {
    if (!pesanTerpilih) return;
    setModalTeruskanTerbuka(true);
  };

  const handleKirimTeruskan = (tujuan: "komunitas" | "admin") => {
    if (!pesanTerpilih) return;
    if (onTeruskanPesan) {
      onTeruskanPesan(pesanTerpilih, tujuan);
    } else {
      onKirimPesan(tujuan, `[Diteruskan] ${pesanTerpilih.teks}`, pesanTerpilih.pinKoordinat, pesanTerpilih.durasiSuaraDetik);
    }
    setModalTeruskanTerbuka(false);
    setPesanTerpilih(null);
    setToastTeks(`✓ Pesan diteruskan ke ${tujuan === "komunitas" ? "Komunitas" : "Admin GIS"}`);
  };

  const handleAksiHapus = () => {
    if (!pesanTerpilih) return;
    onHapusPesan?.(pesanTerpilih.id);
    setPesanTerpilih(null);
    setToastTeks("✓ Pesan berhasil dihapus");
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pesanTeks = teksPesan.trim();
    if (!pesanTeks) return;

    const pesanKirim = balasPesan
      ? `[Membalas ${balasPesan.namaPengirim}: "${balasPesan.teks.slice(0, 48)}${balasPesan.teks.length > 48 ? "..." : ""}"]\n${pesanTeks}`
      : pesanTeks;

    onKirimPesan(saluranAktif, pesanKirim);
    setTeksPesan("");
    setBalasPesan(null);
    setMenuLampiranTerbuka(false);

    // Di saluran "admin", jika penanya bukan admin, Gemini AI menjawab pertanyaan
    if (saluranAktif === "admin" && peranPengguna !== "admin") {
      setGeminiSedangMengetik(true);
      try {
        const riwayat = daftarPesanSaluran.map((p) => ({
          role: p.idPengirim === "GEMINI-AI" ? ("model" as const) : ("user" as const),
          text: p.teks
        }));
        const res = await fetch("/api/gemini/chat-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pesan: pesanTeks,
            riwayat,
            pengirim: { nama: profil.nama, desa: profil.desaWilayah, peran: profil.kelompokMasyarakat }
          })
        });
        const data = await res.json();
        if (data.sukses && data.balasan) {
          onKirimPesan(
            "admin",
            data.balasan,
            undefined,
            undefined,
            {
              idPengirim: "GEMINI-AI",
              namaPengirim: "Gemini AI (Asisten Admin)",
              peranPengirim: "admin",
              desaPengirim: "Asisten AI",
              eskalasiAdmin: Boolean(data.butuhAdmin)
            }
          );
          if (data.butuhAdmin) {
            onEskalasiKeAdmin?.(pesanTeks, profil.nama);
          }
        }
      } catch (err) {
        console.error("Gagal menghubungi Gemini:", err);
        onKirimPesan(
          "admin",
          "Pertanyaan Anda telah kami catat dan otomatis diteruskan ke Administrator GIS (Nopal zalukhunopal@gmail.com) agar dapat dijawab secara langsung.",
          undefined,
          undefined,
          {
            idPengirim: "GEMINI-AI",
            namaPengirim: "Gemini AI (Asisten Admin)",
            peranPengirim: "admin",
            desaPengirim: "Asisten AI",
            eskalasiAdmin: true
          }
        );
        onEskalasiKeAdmin?.(pesanTeks, profil.nama);
      } finally {
        setGeminiSedangMengetik(false);
      }
    }
  };

  const kirimLokasiCepat = () => {
    const pin = {
      lat: Number(latPin) || -0.9472,
      lng: Number(lngPin) || 100.418,
      label: labelPin.trim() || "Posisi GPS Lapangan"
    };
    onKirimPesan(saluranAktif, `📍 Berbagi Titik Koordinat: ${labelPin}`, pin);
    setBukaInputPin(false);
    setMenuLampiranTerbuka(false);
  };

  const hentikanStreamRekam = () => {
    streamRekamRef.current?.getTracks().forEach((t) => t.stop());
    streamRekamRef.current = null;
  };

  useEffect(() => {
    if (!sedangRekamSuara) return;
    const idInt = window.setInterval(() => {
      setDetikRekamSuara((d) => {
        const berikut = Math.min(60, d + 1);
        detikRekamRef.current = berikut;
        return berikut;
      });
    }, 1000);
    return () => window.clearInterval(idInt);
  }, [sedangRekamSuara]);

  useEffect(() => {
    if (!audioMemutar) {
      setDetikPutar(0);
      return;
    }
    const pesanAktif = pesanList.find((p) => p.id === audioMemutar);
    const totalDurasi = Math.max(1, pesanAktif?.durasiSuaraDetik ?? 6);
    const idInt = window.setInterval(() => {
      setDetikPutar((d) => {
        if (d + 1 >= totalDurasi) {
          setAudioMemutar(null);
          return 0;
        }
        return d + 1;
      });
    }, 1000);
    return () => window.clearInterval(idInt);
  }, [audioMemutar, pesanList]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* abaikan */
        }
      }
      hentikanStreamRekam();
      audioElRef.current?.pause();
    };
  }, []);

  const mulaiRekamSuara = async () => {
    setMenuLampiranTerbuka(false);
    if (sedangRekamSuara) return;
    detikRekamRef.current = 0;
    setDetikRekamSuara(0);
    audioChunksRef.current = [];
    setModeTanpaMikrofon(false);

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRekamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        mediaRecorderRef.current = recorder;
        recorder.start(250);
        setSedangRekamSuara(true);
        return;
      } catch {
        setModeTanpaMikrofon(true);
      }
    } else {
      setModeTanpaMikrofon(true);
    }

    setSedangRekamSuara(true);
  };

  const batalkanRekamSuara = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* abaikan */
      }
    }
    mediaRecorderRef.current = null;
    hentikanStreamRekam();
    audioChunksRef.current = [];
    setSedangRekamSuara(false);
    setDetikRekamSuara(0);
    setModeTanpaMikrofon(false);
  };

  const selesaiKirimSuara = () => {
    const durasi = Math.max(1, detikRekamRef.current || detikRekamSuara || 1);
    const labelWaktu = `0:${durasi < 10 ? `0${durasi}` : durasi}`;
    const teksMemo = `🎙️ Pesan Suara (${labelWaktu})${modeTanpaMikrofon ? " · Memo lapangan" : ""}`;
    const rec = mediaRecorderRef.current;

    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || "audio/webm" });
        hentikanStreamRekam();
        mediaRecorderRef.current = null;
        if (blob.size > 0 && blob.size <= 350_000) {
          const reader = new FileReader();
          reader.onload = () => {
            const url = typeof reader.result === "string" ? reader.result : undefined;
            onKirimPesan(saluranAktif, teksMemo, undefined, durasi, url ? { audioDataUrl: url } : undefined);
          };
          reader.onerror = () => onKirimPesan(saluranAktif, teksMemo, undefined, durasi);
          reader.readAsDataURL(blob);
        } else {
          onKirimPesan(saluranAktif, teksMemo, undefined, durasi);
        }
      };
      try {
        rec.stop();
      } catch {
        hentikanStreamRekam();
        onKirimPesan(saluranAktif, teksMemo, undefined, durasi);
      }
    } else {
      hentikanStreamRekam();
      onKirimPesan(saluranAktif, teksMemo, undefined, durasi);
    }

    setSedangRekamSuara(false);
    setDetikRekamSuara(0);
    setModeTanpaMikrofon(false);
  };

  const togglePutarSuara = (pesan: PesanKomunikasi) => {
    if (audioMemutar === pesan.id) {
      audioElRef.current?.pause();
      setAudioMemutar(null);
      setDetikPutar(0);
      return;
    }

    audioElRef.current?.pause();
    setDetikPutar(0);
    setAudioMemutar(pesan.id);

    if (pesan.audioDataUrl && typeof Audio !== "undefined") {
      try {
        const el = new Audio(pesan.audioDataUrl);
        audioElRef.current = el;
        el.onended = () => {
          setAudioMemutar(null);
          setDetikPutar(0);
        };
        void el.play().catch(() => {
          /* tetap jalankan pemutar visual bila autoplay dibatasi */
        });
      } catch {
        /* fallback visual */
      }
    }
  };

  const kirimPeringatanCepat = (peringatan: string) => {
    onKirimPesan(saluranAktif, `⚠️ PERINGATAN LAPANGAN: ${peringatan}`);
    setMenuLampiranTerbuka(false);
  };

  return (
    <div
      className="komunikasi-wrapper"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 128px)",
        maxHeight: "840px",
        maxWidth: "1100px",
        width: "calc(100% - 20px)",
        margin: "10px auto",
        background: "#efeae2",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid #d1d7db",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
      }}
    >
      {/* 1. WHATSAPP TOPBAR HEADER / SELECTION ACTION BAR */}
      {pesanTerpilih ? (
        <div className="wa-selection-topbar">
          <div className="wa-selection-left">
            <button
              type="button"
              className="wa-action-icon"
              onClick={() => setPesanTerpilih(null)}
              title="Batal Pilih"
              aria-label="Batal Pilih"
            >
              <X size={20} />
            </button>
            <span className="wa-selection-count">1 pesan dipilih</span>
          </div>
          <div className="wa-selection-actions">
            <button
              type="button"
              className="wa-action-icon"
              onClick={handleAksiBalas}
              title="Balas Pesan"
              aria-label="Balas Pesan"
            >
              <Reply size={20} />
            </button>
            <button
              type="button"
              className="wa-action-icon"
              onClick={handleAksiSalin}
              title="Salin Teks"
              aria-label="Salin Teks"
            >
              <Copy size={20} />
            </button>
            <button
              type="button"
              className="wa-action-icon"
              onClick={handleAksiBukaTeruskan}
              title="Teruskan Pesan"
              aria-label="Teruskan Pesan"
            >
              <Forward size={20} />
            </button>
            {onHapusPesan && (
              <button
                type="button"
                className="wa-action-icon wa-action-delete"
                onClick={handleAksiHapus}
                title="Hapus Pesan"
                aria-label="Hapus Pesan"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="komunikasi-topbar"
          style={{
            background: "#075e54",
            color: "#ffffff",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            flexWrap: "wrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            zIndex: 10
          }}
        >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minWidth: 0,
            flex: "1 1 180px"
          }}
        >
          {/* Avatar Chat */}
          <div
            style={{
              width: 38,
              height: 38,
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
            {saluranAktif === "komunitas" ? <Users size={19} /> : <ShieldAlert size={19} />}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.92rem",
                lineHeight: 1.25,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {saluranAktif === "komunitas" ? "Komunitas" : "Admin"}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "#a7f3d0",
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Tersimpan di perangkat ini</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setTampilCari((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              width: 34,
              height: 34,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0
            }}
            title="Cari Pesan"
          >
            <Search size={17} />
          </button>


        </div>
      </div>
      )}

      {/* MODERN SEGMENTED CONTROL: RUANG DISKUSI KADER VS JALUR KOORDINASI ADMIN */}
      <div className="komunikasi-segmented-wrapper">
        <div className="komunikasi-segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={saluranAktif === "komunitas"}
            className={`komunikasi-seg-btn ${saluranAktif === "komunitas" ? "active" : ""}`}
            onClick={() => setSaluranAktif("komunitas")}
          >
            <span className="seg-icon">👥</span>
            <span className="seg-label seg-label-desktop">Ruang Diskusi Kader</span>
            <span className="seg-label seg-label-mobile">Diskusi Kader</span>
            <span className="seg-badge">{pesanList.filter((p) => p.saluran === "komunitas").length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={saluranAktif === "admin"}
            className={`komunikasi-seg-btn ${saluranAktif === "admin" ? "active" : ""}`}
            onClick={() => setSaluranAktif("admin")}
          >
            <span className="seg-icon">🛡️</span>
            <span className="seg-label seg-label-desktop">Jalur Koordinasi Admin</span>
            <span className="seg-label seg-label-mobile">Jalur Admin</span>
            <span className="seg-badge admin-badge">Resmi</span>
          </button>
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

      {/* Banner Khusus Saluran Admin: Penjelasan Gemini AI Bot */}
      {saluranAktif === "admin" ? (
        <div
          style={{
            background: "#f0fdf4",
            borderBottom: "1px solid #bbf7d0",
            padding: "8px 12px",
            fontSize: "0.76rem",
            color: "#166534",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            lineHeight: 1.45
          }}
        >
          <Bot size={18} style={{ color: "#0d7344", flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Asisten Virtual Gemini AI aktif:</strong> Anda dapat bertanya seputar{" "}
            <em>penggunaan aplikasi Titik Tapak, tugas survei kader, atau data publik</em>. Pertanyaan di luar topik
            atau yang butuh konfirmasi khusus akan otomatis diteruskan ke Administrator (Nopal).
          </div>
        </div>
      ) : (
        <CatatanPerangkat style={{ borderRadius: 0, border: "none", borderBottom: "1px solid #bfdbfe" }}>
          Diskusi ini tersimpan di perangkat ini. Bagikan info dan koordinat survei ke sesama kader lapangan.
        </CatatanPerangkat>
      )}

      {/* 2. CHAT BUBBLE AREA (WHATSAPP PATTERN STYLE) */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 12px",
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
              padding: "18px 20px",
              borderRadius: "14px",
              maxWidth: 320,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
            }}
          >
            <div style={{ fontSize: "1.8rem", marginBottom: 6 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", marginBottom: 4 }}>Mulai Diskusi Lapangan</div>
            <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
              {saluranAktif === "komunitas"
                ? "Bagikan kabar temuan pohon, sarang satwa, mata air, atau titik koordinat GPS ke sesama kader."
                : "Konsultasikan batas survei, validasi data spasial, atau sertifikat ke admin GIS."}
            </div>
          </div>
        ) : (
          daftarPesanSaluran.map((m) => {
            const adalahGemini = m.idPengirim === "GEMINI-AI";
            const adalahSaya = !adalahGemini && (peranPengguna === "admin" ? m.peranPengirim === "admin" : m.idPengirim === profil.idKader);

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
                  onPointerDown={(e) => handlePointerDown(m, e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onContextMenu={(e) => handleContextMenu(m, e)}
                  className={`chat-bubble-item ${pesanTerpilih?.id === m.id ? "chat-bubble-selected" : ""}`}
                  style={{
                    maxWidth: "86%",
                    minWidth: "110px",
                    background: pesanTerpilih?.id === m.id
                      ? (adalahSaya ? "#bbf7d0" : "#dcfce7")
                      : (adalahSaya ? "#d9fdd3" : adalahGemini ? "#f8fafc" : "#ffffff"),
                    border: adalahGemini ? "1.5px solid #86efac" : undefined,
                    borderRadius: adalahSaya ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                    padding: "8px 11px 6px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    position: "relative",
                    cursor: "pointer",
                    touchAction: "pan-y"
                  }}
                >
                  {/* Sender Name if not mine */}
                  {!adalahSaya && (
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        color: adalahGemini ? "#059669" : m.peranPengirim === "admin" ? "#0284c7" : "#0f766e",
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 5
                      }}
                    >
                      {adalahGemini && <Bot size={13} style={{ color: "#059669" }} />}
                      <span>{m.namaPengirim}</span>
                      <span
                        style={{
                          fontSize: "0.64rem",
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 99,
                          background: adalahGemini ? "#dcfce7" : m.peranPengirim === "admin" ? "#e0f2fe" : "#dcfce7",
                          color: adalahGemini ? "#166534" : m.peranPengirim === "admin" ? "#0369a1" : "#166534"
                        }}
                      >
                        {adalahGemini ? "✨ Asisten Cerdas" : m.peranPengirim === "admin" ? "Admin" : m.desaPengirim}
                      </span>
                    </div>
                  )}

                  {/* Message Text with quote support */}
                  {m.teks.startsWith("[Membalas ") && m.teks.includes("]\n") ? (
                    <>
                      {(() => {
                        const idx = m.teks.indexOf("]\n");
                        const quoteHeader = m.teks.slice(1, idx);
                        const body = m.teks.slice(idx + 2);
                        const colonIdx = quoteHeader.indexOf(": ");
                        const replier = colonIdx !== -1 ? quoteHeader.slice(0, colonIdx) : quoteHeader;
                        const snippet = colonIdx !== -1 ? quoteHeader.slice(colonIdx + 2).replace(/^"|"$/g, "") : "";
                        return (
                          <>
                            <div className="chat-quoted-box">
                              <div className="chat-quoted-author">{replier}</div>
                              <div className="chat-quoted-snippet">{snippet}</div>
                            </div>
                            <div style={{ fontSize: "0.88rem", color: "#111b21", lineHeight: 1.4, wordBreak: "break-word" }}>
                              {body}
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div style={{ fontSize: "0.88rem", color: "#111b21", lineHeight: 1.4, wordBreak: "break-word" }}>{m.teks}</div>
                  )}

                  {/* Audio Voice Note Bubble */}
                  {m.durasiSuaraDetik && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: adalahSaya ? "rgba(255,255,255,0.7)" : "#f0f2f5",
                        borderRadius: 99,
                        padding: "6px 10px",
                        marginTop: 6
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => togglePutarSuara(m)}
                        aria-label={audioMemutar === m.id ? "Jeda Pesan Suara" : "Putar Pesan Suara"}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "#075e54",
                          color: "#ffffff",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          flexShrink: 0
                        }}
                      >
                        {audioMemutar === m.id ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: 2 }} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                          {[6, 14, 22, 10, 18, 24, 12, 16, 20, 8, 14].map((h, i, arr) => {
                            const aktifPutar = audioMemutar === m.id;
                            const rasio = aktifPutar ? Math.min(1, detikPutar / Math.max(1, m.durasiSuaraDetik ?? 6)) : 0;
                            const sudahLewat = aktifPutar && i / arr.length <= rasio;
                            return (
                              <span
                                key={i}
                                style={{
                                  width: 3,
                                  height: aktifPutar ? Math.max(5, ((h + detikPutar * 3 + i * 2) % 20) + 4) : h,
                                  background: sudahLewat ? "#00a884" : "#075e54",
                                  borderRadius: 99,
                                  display: "inline-block",
                                  transition: "height 0.15s ease"
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "#54656f", fontWeight: 600, flexShrink: 0 }}>
                        {audioMemutar === m.id
                          ? `0:${detikPutar < 10 ? `0${detikPutar}` : detikPutar}`
                          : `0:${m.durasiSuaraDetik < 10 ? `0${m.durasiSuaraDetik}` : m.durasiSuaraDetik}`}
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
                          height: 60,
                          background: "linear-gradient(135deg, #064e3b, #0d7344)",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff"
                        }}
                      >
                        <MapPin size={26} color="#fbbf24" />
                        <span
                          style={{
                            position: "absolute",
                            bottom: 4,
                            right: 8,
                            fontSize: "0.66rem",
                            background: "rgba(0,0,0,0.5)",
                            padding: "2px 6px",
                            borderRadius: 4
                          }}
                        >
                          GPS Lapangan
                        </span>
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "#181a19", wordBreak: "break-word" }}>
                          {m.pinKoordinat.label}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b", fontFamily: "monospace" }}>
                          {m.pinKoordinat.lat.toFixed(5)}°, {m.pinKoordinat.lng.toFixed(5)}°
                        </div>
                        <button
                          type="button"
                          className="btn-primary-sm"
                          onClick={() => onLihatPinDiPeta(m.pinKoordinat!.lat, m.pinKoordinat!.lng, m.pinKoordinat!.label)}
                          style={{
                            marginTop: 6,
                            width: "100%",
                            padding: "5px 8px",
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

                  {/* Badge Eskalasi Notifikasi ke Admin */}
                  {m.eskalasiAdmin && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: "6px 8px",
                        background: "#fef3c7",
                        border: "1px solid #fde68a",
                        borderRadius: 8,
                        fontSize: "0.72rem",
                        color: "#92400e",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        lineHeight: 1.35
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0, color: "#d97706" }} />
                      <span>Pertanyaan ini telah diteruskan sebagai notifikasi ke Administrator (Nopal).</span>
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
                      fontSize: "0.66rem",
                      color: "#667781"
                    }}
                  >
                    <span>{m.waktu}</span>
                    {adalahSaya && (
                      <span>
                        <span title="Tersimpan di perangkat ini; belum dikirim ke kader lain">
                          <Check size={14} color="#8696a0" />
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {geminiSedangMengetik && (
          <div style={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #86efac",
                borderRadius: "4px 14px 14px 14px",
                padding: "8px 12px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.8rem",
                color: "#0d7344"
              }}
            >
              <Sparkles size={15} style={{ animation: "pulse 1.5s infinite", color: "#059669" }} />
              <span>Gemini AI sedang mengetik jawaban...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* POPUP MENU LAMPIRAN (WHATSAPP ATTACHMENT MENU) */}
      {menuLampiranTerbuka && (
        <div
          style={{
            background: "#ffffff",
            borderTop: "1px solid #d1d7db",
            padding: "10px 12px",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "8px"
          }}
        >
          <button
            type="button"
            onClick={() => {
    if (perangkat.posisi) {
      setLatPin(perangkat.posisi.lat.toFixed(6));
      setLngPin(perangkat.posisi.lng.toFixed(6));
    }
    setBukaInputPin(true);
  }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: "12px",
              padding: "8px 6px",
              color: "#166534",
              cursor: "pointer",
              fontSize: "0.72rem",
              fontWeight: 700,
              textAlign: "center"
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#0d7344",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <MapPin size={17} />
            </div>
            Kirim Pin Lokasi
          </button>

          <button
            type="button"
            onClick={() => void mulaiRekamSuara()}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              background: "#eff6ff",
              border: "1px solid #93c5fd",
              borderRadius: "12px",
              padding: "8px 6px",
              color: "#1e40af",
              cursor: "pointer",
              fontSize: "0.72rem",
              fontWeight: 700,
              textAlign: "center"
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#2563eb",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Mic size={17} />
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
              padding: "8px 6px",
              color: "#92400e",
              cursor: "pointer",
              fontSize: "0.72rem",
              fontWeight: 700,
              textAlign: "center"
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#d97706",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <AlertTriangle size={17} />
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
            padding: "12px 14px",
            borderTop: "1px solid #d1d7db",
            boxShadow: "0 -4px 10px rgba(0,0,0,0.06)"
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 8, color: "#181a19" }}>📍 Bagikan Koordinat GPS Lapangan</div>
          <div className="form-row-3" style={{ gap: 8 }}>
            <div>
              <label style={{ fontSize: "0.72rem" }}>Label Temuan</label>
              <input
                type="text"
                className="form-input"
                style={{ height: 34, fontSize: "0.8rem" }}
                value={labelPin}
                onChange={(e) => setLabelPin(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem" }}>Latitude</label>
              <input
                type="text"
                className="form-input"
                style={{ height: 34, fontSize: "0.8rem" }}
                value={latPin}
                onChange={(e) => setLatPin(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem" }}>Longitude</label>
              <input
                type="text"
                className="form-input"
                style={{ height: 34, fontSize: "0.8rem" }}
                value={lngPin}
                onChange={(e) => setLngPin(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-outline-sm" onClick={() => setBukaInputPin(false)}>
              Batal
            </button>
            <button type="button" className="btn-primary-sm" onClick={kirimLokasiCepat}>
              Kirim ke Obrolan
            </button>
          </div>
        </div>
      )}

      {/* WHATSAPP REPLY / QUOTE PREVIEW BAR */}
      {balasPesan && (
        <div className="chat-reply-preview-bar">
          <div className="chat-reply-indicator" />
          <div className="chat-reply-content">
            <div className="chat-reply-author">
              <Reply size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Membalas {balasPesan.namaPengirim}
            </div>
            <div className="chat-reply-snippet">{balasPesan.teks}</div>
          </div>
          <button
            type="button"
            className="chat-reply-close-btn"
            onClick={() => setBalasPesan(null)}
            title="Batal Balas"
            aria-label="Batal Balas"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 3. WHATSAPP STYLE INPUT BAR ATAU BAR PEREKAMAN SUARA */}
      {sedangRekamSuara ? (
        <div
          role="region"
          aria-label="Rekaman Pesan Suara"
          style={{
            background: "#f0f2f5",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            borderTop: "1px solid #d1d7db"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#ef4444",
                flexShrink: 0
              }}
            />
            <strong style={{ fontSize: "0.86rem", color: "#111b21", fontVariantNumeric: "tabular-nums" }}>
              0:{detikRekamSuara < 10 ? `0${detikRekamSuara}` : detikRekamSuara}
            </strong>
            <span style={{ fontSize: "0.78rem", color: "#54656f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {modeTanpaMikrofon ? "Mode memo cepat (tanpa mikrofon)" : "Merekam pesan suara..."}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button type="button" className="btn-outline-sm" onClick={batalkanRekamSuara} aria-label="Batal Rekam Suara">
              Batal
            </button>
            <button
              type="button"
              onClick={selesaiKirimSuara}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 99,
                background: "#00a884",
                color: "#ffffff",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: "pointer"
              }}
              aria-label="Kirim Pesan Suara"
            >
              <Send size={15} />
              <span>Kirim</span>
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#f0f2f5",
            padding: "8px 10px",
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
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0
            }}
            title="Lampirkan Lokasi GPS / Suara"
          >
            <Paperclip size={19} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={teksPesan}
            onChange={(e) => setTeksPesan(e.target.value)}
            placeholder={saluranAktif === "komunitas" ? "Ketik pesan ke grup kader..." : "Tulis pertanyaan ke Admin GIS..."}
            style={{
              flex: 1,
              minWidth: 0,
              height: 40,
              borderRadius: 99,
              border: "none",
              background: "#ffffff",
              padding: "0 14px",
              fontSize: "0.88rem",
              color: "#111b21",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              outline: "none"
            }}
          />

          <button
            type={teksPesan.trim() ? "submit" : "button"}
            onClick={teksPesan.trim() ? undefined : () => void mulaiRekamSuara()}
            style={{
              width: 40,
              height: 40,
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
            aria-label={teksPesan.trim() ? "Kirim Pesan" : "Rekam Pesan Suara"}
          >
            {teksPesan.trim() ? <Send size={17} /> : <Mic size={17} />}
          </button>
        </form>
      )}

      {/* MODAL TERUSKAN PESAN (WHATSAPP FORWARD DIALOG) */}
      {modalTeruskanTerbuka && pesanTerpilih && (
        <div className="wa-forward-overlay" onClick={() => setModalTeruskanTerbuka(false)}>
          <div className="wa-forward-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-forward-header">
              <span className="wa-forward-title">Teruskan Pesan</span>
              <button
                type="button"
                className="wa-action-icon dark"
                onClick={() => setModalTeruskanTerbuka(false)}
                title="Tutup"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <div className="wa-forward-snippet">
              "{pesanTerpilih.teks.slice(0, 75)}{pesanTerpilih.teks.length > 75 ? "..." : ""}"
            </div>
            <div className="wa-forward-prompt">Pilih saluran tujuan obrolan:</div>
            <div className="wa-forward-options">
              <button
                type="button"
                className="wa-forward-btn"
                onClick={() => handleKirimTeruskan("komunitas")}
              >
                <Users size={18} className="text-emerald" />
                <div className="wa-forward-btn-text">
                  <strong>Saluran Komunitas</strong>
                  <span>Grup diskusi kader masyarakat</span>
                </div>
              </button>
              <button
                type="button"
                className="wa-forward-btn"
                onClick={() => handleKirimTeruskan("admin")}
              >
                <ShieldAlert size={18} className="text-sky" />
                <div className="wa-forward-btn-text">
                  <strong>Saluran Admin GIS</strong>
                  <span>Tanya Administrator</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP TOAST NOTIFIKASI */}
      {toastTeks && <div className="chat-wa-toast">{toastTeks}</div>}
    </div>
  );
};
