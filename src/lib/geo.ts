export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance in metres along the earth's surface (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing from a to b in degrees, 0 = north, 90 = east. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Walking minutes for a group of 13-year-olds in a city (~4.5 km/h). */
export function walkMinutes(distance: number): number {
  return Math.max(1, Math.round(distance / 75));
}

/** "240 m" or "1,2 km" */
export function formatDistance(distance: number): string {
  if (distance < 1000) return `${Math.round(distance / 10) * 10} m`;
  return `${(distance / 1000).toLocaleString("nl-BE", { maximumFractionDigits: 1 })} km`;
}

/**
 * A group's route: the tour order, rotated so groups start at different
 * spots. `startIndex` 0 starts at spot 1, 1 at spot 2, and so on.
 */
export function rotateRoute<T>(spots: T[], startIndex: number): T[] {
  if (spots.length === 0) return spots;
  const offset = ((startIndex % spots.length) + spots.length) % spots.length;
  return [...spots.slice(offset), ...spots.slice(0, offset)];
}

/** Session codes are typed on a phone: ignore case, spaces and dashes. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}
