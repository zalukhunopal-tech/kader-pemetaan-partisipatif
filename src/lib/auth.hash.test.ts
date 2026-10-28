import { describe, expect, it } from "vitest";
import { turunkanKunci } from "./auth";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const enc = new TextEncoder();

describe("PBKDF2-HMAC-SHA256", () => {
  it("cocok dengan vektor uji resmi (password/salt, 1 iterasi)", async () => {
    expect(hex(await turunkanKunci("password", enc.encode("salt"), 1))).toBe(
      "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b"
    );
  });
  it("cocok dengan vektor uji resmi (password/salt, 4096 iterasi)", async () => {
    expect(hex(await turunkanKunci("password", enc.encode("salt"), 4096))).toBe(
      "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a"
    );
  });
  it("WebCrypto dan pustaka cadangan menghasilkan keluaran yang sama", async () => {
    expect(globalThis.crypto?.subtle).toBeDefined(); // lingkungan node menyediakan WebCrypto
    const garam = enc.encode("garam-acak-16byte");
    for (const sandi of ["kata sandi uji", "päßwörd ☂ 密码", "x"]) {
      const a = await turunkanKunci(sandi, garam, 3000, false);
      const b = await turunkanKunci(sandi, garam, 3000, true);
      expect(hex(a)).toBe(hex(b));
    }
  });
  it("sandi dinormalkan (NFKC) sehingga bentuk Unicode setara menghasilkan hash sama", async () => {
    const garam = enc.encode("garam");
    const a = await turunkanKunci("é", garam, 100);
    const b = await turunkanKunci("é", garam, 100);
    expect(hex(a)).toBe(hex(b));
  });
});
