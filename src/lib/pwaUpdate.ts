/**
 * AUTO-UPDATE PWA OTOMATIS
 * Memastikan setiap kali aplikasi di-republish, perangkat terinstal maupun tautan web
 * langsung mendeteksi Service Worker baru, mengaktifkannya tanpa tunggu tutup tab,
 * dan menyegarkan aplikasi secara otomatis.
 */

export const INTERVAL_CEK_UPDATE_PWA_MS = 3 * 60 * 1000;

export function pasangListenerKontrolerSw(
  swContainer: Pick<ServiceWorkerContainer, "addEventListener">,
  onReload: () => void
): void {
  let sudahReload = false;
  swContainer.addEventListener("controllerchange", () => {
    if (sudahReload) return;
    sudahReload = true;
    onReload();
  });
}

export function paksakanAktifWorkerMenunggu(worker: Pick<ServiceWorker, "state" | "postMessage"> | null | undefined): boolean {
  if (!worker || worker.state !== "installed") return false;
  try {
    worker.postMessage({ type: "SKIP_WAITING" });
    return true;
  } catch {
    return false;
  }
}

export function daftarkanAutoUpdatePwa(): () => void {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => undefined;
  }
  // Jangan mendaftarkan SW saat berjalan di mode unit-test vitest/jsdom
  if (import.meta.env.MODE === "test") {
    return () => undefined;
  }

  let regRef: ServiceWorkerRegistration | null = null;
  let timerId: number | null = null;

  pasangListenerKontrolerSw(navigator.serviceWorker, () => {
    window.location.reload();
  });

  const cekPembaruan = () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    void regRef?.update().catch(() => undefined);
  };

  const padaVisibilitas = () => {
    if (document.visibilityState === "visible") cekPembaruan();
  };

  void navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((reg) => {
      regRef = reg;
      if (reg.waiting && navigator.serviceWorker.controller) {
        paksakanAktifWorkerMenunggu(reg.waiting);
      }
      reg.addEventListener("updatefound", () => {
        const calon = reg.installing;
        if (!calon) return;
        calon.addEventListener("statechange", () => {
          if (calon.state === "installed" && navigator.serviceWorker.controller) {
            paksakanAktifWorkerMenunggu(calon);
          }
        });
      });
      cekPembaruan();
    })
    .catch(() => undefined);

  document.addEventListener("visibilitychange", padaVisibilitas);
  window.addEventListener("focus", cekPembaruan);
  window.addEventListener("online", cekPembaruan);
  timerId = window.setInterval(cekPembaruan, INTERVAL_CEK_UPDATE_PWA_MS);

  return () => {
    document.removeEventListener("visibilitychange", padaVisibilitas);
    window.removeEventListener("focus", cekPembaruan);
    window.removeEventListener("online", cekPembaruan);
    if (timerId !== null) window.clearInterval(timerId);
  };
}
