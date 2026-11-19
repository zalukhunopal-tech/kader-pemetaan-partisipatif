// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { InteractiveMap } from "../components/InteractiveMap";
import { PeekSheetInteraktif } from "../components/peta/PeekSheetInteraktif";
import { DataSpasialItem, LapisanSpasial, ProfilKader } from "../types";
import { perekamLatar } from "../lib/perekamLatar";

const PROFIL_UJI: ProfilKader = {
  idKader: "KDR-SWAP-01",
  nama: "Budi Lapangan",
  desaWilayah: "Long Bawan",
  kelompokMasyarakat: "KTH Krayan",
  noHp: "081200000099",
  namaOrganisasi: "Titik Tapak",
  modeKombinasiTarget: "per_kategori"
};

const LAPISAN_UJI: LapisanSpasial[] = [
  {
    id: "lap-1",
    nama: "Survei Hutan Adat",
    jumlahPeta: 1,
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

function buatTouchEvent(tipe: "touchstart" | "touchmove" | "touchend", clientX: number, clientY: number) {
  const titik = { clientX, clientY, identifier: 1 };
  const ev = new Event(tipe, { bubbles: true, cancelable: true }) as unknown as TouchEvent;
  Object.defineProperty(ev, "touches", { value: tipe === "touchend" ? [] : [titik] });
  Object.defineProperty(ev, "changedTouches", { value: [titik] });
  return ev;
}

describe("Fitur Swap ke Atas untuk Pengambilan Titik Koordinat & Perekaman Jalur", () => {
  let wadah: HTMLDivElement | null = null;
  let akar: Root | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    perekamLatar.batal();
  });

  afterEach(() => {
    if (akar) {
      act(() => akar!.unmount());
      akar = null;
    }
    wadah?.remove();
    wadah = null;
    perekamLatar.batal();
  });

  function pasang(el: React.ReactElement): HTMLDivElement {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    akar = createRoot(wadah);
    act(() => akar!.render(el));
    return wadah;
  }

  it("1. Mengambil titik koordinat: swap lurus ke atas pada isi kartu (pointer & touch) membuka detail, dan setelah disimpan tetap bisa di-swap ke atas", () => {
    const tersimpan: DataSpasialItem[] = [];
    const rootEl = pasang(
      <InteractiveMap
        dataSpasial={[]}
        lapisanList={LAPISAN_UJI}
        lapisanAktifId="lap-1"
        onPilihLapisanAktif={vi.fn()}
        profil={PROFIL_UJI}
        areaOffline={[]}
        onSimpanDataBaru={(item) => tersimpan.push(item)}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    // Jatuhkan pin koordinat
    const tombolPin = rootEl.querySelector<HTMLButtonElement>(".avz-fab-pin");
    expect(tombolPin).not.toBeNull();
    act(() => {
      tombolPin!.click();
    });

    const sheetDraft = rootEl.querySelector<HTMLElement>(".avz-peek-card");
    expect(sheetDraft).not.toBeNull();
    expect(sheetDraft!.dataset.mode).toBe("draft_pin");
    expect(sheetDraft!.dataset.tahap).toBe("ringkas");
    expect(sheetDraft!.textContent).not.toContain("Geser ke atas untuk detail");

    const bodyDraft = sheetDraft!.querySelector<HTMLElement>(".avz-peek-body")!;

    // Swipe miring pada body -> DITOLAK (tetap ringkas)
    act(() => {
      bodyDraft.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 120, clientY: 500 }));
      bodyDraft.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, button: 0, clientX: 165, clientY: 430 }));
      bodyDraft.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0, clientX: 165, clientY: 430 }));
    });
    expect(sheetDraft!.dataset.tahap).toBe("ringkas");

    // Swipe lurus ke atas pada body (PC/pointer) -> TERBUKA ke penuh
    act(() => {
      bodyDraft.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 120, clientY: 500 }));
      bodyDraft.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, button: 0, clientX: 123, clientY: 410 }));
      bodyDraft.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0, clientX: 123, clientY: 410 }));
    });
    expect(sheetDraft!.dataset.tahap).toBe("penuh");

    // Simpan titik koordinat
    const btnSimpanCentang = sheetDraft!.querySelector<HTMLButtonElement>(".avz-peek-btn-centang");
    expect(btnSimpanCentang).not.toBeNull();
    act(() => {
      btnSimpanCentang!.click();
    });

    expect(tersimpan).toHaveLength(1);
    expect(tersimpan[0].jenisGeometri).toBe("point");

    // Setelah titik disimpan, kartu ringkas objek terpilih tetap muncul agar bisa langsung di-swap ke atas
    const sheetTersimpan = rootEl.querySelector<HTMLElement>(".avz-peek-card");
    expect(sheetTersimpan).not.toBeNull();
    expect(sheetTersimpan!.dataset.mode).toBe("objek_terpilih");
    expect(sheetTersimpan!.dataset.tahap).toBe("ringkas");

    // Swap lurus ke atas via touch pada body objek yang baru disimpan -> membuka detail penuh
    const bodyTersimpan = sheetTersimpan!.querySelector<HTMLElement>(".avz-peek-body")!;
    act(() => {
      bodyTersimpan.dispatchEvent(buatTouchEvent("touchstart", 120, 520));
      bodyTersimpan.dispatchEvent(buatTouchEvent("touchmove", 122, 420));
      bodyTersimpan.dispatchEvent(buatTouchEvent("touchend", 122, 420));
    });
    expect(sheetTersimpan!.dataset.tahap).toBe("penuh");
  });

  it("2. Sedang merekam jalur GPS: swap lurus ke atas pada pita Melacak membuka drawer langsung di tab Pelacakan", () => {
    const rootEl = pasang(
      <InteractiveMap
        dataSpasial={[]}
        lapisanList={LAPISAN_UJI}
        lapisanAktifId="lap-1"
        onPilihLapisanAktif={vi.fn()}
        profil={PROFIL_UJI}
        areaOffline={[]}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    // Buka menu alat -> mulai Rekam Jalur GPS
    const tombolAlat = rootEl.querySelector<HTMLButtonElement>('button[aria-label="Alat peta"]');
    expect(tombolAlat).not.toBeNull();
    act(() => {
      tombolAlat!.click();
    });

    const tombolRekamJalur = Array.from(rootEl.querySelectorAll<HTMLButtonElement>(".avz-tool-popup-item")).find((b) =>
      b.textContent?.includes("Rekam Jalur GPS")
    );
    expect(tombolRekamJalur).not.toBeNull();
    act(() => {
      tombolRekamJalur!.click();
    });

    const pitaMelacak = rootEl.querySelector<HTMLElement>(".avz-status-rekam-sederhana");
    expect(pitaMelacak).not.toBeNull();
    expect(pitaMelacak!.textContent).toContain("Melacak");

    // Swap lurus ke atas pada pita Melacak
    act(() => {
      pitaMelacak!.dispatchEvent(buatTouchEvent("touchstart", 150, 620));
      window.dispatchEvent(buatTouchEvent("touchmove", 152, 500));
      window.dispatchEvent(buatTouchEvent("touchend", 152, 500));
    });

    const drawerGps = rootEl.querySelector<HTMLElement>(".avz-gps-drawer");
    expect(drawerGps).not.toBeNull();
    const tabPelacakan = Array.from(drawerGps!.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) =>
      b.textContent?.includes("Pelacakan")
    );
    expect(tabPelacakan).not.toBeNull();
    expect(tabPelacakan!.getAttribute("aria-selected")).toBe("true");
  });

  it("3. Selesai merekam jalur (Gambar dan Ukur maupun Pelacakan GPS): muncul kartu ringkas jalur yang bisa di-swap ke atas lalu disimpan", () => {
    const tersimpan: DataSpasialItem[] = [];
    const rootEl = pasang(
      <InteractiveMap
        dataSpasial={[]}
        lapisanList={LAPISAN_UJI}
        lapisanAktifId="lap-1"
        onPilihLapisanAktif={vi.fn()}
        profil={PROFIL_UJI}
        areaOffline={[]}
        onSimpanDataBaru={(item) => tersimpan.push(item)}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    // Mulai Rekam Jalur GPS lalu tambahkan 3 titik simulasi GPS
    const tombolAlat = rootEl.querySelector<HTMLButtonElement>('button[aria-label="Alat peta"]')!;
    act(() => tombolAlat.click());
    const tombolRekamJalur = Array.from(rootEl.querySelectorAll<HTMLButtonElement>(".avz-tool-popup-item")).find((b) =>
      b.textContent?.includes("Rekam Jalur GPS")
    )!;
    act(() => tombolRekamJalur.click());

    act(() => {
      perekamLatar.tambahTitik({ lat: 3.817, lng: 115.754 });
      perekamLatar.tambahTitik({ lat: 3.821, lng: 115.758 });
      perekamLatar.tambahTitik({ lat: 3.826, lng: 115.762 });
    });

    // Buka panel Pelacakan & klik Hentikan
    const tombolStatus = rootEl.querySelector<HTMLButtonElement>(".avz-status-rekam-sederhana button")!;
    act(() => tombolStatus.click());
    const tombolHentikan = rootEl.querySelector<HTMLButtonElement>(".avz-gps-btn-hentikan")!;
    expect(tombolHentikan).not.toBeNull();
    act(() => tombolHentikan.click());

    // Muncul kartu ringkas draft_rekaman yang siap di-swap ke atas
    const sheetRekam = rootEl.querySelector<HTMLElement>(".avz-peek-card");
    expect(sheetRekam).not.toBeNull();
    expect(sheetRekam!.dataset.mode).toBe("draft_rekaman");
    expect(sheetRekam!.dataset.tahap).toBe("ringkas");
    expect(sheetRekam!.textContent).toContain("Jalur direkam");
    expect(sheetRekam!.textContent).toContain("3 titik");

    // Swap lurus ke atas pada isi kartu jalur
    const bodyRekam = sheetRekam!.querySelector<HTMLElement>(".avz-peek-body")!;
    act(() => {
      bodyRekam.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 140, clientY: 540 }));
      bodyRekam.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, button: 0, clientX: 142, clientY: 430 }));
      bodyRekam.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0, clientX: 142, clientY: 430 }));
    });
    expect(sheetRekam!.dataset.tahap).toBe("penuh");
    expect(sheetRekam!.textContent).toContain("Jarak");
    expect(sheetRekam!.textContent).toContain("Konversikan ke Area");

    // Simpan jalur rekaman
    const btnSimpanJalur = sheetRekam!.querySelector<HTMLButtonElement>(".avz-peek-btn-centang")!;
    act(() => btnSimpanJalur.click());

    expect(tersimpan).toHaveLength(1);
    expect(tersimpan[0].jenisGeometri).toBe("line");
    expect(tersimpan[0].koordinat).toHaveLength(3);

    // Setelah tersimpan, kartu ringkas jalur terpilih muncul dan tetap mendukung swap ke atas
    const sheetJalurSimpan = rootEl.querySelector<HTMLElement>(".avz-peek-card");
    expect(sheetJalurSimpan).not.toBeNull();
    expect(sheetJalurSimpan!.dataset.mode).toBe("objek_terpilih");
    expect(sheetJalurSimpan!.dataset.tahap).toBe("ringkas");
  });

  it("4. PeekSheetInteraktif mode draft_rekaman mendukung polygon (Area digambar) dan swipe dua arah", () => {
    const dom = pasang(
      <PeekSheetInteraktif
        mode="draft_rekaman"
        jenisDraft="polygon"
        titikDraft={[
          { lat: 3.81, lng: 115.75 },
          { lat: 3.82, lng: 115.75 },
          { lat: 3.82, lng: 115.76 }
        ]}
        lapisanAktif={LAPISAN_UJI[0]}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
      />
    );
    const sheet = dom.querySelector<HTMLElement>(".avz-peek-card")!;
    expect(sheet.dataset.tahap).toBe("ringkas");
    expect(sheet.textContent).toContain("Area digambar");

    // Swipe lurus ke atas -> penuh
    const body = sheet.querySelector<HTMLElement>(".avz-peek-body")!;
    act(() => {
      body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 100, clientY: 500 }));
      body.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, button: 0, clientX: 101, clientY: 400 }));
      body.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0, clientX: 101, clientY: 400 }));
    });
    expect(sheet.dataset.tahap).toBe("penuh");
    expect(sheet.textContent).toContain("Perimeter");

    // Swipe lurus ke bawah pada header -> kembali ringkas
    const header = sheet.querySelector<HTMLElement>(".avz-peek-full-header")!;
    act(() => {
      header.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 100, clientY: 120 }));
      header.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, button: 0, clientX: 101, clientY: 220 }));
      header.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0, clientX: 101, clientY: 220 }));
    });
    expect(sheet.dataset.tahap).toBe("ringkas");
  });
});
