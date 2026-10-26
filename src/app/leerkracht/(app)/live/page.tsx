"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Kaartpin } from "@/components/map/Kaartpin";
import { MapView, type MapPin } from "@/components/map/MapView";
import { Timer } from "@/components/student/Timer";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusChip, type ChipStatus } from "@/components/ui/StatusChip";
import { clock, shortDate } from "@/lib/teacher/format";
import { closeSession, resolveFlag, sendMessage } from "@/lib/teacher/mutations";
import { isRunning, listSessions } from "@/lib/teacher/queries";
import { BLOCKING_FLAGS, describeFlag, loadSession, type TeamOverview } from "@/lib/teacher/sessionData";
import { useRealtime } from "@/lib/teacher/useRealtime";
import { useLoad } from "@/lib/useLoad";
import layout from "../teacher.module.css";
import styles from "./live.module.css";

function teamStatus(t: TeamOverview, total: number, over: boolean): { status: ChipStatus; label: string } {
  if (t.unresolvedFlags.some((f) => BLOCKING_FLAGS.includes(f.type) || f.type === "second_device")) {
    return { status: "verdacht", label: "Verdacht" };
  }
  if (t.pendingPhotos > 0) return { status: "wacht", label: "Foto nakijken" };
  if (t.openSpot) return { status: "hier", label: "Op spot" };
  if (t.done >= total && total > 0) return { status: "opgelost", label: "Klaar" };
  if (over) return { status: "opgelost", label: `Klaar met ${t.done}` };
  return { status: "vergrendeld", label: "Onderweg" };
}

function Live({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data, error, reload } = useLoad(() => loadSession(sessionId), [sessionId]);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useRealtime(
    `live-${sessionId}`,
    [
      { table: "team", filter: `session_id=eq.${sessionId}` },
      { table: "ping" },
      { table: "unlock" },
      { table: "answer" },
      { table: "flag" },
    ],
    reload,
    2000,
  );

  const pins: MapPin[] = useMemo(() => {
    if (!data) return [];
    const spotPins: MapPin[] = data.spots.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      label: s.position,
      status: data.teams.length > 0 && data.teams.every((t) => t.answers.some((a) => a.question.location_id === s.id)) ? "opgelost" : "vergrendeld",
    }));
    const teamPins: MapPin[] = data.teams
      .filter((t) => t.lastPing)
      .map((t) => ({
        id: `team-${t.id}`,
        lat: t.lastPing!.lat,
        lng: t.lastPing!.lng,
        label: t.label,
        status: "groep",
        alert: t.unresolvedFlags.some((f) => BLOCKING_FLAGS.includes(f.type)),
      }));
    return [...spotPins, ...teamPins];
  }, [data]);

  if (error) return <p className={layout.error}>{error}</p>;
  if (!data) return <p className={layout.loading}>Laden…</p>;

  const { session, teams, spots } = data;
  const running = isRunning(session);
  const photos = teams.reduce((n, t) => n + t.pendingPhotos, 0);
  const alerts = teams.flatMap((t) => t.unresolvedFlags.map((f) => ({ flag: f, team: t })));
  const latest = alerts.sort((a, b) => b.flag.ts.localeCompare(a.flag.ts))[0];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await sendMessage(sessionId, message);
    setBusy(false);
    if (result.error) return setNotice(result.error);
    setMessage("");
    setMessageOpen(false);
    setNotice("Bericht verstuurd naar alle groepen.");
  }

  async function close() {
    if (!confirm("De sessie afsluiten? Groepen kunnen dan niet meer antwoorden.")) return;
    const result = await closeSession(sessionId);
    if (result.error) return setNotice(result.error);
    router.push(`/leerkracht/resultaten/?sessie=${sessionId}`);
  }

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>
            {[running ? "Live" : "Afgelopen", session.class_label, `code ${session.code}`].filter(Boolean).join(" · ")}{" "}
            · <Link href={`/leerkracht/sessie/?id=${session.id}`}>toon code</Link>
          </span>
          <h1 className={layout.title}>{session.tour?.title}</h1>
        </div>
        <div className={layout.actions}>
          {running && session.ends_at && <Timer endsAt={session.ends_at} />}
          {running && (
            <>
              <Button variant="outline" className={styles.messageButton} onClick={() => setMessageOpen((o) => !o)}>
                Bericht aan iedereen
              </Button>
              <Button className={styles.closeButton} onClick={close}>
                Afsluiten
              </Button>
            </>
          )}
          {!running && <ButtonLink href={`/leerkracht/resultaten/?sessie=${session.id}`}>Resultaten</ButtonLink>}
        </div>
      </header>

      {messageOpen && (
        <form className={`${layout.panel} ${styles.message}`} onSubmit={send}>
          <label className={layout.sectionLabel} htmlFor="bericht">
            Bericht aan alle groepen
          </label>
          <textarea
            id="bericht"
            className={styles.messageInput}
            value={message}
            maxLength={280}
            rows={2}
            placeholder="Kom om 11:30 terug naar het Belfort."
            onChange={(e) => setMessage(e.target.value)}
            autoFocus
          />
          <div className={styles.messageActions}>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>
              Annuleer
            </Button>
            <Button type="submit" disabled={busy || !message.trim()}>
              Versturen
            </Button>
          </div>
        </form>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <div className={styles.workspace}>
        <div className={styles.mapColumn}>
          <div className={layout.tiles}>
            <div className={layout.tile}>
              <span className={layout.tileValue}>{teams.length}</span>
              <span className={layout.tileLabel}>{teams.length === 1 ? "groep" : "groepen"}</span>
            </div>
            <div className={`${layout.tile} ${layout.tilePending}`}>
              <span className={layout.tileValue}>{photos}</span>
              <span className={layout.tileLabel}>{photos === 1 ? "foto" : "foto’s"}</span>
            </div>
            <div className={`${layout.tile} ${layout.tileAlert}`}>
              <span className={layout.tileValue}>{alerts.length}</span>
              <span className={layout.tileLabel}>{alerts.length === 1 ? "melding" : "meldingen"}</span>
            </div>
          </div>
          <MapView
            pins={pins}
            fitKey={`${sessionId}-${spots.length}`}
            onPinClick={(id) => id.startsWith("team-") && router.push(`/leerkracht/groep/?id=${id.slice(5)}`)}
            className={styles.map}
          />
        </div>

        <div className={styles.side}>
          {latest && (
            <section className={styles.alert} role="alert">
              <div className={styles.alertHead}>
                <span className={styles.alertTitle}>
                  {latest.flag.type === "app_left" ? "Melding" : "Verdacht"}: {latest.team.name}
                </span>
                <span className={styles.alertTime}>{clock(latest.flag.ts)}</span>
              </div>
              <p className={styles.alertText}>
                {describeFlag(latest.flag)}
                {BLOCKING_FLAGS.includes(latest.flag.type) && " De volgende spot blijft vergrendeld tot je beslist."}
              </p>
              <div className={styles.alertActions}>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await resolveFlag(latest.flag.id);
                    reload();
                  }}
                >
                  Negeer
                </Button>
                <ButtonLink href={`/leerkracht/groep/?id=${latest.team.id}`}>Bekijk groep</ButtonLink>
              </div>
            </section>
          )}

          <section className={`${layout.panel} ${styles.groups}`}>
            <h2 className={styles.groupsTitle}>Groepen ({teams.length})</h2>
            {teams.length === 0 && <p className={styles.empty}>Nog geen groepen. Toon de code aan de klas.</p>}
            {teams.map((t) => {
              const s = teamStatus(t, spots.length, !running);
              return (
                <Link key={t.id} href={`/leerkracht/groep/?id=${t.id}`} className={styles.row}>
                  <Kaartpin status="groep" label={t.label} />
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{t.name}</span>
                    <span className={styles.rowMeta}>
                      {t.members.length} lln · {t.done}/{spots.length} spots
                    </span>
                  </span>
                  <StatusChip status={s.status} label={s.label} />
                </Link>
              );
            })}
          </section>
        </div>
      </div>
    </>
  );
}

/** Without ?sessie: running sessions to choose from (straight in if there's one). */
function ChooseSession() {
  const router = useRouter();
  const { data } = useLoad(() => listSessions(30), []);
  const running = (data ?? []).filter(isRunning);
  useEffect(() => {
    if (running.length === 1) router.replace(`/leerkracht/live/?sessie=${running[0].id}`);
  }, [running, router]);

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Live</span>
          <h1 className={layout.title}>Lopende sessies</h1>
        </div>
      </header>
      <section className={layout.panel}>
        {!data ? (
          <p>Laden…</p>
        ) : running.length === 0 ? (
          <p>Er loopt nu geen sessie. Start een sessie vanaf een tocht.</p>
        ) : (
          <ul className={styles.sessionList}>
            {running.map((s) => (
              <li key={s.id}>
                <Link href={`/leerkracht/live/?sessie=${s.id}`}>
                  {shortDate(s.createdAt)} · {s.tourTitle} · {s.classLabel || "zonder klas"} · {s.teamCount} groepen
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function LivePageInner() {
  const sessionId = useSearchParams().get("sessie");
  return sessionId ? <Live sessionId={sessionId} /> : <ChooseSession />;
}

/** T04 Live kaart. */
export default function LivePage() {
  return (
    <Suspense>
      <LivePageInner />
    </Suspense>
  );
}
