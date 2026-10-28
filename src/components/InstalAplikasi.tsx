import React, { useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { bannerInstalDitutup, mintaInstal, StatusInstal, tutupBannerInstal, useStatusInstal } from "../lib/instal";

/** Langkah manual bila browser tidak menyediakan dialog pemasangan (mis. Safari iOS, Firefox) */
const PanduanInstal: React.FC<{ status: StatusInstal; onTutup: () => void }> = ({ status, onTutup }) => (
  <div className="modal-backdrop" onClick={onTutup}>
    <div
      className="modal-card"
      id="panduan-instal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-panduan-instal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <h3 id="judul-panduan-instal">📲 Pasang Titik Tapak</h3>
        <button type="button" className="btn-icon-close" onClick={onTutup} aria-label="Tutup">
          <X size={18} />
        </button>
      </div>
      {status.platform === "ios" ? (
        <ol className="panduan-instal-langkah">
          <li>
            Buka halaman ini di <strong>Safari</strong>.
          </li>
          <li>
            Ketuk tombol <strong>Bagikan</strong> <Share size={14} aria-label="ikon Bagikan" /> di bilah bawah (atau atas di iPad).
          </li>
          <li>
            Pilih <strong>Tambahkan ke Layar Utama</strong>, lalu ketuk <strong>Tambah</strong>.
          </li>
        </ol>
      ) : status.platform === "android" ? (
        <ol className="panduan-instal-langkah">
          <li>
            Buka halaman ini di <strong>Chrome</strong> (atau Samsung Internet/Edge).
          </li>
          <li>
            Ketuk menu <strong>⋮</strong> di kanan atas.
          </li>
          <li>
            Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.
          </li>
        </ol>
      ) : (
        <ol className="panduan-instal-langkah">
          <li>
            Buka halaman ini di <strong>Chrome</strong> atau <strong>Edge</strong>.
          </li>
          <li>
            Klik ikon <strong>Instal</strong> <Download size={14} aria-label="ikon Instal" /> di ujung kanan bilah alamat, atau menu{" "}
            <strong>⋮ → Simpan dan bagikan → Instal Titik Tapak</strong>.
          </li>
        </ol>
      )}
      <p className="panduan-instal-catatan">
        Setelah terpasang, Titik Tapak terbuka seperti aplikasi biasa dari layar utama dan tetap bisa dipakai tanpa internet. Pemasangan
        memerlukan alamat <strong>https://</strong>.
      </p>
    </div>
  </div>
);

/** Tombol "Instal aplikasi": memakai dialog bawaan browser bila ada, selain itu menampilkan panduan */
export const TombolInstal: React.FC<{ className?: string; label?: string; onSelesai?: (pesan: string) => void }> = ({
  className = "btn-outline-sm",
  label = "Instal aplikasi",
  onSelesai
}) => {
  const status = useStatusInstal();
  const [panduan, setPanduan] = useState(false);
  if (status.terinstal) return null;
  const klik = async () => {
    if (status.bisaPrompt) {
      const r = await mintaInstal();
      if (r === "diterima") onSelesai?.("✓ Titik Tapak sedang dipasang di perangkat ini.");
      else if (r === "tidak_tersedia") setPanduan(true);
      return;
    }
    setPanduan(true);
  };
  return (
    <>
      <button type="button" className={className} onClick={() => void klik()} data-tombol-instal>
        <Download size={15} aria-hidden="true" /> {label}
      </button>
      {panduan && <PanduanInstal status={status} onTutup={() => setPanduan(false)} />}
    </>
  );
};

/** Banner ajakan memasang aplikasi; bisa ditutup (muncul lagi setelah 14 hari) */
export const BannerInstal: React.FC<{ onSelesai?: (pesan: string) => void }> = ({ onSelesai }) => {
  const status = useStatusInstal();
  const [ditutup, setDitutup] = useState(() => bannerInstalDitutup());
  if (status.terinstal || ditutup) return null;
  return (
    <div className="banner-instal" id="banner-instal" role="region" aria-label="Pasang aplikasi">
      <div className="banner-instal-ikon">
        <Smartphone size={20} aria-hidden="true" />
      </div>
      <div className="banner-instal-teks">
        <strong>Pasang Titik Tapak di HP</strong>
        <span>Buka langsung dari layar utama, layar penuh, dan tetap jalan tanpa internet.</span>
      </div>
      <TombolInstal className="btn-primary-sm banner-instal-tombol" label="Instal" onSelesai={onSelesai} />
      <button
        type="button"
        className="banner-instal-tutup"
        aria-label="Tutup ajakan pasang aplikasi"
        onClick={() => {
          tutupBannerInstal();
          setDitutup(true);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
