// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveMap } from "../components/InteractiveMap";
import { PustakaView } from "../components/PustakaView";
import { PeekSheetInteraktif } from "../components/peta/PeekSheetInteraktif";
import { BottomSheet } from "../components/peta/BottomSheet";
import { objekCocokLapisan } from "../lib/tematik";
import { sinkronkanLapisanDariTugas } from "../lib/skemaTugas";
import { adalahGeserLurusHorizontal, adalahGeserLurusVertikal, arahGeser } from "../lib/geserTab";
import { bacaDraftSurvei, DRAFT_KOSONG, simpanDraftSurvei } from "../lib/draftSurvei";
import { setelUlangPenyimpananUntukUji } from "../lib/penyimpanan";
import { DataSpasialItem, LapisanSpasial, ProfilKader, TugasPemetaan } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PROFIL_UJI: ProfilKader = {
  idKader: "KDR-SIM-01",
  nama: "Kader Simulasi",
  desaWilayah: "Long Bawan",
  kelompokMasyarakat: "KTH Rimba",
  noHp: "081200000001",
  namaOrganisasi: "Titik Tapak",
  modeKombinasiTarget: "per_kategori"
};

const buatItem = (override: Partial<DataSpasialItem>): DataSpasialItem => ({
  id: "SPS-1",
  idKader: PROFIL_UJI.idKader,
  namaKader: PROFIL_UJI.nama,
  desaWilayah: "Long Bawan",
  jenisGeometri: "point",
  kategori: "Lainnya",
  judul: "Rumah Pak Kades Long Bawan (Pak Ito')",
  deskripsi: "Titik lama",
  koordinat: [{ lat: 3.899, lng: 115.699 }],
  panjangKm: 0,
  luasHa: 0,
  statusSinkron: "lokal",
  createdAt: "2026-11-18T00:00:00Z",
  updatedAt: "2026-11-18T00:00:00Z",
  riwayatPembaruan: [],
  ...override
});

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

describe("Simulasi Perbaikan: Lapisan Admin, Lapisan Kosong -> Peta, Swap Lurus, Hapus Data Lama, dan Transisi Halus", () => {
  beforeEach(() => {
    setelUlangPenyimpananUntukUji();
    localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
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

  it("1. Lapisan buatan Admin terisolasi ketat: tidak menarik data lama sebelumnya, hanya memuat data yang direkam pada lapisan tersebut", () => {
    const tugasAdmin: TugasPemetaan = {
      id: "TGS-ADMIN-01",
      judul: "Survei Mata Air Adat",
      deskripsi: "Catat sumber air bersih desa",
      targetWilayah: "Long Bawan",
      jenisTargetGeometri: "point",
      targetKuantitas: "10 Titik",
      batasWaktu: "2026-12-01",
      status: "aktif",
      koordinatAcuan: { lat: 3.9, lng: 115.7 },
      dibuatOleh: "Admin GIS",
      tipeGeometriDiizinkan: ["point"]
    };

    const lapisanHasil = sinkronkanLapisanDariTugas([], [tugasAdmin]);
    expect(lapisanHasil).toHaveLength(1);
    const lapisanAdmin = lapisanHasil[0];

    const dataLama: DataSpasialItem[] = [
      buatItem({ id: "SPS-LAMA-1", judul: "Rumah Pak Kades Long Bawan (Pak Ito')", kategori: "Lainnya" }),
      buatItem({ id: "SPS-LAMA-2", judul: "Pohon Meranti", kategori: "Biodiversitas", tematik: "Sebaran Flora" }),
      buatItem({ id: "SPS-LAMA-3", judul: "Sumber Air Lama", kategori: "Mata Air", lapisanNama: "Lapisan 1" })
    ];

    // Saat lapisan buatan Admin dipilih sebelum diisi: 0 data lama yang tertarik
    const cocokSebelumDiisi = dataLama.filter((d) => objekCocokLapisan(d, lapisanAdmin));
    expect(cocokSebelumDiisi).toHaveLength(0);

    // Setelah user mengisi 1 data baru pada lapisan Admin tersebut: hanya data baru itu yang muncul
    const itemBaruDiLapisanAdmin = buatItem({
      id: "SPS-BARU-ADMIN",
      judul: "Mata Air Hulu",
      lapisanId: lapisanAdmin.id,
      lapisanNama: lapisanAdmin.nama,
      tugasId: tugasAdmin.id
    });
    const cocokSesudahDiisi = [...dataLama, itemBaruDiLapisanAdmin].filter((d) => objekCocokLapisan(d, lapisanAdmin));
    expect(cocokSesudahDiisi).toHaveLength(1);
    expect(cocokSesudahDiisi[0].id).toBe("SPS-BARU-ADMIN");
  });

  it("2. Ketika lapisan kosong belum diisi, memilih lapisan peta langsung menuju ke Peta Interaktif", () => {
    const lapisanAdminKosong: LapisanSpasial = {
      id: "LAP-TGS-KOSONG",
      nama: "Survei Batas Baru",
      jumlahPeta: 1,
      tugasId: "KOSONG",
      createdAt: "2026-11-19T00:00:00Z"
    };
    const dataLama = [buatItem({ id: "SPS-LAMA-1", judul: "Rumah Pak Kades Long Bawan (Pak Ito')" })];

    // A. Simulasi di PustakaView -> subtab Lapisan -> klik lapisan kosong langsung panggil onBukaLapisanDiPeta
    const onBukaLapisan = vi.fn();
    const domPustaka = pasang(
      <PustakaView
        areaOffline={[]}
        lapisanList={[lapisanAdminKosong]}
        dataSpasial={dataLama}
        modePilihAktif={false}
        onMatikanModePilih={vi.fn()}
        onBukaPetaDasar={vi.fn()}
        onBukaLapisanDiPeta={onBukaLapisan}
        onBukaAreaPeta={vi.fn()}
        onTambahAreaOffline={vi.fn()}
        onHapusAreaOffline={vi.fn()}
        onHapusLapisan={vi.fn()}
        onBukaPengaturanEkspor={vi.fn()}
      />
    );
    const tabLapisan = [...domPustaka.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Lapisan");
    expect(tabLapisan).toBeTruthy();
    act(() => tabLapisan!.click());

    const barisLapisan = domPustaka.querySelector(".avenza-layer-row") as HTMLElement | null;
    expect(barisLapisan).not.toBeNull();
    expect(barisLapisan?.textContent).toContain("Belum diisi");
    act(() => barisLapisan!.click());
    expect(onBukaLapisan).toHaveBeenCalledWith(lapisanAdminKosong);

    // B. Simulasi di InteractiveMap -> buka halaman Lapisan Peta -> pilih chip lapisan kosong -> halaman lapisan langsung tertutup ke Peta Interaktif
    act(() => akar!.unmount());
    wadah?.remove();

    let aktifId: string | null = null;
    const domPeta = pasang(
      <InteractiveMap
        dataSpasial={dataLama}
        lapisanList={[lapisanAdminKosong]}
        lapisanAktifId={aktifId}
        onPilihLapisanAktif={(id) => {
          aktifId = id;
        }}
        profil={PROFIL_UJI}
        areaOffline={[]}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
      />
    );

    // Buka halaman Lapisan Peta
    const tombolLapisan = domPeta.querySelector('button[aria-label="Lapisan peta"]') as HTMLButtonElement | null;
    expect(tombolLapisan).not.toBeNull();
    act(() => tombolLapisan!.click());

    expect(domPeta.querySelector('[aria-label="Lapisan Peta"][role="dialog"]')).not.toBeNull();

    // Pilih chip lapisan buatan Admin yang kosong (0 objek)
    const chipAdmin = [...domPeta.querySelectorAll(".avz-tematik-chip")].find((b) =>
      b.textContent?.includes("Survei Batas Baru")
    ) as HTMLButtonElement | undefined;
    expect(chipAdmin).toBeDefined();
    expect(chipAdmin?.textContent).toContain("(0)");

    act(() => chipAdmin!.click());

    // Halaman dialog Lapisan Peta harus langsung tertutup dan kembali ke Peta Interaktif dengan lapisan aktif
    expect(aktifId).toBe("LAP-TGS-KOSONG");
    expect(domPeta.querySelector('[aria-label="Lapisan Peta"][role="dialog"]')).toBeNull();
  });

  it("3. Fitur swap/swipe hanya aktif ketika sapuan lurus (menolak sapuan diagonal/miring/melengkung)", () => {
    const s = (x: number, y: number, t = 0, maksSimpanganY?: number) => ({ x, y, t, maksSimpanganY });

    // Horizontal lurus -> AKTIF
    expect(arahGeser(s(300, 400, 0), s(160, 408, 180))).toBe(1);
    expect(arahGeser(s(100, 400, 0), s(240, 392, 180))).toBe(-1);
    expect(adalahGeserLurusHorizontal(120, 15)).toBe(true);

    // Horizontal miring/diagonal (dx=120, dy=55 -> rasio 2.18 < 3.0) -> DITOLAK
    expect(arahGeser(s(300, 400, 0), s(180, 455, 200))).toBe(0);
    // Horizontal melengkung di tengah (akhir dy=5 tapi tengah sempat menyimpang 45px) -> DITOLAK
    expect(arahGeser(s(300, 400, 0, 45), s(150, 405, 200, 45))).toBe(0);

    // Vertikal lurus vs miring
    expect(adalahGeserLurusVertikal(8, -90)).toBe(true);
    expect(adalahGeserLurusVertikal(45, -80)).toBe(false);
    expect(adalahGeserLurusVertikal(80, -15)).toBe(false);

    // Simulasi swipe miring vs lurus pada PeekSheetInteraktif
    const domPeek = pasang(
      <PeekSheetInteraktif
        mode="draft_pin"
        titikDraft={[{ lat: 3.9, lng: 115.7 }]}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
      />
    );
    const sheet = domPeek.querySelector(".avz-peek-card") as HTMLElement;
    const handle = domPeek.querySelector(".avz-peek-handle") as HTMLElement;
    expect(sheet.dataset.tahap).toBe("ringkas");

    // Swipe miring ke atas (dx = 45, dy = -60) -> TIDAK boleh mengubah tahap
    act(() => {
      handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 500 }));
      handle.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 145, clientY: 440 }));
      handle.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 145, clientY: 440 }));
    });
    expect(sheet.dataset.tahap).toBe("ringkas");

    // Swipe lurus ke atas (dx = 4, dy = -80) -> AKTIF, berubah ke tahap penuh
    act(() => {
      handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 500 }));
      handle.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 104, clientY: 420 }));
      handle.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 104, clientY: 420 }));
    });
    expect(sheet.dataset.tahap).toBe("penuh");

    // Simulasi BottomSheet: geser miring ditolak, geser lurus diterima
    act(() => akar!.unmount());
    wadah?.remove();
    const domSheet = pasang(
      <BottomSheet judul="Uji" onTutup={vi.fn()} awal={55}>
        <p>Isi</p>
      </BottomSheet>
    );
    const grip = domSheet.querySelector(".field-sheet-grip") as HTMLElement;
    const dialog = domSheet.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.style.getPropertyValue("--sheet-size")).toBe("55dvh");
    // Geser miring (dx=40, dy=-50) -> ditolak
    act(() => {
      grip.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 400 }));
      grip.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 140, clientY: 350 }));
    });
    expect(dialog.style.getPropertyValue("--sheet-size")).toBe("55dvh");
    // Geser lurus vertikal (dx=2, dy=-60) -> naik ke 92dvh
    act(() => {
      grip.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 400 }));
      grip.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 102, clientY: 340 }));
    });
    expect(dialog.style.getPropertyValue("--sheet-size")).toBe("92dvh");
  });

  it("4. Data yang sudah dihapus (Rumah Pak Kades Long Bawan (Pak Ito')) tidak muncul lagi ketika mengambil titik baru", () => {
    // Simulasikan kondisi sebelum perbaikan: sisa draf lama masih menyimpan "Rumah Pak Kades Long Bawan (Pak Ito')"
    simpanDraftSurvei(PROFIL_UJI.idKader, {
      ...DRAFT_KOSONG,
      judul: "Rumah Pak Kades Long Bawan (Pak Ito')",
      deskripsi: "Catatan titik lama yang sudah dihapus"
    });
    expect(bacaDraftSurvei(PROFIL_UJI.idKader).judul).toBe("Rumah Pak Kades Long Bawan (Pak Ito')");

    let dataList: DataSpasialItem[] = [
      buatItem({ id: "SPS-KADES", judul: "Rumah Pak Kades Long Bawan (Pak Ito')" })
    ];

    const domPeta = pasang(
      <InteractiveMap
        dataSpasial={dataList}
        lapisanList={[]}
        profil={PROFIL_UJI}
        areaOffline={[]}
        onSimpanDataBaru={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onSimpanAreaOffline={vi.fn()}
        onImporBerkas={vi.fn(() => true)}
        onHapusData={(id) => {
          dataList = dataList.filter((d) => d.id !== id);
        }}
      />
    );

    // Hapus data melalui halaman Lapisan Peta
    const tombolLapisan = domPeta.querySelector('button[aria-label="Lapisan peta"]') as HTMLButtonElement;
    act(() => tombolLapisan.click());
    const tombolUtamaLapisan = domPeta.querySelector(".avz-lapisan-utama") as HTMLButtonElement;
    act(() => tombolUtamaLapisan.click());
    const tombolHapus = domPeta.querySelector('button[aria-label*="Rumah Pak Kades"]') as HTMLButtonElement | null;
    expect(tombolHapus).not.toBeNull();
    act(() => tombolHapus!.click());

    // Re-render peta dengan data yang sudah terhapus, tutup halaman lapisan
    act(() => {
      akar!.render(
        <InteractiveMap
          dataSpasial={dataList}
          lapisanList={[]}
          profil={PROFIL_UJI}
          areaOffline={[]}
          onSimpanDataBaru={vi.fn()}
          onTambahPembaruanObjek={vi.fn(() => true)}
          onSimpanAreaOffline={vi.fn()}
          onImporBerkas={vi.fn(() => true)}
        />
      );
    });
    const tombolTutupLapisan = domPeta.querySelector('[aria-label="Lapisan Peta"] button[aria-label="Kembali"]') as HTMLButtonElement | null;
    if (tombolTutupLapisan) act(() => tombolTutupLapisan.click());

    // Ambil titik baru dengan menekan tombol Pin
    const tombolPin = domPeta.querySelector(".avz-fab-pin") as HTMLButtonElement | null;
    expect(tombolPin).not.toBeNull();
    act(() => tombolPin!.click());

    // PeekSheet draft pin muncul dengan kondisi bersih — TIDAK boleh menampilkan "Rumah Pak Kades Long Bawan (Pak Ito')"
    const peekCard = domPeta.querySelector(".avz-peek-card") as HTMLElement | null;
    expect(peekCard).not.toBeNull();
    expect(peekCard?.textContent).not.toContain("Rumah Pak Kades Long Bawan");
    expect(peekCard?.textContent).not.toContain("Pak Ito");
    expect(bacaDraftSurvei(PROFIL_UJI.idKader).judul).toBe("");
  });

  it("5. Transisi halus antar fitur, tab tampilan, subhalaman, dan overlay peta terpasang dengan dukungan prefers-reduced-motion", () => {
    const cssApp = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");
    const cssPeta = readFileSync(resolve(__dirname, "../styles/petaAvenza.css"), "utf8");

    expect(cssApp).toContain(".app-main.geser-halus");
    expect(cssApp).toContain("@keyframes geser-masuk-kiri");
    expect(cssApp).toContain("@keyframes geser-masuk-kanan");
    expect(cssApp).toContain(".subhalaman-transisi");
    expect(cssApp).toContain(".avenza-peta-content");
    expect(cssApp).toContain(".avenza-lapisan-content");
    expect(cssApp).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(cssApp).toContain("@media (prefers-reduced-motion: reduce)");

    expect(cssPeta).toContain("@keyframes avz-halaman-masuk");
    expect(cssPeta).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
