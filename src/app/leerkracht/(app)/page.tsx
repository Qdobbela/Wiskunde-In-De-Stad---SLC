import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { MiniMap } from "./MiniMap";
import { createTour } from "./actions";
import { listTours, longDate, recentSessions, shortDate, type TourSummary } from "@/lib/teacher/data";
import layout from "./teacher.module.css";
import styles from "./tochten.module.css";

export const metadata = { title: "Jouw tochten · Wiskunde in de stad" };

function tourNote(tour: TourSummary) {
  if (tour.spots.length === 0) return "Nog geen spots";
  if (!tour.ready) {
    return tour.missingCount === 1 ? "1 vraag ontbreekt nog" : `${tour.missingCount} vragen ontbreken nog`;
  }
  return tour.lastUsed ? `Laatst gebruikt op ${longDate(tour.lastUsed)}` : "Klaar om te gebruiken";
}

export default async function TochtenPage() {
  const [tours, sessions] = await Promise.all([listTours(), recentSessions()]);

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Overzicht</span>
          <h1 className={layout.title}>Jouw tochten</h1>
        </div>
        <form action={createTour} className={layout.actions}>
          <Button type="submit" className={styles.newTour}>
            + Nieuwe tocht
          </Button>
        </form>
      </header>

      {tours.length === 0 ? (
        <div className={`${layout.panel} ${styles.empty}`}>
          <h3>Nog geen tochten</h3>
          <p>Maak je eerste tocht: prik spots op de kaart en voeg per spot vragen toe.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {tours.map((tour) => (
            <article key={tour.id} className={`${layout.panel} ${styles.card}`}>
              <div>
                <StatusChip
                  status={tour.ready ? "opgelost" : "wacht"}
                  label={tour.ready ? "Klaar" : "Concept"}
                />
              </div>
              <Link href={`/leerkracht/tochten/${tour.id}`} className={styles.mapLink} aria-label={`${tour.title} bewerken`}>
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
                <Link href={`/leerkracht/tochten/${tour.id}`}>{tour.title}</Link>
              </h3>
              <p className={styles.counts}>
                {tour.spots.length} spots · {tour.questionCount} vragen
              </p>
              <p className={styles.note}>{tourNote(tour)}</p>
              <div className={styles.cardActions}>
                {tour.ready ? (
                  <ButtonLink href={`/leerkracht/tochten/${tour.id}/start`}>Start sessie</ButtonLink>
                ) : (
                  <ButtonLink href={`/leerkracht/tochten/${tour.id}`} variant="outline">
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
                  {[s.classLabel, `${s.teamCount} ${s.teamCount === 1 ? "groep" : "groepen"}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className={styles.sessionTour}>{s.tourTitle}</span>
                <span className={styles.sessionPoints}>
                  {s.averagePoints === null ? "" : `Gem. ${s.averagePoints} punten`}
                </span>
                <Link href={`/leerkracht/sessies/${s.id}`} className={styles.sessionLink}>
                  {s.status === "live" ? "Live" : "Resultaten"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
