import React from "react";

/**
 * Wallpaper kartu "Buka peta dasar": lembah hutan tropis saat fajar dengan sungai, jalur survei, pin
 * lokasi, rangkong, kompas, dan satelit. Disajikan dalam beberapa ukuran WebP (HP mengunduh yang
 * kecil) dengan JPEG cadangan untuk browser lama.
 */
const DASAR = import.meta.env.BASE_URL;

export const LatarPetaDasar: React.FC = () => (
  <picture>
    <source
      type="image/webp"
      srcSet={`${DASAR}latar-peta-dasar-640.webp 640w, ${DASAR}latar-peta-dasar-1024.webp 1024w, ${DASAR}latar-peta-dasar-1600.webp 1600w`}
      sizes="(min-width: 960px) 928px, (min-width: 640px) 608px, calc(100vw - 32px)"
    />
    <img
      className="avenza-basemap-svg latar-peta-dasar-img"
      src={`${DASAR}latar-peta-dasar-1024.jpg`}
      alt=""
      width={1024}
      height={434}
      decoding="async"
      draggable={false}
    />
  </picture>
);
