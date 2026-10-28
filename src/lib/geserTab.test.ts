// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { abaikanGeserDari, arahGeser, tabTujuan } from "./geserTab";

const s = (x: number, y: number, t = 0) => ({ x, y, t });

describe("arahGeser", () => {
  it("geser ke kiri = tab berikutnya, ke kanan = tab sebelumnya", () => {
    expect(arahGeser(s(300, 400), s(150, 410, 200))).toBe(1);
    expect(arahGeser(s(100, 400), s(260, 395, 200))).toBe(-1);
  });
  it("jarak pendek, gerak lambat, atau gerak diagonal/vertikal bukan pindah tab", () => {
    expect(arahGeser(s(200, 400), s(150, 400, 100))).toBe(0); // 50 px
    expect(arahGeser(s(300, 400), s(100, 400, 900))).toBe(0); // terlalu lambat
    expect(arahGeser(s(300, 400), s(180, 330, 200))).toBe(0); // dx 120, dy 70: gulir diagonal
    expect(arahGeser(s(200, 600), s(190, 200, 200))).toBe(0); // gulir vertikal
  });
});

describe("tabTujuan", () => {
  const urutan = ["pustaka", "peta", "data_sync"] as const;
  it("berpindah satu langkah dan berhenti di ujung", () => {
    expect(tabTujuan(urutan, "pustaka", 1)).toBe("peta");
    expect(tabTujuan(urutan, "peta", -1)).toBe("pustaka");
    expect(tabTujuan(urutan, "data_sync", 1)).toBe("data_sync");
    expect(tabTujuan(urutan, "pustaka", -1)).toBe("pustaka");
    expect(tabTujuan(urutan, "peta", 0)).toBe("peta");
  });
  it("tab di luar urutan tidak berubah", () => {
    expect(tabTujuan(urutan as readonly string[], "admin", 1)).toBe("admin");
  });
});

describe("abaikanGeserDari", () => {
  it("peta, isian, dan elemen bertanda data-tanpa-geser diabaikan", () => {
    document.body.innerHTML = `
      <div class="map-canvas-container"><canvas id="c"></canvas><button id="dalamPeta">x</button></div>
      <input id="i" /><div data-tanpa-geser><span id="span">a</span></div>
      <div id="biasa"><p id="p">teks</p></div>`;
    expect(abaikanGeserDari(document.getElementById("c"))).toBe(true);
    expect(abaikanGeserDari(document.getElementById("dalamPeta"))).toBe(true);
    expect(abaikanGeserDari(document.getElementById("i"))).toBe(true);
    expect(abaikanGeserDari(document.getElementById("span"))).toBe(true);
    expect(abaikanGeserDari(document.getElementById("p"))).toBe(false);
    expect(abaikanGeserDari(null)).toBe(false);
  });
});
