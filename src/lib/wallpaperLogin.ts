import { useState, useEffect } from "react";

export interface WallpaperItem {
  nomor: number;
  nama: string;
  driveId: string;
}

/**
 * 21 Gambar Wallpaper dari Folder Google Drive Resmi:
 * https://drive.google.com/drive/folders/1fN3N1xsM58ivl0Wx7OJDvJ2aNDa5rK20
 */
export const DAFTAR_WALLPAPER_LOGIN: WallpaperItem[] = [
  { nomor: 1, nama: "1.jpg", driveId: "1nzElG3jqZKSdIKmOJ2Jr8pZ45skhMxHI" },
  { nomor: 2, nama: "2.jpg", driveId: "1bEAqgie7taKfAshyOD8W0aEemS_gpQcV" },
  { nomor: 3, nama: "3.jpg", driveId: "1MkvMrANr4hFiEtcyH-wwJzdLR5F0M2S0" },
  { nomor: 4, nama: "4.jpg", driveId: "1WUi4G_ofBsG1yJv5P6h4Oazy1lHLvnWI" },
  { nomor: 5, nama: "5.jpg", driveId: "1llGiEJSykJ8I11rYfAY0KpeNkNtCsDMD" },
  { nomor: 6, nama: "6.jpg", driveId: "1SkKD0voAmAqYroeuC2Yxjbyyg9h4tn5h" },
  { nomor: 7, nama: "7.jpg", driveId: "16P65cdT8IFLW8X3HnWp86Pa2vk6TNf8T" },
  { nomor: 8, nama: "8.jpg", driveId: "1YxXAMbwccpSPTf9WSoWiNZ-jTDV16NMb" },
  { nomor: 9, nama: "9.jpg", driveId: "1BDkGwTncXSL_4WhLHR0ZAQzO5QNeRhvF" },
  { nomor: 10, nama: "10.jpg", driveId: "1CJzvnoHF1oQGg1bI190WJ1Bp-09UUMZY" },
  { nomor: 11, nama: "11.jpg", driveId: "1_MFj9mXipRCiFEQpLjSQtKJ2hwQINw4e" },
  { nomor: 12, nama: "12.jpg", driveId: "1uJ2AqtApa-jeWnf0RD3Fh1eiYaI-3Xs-" },
  { nomor: 13, nama: "13.jpg", driveId: "1WuF92VRzwrH3jBBPEg717gfhA-_IE4ZK" },
  { nomor: 14, nama: "14.jpg", driveId: "1j225U5ipJH3VLhbhcku0KfsPQoXRaepE" },
  { nomor: 15, nama: "15.jpg", driveId: "1GZbuDG7wVmnK7c6H09CsM3eOFRBUzD7C" },
  { nomor: 16, nama: "16.jpg", driveId: "12A5obSl-dhHwzzNX33GevpZggcRsNsuj" },
  { nomor: 17, nama: "17.jpg", driveId: "12XNzM3IG0J-e6aJFDYKlJKUFdpCBhpf5" },
  { nomor: 18, nama: "18.jpg", driveId: "1RIO7XBkZyT1t7NHNEUeOZ_YhxvIoQStl" },
  { nomor: 19, nama: "19.jpg", driveId: "1QrEMiFWXVm4uIZ-07iNWj5nF5yF9EUmH" },
  { nomor: 20, nama: "20.jpg", driveId: "1-zUKEZUDI3EKbiY7KXFk1ZJ1MvOwk1AQ" },
  { nomor: 21, nama: "21.jpg", driveId: "1vFi00rhbEbEpiti9q3ubWYhL1NjHghcB" }
];

/**
 * Menghitung indeks foto wallpaper berdasarkan hari berjalan (berganti setiap hari).
 */
export function hitungIndeksHari(tanggal: Date = new Date()): number {
  const thn = tanggal.getFullYear();
  const awal = new Date(thn, 0, 1).getTime();
  const sekarang = new Date(thn, tanggal.getMonth(), tanggal.getDate()).getTime();
  const hariKe = Math.floor((sekarang - awal) / (1000 * 60 * 60 * 24));
  return Math.abs(hariKe) % DAFTAR_WALLPAPER_LOGIN.length;
}

/**
 * Mendapatkan URL CDN gambar Google yang teroptimasi, ringan, dan cepat dimuat.
 */
export function dapatkanUrlWallpaperHarian(tanggal: Date = new Date(), lebar = 800): string {
  const idx = hitungIndeksHari(tanggal);
  const item = DAFTAR_WALLPAPER_LOGIN[idx];
  return `https://lh3.googleusercontent.com/d/${item.driveId}=w${lebar}`;
}

/**
 * Hook untuk memuat wallpaper harian secara aman & efisien:
 * - Hanya memuat saat perangkat online (saat offline otomatis kembali ke default).
 * - Melakukan preload di latar belakang agar tidak ada layout shift atau tampilan rusak.
 * - Bila terjadi galat jaringan, tetap aman dan fallback ke tema default.
 */
function sedangOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function useWallpaperLoginHarian(): {
  urlGambar: string | null;
  sedangMemuat: boolean;
  itemHariIni: WallpaperItem;
} {
  const [urlGambar, setUrlGambar] = useState<string | null>(null);
  const [sedangMemuat, setSedangMemuat] = useState<boolean>(() => sedangOnline());

  const idxHariIni = hitungIndeksHari();
  const itemHariIni = DAFTAR_WALLPAPER_LOGIN[idxHariIni];

  useEffect(() => {
    if (!sedangOnline()) return;

    let aktif = true;
    const urlCdn = dapatkanUrlWallpaperHarian(new Date(), 900);

    const img = new Image();
    img.src = urlCdn;
    img.onload = () => {
      if (aktif) {
        setUrlGambar(urlCdn);
        setSedangMemuat(false);
      }
    };
    img.onerror = () => {
      if (aktif) {
        setUrlGambar(null);
        setSedangMemuat(false);
      }
    };

    return () => {
      aktif = false;
    };
  }, [itemHariIni.driveId]);

  return { urlGambar, sedangMemuat, itemHariIni };
}
