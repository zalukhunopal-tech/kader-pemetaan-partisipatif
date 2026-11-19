// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import { InspektorObjek } from "../components/peta/InspektorObjek";
import { PeekSheetInteraktif } from "../components/peta/PeekSheetInteraktif";
import { PemberitahuanView } from "../components/PemberitahuanView";
import { PanelDataUserLevel } from "../components/PanelDataUserLevel";
import { PustakaView } from "../components/PustakaView";
import { PengaturanEksporView } from "../components/PengaturanEksporView";
import { KomunikasiView } from "../components/KomunikasiView";
import { filterDataUntukEkspor } from "../lib/eksporFilter";
import { eksporKeGeoJSON, sanitasiAtributKustom } from "../lib/geoUtils";
import { KUNCI_DATA } from "../lib/storage";
import { DataSpasialItem, ProfilKader } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let wadah: HTMLDivElement | null = null;
let akar: Root | null = null;

function pasang(elemen: React.ReactElement): HTMLDivElement {
  wadah = document.createElement("div");
  document.body.appendChild(wadah);
  akar = createRoot(wadah);
  act(() => {
    akar!.render(elemen);
  });
  return wadah;
}

function ubahInput(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, nilai: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, nilai);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function klik(el: Element | null | undefined) {
  expect(el).toBeTruthy();
  act(() => {
    (el as HTMLElement).click();
  });
}

function cariTombol(root: HTMLElement, teks: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim().includes(teks));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  if (akar) {
    act(() => {
      akar!.unmount();
    });
    akar = null;
  }
  if (wadah) {
    wadah.remove();
    wadah = null;
  }
  localStorage.clear();
});

const profilKaderUji: ProfilKader = {
  idKader: "KDR-AUDIT-01",
  nama: "Kader Audit",
  desaWilayah: "Desa Rimba",
  kelompokMasyarakat: "Masyarakat Adat",
  noHp: "081234567890",
  namaOrganisasi: "Organisasi Audit",
  modeKombinasiTarget: "per_kategori"
};

const contohJalur: DataSpasialItem = {
  id: "line-audit-1",
  idKader: "KDR-AUDIT-01",
  namaKader: "Kader Audit",
  desaWilayah: "Desa Rimba",
  jenisGeometri: "line",
  kategori: "Tanda Batas",
  judul: "Jalur Patroli Utara",
  deskripsi: "Lintasan punggung bukit",
  koordinat: [
    { lat: 3.9, lng: 115.9, timestamp: "2026-11-19T01:00:00.000Z" },
    { lat: 3.91, lng: 115.91, timestamp: "2026-11-19T01:15:30.000Z" },
    { lat: 3.92, lng: 115.92, timestamp: "2026-11-19T01:30:45.000Z" }
  ],
  panjangKm: 3.45,
  luasHa: 0,
  lapisanNama: "Patroli Hutan",
  statusSinkron: "terverifikasi",
  createdAt: "2026-11-19T01:00:00.000Z",
  updatedAt: "2026-11-19T01:30:45.000Z",
  riwayatPembaruan: []
};

describe("Validasi Audit Bug, Fitur Tidak Berfungsi, Aliran Fitur Mentok, dan Keamanan", () => {
  it("1. InspektorObjek: Ambil elevasi, Konversikan ke Area, Tampilkan Grafik durasi nyata, Edit Lapisan, Edit Skema Atribut, dan Simpan Otomatis berfungsi penuh", () => {
    const onPerbaruiObjek = vi.fn();
    const onKonversiKeArea = vi.fn();
    const onBukaHalamanLapisan = vi.fn();
    const onTutup = vi.fn();

    const root = pasang(
      <InspektorObjek
        objek={contohJalur}
        kondisiUpdateInput=""
        setKondisiUpdateInput={vi.fn()}
        onTambahPembaruanObjek={vi.fn(() => true)}
        onPerbaruiObjek={onPerbaruiObjek}
        elevasiGpsMeter={512.78}
        onKonversiKeArea={onKonversiKeArea}
        onBukaHalamanLapisan={onBukaHalamanLapisan}
        onGoTo={vi.fn()}
        onTutup={onTutup}
      />
    );

    // 1a. Durasi grafik dihitung nyata dari timestamp koordinat (00:30:45), bukan hardcoded 00:39:59
    expect(root.textContent).toContain("00:30:45");
    expect(root.textContent).not.toContain("00:39:59");
    klik(cariTombol(root, "Dist: 3,45 km"));
    expect(root.textContent).toContain("Jumlah simpul: 3 titik GPS");

    // 1b. Tombol Ambil elevasi langsung memperbarui elevasi objek dari GPS
    klik(cariTombol(root, "Ambil elevasi"));
    expect(onPerbaruiObjek).toHaveBeenCalledWith(
      expect.objectContaining({ id: "line-audit-1", elevasi: 512.78 })
    );

    // 1c. Tombol Konversikan ke Area mengalir langsung ke handler konversi poligon
    klik(cariTombol(root, "Konversikan ke Area"));
    expect(onKonversiKeArea).toHaveBeenCalledTimes(1);

    // 1d. Tombol Edit Lapisan langsung membuka halaman Lapisan Peta saat belum ada daftar lapisan
    klik(cariTombol(root, "Edit Lapisan"));
    expect(onBukaHalamanLapisan).toHaveBeenCalledTimes(1);

    // 1e. Skema atribut tampil untuk Line/Polygon dan dapat menambah atribut kustom baru
    klik(cariTombol(root, "Kumpulkan data menggunakan atribut"));
    const inputKunci = root.querySelector('input[aria-label="Nama atribut baru"]') as HTMLInputElement;
    const inputNilai = root.querySelector('input[aria-label="Nilai atribut baru"]') as HTMLInputElement;
    expect(inputKunci).toBeTruthy();
    ubahInput(inputKunci, "Kondisi Jalur");
    ubahInput(inputNilai, "Bersih");
    klik(cariTombol(root, "Selesai"));
    expect(onPerbaruiObjek).toHaveBeenCalledWith(
      expect.objectContaining({
        atributKustom: { "Kondisi Jalur": "Bersih" }
      })
    );

    // 1f. Saat input Nama masih terbuka lalu pengguna langsung menekan tombol centang Simpan di header, perubahan tetap disimpan
    klik(cariTombol(root, "Jalur Patroli Utara"));
    const inputNama = root.querySelector('input[aria-label="Edit nama objek"]') as HTMLInputElement;
    ubahInput(inputNama, "Jalur Patroli Barat");
    klik(root.querySelector('button[aria-label="Simpan"]'));
    expect(onPerbaruiObjek).toHaveBeenCalledWith(
      expect.objectContaining({ judul: "Jalur Patroli Barat" })
    );
    // 1g. PeekSheetInteraktif pada mode objek_terpilih juga menyediakan tombol centang simpan perubahan dan Edit Lapisan mengalir
    const onSimpanPeek = vi.fn();
    const onLapisanPeek = vi.fn();
    const rootPeek = pasang(
      <PeekSheetInteraktif
        mode="objek_terpilih"
        tahapAwal="penuh"
        objekTerpilih={contohJalur}
        onPerbaruiObjek={onSimpanPeek}
        onBukaHalamanLapisan={onLapisanPeek}
        onBukaFormLengkap={vi.fn()}
        onBukaDetailLengkap={vi.fn()}
        onTutup={vi.fn()}
        onGoTo={vi.fn()}
        onBagikan={vi.fn()}
      />
    );
    klik(cariTombol(rootPeek, "Edit Lapisan"));
    expect(onLapisanPeek).toHaveBeenCalledTimes(1);
    klik(rootPeek.querySelector('button[aria-label="Simpan perubahan objek"]'));
    expect(onSimpanPeek).toHaveBeenCalledTimes(1);
  });

  it("2. PemberitahuanView & PanelDataUserLevel: langsung menampilkan tugas aktif, mengaktifkan lapisan tugas, dan memfungsikan tombol Lihat di Peta", () => {
    const onBukaTargetDiPeta = vi.fn();
    const rootNotif = pasang(
      <PemberitahuanView
        pengumumanList={[]}
        tugasList={[
          {
            id: "TGS-01",
            judul: "Survei Mata Air Desa",
            deskripsi: "Petakan sumber mata air",
            targetWilayah: "Desa Rimba",
            jenisTargetGeometri: "point",
            targetKuantitas: "5 titik",
            batasWaktu: "2026-12-01",
            koordinatAcuan: { lat: 3.9, lng: 115.9 },
            status: "aktif",
            dibuatOleh: "Admin GIS"
          }
        ]}
        onTutup={vi.fn()}
        onBukaTargetDiPeta={onBukaTargetDiPeta}
        onTandaiTugasSelesai={vi.fn()}
      />
    );

    // Langsung menampilkan daftar tugas aktif, bukan layar kosong "Tidak ada pemberitahuan baru"
    expect(rootNotif.textContent).toContain("Survei Mata Air Desa");
    klik(cariTombol(rootNotif, "Buka di Peta"));
    expect(onBukaTargetDiPeta).toHaveBeenCalledWith(3.9, 115.9, "Survei Mata Air Desa", "TGS-01");

    // PanelDataUserLevel memfungsikan onFokusPetaKader lewat tombol Lihat di Peta
    const onFokusPetaKader = vi.fn();
    const rootLevel = pasang(
      <PanelDataUserLevel
        dataSpasial={[contohJalur]}
        profilSaya={profilKaderUji}
        onFokusPetaKader={onFokusPetaKader}
      />
    );
    klik(cariTombol(rootLevel, "Lihat di Peta"));
    expect(onFokusPetaKader).toHaveBeenCalledWith(3.9, 115.9, "Kader Audit");
  });

  it("3. PustakaView & PengaturanEksporView: mencegah broken img pmtiles://, memfungsikan filter Lapisan, dan menyaring ekspor berdasarkan lapisanNama", () => {
    const rootPustaka = pasang(
      <PustakaView
        areaOffline={[
          {
            id: "map-pm-1",
            namaArea: "Peta PMTiles Desa",
            basemapId: "topo",
            minLat: 3.8,
            maxLat: 4.0,
            minLng: 115.8,
            maxLng: 116.0,
            zoomMin: 10,
            zoomMax: 16,
            jumlahTile: 0,
            ukuranMb: 4.2,
            petaKustomUrl: "pmtiles://map-pm-1/{z}/{x}/{y}",
            diunduhPada: new Date().toISOString()
          }
        ]}
        lapisanList={[
          { id: "lap-1", nama: "Lapisan Tugas A", jumlahPeta: 1, tugasId: "T1", createdAt: new Date().toISOString() },
          { id: "lap-2", nama: "Lapisan Umum B", jumlahPeta: 1, createdAt: new Date().toISOString() }
        ]}
        dataSpasial={[contohJalur]}
        modePilihAktif={false}
        onMatikanModePilih={vi.fn()}
        onBukaPetaDasar={vi.fn()}
        onBukaAreaPeta={vi.fn()}
        onTambahAreaOffline={vi.fn()}
        onHapusAreaOffline={vi.fn()}
        onHapusLapisan={vi.fn()}
        onBukaPengaturanEkspor={vi.fn()}
      />
    );

    // Tidak ada elemen <img> yang memakai src="pmtiles://..."
    const semuaImg = Array.from(rootPustaka.querySelectorAll("img"));
    expect(semuaImg.every((img) => !img.getAttribute("src")?.startsWith("pmtiles://"))).toBe(true);

    // Pindah ke tab Lapisan dan uji filter Tugas lapangan vs Lapisan umum
    klik(cariTombol(rootPustaka, "Lapisan"));
    const selectFilter = rootPustaka.querySelectorAll("select.avenza-pill-select")[1] as HTMLSelectElement;
    expect(selectFilter).toBeTruthy();
    ubahInput(selectFilter, "tugas");
    expect(rootPustaka.textContent).toContain("Lapisan Tugas A");
    expect(rootPustaka.textContent).not.toContain("Lapisan Umum B");

    // filterDataUntukEkspor mendukung pencocokan berdasarkan lapisanNama
    const tersaring = filterDataUntukEkspor([contohJalur], {
      jenisData: "Hanya lapisan",
      filterTematik: "Patroli Hutan"
    });
    expect(tersaring).toHaveLength(1);

    // PengaturanEksporView mengisi namaFile otomatis dari konteksEkspor
    const rootEkspor = pasang(
      <PengaturanEksporView
        dataSpasial={[contohJalur]}
        konteksEkspor={{
          lapisanDipilih: [{ id: "lap-1", nama: "Patroli Hutan", jumlahPeta: 1, createdAt: new Date().toISOString() }]
        }}
        onTutup={vi.fn()}
      />
    );
    const inputNamaFile = rootEkspor.querySelector('input[placeholder="Lapisan 1"]') as HTMLInputElement;
    expect(inputNamaFile.value).toBe("Patroli Hutan");
  });

  it("4. Keamanan: sanitasiAtributKustom menolak kunci prototipe/sensitif, eksporKeGeoJSON mencegah spoofing flag simulasi/diimpor, dan KUNCI_DATA mencakup pencadangan", () => {
    expect(KUNCI_DATA).toContain("geokader_pencadangan_spasial_v5");

    const kotor = JSON.parse(
      '{"__proto__":"jahat","constructor":"jahat","simulasi":"false","diimpor":"false","Nama Pohon":"<script>alert(1)</script>Meranti"}'
    ) as Record<string, string>;
    const bersih = sanitasiAtributKustom(kotor);
    expect(Object.keys(bersih)).toEqual(["Nama Pohon"]);
    expect(bersih["Nama Pohon"]).toBe("Meranti");

    const itemSimulasi: DataSpasialItem = {
      ...contohJalur,
      jenisGeometri: "point",
      koordinat: [{ lat: 3.9, lng: 115.9, simulasi: true }],
      diimpor: true,
      atributKustom: kotor
    };
    const geo = JSON.parse(eksporKeGeoJSON([itemSimulasi]));
    expect(geo.features[0].properties.simulasi).toBe(true);
    expect(geo.features[0].properties.diimpor).toBe(true);
    expect(geo.features[0].properties["Nama Pohon"]).toBe("Meranti");
  });

  it("5. Keamanan Obrolan & Bebas Dialog Native: kader tidak dapat menghapus pesan milik pengguna lain dan kode bebas dari alert/confirm/prompt", () => {
    const onHapusPesan = vi.fn();
    const rootChat = pasang(
      <KomunikasiView
        pesanList={[
          {
            id: "msg-orang-lain",
            saluran: "komunitas",
            idPengirim: "KDR-LAIN-99",
            namaPengirim: "Kader Lain",
            peranPengirim: "kader",
            desaPengirim: "Desa Sebelah",
            teks: "Halo dari desa sebelah",
            waktu: "09:00",
            statusKirim: "tersimpan"
          }
        ]}
        profil={profilKaderUji}
        peranPengguna="kader"
        onKirimPesan={vi.fn()}
        onHapusPesan={onHapusPesan}
        onLihatPinDiPeta={vi.fn()}
      />
    );

    // Pilih pesan milik orang lain lewat contextmenu
    const balon = rootChat.querySelector(".chat-bubble-item") as HTMLElement;
    expect(balon).toBeTruthy();
    act(() => {
      balon.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });
    expect(rootChat.textContent).toContain("1 pesan dipilih");
    // Tombol Hapus Pesan tidak boleh muncul untuk pesan milik orang lain saat bukan admin
    expect(rootChat.querySelector('button[aria-label="Hapus Pesan"]')).toBeNull();

    // Pastikan RewardView sudah bebas dari alert() native
    const rewardSrc = readFileSync(resolve(__dirname, "../components/RewardView.tsx"), "utf8");
    expect(rewardSrc).not.toMatch(/\balert\s*\(/);
  });
});
