import qrcode from "qrcode-generator";

/**
 * KODE QR SERTIFIKAT
 * QR sungguhan (bisa dipindai) yang memuat data sertifikat. Bila VITE_URL_VERIFIKASI diisi,
 * isinya berupa tautan ke halaman verifikasi organisasi; selain itu berupa teks
 * "GEOKADER|nomor|idKader|tanggal" yang dapat dicocokkan dengan daftar sertifikat admin.
 * Awalan GEOKADER (nama lama aplikasi) sengaja dipertahankan agar QR sertifikat yang sudah
 * terbit tetap dikenali.
 */

export interface DataQrSertifikat {
  nomorSertifikat: string;
  idKader: string;
  tanggalTerbit: string;
}

export function payloadVerifikasi(s: DataQrSertifikat, urlVerifikasi: string | undefined = import.meta.env.VITE_URL_VERIFIKASI): string {
  const dasar = (urlVerifikasi ?? "").trim();
  if (dasar) {
    const sambung = dasar.includes("?") ? "&" : "?";
    return `${dasar}${sambung}no=${encodeURIComponent(s.nomorSertifikat)}&id=${encodeURIComponent(s.idKader)}`;
  }
  return `GEOKADER|${s.nomorSertifikat}|${s.idKader}|${s.tanggalTerbit}`;
}

/** Matriks modul QR (true = gelap) dengan koreksi galat tingkat M */
export function matriksQr(payload: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
