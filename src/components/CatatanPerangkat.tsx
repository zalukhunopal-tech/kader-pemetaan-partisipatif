import React from "react";
import { Smartphone } from "lucide-react";

interface CatatanPerangkatProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Penanda jujur untuk fitur yang hanya bekerja di satu perangkat: aplikasi belum punya server
 * yang menyatukan data antarperangkat, sehingga pengguna perlu tahu apa yang (belum) sampai ke orang lain.
 */
export const CatatanPerangkat: React.FC<CatatanPerangkatProps> = ({ children, style }) => (
  <div
    role="note"
    className="catatan-perangkat"
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      color: "#1e40af",
      borderRadius: 10,
      padding: "8px 12px",
      fontSize: "0.76rem",
      lineHeight: 1.45,
      ...style
    }}
  >
    <Smartphone size={15} style={{ flexShrink: 0, marginTop: 1 }} />
    <div>{children}</div>
  </div>
);
