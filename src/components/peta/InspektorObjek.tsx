import { sanitasiTeksInput } from "../../lib/geoUtils";
import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  /** Pesan singkat di peta (mis. "Koordinat disalin") */
  onPesan?: (pesan: string) => void;
}

const LABEL_STATUS: Record<string, string> = {
  lokal: "Tersimpan di HP",
  tersinkron: "Tersinkron ke Drive",
  terverifikasi: "Terverifikasi admin"
};

/**
 * Halaman detail objek yang diketuk di peta, mengikuti halaman tanda tempat Avenza Maps:
 * kepala (tutup · nama), baris-baris berlabel tebal dengan aksi hijau di kanan, lalu tombol
 * Navigasi dan Bagikan di bawah.
 */
export const InspektorObjek: React.FC<InspektorObjekProps> = ({
  objek,
  kondisiUpdateInput,
  setKondisiUpdateInput,
  onTambahPembaruanObjek,
  onGoTo,
  onTutup,
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
        ? `${(objek.panjangKm || 0).toFixed(2).replace(".", ",")} km · ${objek.koordinat.length} titik`
        : `${(objek.luasHa || 0).toFixed(2).replace(".", ",")} Ha · ${objek.koordinat.length} titik`;

  const salin = (teks: string) => {
    if (!navigator.clipboard) return;
    void navigator.clipboard
      .writeText(teks)
      .then(() => onPesan?.("Disalin: " + teks))
      .catch(() => onPesan?.("Gagal menyalin"));
  };

  const bagikan = () => {
    const teks = `${objek.judul} (${objek.kategori}) — ${teksKoordinat}`;
    if (typeof navigator.share === "function") {
      void navigator.share({ title: objek.judul, text: teks }).catch(() => undefined);
    } else salin(teks);
  };

  return (
    <section className="avz-halaman avz-detail-objek field-inspector-sheet" role="dialog" aria-label={objek.judul}>
      <header className="avz-halaman-kepala">
        <button type="button" className="avenza-head-btn btn-icon-close" aria-label="Tutup" onClick={onTutup}>
          <ChevronDown size={26} />
        </button>
        <h2>{objek.judul}</h2>
      </header>

      <div className="avz-halaman-isi avz-isian">
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Koordinat</strong>
            {koordUtama && (
              <button type="button" className="avz-aksi-hijau" onClick={() => salin(teksKoordinat)}>
                Salin
              </button>
            )}
          </div>
          <span>{teksKoordinat}</span>
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Lapisan saat ini</strong>
          </div>
          <span className="avz-isian-nilai-panah">
            Data lapangan <ChevronRight size={20} />
          </span>
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Kategori</strong>
          </div>
          <span>{objek.kategori}</span>
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Ukuran</strong>
          </div>
          <span>{ukuran}</span>
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
            <strong>Status</strong>
          </div>
          <span>{LABEL_STATUS[objek.statusSinkron] ?? objek.statusSinkron}</span>
          <small className="avz-isian-kecil">
            Kualitas data {dqa.grade} · {dqa.skor}/100
          </small>
        </div>

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

      <footer className="avz-halaman-kaki">
        {koordUtama && (
          <button
            type="button"
            className="avz-tombol-garis inspector-goto-btn"
            onClick={() => onGoTo({ lat: koordUtama.lat, lng: koordUtama.lng, judul: objek.judul })}
          >
            Navigasi
          </button>
        )}
        <button type="button" className="avz-tombol-garis" onClick={bagikan}>
          Bagikan
        </button>
      </footer>
    </section>
  );
};
