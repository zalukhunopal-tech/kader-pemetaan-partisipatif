// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveMap } from "../components/InteractiveMap";
import { FormSurveiModal, useFormSurvei } from "../components/peta/FormSurveiModal";
import { sinkronkanLapisanDariTugas } from "../lib/skemaTugas";
import { setelUlangPenyimpananUntukUji } from "../lib/penyimpanan";
import { DataSpasialItem, LapisanSpasial, ProfilKader, TugasPemetaan } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PROFIL_UJI: ProfilKader = {
  idKader: "KDR-ANGGREK-01",
  nama: "Kader Krayan",
  desaWilayah: "Long Bawan",
  kelompokMasyarakat: "KTH Krayan",
  noHp: "081200000099",
  namaOrganisasi: "Titik Tapak",
  modeKombinasiTarget: "per_kategori"
};

const TUGAS_ANGGREK_POINT: TugasPemetaan = {
  id: "TSK-ANGGREK",
  judul: "Inventarisasi Anggrek Krayan",
  deskripsi: "Format tugas Inventarisasi Anggrek Krayan (Point) dengan 3 isian data.",
  targetWilayah: "Seluruh Wilayah",
  jenisTargetGeometri: "point",
  tipeGeometriDiizinkan: ["point"],
  targetKuantitas: "3 isian data",
  batasWaktu: "-",
  koordinatAcuan: { lat: 2.8575, lng: 117.3775 },
  status: "aktif",
  dibuatOleh: "Admin GIS",
  targetKader: ["*"],
  skemaGeometri: {
    point: [
      { id: "FLD-1", nama: "Nama Jenis Anggrek", tabel: "Data Point", tipe: "teks", wajib: true },
      { id: "FLD-2", nama: "Tinggi Pohon Inang", tabel: "Data Point", tipe: "angka", wajib: false },
      { id: "FLD-3", nama: "Nilai Ekonomi", tabel: "Data Point", tipe: "nominal", wajib: false }
    ],
    line: [],
    polygon: [],
    daftarTabel: {
      point: ["Data Point"],
      line: [],
      polygon: []
    }
  }
};

const TUGAS_JALUR_LINE_ONLY: TugasPemetaan = {
  id: "TSK-JALUR",
  judul: "Pemetaan Jalur Patroli",
  deskripsi: "Format tugas Jalur Patroli (Line) dengan 1 isian data.",
  targetWilayah: "Seluruh Wilayah",
  jenisTargetGeometri: "line",
  tipeGeometriDiizinkan: ["line"],
  targetKuantitas: "1 isian data",
  batasWaktu: "-",
  koordinatAcuan: { lat: 2.8575, lng: 117.3775 },
  status: "aktif",
  dibuatOleh: "Admin GIS",
  targetKader: ["*"],
  skemaGeometri: {
    point: [],
    line: [{ id: "FLD-L1", nama: "Kondisi Jalur", tabel: "Data Line", tipe: "teks", wajib: true }],
    polygon: [],
    daftarTabel: {
      point: [],
      line: ["Data Line"],
      polygon: []
    }
  }
};

let wadah: HTMLDivElement | null = null;
let akar: Root | null = null;

function pasang(el: React.ReactElement): HTMLDivElement {
  wadah = document.createElement("div");
  document.body.appendChild(wadah);
  akar = createRoot(wadah);
  act(() => {
    akar!.render(el);
  });
  return wadah;
}

function isiInput(el: HTMLInputElement, nilai: string) {
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  proto?.set?.call(el, nilai);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Lapisan Peta sebagai Kolam Data Tanpa Garis Navigasi & Format Isian Tugas Admin", () => {
  beforeEach(() => {
    setelUlangPenyimpananUntukUji();
    localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    if (akar) {
      act(() => akar!.unmount());
      akar = null;
    }
    wadah?.remove();
    wadah = null;
    vi.restoreAllMocks();
  });

  it("1. Membuka lapisan peta buatan Admin tidak menampilkan banner/garis navigasi dan judul peta menunjukkan nama lapisan aktif", () => {
    const lapisanList = sinkronkanLapisanDariTugas([], [TUGAS_ANGGREK_POINT]);
    const lapisanAnggrek = lapisanList[0];

    const rootEl = pasang(
      <InteractiveMap
        dataSpasial={[]}
        lapisanList={lapisanList}
        lapisanAktifId={lapisanAnggrek.id}
        onPilihLapisanAktif={vi.fn()}
        profil={PROFIL_UJI}
        areaOffline={[]}
        fokusKoordinat={null}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    // Tidak ada banner navigasi (.goto-nav-banner) saat membuka lapisan peta
    expect(rootEl.querySelector(".goto-nav-banner")).toBeNull();
    // Bilah atas menampilkan nama lapisan aktif sebagai penanda kolam data
    const judul = rootEl.querySelector(".avz-titlebar-teks");
    expect(judul?.textContent).toContain("Inventarisasi Anggrek");
  });

  it("2. fokusKoordinat tanpa aktifkanNavigasi: true tidak memicu garis/banner navigasi, sedangkan aktifkanNavigasi: true tetap mengaktifkannya dan hilang saat ganti lapisan", () => {
    const lapisanList = sinkronkanLapisanDariTugas([], [TUGAS_ANGGREK_POINT, TUGAS_JALUR_LINE_ONLY]);

    // A. fokusKoordinat dengan aktifkanNavigasi: false (mis. lihat titik dari daftar) -> TIDAK ada banner navigasi
    const rootEl = pasang(
      <InteractiveMap
        dataSpasial={[]}
        lapisanList={lapisanList}
        lapisanAktifId={lapisanList[0].id}
        onPilihLapisanAktif={vi.fn()}
        profil={PROFIL_UJI}
        areaOffline={[]}
        fokusKoordinat={{ lat: 3.8174, lng: 115.7544, label: "Objek Tersimpan", aktifkanNavigasi: false }}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );
    expect(rootEl.querySelector(".goto-nav-banner")).toBeNull();

    // B. fokusKoordinat dengan aktifkanNavigasi: true -> banner navigasi muncul
    act(() => {
      akar!.render(
        <InteractiveMap
          dataSpasial={[]}
          lapisanList={lapisanList}
          lapisanAktifId={lapisanList[0].id}
          onPilihLapisanAktif={vi.fn()}
          profil={PROFIL_UJI}
          areaOffline={[]}
          fokusKoordinat={{ lat: 3.8174, lng: 115.7544, label: "Tujuan Eksplisit", aktifkanNavigasi: true }}
          onSimpanDataBaru={vi.fn()}
          onTambahPembaruanObjek={vi.fn(() => true)}
          onSimpanAreaOffline={vi.fn()}
          onImporBerkas={vi.fn(() => true)}
        />
      );
    });
    expect(rootEl.querySelector(".goto-nav-banner")).not.toBeNull();
    expect(rootEl.querySelector(".goto-nav-banner")?.textContent).toContain("Tujuan Eksplisit");

    // C. Saat pengguna berpindah ke lapisan peta lain, garis/banner navigasi lama otomatis dibersihkan
    act(() => {
      akar!.render(
        <InteractiveMap
          dataSpasial={[]}
          lapisanList={lapisanList}
          lapisanAktifId={lapisanList[1].id}
          onPilihLapisanAktif={vi.fn()}
          profil={PROFIL_UJI}
          areaOffline={[]}
          fokusKoordinat={null}
          onSimpanDataBaru={vi.fn()}
          onTambahPembaruanObjek={vi.fn(() => true)}
          onSimpanAreaOffline={vi.fn()}
          onImporBerkas={vi.fn(() => true)}
        />
      );
    });
    expect(rootEl.querySelector(".goto-nav-banner")).toBeNull();
  });

  it("3. Saat lapisan Tugas Admin dengan format Point aktif, menekan tombol Pin langsung membuka formulir format Tugas Admin dan menyimpan atribut kustom ke kolam data", () => {
    const lapisanList = sinkronkanLapisanDariTugas([], [TUGAS_ANGGREK_POINT]);
    const lapisanAnggrek = lapisanList[0];
    const disimpan: DataSpasialItem[] = [];

    const rootEl = pasang(
      <InteractiveMap
        dataSpasial={[]}
        lapisanList={lapisanList}
        lapisanAktifId={lapisanAnggrek.id}
        onPilihLapisanAktif={vi.fn()}
        profil={PROFIL_UJI}
        areaOffline={[]}
        onSimpanDataBaru={(item) => disimpan.push(item)}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    // Tekan tombol Pin (FAB) di Peta Interaktif
    const tombolPin = rootEl.querySelector<HTMLButtonElement>(".avz-fab-pin");
    expect(tombolPin).not.toBeNull();
    act(() => {
      tombolPin!.click();
    });

    // Langsung membuka FormSurveiModal (bukan PeekSheetInteraktif ringkas tanpa kolom tugas)
    const formEl = rootEl.querySelector<HTMLFormElement>("#form-survei-lapangan");
    expect(formEl).not.toBeNull();
    expect(formEl!.textContent).toContain("Lapisan Tugas Admin: Inventarisasi Anggrek Krayan");
    expect(formEl!.textContent).toContain("Nama Jenis Anggrek");
    expect(formEl!.textContent).toContain("Tinggi Pohon Inang");
    expect(formEl!.textContent).toContain("Nilai Ekonomi");

    // Isi nama + semua field format tugas Admin
    const inputNama = formEl!.querySelector<HTMLInputElement>('input[placeholder="Tanda tempat 1"]');
    const inputJenis = formEl!.querySelector<HTMLInputElement>('input[placeholder*="nama jenis anggrek"]');
    const inputTinggi = formEl!.querySelector<HTMLInputElement>('input[placeholder*="tinggi pohon inang"]');
    const inputNominal = formEl!.querySelector<HTMLInputElement>("input.avz-nominal-input");
    expect(inputNama).not.toBeNull();
    expect(inputJenis).not.toBeNull();
    expect(inputTinggi).not.toBeNull();
    expect(inputNominal).not.toBeNull();

    act(() => {
      isiInput(inputNama!, "Anggrek Spot 01");
      isiInput(inputJenis!, "Coelogyne pandurata");
      isiInput(inputTinggi!, "14");
      isiInput(inputNominal!, "250000");
    });

    act(() => {
      formEl!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(disimpan).toHaveLength(1);
    expect(disimpan[0].lapisanId).toBe(lapisanAnggrek.id);
    expect(disimpan[0].lapisanNama).toBe("Inventarisasi Anggrek Krayan");
    expect(disimpan[0].tugasId).toBe("TSK-ANGGREK");
    expect(disimpan[0].atributKustom).toEqual({
      "Nama Jenis Anggrek": "Coelogyne pandurata",
      "Tinggi Pohon Inang": "14",
      "Nilai Ekonomi": "Rp 250.000"
    });
  });

  it("4. Data lain yang BELUM ditentukan formatnya oleh Admin otomatis mengikuti format default peta interaktif", () => {
    // Kasus A: Admin hanya mengatur format Line (tidak mengatur Point) -> Pin tetap memakai format default peta interaktif (PeekSheetInteraktif)
    const lapisanLineList = sinkronkanLapisanDariTugas([], [TUGAS_JALUR_LINE_ONLY]);
    const lapisanLine = lapisanLineList[0];

    const rootEl = pasang(
      <InteractiveMap
        dataSpasial={[]}
        lapisanList={lapisanLineList}
        lapisanAktifId={lapisanLine.id}
        onPilihLapisanAktif={vi.fn()}
        profil={PROFIL_UJI}
        areaOffline={[]}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    const tombolPin = rootEl.querySelector<HTMLButtonElement>(".avz-fab-pin");
    act(() => {
      tombolPin!.click();
    });
    // Karena format Point tidak ditetapkan oleh Admin, tidak memaksa FormSurveiModal kustom
    expect(rootEl.querySelector("#form-survei-lapangan")).toBeNull();
    // PeekSheet default peta interaktif muncul
    expect(rootEl.textContent).toContain("Pin dijatuhkan");

    // Kasus B: Admin hanya mengatur format Point, user merekam Line -> FormSurveiModal memakai format default peta interaktif tanpa kolom Point Admin
    act(() => akar!.unmount());
    akar = null;
    wadah?.remove();

    const lapisanPointOnly: LapisanSpasial = sinkronkanLapisanDariTugas([], [TUGAS_ANGGREK_POINT])[0];
    const tersimpanLine: DataSpasialItem[] = [];

    function HarnessFormLine() {
      const form = useFormSurvei(PROFIL_UJI.idKader);
      return (
        <FormSurveiModal
          form={form}
          modeRekam="line"
          panjangDraftKm={1.25}
          luasDraftHa={0}
          profil={PROFIL_UJI}
          koordinat={[
            { lat: 3.817, lng: 115.754 },
            { lat: 3.825, lng: 115.762 }
          ]}
          onHasilAveraging={vi.fn()}
          onSimpan={(e) => {
            e.preventDefault();
            tersimpanLine.push(
              form.susunItem(PROFIL_UJI, "line", [
                { lat: 3.817, lng: 115.754 },
                { lat: 3.825, lng: 115.762 }
              ], undefined, { lapisanAktif: lapisanPointOnly })
            );
          }}
          onTutup={vi.fn()}
          lapisanList={[lapisanPointOnly]}
          lapisanAktif={lapisanPointOnly}
        />
      );
    }

    const rootLine = pasang(<HarnessFormLine />);
    const formLine = rootLine.querySelector<HTMLFormElement>("#form-survei-lapangan");
    expect(formLine).not.toBeNull();
    // Menampilkan info bahwa tipe LINE memakai format default dan TIDAK memunculkan kolom khusus Point
    expect(formLine!.textContent).toContain("Tipe LINE memakai format default");
    expect(formLine!.textContent).not.toContain("Nama Jenis Anggrek");

    const inputNamaLine = formLine!.querySelector<HTMLInputElement>('input[placeholder="Trek 1"]');
    act(() => {
      isiInput(inputNamaLine!, "Jalur Survei Tambahan");
    });
    act(() => {
      formLine!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(tersimpanLine).toHaveLength(1);
    expect(tersimpanLine[0].jenisGeometri).toBe("line");
    expect(tersimpanLine[0].lapisanId).toBe(lapisanPointOnly.id);
    expect(tersimpanLine[0].atributKustom).toBeUndefined();
  });
});
