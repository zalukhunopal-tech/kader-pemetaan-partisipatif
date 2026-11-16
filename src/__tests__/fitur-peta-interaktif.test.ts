// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { uraikanTeksKoordinat } from "../components/InteractiveMap";
import { formatKoordinat } from "../lib/sistemKoordinat";

describe("uraikanTeksKoordinat — penguraian seluruh format koordinat peta interaktif", () => {
  const acuanLat = 2.85727;
  const acuanLng = 117.377476;

  it("menguraikan DD polos dan DD dengan arah kardinal (LU/LS/BT/BB/N/S/E/W)", () => {
    expect(uraikanTeksKoordinat("2.857270, 117.377476")).toEqual({ lat: 2.85727, lng: 117.377476 });
    expect(uraikanTeksKoordinat("-6.1754 106.8272")).toEqual({ lat: -6.1754, lng: 106.8272 });
    expect(uraikanTeksKoordinat("2.857270° LU, 117.377476° BT")).toEqual({ lat: 2.85727, lng: 117.377476 });
    expect(uraikanTeksKoordinat("6.1754S, 106.8272E")).toEqual({ lat: -6.1754, lng: 106.8272 });
  });

  it("menguraikan format DMS, DDM, UTM, dan TM-3 hasil salin aplikasi", () => {
    const fDms = formatKoordinat(acuanLat, acuanLng, "DMS");
    const hDms = uraikanTeksKoordinat(fDms.salin);
    expect(hDms).not.toBeNull();
    expect(hDms!.lat).toBeCloseTo(acuanLat, 4);
    expect(hDms!.lng).toBeCloseTo(acuanLng, 4);

    const fDdm = formatKoordinat(acuanLat, acuanLng, "DDM");
    const hDdm = uraikanTeksKoordinat(fDdm.salin);
    expect(hDdm).not.toBeNull();
    expect(hDdm!.lat).toBeCloseTo(acuanLat, 4);
    expect(hDdm!.lng).toBeCloseTo(acuanLng, 4);

    const fUtm = formatKoordinat(acuanLat, acuanLng, "UTM");
    const hUtm = uraikanTeksKoordinat(fUtm.salin);
    expect(hUtm).not.toBeNull();
    expect(hUtm!.lat).toBeCloseTo(acuanLat, 4);
    expect(hUtm!.lng).toBeCloseTo(acuanLng, 4);

    const fTm3 = formatKoordinat(acuanLat, acuanLng, "TM3");
    const hTm3 = uraikanTeksKoordinat(fTm3.salin);
    expect(hTm3).not.toBeNull();
    expect(hTm3!.lat).toBeCloseTo(acuanLat, 4);
    expect(hTm3!.lng).toBeCloseTo(acuanLng, 4);
  });

  it("menolak masukan rusak atau nilai menit/detik >= 60", () => {
    expect(uraikanTeksKoordinat("")).toBeNull();
    expect(uraikanTeksKoordinat("bukan koordinat")).toBeNull();
    expect(uraikanTeksKoordinat("2°65'10.0\" LU, 117°22'38.0\" BT")).toBeNull();
    expect(uraikanTeksKoordinat("UTM 99N 500000 300000")).toBeNull();
  });
});
