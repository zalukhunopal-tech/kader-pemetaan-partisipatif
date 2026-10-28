/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TILE_URL_SATELIT?: string;
  readonly VITE_TILE_URL_OSM?: string;
  readonly VITE_TILE_URL_TOPO?: string;
  readonly VITE_TILE_UNDUH_SATELIT?: string;
  readonly VITE_TILE_UNDUH_OSM?: string;
  readonly VITE_TILE_UNDUH_TOPO?: string;
  readonly VITE_TILE_ATRIBUSI_SATELIT?: string;
  readonly VITE_TILE_ATRIBUSI_OSM?: string;
  readonly VITE_TILE_ATRIBUSI_TOPO?: string;
  readonly VITE_TILE_ZOOM_MAKS_SATELIT?: string;
  readonly VITE_ESRI_API_KEY?: string;
  readonly VITE_URL_VERIFIKASI?: string;
  readonly VITE_AKUN_UJI?: string;
  readonly VITE_KODE_ADMIN?: string;
  readonly VITE_GDRIVE_URL?: string;
  readonly VITE_GDRIVE_TOKEN?: string;
}
