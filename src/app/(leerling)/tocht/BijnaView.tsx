"use client";

import { useEffect, useState } from "react";
import { SpotBadge } from "@/components/student/SpotBadge";
import { StatusBar } from "@/components/student/StatusBar";
import { Timer } from "@/components/student/Timer";
import { Button } from "@/components/ui/Button";
import { asset } from "@/lib/basePath";
import { bearingDeg, distanceM, formatDistance } from "@/lib/geo";
import type { RouteSpot } from "@/lib/student/api";
import { useHeading } from "@/lib/student/hooks";
import type { GeoFix, GeoStatus } from "@/lib/student/useGeolocation";
import common from "@/components/student/student.module.css";
import styles from "./bijna.module.css";

export type ZoneInfo = {
  target: string;
  inZone: boolean;
  accurate: boolean;
  streakSeconds: number;
  dwellS: number;
  /** When the server sent this (to count down between pings). */
  at: number;
};

type BijnaViewProps = {
  target: RouteSpot;
  current: number;
  total: number;
  endsAt: string | null;
  fix: GeoFix | null;
  geoStatus: GeoStatus;
  zone: ZoneInfo | null;
  blocked: boolean;
  onShowMap: () => void;
};

function mmss(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** L06 Bijna: direction, distance and the dwell countdown. */
export function BijnaView({ target, current, total, endsAt, fix, geoStatus, zone, blocked, onShowMap }: BijnaViewProps) {
  const { heading, needsTap, enable } = useHeading();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const distance = fix ? distanceM(fix, target) : null;
  const bearing = fix ? bearingDeg(fix, target) : 0;
  // With a compass the arrow points the real way; without one, north is up.
  const rotation = bearing - (heading ?? 0);

  const z = zone?.target === target.id ? zone : null;
  const inZone = z?.inZone ?? (distance !== null && distance <= target.radiusM);
  const counting = Boolean(z && z.inZone && z.accurate && z.streakSeconds >= 0 && !blocked);
  // Count down smoothly between pings; the server decides when it's done.
  const elapsed = counting && z ? z.streakSeconds + (now - z.at) / 1000 : 0;
  const left = target.dwellS - elapsed;

  let hint = `Loop richting ${target.name}. Zodra jullie in de zone staan, start de teller.`;
  if (blocked) hint = "Even wachten: je leerkracht kijkt iets na. De vraag blijft op slot tot dan.";
  else if (inZone && fix && !z?.accurate && fix.accuracy > 30) hint = `Sta even stil: de GPS is nog niet nauwkeurig genoeg (±${Math.round(fix.accuracy)} m).`;
  else if (inZone) hint = "Jullie staan in de zone. Blijf hier staan, de vraag gaat zo open.";

  return (
    <main className={common.screen}>
      <StatusBar status={geoStatus} fix={fix} />
      <div className={styles.topBar}>
        <SpotBadge current={current} total={total} />
        {endsAt && <Timer endsAt={endsAt} />}
      </div>
      <p className={common.step}>Op weg naar</p>
      <h1 className={common.title}>{target.name}</h1>

      <div className={styles.direction}>
        <button
          type="button"
          className={[styles.compass, inZone && styles.compassHere].filter(Boolean).join(" ")}
          onClick={needsTap ? enable : undefined}
          aria-label={needsTap ? "Tik om het kompas aan te zetten" : `Richting ${Math.round(bearing)} graden`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG from Figma */}
          <img
            src={asset("/figma/pijl.svg")}
            alt=""
            width={96}
            height={96}
            className={styles.arrow}
            // The arrow in the SVG points up (north).
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </button>
        {needsTap && <p className={styles.compassHint}>Tik op de pijl om het kompas aan te zetten</p>}
        {heading === null && !needsTap && <p className={styles.compassHint}>Geen kompas: noorden is boven</p>}
        <p className={styles.distance}>{distance === null ? "Locatie zoeken…" : inZone ? "Jullie zijn er!" : `Nog ${formatDistance(distance)}`}</p>
        <p className={styles.hint}>{hint}</p>
      </div>

      <div className={common.spacer} />
      <section className={`${common.card} ${styles.zone}`} aria-live="polite">
        <div className={styles.zoneHead}>
          <span className={styles.zoneTitle}>Blijf {target.dwellS} sec staan</span>
          <span className={styles.zoneTimer}>{mmss(counting ? left : target.dwellS)}</span>
        </div>
        <p className={styles.zoneText}>
          De vraag gaat pas open als de hele groep {target.dwellS} seconden in de zone blijft.
        </p>
      </section>
      <Button variant="outline" onClick={onShowMap}>
        Toon kaart
      </Button>
    </main>
  );
}
