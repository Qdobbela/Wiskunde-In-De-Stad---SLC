import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/basePath";

export const dynamic = "force-static";

/** Lets students add the walk to their home screen (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wiskunde in de stad",
    short_name: "Wiskunde",
    description: "Een wiskundetocht door Gent.",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    orientation: "portrait",
    // Brand colours from tokens.css (a manifest can't read CSS variables).
    background_color: "#E4E4DF",
    theme_color: "#E4E4DF",
    lang: "nl-BE",
    icons: [{ src: `${BASE_PATH}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
