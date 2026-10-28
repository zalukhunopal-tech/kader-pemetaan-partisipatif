import React from "react";
import { Pause, Play, Radio, ShieldCheck } from "lucide-react";
import { BATAS_DIAM_MS } from "../../lib/gerbangAdmin";
import { PerkiraanPenyimpanan, StatusPenyimpanan, formatUkuranByte } from "../../lib/penyimpanan";
import { StatePerekamLatar, durasiRekamMs, formatDurasi, perekamLatar, ringkasanRekam } from "../../lib/perekamLatar";

/** Penanda jelas bahwa sedang di mode admin, dengan kunci manual */
export const BannerModeAdmin: React.FC<{ onKunci: () => void }> = ({ onKunci }) => (
  <div className="banner-mode-admin" role="status">
    <ShieldCheck size={14} aria-hidden="true" />
    <span>Mode Administrator · terkunci bila {Math.round(BATAS_DIAM_MS / 60000)} menit tanpa aktivitas</span>
    <button type="button" onClick={onKunci}>
      Kunci
    </button>
  </div>
);

interface BannerPerekamanProps {
  rekamLatar: StatePerekamLatar;
  /** Berubah setiap detik selama merekam, supaya durasi ikut diperbarui */
  detikRekamTick: number;
  petaTerbuka: boolean;
  onBukaPeta: () => void;
}

/** Tanda sedang merekam di latar belakang (muncul di semua tab) */
export const BannerPerekaman: React.FC<BannerPerekamanProps> = ({ rekamLatar, detikRekamTick, petaTerbuka, onBukaPeta }) => (
  <div className={`global-rec-banner ${rekamLatar.status === "dijeda" ? "paused" : ""}`} data-tick={detikRekamTick}>
    <div className="global-rec-left" onClick={onBukaPeta}>
      <span className="global-rec-pulse-dot" />
      <Radio size={15} />
      <div className="global-rec-text">
        <strong>{rekamLatar.status === "merekam" ? "SEDANG MEREKAM DI LATAR BELAKANG" : "PEREKAMAN LATAR DIJEDA"}</strong>
        <span>
          {formatDurasi(durasiRekamMs(rekamLatar))} • {ringkasanRekam(rekamLatar)}
        </span>
      </div>
    </div>

    <div className="global-rec-actions">
      <button
        type="button"
        className="global-rec-btn"
        onClick={() => (rekamLatar.status === "merekam" ? perekamLatar.jeda() : perekamLatar.lanjutkan())}
      >
        {rekamLatar.status === "merekam" ? (
          <>
            <Pause size={13} /> Jeda
          </>
        ) : (
          <>
            <Play size={13} /> Lanjut
          </>
        )}
      </button>
      {!petaTerbuka && (
        <button type="button" className="global-rec-btn primary" onClick={onBukaPeta}>
          Buka Peta
        </button>
      )}
    </div>
  </div>
);

interface BannerPenyimpananProps {
  statusPenyimpanan: StatusPenyimpanan;
  ruangPenyimpanan: PerkiraanPenyimpanan | null;
}

/** Peringatan penyimpanan: data baru yang tidak tersimpan harus terlihat, bukan hilang senyap */
export const BannerPenyimpanan: React.FC<BannerPenyimpananProps> = ({ statusPenyimpanan, ruangPenyimpanan }) => {
  if (!(statusPenyimpanan.galat || (ruangPenyimpanan && ruangPenyimpanan.persen >= 80))) return null;
  return (
    <div className="banner-penyimpanan" role="alert">
      <strong>⚠ {statusPenyimpanan.galat ? "Data terbaru mungkin belum tersimpan" : "Penyimpanan perangkat hampir penuh"}</strong>
      <span>
        {statusPenyimpanan.galat ??
          `Terpakai ${formatUkuranByte(ruangPenyimpanan!.pakaiByte)} dari ${formatUkuranByte(ruangPenyimpanan!.kuotaByte)} (${Math.round(ruangPenyimpanan!.persen)}%).`}{" "}
        Ekspor atau sinkronkan data sekarang, lalu hapus peta offline atau objek yang tidak diperlukan.
      </span>
    </div>
  );
};
