"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { call } from "./api";

/** Keeps the screen on while walking, where the browser supports it. */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          lock = await navigator.wakeLock.request("screen");
        }
      } catch {}
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
}

/**
 * Rule 7: leaving the app during an open question is reported, with how long.
 * The server only logs it when a question is really open.
 */
export function useAppLeftReport(questionOpen: boolean) {
  useEffect(() => {
    if (!questionOpen) return;
    let hiddenAt: number | null = null;
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        const seconds = Math.round((Date.now() - hiddenAt) / 1000);
        hiddenAt = null;
        if (seconds >= 3) call("event", { type: "app_left", seconds }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [questionOpen]);
}

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * The phone's compass heading (0 = north), or null without a compass.
 * iPhones only give it after a tap (`enable`).
 */
export function useHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const listening = useRef(false);

  const listen = useCallback(() => {
    if (listening.current) return;
    listening.current = true;
    const onAbsolute = (e: DeviceOrientationEvent) => {
      if (e.absolute && e.alpha !== null) setHeading((360 - e.alpha) % 360);
    };
    const onRelative = (e: Event) => {
      const ev = e as OrientationEvent;
      if (typeof ev.webkitCompassHeading === "number") setHeading(ev.webkitCompassHeading);
    };
    window.addEventListener("deviceorientationabsolute", onAbsolute as EventListener);
    window.addEventListener("deviceorientation", onRelative);
  }, []);

  useEffect(() => {
    const Orientation = (window as unknown as { DeviceOrientationEvent?: OrientationPermission }).DeviceOrientationEvent;
    if (Orientation?.requestPermission) setNeedsTap(true);
    else listen();
  }, [listen]);

  const enable = useCallback(async () => {
    const Orientation = (window as unknown as { DeviceOrientationEvent?: OrientationPermission }).DeviceOrientationEvent;
    try {
      if ((await Orientation?.requestPermission?.()) === "granted") {
        setNeedsTap(false);
        listen();
      }
    } catch {}
  }, [listen]);

  return { heading, needsTap, enable };
}
