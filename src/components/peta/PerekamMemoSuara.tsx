import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
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
    [galat, setGalat] = useState("");
  const ref = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
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
  return (
    <section className="field-audio">
      <h4>Penuturan & sejarah tempat</h4>
      <p className="field-help">Rekam suara hingga 30 detik. Tersimpan bersama survei di perangkat.</p>
      <button
        type="button"
        className={merekam ? "btn-danger-sm" : "btn-outline-sm"}
        onClick={() => (merekam ? ref.current?.stop() : void rekam())}
      >
        {merekam ? <Square size={18} /> : <Mic size={18} />} {merekam ? "Hentikan rekaman" : "Rekam memo suara"}
      </button>
      {galat && <p role="alert">{galat}</p>}
      {memo.map((m, i) => (
        <div className="field-audio-item" key={m.id}>
          <label>
            Memo {i + 1} · {Math.round(m.durasiDetik)} detik
            <audio controls preload="none" src={m.dataUrl} />
          </label>
          <button type="button" className="btn-icon-close" aria-label={`Hapus memo ${i + 1}`} onClick={() => onHapus(m.id)}>
            <Trash2 size={18} />
          </button>
        </div>
      ))}
    </section>
  );
}
