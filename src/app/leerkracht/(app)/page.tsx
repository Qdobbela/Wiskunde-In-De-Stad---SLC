"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { createTour } from "@/lib/teacher/mutations";
import { isRunning, listSessions, listTours, type TourSummary } from "@/lib/teacher/queries";
import { longDate, shortDate } from "@/lib/teacher/format";
import { useLoad } from "@/lib/useLoad";
import { MiniMap } from "./MiniMap";
import layout from "./teacher.module.css";
import styles from "./tochten.module.css";

function tourNote(tour: TourSummary) {
  if (tour.spots.length === 0) return "Nog geen spots";
  if (!tour.ready) {
    return tour.missingCount === 1 ? "1 vraag ontbreekt nog" : `${tour.missingCount} vragen ontbreken nog`;
  }
  return tour.lastUsed ? `Laatst gebruikt op ${longDate(tour.lastUsed)}` : "Klaar om te gebruiken";
}

/** T01 Overzicht tochten. */
export default function TochtenPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { data, error } = useLoad(() => Promise.all([listTours(), listSessions(5)]), []);
  const [tours, sessions] = data ?? [[], []];

  async function newTour() {
    setCreating(true);
    try {
      router.push(`/leerkracht/tocht/?id=${await createTour()}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Overzicht</span>
          <h1 className={layout.title}>Jouw tochten</h1>
        </div>
        <div className={layout.actions}>
          <Button className={styles.newTour} onClick={newTour} disabled={creating}>
            + Nieuwe tocht
          </Button>
        </div>
      </header>

      {error && <p className={layout.error}>{error}</p>}

      {data && tours.length === 0 ? (
        <div className={`${layout.panel} ${styles.empty}`}>
          <h3>Nog geen tochten</h3>
          <p>Maak je eerste tocht: prik spots op de kaart en voeg per spot vragen toe.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {tours.map((tour) => (
            <article key={tour.id} className={`${layout.panel} ${styles.card}`}>
              <div>
                <StatusChip status={tour.ready ? "opgelost" : "wacht"} label={tour.ready ? "Klaar" : "Concept"} />
              </div>
              <Link href={`/leerkracht/tocht/?id=${tour.id}`} className={styles.mapLink} aria-label={`${tour.title} bewerken`}>
                <MiniMap
                  spots={tour.spots.map((s) => ({
                    id: s.id,
                    lat: s.lat,
                    lng: s.lng,
                    label: s.position,
                    status: s.complete ? "opgelost" : "vergrendeld",
                  }))}
                />
              </Link>
              <h3 className={styles.cardTitle}>
                <Link href={`/leerkracht/tocht/?id=${tour.id}`}>{tour.title}</Link>
              </h3>
              <p className={styles.counts}>
                {tour.spots.length} spots · {tour.questionCount} vragen
              </p>
              <p className={styles.note}>{tourNote(tour)}</p>
              <div className={styles.cardActions}>
                {tour.ready ? (
                  <ButtonLink href={`/leerkracht/start/?tocht=${tour.id}`}>Start sessie</ButtonLink>
                ) : (
                  <ButtonLink href={`/leerkracht/tocht/?id=${tour.id}`} variant="outline">
                    Afwerken
                  </ButtonLink>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <section className={layout.panel}>
        <h2 className={layout.sectionLabel}>Recente sessies</h2>
        {sessions.length === 0 ? (
          <p className={styles.note}>Nog geen sessies. Start een sessie vanaf een tocht die klaar is.</p>
        ) : (
          <ul className={styles.sessions}>
            {sessions.map((s) => (
              <li key={s.id} className={styles.sessionRow}>
                <span className={styles.sessionDate}>{shortDate(s.createdAt)}</span>
                <span className={styles.sessionClass}>
                  {[s.classLabel, `${s.teamCount} ${s.teamCount === 1 ? "groep" : "groepen"}`].filter(Boolean).join(" · ")}
                </span>
                <span className={styles.sessionTour}>{s.tourTitle}</span>
                <span className={styles.sessionPoints}>
                  {s.averagePoints === null ? "" : `Gem. ${s.averagePoints} punten`}
                </span>
                {isRunning(s) ? (
                  <Link href={`/leerkracht/live/?sessie=${s.id}`} className={styles.sessionLink}>
                    Live
                  </Link>
                ) : (
                  <Link href={`/leerkracht/resultaten/?sessie=${s.id}`} className={styles.sessionLink}>
                    Resultaten
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
