// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { setelUlangPenyimpananUntukUji } from "./penyimpanan";
import { muatPesan } from "./storage";

beforeEach(() => {
  setelUlangPenyimpananUntukUji();
  localStorage.clear();
});

const pesanLama = (id: string, statusKirim: string) => ({
  id,
  saluran: "komunitas",
  idPengirim: "KDR-1",
  namaPengirim: "Budi",
  peranPengirim: "kader",
  desaPengirim: "Desa A",
  teks: "halo",
  waktu: "10:00",
  statusKirim
});

describe("muatPesan (T4)", () => {
  it("pesan lama bertanda terkirim/antrean_offline dinormalkan menjadi tersimpan di perangkat ini", () => {
    localStorage.setItem("geokader_pesan_v5", JSON.stringify([pesanLama("M1", "terkirim"), pesanLama("M2", "antrean_offline")]));
    const hasil = muatPesan();
    expect(hasil.map((m) => m.statusKirim)).toEqual(["tersimpan", "tersimpan"]);
    expect(hasil.map((m) => m.id)).toEqual(["M1", "M2"]);
  });
  it("tanpa data: daftar kosong", () => {
    expect(muatPesan()).toEqual([]);
  });
});
