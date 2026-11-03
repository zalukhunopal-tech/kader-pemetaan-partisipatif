import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import * as maplibregl from "maplibre-gl";

export interface MetadataMbtilesSql {
  namaArea: string;
  format: "pbf" | "png" | "jpg" | "webp" | "unknown";
  tileType: "vector" | "raster" | "unknown";
  minZoom: number;
  maxZoom: number;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  pusatLng: number;
  pusatLat: number;
  pusatZoom: number;
  ukuranMb: number;
  crs: string;
  crsDeskripsi: string;
  deskripsi?: string;
  atribusi?: string;
}

let sqlStaticPromise: Promise<SqlJsStatic> | null = null;
let mbtilesTerdaftar = false;
const daftarArsipMbtiles = new Map<string, Database>();
const metadataArsipMbtiles = new Map<string, MetadataMbtilesSql>();

/**
 * Menginisialisasi SQL.js WebAssembly secara aman untuk peramban dan pengujian
 */
export function dapatkanSqlJs(): Promise<SqlJsStatic> {
  if (!sqlStaticPromise) {
    sqlStaticPromise = initSqlJs({
      locateFile: (file: string) => (typeof window === "undefined" ? `./public/${file}` : `/${file}`)
    });
  }
  return sqlStaticPromise;
}

/**
 * Daftarkan custom protocol mbtiles:// ke MapLibre GL
 */
export function registrasiProtokolMbtiles(maplibreInstance?: Pick<typeof maplibregl, "addProtocol">): void {
  const handler = async (params: Parameters<Parameters<typeof maplibregl.addProtocol>[1]>[0]) => {
        // Pola URL: mbtiles://{id}/{z}/{x}/{y} atau mbtiles://{id}/tile.json
        const rawUrl = params.url.replace(/^mbtiles:\/\//, "");

        if (params.type === "json" || rawUrl.endsWith("tile.json") || rawUrl.endsWith(".json")) {
          const id = rawUrl.split("/")[0].replace(/\.json$/, "");
          let meta = metadataArsipMbtiles.get(id);
      if (!meta) {
        try {
          const { ambilArsipPeta } = await import("./penyimpananPetaLuring");
          const arsip = await ambilArsipPeta(id);
          if (arsip && arsip.berkas) {
            await daftarkanSumberMbtiles(id, arsip.berkas);
            meta = metadataArsipMbtiles.get(id);
          }
        } catch (err) {
          console.warn("Gagal memuat ulang metadata MBTiles " + id + ":", err);
        }
      }
          const tileJson = {
            tilejson: "2.2.0",
            name: meta?.namaArea || id,
            format: meta?.format || "png",
            bounds: meta ? [meta.minLng, meta.minLat, meta.maxLng, meta.maxLat] : [-180, -85.0511, 180, 85.0511],
            minzoom: meta?.minZoom ?? 0,
            maxzoom: meta?.maxZoom ?? 18,
            center: meta ? [meta.pusatLng, meta.pusatLat, meta.pusatZoom] : [0, 0, 0],
            tiles: [`mbtiles://${id}/{z}/{x}/{y}`]
          };
          return { data: tileJson };
        }

        const match = rawUrl.match(/^([^/]+)\/(\d+)\/(\d+)\/(\d+)(?:\.[a-zA-Z0-9]+)?$/);
        if (!match) {
          throw new Error(`Format URL MBTiles tidak valid: ${params.url}`);
        }

        const id = match[1];
        const z = parseInt(match[2], 10);
        const x = parseInt(match[3], 10);
        const y = parseInt(match[4], 10);

        let db = daftarArsipMbtiles.get(id);
        if (!db) {
          try {
            const { ambilArsipPeta } = await import("./penyimpananPetaLuring");
            const arsip = await ambilArsipPeta(id);
            if (arsip && arsip.berkas) {
              await daftarkanSumberMbtiles(id, arsip.berkas);
              db = daftarArsipMbtiles.get(id);
            }
          } catch (err) {
            console.warn("Gagal rehidrasi MBTiles " + id + ":", err);
          }
        }
        if (!db) {
          throw new Error(`Basis data MBTiles dengan ID '${id}' belum terdaftar.`);
        }

        // Konversi baris TMS: di MBTiles y dihitung dari bawah ke atas (TMS)
        const tmsY = (1 << z) - 1 - y;

        try {
          // Cari berdasarkan tmsY terlebih dahulu, lalu y langsung jika tidak ditemukan
          let stmt = db.prepare("SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?");
          stmt.bind([z, x, tmsY]);
          let data: Uint8Array | null = null;
          if (stmt.step()) {
            data = stmt.getAsObject().tile_data as Uint8Array;
          }
          stmt.free();

          if (!data) {
            stmt = db.prepare("SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?");
            stmt.bind([z, x, y]);
            if (stmt.step()) {
              data = stmt.getAsObject().tile_data as Uint8Array;
            }
            stmt.free();
          }

          if (data && data.length > 0) {
            return { data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
          }
        } catch {
          // Gagal membaca tile
        }

        return { data: new Uint8Array() };
  };

  if (maplibreInstance && typeof maplibreInstance.addProtocol === "function") {
    try {
      maplibreInstance.addProtocol("mbtiles", handler);
    } catch {
      //
    }
  } else if (!mbtilesTerdaftar && maplibregl && typeof maplibregl.addProtocol === "function") {
    try {
      maplibregl.addProtocol("mbtiles", handler);
      mbtilesTerdaftar = true;
    } catch {
      //
    }
  }
}

/**
 * Mendaftarkan sebuah basis data MBTiles ke MapLibre Protocol
 */
export async function daftarkanSumberMbtiles(
  id: string,
  fileOrBuffer: Uint8Array | ArrayBuffer | Blob | File
): Promise<MetadataMbtilesSql> {
  registrasiProtokolMbtiles();
  let bytes: Uint8Array;
  if (fileOrBuffer instanceof Uint8Array) {
    bytes = fileOrBuffer;
  } else if (fileOrBuffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(fileOrBuffer);
  } else {
    bytes = new Uint8Array(await fileOrBuffer.arrayBuffer());
  }

  const SQL = await dapatkanSqlJs();
  const db = new SQL.Database(bytes);
  daftarArsipMbtiles.set(id, db);

  const meta = await bacaMetadataMbtilesSql(bytes);
  metadataArsipMbtiles.set(id, meta);

  return meta;
}

/**
 * Mengambil database MBTiles yang telah dimuat
 */
export function ambilSumberMbtiles(id: string): Database | undefined {
  return daftarArsipMbtiles.get(id);
}

/**
 * Menutup dan menghapus sumber MBTiles
 */
export function hapusSumberMbtiles(id: string): void {
  const db = daftarArsipMbtiles.get(id);
  if (db) {
    try {
      db.close();
    } catch {
      // Abaikan galat penutupan
    }
    daftarArsipMbtiles.delete(id);
    metadataArsipMbtiles.delete(id);
  }
}

/**
 * Membaca metadata lengkap dari berkas MBTiles SQLite:
 * nama, format (pbf/png/jpg/webp), batas bounding box, titik pusat, rentang zoom.
 */
export async function bacaMetadataMbtilesSql(
  data: ArrayBuffer | Uint8Array | Blob | File,
  namaFallback = "Peta MBTiles"
): Promise<MetadataMbtilesSql> {
  let bytes: Uint8Array;
  let ukuranMb: number;

  if (data instanceof Uint8Array) {
    bytes = data;
    ukuranMb = Number((bytes.length / (1024 * 1024)).toFixed(1));
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
    ukuranMb = Number((bytes.length / (1024 * 1024)).toFixed(1));
  } else {
    bytes = new Uint8Array(await data.arrayBuffer());
    ukuranMb = Number((data.size / (1024 * 1024)).toFixed(1));
    if (data instanceof File && data.name) {
      namaFallback = data.name;
    }
  }

  const SQL = await dapatkanSqlJs();
  const db = new SQL.Database(bytes);

  try {
    const metadataMap: Record<string, string> = {};
    const res = db.exec("SELECT name, value FROM metadata");
    if (res.length > 0) {
      for (const row of res[0].values) {
        if (row[0] && row[1]) {
          metadataMap[String(row[0]).toLowerCase()] = String(row[1]);
        }
      }
    }

    const namaArea = metadataMap.name || namaFallback;
    const rawFormat = (metadataMap.format || "").toLowerCase();
    let format: MetadataMbtilesSql["format"] = "unknown";
    let tileType: MetadataMbtilesSql["tileType"] = "unknown";

    if (rawFormat === "pbf" || rawFormat === "mvt" || metadataMap.type === "vector") {
      format = "pbf";
      tileType = "vector";
    } else if (rawFormat === "png") {
      format = "png";
      tileType = "raster";
    } else if (rawFormat === "jpg" || rawFormat === "jpeg") {
      format = "jpg";
      tileType = "raster";
    } else if (rawFormat === "webp") {
      format = "webp";
      tileType = "raster";
    } else {
      // Periksa sampel tile jika format tidak dinyatakan di metadata
      try {
        const sampleRes = db.exec("SELECT tile_data FROM tiles LIMIT 1");
        if (sampleRes.length > 0 && sampleRes[0].values.length > 0) {
          const sample = sampleRes[0].values[0][0] as Uint8Array;
          if (sample && sample.length > 2) {
            if (sample[0] === 0x89 && sample[1] === 0x50) {
              format = "png";
              tileType = "raster";
            } else if (sample[0] === 0xff && sample[1] === 0xd8) {
              format = "jpg";
              tileType = "raster";
            } else if (sample[0] === 0x52 && sample[1] === 0x49) {
              format = "webp";
              tileType = "raster";
            } else if (sample[0] === 0x1f && sample[1] === 0x8b) {
              // Gzip compressed vector tile (MVT)
              format = "pbf";
              tileType = "vector";
            }
          }
        }
      } catch {
        format = "png";
        tileType = "raster";
      }
    }

    let minLng = -180;
    let minLat = -85.0511;
    let maxLng = 180;
    let maxLat = 85.0511;

    if (metadataMap.bounds) {
      const bParts = metadataMap.bounds.split(",").map((v) => parseFloat(v.trim()));
      if (bParts.length >= 4 && !bParts.some(isNaN)) {
        minLng = Number(Math.max(-180, Math.min(180, bParts[0])).toFixed(6));
        minLat = Number(Math.max(-85.0511, Math.min(85.0511, bParts[1])).toFixed(6));
        maxLng = Number(Math.max(-180, Math.min(180, bParts[2])).toFixed(6));
        maxLat = Number(Math.max(-85.0511, Math.min(85.0511, bParts[3])).toFixed(6));
      }
    }

    let pusatLng = Number(((minLng + maxLng) / 2).toFixed(6));
    let pusatLat = Number(((minLat + maxLat) / 2).toFixed(6));
    let pusatZoom = 12;

    if (metadataMap.center) {
      const cParts = metadataMap.center.split(",").map((v) => parseFloat(v.trim()));
      if (cParts.length >= 2 && !isNaN(cParts[0]) && !isNaN(cParts[1])) {
        pusatLng = Number(cParts[0].toFixed(6));
        pusatLat = Number(cParts[1].toFixed(6));
        if (cParts.length >= 3 && !isNaN(cParts[2])) {
          pusatZoom = Math.round(cParts[2]);
        }
      }
    }

    let minZoom = parseInt(metadataMap.minzoom || "0", 10);
    let maxZoom = parseInt(metadataMap.maxzoom || "18", 10);
    if (isNaN(minZoom)) minZoom = 0;
    if (isNaN(maxZoom)) maxZoom = 18;

    return {
      namaArea,
      format,
      tileType,
      minZoom,
      maxZoom,
      minLng,
      minLat,
      maxLng,
      maxLat,
      pusatLng,
      pusatLat,
      pusatZoom,
      ukuranMb,
      crs: "EPSG:3857 / EPSG:4326 (WGS 84)",
      crsDeskripsi: `MBTiles SQLite (${tileType.toUpperCase()} - ${format.toUpperCase()})`,
      deskripsi: metadataMap.description,
      atribusi: metadataMap.attribution
    };
  } finally {
    db.close();
  }
}

/**
 * Mengambil tile tunggal dari MBTiles instance untuk kanvas 2D
 */
export async function ambilTileMbtilesBlob(
  id: string,
  z: number,
  x: number,
  y: number
): Promise<Blob | null> {
  const db = daftarArsipMbtiles.get(id);
  if (!db) return null;

  const tmsY = (1 << z) - 1 - y;
  let data: Uint8Array | null = null;
  try {
    let stmt = db.prepare("SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?");
    stmt.bind([z, x, tmsY]);
    if (stmt.step()) {
      data = stmt.getAsObject().tile_data as Uint8Array;
    }
    stmt.free();

    if (!data) {
      stmt = db.prepare("SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?");
      stmt.bind([z, x, y]);
      if (stmt.step()) {
        data = stmt.getAsObject().tile_data as Uint8Array;
      }
      stmt.free();
    }

    if (data && data.length > 0) {
      const meta = metadataArsipMbtiles.get(id);
      const mime = meta?.format === "jpg" ? "image/jpeg" : meta?.format === "webp" ? "image/webp" : "image/png";
      return new Blob([data.buffer as ArrayBuffer], { type: mime });
    }
  } catch {
    //
  }
  return null;
}
