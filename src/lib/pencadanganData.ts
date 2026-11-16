import { DataSpasialItem, ItemPencadanganSpasial, StatusSinkron } from "../types";

export const RETENSI_PENCADANGAN_HARI = 90;
export const RETENSI_PENCADANGAN_MS = RETENSI_PENCADANGAN_HARI * 24 * 60 * 60 * 1000;

export interface InfoStatusServerItem {
  id: string;
  idKader?: string;
  statusSinkron?: StatusSinkron | string;
  catatanAdmin?: string;
}

export interface SnapshotStatusDatabaseServer {
  aktif: InfoStatusServerItem[];
  pencadanganIds: string[];
}

export function pindahkanKePencadangan(
  item: DataSpasialItem,
  olehAdmin = "Admin GIS",
  alasan = "Dihapus admin (retensi pencadangan 90 hari)",
  sekarangMs = Date.now()
): ItemPencadanganSpasial {
  const sudahDiGDrive = item.statusSinkron === "tersinkron" || item.statusSinkron === "terverifikasi";
  return {
    id: item.id,
    data: { ...item, dalamPencadangan: true },
    dipindahkanPada: new Date(sekarangMs).toISOString(),
    kedaluwarsaPada: new Date(sekarangMs + RETENSI_PENCADANGAN_MS).toISOString(),
    alasan: alasan.trim() || undefined,
    dihapusOleh: olehAdmin,
    statusGDrive: sudahDiGDrive ? "menunggu_pindah" : "lokal_saja"
  };
}

export function pulihkanItemDariPencadangan(entri: ItemPencadanganSpasial, sekarangMs = Date.now()): DataSpasialItem {
  const salinan: DataSpasialItem = {
    ...entri.data,
    dalamPencadangan: undefined,
    updatedAt: new Date(sekarangMs).toISOString()
  };
  delete salinan.dalamPencadangan;
  return salinan;
}

export function sudahKedaluwarsa(entri: ItemPencadanganSpasial, sekarangMs = Date.now()): boolean {
  const habisMs = Date.parse(entri.kedaluwarsaPada);
  if (Number.isNaN(habisMs)) return false;
  return sekarangMs >= habisMs;
}

export function sisaHariPencadangan(entri: ItemPencadanganSpasial, sekarangMs = Date.now()): number {
  const habisMs = Date.parse(entri.kedaluwarsaPada);
  if (Number.isNaN(habisMs)) return RETENSI_PENCADANGAN_HARI;
  const sisa = Math.ceil((habisMs - sekarangMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, sisa);
}

export function pisahkanPencadanganKedaluwarsa(
  daftar: ItemPencadanganSpasial[],
  sekarangMs = Date.now()
): { aktif: ItemPencadanganSpasial[]; kedaluwarsa: ItemPencadanganSpasial[] } {
  const aktif: ItemPencadanganSpasial[] = [];
  const kedaluwarsa: ItemPencadanganSpasial[] = [];
  for (const entri of daftar) {
    if (sudahKedaluwarsa(entri, sekarangMs)) kedaluwarsa.push(entri);
    else aktif.push(entri);
  }
  return { aktif, kedaluwarsa };
}

export function idsDiPencadangan(daftar: ItemPencadanganSpasial[]): Set<string> {
  return new Set(daftar.map((d) => d.id));
}

function tafsirStatusServer(statusRaw: string | undefined): StatusSinkron | null {
  const s = (statusRaw || "").trim().toLowerCase();
  if (!s) return null;
  if (s === "terverifikasi" || s.includes("sah")) return "terverifikasi";
  if (s === "ditolak" || s.includes("revisi")) return "ditolak";
  if (s.includes("tersinkron")) return "tersinkron";
  return null;
}

/**
 * Menyinkronkan daftar aktif & pencadangan di aplikasi dengan kondisi database asli Google Drive:
 * - Jika ID masuk ke pencadangan di Drive: pindahkan dari data aktif lokal ke pencadangan lokal.
 * - Jika ID sebelumnya tersinkron/terverifikasi lalu hilang dari database aktif & pencadangan Drive:
 *   hapus dari data aktif lokal agar kenaikan level hanya menghitung data yang masih ada di database asli.
 * - Jika status verifikasi diubah langsung di spreadsheet Drive: perbarui status di aplikasi.
 */
export function rekonsiliasiDatabaseDenganGDrive(
  dataLokal: DataSpasialItem[],
  pencadanganLokal: ItemPencadanganSpasial[],
  server: SnapshotStatusDatabaseServer,
  sekarangMs = Date.now()
): {
  dataAktif: DataSpasialItem[];
  pencadangan: ItemPencadanganSpasial[];
  jumlahDipindahKeCadangan: number;
  jumlahDihapusDariLokal: number;
  jumlahStatusDiperbarui: number;
} {
  const petaAktifServer = new Map(server.aktif.map((a) => [a.id, a]));
  const setCadanganServer = new Set(server.pencadanganIds);
  const petaCadanganLokal = new Map(pencadanganLokal.map((c) => [c.id, c]));

  const dataAktifBaru: DataSpasialItem[] = [];
  let jumlahDipindahKeCadangan = 0;
  let jumlahDihapusDariLokal = 0;
  let jumlahStatusDiperbarui = 0;

  for (const item of dataLokal) {
    const diCadanganServer = setCadanganServer.has(item.id);
    if (diCadanganServer) {
      if (!petaCadanganLokal.has(item.id)) {
        const entri = pindahkanKePencadangan(item, "Google Drive / Admin", "Dipindahkan di database Google Drive", sekarangMs);
        entri.statusGDrive = "di_pencadangan";
        petaCadanganLokal.set(item.id, entri);
      }
      jumlahDipindahKeCadangan += 1;
      continue;
    }

    const infoServer = petaAktifServer.get(item.id);
    const pernahKeDrive = item.statusSinkron === "tersinkron" || item.statusSinkron === "terverifikasi";
    if (!infoServer && pernahKeDrive) {
      // Data sudah tidak ada di database asli GDrive (mis. dihapus permanen di admin/Drive)
      jumlahDihapusDariLokal += 1;
      continue;
    }

    if (infoServer) {
      const statusBaru = tafsirStatusServer(String(infoServer.statusSinkron ?? ""));
      const catatanBaru = infoServer.catatanAdmin?.trim() || item.catatanAdmin;
      if ((statusBaru && statusBaru !== item.statusSinkron) || catatanBaru !== item.catatanAdmin) {
        dataAktifBaru.push({
          ...item,
          statusSinkron: statusBaru ?? item.statusSinkron,
          catatanAdmin: catatanBaru
        });
        jumlahStatusDiperbarui += 1;
        continue;
      }
    }

    dataAktifBaru.push(item);
  }

  return {
    dataAktif: dataAktifBaru,
    pencadangan: Array.from(petaCadanganLokal.values()),
    jumlahDipindahKeCadangan,
    jumlahDihapusDariLokal,
    jumlahStatusDiperbarui
  };
}
