// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { ALG_ES256, ALG_RS256, bacaSignCount, dariBase64Url, derKeMentah, keBase64Url, verifikasiAsersi } from "./webauthn";

const enc = new TextEncoder();
const ASAL = "https://geokader.contoh.id";
const RP = "geokader.contoh.id";

/** r||s mentah (WebCrypto) menjadi DER, seperti yang dikirim autentikator */
function mentahKeDer(mentah: Uint8Array): Uint8Array {
  const bilangan = (b: Uint8Array) => {
    let v = b;
    while (v.length > 1 && v[0] === 0) v = v.slice(1);
    if (v[0] & 0x80) v = Uint8Array.from([0, ...v]);
    return Uint8Array.from([0x02, v.length, ...v]);
  };
  const r = bilangan(mentah.slice(0, 32));
  const s = bilangan(mentah.slice(32));
  return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]);
}

function dataAutentikator(bendera: number, rp = RP, signCount = 7): Uint8Array {
  const ad = new Uint8Array(37);
  ad.set(sha256(enc.encode(rp)), 0);
  ad[32] = bendera;
  new DataView(ad.buffer).setUint32(33, signCount, false);
  return ad;
}

async function buatAsersi(
  opsi: { alg?: number; bendera?: number; jenis?: string; asal?: string; rp?: string; tantanganLain?: boolean; signCount?: number } = {}
) {
  const alg = opsi.alg ?? ALG_ES256;
  const pasangan =
    alg === ALG_ES256
      ? await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
      : await crypto.subtle.generateKey(
          { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
          true,
          ["sign", "verify"]
        );
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pasangan.publicKey));
  const tantangan = crypto.getRandomValues(new Uint8Array(32));
  const dikirim = opsi.tantanganLain ? crypto.getRandomValues(new Uint8Array(32)) : tantangan;
  const dataKlienJson = enc.encode(
    JSON.stringify({ type: opsi.jenis ?? "webauthn.get", challenge: keBase64Url(dikirim), origin: opsi.asal ?? ASAL })
  );
  const ad = dataAutentikator(opsi.bendera ?? 0x05, opsi.rp, opsi.signCount ?? 7);
  const pesan = new Uint8Array([...ad, ...sha256(dataKlienJson)]);
  const ttd =
    alg === ALG_ES256
      ? mentahKeDer(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pasangan.privateKey, pesan)))
      : new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pasangan.privateKey, pesan));
  return { kunciPublikSpki: spki, alg, tantangan, asal: ASAL, rpId: RP, dataKlienJson, dataAutentikator: ad, tandaTangan: ttd };
}

describe("verifikasi sidik jari / wajah (WebAuthn)", () => {
  it("asersi ES256 yang sah diterima", async () => {
    expect(await verifikasiAsersi(await buatAsersi())).toBe(true);
  });

  it("asersi RS256 (mis. Windows Hello) yang sah diterima", async () => {
    expect(await verifikasiAsersi(await buatAsersi({ alg: ALG_RS256 }))).toBe(true);
  }, 20_000);

  it("tanpa verifikasi pengguna (hanya sentuhan, bendera UV mati) ditolak", async () => {
    expect(await verifikasiAsersi(await buatAsersi({ bendera: 0x01 }))).toBe(false);
  });

  it("tantangan lama/lain, origin lain, host lain, atau jenis lain ditolak", async () => {
    expect(await verifikasiAsersi(await buatAsersi({ tantanganLain: true }))).toBe(false);
    expect(await verifikasiAsersi(await buatAsersi({ asal: "https://palsu.contoh" }))).toBe(false);
    expect(await verifikasiAsersi(await buatAsersi({ rp: "palsu.contoh" }))).toBe(false);
    expect(await verifikasiAsersi(await buatAsersi({ jenis: "webauthn.create" }))).toBe(false);
  });

  it("tanda tangan yang diubah atau kunci publik lain ditolak", async () => {
    const a = await buatAsersi();
    const ubah = a.tandaTangan.slice();
    ubah[ubah.length - 1] ^= 0xff;
    expect(await verifikasiAsersi({ ...a, tandaTangan: ubah })).toBe(false);
    const lain = await buatAsersi();
    expect(await verifikasiAsersi({ ...a, kunciPublikSpki: lain.kunciPublikSpki })).toBe(false);
    expect(await verifikasiAsersi({ ...a, alg: -8 })).toBe(false);
  });

  it("mendeteksi kloning/replay autentikator lewat signCount (bacaSignCount & signCountTerakhir)", async () => {
    const a = await buatAsersi({ signCount: 10 });
    expect(bacaSignCount(a.dataAutentikator)).toBe(10);
    expect(await verifikasiAsersi({ ...a, signCountTerakhir: 9 })).toBe(true);
    expect(await verifikasiAsersi({ ...a, signCountTerakhir: 10 })).toBe(false);
    expect(await verifikasiAsersi({ ...a, signCountTerakhir: 15 })).toBe(false);
  });

  it("DER ke r||s mentah, termasuk bilangan berawalan nol dan DER rusak", () => {
    const r = new Uint8Array(32).fill(0x81);
    const s = new Uint8Array(32);
    s[31] = 5;
    const mentah = derKeMentah(mentahKeDer(new Uint8Array([...r, ...s])))!;
    expect(Array.from(mentah.slice(0, 32))).toEqual(Array.from(r));
    expect(Array.from(mentah.slice(32))).toEqual(Array.from(s));
    expect(derKeMentah(new Uint8Array([0x31, 0]))).toBeNull();
    expect(derKeMentah(new Uint8Array([0x30, 6, 0x02, 1, 1, 0x02, 1, 1, 9]))).toBeNull();
  });

  it("base64url bolak-balik", () => {
    for (const n of [0, 1, 2, 3, 31, 32]) {
      const b = crypto.getRandomValues(new Uint8Array(n));
      expect(Array.from(dariBase64Url(keBase64Url(b)))).toEqual(Array.from(b));
    }
  });
});
