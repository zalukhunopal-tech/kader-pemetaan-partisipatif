import { sanitasiTeksInput } from "../../lib/geoUtils";
import React from "react";
import { ChevronDown, ChevronRight, Lock, MapPin, Route, Hexagon } from "lucide-react";
import { hitungSkorKualitasData } from "../../lib/kualitasData";
import { DataSpasialItem } from "../../types";
import { JEDA_PEMBARUAN_JAM } from "../../lib/rewardEngine";
import { useTombolEsc } from "../../lib/useTombolEsc";

interface InspektorObjekProps {
  objek: DataSpasialItem;
  /** Isian kondisi terbaru; dipegang peta supaya tidak hilang saat panel ditutup lalu dibuka lagi */
  kondisiUpdateInput: string;
  setKondisiUpdateInput: (nilai: string) => void;
  onTambahPembaruanObjek: (idData: string, kondisiTerbaru: string, catatan: string) => boolean;
  onGoTo: (target: { lat: number; lng: number; judul: string }) => void;
  onTutup: () => void;
  onHapus?: (idData: string) => void;
  /** Pesan singkat di peta (mis. "Koordinat disalin") */
  onPesan?: (pesan: string) => void;
}

const LABEL_STATUS: Record<string, string> = {
  lokal: "Tersimpan di HP",
  tersinkron: "Tersinkron ke Drive",
  terverifikasi: "Terverifikasi admin"
};

/**
 * Halaman detail objek yang diketuk di peta (Pin dijatuhkan / Trek / Area),
 * mengikuti struktur bersih Avenza Maps tanpa kategori bawaan lama.
 */
export const InspektorObjek: React.FC<InspektorObjekProps> = ({
  objek,
  kondisiUpdateInput,
  setKondisiUpdateInput,
  onTambahPembaruanObjek,
  onGoTo,
  onTutup,
  onHapus,
  onPesan
}) => {
  useTombolEsc(true, onTutup);
  const dqa = hitungSkorKualitasData(objek);
  const koordUtama = objek.koordinat[0];
  const teksKoordinat = koordUtama ? `${koordUtama.lat.toFixed(6)}, ${koordUtama.lng.toFixed(6)}` : "-";
  const ukuran =
    objek.jenisGeometri === "point"
      ? koordUtama?.akurasi
        ? `Akurasi ±${Math.round(koordUtama.akurasi)} m`
        : "1 titik"
      : objek.jenisGeometri === "line"
        ? `${(objek.panjangKm || 0).toFixed(2).replace(".", ",")} km`
        : `${(objek.luasHa || 0).toFixed(2).replace(".", ",")} Ha`;

  const judulTipe = objek.jenisGeometri === "point" ? "Pin dijatuhkan" : objek.jenisGeometri === "line" ? "Trek" : "Area";
  const warnaCorak =
    objek.warna || (objek.jenisGeometri === "line" ? "#f26101" : objek.jenisGeometri === "polygon" ? "#0d7344" : "#ef4444");
  const labelCorak =
    objek.simbol || (objek.jenisGeometri === "line" ? "Jingga jejak" : objek.jenisGeometri === "polygon" ? "Hijau zamrud" : "Pin Merah");

  const tgl = objek.createdAt ? new Date(objek.createdAt) : new Date();
  const dibuatTeks = Number.isNaN(tgl.getTime())
    ? objek.createdAt
    : `${String(tgl.getDate()).padStart(2, "0")}/${String(tgl.getMonth() + 1).padStart(2, "0")}/${String(tgl.getFullYear()).slice(-2)} pada ${String(tgl.getHours()).padStart(2, "0")}.${String(tgl.getMinutes()).padStart(2, "0")}`;

  const salin = (teks: string) => {
    if (!navigator.clipboard) return;
    void navigator.clipboard
      .writeText(teks)
      .then(() => onPesan?.("Disalin: " + teks))
      .catch(() => onPesan?.("Gagal menyalin"));
  };

  const bagikan = () => {
    const teks = `${objek.judul} — ${teksKoordinat}`;
    if (typeof navigator.share === "function") {
      void navigator.share({ title: objek.judul, text: teks }).catch(() => undefined);
    } else salin(teks);
  };

  const elevasiVal = objek.elevasi ?? koordUtama?.elevasi;

  return (
    <section className="avz-halaman avz-detail-objek field-inspector-sheet" role="dialog" aria-label={objek.judul}>
      <header className="avz-halaman-kepala">
        <button type="button" className="avenza-head-btn btn-icon-close" aria-label="Tutup" onClick={onTutup}>
          <ChevronDown size={26} />
        </button>
        <h2>{judulTipe}</h2>
      </header>

      <div className="avz-halaman-isi avz-isian">
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Nama</strong>
          </div>
          <span>{objek.judul}</span>
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>{objek.jenisGeometri === "point" ? "Koordinat" : objek.jenisGeometri === "line" ? "Jarak" : "Luas"}</strong>
            {koordUtama && (
              <button type="button" className="avz-aksi-hijau" onClick={() => salin(teksKoordinat)}>
                Salin
              </button>
            )}
          </div>
          <span className="tabular-nums">{objek.jenisGeometri === "point" ? teksKoordinat : ukuran}</span>
          {objek.jenisGeometri !== "point" && <small className="avz-isian-kecil">{teksKoordinat}</small>}
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Lapisan saat ini</strong>
          </div>
          <span className="avz-isian-nilai-panah">
            {objek.lapisanNama || objek.tematik || "Lapisan 1"} <ChevronRight size={20} />
          </span>
        </div>

        {objek.fotoBase64 && (
          <div className="avz-isian-baris">
            <div className="avz-isian-kepala">
              <strong>Foto</strong>
            </div>
            <img className="avz-isian-foto" src={objek.fotoBase64} alt={`Foto ${objek.judul}`} />
          </div>
        )}

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Deskripsi</strong>
          </div>
          <span>{objek.deskripsi || "Tidak ada deskripsi."}</span>
          <small className="avz-isian-kecil">
            {objek.namaKader} · {objek.desaWilayah}
          </small>
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Corak</strong>
          </div>
          <span className="avz-isian-nilai-panah">
            <span>{labelCorak}</span>
            <span className="avz-corak-preview">
              {objek.jenisGeometri === "point" ? (
                <MapPin size={18} color={warnaCorak} fill={warnaCorak} aria-hidden="true" />
              ) : objek.jenisGeometri === "line" ? (
                <Route size={18} color={warnaCorak} aria-hidden="true" />
              ) : (
                <Hexagon size={18} color={warnaCorak} aria-hidden="true" />
              )}
              <ChevronRight size={18} aria-hidden="true" />
            </span>
          </span>
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>{objek.jenisGeometri === "point" ? "Elevasi" : "Perolehan elevasi total"}</strong>
          </div>
          <span className="tabular-nums">{elevasiVal !== undefined ? `${elevasiVal.toFixed(2).replace(".", ",")} m` : "---"}</span>
        </div>

        {objek.jenisGeometri === "line" && (
          <>
            <div className="avz-isian-baris">
              <div className="avz-isian-kepala">
                <strong>Tampilkan Grafik</strong>
              </div>
              <span className="avz-isian-nilai-panah tabular-nums">
                Dist: {(objek.panjangKm || 0).toFixed(2).replace(".", ",")} km | {objek.koordinat.length} titik{" "}
                <ChevronRight size={18} aria-hidden="true" />
              </span>
            </div>
            <div className="avz-isian-baris">
              <div className="avz-isian-kepala">
                <strong>Operasi</strong>
                <span className="avz-lock-yellow">
                  <Lock size={13} aria-hidden="true" />
                </span>
              </div>
              <span className="avz-isian-kecil">Tersimpan sebagai jalur trek · {LABEL_STATUS[objek.statusSinkron] ?? objek.statusSinkron}</span>
            </div>
          </>
        )}

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Dibuat</strong>
          </div>
          <span className="tabular-nums">{dibuatTeks}</span>
        </div>

        {objek.atributKustom && Object.keys(objek.atributKustom).length > 0 ? (
          <div className="avz-isian-baris">
            <div className="avz-isian-kepala">
              <strong>Skema atribut tugas</strong>
            </div>
            <div className="avz-atribut-kustom-list">
              {Object.entries(objek.atributKustom).map(([kunci, nilai]) => (
                <div key={kunci} className="avz-atribut-kustom-row">
                  <span className="text-muted">{kunci}</span>
                  <span>
                    {typeof nilai === "string" && nilai.startsWith("data:image/") ? (
                      <img src={nilai} alt={kunci} className="avz-isian-foto" style={{ maxHeight: 90 }} />
                    ) : (
                      nilai || "-"
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="avz-isian-baris">
            <div className="avz-isian-kepala">
              <strong>Skema atribut</strong>
            </div>
            <span className="avz-isian-kecil">
              {LABEL_STATUS[objek.statusSinkron] ?? objek.statusSinkron} · Kualitas {dqa.grade} ({dqa.skor}/100)
            </span>
          </div>
        )}

        <div className="avz-isian-baris inspector-update-box">
          <div className="avz-isian-kepala">
            <strong>Perbarui kondisi</strong>
          </div>
          {objek.riwayatPembaruan && objek.riwayatPembaruan.length > 0 && (
            <ul className="avz-riwayat">
              {objek.riwayatPembaruan.slice(-2).map((r) => (
                <li key={r.id}>{r.kondisiTerbaru}</li>
              ))}
            </ul>
          )}
          <input
            type="text"
            className="avz-input"
            placeholder="Kondisi terbaru..."
            value={kondisiUpdateInput}
            onChange={(e) => setKondisiUpdateInput(e.target.value)}
          />
          <small className="avz-isian-kecil">Satu pembaruan per objek setiap {JEDA_PEMBARUAN_JAM} jam.</small>
          <button
            type="button"
            className="avz-tombol-garis"
            onClick={() => {
              if (!kondisiUpdateInput.trim()) return;
              const diterima = onTambahPembaruanObjek(objek.id, sanitasiTeksInput(kondisiUpdateInput.trim()), "");
              if (diterima) setKondisiUpdateInput("");
            }}
          >
            Simpan pembaruan
          </button>
        </div>
      </div>

      <footer className="avz-halaman-kaki avz-footer-pills">
        {koordUtama && (
          <button
            type="button"
            className="avz-pill-outline-btn inspector-goto-btn"
            onClick={() => onGoTo({ lat: koordUtama.lat, lng: koordUtama.lng, judul: objek.judul })}
          >
            Navigasi
          </button>
        )}
        <button type="button" className="avz-pill-outline-btn" onClick={bagikan}>
          Bagikan
        </button>
        {onHapus && (
          <button type="button" className="avz-pill-outline-btn" onClick={() => onHapus(objek.id)}>
            Hapus
          </button>
        )}
      </footer>
    </section>
  );
};
