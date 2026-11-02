// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "../components/peta/BottomSheet";
import { FormSurveiModal, useFormSurvei } from "../components/peta/FormSurveiModal";
import { bacaDraftSurvei, simpanDraftSurvei, DRAFT_KOSONG } from "./draftSurvei";
import { setelUlangPenyimpananUntukUji } from "./penyimpanan";
import { ProfilKader } from "../types";
let root: Root | undefined, el: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setelUlangPenyimpananUntukUji();
  localStorage.clear();
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root?.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
const render = (element: React.ReactElement) => act(() => root!.render(element));
const button = (text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
const profil: ProfilKader = {
  idKader: "A",
  nama: "Kader A",
  desaWilayah: "Desa A",
  kelompokMasyarakat: "Kelompok",
  noHp: "",
  namaOrganisasi: "Program",
  modeKombinasiTarget: "per_kategori"
};
describe("UI lapangan", () => {
  it("panel tiga tahap dapat dipakai dengan keyboard dan Escape", () => {
    const tutup = vi.fn();
    render(
      React.createElement(BottomSheet, {
        judul: "Lapisan",
        onTutup: tutup,
        children: React.createElement("p", null, "Peta tetap terlihat")
      })
    );
    const panel = el.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(panel.getAttribute("aria-modal")).toBe("false");
    act(() => button("92%").click());
    expect(panel.style.getPropertyValue("--sheet-size")).toBe("92dvh");
    act(() => el.querySelector(".field-sheet-grip")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(panel.style.getPropertyValue("--sheet-size")).toBe("55dvh");
    act(() => panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(tutup).toHaveBeenCalledOnce();
  });
  it("memilih kategori visual membuka atribut batas beserta saksi, bukan kategori lain", () => {
    function Form() {
      const form = useFormSurvei("A");
      return React.createElement(FormSurveiModal, {
        form,
        profil,
        modeRekam: "point",
        koordinat: [{ lat: -2, lng: 102 }],
        panjangDraftKm: 0,
        luasDraftHa: 0,
        onSimpan: vi.fn(),
        onTutup: vi.fn(),
        onHasilAveraging: vi.fn()
      });
    }
    render(React.createElement(Form));
    expect(el.querySelector("input[required]")).toBeNull();
    act(() => button("Batas desa / adat").click());
    expect(el.querySelector("input[required]")).not.toBeNull();
    expect(el.textContent).toContain("Saksi Lapangan / Tokoh Desa");
    expect(bacaDraftSurvei("A").kategori).toBe("Tanda Batas");
    act(() => button("Ganti kategori").click());
    act(() => button("Flora & tumbuhan").click());
    expect(el.textContent).not.toContain("Saksi Lapangan / Tokoh Desa");
  });
  it("memulihkan draf tiap akun dan tidak mencampur foto/saksi/geometri", () => {
    simpanDraftSurvei("A", {
      ...DRAFT_KOSONG,
      judul: "Pohon",
      foto: "data:image/jpeg;base64,QQ==",
      saksi: "Ibu Desa",
      rekaman: { jenis: "point", titik: [{ lat: -2, lng: 102 }] }
    });
    simpanDraftSurvei("B", { ...DRAFT_KOSONG, judul: "Sungai" });
    expect(bacaDraftSurvei("A").rekaman?.titik[0].lng).toBe(102);
    expect(bacaDraftSurvei("A").saksi).toBe("Ibu Desa");
    expect(bacaDraftSurvei("B").foto).toBe("");
    expect(bacaDraftSurvei("C").judul).toBe("");
  });
});

it("finalisation audio setelah peta ditutup tetap masuk draf akun asal", () => {
  let terima: ReturnType<typeof useFormSurvei>["tambahMemo"] | undefined;
  function Draft() {
    const form = useFormSurvei("A");
    React.useEffect(() => {
      terima = form.tambahMemo;
    }, [form]);
    return null;
  }
  render(React.createElement(Draft));
  act(() => root!.unmount());
  root = undefined;
  simpanDraftSurvei("B", { ...DRAFT_KOSONG, judul: "Draf akun lain" });
  terima!({
    id: "memo-akhir",
    mimeType: "audio/webm;codecs=opus",
    dataUrl: "data:audio/webm;base64,QQ==",
    durasiDetik: 1,
    ukuranByte: 1,
    direkamPada: "2026-11-02T00:00:00Z",
    sha256: "checksum-uji"
  });
  expect(bacaDraftSurvei("A").memo[0].id).toBe("memo-akhir");
  expect(bacaDraftSurvei("B").memo).toEqual([]);
  expect(bacaDraftSurvei("B").judul).toBe("Draf akun lain");
});
