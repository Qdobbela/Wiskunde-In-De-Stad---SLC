// MapLibre loads its web worker from a URL next to its own module, which a
// bundled chunk doesn't have. Serve the worker from public/ instead; the map
// code points to it with setWorkerUrl().
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
copyFileSync(
  "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
  "public/maplibre/maplibre-gl-worker.mjs",
);
