"use client";

import { useEffect, useState } from "react";

export type GeoStatus = "idle" | "searching" | "ok" | "weak" | "denied" | "unsupported";

export type GeoFix = {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

/** Unlocking needs this accuracy or better (build brief, anti-cheat rule 1). */
export const GOOD_ACCURACY_M = 30;

/** Ask for a fresh fix when the watch has been quiet this long… */
const REFRESH_MS = 4500;
/** …checked this often. */
const POLL_MS = 1000;

/**
 * Watches the phone's position. Starts only when `enabled`, so the browser
 * doesn't ask for permission before L04 explains why.
 */
export function useGeolocation(enabled: boolean) {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [fix, setFix] = useState<GeoFix | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("searching");
    let lastFixAt = 0;
    const onPosition = (pos: GeolocationPosition) => {
      lastFixAt = Date.now();
      const next: GeoFix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      };
      setFix(next);
      setStatus(next.accuracy <= GOOD_ACCURACY_M ? "ok" : "weak");
    };
    const onError = (err: GeolocationPositionError) =>
      setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "searching");
    const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 };

    const id = navigator.geolocation.watchPosition(onPosition, onError, options);
    // Phones only report when they move, but unlocking needs fresh fixes while
    // the group stands still (≥ 3 pings in the dwell time). Ask for one when
    // the watch has been quiet for a while.
    let asking = false;
    const poll = setInterval(() => {
      // One request at a time: an answer can take up to the 20 s timeout.
      if (asking || Date.now() - lastFixAt < REFRESH_MS) return;
      asking = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          asking = false;
          onPosition(pos);
        },
        (err) => {
          asking = false;
          onError(err);
        },
        options,
      );
    }, POLL_MS);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(poll);
    };
  }, [enabled]);

  return { status, fix };
}

/** Asks for location access once; resolves with the first fix or an error code. */
export function requestLocation(): Promise<{ ok: true } | { ok: false; reason: "denied" | "unavailable" }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve({ ok: false, reason: "unavailable" });
    navigator.geolocation.getCurrentPosition(
      () => resolve({ ok: true }),
      (err) => resolve({ ok: false, reason: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  });
}

/** Asks for camera access and closes the camera straight away. */
export async function requestCamera(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
