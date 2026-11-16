import React, { useState } from "react";
import { ArrowLeft, Bug, Check, Copy, Download, HelpCircle, Send, Trash2 } from "lucide-react";
import {
  catatBugManual,
  eksporInventarisBugJson,
  eksporInventarisBugMarkdown,
  hapusCatatanBug,
  kosongkanInventarisBug,
  useInventarisBug
} from "../lib/inventarisBug";
import { useTombolEsc } from "../lib/useTombolEsc";

interface BantuanBugViewProps {
  onTutup: () => void;
  tabAsal?: string;
  namaPengguna?: string;
  onPesan?: (pesan: string) => void;
}

const PILIHAN_AREA = [
  "Peta Interaktif",
  "Pelacakan atau Kecepatan",
  "Pustaka Peta",
  "Sinkronisasi Google Drive",
  "Sertifikat atau Level",
  "Tugas atau Diskusi",
  "Tampilan atau Sentuhan",
  "Lainnya"
];

export const BantuanBugView: React.FC<BantuanBugViewProps> = ({ onTutup, tabAsal, namaPengguna, onPesan }) => {
  useTombolEsc(true, onTutup);
  const daftarBug = useInventarisBug();
  const [judul, setJudul] = useState("");
  const [area, setArea] = useState("Peta Interaktif");
  const [deskripsi, setDeskripsi] = useState("");
  const [galatForm, setGalatForm] = useState("");
  const [tersalin, setTersalin] = useState(false);

  const jumlahOtomatis = daftarBug.filter((b) => b.sumber === "otomatis").length;
  const jumlahManual = daftarBug.filter((b) => b.sumber === "manual").length;

  const kirimBugManual = (e: React.FormEvent) => {
    e.preventDefault();
    setGalatForm("");
    if (!deskripsi.trim()) {
      setGalatForm("Tuliskan detail bug yang dialami sebelum menyimpan.");
      return;
    }
    try {
      catatBugManual({
        judul: judul.trim() || `[${area}] Laporan pengguna`,
        deskripsi: deskripsi.trim(),
        lokasi: area || tabAsal || "Aplikasi",
        pengguna: namaPengguna
      });
      setJudul("");
      setDeskripsi("");
      onPesan?.("Bug manual tersimpan ke inventaris perbaikan.");
    } catch (err) {
      setGalatForm(err instanceof Error ? err.message : "Gagal menyimpan laporan bug.");
    }
  };

  const salinLaporan = () => {
    const teks = eksporInventarisBugMarkdown();
    if (navigator.clipboard) {
      void navigator.clipboard
        .writeText(teks)
        .then(() => {
          setTersalin(true);
          window.setTimeout(() => setTersalin(false), 1800);
          onPesan?.("Laporan inventaris bug disalin.");
        })
        .catch(() => onPesan?.("Gagal menyalin laporan bug."));
    }
  };

  const unduhJson = () => {
    const blob = new Blob([eksporInventarisBugJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventaris_bug_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onPesan?.("Berkas inventaris bug (.json) diunduh.");
  };

  return (
    <div className="avenza-subpage bantuan-page" role="dialog" aria-label="Bantuan dan Laporan Bug">
      <header className="avenza-subpage-header">
        <button type="button" className="avenza-head-btn" aria-label="Kembali" onClick={onTutup}>
          <ArrowLeft size={22} />
        </button>
        <h2>Bantuan</h2>
      </header>

      <div className="bantuan-content">
        <section className="bantuan-card">
          <div className="bantuan-card-head">
            <HelpCircle size={20} className="bantuan-ikon-hijau" />
            <div>
              <h3>Panduan Cepat Penggunaan</h3>
              <p>Alat bantu pemetaan lapangan, pelacakan GPS, dan pencatatan kendala aplikasi.</p>
            </div>
          </div>
          <ul className="bantuan-tips-list">
            <li>Usap ke atas dari bilah koordinat bawah di peta untuk membuka panel Lokasi, Pelacakan, dan Navigasi.</li>
            <li>Ketuk tombol kompas/GPS kanan atas untuk memusatkan lokasi atau mengunci arah kompas.</li>
            <li>Jika terjadi kesalahan teknis selama pemakaian, aplikasi otomatis mencatatnya di inventaris bawah ini untuk perbaikan sesi berikutnya.</li>
          </ul>
        </section>

        <section className="bantuan-card">
          <div className="bantuan-card-head">
            <Bug size={20} className="bantuan-ikon-oranye" />
            <div>
              <h3>Laporkan Bug Manual</h3>
              <p>Tuliskan kendala yang Anda temui agar termuat rapi bersama catatan otomatis.</p>
            </div>
          </div>

          <form className="bantuan-form" onSubmit={kirimBugManual}>
            <label className="bantuan-label">
              Area atau Fitur Terkait
              <select className="form-input" value={area} onChange={(e) => setArea(e.target.value)}>
                {PILIHAN_AREA.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            <label className="bantuan-label">
              Judul Singkat Bug (Opsional)
              <input
                type="text"
                className="form-input"
                maxLength={140}
                placeholder="Contoh: Tombol tidak merespons saat zoom peta"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
              />
            </label>

            <label className="bantuan-label">
              Uraian Bug / Kejadian *
              <textarea
                rows={4}
                className="form-input bantuan-textarea"
                maxLength={2000}
                placeholder="Tuliskan apa yang terjadi, langkah sebelum bug muncul, dan kondisi jaringan saat itu..."
                value={deskripsi}
                onChange={(e) => {
                  setDeskripsi(e.target.value);
                  if (galatForm) setGalatForm("");
                }}
              />
            </label>

            {galatForm && (
              <p className="field-error" role="alert">
                {galatForm}
              </p>
            )}

            <button type="submit" className="btn-primary-sm bantuan-submit-btn">
              <Send size={16} />
              <span>Simpan Catatan Bug</span>
            </button>
          </form>
        </section>

        <section className="bantuan-card">
          <div className="bantuan-inv-header">
            <div>
              <h3>Inventaris Bug ({daftarBug.length})</h3>
              <p>
                {jumlahOtomatis} otomatis · {jumlahManual} manual (siap diperbaiki pada sesi berikutnya)
              </p>
            </div>
            {daftarBug.length > 0 && (
              <div className="bantuan-inv-actions">
                <button type="button" className="btn-outline-sm bantuan-aksi-pill" onClick={salinLaporan}>
                  {tersalin ? <Check size={15} /> : <Copy size={15} />}
                  <span>{tersalin ? "Disalin" : "Salin"}</span>
                </button>
                <button type="button" className="btn-outline-sm bantuan-aksi-pill" onClick={unduhJson}>
                  <Download size={15} />
                  <span>Unduh</span>
                </button>
                <button
                  type="button"
                  className="btn-outline-sm bantuan-aksi-pill bahaya"
                  onClick={() => {
                    kosongkanInventarisBug();
                    onPesan?.("Inventaris bug dibersihkan.");
                  }}
                >
                  <Trash2 size={15} />
                  <span>Bersihkan</span>
                </button>
              </div>
            )}
          </div>

          {daftarBug.length === 0 ? (
            <p className="bantuan-kosong">Belum ada bug yang tercatat. Error tak terduga selama pemakaian akan otomatis masuk ke daftar ini.</p>
          ) : (
            <div className="bantuan-inv-list">
              {daftarBug.map((item) => (
                <article key={item.id} className="bantuan-bug-item">
                  <div className="bantuan-bug-meta">
                    <span className={`bantuan-bug-badge ${item.sumber === "otomatis" ? "otomatis" : "manual"}`}>
                      {item.sumber === "otomatis" ? "Otomatis" : "Manual"}
                    </span>
                    {item.lokasi && <span className="bantuan-bug-area">{item.lokasi}</span>}
                    {item.jumlahKejadian > 1 && <span className="bantuan-bug-count">{item.jumlahKejadian}×</span>}
                    <button
                      type="button"
                      className="bantuan-bug-hapus"
                      aria-label={`Hapus catatan ${item.judul}`}
                      onClick={() => hapusCatatanBug(item.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <h4 className="bantuan-bug-judul">{item.judul}</h4>
                  <p className="bantuan-bug-desc">{item.deskripsi}</p>
                  <div className="bantuan-bug-footer">
                    <span>{new Date(item.waktuTerakhir).toLocaleString("id-ID")}</span>
                    {item.perangkat && <span>{item.perangkat}</span>}
                  </div>
                  {item.tumpukan && (
                    <details className="bantuan-bug-stack">
                      <summary>Rincian teknis</summary>
                      <pre>{item.tumpukan}</pre>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
