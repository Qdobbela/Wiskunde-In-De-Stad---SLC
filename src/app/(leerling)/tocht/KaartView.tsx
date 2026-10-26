"use client";

import { useMemo } from "react";
import { MapView, type MapPin } from "@/components/map/MapView";
import { SpotBadge } from "@/components/student/SpotBadge";
import { StatusBar } from "@/components/student/StatusBar";
import { Timer } from "@/components/student/Timer";
import { Voortgang } from "@/components/student/Voortgang";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { distanceM, formatDistance, walkMinutes } from "@/lib/geo";
import type { RouteSpot } from "@/lib/student/api";
import type { GeoFix, GeoStatus } from "@/lib/student/useGeolocation";
import common from "@/components/student/student.module.css";
import styles from "./tocht.module.css";

type KaartViewProps = {
  route: RouteSpot[];
  next: RouteSpot | null;
  endsAt: string | null;
  fix: GeoFix | null;
  geoStatus: GeoStatus;
  onOpenNext: () => void;
};

/** L05 Kaart: map, route, next spot and progress. */
export function KaartView({ route, next, endsAt, fix, geoStatus, onOpenNext }: KaartViewProps) {
  const doneCount = route.filter((s) => s.done).length;

  const pins: MapPin[] = useMemo(
    () =>
      route.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        label: s.number,
        status: s.done ? "opgelost" : s.id === next?.id ? "hier" : "vergrendeld",
      })),
    [route, next],
  );

  const me = fix ? { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracy } : null;

  // Dotted line: the spots done so far, then the group, then the next spot.
  const routeLine = useMemo(() => {
    const points: [number, number][] = route.filter((s) => s.done).map((s) => [s.lng, s.lat]);
    if (fix) points.push([fix.lng, fix.lat]);
    if (next) points.push([next.lng, next.lat]);
    return points;
  }, [route, next, fix]);

  const distance = fix && next ? distanceM(fix, next) : null;

  return (
    <main className={`${common.screen} ${styles.screen}`}>
      <StatusBar status={geoStatus} fix={fix} />
      <div className={styles.topBar}>
        {next ? <SpotBadge current={doneCount + 1} total={route.length} /> : <span />}
        {endsAt && <Timer endsAt={endsAt} />}
      </div>

      <MapView
        pins={pins}
        me={me}
        routeLine={routeLine}
        label={next ? { pinId: next.id, text: next.name } : null}
        onPinClick={(id) => id === next?.id && onOpenNext()}
        // Refit once when the first GPS fix arrives, so the group sees itself.
        fitKey={me ? "met-positie" : "spots"}
        className={styles.map}
      />

      {next ? (
        <button type="button" className={`${common.card} ${styles.nextCard}`} onClick={onOpenNext} aria-live="polite">
          <span className={styles.cardHead}>
            <span className={common.cardLabel}>Volgende spot</span>
            <StatusChip status="vergrendeld" />
          </span>
          <span className={styles.spotName}>{next.name}</span>
          <span className={styles.distance}>
            {distance === null
              ? geoStatus === "denied"
                ? "Zet je locatie aan om te zien hoe ver het is"
                : "Jullie locatie zoeken…"
              : `${formatDistance(distance)} · ongeveer ${walkMinutes(distance)} min wandelen`}
          </span>
          <Voortgang done={doneCount} total={route.length} />
        </button>
      ) : (
        <section className={`${common.card} ${styles.nextCard}`}>
          <span className={common.cardLabel}>Klaar!</span>
          <span className={styles.spotName}>Alle spots gedaan</span>
          <Voortgang done={doneCount} total={route.length} />
          <ButtonLink href="/klassement/">Bekijk het klassement</ButtonLink>
        </section>
      )}
    </main>
  );
}
