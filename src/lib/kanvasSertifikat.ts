import { LogoSertifikatItem, PenandatanganSertifikatItem, SertifikatKader } from "../types";
import { matriksQr, payloadVerifikasi } from "./qr";
import { DEFAULT_PENANDATANGAN_SERTIFIKAT } from "./sertifikatBawaan";

/**
 * Penggambar sertifikat ke kanvas (pratinjau di layar, unduhan PNG, dan cetak memakai gambar yang sama).
 */

/**
 * Menggambar Siluet Orang bergaya WhatsApp di dalam Bingkai Passfoto Sertifikat
 * ketika kader belum mengunggah foto.
 */
function gambarSiluetWhatsAppCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Latar belakang abu-slate khas WhatsApp default profile
  ctx.fillStyle = "#6b7c85";
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;

  // Lingkaran halus di tengah seperti ikon kontak WhatsApp
  ctx.fillStyle = "#5c6d75";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.44, 0, Math.PI * 2);
  ctx.fill();

  // Kepala bulat putih-abu khas WhatsApp
  const headR = w * 0.21;
  ctx.fillStyle = "#dfe5e7";
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.11, headR, 0, Math.PI * 2);
  ctx.fill();

  // Bahu kubah mulus khas WhatsApp
  const shoulderW = w * 0.42;
  const shoulderTopY = cy + h * 0.08;
  const shoulderBottomY = y + h;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, shoulderBottomY);
  ctx.quadraticCurveTo(cx - shoulderW, shoulderTopY, cx, shoulderTopY);
  ctx.quadraticCurveTo(cx + shoulderW, shoulderTopY, cx + shoulderW, shoulderBottomY);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Menggambar Passfoto Kader di Tengah Bawah Sertifikat (dengan 4 Siku Sudut seperti Referensi)
 */
function gambarBingkaiFotoKaderCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fotoImg: HTMLImageElement | null
) {
  ctx.save();

  const pad = 6;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;

  // Bayangan lembut di belakang foto
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(ix, iy, iw, ih);
  ctx.shadowColor = "transparent";

  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();

  if (fotoImg && fotoImg.complete && fotoImg.naturalWidth > 0) {
    const imgRatio = fotoImg.naturalWidth / fotoImg.naturalHeight;
    const boxRatio = iw / ih;
    let sx = 0;
    let sy = 0;
    let sw = fotoImg.naturalWidth;
    let sh = fotoImg.naturalHeight;

    if (imgRatio > boxRatio) {
      sw = fotoImg.naturalHeight * boxRatio;
      sx = (fotoImg.naturalWidth - sw) / 2;
    } else {
      sh = fotoImg.naturalWidth / boxRatio;
      sy = (fotoImg.naturalHeight - sh) / 2;
    }
    ctx.drawImage(fotoImg, sx, sy, sw, sh, ix, iy, iw, ih);
  } else {
    gambarSiluetWhatsAppCanvas(ctx, ix, iy, iw, ih);
  }
  ctx.restore();

  // Garis tepi tipis foto
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(ix, iy, iw, ih);

  // 4 Siku Sudut Biru Navy (Corner Brackets) persis seperti pada Referensi Foto
  const cornerLen = 22;
  ctx.strokeStyle = "#1e3a8a";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "square";

  // Kiri Atas
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLen, y);
  ctx.stroke();

  // Kanan Atas
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cornerLen);
  ctx.stroke();

  // Kiri Bawah
  ctx.beginPath();
  ctx.moveTo(x, y + h - cornerLen);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + cornerLen, y + h);
  ctx.stroke();

  // Kanan Bawah
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cornerLen);
  ctx.stroke();

  ctx.restore();
}

/**
 * Menggambar Barisan Logo di dalam Header V-Chevron Biru Navy (Sesuai Referensi)
 */
function gambarDeretanLogoHeader(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  yCenter: number,
  logos: LogoSertifikatItem[],
  logoImagesMap: Record<string, HTMLImageElement>
) {
  if (!logos.length) return;
  ctx.save();

  const radius = 37;
  const gap = 26;
  const totalW = logos.length * (radius * 2) + (logos.length - 1) * gap;
  const startX = centerX - totalW / 2 + radius;

  const paletWarna = ["#eab308", "#f8fafc", "#16a34a", "#06b6d4", "#f97316"];

  logos.forEach((logo, idx) => {
    const cx = startX + idx * (radius * 2 + gap);
    const cy = yCenter;
    const warna = logo.warnaAksen || paletWarna[idx % paletWarna.length];
    const img = logoImagesMap[logo.id];

    // Lingkaran luar emblem
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = warna;
    ctx.stroke();
    ctx.restore();

    if (img && img.complete && img.naturalWidth > 0) {
      // Gambar logo yang diunggah user
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - (radius - 4), cy - (radius - 4), (radius - 4) * 2, (radius - 4) * 2);
      ctx.restore();
    } else {
      // Emblem vektor organisasi otomatis jika belum unggah gambar
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 5, 0, Math.PI * 2);
      ctx.fillStyle = idx % 2 === 0 ? "#0f172a" : "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = warna;
      ctx.stroke();

      // Ornamen bintang/kompas kecil di tengah logo
      ctx.fillStyle = warna;
      ctx.beginPath();
      ctx.arc(cx, cy - 3, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = idx % 2 === 0 ? "#0f172a" : "#ffffff";
      ctx.font = "900 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      const inisial = (logo.nama || "GIS")
        .split(/\s+/)
        .map((k) => k[0] || "")
        .join("")
        .slice(0, 3)
        .toUpperCase();
      ctx.fillText(inisial, cx, cy);

      // Teks nama pendek di bagian bawah lingkaran logo
      ctx.fillStyle = idx % 2 === 0 ? "#fde68a" : "#1e293b";
      ctx.font = "bold 7.5px system-ui, sans-serif";
      ctx.fillText((logo.nama || " MITRA ").slice(0, 12).toUpperCase(), cx, cy + 18);
      ctx.restore();
    }
  });

  ctx.restore();
}

/**
 * Menggambar QR Code Verifikasi di Sisi Kanan Sertifikat. QR sungguhan yang bisa dipindai;
 * area putih di sekelilingnya (4 modul) adalah zona tenang yang dibutuhkan pemindai.
 */
function gambarQrCodeVerifikasi(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, payload: string) {
  const matriks = matriksQr(payload);
  const n = matriks.length;
  const sel = size / n;
  const zonaTenang = sel * 4;

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - zonaTenang, y - zonaTenang, size + 2 * zonaTenang, size + 2 * zonaTenang);
  ctx.strokeRect(x - zonaTenang, y - zonaTenang, size + 2 * zonaTenang, size + 2 * zonaTenang);

  ctx.fillStyle = "#000000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matriks[r][c]) {
        ctx.fillRect(x + c * sel, y + r * sel, sel + 0.5, sel + 0.5);
      }
    }
  }
  ctx.restore();
}

/**
 * Menggambar Blok Penandatangan (Jabatan, Instansi, Stempel + Tanda Tangan, Nama)
 * seperti pada Referensi Sertifikat
 */
function gambarSatuBlokPenandatangan(
  ctx: CanvasRenderingContext2D,
  cx: number,
  yTop: number,
  item: PenandatanganSertifikatItem,
  idx: number,
  ttdImg?: HTMLImageElement
) {
  ctx.save();
  ctx.textAlign = "center";

  // 1. Jabatan & Instansi di atas
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
  ctx.fillText(item.jabatan || "Pejabat Penandatangan", cx, yTop);

  ctx.fillStyle = "#334155";
  ctx.font = "600 16px system-ui, -apple-system, sans-serif";
  ctx.fillText(item.instansi || "", cx, yTop + 23);

  // 2. Stempel Resmi Melingkar di Kiri-Tengah Blok
  const stampX = cx - 34;
  const stampY = yTop + 76;
  ctx.save();
  ctx.translate(stampX, stampY);
  ctx.rotate(-0.14 + idx * 0.05);
  ctx.strokeStyle = "rgba(67, 56, 202, 0.58)";
  ctx.fillStyle = "rgba(67, 56, 202, 0.58)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 41, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.stroke();

  const labelStempel = (item.instansi || "VERIFIKASI SPASIAL").toUpperCase().slice(0, 22);
  ctx.font = "bold 7.5px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`★ ${labelStempel} ★`, 0, -24);
  ctx.fillText("TERVERIFIKASI RESMI", 0, 29);
  ctx.font = "900 8.5px system-ui, sans-serif";
  ctx.fillText("GEOKADER", 0, 3);
  ctx.restore();

  // 3. Tanda Tangan (Gambar Unggahan atau Garis Penandatangan Fisik)
  if (ttdImg && ttdImg.complete && ttdImg.naturalWidth > 0) {
    const maxW = 160;
    const maxH = 82;
    const scale = Math.min(maxW / ttdImg.naturalWidth, maxH / ttdImg.naturalHeight);
    const dw = ttdImg.naturalWidth * scale;
    const dh = ttdImg.naturalHeight * scale;
    ctx.drawImage(ttdImg, cx - dw / 2, yTop + 34 + (maxH - dh) / 2, dw, dh);
  } else {
    // Garis penandatangan fisik resmi jika belum ada tanda tangan digital yang diunggah
    ctx.save();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - 65, yTop + 96);
    ctx.lineTo(cx + 65, yTop + 96);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Nama Lengkap & Gelar Penandatangan di Bawah
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 17.5px system-ui, -apple-system, sans-serif";
  ctx.fillText(item.nama || "Pejabat Verifikasi", cx, yTop + 142);

  ctx.restore();
}

/**
 * Format Tanggal Indonesia (mis. 2026-10-28 -> 28 Oktober 2026)
 */
function formatTanggalSertifikatIndo(isoDate: string): string {
  const bulanIndo = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ];
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    const thn = parts[0];
    const blnIdx = parseInt(parts[1], 10) - 1;
    const tgl = parseInt(parts[2], 10);
    if (!isNaN(blnIdx) && blnIdx >= 0 && blnIdx < 12 && !isNaN(tgl)) {
      return `${tgl} ${bulanIndo[blnIdx]} ${thn}`;
    }
  }
  return isoDate;
}

/**
 * Merender Sertifikat ke Canvas (1600 x 1131 px - A4 Landscape)
 * Mengacu langsung pada Gambar Referensi Sertifikat Baru:
 * - Header V-Chevron Biru Navy Tua + Pita Emas Metalik + Sayap Perak
 * - Deretan Logo di dalam V-Chevron (bisa diatur/ditambah)
 * - Teks bebas redundansi kata
 * - QR Code di sisi kanan
 * - Passfoto 3x4 di tengah bawah (dengan siluet WhatsApp jika belum ada foto)
 * - Barisan Penandatangan di sisi kiri & kanan foto (bisa diatur/ditambah)
 */
export function lukisSertifikatKeCanvas(
  canvas: HTMLCanvasElement,
  sert: SertifikatKader,
  fotoImg: HTMLImageElement | null,
  logoImagesMap: Record<string, HTMLImageElement>,
  ttdImagesMap: Record<string, HTMLImageElement>
) {
  const W = 1600;
  const H = 1131;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  // 1. Margin Luar Abu-Perak Halus (seperti bingkai luar pada gambar referensi)
  const outerGrad = ctx.createLinearGradient(0, 0, W, H);
  outerGrad.addColorStop(0, "#cbd5e1");
  outerGrad.addColorStop(0.5, "#e2e8f0");
  outerGrad.addColorStop(1, "#cbd5e1");
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, W, H);

  const margin = 30;
  const innerX = margin;
  const innerY = margin;
  const innerW = W - margin * 2;
  const innerH = H - margin * 2;

  // 2. Latar Dalam Putih-Perak Bersih
  const bodyGrad = ctx.createLinearGradient(0, innerY + 200, 0, H - margin);
  bodyGrad.addColorStop(0, "#e5eaf0");
  bodyGrad.addColorStop(0.32, "#f8fafc");
  bodyGrad.addColorStop(1, "#ffffff");
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(innerX, innerY, innerW, innerH);

  // 3. Sayap Segitiga Abu-Perak di Kiri & Kanan Bawah Header (sesuai referensi)
  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();

  ctx.fillStyle = "#cfd8e3";
  ctx.beginPath();
  ctx.moveTo(innerX, innerY + 150);
  ctx.lineTo(W / 2, innerY + 318);
  ctx.lineTo(innerX, innerY + 465);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(innerX + innerW, innerY + 150);
  ctx.lineTo(W / 2, innerY + 318);
  ctx.lineTo(innerX + innerW, innerY + 465);
  ctx.closePath();
  ctx.fill();

  // 4. Pita V-Chevron Emas Metalik di Bawah Header Biru
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  const goldRibbonGrad = ctx.createLinearGradient(innerX, 0, innerX + innerW, 0);
  goldRibbonGrad.addColorStop(0, "#c8a95b");
  goldRibbonGrad.addColorStop(0.3, "#e5ca82");
  goldRibbonGrad.addColorStop(0.5, "#b38e3d");
  goldRibbonGrad.addColorStop(0.7, "#e5ca82");
  goldRibbonGrad.addColorStop(1, "#c09e4e");
  ctx.fillStyle = goldRibbonGrad;
  ctx.beginPath();
  ctx.moveTo(innerX, innerY + 146);
  ctx.lineTo(W / 2, innerY + 324);
  ctx.lineTo(innerX + innerW, innerY + 146);
  ctx.lineTo(innerX + innerW, innerY + 184);
  ctx.lineTo(W / 2, innerY + 344);
  ctx.lineTo(innerX, innerY + 184);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 5. Header V-Chevron Biru Navy Tua (Royal Navy Blue seperti referensi)
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;

  const navyGrad = ctx.createLinearGradient(0, innerY, 0, innerY + 324);
  navyGrad.addColorStop(0, "#003f7a");
  navyGrad.addColorStop(0.55, "#002855");
  navyGrad.addColorStop(1, "#001433");
  ctx.fillStyle = navyGrad;
  ctx.beginPath();
  ctx.moveTo(innerX, innerY);
  ctx.lineTo(innerX + innerW, innerY);
  ctx.lineTo(innerX + innerW, innerY + 150);
  ctx.lineTo(W / 2, innerY + 320);
  ctx.lineTo(innerX, innerY + 150);
  ctx.closePath();
  ctx.fill();

  // Aksen lipatan biru gelap di sisi kiri & kanan bawah header navy
  ctx.fillStyle = "rgba(0, 12, 34, 0.55)";
  ctx.beginPath();
  ctx.moveTo(innerX, innerY + 112);
  ctx.lineTo(W / 2, innerY + 320);
  ctx.lineTo(innerX, innerY + 150);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(innerX + innerW, innerY + 112);
  ctx.lineTo(W / 2, innerY + 320);
  ctx.lineTo(innerX + innerW, innerY + 150);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore(); // end clip inner rect

  // 6. Garis Bingkai Emas Metalik Mengelilingi Sertifikat
  ctx.strokeStyle = "#bfa054";
  ctx.lineWidth = 4;
  ctx.strokeRect(innerX, innerY, innerW, innerH);

  // 7. Judul Utama 2 Baris di dalam Header Navy (Bebas Redundansi Kata)
  const centerX = W / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#e2e8f0";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  ctx.font = "400 44px Georgia, 'Times New Roman', serif";
  ctx.fillText("S E R T I F I K A T   P E N G H A R G A A N", centerX, innerY + 76);

  ctx.font = "400 46px Georgia, 'Times New Roman', serif";
  ctx.fillText("P E M E T A A N   W I L A Y A H   P A R T I S I P A T I F", centerX, innerY + 136);
  ctx.restore();

  // 8. Barisan Logo di dalam Bagian Bawah V-Chevron Biru Navy
  // Hanya digambar jika logo sudah dimasukkan/diunggah berkas gambarnya oleh admin
  const logosDenganGambar = (sert.logoSertifikatList || []).filter((l) => Boolean(l.imageBase64));
  if (logosDenganGambar.length > 0) {
    gambarDeretanLogoHeader(ctx, centerX, innerY + 216, logosDenganGambar, logoImagesMap);
  }

  // 9. Teks "Diberikan Kepada"
  ctx.textAlign = "center";
  ctx.fillStyle = "#111827";
  ctx.font = "italic bold 27px Georgia, 'Times New Roman', serif";
  ctx.fillText("D i b e r i k a n   K e p a d a", centerX, 430);

  // 10. Nama Penerima + Garis Bawah Emas-Zaitun + Nomor Sertifikat di Bawah Garis
  const namaBersih = (sert.namaKader || "Kader Spasial").replace(/\s*\(Kader Lapangan\)/i, "");
  let fontNama = 46;
  ctx.font = `bold ${fontNama}px Georgia, 'Times New Roman', serif`;
  while (ctx.measureText(namaBersih).width > 960 && fontNama > 28) {
    fontNama -= 2;
    ctx.font = `bold ${fontNama}px Georgia, 'Times New Roman', serif`;
  }
  ctx.fillStyle = "#111827";
  ctx.fillText(namaBersih, centerX, 518);

  const wLine = Math.min(980, Math.max(580, ctx.measureText(namaBersih).width + 130));
  ctx.strokeStyle = "#8c783c";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(centerX - wLine / 2, 534);
  ctx.lineTo(centerX + wLine / 2, 534);
  ctx.stroke();

  // Nomor Sertifikat tepat di bawah garis nama (seperti referensi)
  ctx.fillStyle = "#0f172a";
  ctx.font = "italic bold 22px Georgia, 'Times New Roman', serif";
  ctx.fillText(`Nomor: ${sert.nomorSertifikat}`, centerX, 568);

  // 11. Deskripsi Peran & Tema Kegiatan (Dapat Diubah oleh Admin)
  const peranTeks = "Sebagai Kader Desa";
  const temaRaw = sert.temaKegiatanSertifikat?.trim() || "Inventarisasi dan Verifikasi Data Geospasial Wilayah Desa Rimba Hijau";

  const temaKegiatan = temaRaw.startsWith('"') && temaRaw.endsWith('"') ? temaRaw : `"${temaRaw}"`;

  ctx.fillStyle = "#111827";
  ctx.font = "600 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(peranTeks, centerX, 636);

  // Ukuran font adaptif untuk tema kegiatan agar tidak pernah overflow
  let fontTema = 28;
  ctx.font = `500 ${fontTema}px system-ui, -apple-system, sans-serif`;
  const maxW = 1250;
  while (ctx.measureText(temaKegiatan).width > maxW && fontTema > 14) {
    fontTema -= 1;
    ctx.font = `500 ${fontTema}px system-ui, -apple-system, sans-serif`;
  }
  ctx.fillText(temaKegiatan, centerX, 678);

  ctx.font = "500 24px system-ui, -apple-system, sans-serif";
  ctx.fillText(formatTanggalSertifikatIndo(sert.tanggalTerbit), centerX, 742);

  // 12. QR Code Verifikasi di Sisi Kanan (Hanya dibuat jika logo ATAU tanda tangan sudah dimasukkan)
  const adaLogoDimasukkan = (sert.logoSertifikatList || []).some((l) => Boolean(l.imageBase64));
  const adaTtdDimasukkan = (sert.penandatanganList || []).some((p) => Boolean(p.tandaTanganBase64));
  const tampilkanBarcode = adaLogoDimasukkan || adaTtdDimasukkan;

  if (tampilkanBarcode) {
    gambarQrCodeVerifikasi(ctx, W - 235, 545, 132, payloadVerifikasi(sert));
  }

  // 13. Passfoto 3x4 di Tengah Bawah (atau Siluet WhatsApp jika belum ada foto)
  const photoW = 136;
  const photoH = 182;
  const photoX = centerX - photoW / 2;
  const photoY = 826;
  gambarBingkaiFotoKaderCanvas(ctx, photoX, photoY, photoW, photoH, fotoImg);

  // 14. Barisan Penandatangan di Kiri & Kanan Passfoto
  const signers = sert.penandatanganList && sert.penandatanganList.length > 0 ? sert.penandatanganList : DEFAULT_PENANDATANGAN_SERTIFIKAT;

  const ySignTop = 852;
  const leftCount = Math.ceil(signers.length / 2);
  const leftSigners = signers.slice(0, leftCount);
  const rightSigners = signers.slice(leftCount);

  // Area kiri: antara x = 75 s/d photoX - 30
  const leftAreaStart = 75;
  const leftAreaEnd = photoX - 25;
  const leftAreaW = leftAreaEnd - leftAreaStart;

  leftSigners.forEach((sig, i) => {
    const cx = leftAreaStart + ((i + 0.5) / Math.max(1, leftSigners.length)) * leftAreaW;
    gambarSatuBlokPenandatangan(ctx, cx, ySignTop, sig, i, ttdImagesMap[sig.id]);
  });

  // Area kanan: antara photoX + photoW + 25 s/d W - 75
  const rightAreaStart = photoX + photoW + 25;
  const rightAreaEnd = W - 75;
  const rightAreaW = rightAreaEnd - rightAreaStart;

  rightSigners.forEach((sig, i) => {
    const cx = rightAreaStart + ((i + 0.5) / Math.max(1, rightSigners.length)) * rightAreaW;
    gambarSatuBlokPenandatangan(ctx, cx, ySignTop, sig, i + leftCount, ttdImagesMap[sig.id]);
  });

  // Pratinjau: sertifikat yang belum diterbitkan admin diberi tanda air agar tidak dipakai sebagai dokumen resmi
  if (sert.status !== "diterbitkan") {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 9);
    ctx.fillStyle = "rgba(185, 28, 28, 0.16)";
    ctx.font = "800 150px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PRATINJAU", 0, -30);
    ctx.font = "700 54px system-ui, -apple-system, sans-serif";
    ctx.fillText("BELUM DITERBITKAN ADMIN", 0, 90);
    ctx.restore();
  }
}
