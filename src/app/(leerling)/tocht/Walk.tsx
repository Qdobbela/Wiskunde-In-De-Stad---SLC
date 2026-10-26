"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBar } from "@/components/student/StatusBar";
import { Button } from "@/components/ui/Button";
import { distanceM } from "@/lib/geo";
import {
  ApiError,
  call,
  groupToken,
  setGroupToken,
  type AnswerResult,
  type GroupState,
  type OpenQuestion,
  type PingResult,
} from "@/lib/student/api";
import { useAppLeftReport, useWakeLock } from "@/lib/student/hooks";
import { useGeolocation } from "@/lib/student/useGeolocation";
import common from "@/components/student/student.module.css";
import { BijnaView, type ZoneInfo } from "./BijnaView";
import { KaartView } from "./KaartView";
import { NiveauView } from "./NiveauView";
import { ResultView } from "./ResultView";
import { VraagView } from "./VraagView";
import styles from "./tocht.module.css";

/** At most one ping per this interval: ~7 in a 30 s dwell, where the server needs ≥ 3. */
const PING_INTERVAL_MS = 4000;
/** Refresh the state (messages, time, teacher decisions) this often. */
const STATE_INTERVAL_MS = 15_000;
/** Switch from the map (L05) to the direction screen (L06) this close to a spot. */
const NEAR_M = 150;

const DISMISSED_KEY = "wids-bericht-gelezen";

/**
 * The walk, L05 to L09. The server decides everything: this screen sends
 * positions and shows what the "leerling" Edge Function answers.
 */
export function Walk() {
  const router = useRouter();
  const [state, setState] = useState<GroupState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [zone, setZone] = useState<ZoneInfo | null>(null);
  const [result, setResult] = useState<{ answer: AnswerResult; question: OpenQuestion } | null>(null);
  const [mode, setMode] = useState<"auto" | "kaart" | "bijna">("auto");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const showRoute = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await call<GroupState>("state");
      setState(next);
      setFatal(null);
      if (next.session.timeUp && !showRoute.current) router.replace("/klassement/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setGroupToken(null);
        router.replace("/");
      } else if (err instanceof ApiError && err.status === 403) {
        setFatal(err.message);
      }
    }
  }, [router]);

  useEffect(() => {
    if (!groupToken()) {
      router.replace("/");
      return;
    }
    showRoute.current = new URLSearchParams(window.location.search).has("route");
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY));
    } catch {}
    load();
    const id = setInterval(load, STATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load, router]);

  const walking = Boolean(state && !state.session.timeUp);
  const { status: geoStatus, fix } = useGeolocation(walking);
  useWakeLock();
  useAppLeftReport(Boolean(state?.question));

  // Send positions; the server unlocks. At most one ping per interval, and a
  // fix that arrives too soon is sent as soon as the interval allows (a phone
  // that then stays put may not report again for a while).
  const lastSent = useRef(0);
  const latestFix = useRef(fix);
  const sentFix = useRef<typeof fix>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockedRef = useRef(state?.blocked);
  blockedRef.current = state?.blocked;

  const sendPing = useCallback(() => {
    const current = latestFix.current;
    if (!current || current === sentFix.current) return;
    sentFix.current = current;
    lastSent.current = Date.now();
    call<PingResult>("ping", {
      lat: current.lat,
      lng: current.lng,
      accuracy: current.accuracy,
      speed: current.speed,
      ts: current.timestamp,
    })
      .then((r) => {
        if (r.status === "unlocked" || r.status === "finished" || r.status === "time_up") {
          setZone(null);
          load();
        } else if (r.status === "walking" || r.status === "in_zone") {
          setZone({
            target: r.target,
            inZone: r.status === "in_zone",
            accurate: r.accurate,
            streakSeconds: r.streakSeconds,
            dwellS: r.dwellS,
            at: Date.now(),
          });
          if (r.blocked !== blockedRef.current) load();
        }
      })
      .catch((err) => {
        // Offline for a moment: send this fix again with the next one.
        sentFix.current = null;
        if (err instanceof ApiError && err.status === 403) setFatal(err.message);
      });
  }, [load]);

  useEffect(() => {
    latestFix.current = fix;
    if (!fix || !walking) return;
    const wait = PING_INTERVAL_MS - (Date.now() - lastSent.current);
    if (wait <= 0) sendPing();
    else
      pending.current ??= setTimeout(() => {
        pending.current = null;
        sendPing();
      }, wait);
  }, [fix, walking, sendPing]);

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  if (fatal) {
    return (
      <main className={common.screen}>
        <StatusBar status="idle" />
        <h1 className={common.title}>Even niet</h1>
        <p className={common.body}>{fatal}</p>
      </main>
    );
  }
  if (!state) {
    return (
      <main className={common.screen}>
        <StatusBar status={geoStatus} />
        <p className={common.body}>Laden…</p>
      </main>
    );
  }

  const { route, question } = state;
  const doneCount = route.filter((s) => s.done).length;
  const next = route.find((s) => !s.done) ?? null;

  let screen: React.ReactNode;
  if (result) {
    const upcoming = route.find((s) => !s.done && s.id !== result.question.locationId) ?? null;
    screen = (
      <ResultView
        result={result.answer}
        spotName={result.question.spotName}
        level={result.answer.level}
        done={doneCount}
        total={route.length}
        nextNumber={upcoming?.number ?? null}
        onNext={() => {
          setResult(null);
          setMode("auto");
          if (!upcoming) router.push("/klassement/");
        }}
      />
    );
  } else if (question?.needsLevel) {
    screen = (
      <NiveauView
        key={question.locationId}
        choice={question}
        current={doneCount + 1}
        total={route.length}
        sessionEndsAt={state.session.endsAt}
        fix={fix}
        geoStatus={geoStatus}
        onChosen={setState}
      />
    );
  } else if (question) {
    screen = (
      <VraagView
        key={question.locationId}
        question={question}
        level={question.level}
        current={doneCount + 1}
        total={route.length}
        sessionEndsAt={state.session.endsAt}
        fix={fix}
        geoStatus={geoStatus}
        onAnswered={(answer) => {
          setResult({ answer, question });
          load();
        }}
      />
    );
  } else {
    // The spot the server is checking (the nearest one to do), else the next on the route.
    const target = route.find((s) => s.id === zone?.target && !s.done) ?? next;
    const distance = fix && target ? distanceM(fix, target) : null;
    const near = distance !== null && distance <= NEAR_M;
    const showBijna = target && (mode === "bijna" || (mode === "auto" && near));
    screen = showBijna ? (
      <BijnaView
        target={target}
        current={doneCount + 1}
        total={route.length}
        endsAt={state.session.endsAt}
        fix={fix}
        geoStatus={geoStatus}
        zone={zone}
        blocked={state.blocked}
        onShowMap={() => setMode("kaart")}
      />
    ) : (
      <KaartView
        route={route}
        next={next}
        endsAt={state.session.timeUp ? null : state.session.endsAt}
        fix={fix}
        geoStatus={geoStatus}
        onOpenNext={() => setMode("bijna")}
      />
    );
  }

  const message = state.message && state.message.id !== dismissed ? state.message : null;
  return (
    <>
      {message && (
        <div className={styles.message} role="alert">
          <span className={styles.messageLabel}>Bericht van je leerkracht</span>
          <p>{message.body}</p>
          <Button
            variant="outline"
            onClick={() => {
              setDismissed(message.id);
              try {
                localStorage.setItem(DISMISSED_KEY, message.id);
              } catch {}
            }}
          >
            Oké
          </Button>
        </div>
      )}
      {state.blocked && !question && !result && (
        <p className={styles.blocked} role="status">
          Even wachten: je leerkracht kijkt iets na. Nieuwe vragen blijven op slot tot dan.
        </p>
      )}
      {screen}
    </>
  );
}
