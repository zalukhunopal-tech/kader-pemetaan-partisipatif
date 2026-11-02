import { KonfigurasiHok, DataSpasialItem, RincianHokHarian, SesiPatroliHok } from "../types";
import { hitungSkorKualitasData } from "./kualitasData";
import { sanitasiFormulaCsv } from "./geoUtils";

/** Contoh rumus, bukan kebijakan pembayaran. Program harus menetapkan bobotnya sendiri. */
export const KONFIGURASI_HOK_CONTOH: KonfigurasiHok = {
  idProgram: "contoh",
  versi: "1",
  zonaWaktu: "Asia/Jakarta",
  jamPerHok: 8,
  bobotJam: 1,
  hokPerKmMedanBerat: 0,
  bonusTitikGradeA: 0,
  batasHokPerHari: 1
};

export function hitungBukuHok(data: DataSpasialItem[], sesi: SesiPatroliHok[], config: KonfigurasiHok): RincianHokHarian[] {
  if (
    !config.idProgram.trim() ||
    !config.versi.trim() ||
    !Number.isFinite(config.jamPerHok) ||
    config.jamPerHok <= 0 ||
    [config.bobotJam, config.hokPerKmMedanBerat, config.bonusTitikGradeA, config.batasHokPerHari].some((v) => !Number.isFinite(v) || v < 0)
  )
    throw new Error("Rumus HOK tidak valid.");
  const tanggalFmt = new Intl.DateTimeFormat("en-CA", { timeZone: config.zonaWaktu, year: "numeric", month: "2-digit", day: "2-digit" });
  const tanggal = (ms: number) => tanggalFmt.format(new Date(ms));
  const buku = new Map<string, RincianHokHarian>();
  const baris = (idKader: string, t: string) => {
    const key = JSON.stringify([idKader, t]);
    let b = buku.get(key);
    if (!b) {
      b = {
        tanggal: t,
        idKader,
        idProgram: config.idProgram,
        versiRumus: config.versi,
        menitEfektif: 0,
        kmMedanBerat: 0,
        titikGradeA: 0,
        hokJam: 0,
        hokJarak: 0,
        hokBonus: 0,
        hokSebelumBatas: 0,
        totalHok: 0,
        sumberId: []
      };
      buku.set(key, b);
    }
    return b;
  };
  const idSesi = new Set<string>(),
    interval = new Map<string, [number, number][]>();
  for (const s of sesi) {
    if (!s.terverifikasi || s.simulasi) continue;
    const awal = Date.parse(s.mulai),
      akhir = Date.parse(s.selesai);
    if (!Number.isFinite(awal) || !Number.isFinite(akhir) || akhir <= awal || !Number.isFinite(s.kmMedanBerat) || s.kmMedanBerat < 0)
      throw new Error("Sesi patroli tidak valid: " + s.id);
    if (idSesi.has(s.id)) throw new Error("ID sesi patroli ganda: " + s.id);
    idSesi.add(s.id);
    const lama = interval.get(s.idKader) ?? [];
    if (lama.some(([a, b]) => awal < b && akhir > a)) throw new Error("Sesi patroli tumpang tindih: " + s.id);
    lama.push([awal, akhir]);
    interval.set(s.idKader, lama);
    // Temukan pergantian tanggal setempat; mendukung DST dan tidak memakai jam browser.
    let saat = awal;
    while (saat < akhir) {
      const hari = tanggal(saat);
      let ujung = Math.min(akhir, saat + 3_600_000);
      if (tanggal(ujung - 1) !== hari) {
        let lo = saat,
          hi = ujung;
        while (hi - lo > 1) {
          const m = Math.floor((lo + hi) / 2);
          if (tanggal(m) === hari) lo = m;
          else hi = m;
        }
        ujung = hi;
      }
      const b = baris(s.idKader, hari),
        fraksi = (ujung - saat) / (akhir - awal);
      b.menitEfektif += (ujung - saat) / 60_000;
      b.kmMedanBerat += s.kmMedanBerat * fraksi;
      if (!b.sumberId.includes(s.id)) b.sumberId.push(s.id);
      saat = ujung;
    }
  }
  const idData = new Set<string>();
  for (const d of data) {
    if (
      d.statusSinkron !== "terverifikasi" ||
      d.koordinat.some((p) => p.simulasi) ||
      d.jenisGeometri !== "point" ||
      hitungSkorKualitasData(d).grade !== "A"
    )
      continue;
    if (idData.has(d.id)) throw new Error("ID data ganda: " + d.id);
    idData.add(d.id);
    const ms = Date.parse(d.createdAt);
    if (!Number.isFinite(ms)) throw new Error("Tanggal data tidak valid: " + d.id);
    const b = baris(d.idKader, tanggal(ms));
    b.titikGradeA++;
    b.sumberId.push(d.id);
  }
  return [...buku.values()]
    .map((b) => {
      b.hokJam = (b.menitEfektif / 60 / config.jamPerHok) * config.bobotJam;
      b.hokJarak = b.kmMedanBerat * config.hokPerKmMedanBerat;
      b.hokBonus = b.titikGradeA * config.bonusTitikGradeA;
      b.hokSebelumBatas = b.hokJam + b.hokJarak + b.hokBonus;
      b.totalHok = Math.min(config.batasHokPerHari, b.hokSebelumBatas);
      return b;
    })
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.idKader.localeCompare(b.idKader));
}

export function eksporHokCSV(buku: RincianHokHarian[]): string {
  const kolom: (keyof RincianHokHarian)[] = [
    "tanggal",
    "idKader",
    "idProgram",
    "versiRumus",
    "menitEfektif",
    "kmMedanBerat",
    "titikGradeA",
    "hokJam",
    "hokJarak",
    "hokBonus",
    "hokSebelumBatas",
    "totalHok",
    "sumberId"
  ];
  const sel = (v: unknown) => '"' + sanitasiFormulaCsv(Array.isArray(v) ? v.join("; ") : String(v)).replace(/"/g, '""') + '"';
  return [kolom.map(sel).join(","), ...buku.map((b) => kolom.map((k) => sel(b[k])).join(","))].join("\r\n");
}

export async function eksporHokPDF(buku: RincianHokHarian[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([842, 595]),
    y = 565;
  const tulis = (teks: string) => {
    if (y < 35) {
      page = pdf.addPage([842, 595]);
      y = 565;
    }
    // Font standar PDF terbatas WinAnsi. Escape karakter lain agar ekspor tidak gagal.
    const aman = Array.from(teks)
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
    const baris = aman.match(/.{1,135}/g) ?? [""];
    for (const b of baris) {
      if (y < 35) {
        page = pdf.addPage([842, 595]);
        y = 565;
      }
      page.drawText(b, { x: 30, y, size: 9, font });
      y -= 14;
    }
  };
  tulis("Buku HOK - hanya sesi dan data terverifikasi");
  for (const b of buku) {
    tulis(`${b.tanggal} | ${b.idKader} | Program ${b.idProgram} | Rumus ${b.versiRumus}`);
    tulis(`Menit ${b.menitEfektif.toFixed(1)}; km berat ${b.kmMedanBerat.toFixed(3)}; titik A ${b.titikGradeA}`);
    tulis(
      `HOK jam ${b.hokJam.toFixed(4)} + jarak ${b.hokJarak.toFixed(4)} + bonus ${b.hokBonus.toFixed(4)} = ${b.hokSebelumBatas.toFixed(4)}; sesudah batas ${b.totalHok.toFixed(4)}`
    );
    tulis("Sumber: " + b.sumberId.join(", "));
    y -= 6;
  }
  return pdf.save();
}
