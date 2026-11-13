import { BuktiFotoLapangan, HasilRataRataGps, JenisGeometri, KategoriSurvei, KoordinatTitik, MemoSuara } from "../types";
import { bacaTeks, tulisTeks } from "./penyimpanan";
export const KUNCI_DRAFT_SURVEI = "titik_tapak_draft_survei_v1";
export interface DraftSurvei {
  kategori: KategoriSurvei;
  judul: string;
  namaLokal: string;
  namaIlmiah: string;
  jumlahIndividu: string;
  manfaat: string;
  kondisi: string;
  deskripsi: string;
  foto: string;
  saksi: string;
  memo: MemoSuara[];
  buktiFoto?: BuktiFotoLapangan;
  averaging?: HasilRataRataGps;
  rekaman?: { jenis: JenisGeometri; titik: KoordinatTitik[] };
  url?: string;
  tepi?: string;
  warna?: string;
  simbol?: string;
}
export const DRAFT_KOSONG: DraftSurvei = {
  kategori: "Flora",
  judul: "",
  namaLokal: "",
  namaIlmiah: "",
  jumlahIndividu: "1",
  manfaat: "",
  kondisi: "",
  deskripsi: "",
  foto: "",
  saksi: "",
  memo: [],
  url: "",
  tepi: "",
  warna: "",
  simbol: ""
};
function semuaDraft(): Record<string, DraftSurvei> {
  try {
    return JSON.parse(bacaTeks(KUNCI_DRAFT_SURVEI) ?? "{}");
  } catch {
    return {};
  }
}
export function bacaDraftSurvei(idKader: string): DraftSurvei {
  return { ...DRAFT_KOSONG, ...semuaDraft()[idKader] };
}
export function simpanDraftSurvei(idKader: string, draft: DraftSurvei) {
  tulisTeks(KUNCI_DRAFT_SURVEI, JSON.stringify({ ...semuaDraft(), [idKader]: draft }));
}
