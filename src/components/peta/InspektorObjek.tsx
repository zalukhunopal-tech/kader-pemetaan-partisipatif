import { sanitasiTeksInput } from "../../lib/geoUtils";
import React from "react";
import { BottomSheet } from "./BottomSheet";
import { hitungSkorKualitasData } from "../../lib/kualitasData";
import { Navigation, RefreshCw, X } from "lucide-react";
import { DataSpasialItem } from "../../types";
import { JEDA_PEMBARUAN_JAM } from "../../lib/rewardEngine";

interface InspektorObjekProps {
  objek: DataSpasialItem;
  /** Isian kondisi terbaru; dipegang peta supaya tidak hilang saat panel ditutup lalu dibuka lagi */
  kondisiUpdateInput: string;
  setKondisiUpdateInput: (nilai: string) => void;
  onTambahPembaruanObjek: (idData: string, kondisiTerbaru: string, catatan: string) => boolean;
  onGoTo: (target: { lat: number; lng: number; judul: string }) => void;
  onTutup: () => void;
}

/** Panel detail objek yang diketuk di peta: deskripsi, navigasi Go-To, dan pembaruan kondisi */
export const InspektorObjek: React.FC<InspektorObjekProps> = ({
  objek,
  kondisiUpdateInput,
  setKondisiUpdateInput,
  onTambahPembaruanObjek,
  onGoTo,
  onTutup
}) => {
  const dqa = hitungSkorKualitasData(objek);
  const koordUtama = objek.koordinat[0];
  const labelGeometri =
    objek.jenisGeometri === "point"
      ? "📍 Titik"
      : objek.jenisGeometri === "line"
        ? "〰️ Jalur"
        : "⬠ Poligon";
  const infoUkuran =
    objek.jenisGeometri === "point"
      ? `1 Titik${koordUtama?.akurasi ? ` (±${Math.round(koordUtama.akurasi)} m)` : ""}`
      : objek.jenisGeometri === "line"
        ? `${(objek.panjangKm || 0).toFixed(2)} km • ${objek.koordinat.length} titik`
        : `${(objek.luasHa || 0).toFixed(2)} Ha • ${objek.koordinat.length} titik`;

  return (
    <BottomSheet judul={objek.judul} onTutup={onTutup} awal={55} className="field-inspector-sheet">
      <div className="inspector-header">
        <div className="inspector-badges-row">
          <span className="inspector-geo-pill">{labelGeometri}</span>
          <span className="badge-kategori">{objek.kategori}</span>
          <span className={`badge-sync status-${objek.statusSinkron}`} style={{ marginLeft: 0 }}>
            {objek.statusSinkron.toUpperCase()}
          </span>
          <span className="dqa-badge">
            Kualitas {dqa.grade} · {dqa.skor}/100
          </span>
        </div>
        <button type="button" className="btn-icon-close" onClick={onTutup}>
          <X size={18} />
        </button>
      </div>

      <div className="inspector-summary-strip">
        <div className="inspector-summary-item">
          <span className="inspector-summary-label">Koordinat</span>
          <strong className="inspector-summary-val">
            {koordUtama ? `${koordUtama.lat.toFixed(5)}°, ${koordUtama.lng.toFixed(5)}°` : "-"}
          </strong>
        </div>
        <div className="inspector-summary-item">
          <span className="inspector-summary-label">Geometri & Ukuran</span>
          <strong className="inspector-summary-val">{infoUkuran}</strong>
        </div>
      </div>

      <div className="inspector-grid">
        <div className="inspector-main-col">
          <div className="inspector-desc-box">
            <p className="inspector-desc">{objek.deskripsi || "Tidak ada catatan deskripsi tambahan."}</p>
            <div className="inspector-meta-line">
              <span>{objek.namaKader}</span>
              <span>•</span>
              <span>{objek.desaWilayah}</span>
            </div>
          </div>

          {koordUtama && (
            <button
              type="button"
              className="btn-primary-sm inspector-goto-btn"
              onClick={() =>
                onGoTo({
                  lat: koordUtama.lat,
                  lng: koordUtama.lng,
                  judul: objek.judul
                })
              }
            >
              <Navigation size={14} /> Navigasi Go-To
            </button>
          )}
        </div>

        <div className="inspector-update-box">
          <h5>
            <RefreshCw size={14} /> Perbarui Kondisi
          </h5>
          {objek.riwayatPembaruan && objek.riwayatPembaruan.length > 0 && (
            <div className="update-history-list">
              {objek.riwayatPembaruan.slice(-2).map((r) => (
                <div key={r.id} className="update-history-item">
                  <strong>{r.kondisiTerbaru}</strong>
                </div>
              ))}
            </div>
          )}
          <input
            type="text"
            className="form-input"
            placeholder="Kondisi terbaru..."
            value={kondisiUpdateInput}
            onChange={(e) => setKondisiUpdateInput(e.target.value)}
          />
          <p className="text-xs text-muted" style={{ margin: "6px 0 0" }}>
            Satu pembaruan per objek setiap {JEDA_PEMBARUAN_JAM} jam.
          </p>
          <button
            type="button"
            className="btn-primary-sm"
            style={{ marginTop: "8px", width: "100%" }}
            onClick={() => {
              if (!kondisiUpdateInput.trim()) return;
              const diterima = onTambahPembaruanObjek(objek.id, sanitasiTeksInput(kondisiUpdateInput.trim()), "");
              if (diterima) {
                setKondisiUpdateInput("");
              }
            }}
          >
            + Simpan Pembaruan
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
