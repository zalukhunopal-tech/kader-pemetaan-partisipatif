import React from "react";

interface LogoTitikTapakProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  withBackground?: boolean;
}

export const LogoTitikTapak: React.FC<LogoTitikTapakProps> = ({
  size = 40,
  className,
  style,
  withBackground = true
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      aria-label="Logo Titik Tapak"
    >
      <defs>
        <linearGradient id="bgTitikTapak" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#042F2E" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>

      {/* Background (rounded rect) */}
      {withBackground && (
        <rect width="512" height="512" rx="115" fill="url(#bgTitikTapak)" />
      )}

      {/* Layer 3: Chevron Base (Blue) */}
      <path d="M96 348 L256 422 L416 348 L416 374 L256 448 L96 374 Z" fill="#0284C7" />

      {/* Layer 2: Chevron Middle (Teal) */}
      <path d="M96 302 L256 376 L416 302 L416 328 L256 402 L96 328 Z" fill="#14B8A6" />

      {/* Layer 1: Full Isometric Top Platform */}
      <path d="M96 256 L256 330 L256 356 L96 282 Z" fill="#059669" />
      <path d="M416 256 L256 330 L256 356 L416 282 Z" fill="#047857" />
      <path d="M256 182 L416 256 L256 330 L96 256 Z" fill="#10B981" />

      {/* Inner Contour Diamond on Top Layer */}
      <path d="M256 206 L364 256 L256 306 L148 256 Z" fill="#047857" opacity="0.5" stroke="#6EE7B7" strokeWidth="4" />

      {/* 3D Faceted Split-Tone Pin (Left Bright, Right Deep Orange) */}
      {/* Left Half of Pin */}
      <path d="M256 256 Q216 204 195 168 A68 68 0 0 1 256 66 Z" fill="#FB923C" />
      {/* Right Half of Pin */}
      <path d="M256 256 Q296 204 317 168 A68 68 0 0 0 256 66 Z" fill="#EA580C" />
      
      {/* Center GPS Ring */}
      <circle cx="256" cy="134" r="28" fill="#0F172A" />
      <circle cx="256" cy="134" r="14" fill="#FDE047" />
    </svg>
  );
};
