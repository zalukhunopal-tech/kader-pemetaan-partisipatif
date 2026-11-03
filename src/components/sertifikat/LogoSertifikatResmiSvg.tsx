import React from "react";

export interface LogoSertifikatResmiSvgProps {
  size?: number;
  warna?: string;
  warnaAksen?: string;
  variant?: "emas" | "zamrud" | "monokrom";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Logo / Emblem Sertifikat Resmi Titik Tapak
 * Desain medali vektor presisi berlapis dengan segel sertifikasi resmi,
 * bintang kompas 8 penjuru, dan aksen pita laurel kehormatan.
 */
export const LogoSertifikatResmiSvg: React.FC<LogoSertifikatResmiSvgProps> = ({
  size = 24,
  warna,
  warnaAksen,
  variant = "zamrud",
  className = "",
  style
}) => {
  const warnaUtama =
    warna ||
    (variant === "emas"
      ? "#d97706"
      : variant === "zamrud"
        ? "#0d7344"
        : "currentColor");

  const warnaSekunder =
    warnaAksen ||
    (variant === "emas"
      ? "#fbbf24"
      : variant === "zamrud"
        ? "#10b981"
        : "#94a3b8");

  const idGrad = `grad-sertifikat-${Math.round(size)}-${variant}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`logo-sertifikat-resmi ${className}`}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={idGrad} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={warnaSekunder} />
          <stop offset="100%" stopColor={warnaUtama} />
        </linearGradient>
      </defs>

      {/* Pita Gantung Bawah (Ribbon Tails) */}
      <path
        d="M17 31L13 44L21 40L24 44L23 35"
        fill={warnaUtama}
        opacity="0.85"
      />
      <path
        d="M31 31L35 44L27 40L24 44L25 35"
        fill={warnaUtama}
        opacity="0.95"
      />

      {/* Segel Medali Utama (Gerigi Presisi Kehormatan) */}
      <circle
        cx="24"
        cy="22"
        r="17"
        fill={`url(#${idGrad})`}
        stroke="#ffffff"
        strokeWidth="1.5"
      />

      {/* Cincin Lingkar Dalam Bertitik (Official Seal Bead Ring) */}
      <circle
        cx="24"
        cy="22"
        r="13.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeDasharray="2.5 2"
        opacity="0.9"
      />

      {/* Lingkaran Pusat Medali */}
      <circle
        cx="24"
        cy="22"
        r="10"
        fill="rgba(0, 0, 0, 0.16)"
      />

      {/* Bintang Kompas 8 Penjuru / Lambang Geospasial Presisi */}
      {/* Sumbu Vertikal-Horizontal */}
      <path
        d="M24 14L26 20.5H32L27 23.5L29 30L24 26L19 30L21 23.5L16 20.5H22L24 14Z"
        fill="#ffffff"
      />

      {/* Inti Berlian Tengah */}
      <circle
        cx="24"
        cy="22"
        r="2.4"
        fill={warnaSekunder}
      />
    </svg>
  );
};
