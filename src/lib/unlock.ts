import { distanceM, type LatLng } from "./geo.ts";

/**
 * Anti-cheat rules from the build brief (section 8), as pure functions so the
 * server (Supabase Edge Function) and the tests use exactly the same logic.
 */

export type PingSample = LatLng & {
  accuracy: number;
  /** Server receive time in ms. Phone clocks aren't trusted. */
  at: number;
};

export type Zone = LatLng & { radiusM: number; dwellS: number };

/** Rule 1: accuracy must be this good or better. */
export const MAX_ACCURACY_M = 30;
/** Rule 1: at least this many pings during the dwell time. */
export const MIN_PINGS = 3;
/** A longer gap between pings breaks the streak (app closed, no signal). */
export const MAX_GAP_S = 20;

export type DwellStatus = {
  /** Distance from the newest ping to the spot. */
  distance: number;
  inside: boolean;
  accurate: boolean;
  /** Consecutive good pings (inside and accurate), newest first. */
  streakPings: number;
  streakSeconds: number;
  ready: boolean;
};

/** Whether the group has stood in the zone long enough. `pings` newest first. */
export function dwellStatus(pings: PingSample[], zone: Zone): DwellStatus {
  const newest = pings[0];
  if (!newest) {
    return { distance: Infinity, inside: false, accurate: false, streakPings: 0, streakSeconds: 0, ready: false };
  }
  const isGood = (p: PingSample) => p.accuracy <= MAX_ACCURACY_M && distanceM(p, zone) <= zone.radiusM;

  let streakPings = 0;
  let oldest = newest;
  for (const [i, p] of pings.entries()) {
    if (!isGood(p)) break;
    if (i > 0 && (pings[i - 1].at - p.at) / 1000 > MAX_GAP_S) break;
    streakPings++;
    oldest = p;
  }
  const streakSeconds = streakPings > 0 ? (newest.at - oldest.at) / 1000 : 0;
  const distance = distanceM(newest, zone);
  const ready =
    zone.dwellS <= 0 ? streakPings >= 1 : streakPings >= MIN_PINGS && streakSeconds >= zone.dwellS;

  return {
    distance,
    inside: distance <= zone.radiusM,
    accurate: newest.accuracy <= MAX_ACCURACY_M,
    streakPings,
    streakSeconds,
    ready,
  };
}

export type Suspicion =
  | { type: "gps_jump"; detail: { distance_m: number; seconds: number; speed_kmh: number } }
  | { type: "mock_suspected"; detail: { identical_pings: number } };

/** Rule 3: > 150 m within 5 s, or faster than 25 km/h. */
export const JUMP_M = 150;
export const JUMP_WINDOW_S = 5;
export const MAX_SPEED_KMH = 25;
/** Ignore speed below this distance: GPS jitter on short intervals. */
const MIN_DISTANCE_FOR_SPEED_M = 50;
/** Rule 3: this many pings with exactly the same coordinates. */
export const IDENTICAL_PINGS = 6;

/** Checks a new ping against the previous one(s). `pings` newest first. */
export function plausibility(pings: PingSample[]): Suspicion | null {
  const [cur, prev] = pings;
  if (cur && prev) {
    const seconds = Math.max((cur.at - prev.at) / 1000, 0.001);
    const distance = distanceM(prev, cur);
    const speed = (distance / seconds) * 3.6;
    const detail = {
      distance_m: Math.round(distance),
      seconds: Math.round(seconds * 10) / 10,
      speed_kmh: Math.round(speed),
    };
    if (seconds <= JUMP_WINDOW_S && distance > JUMP_M) return { type: "gps_jump", detail };
    if (distance > MIN_DISTANCE_FOR_SPEED_M && speed > MAX_SPEED_KMH) return { type: "gps_jump", detail };
  }

  // Real GPS always wobbles in the last decimals; a fake location often doesn't.
  if (pings.length >= IDENTICAL_PINGS) {
    const recent = pings.slice(0, IDENTICAL_PINGS);
    const same = recent.every(
      (p) => p.lat === recent[0].lat && p.lng === recent[0].lng && p.accuracy === recent[0].accuracy,
    );
    if (same) return { type: "mock_suspected", detail: { identical_pings: IDENTICAL_PINGS } };
  }
  return null;
}
