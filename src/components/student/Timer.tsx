"use client";

import { useEffect, useState } from "react";
import styles from "./widgets.module.css";

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Time left for the question or the whole walk. Orange in the last minute. */
export function Timer({ endsAt, onEnd }: { endsAt: string; onEnd?: () => void }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = end - now;
  useEffect(() => {
    if (left <= 0) onEnd?.();
  }, [left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const almost = left <= 60_000;
  return (
    <span
      className={[styles.timer, almost && styles.timerAlmost].filter(Boolean).join(" ")}
      role="timer"
      aria-live={almost ? "polite" : "off"}
    >
      {left > 0 ? `${format(left)} over` : "Tijd is om"}
    </span>
  );
}
