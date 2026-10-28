import { useEffect, useState } from "react";

export interface SumberGambar {
  id: string;
  /** data URL atau URL gambar; kosong = tidak dimuat */
  src?: string;
}

const KOSONG: Record<string, HTMLImageElement> = Object.freeze({}) as Record<string, HTMLImageElement>;

/**
 * Memuat sekumpulan gambar menjadi HTMLImageElement (untuk digambar di kanvas), dikunci per id.
 * Hasil baru dipasang setelah semua gambar selesai dimuat (yang gagal dilewati); selama gambar baru
 * dimuat, hasil sebelumnya tetap dipakai. Tanpa sumber, hasilnya objek kosong yang stabil.
 */
export function useMuatGambar(sumber: SumberGambar[]): Record<string, HTMLImageElement> {
  const ada = sumber.filter((s): s is Required<SumberGambar> => Boolean(s.src));
  const kunci = ada.map((s) => `${s.id}\u0000${s.src}`).join("\u0001");
  const [hasil, setHasil] = useState<Record<string, HTMLImageElement>>(KOSONG);

  useEffect(() => {
    if (!kunci) return;
    let aktif = true;
    const peta: Record<string, HTMLImageElement> = {};
    let selesai = 0;
    const daftar = kunci.split("\u0001").map((bagian) => {
      const [id, src] = bagian.split("\u0000");
      return { id, src };
    });
    const satuSelesai = () => {
      selesai++;
      if (aktif && selesai === daftar.length) setHasil({ ...peta });
    };
    daftar.forEach(({ id, src }) => {
      const img = new Image();
      img.onload = () => {
        peta[id] = img;
        satuSelesai();
      };
      img.onerror = satuSelesai;
      img.src = src;
    });
    return () => {
      aktif = false;
    };
  }, [kunci]);

  return kunci ? hasil : KOSONG;
}
