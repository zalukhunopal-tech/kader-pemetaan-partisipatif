import { FieldSkemaAtribut, JenisGeometri, LapisanSpasial, SkemaAtributGeometri, TugasPemetaan } from "../types";
import { buatId } from "./id";

/** Membuat skema tabel dan atribut kosong tanpa tabel atau kategori bawaan. */
export function buatSkemaKosong(): SkemaAtributGeometri {
  return {
    point: [],
    line: [],
    polygon: [],
    daftarTabel: {
      point: [],
      line: [],
      polygon: []
    }
  };
}

/** Mengembalikan daftar nama tabel untuk satu jenis geometri. */
export function ambilDaftarTabelGeometri(skema: SkemaAtributGeometri | undefined, jenis: JenisGeometri): string[] {
  const terdaftar = skema?.daftarTabel?.[jenis] ?? [];
  const dariField = (skema?.[jenis] ?? [])
    .map((f) => (f.tabel || "").trim())
    .filter(Boolean);
  const hasil: string[] = [];
  const terlihat = new Set<string>();
  for (const nama of [...terdaftar, ...dariField]) {
    const kunci = nama.toLowerCase();
    if (!terlihat.has(kunci)) {
      terlihat.add(kunci);
      hasil.push(nama);
    }
  }
  return hasil;
}

/** Menggandakan skema geometri agar aman diedit di UI tanpa mutasi langsung state. */
export function cloneSkemaGeometri(skema?: SkemaAtributGeometri): SkemaAtributGeometri {
  const s = skema ?? buatSkemaKosong();
  const salinDaftar = (daftar: FieldSkemaAtribut[] = []) =>
    daftar.map((f) => ({
      ...f,
      opsi: f.opsi ? [...f.opsi] : undefined
    }));
  const hasil: SkemaAtributGeometri = {
    point: salinDaftar(s.point),
    line: salinDaftar(s.line),
    polygon: salinDaftar(s.polygon)
  };
  hasil.daftarTabel = {
    point: ambilDaftarTabelGeometri(s, "point"),
    line: ambilDaftarTabelGeometri(s, "line"),
    polygon: ambilDaftarTabelGeometri(s, "polygon")
  };
  return hasil;
}

/** Menghitung jumlah tabel dan kolom isian pada masing-masing tipe geometri. */
export function hitungRingkasSkema(skema?: SkemaAtributGeometri): {
  total: number;
  point: number;
  line: number;
  polygon: number;
  tabelPoint: number;
  tabelLine: number;
  tabelPolygon: number;
  totalTabel: number;
} {
  const point = skema?.point?.length ?? 0;
  const line = skema?.line?.length ?? 0;
  const polygon = skema?.polygon?.length ?? 0;
  const tabelPoint = ambilDaftarTabelGeometri(skema, "point").length;
  const tabelLine = ambilDaftarTabelGeometri(skema, "line").length;
  const tabelPolygon = ambilDaftarTabelGeometri(skema, "polygon").length;
  return {
    total: point + line + polygon,
    point,
    line,
    polygon,
    tabelPoint,
    tabelLine,
    tabelPolygon,
    totalTabel: tabelPoint + tabelLine + tabelPolygon
  };
}

/** Label ramah untuk tipe input field skema Admin. */
export const LABEL_TIPE_FIELD: Record<FieldSkemaAtribut["tipe"], string> = {
  teks: "Teks Singkat",
  angka: "Angka",
  pilihan: "Pilihan (Dropdown)",
  tanggal: "Tanggal",
  catatan: "Catatan Panjang",
  foto: "Foto"
};

/** Membuat instance field baru dengan ID unik. */
export function buatFieldSkemaBaru(asal: Omit<FieldSkemaAtribut, "id">): FieldSkemaAtribut {
  return {
    id: buatId("FLD"),
    nama: asal.nama.trim(),
    tabel: asal.tabel?.trim() || undefined,
    tipe: asal.tipe,
    wajib: Boolean(asal.wajib),
    opsi: asal.tipe === "pilihan" ? (asal.opsi ?? []).map((x) => x.trim()).filter(Boolean) : undefined,
    nilaiBawaan: asal.nilaiBawaan?.trim() || undefined,
    placeholder: asal.placeholder?.trim() || undefined
  };
}

/** Menambahkan tabel baru pada geometri tertentu (mengabaikan duplikat case-insensitive). */
export function tambahTabelSkema(skema: SkemaAtributGeometri, jenis: JenisGeometri, namaTabel: string): SkemaAtributGeometri {
  const bersih = namaTabel.trim();
  if (!bersih) return skema;
  const salin = cloneSkemaGeometri(skema);
  const daftar = salin.daftarTabel![jenis];
  if (daftar.some((t) => t.toLowerCase() === bersih.toLowerCase())) return salin;
  daftar.push(bersih);
  return salin;
}

/** Menghapus tabel beserta seluruh kolom di dalamnya untuk geometri tertentu. */
export function hapusTabelSkema(skema: SkemaAtributGeometri, jenis: JenisGeometri, namaTabel: string): SkemaAtributGeometri {
  const target = namaTabel.trim().toLowerCase();
  const salin = cloneSkemaGeometri(skema);
  salin.daftarTabel![jenis] = salin.daftarTabel![jenis].filter((t) => t.toLowerCase() !== target);
  salin[jenis] = salin[jenis].filter((f) => (f.tabel || "").trim().toLowerCase() !== target);
  return salin;
}

/** Mengganti nama tabel beserta referensi seluruh kolom di dalamnya. */
export function ubahNamaTabelSkema(
  skema: SkemaAtributGeometri,
  jenis: JenisGeometri,
  namaLama: string,
  namaBaru: string
): SkemaAtributGeometri {
  const lama = namaLama.trim().toLowerCase();
  const baru = namaBaru.trim();
  if (!lama || !baru) return skema;
  const salin = cloneSkemaGeometri(skema);
  salin.daftarTabel![jenis] = salin.daftarTabel![jenis].map((t) => (t.toLowerCase() === lama ? baru : t));
  salin[jenis] = salin[jenis].map((f) =>
    (f.tabel || "").trim().toLowerCase() === lama ? { ...f, tabel: baru } : f
  );
  return salin;
}

/** Mengelompokkan field geometri ke dalam bagian per nama tabel buatan Admin. */
export function kelompokkanFieldPerTabel(
  skema: SkemaAtributGeometri | undefined,
  jenis: JenisGeometri
): { namaTabel: string; fields: FieldSkemaAtribut[] }[] {
  const daftarField = skema?.[jenis] ?? [];
  const daftarTabel = ambilDaftarTabelGeometri(skema, jenis);
  const grup = new Map<string, { namaTabel: string; fields: FieldSkemaAtribut[] }>();

  for (const t of daftarTabel) {
    grup.set(t.toLowerCase(), { namaTabel: t, fields: [] });
  }
  for (const f of daftarField) {
    const namaT = (f.tabel || "").trim() || "Tabel Utama";
    const key = namaT.toLowerCase();
    const ada = grup.get(key);
    if (ada) {
      ada.fields.push(f);
    } else {
      grup.set(key, { namaTabel: namaT, fields: [f] });
    }
  }
  return [...grup.values()];
}

/**
 * Menyelaraskan daftar Lapisan (`LapisanSpasial[]`) dengan Tugas yang dibuat Admin (`TugasPemetaan[]`).
 * - Tugas aktif/tersimpan otomatis tersedia di menu Lapisan supaya user tinggal memilihnya.
 * - Lapisan milik user (non-tugasId) tetap dipertahankan tanpa diubah.
 */
export function sinkronkanLapisanDariTugas(
  lapisanSaatIni: LapisanSpasial[],
  tugasList: TugasPemetaan[]
): LapisanSpasial[] {
  const mapTugas = new Map(tugasList.map((t) => [t.id, t]));
  const sudahAdaTugasId = new Set<string>();

  const hasil: LapisanSpasial[] = [];
  for (const l of lapisanSaatIni) {
    if (!l.tugasId) {
      hasil.push(l);
      continue;
    }
    const tugas = mapTugas.get(l.tugasId);
    if (!tugas) continue;
    sudahAdaTugasId.add(tugas.id);
    hasil.push({
      ...l,
      nama: tugas.judul,
      kategoriDefault: undefined,
      skemaGeometri: cloneSkemaGeometri(tugas.skemaGeometri),
      deskripsi: tugas.deskripsi
    });
  }

  const tambahan: LapisanSpasial[] = [];
  for (const t of tugasList) {
    if (sudahAdaTugasId.has(t.id)) continue;
    tambahan.push({
      id: `LAP-TGS-${t.id}`,
      nama: t.judul,
      jumlahPeta: 1,
      kategoriDefault: undefined,
      adalahTematik: false,
      tugasId: t.id,
      skemaGeometri: cloneSkemaGeometri(t.skemaGeometri),
      deskripsi: t.deskripsi,
      createdAt: new Date().toISOString()
    });
  }

  return [...tambahan, ...hasil];
}

/** Memeriksa apakah nilai isian skema kustom sudah memenuhi seluruh field wajib. */
export function validasiIsianSkema(
  fields: FieldSkemaAtribut[],
  nilai: Record<string, string> | undefined,
  formatKunci: (f: FieldSkemaAtribut) => string = (f) => f.id
): string | null {
  if (!fields.length) return null;
  const data = nilai ?? {};
  for (const f of fields) {
    if (!f.wajib) continue;
    const kunci = formatKunci(f);
    const isi = (data[kunci] ?? data[f.id] ?? f.nilaiBawaan ?? "").trim();
    if (!isi) {
      return `Isian wajib "${f.nama}" belum dilengkapi.`;
    }
  }
  return null;
}

/** Menentukan apakah sebuah lapisan memiliki konfigurasi skema isian untuk geometri tertentu (atau salah satu). */
export function punyaSkemaAktif(lapisan?: LapisanSpasial | null, jenis?: JenisGeometri | null): boolean {
  if (!lapisan?.skemaGeometri) return false;
  if (jenis) return (lapisan.skemaGeometri[jenis]?.length ?? 0) > 0;
  const r = hitungRingkasSkema(lapisan.skemaGeometri);
  return r.total > 0;
}
