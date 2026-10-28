import React, { useMemo } from "react";
import { matriksQr } from "../lib/qr";

interface KodeQrSvgProps {
  isi: string;
  ukuran?: number;
  label?: string;
}

/** QR sungguhan sebagai SVG (kontras tinggi, zona tenang 4 modul) agar terbaca aplikasi Authenticator */
export const KodeQrSvg: React.FC<KodeQrSvgProps> = ({ isi, ukuran = 208, label = "Kode QR" }) => {
  const { n, jalur } = useMemo(() => {
    const m = matriksQr(isi);
    const jumlah = m.length;
    let d = "";
    for (let r = 0; r < jumlah; r++) {
      let c = 0;
      while (c < jumlah) {
        if (!m[r][c]) {
          c++;
          continue;
        }
        const mulai = c;
        while (c < jumlah && m[r][c]) c++;
        d += `M${mulai + 4} ${r + 4}h${c - mulai}v1h-${c - mulai}z`;
      }
    }
    return { n: jumlah, jalur: d };
  }, [isi]);
  const total = n + 8;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      width={ukuran}
      height={ukuran}
      shapeRendering="crispEdges"
      style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #cbd5e1", maxWidth: "100%", height: "auto" }}
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={jalur} fill="#000000" />
    </svg>
  );
};
