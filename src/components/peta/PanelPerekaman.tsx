import React from "react";
import { Check, Pause, Play, Plus, Radio, Undo2, X } from "lucide-react";
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
  onSimpan,
  onBatal
}) => (
  <div className="recording-active-bar">
    <div className="recording-metrics">
      <span className={`rec-dot ${rekamLatar.status === "dijeda" ? "paused" : ""}`} />
      <div>
        <div className="rec-status-badge-inline">
          <Radio size={12} />
          <span>{rekamLatar.status === "dijeda" ? "REKAMAN DIJEDA" : "SEDANG MEREKAM (LATAR BELAKANG)"}</span>
          <span className="rec-timer-chip" data-tick={detikTick}>
            {formatDurasi(durasiRekamMs(rekamLatar))}
          </span>
        </div>
        <strong>
          {modeRekam === "line"
            ? `Jalur (${jumlahTitik} titik • ${panjangDraftKm} km)`
            : `Poligon (${jumlahTitik} sudut • ${luasDraftHa} Ha)`}
        </strong>
      </div>
    </div>

    {rekamLatar.galat && <span role="alert">{rekamLatar.galat}</span>}
    <div className="recording-actions">
      <button type="button" className="btn-tool" onClick={onTambahTitik} title="Tambah titik dari bidikan tengah peta">
        <Plus size={14} /> +Titik
      </button>
      <button
        type="button"
        className="btn-tool"
        disabled={!jumlahTitik}
        onClick={() => perekamLatar.hapusTitikTerakhir()}
        title="Hapus titik terakhir; jeda GPS agar tidak menambah titik otomatis"
      >
        <Undo2 size={14} /> Urungkan
      </button>
      <button
        type="button"
        className={`btn-tool ${rekamLatar.status === "merekam" ? "active-walk" : ""}`}
        onClick={() => (rekamLatar.status === "merekam" ? perekamLatar.jeda() : perekamLatar.lanjutkan())}
      >
        {rekamLatar.status === "merekam" ? (
          <>
            <Pause size={14} /> Jeda
          </>
        ) : (
          <>
            <Play size={14} /> Lanjut
          </>
        )}
      </button>
      <button
        type="button"
        className={`btn-tool ${rekamLatar.autoGpsAktif ? "active-walk" : ""}`}
        onClick={() => perekamLatar.toggleAutoGps()}
        title="Mode demo: menambah titik acak tanpa GPS. Data simulasi tidak dihitung ke capaian dan skor."
      >
        <Radio size={14} /> {rekamLatar.autoGpsAktif ? "Simulasi ON" : "Simulasi OFF"}
      </button>
      <button
        type="button"
        className="btn-primary-sm"
        disabled={(modeRekam === "line" && jumlahTitik < 2) || (modeRekam === "polygon" && jumlahTitik < 3)}
        onClick={onSimpan}
      >
        <Check size={14} /> Simpan
      </button>
      <button type="button" className="btn-danger-sm" onClick={onBatal} title="Batalkan perekaman">
        <X size={14} />
      </button>
    </div>
  </div>
);
