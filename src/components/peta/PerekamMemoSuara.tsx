import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { MemoSuara } from "../../types";
import { checksumSha256 } from "../../lib/gdriveBertahap";
import { buatId } from "../../lib/id";

export function PerekamMemoSuara({
  memo,
  onTambah,
  onHapus,
  onSibuk
}: {
  memo: MemoSuara[];
  onTambah: (m: MemoSuara) => void;
  onHapus: (id: string) => void;
  onSibuk: (sibuk: boolean) => void;
}) {
  const [merekam, setMerekam] = useState(false),
    [galat, setGalat] = useState(""),
    [sedangPutarId, setSedangPutarId] = useState<string | null>(null);
  const ref = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    audioRef = useRef<HTMLAudioElement | null>(null),
    hidup = useRef(true),
    meminta = useRef(false);
  const callbacks = useRef({ onTambah, onSibuk });
  useEffect(() => {
    callbacks.current = { onTambah, onSibuk };
  }, [onTambah, onSibuk]);
  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
      meminta.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (ref.current?.state === "recording") ref.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    };
  }, []);
  const rekam = async () => {
    if (meminta.current || ref.current?.state === "recording") return;
    meminta.current = true;
    setGalat("");
    callbacks.current.onSibuk(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw new Error("Rekaman suara tidak didukung browser ini.");
      if (memo.length >= 10) throw new Error("Maksimal 10 memo suara per objek.");
      const mime = (["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"] as const).find((t) =>
        MediaRecorder.isTypeSupported(t)
      );
      if (!mime) throw new Error("Format audio ringan tidak didukung browser ini.");
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!hidup.current) {
        s.getTracks().forEach((t) => t.stop());
        callbacks.current.onSibuk(false);
        return;
      }
      stream.current = s;
      const media = new MediaRecorder(s, { mimeType: mime, audioBitsPerSecond: 32_000 });
      ref.current = media;
      const chunks: BlobPart[] = [],
        mulai = Date.now();
      let ukuran = 0;
      media.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          ukuran += e.data.size;
          if (ukuran > 280_000 && media.state === "recording") media.stop();
        }
      };
      media.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        s.getTracks().forEach((t) => t.stop());
        if (hidup.current) setMerekam(false);
        void (async () => {
          const blob = new Blob(chunks, { type: mime });
          if (!blob.size || blob.size > 300_000) throw new Error("Memo melebihi 300 KB atau kosong. Rekam ulang lebih singkat.");
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const dataUrl = `data:${mime};base64,` + btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
          callbacks.current.onTambah({
            id: buatId("AUDIO"),
            mimeType: mime,
            dataUrl,
            ukuranByte: blob.size,
            durasiDetik: Math.min(30, Math.max(0.1, (Date.now() - mulai) / 1000)),
            direkamPada: new Date(mulai).toISOString(),
            sha256: checksumSha256(bytes)
          });
        })()
          .catch((e) => {
            if (hidup.current) setGalat(e instanceof Error ? e.message : "Gagal menyimpan suara.");
          })
          .finally(() => {
            meminta.current = false;
            callbacks.current.onSibuk(false);
          });
      };
      media.onerror = () => {
        if (hidup.current) setGalat("Mikrofon terputus. Periksa memo sebelum menyimpan.");
        if (media.state === "recording") media.stop();
        s.getTracks().forEach((t) => t.stop());
      };
      media.start(1000);
      setMerekam(true);
      timer.current = setTimeout(() => {
        if (media.state === "recording") media.stop();
      }, 30_000);
    } catch (e) {
      meminta.current = false;
      callbacks.current.onSibuk(false);
      stream.current?.getTracks().forEach((t) => t.stop());
      if (hidup.current) setGalat(e instanceof Error ? e.message : "Izin mikrofon ditolak.");
    }
  };
  const togglePutar = (m: MemoSuara) => {
    const el = audioRef.current;
    if (!el) return;
    if (sedangPutarId === m.id) {
      el.pause();
      setSedangPutarId(null);
      return;
    }
    el.pause();
    el.src = m.dataUrl;
    el.currentTime = 0;
    setSedangPutarId(m.id);
    void el.play().catch(() => {
      if (hidup.current) setSedangPutarId(null);
    });
  };

  return (
    <section className={`field-audio ${memo.length > 0 ? "punya-memo" : ""}`}>
      <button
        type="button"
        className={`btn-media-simbol ${merekam ? "merekam" : ""}`}
        aria-label={merekam ? "Hentikan rekaman suara" : "Rekam memo suara"}
        title={merekam ? "Hentikan rekaman" : "Rekam suara"}
        onClick={() => (merekam ? ref.current?.stop() : void rekam())}
      >
        {merekam ? <Square size={20} /> : <Mic size={22} />}
      </button>
      {merekam && (
        <span className="field-audio-rekam-status" role="status">
          Merekam…
        </span>
      )}
      {galat && <p role="alert">{galat}</p>}
      <audio
        ref={audioRef}
        onEnded={() => setSedangPutarId(null)}
        onPause={() => setSedangPutarId(null)}
        style={{ display: "none" }}
      />
      {memo.length > 0 && (
        <div className="field-audio-list">
          {memo.map((m, i) => {
            const aktifPutar = sedangPutarId === m.id;
            return (
              <div className="field-audio-item field-audio-pill" key={m.id}>
                <button
                  type="button"
                  className={`btn-audio-play ${aktifPutar ? "sedang-putar" : ""}`}
                  aria-label={aktifPutar ? `Jeda rekaman suara ${i + 1}` : `Putar rekaman suara ${i + 1}`}
                  title={aktifPutar ? "Jeda" : "Putar"}
                  onClick={() => togglePutar(m)}
                >
                  {aktifPutar ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <span className="field-audio-durasi">{Math.max(1, Math.round(m.durasiDetik))} dtk</span>
                <button
                  type="button"
                  className="btn-icon-close"
                  aria-label={`Hapus memo ${i + 1}`}
                  title="Hapus rekaman"
                  onClick={() => {
                    if (aktifPutar) {
                      audioRef.current?.pause();
                      setSedangPutarId(null);
                    }
                    onHapus(m.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
