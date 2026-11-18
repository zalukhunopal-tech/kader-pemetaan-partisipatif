export interface KoneksiGDrive {
  url: string;
  token: string;
}

const GDRIVE_URL_DEFAULT =
  "https://script.google.com/macros/s/AKfycbzAQXKvXddb8IG9lf3kyf4brebn68u2LIC9Sw_gZnw1poGcXAIoKmDy1raIeV6_1X8D/exec";
const GDRIVE_TOKEN_DEFAULT = "893533c720cc47f3a094db1b183539da";

export const KONEKSI_GDRIVE: KoneksiGDrive = {
  url: (import.meta.env.VITE_GDRIVE_URL || (import.meta.env.MODE !== "test" ? GDRIVE_URL_DEFAULT : "")).trim(),
  token: (import.meta.env.VITE_GDRIVE_TOKEN || (import.meta.env.MODE !== "test" ? GDRIVE_TOKEN_DEFAULT : "")).trim()
};

export function urlAppsScriptValid(url: string | undefined): boolean {
  const u = (url ?? "").trim();
  return u.startsWith("https://script.google.com/") && /\/exec(\?.*)?$/.test(u);
}

/** true bila build ini memuat alamat Web App dan token Google Drive */
export const gdriveTerpasang = (koneksi: KoneksiGDrive = KONEKSI_GDRIVE): boolean =>
  urlAppsScriptValid(koneksi.url) && koneksi.token !== "";
