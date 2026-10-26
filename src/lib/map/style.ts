import { setWorkerUrl, type LayerSpecification, type StyleSpecification } from "maplibre-gl";
import { asset } from "@/lib/basePath";

// Copied there by scripts/copy-maplibre-worker.mjs; see that file for why.
setWorkerUrl(asset("/maplibre/maplibre-gl-worker.mjs"));

/** OpenFreeMap: free OpenStreetMap vector tiles, no API key. */
const BASE_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export const GENT_CENTER: [number, number] = [3.7250, 51.0543];

let cached: Promise<StyleSpecification> | null = null;

/** Reads a design token from :root so the map follows tokens.css. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Restyles the base map to the concrete palette: sunken ground, white
 * streets, riso-blue water, no POIs. Labels stay small and grey.
 */
function restyle(style: StyleSpecification): StyleSpecification {
  const ground = token("--color-bg-sunken");
  const subtle = token("--color-bg-subtle");
  const street = token("--color-bg-surface");
  const water = token("--color-action-info");
  const text = token("--color-text-secondary");
  const screen = token("--color-bg-screen");

  const layers: LayerSpecification[] = [];
  for (const layer of style.layers) {
    const id = layer.id;
    if (/boundary|aeroway|airport|shield|label_(state|country)|ice|glacier/.test(id)) continue;

    if (layer.type === "background") {
      layer.paint = { "background-color": ground };
    } else if (layer.type === "fill" && id === "water") {
      layer.paint = { "fill-color": water, "fill-opacity": 0.3 };
    } else if (layer.type === "line" && id === "waterway") {
      layer.paint = { ...layer.paint, "line-color": water, "line-opacity": 0.6 };
    } else if (layer.type === "fill" && id === "building") {
      layer.paint = { "fill-color": screen, "fill-opacity": 0.8 };
    } else if (layer.type === "fill") {
      layer.paint = { "fill-color": subtle, "fill-opacity": 0.5 };
    } else if (layer.type === "line" && id.startsWith("railway")) {
      layer.paint = { ...layer.paint, "line-color": text, "line-opacity": 0.3 };
    } else if (layer.type === "line" && id.includes("casing")) {
      layer.paint = { ...layer.paint, "line-color": ground, "line-opacity": 0 };
    } else if (layer.type === "line") {
      layer.paint = { ...layer.paint, "line-color": street, "line-opacity": 1 };
    } else if (layer.type === "symbol") {
      layer.paint = {
        ...layer.paint,
        "text-color": id.startsWith("water") ? water : text,
        "text-halo-color": ground,
        "text-halo-width": 1,
      };
    }
    layers.push(layer);
  }
  return { ...style, layers };
}

export function loadMapStyle(): Promise<StyleSpecification> {
  cached ??= fetch(BASE_STYLE_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Kaartstijl laden mislukt (${res.status})`);
      return res.json() as Promise<StyleSpecification>;
    })
    .then(restyle)
    .catch((err) => {
      cached = null;
      throw err;
    });
  return cached;
}

/** A circle around a point as a GeoJSON polygon, for the unlock zone. */
export function circlePolygon(lng: number, lat: number, radiusM: number, steps = 48) {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}
