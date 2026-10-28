// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  AkunSesi,
  MASA_BERLAKU_TOTP_MS,
  aksesAdminSah,
  aturUlangAuthenticatorOlehAdmin,
  aturUlangSandiOlehAdmin,
  autentikasiLogin,
  buatAdminPertama,
  buatAkunOlehAdmin,
  konfigUji,
  mulaiPendaftaranTotp,
  muatSemuaAkun,
  selesaikanPendaftaranTotp,
  simpanSesiPengguna,
  sisaMasaTotp,
  ubahKataSandi,
  verifikasiKodeAuthenticator
} from "./auth";
import { hitungTotp } from "./totp";
import { aplikasiTerbuka, catatAktivitasAplikasi, kunciAplikasi } from "./kunciAplikasi";
import { gerbangAdminTerbuka, kunciGerbangAdmin } from "./gerbangAdmin";
import {
  BATAS_SALAH_PIN,
  aturPin,
  bukaDenganBiometrik,
  bukaDenganPin,
  daftarkanBiometrik,
  gantiPin,
  hapusBiometrik,
  metodeKunciCepat,
  validasiPin
} from "./kunciCepat";
import { keBase64Url } from "./webauthn";

konfigUji.iterasi = 1000;

const SANDI = "RimbaHijau-2026";
const WAKTU_AWAL = new Date(2026, 9, 28, 8, 0, 0);
const majuDetik = (n: number) => vi.setSystemTime(new Date(Date.now() + n * 1000));

async function siapkanAdmin() {
  const email = "admin.desa@contoh.id";
  await buatAdminPertama({ nama: "Siti Admin", email, kataSandi: SANDI, desaWilayah: "Desa A", noHp: "0812" });
  const m = await mulaiPendaftaranTotp(email, SANDI);
  await selesaikanPendaftaranTotp(email, SANDI, m.rahasia!, hitungTotp(m.rahasia!)!);
  majuDetik(30);
  const masuk = await autentikasiLogin(email, SANDI, hitungTotp(m.rahasia!)!);
  expect(masuk.sukses).toBe(true);
  return { email, rahasia: m.rahasia!, sesi: masuk.akun as AkunSesi };
}

async function siapkanKader(admin: AkunSesi) {
  const email = "kader.lapangan@contoh.id";
  const r = await buatAkunOlehAdmin(admin, { nama: "Budi Kader", email, desaWilayah: "Desa B", noHp: "0813" });
  const sandi = "KataBaruKu-2028";
  await ubahKataSandi(email, r.sandiSementara!, sandi);
  const m = await mulaiPendaftaranTotp(email, sandi);
  await selesaikanPendaftaranTotp(email, sandi, m.rahasia!, hitungTotp(m.rahasia!)!);
  majuDetik(30);
  const masuk = await autentikasiLogin(email, sandi, hitungTotp(m.rahasia!)!);
  return { email, rahasia: m.rahasia!, sesi: masuk.akun as AkunSesi };
}

/** Meniru aplikasi dibuka ulang: status terbuka di memori hilang, data di penyimpanan tetap */
function bukaUlangAplikasi() {
  kunciAplikasi();
  kunciGerbangAdmin();
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WAKTU_AWAL);
  bukaUlangAplikasi();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("aturan PIN", () => {
  it("tepat 6 angka, bukan angka sama, bukan urutan, bukan pola berulang", () => {
    expect(validasiPin("12345")).toMatch(/6 angka/);
    expect(validasiPin("12a456")).toMatch(/6 angka/);
    expect(validasiPin("000000")).toMatch(/sama/);
    expect(validasiPin("123456")).toMatch(/berurutan/);
    expect(validasiPin("654321")).toMatch(/berurutan/);
    expect(validasiPin("890123")).toMatch(/berurutan/);
    expect(validasiPin("121212")).toMatch(/pola/);
    expect(validasiPin("123123")).toMatch(/pola/);
    expect(validasiPin("112233")).toMatch(/pola/);
    expect(validasiPin("482915")).toBeNull();
  });
});

describe("kode Authenticator berlaku 8 jam", () => {
  it("masuk dengan kode membuka aplikasi dan memulai masa 8 jam; keluar mengakhirinya", async () => {
    const admin = await siapkanAdmin();
    expect(aplikasiTerbuka(admin.email)).toBe(true);
    expect(sisaMasaTotp(admin.email)).toBe(MASA_BERLAKU_TOTP_MS);
    majuDetik(3600);
    expect(sisaMasaTotp(admin.email)).toBe(MASA_BERLAKU_TOTP_MS - 3600_000);
    simpanSesiPengguna(null);
    expect(sisaMasaTotp(admin.email)).toBe(0);
    expect(aplikasiTerbuka(admin.email)).toBe(false);
  });

  it("selama 8 jam: aplikasi yang dibuka ulang cukup dibuka dengan PIN, tanpa kode Authenticator", async () => {
    const admin = await siapkanAdmin();
    expect((await aturPin(admin.sesi, "482915")).sukses).toBe(true);
    for (const jam of [1, 3, 7.5]) {
      vi.setSystemTime(new Date(WAKTU_AWAL.getTime() + 30_000 + jam * 3600_000));
      bukaUlangAplikasi();
      expect(aplikasiTerbuka(admin.email)).toBe(false);
      expect((await bukaDenganPin(admin.sesi, "482915")).sukses).toBe(true);
      expect(aplikasiTerbuka(admin.email)).toBe(true);
    }
  });

  it("setelah 8 jam PIN tidak cukup: kode Authenticator diminta, lalu PIN berlaku lagi 8 jam", async () => {
    const admin = await siapkanAdmin();
    await aturPin(admin.sesi, "482915");
    majuDetik(8 * 3600 + 1);
    bukaUlangAplikasi();
    const r = await bukaDenganPin(admin.sesi, "482915");
    expect(r.sukses).toBe(false);
    expect(r.perluAuthenticator).toBe(true);
    expect(r.pesan).toMatch(/8 jam/);
    expect(aplikasiTerbuka(admin.email)).toBe(false);

    expect(verifikasiKodeAuthenticator(admin.sesi, hitungTotp(admin.rahasia)!).sukses).toBe(true);
    expect(aplikasiTerbuka(admin.email)).toBe(true);
    expect(sisaMasaTotp(admin.email)).toBe(MASA_BERLAKU_TOTP_MS);
    bukaUlangAplikasi();
    expect((await bukaDenganPin(admin.sesi, "482915")).sukses).toBe(true);
  });

  it("jam perangkat yang dimundurkan tidak memperpanjang masa berlaku", async () => {
    const admin = await siapkanAdmin();
    vi.setSystemTime(new Date(WAKTU_AWAL.getTime() - 3600_000));
    expect(sisaMasaTotp(admin.email)).toBe(0);
  });

  it("masa berlaku milik akun lain tidak bisa dipakai", async () => {
    const admin = await siapkanAdmin();
    const kader = await siapkanKader(admin.sesi);
    expect(sisaMasaTotp(kader.email)).toBeGreaterThan(0);
    expect(sisaMasaTotp(admin.email)).toBe(0);
  });

  it("verifikasi ulang: kode salah dihitung, kode yang sama tidak bisa dipakai lagi, sesi palsu ditolak", async () => {
    const admin = await siapkanAdmin();
    majuDetik(30);
    expect(verifikasiKodeAuthenticator(admin.sesi, "000000").sukses).toBe(false);
    const kode = hitungTotp(admin.rahasia)!;
    expect(verifikasiKodeAuthenticator(admin.sesi, kode).sukses).toBe(true);
    expect(verifikasiKodeAuthenticator(admin.sesi, kode).sukses).toBe(false);
    expect(verifikasiKodeAuthenticator({ ...admin.sesi, idKader: "ADM-palsu" }, hitungTotp(admin.rahasia)!).sukses).toBe(false);
    expect(verifikasiKodeAuthenticator(null, "123456").sukses).toBe(false);
  });
});

describe("PIN", () => {
  it("PIN hanya bisa dibuat saat aplikasi terbuka; tersimpan sebagai hash, bukan teks", async () => {
    const admin = await siapkanAdmin();
    kunciAplikasi();
    expect((await aturPin(admin.sesi, "482915")).sukses).toBe(false);
    verifikasiKodeAuthenticator(admin.sesi, (majuDetik(30), hitungTotp(admin.rahasia)!));
    expect((await aturPin(admin.sesi, "482915")).sukses).toBe(true);
    expect(JSON.stringify(localStorage)).not.toContain("482915");
    expect(metodeKunciCepat(admin.email)).toEqual({ pin: true, biometrik: false });
  });

  it(`PIN salah dihitung; salah ${BATAS_SALAH_PIN} kali menonaktifkan PIN dan meminta Authenticator`, async () => {
    const admin = await siapkanAdmin();
    await aturPin(admin.sesi, "482915");
    bukaUlangAplikasi();
    for (let i = 1; i < BATAS_SALAH_PIN; i++) {
      const r = await bukaDenganPin(admin.sesi, "111222");
      expect(r.pesan).toMatch(new RegExp(`Sisa ${BATAS_SALAH_PIN - i}`));
    }
    const terakhir = await bukaDenganPin(admin.sesi, "111222");
    expect(terakhir.perluAuthenticator).toBe(true);
    expect(metodeKunciCepat(admin.email).pin).toBe(false);
    expect((await bukaDenganPin(admin.sesi, "482915")).sukses).toBe(false); // PIN benar pun tidak berlaku lagi
    expect(aplikasiTerbuka(admin.email)).toBe(false);
  });

  it("PIN benar mengosongkan hitungan salah", async () => {
    const admin = await siapkanAdmin();
    await aturPin(admin.sesi, "482915");
    for (let i = 0; i < BATAS_SALAH_PIN - 1; i++) await bukaDenganPin(admin.sesi, "111222");
    expect((await bukaDenganPin(admin.sesi, "482915")).sukses).toBe(true);
    expect((await bukaDenganPin(admin.sesi, "111222")).pesan).toMatch(new RegExp(`Sisa ${BATAS_SALAH_PIN - 1}`));
  });

  it("ganti PIN memerlukan PIN lama yang benar", async () => {
    const admin = await siapkanAdmin();
    await aturPin(admin.sesi, "482915");
    expect((await gantiPin(admin.sesi, "999999", "730518")).sukses).toBe(false);
    expect((await gantiPin(admin.sesi, "482915", "482915")).sukses).toBe(false);
    expect((await gantiPin(admin.sesi, "482915", "730518")).sukses).toBe(true);
    bukaUlangAplikasi();
    expect((await bukaDenganPin(admin.sesi, "482915")).sukses).toBe(false);
    expect((await bukaDenganPin(admin.sesi, "730518")).sukses).toBe(true);
  });

  it("PIN akun lain atau sesi palsu tidak membuka aplikasi", async () => {
    const admin = await siapkanAdmin();
    const kader = await siapkanKader(admin.sesi);
    await aturPin(kader.sesi, "482915");
    bukaUlangAplikasi();
    expect((await bukaDenganPin({ ...kader.sesi, idKader: "KDR-palsu" }, "482915")).sukses).toBe(false);
    expect((await bukaDenganPin(admin.sesi, "482915")).sukses).toBe(false);
  });
});

describe("pemisahan admin dengan PIN", () => {
  it("PIN di layar kunci membuka mode admin hanya untuk akun admin (aplikasi+admin)", async () => {
    const admin = await siapkanAdmin();
    await aturPin(admin.sesi, "482915");
    bukaUlangAplikasi();
    expect(aksesAdminSah(admin.sesi)).toBe(false);
    expect((await bukaDenganPin(admin.sesi, "482915", "aplikasi")).sukses).toBe(true);
    expect(gerbangAdminTerbuka(admin.email)).toBe(false); // mode user: gerbang admin tetap tertutup
    expect((await bukaDenganPin(admin.sesi, "482915", "aplikasi+admin")).sukses).toBe(true);
    expect(aksesAdminSah(admin.sesi)).toBe(true);
  });

  it("kader tidak bisa membuka mode admin dengan PIN, dan perannya tidak bisa dipalsukan", async () => {
    const admin = await siapkanAdmin();
    const kader = await siapkanKader(admin.sesi);
    await aturPin(kader.sesi, "482915");
    const r = await bukaDenganPin(kader.sesi, "482915", "admin");
    expect(r.sukses).toBe(false);
    expect(r.pesan).toMatch(/tidak memiliki akses/);
    expect((await bukaDenganPin({ ...kader.sesi, peran: "admin" }, "482915", "admin")).sukses).toBe(false);
    await bukaDenganPin(kader.sesi, "482915", "aplikasi+admin");
    expect(gerbangAdminTerbuka(kader.email)).toBe(false);
    expect(aksesAdminSah({ ...kader.sesi, peran: "admin" })).toBe(false);
  });

  it("aksi admin ditolak saat aplikasi terkunci, saat diam 15 menit, atau setelah masa 8 jam habis", async () => {
    const admin = await siapkanAdmin();
    await aturPin(admin.sesi, "482915");
    expect(aksesAdminSah(admin.sesi)).toBe(true);
    kunciAplikasi();
    expect(aksesAdminSah(admin.sesi)).toBe(false);
    expect((await buatAkunOlehAdmin(admin.sesi, { nama: "X", email: "x@contoh.id", desaWilayah: "-", noHp: "-" })).sukses).toBe(false);

    await bukaDenganPin(admin.sesi, "482915", "aplikasi+admin");
    majuDetik(16 * 60);
    expect(aplikasiTerbuka(admin.email)).toBe(false);

    await bukaDenganPin(admin.sesi, "482915", "aplikasi+admin");
    for (let i = 0; i < 40; i++) {
      majuDetik(12 * 60);
      catatAktivitasAplikasi();
    }
    expect(aksesAdminSah(admin.sesi)).toBe(false); // lebih dari 8 jam walau terus aktif
  });

  it("admin mengatur ulang sandi atau Authenticator kader: PIN dan sidik jari kader ikut dihapus", async () => {
    const admin = await siapkanAdmin();
    const kader = await siapkanKader(admin.sesi);
    await aturPin(kader.sesi, "482915");
    expect(metodeKunciCepat(kader.email).pin).toBe(true);
    majuDetik(30);
    verifikasiKodeAuthenticator(admin.sesi, hitungTotp(admin.rahasia)!, { bukaAdmin: true });
    expect(aturUlangAuthenticatorOlehAdmin(admin.sesi, kader.email).sukses).toBe(true);
    expect(metodeKunciCepat(kader.email).pin).toBe(false);

    const akun = muatSemuaAkun().find((a) => a.email === kader.email)!;
    expect(akun.pinHash).toBeUndefined();
    expect((await aturUlangSandiOlehAdmin(admin.sesi, kader.email)).sukses).toBe(true);
  });
});

/* ---------- Sidik jari / wajah dengan autentikator tiruan (kunci ES256 sungguhan) ---------- */

async function pasangAutentikatorTiruan(opsi: { tolak?: boolean; tanpaUv?: boolean } = {}) {
  const pasangan = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const spki = await crypto.subtle.exportKey("spki", pasangan.publicKey);
  const idKredensial = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const keDer = (mentah: Uint8Array) => {
    const bil = (b: Uint8Array) => {
      let v = b;
      while (v.length > 1 && v[0] === 0) v = v.slice(1);
      if (v[0] & 0x80) v = Uint8Array.from([0, ...v]);
      return [0x02, v.length, ...v];
    };
    const r = bil(mentah.slice(0, 32));
    const s = bil(mentah.slice(32));
    return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]);
  };
  const create = vi.fn(async () => ({
    rawId: idKredensial.buffer,
    response: { getPublicKey: () => spki, getPublicKeyAlgorithm: () => -7 }
  }));
  const get = vi.fn(async (arg: { publicKey: { challenge: Uint8Array } }) => {
    if (opsi.tolak) throw new DOMException("dibatalkan", "NotAllowedError");
    const dataKlien = new TextEncoder().encode(
      JSON.stringify({
        type: "webauthn.get",
        challenge: keBase64Url(new Uint8Array(arg.publicKey.challenge)),
        origin: window.location.origin
      })
    );
    const ad = new Uint8Array(37);
    ad.set(sha256(new TextEncoder().encode(window.location.hostname)), 0);
    ad[32] = opsi.tanpaUv ? 0x01 : 0x05;
    const pesan = new Uint8Array([...ad, ...sha256(dataKlien)]);
    const mentah = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pasangan.privateKey, pesan));
    return {
      response: { clientDataJSON: dataKlien.buffer, authenticatorData: ad.buffer, signature: keDer(mentah).buffer }
    };
  });
  vi.stubGlobal("PublicKeyCredential", function PublicKeyCredential() {});
  Object.defineProperty(navigator, "credentials", { value: { create, get }, configurable: true });
  return { create, get };
}

describe("sidik jari / pengenalan wajah", () => {
  it("didaftarkan saat aplikasi terbuka, lalu membuka aplikasi yang terkunci; hanya kunci publik yang disimpan", async () => {
    const admin = await siapkanAdmin();
    const t = await pasangAutentikatorTiruan();
    expect((await daftarkanBiometrik(admin.sesi)).sukses).toBe(true);
    const opsiDaftar = (t.create.mock.calls[0] as unknown as [{ publicKey: PublicKeyCredentialCreationOptions }])[0].publicKey;
    expect(opsiDaftar.authenticatorSelection).toMatchObject({ authenticatorAttachment: "platform", userVerification: "required" });
    expect(metodeKunciCepat(admin.email)).toEqual({ pin: false, biometrik: true });

    bukaUlangAplikasi();
    expect((await bukaDenganBiometrik(admin.sesi, "aplikasi+admin")).sukses).toBe(true);
    expect(aksesAdminSah(admin.sesi)).toBe(true);
    const opsiBuka = (t.get.mock.calls[0] as unknown as [{ publicKey: PublicKeyCredentialRequestOptions }])[0].publicKey;
    expect(opsiBuka.userVerification).toBe("required");
  });

  it("dibatalkan, tanpa verifikasi pengguna, atau setelah 8 jam: tidak membuka", async () => {
    const admin = await siapkanAdmin();
    await pasangAutentikatorTiruan({ tolak: true });
    await daftarkanBiometrik(admin.sesi);
    bukaUlangAplikasi();
    expect((await bukaDenganBiometrik(admin.sesi)).sukses).toBe(false);

    verifikasiKodeAuthenticator(admin.sesi, (majuDetik(30), hitungTotp(admin.rahasia)!));
    await pasangAutentikatorTiruan({ tanpaUv: true });
    await daftarkanBiometrik(admin.sesi);
    bukaUlangAplikasi();
    expect((await bukaDenganBiometrik(admin.sesi)).sukses).toBe(false);
    expect(aplikasiTerbuka(admin.email)).toBe(false);

    verifikasiKodeAuthenticator(admin.sesi, (majuDetik(30), hitungTotp(admin.rahasia)!));
    await pasangAutentikatorTiruan();
    await daftarkanBiometrik(admin.sesi);
    majuDetik(8 * 3600 + 1);
    bukaUlangAplikasi();
    const r = await bukaDenganBiometrik(admin.sesi);
    expect(r.sukses).toBe(false);
    expect(r.perluAuthenticator).toBe(true);
  });

  it("sidik jari hanya bisa dimatikan bila ada PIN (selalu ada satu cara membuka)", async () => {
    const admin = await siapkanAdmin();
    await pasangAutentikatorTiruan();
    await daftarkanBiometrik(admin.sesi);
    expect(hapusBiometrik(admin.sesi).sukses).toBe(false);
    await aturPin(admin.sesi, "482915");
    expect(hapusBiometrik(admin.sesi).sukses).toBe(true);
    expect(metodeKunciCepat(admin.email)).toEqual({ pin: true, biometrik: false });
  });
});
