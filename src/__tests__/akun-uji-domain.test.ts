import { describe, expect, it } from "vitest";
import { adalahEmailAkunUji } from "../lib/auth";

describe("pembersihan akun uji saat aplikasi dibuka", () => {
  it("hanya domain uji yang dianggap akun dummy", () => {
    expect(adalahEmailAkunUji("admin@contoh.id")).toBe(true);
    expect(adalahEmailAkunUji("KADER@Test.ID")).toBe(true);
    expect(adalahEmailAkunUji("budi@dummy.id")).toBe(true);
    expect(adalahEmailAkunUji("budi@mail.testing-desa.org")).toBe(true);
  });

  it("akun asli yang nama emailnya memuat kata testing atau dummy tidak ikut terhapus", () => {
    expect(adalahEmailAkunUji("testingsari@desa.id")).toBe(false);
    expect(adalahEmailAkunUji("pak.dummyanto@nunukankab.go.id")).toBe(false);
    expect(adalahEmailAkunUji("kontoh.id@desa.id")).toBe(false);
    expect(adalahEmailAkunUji("bukan-email")).toBe(false);
  });
});
