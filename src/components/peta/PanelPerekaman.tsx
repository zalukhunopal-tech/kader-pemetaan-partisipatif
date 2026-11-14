import React, { useState } from "react";
import { AlertTriangle, Pause, Play, Plus, Square, Undo2, X } from "lucide-react";
import { JenisGeometri } from "../../types";
import { StatePerekamLatar, durasiRekamMs, formatDurasi, perekamLatar } from "../../lib/perekamLatar";

interface PanelPerekamanProps {
  rekamLatar: StatePerekamLatar;
  modeRekam: JenisGeometri;
  jumlahTitik: number;
  panjangDraftKm: number;
  luasDraftHa: number;
  /** Berubah setiap detik selama merekam, supaya durasi ikut diperbarui */
  detikTick: number;
  onTambahTitik: () => void;
  /** Ketuk status: buka panel Pelacakan (berisi Jeda, Hentikan, dan opsi lain) */
  onBukaPanel: () => void;
  onSimpan: () => void;
  onBatal: () => void;
}

/**
 * Status perekaman ala Avenza Maps: pita oranye tembus pandang tepat di atas bilah koordinat,
 * bukan kotak dialog. Jalur: Jeda/Lanjut dan Hentikan. Area: +Titik, Urungkan, dan Hentikan.
 * Opsi lain (Ulangi, Snap, simulasi) ada di panel Pelacakan.
 */
export const PanelPerekaman: React.FC<PanelPerekamanProps> = ({
  rekamLatar,
  modeRekam,
  jumlahTitik,
  panjangDraftKm,
  luasDraftHa,
  detikTick,
  onTambahTitik,
  onBukaPanel,
  onSimpan,
  onBatal
}) => {
  const [tutupGalat, setTutupGalat] = useState<string | null>(null);
  const galatTampil = rekamLatar.galat && tutupGalat !== rekamLatar.galat ? rekamLatar.galat : null;
  const dijeda = rekamLatar.status === "dijeda";
  const cukup = modeRekam === "line" ? jumlahTitik >= 2 : jumlahTitik >= 3;
  const ukuran =
    modeRekam === "line" ? `${panjangDraftKm.toFixed(2).replace(".", ",")} km` : `${luasDraftHa.toFixed(2).replace(".", ",")} Ha`;

  return (
    <div className={`recording-active-bar avz-status-rekam ${dijeda ? "dijeda" : ""}`} role="status">
      {galatTampil && (
        <div className="rec-error-alert" role="alert">
          <span className="rec-error-text" title={galatTampil}>
            <AlertTriangle size={13} style={{ flexShrink: 0 }} /> {galatTampil}
          </span>
          <button
            type="button"
            className="rec-error-dismiss"
            onClick={() => setTutupGalat(galatTampil)}
            aria-label="Tutup penanda"
            title="Tutup penanda"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="avz-status-rekam-baris">
        <button type="button" className="avz-status-rekam-info" onClick={onBukaPanel} title="Buka panel Pelacakan">
          <span className={`rec-dot ${dijeda ? "paused" : ""}`} aria-hidden="true" />
          <span className="rec-status-label">
            {modeRekam === "line" ? (dijeda ? "Pelacakan dijeda" : "Melacak") : dijeda ? "Area dijeda" : "Gambar area"}
          </span>
          <span className="rec-geom-summary">
            {ukuran} · {jumlahTitik} titik ·{" "}
            <span className="rec-timer-chip" data-tick={detikTick}>
              {formatDurasi(durasiRekamMs(rekamLatar))}
            </span>
          </span>
        </button>

        <div className="avz-status-rekam-aksi">
          {modeRekam === "polygon" && (
            <>
              <button type="button" className="rec-btn-add" onClick={onTambahTitik} title="Tambah titik dari bidikan tengah peta">
                <Plus size={18} />
                <span>Titik</span>
              </button>
              <button
                type="button"
                disabled={!jumlahTitik}
                onClick={() => perekamLatar.hapusTitikTerakhir()}
                title="Hapus titik terakhir"
                aria-label="Urungkan"
              >
                <Undo2 size={18} />
              </button>
            </>
          )}
          <button
            type="button"
            className="rec-pause-btn"
            onClick={() => (dijeda ? perekamLatar.lanjutkan() : perekamLatar.jeda())}
            title={dijeda ? "Lanjutkan rekaman" : "Jeda rekaman"}
          >
            {dijeda ? <Play size={18} /> : <Pause size={18} />}
            <span>{dijeda ? "Lanjut" : "Jeda"}</span>
          </button>
          <button
            type="button"
            className="rec-btn-save"
            disabled={!cukup}
            onClick={onSimpan}
            title={cukup ? "Hentikan lalu simpan" : modeRekam === "line" ? "Butuh minimal 2 titik" : "Butuh minimal 3 titik"}
          >
            <Square size={15} />
            <span>Hentikan</span>
          </button>
          <button type="button" className="rec-cancel-btn" onClick={onBatal} title="Batalkan perekaman" aria-label="Batalkan perekaman">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
