import React, { useEffect, useState } from "react";

/**
 * Ilustrasi latar kartu "Buka peta dasar": fajar di atas bentang alam berlapis dengan matahari,
 * satelit di orbitnya, garis kontur, kisi koordinat, sungai, hutan, rangkong, kijang, pin lokasi,
 * kompas, dan skala. Semuanya SVG buatan sendiri (tanpa aset berlisensi pihak lain).
 * Gerakan dimatikan bila perangkat meminta gerak minimal.
 */

// Posisi pohon di punggung bukit tengah (x, y, skala)
const POHON: [number, number, number][] = [
  [18, 166, 1], [34, 162, 1.2], [52, 160, 0.9], [70, 156, 1.1], [92, 152, 1.3], [112, 150, 1], [134, 148, 1.2],
  [156, 146, 0.9], [178, 143, 1.1], [228, 136, 1], [246, 132, 1.25], [266, 130, 0.95], [404, 142, 1.1],
  [424, 140, 1.3], [446, 138, 1], [468, 136, 1.15], [490, 134, 0.9], [512, 136, 1.2], [600, 142, 1.05], [620, 140, 1.25]
];

const SINAR = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);

function gerakDiizinkan(): boolean {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

const Rangkong: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-12 0 L-24 -3 L-23 4 Z" fill="#0b1f2a" />
    <ellipse cx="0" cy="0" rx="13" ry="5" fill="#0b1f2a" />
    <path className="pd-sayap" d="M-5 -2 C-1 -17 8 -20 13 -15 C7 -11 4 -6 2 -2 Z" fill="#0b1f2a" />
    <path d="M-4 1 C-2 9 4 12 9 10 C5 7 3 4 1 1 Z" fill="#12303e" />
    <circle cx="12" cy="-2" r="3.6" fill="#0b1f2a" />
    <path d="M14 -3 C22 -4 27 0 29 3 C23 2 18 1 14 0 Z" fill="#f59e0b" />
    <path d="M13 -5 C18 -9 23 -7 25 -4 C20 -5 16 -5 13 -3.5 Z" fill="#fbbf24" />
    <path d="M-23 -3 L-23 4" stroke="#f8fafc" strokeWidth="1.4" />
  </g>
);

export const LatarPetaDasar: React.FC = () => {
  const [gerak, setGerak] = useState<boolean>(() => gerakDiizinkan());
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const ubah = () => setGerak(!mq.matches);
      mq.addEventListener("change", ubah);
      return () => mq.removeEventListener("change", ubah);
    } catch {
      return undefined;
    }
  }, []);

  return (
    <svg
      className="avenza-basemap-svg latar-peta-dasar"
      viewBox="0 0 640 220"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="pdLangit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b3a53" />
          <stop offset="36%" stopColor="#13627a" />
          <stop offset="62%" stopColor="#2a9d8f" />
          <stop offset="86%" stopColor="#f4a261" />
          <stop offset="100%" stopColor="#f9c97c" />
        </linearGradient>
        <radialGradient id="pdMatahari" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#fffbe0" />
          <stop offset="45%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="pdCahaya" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pdGunungJauh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b7f83" />
          <stop offset="100%" stopColor="#24585c" />
        </linearGradient>
        <linearGradient id="pdGunungTengah" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f7a5c" />
          <stop offset="100%" stopColor="#134a39" />
        </linearGradient>
        <linearGradient id="pdBukit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#37a765" />
          <stop offset="100%" stopColor="#1f7a46" />
        </linearGradient>
        <linearGradient id="pdSungai" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#a5f3fc" />
        </linearGradient>
        <pattern id="pdKisi" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0 L0 0 0 40" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
        <path id="pdOrbit" d="M-30 150 Q320 -70 670 118" />
        <path id="pdLintasBurung" d="M-60 70 C120 40 260 96 420 60 S640 70 720 50" />
      </defs>

      {/* Langit fajar, kisi koordinat, dan garis kontur */}
      <rect width="640" height="220" fill="url(#pdLangit)" />
      <rect width="640" height="220" fill="url(#pdKisi)" />
      <g fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.1">
        <path d="M150 52 C180 20 250 20 276 48 C300 74 260 102 216 100 C170 98 126 82 150 52 Z" />
        <path d="M168 54 C190 34 240 34 258 52 C274 70 246 88 216 87 C184 86 152 74 168 54 Z" />
        <path d="M186 56 C200 44 230 45 240 56 C248 66 232 76 214 75 C196 74 178 66 186 56 Z" />
        <path d="M380 40 C420 14 470 22 466 52 C462 76 420 84 392 72 C362 60 354 56 380 40 Z" />
        <path d="M396 44 C424 28 452 34 450 52 C448 66 422 70 404 63 C386 56 380 54 396 44 Z" />
      </g>

      {/* Matahari dengan sinar yang berputar pelan */}
      <circle cx="532" cy="74" r="74" fill="url(#pdCahaya)" />
      <g className={gerak ? "pd-sinar" : undefined} stroke="#fde68a" strokeWidth="3" strokeLinecap="round" opacity="0.85">
        {SINAR.map((a) => (
          <line
            key={a}
            x1={532 + Math.cos(a) * 40}
            y1={74 + Math.sin(a) * 40}
            x2={532 + Math.cos(a) * 54}
            y2={74 + Math.sin(a) * 54}
          />
        ))}
      </g>
      <circle cx="532" cy="74" r="30" fill="url(#pdMatahari)" />

      {/* Orbit dan satelit pengamat bumi */}
      <use href="#pdOrbit" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="4 6" />
      <g>
        <g transform="translate(-14 -8)">
          <rect x="0" y="5" width="9" height="6" rx="1" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="0.6" />
          <rect x="10" y="3" width="10" height="10" rx="2" fill="#e2e8f0" />
          <rect x="21" y="5" width="9" height="6" rx="1" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="0.6" />
          <line x1="15" y1="13" x2="15" y2="17" stroke="#e2e8f0" strokeWidth="1.2" />
          <circle cx="15" cy="18" r="1.6" fill="#fbbf24" />
          <g className={gerak ? "pd-sinyal" : undefined} fill="none" stroke="#fde68a" strokeWidth="1.1" strokeLinecap="round">
            <path d="M10 22 Q15 26 20 22" />
            <path d="M7 26 Q15 32 23 26" />
          </g>
        </g>
        {gerak ? (
          <animateMotion dur="18s" repeatCount="indefinite" rotate="0" keyPoints="0.12;0.88;0.12" keyTimes="0;0.5;1" calcMode="linear">
            <mpath href="#pdOrbit" />
          </animateMotion>
        ) : (
          <animateMotion dur="0.001s" fill="freeze" keyPoints="0.42;0.42" keyTimes="0;1" calcMode="linear">
            <mpath href="#pdOrbit" />
          </animateMotion>
        )}
      </g>

      {/* Rangkong terbang melintasi langit */}
      <g>
        <Rangkong x={0} y={0} s={0.9} />
        <Rangkong x={-34} y={14} s={0.62} />
        {gerak ? (
          <animateMotion dur="26s" repeatCount="indefinite" rotate="0">
            <mpath href="#pdLintasBurung" />
          </animateMotion>
        ) : (
          <animateMotion dur="0.001s" fill="freeze" keyPoints="0.33;0.33" keyTimes="0;1" calcMode="linear">
            <mpath href="#pdLintasBurung" />
          </animateMotion>
        )}
      </g>

      {/* Pegunungan jauh dengan garis kontur */}
      <path
        d="M0 150 L60 112 L104 130 L170 86 L236 128 L300 98 L372 140 L440 106 L500 130 L560 104 L640 126 V220 H0 Z"
        fill="url(#pdGunungJauh)"
      />
      <g fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1">
        <path d="M128 112 L170 94 L214 120" />
        <path d="M144 120 L170 106 L198 124" />
        <path d="M410 120 L440 112 L474 126" />
        <path d="M262 116 L300 104 L340 124" />
      </g>

      {/* Bukit tengah berhutan */}
      <path
        d="M0 172 C80 142 150 150 220 136 C300 118 360 150 430 142 C500 134 570 150 640 140 V220 H0 Z"
        fill="url(#pdGunungTengah)"
      />
      <g fill="#0f3d2c">
        {POHON.map(([x, y, s]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
            <path d="M0 -15 L6 -3 L3 -3 L8 5 L-8 5 L-3 -3 L-6 -3 Z" />
            <rect x="-1" y="5" width="2" height="3" fill="#0a2a1e" />
          </g>
        ))}
      </g>

      {/* Sungai berkelok dan jalur survei menuju pin lokasi */}
      <path
        d="M96 220 C128 206 104 194 150 182 C206 168 240 178 286 162 C320 150 330 146 348 140"
        fill="none"
        stroke="url(#pdSungai)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M96 220 C128 206 104 194 150 182 C206 168 240 178 286 162 C320 150 330 146 348 140"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="1.4"
        strokeDasharray="10 14"
        strokeLinecap="round"
      />

      {/* Bukit depan */}
      <path
        d="M0 198 C90 172 170 184 250 178 C340 170 420 198 520 186 C580 180 620 188 640 184 V220 H0 Z"
        fill="url(#pdBukit)"
      />
      <path
        d="M24 214 C80 198 132 206 188 196 S300 186 392 152"
        fill="none"
        stroke="#fde68a"
        strokeWidth="2.2"
        strokeDasharray="3 5"
        strokeLinecap="round"
      />
      <g transform="translate(392 150)">
        <circle className={gerak ? "pd-denyut" : undefined} r="9" fill="#fbbf24" fillOpacity="0.55" />
        <path d="M0 0 C-7 -8 -9 -12 -9 -16 A9 9 0 1 1 9 -16 C9 -12 7 -8 0 0 Z" fill="#ef4444" stroke="#ffffff" strokeWidth="1.6" />
        <circle cx="0" cy="-16" r="3.4" fill="#ffffff" />
      </g>

      {/* Kijang di punggung bukit kanan */}
      <g transform="translate(540 176) scale(0.95)" fill="#0d2a1f">
        <ellipse cx="0" cy="0" rx="14" ry="6" />
        <path d="M-9 -3 L-15 -15 L-11 -17 L-5 -4 Z" />
        <ellipse cx="-17" cy="-17" rx="5.5" ry="3.2" />
        <path d="M-15 -20 L-13 -26 M-14 -23 L-11 -25 M-18 -20 L-21 -26 M-19.5 -23 L-23 -24" stroke="#0d2a1f" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M-15 -19 L-12 -22 L-12 -18 Z" />
        <rect x="-10" y="4" width="2" height="12" rx="1" />
        <rect x="-5" y="4" width="2" height="12" rx="1" />
        <rect x="6" y="4" width="2" height="12" rx="1" />
        <rect x="10" y="3" width="2" height="12" rx="1" />
        <path d="M13 -3 L18 -6 L15 0 Z" />
      </g>

      {/* Kompas */}
      <g transform="translate(96 62)">
        <circle r="30" fill="#0f172a" fillOpacity="0.35" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.4" />
        <circle r="24" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeDasharray="2 3" />
        <path d="M-17 0 L0 3.5 L17 0 L0 -3.5 Z" fill="#ffffff" fillOpacity="0.5" />
        <g className={gerak ? "pd-jarum" : undefined}>
          <path d="M0 -18 L4.5 0 L-4.5 0 Z" fill="#ef4444" />
          <path d="M0 18 L4.5 0 L-4.5 0 Z" fill="#f8fafc" />
        </g>
        <circle r="2.2" fill="#0f172a" stroke="#ffffff" strokeWidth="0.8" />
        <g fill="#ffffff" fontSize="8" fontWeight="700" fontFamily="system-ui, sans-serif" textAnchor="middle">
          <text y="-21" dy="-2.5">U</text>
          <text y="27" dy="0">S</text>
          <text x="25" y="3">T</text>
          <text x="-25" y="3">B</text>
        </g>
      </g>

      {/* Skala dan koordinat */}
      <g transform="translate(466 184)" fontFamily="system-ui, sans-serif" fontSize="8" fill="#ffffff">
        <rect x="0" y="0" width="30" height="4" fill="#0f172a" />
        <rect x="30" y="0" width="30" height="4" fill="#ffffff" />
        <rect x="60" y="0" width="30" height="4" fill="#0f172a" />
        <rect x="0" y="0" width="90" height="4" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <text x="0" y="13">0</text>
        <text x="60" y="13" textAnchor="middle">2</text>
        <text x="90" y="13" textAnchor="end">3 km</text>
      </g>
      <text x="70" y="196" fontFamily="system-ui, sans-serif" fontSize="8" fill="#ffffff" fillOpacity="0.85">
        0°56′ LS · 100°25′ BT
      </text>
    </svg>
  );
};
