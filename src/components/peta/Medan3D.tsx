import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import { BasemapType, DataSpasialItem, KoordinatTitik } from "../../types";
import { SUMBER_TILE } from "../../lib/petaOffline";

interface Props {
  center: { lat: number; lng: number };
  zoom: number;
  pitch: number;
  bearing: number;
  basemap: BasemapType;
  data: DataSpasialItem[];
  draft: KoordinatTitik[];
  polygon: boolean;
  gps: KoordinatTitik | null;
  onCamera: (c: { lat: number; lng: number }, z: number, p: number, b: number) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** DEM Terrarium AWS (Mapzen), elevasi nyata; tidak mengunduh massal tile publik. */
export default function Medan3D(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const current = useRef(props);
  useLayoutEffect(() => {
    current.current = props;
  });
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const source = props.basemap === "taktis" || props.basemap === "google" || props.basemap === "esri" ? "osm" : props.basemap;
  useEffect(() => {
    if (!container.current) return;
    let m: maplibregl.Map;
    try {
      const p = current.current;
      m = new maplibregl.Map({
        container: container.current,
        center: [p.center.lng, p.center.lat],
        zoom: p.zoom,
        pitch: p.pitch,
        bearing: p.bearing,
        maxPitch: 70,
        maxZoom: 20,
        style: { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#dce5df" } }] }
      });
    } catch {
      queueMicrotask(() => setError("Perangkat ini tidak mendukung WebGL. Gunakan peta 2D."));
      return;
    }
    map.current = m;
    m.on("load", () => {
      m.addSource("elevasi", {
        type: "raster-dem",
        tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 15,
        encoding: "terrarium",
        attribution: 'Elevasi © <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen / AWS Terrain Tiles</a>'
      });
      m.setTerrain({ source: "elevasi", exaggeration: 1 });
      m.addSource("survei", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "area-survei",
        type: "fill",
        source: "survei",
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": "#0cbd88", "fill-opacity": 0.25 }
      });
      m.addLayer({
        id: "garis-survei",
        type: "line",
        source: "survei",
        filter: ["!=", "$type", "Point"],
        paint: { "line-color": "#ed6b24", "line-width": 4 }
      });
      m.addLayer({
        id: "titik-survei",
        type: "circle",
        source: "survei",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": 7,
          "circle-color": ["case", ["==", ["get", "id"], "gps"], "#208bff", "#ed6b24"],
          "circle-stroke-color": "white",
          "circle-stroke-width": 2
        }
      });
      setReady(true);
    });
    m.on("error", () => {
      setError("Sebagian data medan/peta gagal dimuat. Periksa koneksi atau kembali ke 2D; elevasi belum dapat dipastikan lengkap.");
    });
    m.on("moveend", () => {
      const c = m.getCenter();
      current.current.onCamera({ lat: c.lat, lng: c.lng }, m.getZoom(), m.getPitch(), m.getBearing());
    });
    m.on("click", (e) => {
      if (!m.getLayer("titik-survei")) return;
      const features = m.queryRenderedFeatures(e.point, { layers: ["titik-survei", "garis-survei", "area-survei"] });
      const id = features[0]?.properties?.id;
      if (id && id !== "draft" && id !== "gps") current.current.onSelect(String(id));
    });
    const resize = new ResizeObserver(() => m.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const s = SUMBER_TILE[source];
    if (m.getLayer("basemap")) m.removeLayer("basemap");
    if (m.getSource("basemap")) m.removeSource("basemap");
    m.addSource("basemap", {
      type: "raster",
      tiles: [s.template.replace("{s}", "a")],
      tileSize: 256,
      maxzoom: s.zoomMaks,
      attribution: s.atribusi
    });
    m.addLayer({ id: "basemap", type: "raster", source: "basemap" }, "area-survei");
  }, [source, ready]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    if (
      Math.abs(c.lat - props.center.lat) > 1e-7 ||
      Math.abs(c.lng - props.center.lng) > 1e-7 ||
      Math.abs(m.getZoom() - props.zoom) > 1e-5 ||
      Math.abs(m.getPitch() - props.pitch) > 0.01 ||
      Math.abs(m.getBearing() - props.bearing) > 0.01
    )
      m.jumpTo({ center: [props.center.lng, props.center.lat], zoom: props.zoom, pitch: props.pitch, bearing: props.bearing });
  }, [props.center, props.zoom, props.pitch, props.bearing]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const features: GeoJSON.Feature[] = [];
    const add = (id: string, points: KoordinatTitik[], kind: string) => {
      if (!points.length) return;
      const coords = points.map((p) => [p.lng, p.lat]);
      const geometry: GeoJSON.Geometry =
        kind === "polygon" && coords.length >= 3
          ? { type: "Polygon", coordinates: [[...coords, coords[0]]] }
          : kind !== "point" && coords.length >= 2
            ? { type: "LineString", coordinates: coords }
            : { type: "Point", coordinates: coords[0] };
      features.push({ type: "Feature", properties: { id }, geometry });
    };
    props.data.forEach((d) => add(d.id, d.koordinat, d.jenisGeometri));
    add("draft", props.draft, props.polygon ? "polygon" : "line");
    if (props.gps) add("gps", [props.gps], "point");
    (m.getSource("survei") as GeoJSONSource).setData({ type: "FeatureCollection", features });
  }, [props.data, props.draft, props.polygon, props.gps, ready]);
  return (
    <div className="medan-3d" data-ready={ready}>
      <div ref={container} className="medan-3d-map" />
      <div className="medan-status" role="status">
        {error || `Medan 3D • ${SUMBER_TILE[source].nama} • elevasi 1× (perlu internet)`}
        {error && (
          <button type="button" onClick={props.onClose}>
            Kembali ke 2D
          </button>
        )}
      </div>
    </div>
  );
}
