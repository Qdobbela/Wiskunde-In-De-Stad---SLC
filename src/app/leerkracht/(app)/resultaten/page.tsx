"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { NiveauTag } from "@/components/ui/NiveauTag";
import { NIVEAUS } from "@/lib/niveau";
import { hoursMinutes, longDate, shortDate } from "@/lib/teacher/format";
import { listSessions } from "@/lib/teacher/queries";
import { answerScore, loadSession, type SessionData } from "@/lib/teacher/sessionData";
import { useLoad } from "@/lib/useLoad";
import layout from "../teacher.module.css";
import styles from "./resultaten.module.css";

function rankingOf(data: SessionData) {
  return [...data.teams]
    .map((t) => ({
      team: t,
      seconds: t.startedAt && t.lastAnswerAt ? (new Date(t.lastAnswerAt).getTime() - new Date(t.startedAt).getTime()) / 1000 : null,
      flags: t.flags.length,
    }))
    .sort((a, b) => b.team.points - a.team.points || (a.seconds ?? Infinity) - (b.seconds ?? Infinity));
}

/** The spot with the lowest share of correct answers (at least one answer). */
function hardestSpot(data: SessionData) {
  let worst: { name: string; percent: number } | null = null;
  for (const spot of data.spots) {
    const scores = data.teams
      .flatMap((t) => t.answers)
      .filter((a) => a.question.location_id === spot.id)
      .map(answerScore)
      .filter((s): s is number => s !== null);
    if (scores.length === 0) continue;
    const percent = Math.round((scores.filter((s) => s === 1).length / scores.length) * 100);
    if (!worst || percent < worst.percent) worst = { name: spot.name, percent };
  }
  return worst;
}

function downloadCsv(data: SessionData) {
  const rows = rankingOf(data);
  const header = ["Plek", "Groep", "Leerlingen", "Niveau", "Spots", "Tijd", "Meldingen", "Punten"];
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    header.map(cell).join(";"),
    ...rows.map((r, i) =>
      [
        i + 1,
        r.team.name,
        r.team.members.join(", "),
        NIVEAUS[r.team.level].label,
        `${r.team.done}/${data.spots.length}`,
        r.seconds === null ? "" : hoursMinutes(r.seconds),
        r.flags,
        r.team.points,
      ]
        .map(cell)
        .join(";"),
    ),
  ];
  // Semicolons and a BOM so Excel (nl-BE) opens it with the right columns and accents.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resultaten-${data.session.class_label || "klas"}-${data.session.created_at.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Results({ sessionId }: { sessionId: string }) {
  const { data, error } = useLoad(() => loadSession(sessionId), [sessionId]);
  if (error) return <p className={layout.error}>{error}</p>;
  if (!data) return <p className={layout.loading}>Laden…</p>;

  const rows = rankingOf(data);
  const average = rows.length ? Math.round(rows.reduce((n, r) => n + r.team.points, 0) / rows.length) : 0;
  const hardest = hardestSpot(data);
  const flagCount = data.teams.reduce((n, t) => n + t.flags.length, 0);
  const pending = data.teams.reduce((n, t) => n + t.pendingPhotos, 0);

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>
            {data.session.tour?.title} · {longDate(data.session.created_at)}
          </span>
          <h1 className={layout.title}>Resultaten {data.session.class_label}</h1>
        </div>
        <div className={layout.actions}>
          <Button variant="outline" className={styles.exportButton} onClick={() => downloadCsv(data)}>
            Exporteer CSV
          </Button>
          <Button className={styles.exportButton} onClick={() => window.print()}>
            Exporteer PDF
          </Button>
        </div>
      </header>

      <div className={layout.tiles}>
        <div className={`${layout.tile} ${styles.tile}`}>
          <span className={layout.tileValue}>{average}</span>
          <span className={styles.tileText}>gemiddelde score</span>
        </div>
        <div className={`${layout.tile} ${layout.tilePending} ${styles.tile}`}>
          <span className={layout.tileValue}>{hardest ? `${hardest.percent}%` : "–"}</span>
          <span className={styles.tileText}>{hardest ? `juist bij ${hardest.name}, de moeilijkste spot` : "nog geen antwoorden"}</span>
        </div>
        <div className={`${layout.tile} ${layout.tileAlert} ${styles.tile}`}>
          <span className={layout.tileValue}>{flagCount}</span>
          <span className={styles.tileText}>{flagCount === 1 ? "melding" : "meldingen"} tijdens de tocht</span>
        </div>
      </div>

      <section className={layout.panel}>
        <div className={`${styles.row} ${styles.head}`}>
          <span>Plek</span>
          <span>Groep</span>
          <span>Niveau</span>
          <span>Spots</span>
          <span>Tijd</span>
          <span>Meldingen</span>
          <span>Punten</span>
        </div>
        {rows.length === 0 && <p className={styles.note}>Geen groepen in deze sessie.</p>}
        {rows.map((r, i) => (
          <Link key={r.team.id} href={`/leerkracht/groep/?id=${r.team.id}`} className={[styles.row, i === 0 && styles.first].filter(Boolean).join(" ")}>
            <span className={styles.num}>{i + 1}</span>
            <span className={styles.name}>{r.team.name}</span>
            <span>
              <NiveauTag niveau={r.team.level} />
            </span>
            <span className={styles.num}>
              {r.team.done}/{data.spots.length}
            </span>
            <span className={styles.num}>{r.seconds === null ? "–" : hoursMinutes(r.seconds)}</span>
            <span className={[styles.num, r.flags > 0 && styles.alert].filter(Boolean).join(" ")}>{r.flags}</span>
            <span className={styles.num}>{r.team.points}</span>
          </Link>
        ))}
        <p className={styles.note}>
          Punten op Gevorderd tellen x1,5 en op Expert x2.
          {pending > 0 && ` ${pending === 1 ? "Eén foto is" : `${pending} foto’s zijn`} nog niet nagekeken.`}
        </p>
      </section>
    </>
  );
}

function SessionList() {
  const { data } = useLoad(() => listSessions(50), []);
  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Resultaten</span>
          <h1 className={layout.title}>Alle sessies</h1>
        </div>
      </header>
      <section className={layout.panel}>
        {!data ? (
          <p>Laden…</p>
        ) : data.length === 0 ? (
          <p>Nog geen sessies.</p>
        ) : (
          data.map((s) => (
            <Link key={s.id} href={`/leerkracht/resultaten/?sessie=${s.id}`} className={styles.sessionRow}>
              <span className={styles.num}>{shortDate(s.createdAt)}</span>
              <span>{[s.classLabel, `${s.teamCount} groepen`].filter(Boolean).join(" · ")}</span>
              <span className={styles.name}>{s.tourTitle}</span>
              <span className={styles.num}>{s.averagePoints === null ? "" : `Gem. ${s.averagePoints}`}</span>
            </Link>
          ))
        )}
      </section>
    </>
  );
}

function ResultsInner() {
  const id = useSearchParams().get("sessie");
  return id ? <Results sessionId={id} /> : <SessionList />;
}

/** T06 Resultaten. */
export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsInner />
    </Suspense>
  );
}
