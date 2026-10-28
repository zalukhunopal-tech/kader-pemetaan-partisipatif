// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { bannerInstalDitutup, deteksiPlatform, tutupBannerInstal } from "./instal";

beforeEach(() => localStorage.clear());

describe("deteksiPlatform", () => {
  it("iPhone, iPad (termasuk iPadOS yang mengaku Mac), Android, dan desktop", () => {
    expect(deteksiPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)")).toBe("ios");
    expect(deteksiPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe("ios");
    expect(deteksiPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe("desktop");
    expect(deteksiPlatform("Mozilla/5.0 (Linux; Android 14; SM-A546E)")).toBe("android");
    expect(deteksiPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });
});

describe("ajakan instal yang ditutup", () => {
  it("tidak tampil selama 14 hari setelah ditutup, lalu tampil lagi", () => {
    const t = Date.UTC(2026, 9, 28);
    expect(bannerInstalDitutup(t)).toBe(false);
    tutupBannerInstal(t);
    expect(bannerInstalDitutup(t + 13 * 86_400_000)).toBe(true);
    expect(bannerInstalDitutup(t + 15 * 86_400_000)).toBe(false);
  });
});
