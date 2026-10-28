import React from "react";

/**
 * Komponen SVG Siluet Orang bergaya WhatsApp Default Avatar
 */
export const SiluetOrangSvg: React.FC<{ size?: number; warna?: string }> = ({ size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <clipPath id="waAvatarClip">
        <circle cx="32" cy="32" r="30" />
      </clipPath>
    </defs>
    {/* Latar abu-biru khas avatar kosong WhatsApp */}
    <circle cx="32" cy="32" r="30" fill="#6b7c85" />
    <g clipPath="url(#waAvatarClip)">
      {/* Kepala bulat halus khas WhatsApp */}
      <circle cx="32" cy="23" r="11.5" fill="#cfd8dc" />
      {/* Bahu melengkung kubah khas WhatsApp */}
      <path d="M10 58C10 44.5 19.5 38 32 38C44.5 38 54 44.5 54 58V64H10V58Z" fill="#cfd8dc" />
    </g>
  </svg>
);

/**
 * Komponen SVG Gambar Kunci (Gembok Level Terkunci)
 */
export const KunciLevelSvg: React.FC<{ size?: number; warna?: string }> = ({ size = 28, warna = "#fbbf24" }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="10" y="21" width="28" height="21" rx="5" fill="rgba(2, 44, 34, 0.85)" stroke={warna} strokeWidth="3" />
    <path d="M16 21V15C16 10.5817 19.5817 7 24 7C28.4183 7 32 10.5817 32 15V21" stroke={warna} strokeWidth="3" strokeLinecap="round" />
    <circle cx="24" cy="30" r="3" fill={warna} />
    <path d="M24 33V36" stroke={warna} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/**
 * Komponen Cincin Progres SVG Visual
 */
export const CincinProgresSvg: React.FC<{
  persen: number;
  warna: string;
  ikon: React.ReactNode;
  nilai: string;
  label: string;
}> = ({ persen, warna, ikon, nilai, label }) => {
  const r = 34;
  const keliling = 2 * Math.PI * r;
  const offset = keliling - (Math.min(100, Math.max(0, persen)) / 100) * keliling;

  return (
    <div className="visual-ring-card">
      <div className="visual-ring-svg-wrap">
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke={warna}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={keliling}
            strokeDashoffset={offset}
            transform="rotate(-90 42 42)"
          />
        </svg>
        <div className="visual-ring-center-icon" style={{ color: warna }}>
          {ikon}
        </div>
      </div>
      <div className="visual-ring-info">
        <strong className="visual-ring-val">{nilai}</strong>
        <span className="visual-ring-lbl">{label}</span>
      </div>
    </div>
  );
};
