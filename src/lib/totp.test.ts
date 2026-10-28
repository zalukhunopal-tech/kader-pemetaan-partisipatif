import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  buatKodePemulihan,
  buatRahasiaTotp,
  hashKodePemulihan,
  hitungTotp,
  langkahWaktu,
  miripKodePemulihan,
  normalisasiKodePemulihan,
  periksaTotp,
  rahasiaUntukTampil,
  uriOtpauth
} from "./totp";

// RFC 6238 lampiran B: rahasia ASCII "12345678901234567890", SHA-1; kode 6 digit = 6 digit terakhir
const RAHASIA_RFC = base32Encode(new TextEncoder().encode("12345678901234567890"));
const VEKTOR_RFC: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"]
];

describe("base32", () => {
  it("vektor RFC 4648", () => {
    const e = (s: string) => base32Encode(new TextEncoder().encode(s));
    expect(e("")).toBe("");
    expect(e("f")).toBe("MY");
    expect(e("fo")).toBe("MZXQ");
    expect(e("foo")).toBe("MZXW6");
    expect(e("foob")).toBe("MZXW6YQ");
    expect(e("fooba")).toBe("MZXW6YTB");
    expect(e("foobar")).toBe("MZXW6YTBOI");
  });
  it("decode kebalikan encode, abaikan spasi, huruf kecil, dan padding", () => {
    expect(new TextDecoder().decode(base32Decode("mzxw 6ytb-oi======")!)).toBe("foobar");
    const acak = crypto.getRandomValues(new Uint8Array(20));
    expect(Array.from(base32Decode(base32Encode(acak))!)).toEqual(Array.from(acak));
  });
  it("menolak karakter di luar alfabet dan masukan kosong", () => {
    expect(base32Decode("ABC1")).toBeNull(); // 1 bukan base32
    expect(base32Decode("ab!c")).toBeNull();
    expect(base32Decode("")).toBeNull();
  });
});

describe("TOTP (RFC 6238)", () => {
  it.each(VEKTOR_RFC)("waktu %i -> %s", (detik, kode) => {
    expect(hitungTotp(RAHASIA_RFC, detik * 1000)).toBe(kode);
  });

  it("kode berubah tiap 30 detik, tetap sama di dalam satu langkah", () => {
    const t0 = 1_700_000_010_000; // awal langkah + 10 dtk
    const awal = langkahWaktu(t0) * 30_000;
    expect(hitungTotp(RAHASIA_RFC, awal)).toBe(hitungTotp(RAHASIA_RFC, awal + 29_999));
    expect(hitungTotp(RAHASIA_RFC, awal)).not.toBe(hitungTotp(RAHASIA_RFC, awal + 30_000));
  });

  it("rahasia tidak sah menghasilkan null", () => {
    expect(hitungTotp("!!!")).toBeNull();
  });
});

describe("periksaTotp", () => {
  const T = 1_234_567_890_000;
  const kodeSaatIni = hitungTotp(RAHASIA_RFC, T)!;

  it("menerima kode saat ini dan mengembalikan langkahnya", () => {
    const r = periksaTotp(RAHASIA_RFC, kodeSaatIni, { sekarangMs: T });
    expect(r).toEqual({ ok: true, langkah: langkahWaktu(T) });
  });

  it("menerima selisih jam ±30 detik, menolak ±60 detik", () => {
    expect(periksaTotp(RAHASIA_RFC, hitungTotp(RAHASIA_RFC, T - 30_000)!, { sekarangMs: T }).ok).toBe(true);
    expect(periksaTotp(RAHASIA_RFC, hitungTotp(RAHASIA_RFC, T + 30_000)!, { sekarangMs: T }).ok).toBe(true);
    expect(periksaTotp(RAHASIA_RFC, hitungTotp(RAHASIA_RFC, T - 60_000)!, { sekarangMs: T }).ok).toBe(false);
    expect(periksaTotp(RAHASIA_RFC, hitungTotp(RAHASIA_RFC, T + 60_000)!, { sekarangMs: T }).ok).toBe(false);
  });

  it("menolak kode yang sudah dipakai (replay), tetapi menerima langkah yang lebih baru", () => {
    const pertama = periksaTotp(RAHASIA_RFC, kodeSaatIni, { sekarangMs: T });
    expect(periksaTotp(RAHASIA_RFC, kodeSaatIni, { sekarangMs: T, langkahTerakhir: pertama.langkah }).ok).toBe(false);
    // kode langkah sebelumnya juga tidak boleh dipakai setelah langkah ini terpakai
    expect(periksaTotp(RAHASIA_RFC, hitungTotp(RAHASIA_RFC, T - 30_000)!, { sekarangMs: T, langkahTerakhir: pertama.langkah }).ok).toBe(
      false
    );
    expect(periksaTotp(RAHASIA_RFC, hitungTotp(RAHASIA_RFC, T + 30_000)!, { sekarangMs: T, langkahTerakhir: pertama.langkah }).ok).toBe(
      true
    );
  });

  it("menolak masukan yang bukan 6 digit, kosong, atau rahasia tidak sah", () => {
    for (const k of ["", "12345", "1234567", "abcdef", "12 34"]) expect(periksaTotp(RAHASIA_RFC, k, { sekarangMs: T }).ok).toBe(false);
    expect(periksaTotp("!!!", kodeSaatIni, { sekarangMs: T }).ok).toBe(false);
  });

  it("menerima spasi di tengah kode (cara Authenticator menampilkannya: 123 456)", () => {
    const k = kodeSaatIni;
    expect(periksaTotp(RAHASIA_RFC, `${k.slice(0, 3)} ${k.slice(3)}`, { sekarangMs: T }).ok).toBe(true);
  });

  it("kode yang salah ditolak", () => {
    const salah = String((Number(kodeSaatIni) + 1) % 1_000_000).padStart(6, "0");
    expect(periksaTotp(RAHASIA_RFC, salah, { sekarangMs: T }).ok).toBe(false);
  });
});

describe("rahasia dan tautan otpauth", () => {
  it("rahasia acak 160 bit (32 huruf base32) dan unik", () => {
    const a = buatRahasiaTotp();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a)!.length).toBe(20);
    expect(buatRahasiaTotp()).not.toBe(a);
  });

  it("tautan otpauth memuat penerbit, akun, rahasia, dan parameter standar", () => {
    const u = new URL(uriOtpauth("siti@contoh.id", "JBSWY3DPEHPK3PXP"));
    expect(u.protocol).toBe("otpauth:");
    expect(u.host).toBe("totp");
    expect(decodeURIComponent(u.pathname)).toBe("/GeoKader:siti@contoh.id");
    expect(u.searchParams.get("secret")).toBe("JBSWY3DPEHPK3PXP");
    expect(u.searchParams.get("issuer")).toBe("GeoKader");
    expect(u.searchParams.get("algorithm")).toBe("SHA1");
    expect(u.searchParams.get("digits")).toBe("6");
    expect(u.searchParams.get("period")).toBe("30");
  });

  it("email dengan karakter khusus di-encode", () => {
    const u = uriOtpauth("a+b@contoh.id", "JBSWY3DPEHPK3PXP");
    expect(u).toContain("GeoKader%3Aa%2Bb%40contoh.id");
  });

  it("rahasiaUntukTampil membagi per 4 huruf", () => {
    expect(rahasiaUntukTampil("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });
});

describe("kode pemulihan", () => {
  it("8 kode berbentuk XXXXX-XXXXX tanpa karakter yang mudah tertukar, semuanya berbeda", () => {
    const k = buatKodePemulihan();
    expect(k).toHaveLength(8);
    k.forEach((x) => expect(x).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/));
    expect(new Set(k).size).toBe(8);
  });

  it("normalisasi mengabaikan huruf besar/kecil, tanda hubung, dan spasi", () => {
    expect(normalisasiKodePemulihan("abcde-fgh23")).toBe("ABCDEFGH23");
    expect(normalisasiKodePemulihan(" ABCDE FGH23 ")).toBe("ABCDEFGH23");
    expect(miripKodePemulihan("abcde-fgh23")).toBe(true);
    expect(miripKodePemulihan("123456")).toBe(false);
  });

  it("hash bergantung pada garam akun dan tidak peka format penulisan", () => {
    const h = hashKodePemulihan("ABCDE-FGH23", "garam1");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKodePemulihan("abcde fgh23", "garam1")).toBe(h);
    expect(hashKodePemulihan("ABCDE-FGH23", "garam2")).not.toBe(h);
  });
});
