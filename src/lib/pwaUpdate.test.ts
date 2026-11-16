import { describe, expect, it, vi } from "vitest";
import { paksakanAktifWorkerMenunggu, pasangListenerKontrolerSw } from "./pwaUpdate";

describe("pwaUpdate", () => {
  it("memicu SKIP_WAITING pada Service Worker baru yang sudah terpasang", () => {
    const postMessage = vi.fn();
    expect(paksakanAktifWorkerMenunggu({ state: "installing", postMessage })).toBe(false);
    expect(paksakanAktifWorkerMenunggu({ state: "installed", postMessage })).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("hanya memanggil reload satu kali ketika controllerchange terjadi", () => {
    const handlers: Array<() => void> = [];
    const onReload = vi.fn();
    pasangListenerKontrolerSw(
      {
        addEventListener: (_event: string, fn: EventListenerOrEventListenerObject) => {
          if (typeof fn === "function") handlers.push(fn as () => void);
        }
      },
      onReload
    );
    handlers.forEach((h) => h());
    handlers.forEach((h) => h());
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
