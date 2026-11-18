import { FieldSkemaAtribut, JenisGeometri, LapisanSpasial, SkemaAtributGeometri, TugasPemetaan } from "../types";
import { buatId } from "./id";

/** Membuat skema atribut kosong untuk ketiga tipe geometri peta interaktif. */
export function buatSkemaKosong(): SkemaAtributGeometri {
  return {
    point: [],
    line: [],
    polygon: []
  };
}

/** Menggandakan skema geometri agar aman diedit di UI tanpa mutasi langsung state. */
export function cloneSkemaGeometri(skema?: SkemaAtributGeometri): SkemaAtributGeometri {
  const s = skema ?? buatSkemaKosong();
  const salinDaftar = (daftar: FieldSkemaAtribut[] = []) =>
    daftar.map((f) => ({
      ...f,
      opsi: f.opsi ? [...f.opsi] : undefined
    }));
  return {
    point: salinDaftar(s.point),
    line: salinDaftar(s.line),
    polygon: salinDaftar(s.polygon)
  };
}

/** Menghitung jumlah isian yang dikonfigurasi pada masing-masing tipe geometri. */
export function hitungRingkasSkema(skema?: SkemaAtributGeometri): {
  total: number;
  point: number;
  line: number;
  polygon: number;
} {
  const point = skema?.point?.length ?? 0;
  const line = skema?.line?.length ?? 0;
  const polygon = skema?.polygon?.length ?? 0;
  return {
    total: point + line + polygon,
    point,
    line,
    polygon
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

/** Templat cepat field per geometri supaya Admin mudah menyusun isian survei lapangan. */
export const TEMPLAT_FIELD_SKEMA: Record<JenisGeometri, Omit<FieldSkemaAtribut, "id">[]> = {
  point: [
    { nama: "Nama Spesies / Objek", tipe: "teks", wajib: true, placeholder: "Misal: Ulin, Mata Air Hulu" },
    { nama: "Diameter / Tinggi", tipe: "angka", wajib: false, placeholder: "cm atau m" },
    {
      nama: "Kondisi Temuan",
      tipe: "pilihan",
      wajib: true,
      opsi: ["Baik / Alami", "Perlu Pemantauan", "Terdampak / Rusak"]
    },
    { nama: "Keterangan Lapangan", tipe: "catatan", wajib: false, placeholder: "Catatan tambahan di lokasi titik" }
  ],
  line: [
    { nama: "Nama Jalur / Sungai", tipe: "teks", wajib: true, placeholder: "Misal: Jalur Patroli Sektor Barat" },
    {
      nama: "Kondisi Akses",
      tipe: "pilihan",
      wajib: true,
      opsi: ["Lancar", "Terjal / Licin", "Tertutup Longsor / Tumbangan"]
    },
    { nama: "Lebar Rata-rata (m)", tipe: "angka", wajib: false, placeholder: "Contoh: 2.5" },
    { nama: "Catatan Jalur", tipe: "catatan", wajib: false, placeholder: "Hambatan atau penanda penting" }
  ],
  polygon: [
    { nama: "Nama Wilayah / Blok", tipe: "teks", wajib: true, placeholder: "Misal: Hutan Adat Blok II" },
    {
      nama: "Tutupan Lahan",
      tipe: "pilihan",
      wajib: true,
      opsi: ["Hutan Primer", "Hutan Sekunder", "Kebun Campur", "Lahan Terbuka", "Permukiman"]
    },
    { nama: "Pemilik / Pengelola", tipe: "teks", wajib: false, placeholder: "Nama kelompok atau pemegang hak" },
    { nama: "Saksi Batas", tipe: "teks", wajib: false, placeholder: "Pisahkan nama dengan koma" }
  ]
};

/** Membuat instance field baru dengan ID unik. */
export function buatFieldSkemaBaru(asal: Omit<FieldSkemaAtribut, "id">): FieldSkemaAtribut {
  return {
    id: buatId("FLD"),
    nama: asal.nama.trim(),
    tipe: asal.tipe,
    wajib: Boolean(asal.wajib),
    opsi: asal.tipe === "pilihan" ? (asal.opsi ?? []).map((x) => x.trim()).filter(Boolean) : undefined,
    placeholder: asal.placeholder?.trim() || undefined
  };
}

/**
 * Menyelaraskan daftar Lapisan (`LapisanSpasial[]`) dengan Tugas yang dibuat Admin (`TugasPemetaan[]`).
 * - Tugas aktif/tersimpan otomatis tersedia di menu Lapisan supaya kader tinggal memilihnya.
 * - Lapisan milik user (non-tugasId) tetap dipertahankan tanpa diubah.
 */
export function sinkronkanLapisanDariTugas(
  lapisanSaatIni: LapisanSpasial[],
  tugasList: TugasPemetaan[]
): LapisanSpasial[] {
  const mapTugas = new Map(tugasList.map((t) => [t.id, t]));
  const sudahAdaTugasId = new Set<string>();

  // Pertahankan lapisan non-tugas dan perbarui lapisan yang tertaut dengan tugas
  const hasil: LapisanSpasial[] = [];
  for (const l of lapisanSaatIni) {
    if (!l.tugasId) {
      hasil.push(l);
      continue;
    }
    const tugas = mapTugas.get(l.tugasId);
    if (!tugas) {
      // Tugas sudah dihapus Admin -> hapus lapisan tugas turunannya
      continue;
    }
    sudahAdaTugasId.add(tugas.id);
    hasil.push({
      ...l,
      nama: tugas.judul,
      kategoriDefault: tugas.kategoriTarget,
      skemaGeometri: cloneSkemaGeometri(tugas.skemaGeometri),
      deskripsi: tugas.deskripsi
    });
  }

  // Tambahkan tugas baru yang belum punya entri lapisan di urutan paling atas
  const tambahan: LapisanSpasial[] = [];
  for (const t of tugasList) {
    if (sudahAdaTugasId.has(t.id)) continue;
    tambahan.push({
      id: `LAP-TGS-${t.id}`,
      nama: t.judul,
      jumlahPeta: 1,
      kategoriDefault: t.kategoriTarget,
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
  nilai: Record<string, string> | undefined
): string | null {
  if (!fields.length) return null;
  const data = nilai ?? {};
  for (const f of fields) {
    if (!f.wajib) continue;
    const isi = (data[f.id] ?? "").trim();
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
