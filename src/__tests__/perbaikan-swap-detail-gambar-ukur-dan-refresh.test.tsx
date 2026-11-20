// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveMap } from "../components/InteractiveMap";
import { PeekSheetInteraktif } from "../components/peta/PeekSheetInteraktif";
import { perekamLatar } from "../lib/perekamLatar";
import { useTarikSegarkan } from "../lib/useTarikSegarkan";
import { setelUlangPenyimpananUntukUji } from "../lib/penyimpanan";
import { DataSpasialItem, LapisanSpasial, ProfilKader } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PROFIL_UJI: ProfilKader = {
  idKader: "KDR-SWP-01",
  nama: "Kader Lapangan",
  desaWilayah: "Long Bawan",
  kelompokMasyarakat: "KTH Krayan",
  noHp: "081200001234",
  namaOrganisasi: "Titik Tapak",
  modeKombinasiTarget: "per_kategori"
};

const LAPISAN_UJI: LapisanSpasial[] = [
  {
    id: "LAP-1",
    nama: "Lapisan 1",
    jumlahPeta: 0,
    createdAt: "2026-11-20T08:00:00Z"
  }
];

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

function buatTouchEvent(tipe: "touchstart" | "touchmove" | "touchend", clientX: number, clientY: number) {
  const ev = new Event(tipe, { bubbles: true, cancelable: true }) as unknown as TouchEvent;
  const titik = { clientX, clientY, identifier: 1 };
  Object.defineProperty(ev, "touches", { value: tipe === "touchend" ? [] : [titik] });
  Object.defineProperty(ev, "changedTouches", { value: [titik] });
  return ev;
}

describe("Perbaikan Swap Detail Titik/Jalur, Gambar dan Ukur Keluar Tiba-Tiba, dan Refresh In-App", () => {
  beforeEach(() => {
    perekamLatar.batal();
    setelUlangPenyimpananUntukUji();
    localStorage.clear();
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
  });

  afterEach(() => {
    perekamLatar.batal();
    if (akar) {
      act(() => akar!.unmount());
      akar = null;
    }
    wadah?.remove();
    wadah = null;
    vi.restoreAllMocks();
  });

  it("1. Keterangan singkat setelah mengambil titik atau merekam jalur dapat di-swap ke atas (termasuk goyangan awal jari alami) untuk melihat detail data", () => {
    const itemTitik: DataSpasialItem = {
      id: "PT-SWP-1",
      idKader: PROFIL_UJI.idKader,
      namaKader: PROFIL_UJI.nama,
      desaWilayah: PROFIL_UJI.desaWilayah,
      jenisGeometri: "point",
      kategori: "Lainnya",
      judul: "Pohon Meranti Besar",
      deskripsi: "Diameter 120 cm di pinggir sungai",
      koordinat: [{ lat: 3.817416, lng: 115.754455, elevasi: 912 }],
      panjangKm: 0,
      luasHa: 0,
      lapisanId: "LAP-1",
      lapisanNama: "Lapisan 1",
      atributKustom: { "Jenis Pohon": "Shorea leprosula" },
      statusSinkron: "lokal",
      createdAt: "2026-11-20T10:00:00Z",
      updatedAt: "2026-11-20T10:00:00Z",
      riwayatPembaruan: []
    };

    const dom = pasang(
      <PeekSheetInteraktif
        mode="objek_terpilih"
        objekTerpilih={itemTitik}
        lapisanList={LAPISAN_UJI}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
      />
    );

    const sheet = dom.querySelector<HTMLElement>(".avz-peek-card")!;
    const body = sheet.querySelector<HTMLElement>(".avz-peek-body")!;
    expect(sheet.dataset.tahap).toBe("ringkas");

    // Simulasi sentuhan ibu jari nyata di HP: sempat bergeser 5px menyamping di 10px awal lalu lurus ke atas (-90px)
    act(() => {
      body.dispatchEvent(buatTouchEvent("touchstart", 120, 520));
      body.dispatchEvent(buatTouchEvent("touchmove", 125, 510)); // 5px samping di 10px awal
      body.dispatchEvent(buatTouchEvent("touchmove", 128, 430)); // berakhir lurus ke atas (dx=8, dy=-90)
      body.dispatchEvent(buatTouchEvent("touchend", 128, 430));
    });

    expect(sheet.dataset.tahap).toBe("penuh");
    expect(sheet.textContent).toContain("Pohon Meranti Besar");
    expect(sheet.textContent).toContain("Diameter 120 cm di pinggir sungai");
    expect(sheet.textContent).toContain("Shorea leprosula");

    // Uji alur lengkap di InteractiveMap: simpan pin -> keterangan singkat & toast muncul -> swap ke atas pada pesan membuka detail penuh!
    act(() => akar!.unmount());
    akar = null;
    wadah?.remove();
    wadah = null;

    const tersimpan: DataSpasialItem[] = [];
    const rootPeta = pasang(
      <InteractiveMap
        dataSpasial={tersimpan}
        lapisanList={LAPISAN_UJI}
        lapisanAktifId="LAP-1"
        profil={PROFIL_UJI}
        areaOffline={[]}
        fokusKoordinat={{ lat: 3.817416, lng: 115.754455 }}
        onSimpanDataBaru={(item) => tersimpan.push(item)}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    // Ambil titik koordinat (jatuhkan pin) -> muncul keterangan singkat -> simpan
    const btnPin = rootPeta.querySelector<HTMLButtonElement>(".avz-fab-pin")!;
    act(() => btnPin.click());
    const peekDraft = rootPeta.querySelector<HTMLElement>(".avz-peek-card")!;
    expect(peekDraft.dataset.mode).toBe("draft_pin");
    expect(peekDraft.dataset.tahap).toBe("ringkas");

    // Swap ke atas pada kartu ringkas draft pin -> terbuka detail -> klik centang untuk simpan
    act(() => {
      peekDraft.dispatchEvent(buatTouchEvent("touchstart", 120, 500));
      peekDraft.dispatchEvent(buatTouchEvent("touchmove", 123, 410));
      peekDraft.dispatchEvent(buatTouchEvent("touchend", 123, 410));
    });
    expect(peekDraft.dataset.tahap).toBe("penuh");

    const btnSimpanPin = rootPeta.querySelector<HTMLButtonElement>(".avz-peek-btn-centang")!;
    act(() => btnSimpanPin.click());
    expect(tersimpan).toHaveLength(1);

    // Setelah selesai menyimpan titik, keterangan singkat hasil titik & toast "Pin disimpan ke peta" tampil
    const peekHasil = rootPeta.querySelector<HTMLElement>(".avz-peek-card")!;
    const toastHasil = rootPeta.querySelector<HTMLElement>(".field-map-message")!;
    expect(peekHasil.dataset.mode).toBe("objek_terpilih");
    expect(peekHasil.dataset.tahap).toBe("ringkas");
    expect(toastHasil.textContent).toContain("Pin disimpan ke peta");

    // Swap ke atas pada keterangan singkat ("Pin disimpan ke peta") langsung meluaskan detail data!
    act(() => {
      toastHasil.dispatchEvent(buatTouchEvent("touchstart", 150, 200));
      toastHasil.dispatchEvent(buatTouchEvent("touchend", 152, 140));
    });
    expect(peekHasil.dataset.tahap).toBe("penuh");
  });

  it("2. Fitur Gambar dan Ukur tidak disimpan sebagai perekaman jalur dan saat keluar tiba-tiba (pagehide/unmount/remount) tidak berubah menjadi perekaman jalur", () => {
    // A. Mulai Gambar dan Ukur di perekamLatar -> TIDAK ditulis ke localStorage & tidak bisa diubah jadi "merekam"
    perekamLatar.mulaiGambarUkur("line", [
      { lat: 3.81, lng: 115.75 },
      { lat: 3.82, lng: 115.76 }
    ]);
    expect(perekamLatar.getState().modeGambarUkur).toBe(true);
    expect(localStorage.getItem("kader_pemetaan_rekam_latar_v1")).toBeNull();

    // Panggilan lanjutkan() tidak boleh mengubah modeGambarUkur menjadi perekaman jalur GPS aktif
    perekamLatar.lanjutkan();
    expect(perekamLatar.getState().status).toBe("dijeda");
    expect(perekamLatar.getState().modeGambarUkur).toBe(true);

    // B. Simulasikan user membuka Peta Interaktif, menyalakan Gambar dan Ukur, lalu keluar tiba-tiba (pagehide)
    perekamLatar.batal();
    const rootPeta = pasang(
      <InteractiveMap
        dataSpasial={[]}
        lapisanList={LAPISAN_UJI}
        profil={PROFIL_UJI}
        areaOffline={[]}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    // Buka menu alat -> pilih "Gambar dan Ukur"
    const btnAlat = rootPeta.querySelector<HTMLButtonElement>('button[aria-label="Alat peta"]')!;
    act(() => btnAlat.click());
    const btnGambarUkur = Array.from(rootPeta.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Gambar dan Ukur")
    )!;
    act(() => btnGambarUkur.click());
    expect(perekamLatar.getState().modeGambarUkur).toBe(true);
    expect(localStorage.getItem("kader_pemetaan_rekam_latar_v1")).toBeNull();

    // Keluar tiba-tiba (pagehide + unmount)
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(perekamLatar.getState().status).toBe("idle");
    expect(perekamLatar.getState().modeGambarUkur).toBe(false);

    // C. Bahkan jika state modeGambarUkur tertinggal saat InteractiveMap dimuat ulang, TIDAK boleh berubah menjadi perekaman jalur!
    act(() => akar!.unmount());
    akar = null;
    wadah?.remove();
    wadah = null;

    perekamLatar.mulaiGambarUkur("line", [
      { lat: 3.81, lng: 115.75 },
      { lat: 3.82, lng: 115.76 }
    ]);
    const rootPetaUlang = pasang(
      <InteractiveMap
        dataSpasial={[]}
        lapisanList={LAPISAN_UJI}
        profil={PROFIL_UJI}
        areaOffline={[]}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );
    expect(perekamLatar.getState().status).toBe("idle");
    expect(rootPetaUlang.textContent).not.toContain("Merekam Jalur");
    expect(rootPetaUlang.textContent).not.toContain("Rekaman dijeda");
  });

  it("3. Tarik ke bawah untuk refresh berjalan lembut di dalam aplikasi tanpa reload halaman, memblokir pull-to-refresh browser, dan mempertahankan layar aktif", async () => {
    // A. Pastikan CSS menonaktifkan browser native pull-to-refresh (overscroll-behavior-y: none)
    const appCss = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");
    expect(appCss).toMatch(/html,\s*body,\s*#root\s*\{[^}]*overscroll-behavior-y:\s*none/s);

    // B. Uji hook useTarikSegarkan mempertahankan tab aktif dan tidak memuat ulang / mengunci
    const onSegarkan = vi.fn();
    let tabLayar = "pustaka";
    let layarKunci: string | null = null;

    function HarnessRefresh() {
      const tarik = useTarikSegarkan({
        aktif: true,
        onSegarkan,
        durasiMinMs: 10
      });
      return (
        <main
          data-testid="layar-aktif"
          data-tab={tabLayar}
          onTouchStart={tarik.onTouchStart}
          onTouchMove={tarik.onTouchMove}
          onTouchEnd={tarik.onTouchEnd}
          onTouchCancel={tarik.onTouchCancel}
        >
          {tarik.jarakTarikPx > 0 && (
            <div className="tarik-segarkan-indikator">
              {tarik.sedangMenyegarkan ? "Menyegarkan..." : tarik.siapSegarkan ? "Lepaskan untuk menyegarkan" : "Tarik"}
            </div>
          )}
          <div className="map-canvas-container">Peta</div>
        </main>
      );
    }

    const dom = pasang(<HarnessRefresh />);
    const main = dom.querySelector("main") as HTMLElement;

    // 1. Sentuhan di dalam kanvas peta tidak boleh memicu refresh
    const petaBox = dom.querySelector(".map-canvas-container") as HTMLElement;
    act(() => {
      petaBox.dispatchEvent(buatTouchEvent("touchstart", 150, 100));
      petaBox.dispatchEvent(buatTouchEvent("touchmove", 150, 240));
      petaBox.dispatchEvent(buatTouchEvent("touchend", 150, 240));
    });
    expect(onSegarkan).not.toHaveBeenCalled();

    // 2. Tarik lurus ke bawah dari paling atas layar -> muncul indikator -> lepaskan -> menyegarkan in-app
    act(() => {
      main.dispatchEvent(buatTouchEvent("touchstart", 150, 80));
      main.dispatchEvent(buatTouchEvent("touchmove", 152, 220)); // dy = 140 -> visual 84px >= 64px
    });
    expect(dom.querySelector(".tarik-segarkan-indikator")?.textContent).toContain("Lepaskan untuk menyegarkan");

    await act(async () => {
      main.dispatchEvent(buatTouchEvent("touchend", 152, 220));
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(onSegarkan).toHaveBeenCalledTimes(1);
    // Layar tetap pada tab "pustaka" dan tidak beralih ke layar buka kunci!
    expect(main.dataset.tab).toBe("pustaka");
    expect(layarKunci).toBeNull();
  });
});
