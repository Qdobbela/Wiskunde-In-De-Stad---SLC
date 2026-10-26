"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Kaartpin } from "@/components/map/Kaartpin";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { distanceM } from "@/lib/geo";
import { pointsFor } from "@/lib/grading";
import { NIVEAUS } from "@/lib/niveau";
import { supabase } from "@/lib/supabase/client";
import { clock } from "@/lib/teacher/format";
import { releasePhone, resolveFlag, reviewAnswer } from "@/lib/teacher/mutations";
import { answerScore, describeFlag, loadSession, type AnswerRow, type TeamOverview } from "@/lib/teacher/sessionData";
import { useRealtime } from "@/lib/teacher/useRealtime";
import { must, useLoad } from "@/lib/useLoad";
import layout from "../teacher.module.css";
import styles from "./groep.module.css";

function answerText(a: AnswerRow) {
  const value = a.value ? `${a.value}${a.question.unit ? ` ${a.question.unit}` : ""}` : "";
  return a.photo_path ? (value ? `foto + ${value}` : "foto") : value;
}

function Photo({ answer, inZone }: { answer: AnswerRow; inZone: boolean | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!answer.photo_path) return;
    supabase()
      .storage.from("photos")
      .createSignedUrl(answer.photo_path, 600)
      .then(({ data }) => !cancelled && setUrl(data?.signedUrl ?? null));
    return () => {
      cancelled = true;
    };
  }, [answer.photo_path]);

  return (
    <div className={styles.photo}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
      {url && <img src={url} alt="Foto van de groep" />}
      {answer.photo_taken_at && (
        <span className={styles.photoTag}>
          Live {clock(answer.photo_taken_at)}
          {inZone === true ? " · in de zone" : inZone === false ? " · buiten de zone" : ""}
        </span>
      )}
    </div>
  );
}

function Group({ teamId }: { teamId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { data, error, reload } = useLoad(async () => {
    const team = must(await supabase().from("team").select("session_id").eq("id", teamId).single());
    const session = await loadSession(team.session_id);
    const me = session.teams.find((t) => t.id === teamId)!;
    return { ...session, me };
  }, [teamId]);

  useRealtime(`groep-${teamId}`, [{ table: "answer", filter: `team_id=eq.${teamId}` }, { table: "unlock", filter: `team_id=eq.${teamId}` }, { table: "flag", filter: `team_id=eq.${teamId}` }], reload, 1000);

  const me: TeamOverview | undefined = data?.me;

  // Open the first photo that still needs a review.
  const selected = useMemo(() => {
    if (!me) return null;
    return (
      me.answers.find((a) => a.id === selectedId) ??
      me.answers.find((a) => a.photo_path && a.teacher_score === null) ??
      null
    );
  }, [me, selectedId]);

  if (error) return <p className={layout.error}>{error}</p>;
  if (!data || !me) return <p className={layout.loading}>Laden…</p>;

  const spotOf = (locationId: string) => data.spots.find((s) => s.id === locationId);
  const max = (a: AnswerRow) => pointsFor(a.question.base_points, a.question.level, 1);

  const log = [
    ...me.unlocks.map((u) => {
      const spot = spotOf(u.location_id);
      const number = me.route.findIndex((s) => s.id === u.location_id) + 1;
      return { at: u.unlocked_at, alert: false, text: `Spot ${number} (${spot?.name}) ontgrendeld na ${spot?.dwell_s ?? 0} sec in de zone` };
    }),
    ...me.answers.map((a) => ({ at: a.submitted_at, alert: false, text: `Antwoord bij ${spotOf(a.question.location_id)?.name}: ${answerText(a) || "—"}` })),
    ...me.flags.map((f) => ({ at: f.ts, alert: !f.resolved_at, text: describeFlag(f) + (f.resolved_at ? " (genegeerd)" : "") })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  async function review(score: 0 | 0.5 | 1) {
    if (!selected) return;
    const result = await reviewAnswer(selected.id, score);
    if (result.error) return setNotice(result.error);
    setSelectedId(null);
    reload();
  }

  const selectedSpot = selected ? spotOf(selected.question.location_id) : null;
  const inZone =
    selected && selected.photo_lat !== null && selected.photo_lng !== null && selectedSpot
      ? distanceM({ lat: selected.photo_lat, lng: selected.photo_lng! }, selectedSpot) <= selectedSpot.radius_m + 20
      : null;

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>
            {me.label} · {me.members.join(", ")}
          </span>
          <h1 className={layout.title}>{me.name}</h1>
        </div>
        <div className={layout.actions}>
          <Button
            variant="outline"
            className={styles.phoneButton}
            onClick={async () => {
              if (!confirm(`${me.name} op een andere gsm laten verdergaan? Ze vullen dan opnieuw de code en dezelfde groepsnaam in.`)) return;
              const result = await releasePhone(me.id);
              setNotice(result.error ?? "De groep kan nu op een nieuwe gsm verdergaan met dezelfde groepsnaam.");
              reload();
            }}
          >
            Nieuwe gsm toelaten
          </Button>
          <ButtonLink variant="outline" className={styles.backButton} href={`/leerkracht/live/?sessie=${data.session.id}`}>
            Terug naar kaart
          </ButtonLink>
        </div>
      </header>
      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.workspace}>
        <div className={styles.left}>
          <section className={layout.panel}>
            <h2 className={styles.panelTitle}>Antwoorden</h2>
            {me.route.map((spot, i) => {
              const a = me.answers.find((x) => x.question.location_id === spot.id);
              const open = me.openSpot?.id === spot.id;
              const score = a ? answerScore(a) : null;
              const chip = !a
                ? open
                  ? { status: "hier" as const, label: "Bezig" }
                  : null
                : score === null
                  ? { status: "wacht" as const, label: "Nakijken" }
                  : score === 1
                    ? { status: "opgelost" as const, label: "Juist" }
                    : score === 0.5
                      ? { status: "opgelost" as const, label: "Half" }
                      : { status: "verdacht" as const, label: "Fout" };
              return (
                <button
                  key={spot.id}
                  type="button"
                  disabled={!a}
                  className={[styles.answer, a && selected?.id === a.id && styles.answerSelected].filter(Boolean).join(" ")}
                  onClick={() => a && setSelectedId(a.id)}
                >
                  <Kaartpin size="s" label={i + 1} status={a ? "opgelost" : open ? "hier" : "vergrendeld"} />
                  <span className={styles.answerSpot}>
                    {spot.name}
                    {a && <span className={styles.answerLevel}>{NIVEAUS[a.question.level].label}</span>}
                  </span>
                  <span className={styles.answerValue}>{a ? answerText(a) : ""}</span>
                  <span className={styles.answerChip}>{chip && <StatusChip status={chip.status} label={chip.label} />}</span>
                  <span className={styles.answerPoints}>
                    {a ? (score === null ? "?" : pointsFor(a.question.base_points, a.question.level, score)) : ""}
                  </span>
                </button>
              );
            })}
          </section>

          <section className={layout.panel}>
            <h2 className={styles.panelTitle}>Logboek</h2>
            {log.length === 0 && <p className={styles.muted}>Nog niets gebeurd.</p>}
            {log.map((entry, i) => (
              <p key={i} className={styles.log}>
                <span className={styles.logTime}>{clock(entry.at)}</span>
                <span className={entry.alert ? styles.logAlert : undefined}>{entry.text}</span>
              </p>
            ))}
            {me.unresolvedFlags.length > 0 && (
              <Button
                variant="outline"
                onClick={async () => {
                  for (const f of me.unresolvedFlags) await resolveFlag(f.id);
                  reload();
                }}
              >
                Meldingen negeren
              </Button>
            )}
          </section>
        </div>

        <section className={`${layout.panel} ${styles.review}`}>
          {selected && selectedSpot ? (
            <>
              <div className={styles.reviewHead}>
                <span className={styles.panelTitle}>{selected.photo_path ? "Foto nakijken" : "Antwoord nakijken"}</span>
                <span className={styles.reviewSpot}>
                  Spot {me.route.findIndex((s) => s.id === selectedSpot.id) + 1} · {selectedSpot.name}
                </span>
              </div>
              {selected.photo_path && <Photo answer={selected} inZone={inZone} />}
              <p className={styles.task}>
                {selected.question.photo_prompt ? `Opdracht: ${selected.question.photo_prompt}. ` : ""}
                {selected.question.body}
              </p>
              <div className={styles.groupAnswer}>
                <span className={layout.sectionLabel}>Antwoord groep</span>
                <span className={styles.groupAnswerValue}>{answerText(selected) || "—"}</span>
              </div>
              {selected.auto_correct !== null && (
                <p className={styles.muted}>Automatisch nagekeken: {selected.auto_correct ? "juist" : "fout"}.</p>
              )}
              <div className={styles.spacer} />
              <div className={styles.scoreButtons}>
                <Button variant="outline" onClick={() => review(0)}>
                  Fout 0
                </Button>
                <Button variant="secondary" onClick={() => review(0.5)}>
                  Half {pointsFor(selected.question.base_points, selected.question.level, 0.5)}
                </Button>
                <Button onClick={() => review(1)}>Juist {max(selected)}</Button>
              </div>
            </>
          ) : (
            <p className={styles.muted}>Niets na te kijken. Kies een antwoord links om het te bekijken of de punten aan te passen.</p>
          )}
        </section>
      </div>
    </>
  );
}

function GroupInner() {
  const id = useSearchParams().get("id") ?? "";
  return <Group teamId={id} />;
}

/** T05 Groepsdetail. */
export default function GroupPage() {
  return (
    <Suspense>
      <GroupInner />
    </Suspense>
  );
}
