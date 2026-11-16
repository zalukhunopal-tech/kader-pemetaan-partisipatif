import { DataSpasialItem, KategoriSurvei, LapisanSpasial } from "../types";
import { sanitasiTeksInput } from "./geoUtils";
import { buatId } from "./id";

export interface KolamTematik {
  nama: string;
  kategori: KategoriSurvei;
  jumlahObjek: number;
  lapisanId?: string;
}

export interface HasilResolusiTematik {
  /** Nama tematik akhir setelah aturan kesamaan kategori; undefined = bukan tematik / peta biasa */
  tematik?: string;
  kategori: KategoriSurvei;
  status: "non_tematik" | "gabung_kolam" | "kolam_baru" | "tematik_tersendiri";
  /** true jika kategori berbeda sehingga dibuatkan kolam tematik tersendiri */
  dibuatTersendiri: boolean;
  /** Kategori milik kolam asal bila terjadi pemecahan otomatis */
  kategoriKolamAsal?: KategoriSurvei;
}

function kunciNama(nama: string): string {
  return nama.trim().toLowerCase();
}

/**
 * Menghitung apakah sebuah objek spasial termasuk dalam lapisan / kolam tematik tertentu.
 */
export function objekCocokLapisan(objek: DataSpasialItem, lapisan: LapisanSpasial): boolean {
  const tematikObjek = (objek.tematik || "").trim();
  const namaLapisan = lapisan.nama.trim();
  if (tematikObjek) {
    return kunciNama(tematikObjek) === kunciNama(namaLapisan);
  }
  // Lapisan tematik khusus tidak menarik data non-tematik
  if (lapisan.adalahTematik) return false;
  return Boolean(lapisan.kategoriDefault && objek.kategori === lapisan.kategoriDefault);
}

/**
 * Mengumpulkan seluruh kolam data peta tematik dari daftar lapisan dan item spasial tersimpan.
 */
export function kumpulkanKolamTematik(
  lapisanList: LapisanSpasial[],
  dataSpasial: DataSpasialItem[]
): KolamTematik[] {
  const peta = new Map<string, KolamTematik>();

  for (const lapisan of lapisanList) {
    const nama = lapisan.nama.trim();
    if (!nama) continue;
    const k = kunciNama(nama);
    if (!peta.has(k)) {
      peta.set(k, {
        nama,
        kategori: lapisan.kategoriDefault || "Lainnya",
        jumlahObjek: 0,
        lapisanId: lapisan.id
      });
    }
  }

  for (const item of dataSpasial) {
    const nama = (item.tematik || "").trim();
    if (!nama) continue;
    const k = kunciNama(nama);
    const ada = peta.get(k);
    if (ada) {
      ada.jumlahObjek += 1;
    } else {
      peta.set(k, {
        nama,
        kategori: item.kategori,
        jumlahObjek: 1
      });
    }
  }

  return Array.from(peta.values()).sort((a, b) => b.jumlahObjek - a.jumlahObjek || a.nama.localeCompare(b.nama, "id"));
}

/**
 * Menyelesaikan aturan pengisian Peta Tematik (Kolam Data):
 * - Kosong: bukan peta tematik -> masuk ke peta seperti biasa (`tematik: undefined`).
 * - Nama tematik sama DAN kategori sama: digabung ke dalam kolam tematik tersebut.
 * - Nama tematik sama TETAPI kategori berbeda: dibuatkan tematik tersendiri (`NamaTematik (Kategori)`).
 */
export function selesaikanKolamTematik(opsi: {
  namaTematik?: string;
  kategori: KategoriSurvei;
  lapisanList: LapisanSpasial[];
  dataSpasial: DataSpasialItem[];
}): HasilResolusiTematik {
  const namaBersih = sanitasiTeksInput(opsi.namaTematik || "").trim();
  if (!namaBersih) {
    return {
      tematik: undefined,
      kategori: opsi.kategori,
      status: "non_tematik",
      dibuatTersendiri: false
    };
  }

  const kolamList = kumpulkanKolamTematik(opsi.lapisanList, opsi.dataSpasial);
  const kolamCocok = kolamList.find((k) => kunciNama(k.nama) === kunciNama(namaBersih));

  if (!kolamCocok) {
    return {
      tematik: namaBersih,
      kategori: opsi.kategori,
      status: "kolam_baru",
      dibuatTersendiri: false
    };
  }

  if (kolamCocok.kategori === opsi.kategori) {
    return {
      tematik: kolamCocok.nama,
      kategori: opsi.kategori,
      status: "gabung_kolam",
      dibuatTersendiri: false
    };
  }

  // Kategori tidak sama -> wajib dijadikan tematik tersendiri
  const namaTersendiriCalon = `${kolamCocok.nama} (${opsi.kategori})`;
  const kolamTersendiriAda = kolamList.find(
    (k) => kunciNama(k.nama) === kunciNama(namaTersendiriCalon) && k.kategori === opsi.kategori
  );
  return {
    tematik: kolamTersendiriAda ? kolamTersendiriAda.nama : namaTersendiriCalon,
    kategori: opsi.kategori,
    status: "tematik_tersendiri",
    dibuatTersendiri: true,
    kategoriKolamAsal: kolamCocok.kategori
  };
}

/**
 * Memastikan kolam tematik pada item baru terdaftar/diperbarui pada daftar LapisanSpasial.
 */
export function sinkronkanLapisanDenganItem(
  lapisanList: LapisanSpasial[],
  item: DataSpasialItem,
  dataSpasialSetelahTambah: DataSpasialItem[]
): LapisanSpasial[] {
  const namaTematik = (item.tematik || "").trim();
  if (!namaTematik) return lapisanList;

  const targetKunci = kunciNama(namaTematik);
  const jumlahDiKolam = dataSpasialSetelahTambah.filter(
    (d) => kunciNama(d.tematik || "") === targetKunci
  ).length;

  const indeksAda = lapisanList.findIndex((l) => kunciNama(l.nama) === targetKunci);
  if (indeksAda >= 0) {
    return lapisanList.map((l, idx) =>
      idx === indeksAda
        ? {
            ...l,
            kategoriDefault: l.kategoriDefault || item.kategori,
            adalahTematik: true,
            jumlahPeta: Math.max(1, jumlahDiKolam)
          }
        : l
    );
  }

  const baru: LapisanSpasial = {
    id: buatId("LYR"),
    nama: namaTematik,
    jumlahPeta: Math.max(1, jumlahDiKolam),
    kategoriDefault: item.kategori,
    adalahTematik: true,
    createdAt: new Date().toISOString()
  };
  return [baru, ...lapisanList];
}
