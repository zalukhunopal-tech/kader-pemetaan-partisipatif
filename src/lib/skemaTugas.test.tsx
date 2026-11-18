// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { NavigasiBawah } from "../components/app/NavigasiBawah";
import { FormSurveiModal, useFormSurvei } from "../components/peta/FormSurveiModal";
import { LapisanSpasial, ProfilKader, TugasPemetaan } from "../types";
import {
  buatFieldSkemaBaru,
  buatSkemaKosong,
  hitungRingkasSkema,
  sinkronkanLapisanDariTugas,
  validasiIsianSkema
} from "./skemaTugas";

const profilUji: ProfilKader = {
  idKader: "KDR-UJI",
  nama: "Kader Uji",
  desaWilayah: "Desa Uji",
  kelompokMasyarakat: "KTH Uji",
  noHp: "08123",
  namaOrganisasi: "Organisasi Uji",
  modeKombinasiTarget: "per_kategori"
};

describe("Skema Tugas Admin & Lapisan Peta Interaktif", () => {
  it("menyelaraskan Tugas Admin (Point, Line, Polygon) ke LapisanSpasial tanpa menghapus lapisan user", () => {
    const skema = buatSkemaKosong();
    skema.point = [buatFieldSkemaBaru({ nama: "Jenis Pohon", tipe: "teks", wajib: true })];
    skema.line = [buatFieldSkemaBaru({ nama: "Kondisi Jalur", tipe: "pilihan", wajib: true, opsi: ["Baik", "Rusak"] })];
    skema.polygon = [buatFieldSkemaBaru({ nama: "Tutupan Lahan", tipe: "teks", wajib: false })];

    const tugas: TugasPemetaan = {
      id: "TSK-100",
      judul: "Inventarisasi Hutan Adat",
      deskripsi: "Pemetaan blok",
      targetWilayah: "Blok Timur",
      jenisTargetGeometri: "polygon",
      kategoriTarget: "Flora",
      targetKuantitas: "10 Titik",
      batasWaktu: "2026-12-31",
      koordinatAcuan: { lat: 2.85, lng: 117.37 },
      skemaGeometri: skema,
      status: "aktif",
      dibuatOleh: "Admin GIS"
    };

    const lapisanUser: LapisanSpasial = {
      id: "LAP-USER-1",
      nama: "Lapisan Pribadi",
      jumlahPeta: 0,
      createdAt: "2026-11-01T00:00:00.000Z"
    };

    const synced = sinkronkanLapisanDariTugas([lapisanUser], [tugas]);
    expect(synced).toHaveLength(2);
    const lapisanTugas = synced.find((l) => l.tugasId === "TSK-100");
    expect(lapisanTugas?.nama).toBe("Inventarisasi Hutan Adat");
    expect(hitungRingkasSkema(lapisanTugas?.skemaGeometri)).toEqual({ total: 3, point: 1, line: 1, polygon: 1 });
    expect(synced.some((l) => l.id === "LAP-USER-1")).toBe(true);

    // Tugas diperbarui -> lapisan ikut diperbarui
    const tugasDiubah = { ...tugas, judul: "Inventarisasi Revisi" };
    const updated = sinkronkanLapisanDariTugas(synced, [tugasDiubah]);
    expect(updated.find((l) => l.tugasId === "TSK-100")?.nama).toBe("Inventarisasi Revisi");

    // Tugas dihapus -> lapisan tugas dihapus, lapisan user aman
    const afterDelete = sinkronkanLapisanDariTugas(updated, []);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].id).toBe("LAP-USER-1");
  });

  it("memvalidasi isian wajib skema kustom dengan tepat", () => {
    const fields = [
      buatFieldSkemaBaru({ nama: "Kode Patok", tipe: "teks", wajib: true }),
      buatFieldSkemaBaru({ nama: "Catatan", tipe: "catatan", wajib: false })
    ];
    expect(validasiIsianSkema(fields, {})).toContain("Kode Patok");
    expect(validasiIsianSkema(fields, { [fields[0].id]: "PTK-01" })).toBeNull();
  });

  it("NavigasiBawah memakai label tab 'Peta' (menggantikan 'Temukan') baik untuk kader maupun admin", () => {
    const htmlKader = renderToString(
      <NavigasiBawah peran="kader" tabAktif="peta" setTabAktif={vi.fn()} antreanLokalCount={0} onModeUser={vi.fn()} />
    );
    const htmlAdmin = renderToString(
      <NavigasiBawah peran="admin" tabAktif="peta" setTabAktif={vi.fn()} antreanLokalCount={0} onModeUser={vi.fn()} />
    );
    expect(htmlKader).toContain(">Peta<");
    expect(htmlKader).not.toContain(">Temukan<");
    expect(htmlAdmin).toContain(">Peta<");
    expect(htmlAdmin).not.toContain(">Temukan<");
  });

  it("FormSurveiModal merender mode default Avenza saat tanpa skema tugas dan merender skema Admin saat lapisan tugas dipilih", () => {
    const Wrapper: React.FC<{ lapisanAktif?: LapisanSpasial | null; mode: "point" | "line" }> = ({ lapisanAktif = null, mode }) => {
      const form = useFormSurvei("KDR-UJI");
      return (
        <FormSurveiModal
          form={form}
          modeRekam={mode}
          panjangDraftKm={12.34}
          luasDraftHa={0}
          profil={profilUji}
          koordinat={[
            { lat: 3.904544, lng: 115.986396, elevasi: 640.23 },
            { lat: 3.905, lng: 115.987, elevasi: 642 }
          ]}
          onHasilAveraging={vi.fn()}
          onSimpan={vi.fn()}
          onTutup={vi.fn()}
          lapisanAktif={lapisanAktif}
        />
      );
    };

    const htmlDefaultPoint = renderToString(<Wrapper mode="point" />);
    expect(htmlDefaultPoint).toContain("Pin dijatuhkan");
    expect(htmlDefaultPoint).toContain("Lapisan saat ini");
    expect(htmlDefaultPoint).toContain("Edit Lapisan");
    expect(htmlDefaultPoint).toContain("Ambil elevasi");
    expect(htmlDefaultPoint).toContain("Skema atribut");

    const htmlDefaultLine = renderToString(<Wrapper mode="line" />);
    expect(htmlDefaultLine).toContain("Trek");
    expect(htmlDefaultLine).toContain("Tampilkan Grafik");
    expect(htmlDefaultLine).toContain("Konversikan ke Area");

    const skema = buatSkemaKosong();
    skema.point = [buatFieldSkemaBaru({ nama: "Diameter Tajuk (m)", tipe: "angka", wajib: true })];
    const lapisanAdmin: LapisanSpasial = {
      id: "LAP-TGS-1",
      nama: "Tugas Ekologi",
      jumlahPeta: 1,
      tugasId: "TSK-1",
      skemaGeometri: skema,
      createdAt: "2026-11-18T00:00:00.000Z"
    };
    const htmlTugasPoint = renderToString(<Wrapper mode="point" lapisanAktif={lapisanAdmin} />);
    expect(htmlTugasPoint).toContain("Lapisan Tugas Admin: Tugas Ekologi");
    expect(htmlTugasPoint).toContain("Diameter Tajuk (m)");
  });
});
