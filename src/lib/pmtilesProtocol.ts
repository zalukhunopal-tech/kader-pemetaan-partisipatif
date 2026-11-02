import * as pmtiles from "pmtiles";
import * as maplibregl from "maplibre-gl";

/**
 * Sumber PMTiles kustom berbasis Blob/File lokal dari peramban.
 * Membaca rentang byte secara on-demand menggunakan Blob.slice()
 * tanpa perlu memuat seluruh berkas berukuran ratusan MB/GB ke memori.
 */
export class BlobPMTilesSource implements pmtiles.Source {
  private blob: Blob;
  private key: string;

  constructor(blob: Blob, key: string) {
    this.blob = blob;
    this.key = key;
  }

  getKey(): string {
    return this.key;
  }

  async getBytes(offset: number, length: number): Promise<pmtiles.RangeResponse> {
    const slice = this.blob.slice(offset, offset + length);
    const data = await slice.arrayBuffer();
    return { data };
  }
}

export interface MetadataPmtiles {
  namaArea: string;
  tileType: "vector" | "raster" | "raster-dem" | "unknown";
  format: "pbf" | "png" | "jpg" | "webp" | "unknown";
  minZoom: number;
  maxZoom: number;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  pusatLng: number;
  pusatLat: number;
  pusatZoom: number;
  specVersion: number;
  clustered: boolean;
  ukuranMb: number;
  crs: string;
  crsDeskripsi: string;
}

let protocolSingleton: pmtiles.Protocol | null = null;
let pmtilesTerdaftar = false;
const daftarArsipPmtiles = new Map<string, pmtiles.PMTiles>();

/**
 * Dapatkan atau inisialisasi singleton PMTiles Protocol
 */
export function dapatkanProtokolPmtiles(): pmtiles.Protocol {
  if (!protocolSingleton) {
    protocolSingleton = new pmtiles.Protocol({ metadata: true });
  }
  return protocolSingleton;
}

/**
 * Daftarkan protokol pmtiles:// ke MapLibre GL instance secara aman (idempotent).
 */
export function registrasiProtokolPmtiles(maplibreInstance?: typeof maplibregl): pmtiles.Protocol {
  const proto = dapatkanProtokolPmtiles();
  if (maplibreInstance && typeof maplibreInstance.addProtocol === "function") {
    try {
      maplibreInstance.addProtocol("pmtiles", proto.tile);
    } catch {
      // Protokol mungkin telah terdaftar di instance ini
    }
  } else if (!pmtilesTerdaftar && maplibregl && typeof maplibregl.addProtocol === "function") {
    try {
      maplibregl.addProtocol("pmtiles", proto.tile);
      pmtilesTerdaftar = true;
    } catch {
      // Protokol mungkin telah terdaftar di instance lain
    }
  }
  return proto;
}

/**
 * Mendaftarkan sebuah berkas/blob PMTiles ke MapLibre Protocol di bawah ID tertentu.
 * URL tile MapLibre dapat menggunakan templat: pmtiles://${id}/{z}/{x}/{y}
 */
export function daftarkanSumberPmtiles(id: string, fileOrBlob: Blob | File | ArrayBuffer): pmtiles.PMTiles {
  const proto = registrasiProtokolPmtiles();
  let source: pmtiles.Source;
  if (fileOrBlob instanceof ArrayBuffer) {
    source = new BlobPMTilesSource(new Blob([fileOrBlob]), id);
  } else {
    source = new BlobPMTilesSource(fileOrBlob, id);
  }
  const instance = new pmtiles.PMTiles(source);
  proto.add(instance);
  daftarArsipPmtiles.set(id, instance);
  return instance;
}

/**
 * Mengambil instance PMTiles yang telah terdaftar berdasarkan ID
 */
export function ambilSumberPmtiles(id: string): pmtiles.PMTiles | undefined {
  return daftarArsipPmtiles.get(id);
}

/**
 * Menghapus sumber PMTiles dari protokol
 */
export function hapusSumberPmtiles(id: string): void {
  daftarArsipPmtiles.delete(id);
  try {
    const proto = dapatkanProtokolPmtiles() as any;
    if (proto.tiles && typeof proto.tiles.delete === "function") {
      proto.tiles.delete(id);
    }
  } catch {
    // Abaikan
  }
}

/**
 * Membaca header biner (127 bytes pertama) berkas PMTiles v3
 * dan mengekstrak metadata spasial lengkap: bounding box, rentang zoom, jenis tile.
 */
export async function bacaMetadataPmtiles(fileOrBlob: Blob | File | ArrayBuffer, namaArea = "Peta PMTiles"): Promise<MetadataPmtiles> {
  let headerBytes: ArrayBuffer;
  let ukuranMb = 0;

  if (fileOrBlob instanceof ArrayBuffer) {
    headerBytes = fileOrBlob.slice(0, Math.min(fileOrBlob.byteLength, 127));
    ukuranMb = Number((fileOrBlob.byteLength / (1024 * 1024)).toFixed(1));
  } else {
    const slice = fileOrBlob.slice(0, Math.min(fileOrBlob.size, 127));
    headerBytes = await slice.arrayBuffer();
    ukuranMb = Number((fileOrBlob.size / (1024 * 1024)).toFixed(1));
    if (fileOrBlob instanceof File && fileOrBlob.name) {
      namaArea = fileOrBlob.name;
    }
  }

  if (headerBytes.byteLength < 127) {
    throw new Error("Berkas PMTiles tidak valid (ukuran header kurang dari 127 byte).");
  }

  // Validasi magic PMTiles ("PMTiles" atau magic bytes)
  const u8 = new Uint8Array(headerBytes);
  if (u8[0] !== 0x50 || u8[1] !== 0x4d) {
    throw new Error("Berkas ini bukan arsip PMTiles yang valid (magic header tidak cocok).");
  }

  const h = pmtiles.bytesToHeader(headerBytes);

  let tileType: MetadataPmtiles["tileType"] = "unknown";
  let format: MetadataPmtiles["format"] = "unknown";

  switch (h.tileType) {
    case pmtiles.TileType.Mvt:
      tileType = "vector";
      format = "pbf";
      break;
    case pmtiles.TileType.Png:
      tileType = "raster";
      format = "png";
      break;
    case pmtiles.TileType.Jpeg:
      tileType = "raster";
      format = "jpg";
      break;
    case pmtiles.TileType.Webp:
      tileType = "raster";
      format = "webp";
      break;
    default:
      tileType = "raster";
      format = "png";
  }

  const minLng = Number(Math.max(-180, Math.min(180, h.minLon)).toFixed(6));
  const maxLng = Number(Math.max(-180, Math.min(180, h.maxLon)).toFixed(6));
  const minLat = Number(Math.max(-85.0511, Math.min(85.0511, h.minLat)).toFixed(6));
  const maxLat = Number(Math.max(-85.0511, Math.min(85.0511, h.maxLat)).toFixed(6));

  const pusatLng = Number(h.centerLon.toFixed(6)) || Number(((minLng + maxLng) / 2).toFixed(6));
  const pusatLat = Number(h.centerLat.toFixed(6)) || Number(((minLat + maxLat) / 2).toFixed(6));
  const pusatZoom = h.centerZoom || Math.round((h.minZoom + h.maxZoom) / 2) || 12;

  return {
    namaArea,
    tileType,
    format,
    minZoom: h.minZoom,
    maxZoom: h.maxZoom,
    minLng,
    minLat,
    maxLng,
    maxLat,
    pusatLng,
    pusatLat,
    pusatZoom,
    specVersion: h.specVersion,
    clustered: h.clustered,
    ukuranMb,
    crs: "EPSG:3857 / EPSG:4326 (WGS 84)",
    crsDeskripsi: `Protomaps PMTiles v${h.specVersion} (${tileType.toUpperCase()})`
  };
}

/**
 * Mengambil tile tunggal dari PMTiles instance untuk penggambar peta 2D (kanvas/Image).
 */
export async function ambilTilePmtilesBlob(
  id: string,
  z: number,
  x: number,
  y: number,
  signal?: AbortSignal
): Promise<Blob | null> {
  const p = ambilSumberPmtiles(id);
  if (!p) return null;
  try {
    const resp = await p.getZxy(z, x, y, signal);
    if (!resp || !resp.data) return null;
    const h = await p.getHeader();
    let mime = "image/png";
    if (h.tileType === pmtiles.TileType.Jpeg) mime = "image/jpeg";
    if (h.tileType === pmtiles.TileType.Webp) mime = "image/webp";
    if (h.tileType === pmtiles.TileType.Mvt) mime = "application/x-protobuf";
    return new Blob([resp.data], { type: mime });
  } catch {
    return null;
  }
}
