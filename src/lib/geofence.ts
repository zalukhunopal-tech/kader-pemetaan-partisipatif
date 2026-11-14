import { AreaPetaOffline, KoordinatTitik } from "../types";
import { hitungJarakMeter } from "./geoUtils";

export interface ZonaGeofence {
  id: string;
  nama: string;
  sumber: "peta" | "radius";
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  pusatLat: number;
  pusatLng: number;
  radiusMeter?: number;
}

export interface StatusGeofence {
  zona: ZonaGeofence;
  diDalam: boolean;
  jarakPusatMeter: number;
  jarakDariTepiMeter: number;
}

export function titikDiDalamBatasArea(
  titik: { lat: number; lng: number },
  area: Pick<AreaPetaOffline, "minLat" | "maxLat" | "minLng" | "maxLng">
): boolean {
  return (
    titik.lat >= area.minLat &&
    titik.lat <= area.maxLat &&
    titik.lng >= area.minLng &&
    titik.lng <= area.maxLng
  );
}

/**
 * Membentuk zona geofence aktif dari peta kerja terbuka, lembar peta offline
 * yang melingkupi titik acuan, atau radius aman di sekitar titik acuan peta.
 */
export function buatZonaGeofence(ops: {
  petaKustomAktif?: AreaPetaOffline | null;
  areaOffline?: AreaPetaOffline[];
  gpsPos?: KoordinatTitik | null;
  center: { lat: number; lng: number };
  radiusDefaultMeter?: number;
}): ZonaGeofence {
  const { petaKustomAktif, areaOffline = [], gpsPos, center, radiusDefaultMeter = 500 } = ops;
  const acuan = gpsPos ?? center;

  if (petaKustomAktif) {
    return {
      id: petaKustomAktif.id,
      nama: petaKustomAktif.namaArea,
      sumber: "peta",
      minLat: petaKustomAktif.minLat,
      maxLat: petaKustomAktif.maxLat,
      minLng: petaKustomAktif.minLng,
      maxLng: petaKustomAktif.maxLng,
      pusatLat: (petaKustomAktif.minLat + petaKustomAktif.maxLat) / 2,
      pusatLng: (petaKustomAktif.minLng + petaKustomAktif.maxLng) / 2
    };
  }

  const petaMelingkupi = areaOffline.find((a) => titikDiDalamBatasArea(acuan, a));
  if (petaMelingkupi) {
    return {
      id: petaMelingkupi.id,
      nama: petaMelingkupi.namaArea,
      sumber: "peta",
      minLat: petaMelingkupi.minLat,
      maxLat: petaMelingkupi.maxLat,
      minLng: petaMelingkupi.minLng,
      maxLng: petaMelingkupi.maxLng,
      pusatLat: (petaMelingkupi.minLat + petaMelingkupi.maxLat) / 2,
      pusatLng: (petaMelingkupi.minLng + petaMelingkupi.maxLng) / 2
    };
  }

  return {
    id: "GEO-RADIUS",
    nama: `Radius Tugas ${radiusDefaultMeter} m`,
    sumber: "radius",
    pusatLat: acuan.lat,
    pusatLng: acuan.lng,
    radiusMeter: radiusDefaultMeter
  };
}

/** Mengevaluasi posisi saat ini terhadap zona geofence aktif. */
export function evaluasiGeofence(zona: ZonaGeofence, titik: { lat: number; lng: number }): StatusGeofence {
  const jarakPusatMeter = hitungJarakMeter(titik, { lat: zona.pusatLat, lng: zona.pusatLng });

  if (
    zona.sumber === "peta" &&
    zona.minLat !== undefined &&
    zona.maxLat !== undefined &&
    zona.minLng !== undefined &&
    zona.maxLng !== undefined
  ) {
    const diDalam =
      titik.lat >= zona.minLat &&
      titik.lat <= zona.maxLat &&
      titik.lng >= zona.minLng &&
      titik.lng <= zona.maxLng;

    if (diDalam) {
      const keUtara = hitungJarakMeter(titik, { lat: zona.maxLat, lng: titik.lng });
      const keSelatan = hitungJarakMeter(titik, { lat: zona.minLat, lng: titik.lng });
      const keTimur = hitungJarakMeter(titik, { lat: titik.lat, lng: zona.maxLng });
      const keBarat = hitungJarakMeter(titik, { lat: titik.lat, lng: zona.minLng });
      return {
        zona,
        diDalam: true,
        jarakPusatMeter,
        jarakDariTepiMeter: Math.min(keUtara, keSelatan, keTimur, keBarat)
      };
    }

    const latTerjepit = Math.max(zona.minLat, Math.min(zona.maxLat, titik.lat));
    const lngTerjepit = Math.max(zona.minLng, Math.min(zona.maxLng, titik.lng));
    return {
      zona,
      diDalam: false,
      jarakPusatMeter,
      jarakDariTepiMeter: hitungJarakMeter(titik, { lat: latTerjepit, lng: lngTerjepit })
    };
  }

  const radius = zona.radiusMeter ?? 500;
  return {
    zona,
    diDalam: jarakPusatMeter <= radius,
    jarakPusatMeter,
    jarakDariTepiMeter: Math.abs(radius - jarakPusatMeter)
  };
}
