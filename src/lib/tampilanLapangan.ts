import { useSyncExternalStore } from "react";
import { bacaTeks, tulisTeks } from "./penyimpanan";
export type ModeTampilan = "standar" | "matahari" | "malam";
export const KUNCI_TAMPILAN = "titik_tapak_tampilan_v1";
export function bacaModeTampilan(): ModeTampilan {
  const m = bacaTeks(KUNCI_TAMPILAN);
  return m === "matahari" || m === "malam" ? m : "standar";
}
export function simpanModeTampilan(mode: ModeTampilan) {
  tulisTeks(KUNCI_TAMPILAN, mode);
  document.documentElement.dataset.fieldTheme = mode;
}
const subscribe = (cb: () => void) => {
  const m = window.matchMedia("(min-width: 768px)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
export function useDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  );
}
