"use client";

import { useState } from "react";
import { LevelCards } from "@/components/student/LevelCards";
import { SpotBadge } from "@/components/student/SpotBadge";
import { StatusBar } from "@/components/student/StatusBar";
import { Timer } from "@/components/student/Timer";
import { Button } from "@/components/ui/Button";
import { NIVEAUS, type Niveau } from "@/lib/niveau";
import { ApiError, call, type GroupState, type LevelChoice } from "@/lib/student/api";
import type { GeoFix, GeoStatus } from "@/lib/student/useGeolocation";
import common from "@/components/student/student.module.css";
import levels from "@/components/student/levels.module.css";
import styles from "./vraag.module.css";

type NiveauViewProps = {
  choice: LevelChoice;
  current: number;
  total: number;
  sessionEndsAt: string | null;
  fix: GeoFix | null;
  geoStatus: GeoStatus;
  onChosen: (state: GroupState) => void;
};

/**
 * L03 at every spot: the spot is unlocked, the group picks a level, and only
 * then gets the question (from the server). The choice can't be undone.
 */
export function NiveauView({ choice, current, total, sessionEndsAt, fix, geoStatus, onChosen }: NiveauViewProps) {
  const [level, setLevel] = useState<Niveau | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function choose() {
    if (!level) return;
    setSending(true);
    setError(null);
    try {
      onChosen(await call<GroupState>("choose-level", { locationId: choice.locationId, level }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lukte niet. Probeer opnieuw.");
      setSending(false);
    }
  }

  return (
    <main className={common.screen}>
      <StatusBar status={geoStatus} fix={fix} />
      <div className={styles.topBar}>
        <SpotBadge current={current} total={total} />
        {sessionEndsAt && <Timer endsAt={sessionEndsAt} />}
      </div>
      <div>
        <p className={common.step}>Ontgrendeld: {choice.spotName}</p>
        <h1 className={common.title}>Kies jullie niveau</h1>
      </div>
      <LevelCards options={choice.levels} value={level} onChange={setLevel} />
      <p className={levels.note}>Let op: na het kiezen kan je het niveau voor deze vraag niet meer wijzigen.</p>
      {error && (
        <p className={common.error} role="alert">
          {error}
        </p>
      )}
      <div className={common.spacer} />
      <Button disabled={!level || sending} onClick={choose}>
        {level ? `Kies ${NIVEAUS[level].label}` : "Kies een niveau"}
      </Button>
    </main>
  );
}
