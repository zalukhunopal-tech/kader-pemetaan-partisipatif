import React from "react";
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
}) => (
  <div className="inspector-card">
    <div className="inspector-header">
      <div>
        <span className="badge-kategori">{objek.kategori}</span>
        <span className={`badge-sync status-${objek.statusSinkron}`}>{objek.statusSinkron.toUpperCase()}</span>
        <h4>{objek.judul}</h4>
      </div>
      <button type="button" className="btn-icon-close" onClick={onTutup}>
        <X size={18} />
      </button>
    </div>

    <div className="inspector-grid">
      <div>
        <p className="inspector-desc">{objek.deskripsi}</p>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() =>
              onGoTo({
                lat: objek.koordinat[0].lat,
                lng: objek.koordinat[0].lng,
                judul: objek.judul
              })
            }
          >
            <Navigation size={14} /> Navigasi Go-To
          </button>
        </div>
      </div>

      <div className="inspector-update-box">
        <h5>
          <RefreshCw size={14} /> Perbarui Kondisi
        </h5>
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
            const diterima = onTambahPembaruanObjek(objek.id, kondisiUpdateInput.trim(), "");
            if (diterima) {
              setKondisiUpdateInput("");
            }
          }}
        >
          + Simpan Pembaruan
        </button>
      </div>
    </div>
  </div>
);
