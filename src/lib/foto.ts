/**
 * Kompresi foto lapangan sebelum disimpan. Foto kamera ponsel bisa 3-10 MB; disimpan apa adanya
 * sebagai data URL ia memenuhi kuota penyimpanan dan membengkakkan sinkronisasi.
 */

export const SISI_MAKS_FOTO = 1280;
export const TARGET_BYTE_FOTO = 350 * 1024;
export const BATAS_BERKAS_FOTO_BYTE = 25 * 1024 * 1024;
const KUALITAS_BERTAHAP = [0.8, 0.68, 0.55, 0.42];

export function hitungUkuranFoto(lebar: number, tinggi: number, sisiMaks = SISI_MAKS_FOTO): { lebar: number; tinggi: number } {
  if (!(lebar > 0) || !(tinggi > 0)) return { lebar: 1, tinggi: 1 };
  const skala = Math.min(1, sisiMaks / Math.max(lebar, tinggi));
  return { lebar: Math.max(1, Math.round(lebar * skala)), tinggi: Math.max(1, Math.round(tinggi * skala)) };
}

/** Ukuran biner perkiraan dari sebuah data URL base64 */
export function perkiraBytesDataUrl(dataUrl: string): number {
  const koma = dataUrl.indexOf(",");
  if (koma < 0) return 0;
  const b64 = dataUrl.slice(koma + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

interface SumberGambar {
  lebar: number;
  tinggi: number;
  gambar: CanvasImageSource;
  lepas: () => void;
}

async function bukaGambar(file: File): Promise<SumberGambar> {
  if (typeof createImageBitmap === "function") {
    try {
      // 'from-image' menghormati orientasi EXIF sehingga foto tegak tidak tersimpan miring
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { lebar: bmp.width, tinggi: bmp.height, gambar: bmp, lepas: () => bmp.close() };
    } catch {
      // jatuh ke jalur <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Format gambar tidak valid atau rusak."));
      el.src = url;
    });
    return { lebar: img.naturalWidth, tinggi: img.naturalHeight, gambar: img, lepas: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Mengecilkan foto menjadi JPEG berukuran wajar. Melempar Error berpesan Indonesia bila gagal. */
export async function kompresFoto(file: File, sisiMaks = SISI_MAKS_FOTO, targetByte = TARGET_BYTE_FOTO): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Berkas bukan gambar.");
  if (file.size > BATAS_BERKAS_FOTO_BYTE) throw new Error("Foto terlalu besar (maksimal 25 MB).");
  const sumber = await bukaGambar(file);
  try {
    let sisi = sisiMaks;
    let hasil = "";
    for (let putaran = 0; putaran < 2; putaran++) {
      const { lebar, tinggi } = hitungUkuranFoto(sumber.lebar, sumber.tinggi, sisi);
      const kanvas = document.createElement("canvas");
      kanvas.width = lebar;
      kanvas.height = tinggi;
      const ctx = kanvas.getContext("2d");
      if (!ctx) throw new Error("Browser tidak dapat memproses gambar.");
      ctx.fillStyle = "#ffffff"; // latar untuk PNG transparan
      ctx.fillRect(0, 0, lebar, tinggi);
      ctx.drawImage(sumber.gambar, 0, 0, lebar, tinggi);
      for (const kualitas of KUALITAS_BERTAHAP) {
        hasil = kanvas.toDataURL("image/jpeg", kualitas);
        if (perkiraBytesDataUrl(hasil) <= targetByte) return hasil;
      }
      sisi = Math.round(sisi * 0.7);
    }
    return hasil;
  } finally {
    sumber.lepas();
  }
}

/**
 * Mengecilkan ukuran foto yang diunggah agar ringan disimpan di localStorage
 */
export function kompresFotoKeDataUrl(file: File, maxDim = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file foto"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format gambar tidak valid"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
