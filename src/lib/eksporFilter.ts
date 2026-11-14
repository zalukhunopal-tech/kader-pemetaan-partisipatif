import { AreaPetaOffline, DataSpasialItem, LapisanSpasial } from "../types";
import { eksporKeGeoJSON, eksporKeKML } from "./geoUtils";
import { titikDiDalamBatasArea } from "./geofence";

export type JenisDataEkspor = "Hanya lapisan" | "Lapisan dan peta" | "Semua fitur terpilih";

export interface KonteksEkspor {
  petaDipilih?: AreaPetaOffline[];
  lapisanDipilih?: LapisanSpasial[];
  fiturTerpilihIds?: string[];
  sumberLabel?: string;
}

export interface OpsiFilterEkspor {
  jenisData: JenisDataEkspor;
  konteks?: KonteksEkspor;
  sertakanFoto?: boolean;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function bersihkanFotoItem(item: DataSpasialItem): DataSpasialItem {
  return {
    ...item,
    fotoBase64: undefined,
    namaFileFoto: undefined,
    buktiFoto: undefined,
    url: item.url && item.url.startsWith("data:image") ? undefined : item.url
  };
}

/**
 * Menyaring daftar fitur spasial sesuai pilihan jenis data, konteks pilihan
 * dari Pustaka (peta/lapisan), serta opsi penyertaan foto dokumentasi.
 */
export function filterDataUntukEkspor(dataSpasial: DataSpasialItem[], opsi: OpsiFilterEkspor): DataSpasialItem[] {
  const { jenisData, konteks, sertakanFoto = true } = opsi;
  let hasil = dataSpasial;

  if (konteks?.fiturTerpilihIds && konteks.fiturTerpilihIds.length > 0 && jenisData === "Semua fitur terpilih") {
    const idSet = new Set(konteks.fiturTerpilihIds);
    hasil = hasil.filter((d) => idSet.has(d.id));
  } else {
    const lapisanKategori = (konteks?.lapisanDipilih ?? [])
      .map((l) => l.kategoriDefault)
      .filter((k): k is NonNullable<typeof k> => Boolean(k));
    const petaDipilih = konteks?.petaDipilih ?? [];

    const terapkanFilterKategori = lapisanKategori.length > 0 && (jenisData === "Semua fitur terpilih" || jenisData === "Hanya lapisan");
    const terapkanFilterPeta = petaDipilih.length > 0;

    if (terapkanFilterKategori) {
      const katSet = new Set(lapisanKategori);
      hasil = hasil.filter((d) => katSet.has(d.kategori));
    }

    if (terapkanFilterPeta && jenisData === "Semua fitur terpilih") {
      hasil = hasil.filter((d) => d.koordinat.some((k) => petaDipilih.some((a) => titikDiDalamBatasArea(k, a))));
    }
  }

  return sertakanFoto ? hasil : hasil.map(bersihkanFotoItem);
}

/** Mengekspor GeoJSON berikut poligon batas lembar peta bila diminta. */
export function eksporGeoJsonDenganOpsi(daftar: DataSpasialItem[], petaBatas: AreaPetaOffline[], sertakanPeta: boolean): string {
  const baseStr = eksporKeGeoJSON(daftar);
  if (!sertakanPeta || petaBatas.length === 0) return baseStr;

  const fc = JSON.parse(baseStr) as { type: "FeatureCollection"; features: Record<string, unknown>[] };
  const fiturPeta = petaBatas.map((area) => ({
    type: "Feature",
    properties: {
      id: area.id,
      judul: `Batas Peta: ${area.namaArea}`,
      jenis_fitur: "batas_peta",
      crs: area.crs ?? "WGS84",
      ukuran_mb: area.ukuranMb
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [area.minLng, area.minLat],
          [area.maxLng, area.minLat],
          [area.maxLng, area.maxLat],
          [area.minLng, area.maxLat],
          [area.minLng, area.minLat]
        ]
      ]
    }
  }));

  return JSON.stringify({ ...fc, features: [...fc.features, ...fiturPeta] }, null, 2);
}

/** Mengekspor KML berikut Placemark batas lembar peta bila diminta. */
export function eksporKmlDenganOpsi(daftar: DataSpasialItem[], petaBatas: AreaPetaOffline[], sertakanPeta: boolean): string {
  const kmlDasar = eksporKeKML(daftar);
  if (!sertakanPeta || petaBatas.length === 0) return kmlDasar;

  const placemarks = petaBatas
    .map((area) => {
      const ring = `${area.minLng},${area.minLat},0 ${area.maxLng},${area.minLat},0 ${area.maxLng},${area.maxLat},0 ${area.minLng},${area.maxLat},0 ${area.minLng},${area.minLat},0`;
      return `  <Placemark>
    <name>${escapeXml(`Batas Peta: ${area.namaArea}`)}</name>
    <description>${escapeXml(`Batas lembar peta offline (${area.ukuranMb} MB)`)}</description>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>${ring}</coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>`;
    })
    .join("\n");

  return kmlDasar.replace("</Document>", `${placemarks}\n</Document>`);
}
