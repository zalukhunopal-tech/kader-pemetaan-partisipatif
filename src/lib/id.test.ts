import { afterEach, describe, expect, it, vi } from "vitest";
import { buatId, unikkanId } from "./id";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("buatId", () => {
  it("awalan + 12 karakter heksadesimal", () => {
    expect(buatId("KDR")).toMatch(/^KDR-[0-9a-f]{12}$/);
  });

  it("20.000 ID berturut-turut tidak ada yang kembar", () => {
    const set = new Set(Array.from({ length: 20000 }, () => buatId("T")));
    expect(set.size).toBe(20000);
  });

  it("memakai randomUUID bila ada (12 karakter pertama tanpa tanda hubung)", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "12345678-9abc-4def-8123-456789abcdef" });
    expect(buatId("P")).toBe("P-123456789abc");
  });

  it("cadangan getRandomValues di konteks tanpa randomUUID (mis. HTTP di jaringan lokal)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (a: Uint8Array) => {
        a.fill(0xab);
        return a;
      }
    });
    expect(buatId("X")).toBe("X-abababababab");
  });

  it("cadangan terakhir Math.random bila tidak ada crypto sama sekali", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(buatId("Z")).toBe("Z-888888888888");
  });
});

describe("unikkanId", () => {
  it("daftar yang sudah unik dikembalikan apa adanya (referensi sama)", () => {
    const daftar = [{ id: "A-1" }, { id: "A-2" }];
    expect(unikkanId(daftar)).toBe(daftar);
  });

  it("entri pertama mempertahankan ID; kembarannya mendapat ID baru berawalan sama", () => {
    const daftar = [
      { id: "MSG-1234", teks: "pertama" },
      { id: "MSG-1234", teks: "kedua" },
      { id: "MSG-1234", teks: "ketiga" }
    ];
    const hasil = unikkanId(daftar);
    expect(hasil[0]).toBe(daftar[0]);
    expect(hasil.map((x) => x.teks)).toEqual(["pertama", "kedua", "ketiga"]);
    expect(new Set(hasil.map((x) => x.id)).size).toBe(3);
    expect(hasil[1].id).toMatch(/^MSG-[0-9a-f]{12}$/);
    expect(hasil[2].id).toMatch(/^MSG-[0-9a-f]{12}$/);
  });

  it("tidak mengubah daftar masukan", () => {
    const daftar = [{ id: "A-1" }, { id: "A-1" }];
    unikkanId(daftar);
    expect(daftar.map((x) => x.id)).toEqual(["A-1", "A-1"]);
  });

  it("ID tanpa awalan yang bisa dibaca memakai awalan ID", () => {
    const hasil = unikkanId([{ id: "-x" }, { id: "-x" }]);
    expect(hasil[1].id).toMatch(/^ID-[0-9a-f]{12}$/);
  });
});
