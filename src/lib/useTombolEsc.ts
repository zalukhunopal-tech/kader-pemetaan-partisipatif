import { useEffect, useRef } from "react";

/** Menutup panel, menu, atau halaman tambahan dengan tombol Esc (berguna di PC dan keyboard tablet). */
export function useTombolEsc(aktif: boolean, tutup: () => void): void {
  const tutupRef = useRef(tutup);
  useEffect(() => {
    tutupRef.current = tutup;
  }, [tutup]);
  useEffect(() => {
    if (!aktif) return;
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      tutupRef.current();
    };
    window.addEventListener("keydown", saatTombol);
    return () => window.removeEventListener("keydown", saatTombol);
  }, [aktif]);
}
