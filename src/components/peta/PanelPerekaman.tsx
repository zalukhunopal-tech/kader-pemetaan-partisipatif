import React from "react";
import { Check, Info, Plus, Undo2 } from "lucide-react";
import { JenisGeometri, KoordinatTitik } from "../../types";
import { hitungBearingDerajat, hitungJarakMeter, hitungLuasPoligonHa } from "../../lib/geoUtils";
import { StatePerekamLatar, perekamLatar } from "../../lib/perekamLatar";

interface PanelPerekamanProps {
  rekamLatar: StatePerekamLatar;
  modeRekam: JenisGeometri;
  /** True bila dibuka dari fitur "Gambar dan Ukur" (tampilan kartu ukur atas + pil aksi + bilah alat bawah) */
  modeGambarUkur?: boolean;
  jumlahTitik: number;
  panjangDraftKm: number;
  luasDraftHa: number;
  /** Berubah setiap detik selama merekam, supaya durasi ikut diperbarui */
  detikTick: number;
  /** Koordinat titik bidikan tengah peta saat ini */
  titikBidikan?: KoordinatTitik;
  /** Teks koordinat titik bidikan terformat (mis. "2.855874, 117.375991") */
  teksTitikBidikan?: string;
  /** Elevasi terkini dalam meter (dari GPS atau titik terakhir) */
  elevasiMeter?: number | null;
  onTambahTitik: () => void;
  /** Ketuk status: buka panel Pelacakan (berisi Jeda, Hentikan, dan opsi lain) */
  onBukaPanel: () => void;
  onSimpan: () => void;
  onBatal: () => void;
  /** Pusatkan peta ke posisi GPS saat di mode Gambar dan Ukur */
  onPusatkanGps?: () => void;
  /** Ganti mode geometri di dalam Gambar dan Ukur (konversi garis menjadi area atau sebaliknya) */
  onPilihJenisUkur?: (jenis: "line" | "polygon") => void;
}

function formatLuasUkur(luasHa: number): string {
  if (luasHa >= 100) {
    return `${(luasHa / 100).toFixed(2).replace(".", ",")} km²`;
  }
  return `${luasHa.toFixed(2).replace(".", ",")} Ha`;
}

/**
 * Komponen notifikasi perekaman di atas peta:
 * 1. Mode Pelacakan GPS (Rekam Jalur GPS): pita oranye sederhana rata tengah ("Melacak" / "Pelacakan dijeda").
 * 2. Mode Gambar dan Ukur: kartu pengukuran atas (Jarak total / Area total, Segmen / Perimeter, Arah titik,
 *    Elevasi, Titik), tombol konversi Garis <-> Area, pil aksi mengapung, dan bilah alat bawah.
 */
export const PanelPerekaman: React.FC<PanelPerekamanProps> = ({
  rekamLatar,
  modeRekam,
  modeGambarUkur,
  jumlahTitik,
  panjangDraftKm,
  luasDraftHa,
  detikTick,
  titikBidikan,
  teksTitikBidikan,
  elevasiMeter,
  onTambahTitik,
  onBukaPanel,
  onSimpan,
  onPusatkanGps,
  onPilihJenisUkur
}) => {
  const dijeda = rekamLatar.status === "dijeda";
  const cukup = modeRekam === "line" ? jumlahTitik >= 2 : jumlahTitik >= 3;
  const adalahGambarUkur = modeGambarUkur ?? modeRekam === "polygon";

  if (!adalahGambarUkur) {
    return (
      <div
        className={`recording-active-bar avz-status-rekam avz-status-rekam-sederhana ${dijeda ? "dijeda" : ""}`}
        role="status"
        data-tick={detikTick}
      >
        <button
          type="button"
          className="avz-status-rekam-baris avz-status-rekam-info avz-status-rekam-tengah"
          onClick={onBukaPanel}
          title="Buka panel Pelacakan"
        >
          <span className={`rec-dot ${dijeda ? "paused" : ""}`} aria-hidden="true" />
          <span className="rec-status-label">{dijeda ? "Pelacakan dijeda" : "Melacak"}</span>
        </button>
      </div>
    );
  }

  const daftarTitik = rekamLatar.titik.length ? rekamLatar.titik : [];
  const titikTerakhir = daftarTitik[daftarTitik.length - 1];
  const titikSebelum = daftarTitik.length >= 2 ? daftarTitik[daftarTitik.length - 2] : undefined;
  const bidikan = titikBidikan ?? titikTerakhir ?? { lat: 0, lng: 0 };

  let segmenKm = 0;
  let arahTitikDerajat = 0;
  let jarakTotalKm = panjangDraftKm;

  if (titikTerakhir) {
    const jarakKeBidikanM = titikBidikan ? hitungJarakMeter(titikTerakhir, titikBidikan) : 0;
    if (jarakKeBidikanM > 0.5 && titikBidikan) {
      segmenKm = jarakKeBidikanM / 1000;
      arahTitikDerajat = hitungBearingDerajat(titikTerakhir, titikBidikan);
      jarakTotalKm = panjangDraftKm + segmenKm;
    } else if (titikSebelum) {
      segmenKm = hitungJarakMeter(titikSebelum, titikTerakhir) / 1000;
      arahTitikDerajat = hitungBearingDerajat(titikSebelum, titikTerakhir);
    }
  }

  // Hitung luas & perimeter real-time untuk mode Area (polygon)
  const titikAreaAktif =
    modeRekam === "polygon" &&
    titikBidikan &&
    titikTerakhir &&
    hitungJarakMeter(titikTerakhir, titikBidikan) > 0.5
      ? [...daftarTitik, titikBidikan]
      : daftarTitik;

  const luasAktifHa =
    modeRekam === "polygon"
      ? titikAreaAktif.length >= 3 && titikAreaAktif.length !== daftarTitik.length
        ? hitungLuasPoligonHa(titikAreaAktif)
        : luasDraftHa
      : luasDraftHa;

  let perimeterKm = jarakTotalKm;
  if (modeRekam === "polygon" && titikAreaAktif.length >= 3) {
    let totalM = 0;
    for (let i = 0; i < titikAreaAktif.length - 1; i++) {
      totalM += hitungJarakMeter(titikAreaAktif[i], titikAreaAktif[i + 1]);
    }
    totalM += hitungJarakMeter(titikAreaAktif[titikAreaAktif.length - 1], titikAreaAktif[0]);
    perimeterKm = totalM / 1000;
  }

  const jarakTotalTeks = `${jarakTotalKm.toFixed(2).replace(".", ",")} km`;
  const perimeterTeks = `${perimeterKm.toFixed(2).replace(".", ",")} km`;
  const luasTotalTeks = formatLuasUkur(luasAktifHa);
  const segmenTeks = `${segmenKm.toFixed(2).replace(".", ",")} km`;
  const arahTitikTeks = `${arahTitikDerajat.toFixed(2).replace(".", ",")} °`;
  const nilaiElevasi = elevasiMeter ?? titikBidikan?.elevasi ?? titikTerakhir?.elevasi ?? 0;
  const elevasiTeks = `${nilaiElevasi.toFixed(2).replace(".", ",")} m`;
  const koordinatTitikTeks = teksTitikBidikan ?? `${bidikan.lat.toFixed(6)}, ${bidikan.lng.toFixed(6)}`;
  const adalahModeArea = modeRekam === "polygon";

  return (
    <div className="recording-active-bar avz-status-rekam avz-ukur-mode" role="status">
      <div className="avz-ukur-panel">
        <div className="avz-ukur-total-baris">
          <strong className="avz-ukur-total-teks">
            {adalahModeArea ? `Area total: ${luasTotalTeks}` : `Jarak total: ${jarakTotalTeks}`}
          </strong>
          <span className="avz-ukur-info-ikon" aria-hidden="true" title="Ringkasan pengukuran">
            <Info size={16} />
          </span>
          {onPilihJenisUkur && (
            <button
              type="button"
              className="avz-ukur-konversi-chip"
              onClick={() => onPilihJenisUkur(adalahModeArea ? "line" : "polygon")}
              title={adalahModeArea ? "Konversi area menjadi garis" : "Konversi garis menjadi area"}
            >
              {adalahModeArea ? "Jadi Garis" : "Konversi ke Area"}
            </button>
          )}
        </div>
        <div className="avz-ukur-kotak-tiga">
          <div className="avz-ukur-kotak">
            <span className="avz-ukur-kotak-label">{adalahModeArea ? "Perimeter" : "Segmen"}</span>
            <span className="avz-ukur-kotak-nilai">{adalahModeArea ? perimeterTeks : segmenTeks}</span>
          </div>
          <div className="avz-ukur-kotak">
            <span className="avz-ukur-kotak-label">Arah titik</span>
            <span className="avz-ukur-kotak-nilai">{arahTitikTeks}</span>
          </div>
          <div className="avz-ukur-kotak">
            <span className="avz-ukur-kotak-label">Elevasi</span>
            <span className="avz-ukur-kotak-nilai">{elevasiTeks}</span>
          </div>
        </div>
        <div className="avz-ukur-kotak avz-ukur-kotak-penuh">
          <span className="avz-ukur-kotak-label">Titik</span>
          <span className="avz-ukur-kotak-nilai">{koordinatTitikTeks}</span>
        </div>
      </div>

      <div className="avz-ukur-bawah">
        <div className="avz-ukur-pil-baris">
          <button
            type="button"
            className="avz-ukur-pil-btn avz-ukur-btn-urungkan"
            disabled={!jumlahTitik}
            onClick={() => perekamLatar.hapusTitikTerakhir()}
            title="Hapus titik terakhir"
            aria-label="Urungkan"
          >
            <Undo2 size={18} />
            <span>Urungkan</span>
          </button>
          <button
            type="button"
            className="avz-ukur-pil-btn avz-ukur-btn-tambah rec-btn-add"
            onClick={onTambahTitik}
            title="Tambahkan titik dari bidikan tengah peta"
          >
            <Plus size={19} strokeWidth={2.5} />
            <span>Tambahkan titik</span>
          </button>
        </div>

        <div className="avz-ukur-toolbar" role="toolbar" aria-label="Alat gambar dan ukur">
          <button
            type="button"
            className="avz-ukur-tool-btn"
            onClick={onPusatkanGps}
            title="Pusatkan ke lokasi GPS"
            aria-label="Pusatkan ke GPS"
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>

          {/* Tombol Konversi Garis <-> Area (persis Avenza: di mode garis ikon kotak area, di mode area ikon garis) */}
          <button
            type="button"
            className={`avz-ukur-tool-btn ${adalahModeArea ? "aktif" : ""}`}
            aria-pressed={adalahModeArea}
            onClick={() => onPilihJenisUkur?.(adalahModeArea ? "line" : "polygon")}
            title={adalahModeArea ? "Konversi ke garis (Line)" : "Konversi ke area (Polygon)"}
            aria-label={adalahModeArea ? "Konversi ke garis" : "Konversi ke area"}
          >
            {adalahModeArea ? (
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="6.8" y1="17.2" x2="17.2" y2="6.8" />
                <circle cx="5.2" cy="18.8" r="2.2" />
                <circle cx="18.8" cy="5.2" r="2.2" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="4.5" y="4.5" width="15" height="15" rx="1" />
                <circle cx="4.5" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
                <circle cx="19.5" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
                <circle cx="4.5" cy="19.5" r="1.6" fill="currentColor" stroke="none" />
                <circle cx="19.5" cy="19.5" r="1.6" fill="currentColor" stroke="none" />
                <path d="M8.5 15.5l7-7M7 11l4-4M13 17l4-4" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="avz-ukur-tool-btn"
            disabled
            title="Pengukur arah radius"
            aria-label="Pengukur arah radius"
            style={{ opacity: 0.45 }}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 12l4.5-7.2" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          </button>

          <button
            type="button"
            className="avz-ukur-tool-btn avz-ukur-btn-simpan rec-btn-save"
            disabled={!cukup}
            onClick={onSimpan}
            title={cukup ? "Simpan hasil pengukuran" : modeRekam === "line" ? "Butuh minimal 2 titik" : "Butuh minimal 3 titik"}
            aria-label="Simpan pengukuran"
          >
            <Check size={22} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
};
