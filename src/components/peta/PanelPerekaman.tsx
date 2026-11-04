import React, { useState } from "react";
import { AlertTriangle, Check, Pause, Play, Plus, Radio, Undo2, Redo2, X } from "lucide-react";
import { JenisGeometri } from "../../types";
import { hitungLuasPoligonMeter2 } from "../../lib/geoUtils";
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
  snapAktif?: boolean;
  onToggleSnap?: () => void;
  onSimpan: () => void;
  onBatal: () => void;
}

/** Panel kendali saat merekam jalur atau poligon (perekaman tetap berjalan di latar belakang) */
export const PanelPerekaman: React.FC<PanelPerekamanProps> = ({
  rekamLatar,
  modeRekam,
  jumlahTitik,
  panjangDraftKm,
  luasDraftHa,
  detikTick,
  onTambahTitik,
  snapAktif,
  onToggleSnap,
  onSimpan,
  onBatal
}) => {
  const [tutupGalat, setTutupGalat] = useState<string | null>(null);
  const galatTampil = rekamLatar.galat && tutupGalat !== rekamLatar.galat ? rekamLatar.galat : null;

  return (
    <div className="recording-active-bar">
      <div className="recording-header-row">
        <div className="recording-metrics">
          <span className={`rec-dot ${rekamLatar.status === "dijeda" ? "paused" : ""}`} />
          <div className="rec-info-col">
            <div className="rec-status-badge-inline">
              <Radio size={12} />
              <span className="rec-status-label">
                {rekamLatar.status === "dijeda" ? "REKAMAN DIJEDA" : "SEDANG MEREKAM"}
              </span>
              <span className="rec-timer-chip" data-tick={detikTick}>
                {formatDurasi(durasiRekamMs(rekamLatar))}
              </span>
            </div>
            <strong className="rec-geom-summary">
              {modeRekam === "line"
                ? `Jalur (${jumlahTitik} titik • ${panjangDraftKm} km)`
                : `Poligon (${jumlahTitik} sudut • ${luasDraftHa} Ha / ${hitungLuasPoligonMeter2(rekamLatar.titik).toFixed(1)} m²)`}
            </strong>
          </div>
        </div>

        <div className="recording-top-controls">
          <button
            type="button"
            className={`btn-tool rec-pause-btn ${rekamLatar.status === "merekam" ? "active-walk" : ""}`}
            onClick={() => (rekamLatar.status === "merekam" ? perekamLatar.jeda() : perekamLatar.lanjutkan())}
            title={rekamLatar.status === "merekam" ? "Jeda rekaman" : "Lanjutkan rekaman"}
          >
            {rekamLatar.status === "merekam" ? (
              <>
                <Pause size={13} /> <span>Jeda</span>
              </>
            ) : (
              <>
                <Play size={13} /> <span>Lanjut</span>
              </>
            )}
          </button>
          <button type="button" className="btn-danger-sm rec-cancel-btn" onClick={onBatal} title="Batalkan perekaman">
            <X size={15} />
          </button>
        </div>
      </div>

      {galatTampil && (
        <div className="rec-error-alert" role="alert">
          <span className="rec-error-text" title={galatTampil}>
            <AlertTriangle size={12} style={{ flexShrink: 0 }} /> {galatTampil}
          </span>
          <button
            type="button"
            className="rec-error-dismiss"
            onClick={() => setTutupGalat(galatTampil)}
            aria-label="Tutup penanda"
            title="Tutup penanda"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="recording-actions">
      <button type="button" className="btn-tool rec-btn-add" onClick={onTambahTitik} title="Tambah titik dari bidikan tengah peta">
        <Plus size={15} /> <span>+Titik</span>
      </button>
      <button
        type="button"
        className="btn-tool"
        disabled={!jumlahTitik}
        onClick={() => perekamLatar.hapusTitikTerakhir()}
        title="Hapus titik terakhir; jeda GPS agar tidak menambah titik otomatis"
      >
        <Undo2 size={13} /> <span>Urungkan</span>
      </button>
      <button
        type="button"
        className="btn-tool"
        disabled={!rekamLatar.redoVertex?.length}
        onClick={() => perekamLatar.ulangiVertex()}
        title="Ulangi penambahan titik"
      >
        <Redo2 size={13} /> <span>Ulangi</span>
      </button>
      {modeRekam === "polygon" && (
        <button
          type="button"
          className={`btn-tool ${snapAktif ? "active-walk" : ""}`}
          aria-pressed={snapAktif}
          onClick={onToggleSnap}
          title="Snap sudut poligon ke titik awal jika jarak ≤ 5 meter"
        >
          <span>Snap {snapAktif ? "ON" : "OFF"}</span>
        </button>
      )}
      <button
        type="button"
        className={`btn-tool ${rekamLatar.autoGpsAktif ? "active-walk" : ""}`}
        onClick={() => perekamLatar.toggleAutoGps()}
        title="Mode simulasi: menambah titik acak tanpa GPS lapangan"
      >
        <Radio size={13} /> <span>{rekamLatar.autoGpsAktif ? "Sim ON" : "Sim OFF"}</span>
      </button>
      <button
        type="button"
        className="btn-primary-sm rec-btn-save"
        disabled={(modeRekam === "line" && jumlahTitik < 2) || (modeRekam === "polygon" && jumlahTitik < 3)}
        onClick={onSimpan}
        title="Simpan geometri rekaman ke basis data"
      >
        <Check size={15} /> <span>Simpan</span>
      </button>
    </div>
  </div>
  );
};
