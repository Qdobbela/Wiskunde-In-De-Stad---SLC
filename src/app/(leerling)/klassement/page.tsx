"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBar } from "@/components/student/StatusBar";
import { ButtonLink } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { ApiError, call, groupToken, type Ranking } from "@/lib/student/api";
import common from "@/components/student/student.module.css";
import styles from "./klassement.module.css";

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** L10 Klassement. Points can still change while the teacher reviews photos. */
export default function KlassementPage() {
  const router = useRouter();
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupToken()) {
      router.replace("/");
      return;
    }
    const load = () =>
      call<Ranking>("ranking")
        .then(setRanking)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Laden lukte niet."));
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <main className={common.screen}>
      <StatusBar status="idle" />
      {error && <p className={common.error}>{error}</p>}
      {ranking && (
        <>
          <div className={styles.head}>
            <Sticker rotate={4} className={styles.sticker}>
              Klaar!
            </Sticker>
            <h1 className={common.title}>Jullie eindigen op plek {ranking.place}</h1>
            <p className={styles.meta}>
              {ranking.done} van {ranking.total} spots{ranking.seconds !== null ? ` · ${duration(ranking.seconds)}` : ""}
            </p>
          </div>
          <section className={common.card}>
            <span className={common.cardLabel}>Klassement</span>
            {ranking.rows.map((row) => (
              <div key={`${row.place}-${row.name}`} className={[styles.row, row.isMe && styles.me].filter(Boolean).join(" ")}>
                <span className={styles.place}>{row.place}</span>
                <span className={styles.name}>{row.name}</span>
                <span className={styles.points}>{row.points}</span>
              </div>
            ))}
          </section>
          <div className={common.spacer} />
          {ranking.pendingReview && (
            <p className={styles.note}>Je leerkracht kijkt de foto’s nog na. De punten kunnen nog wijzigen.</p>
          )}
          <ButtonLink variant="outline" href="/tocht/?route=1">
            Bekijk onze route
          </ButtonLink>
        </>
      )}
    </main>
  );
}
