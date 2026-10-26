"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBar } from "@/components/student/StatusBar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NiveauTag } from "@/components/ui/NiveauTag";
import { Sticker } from "@/components/ui/Sticker";
import { LEVELS, NIVEAUS, type Niveau } from "@/lib/niveau";
import { formatDutchNumber } from "@/lib/number";
import { requestCamera, requestLocation } from "@/lib/student/useGeolocation";
import { ApiError, call, setGroupToken } from "@/lib/student/api";
import common from "@/components/student/student.module.css";
import styles from "./join.module.css";

type Step = "code" | "groep" | "niveau" | "toestemming";

type Draft = { code: string; tourTitle: string; name: string; members: string[]; level: Niveau | null };

const EMPTY: Draft = { code: "", tourTitle: "", name: "", members: [""], level: null };
const STORAGE_KEY = "wids-join";

const LEVEL_TEXT: Record<Niveau, string> = {
  basis: "Rekenen met wat je ziet. Tellen, schatten, eenvoudige formules.",
  gevorderd: "Schaal, oppervlakte en procenten. Meerdere stappen.",
  expert: "Pythagoras, hoeken en verbanden. Voor wie wil zweten.",
};

/** L01 to L04: code, group, level, permissions. The group is created at the end. */
export function JoinFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("code");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lastMemberRef = useRef<HTMLInputElement>(null);
  const [focusLast, setFocusLast] = useState(false);

  // Keep the draft when the page reloads (per tab, never shared).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { step: Step; draft: Draft };
        setDraft(parsed.draft);
        setStep(parsed.step);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, draft }));
    } catch {}
  }, [step, draft]);

  useEffect(() => {
    if (focusLast) {
      lastMemberRef.current?.focus();
      setFocusLast(false);
    }
  }, [focusLast]);

  function go(next: Step) {
    setError(null);
    setStep(next);
    window.scrollTo(0, 0);
  }

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await call<{ code: string; tourTitle: string }>("check-code", { code: draft.code });
        update({ code: result.code, tourTitle: result.tourTitle });
        go("groep");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Er ging iets mis.");
      }
    });
  }

  function submitGroup(e: React.FormEvent) {
    e.preventDefault();
    const members = draft.members.map((m) => m.trim()).filter(Boolean);
    if (draft.name.trim().length < 2) return setError("Kies een groepsnaam.");
    if (members.length === 0) return setError("Voeg minstens één leerling toe.");
    if (members.some((m) => /\s/.test(m))) return setError("Alleen voornamen, zonder achternaam.");
    update({ members });
    go("niveau");
  }

  function start() {
    if (!draft.level) return;
    const level = draft.level;
    setError(null);
    startTransition(async () => {
      const location = await requestLocation();
      if (!location.ok) {
        setError(
          location.reason === "denied"
            ? "Zonder locatie kan de tocht niet starten. Zet locatie aan voor deze website in de instellingen van je gsm en probeer opnieuw."
            : "Je locatie is niet gevonden. Ga even buiten staan en probeer opnieuw.",
        );
        return;
      }
      // The camera is only needed for photo questions; L08 asks again if needed.
      await requestCamera();
      try {
        // The group only exists from here on, so its level is fixed from the start.
        const { token } = await call<{ token: string }>("join", {
          code: draft.code,
          name: draft.name,
          members: draft.members,
          level,
        });
        setGroupToken(token);
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
        router.replace("/tocht/");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Meedoen lukte niet. Probeer opnieuw.");
      }
    });
  }

  if (step === "code") {
    return (
      <form className={common.screen} onSubmit={submitCode}>
        <StatusBar status="idle" />
        <div className={styles.intro}>
          <Sticker rotate={4} className={styles.gent}>
            Gent
          </Sticker>
          <h1 className={styles.hero}>Wiskunde in de stad</h1>
          <p className={styles.lead}>
            Los met je groep wiskundevragen op over echte plekken in Gent. Een vraag gaat pas open als jullie er écht
            staan.
          </p>
        </div>
        <div className={common.spacer} />
        <Input
          label="Sessiecode van je leerkracht"
          mono
          value={draft.code}
          onChange={(e) => update({ code: e.target.value.toUpperCase() })}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          placeholder="ABC123"
          hint="Je leerkracht toont de code op het bord"
          error={error ?? undefined}
        />
        <Button type="submit" disabled={pending || draft.code.trim().length < 4}>
          {pending ? "Even kijken…" : "Doe mee"}
        </Button>
        <Link href="/leerkracht/" className={styles.teacherLink}>
          Leerkracht? Meld je hier aan
        </Link>
      </form>
    );
  }

  if (step === "groep") {
    return (
      <form className={common.screen} onSubmit={submitGroup}>
        <StatusBar status="idle" />
        <button type="button" className={common.back} onClick={() => go("code")}>
          ← Andere code
        </button>
        <p className={common.step}>Stap 1 van 3</p>
        <h1 className={common.title}>Jullie groep</h1>
        <Input
          label="Groepsnaam"
          mono
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          maxLength={40}
          placeholder="De Torenwachters"
          hint="Geen echte namen of scheldwoorden"
        />
        <fieldset className={common.card}>
          <legend className={styles.legend}>Wie zit er in de groep?</legend>
          {draft.members.map((member, i) => (
            <div key={i} className={styles.member}>
              <input
                ref={i === draft.members.length - 1 ? lastMemberRef : undefined}
                className={styles.memberInput}
                value={member}
                placeholder="Voornaam"
                aria-label={`Voornaam leerling ${i + 1}`}
                maxLength={20}
                autoComplete="off"
                autoCapitalize="words"
                onChange={(e) =>
                  update({ members: draft.members.map((m, j) => (j === i ? e.target.value : m)) })
                }
              />
              {draft.members.length > 1 && (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`${member || "Leerling"} verwijderen`}
                  onClick={() => update({ members: draft.members.filter((_, j) => j !== i) })}
                >
                  x
                </button>
              )}
            </div>
          ))}
          {draft.members.length < 8 && (
            <button
              type="button"
              className={styles.add}
              onClick={() => {
                update({ members: [...draft.members, ""] });
                setFocusLast(true);
              }}
            >
              + Leerling toevoegen
            </button>
          )}
        </fieldset>
        {error && <p className={common.error} role="alert">{error}</p>}
        <div className={common.spacer} />
        <Button type="submit">Verder</Button>
      </form>
    );
  }

  if (step === "niveau") {
    return (
      <div className={common.screen}>
        <StatusBar status="idle" />
        <button type="button" className={common.back} onClick={() => go("groep")}>
          ← Terug
        </button>
        <p className={common.step}>Stap 2 van 3</p>
        <h1 className={common.title}>Kies jullie niveau</h1>
        <div role="radiogroup" aria-label="Niveau" className={styles.levels}>
          {LEVELS.map((level) => {
            const chosen = draft.level === level;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={chosen}
                className={[styles.level, chosen && styles.levelChosen].filter(Boolean).join(" ")}
                onClick={() => update({ level })}
              >
                <span className={styles.levelHead}>
                  <NiveauTag niveau={level} />
                  <span className={styles.multiplier}>
                    x{formatDutchNumber(NIVEAUS[level].multiplier)} punten
                  </span>
                </span>
                <span className={common.body}>{LEVEL_TEXT[level]}</span>
                {chosen && <span className={styles.chosen}>Gekozen</span>}
              </button>
            );
          })}
        </div>
        <p className={styles.note}>Let op: je kan je niveau niet meer wijzigen tijdens de tocht.</p>
        <div className={common.spacer} />
        <Button disabled={!draft.level} onClick={() => go("toestemming")}>
          {draft.level ? `Kies ${NIVEAUS[draft.level].label}` : "Kies een niveau"}
        </Button>
      </div>
    );
  }

  return (
    <div className={common.screen}>
      <StatusBar status="idle" />
      <button type="button" className={common.back} onClick={() => go("niveau")} disabled={pending}>
        ← Terug
      </button>
      <p className={common.step}>Stap 3 van 3</p>
      <h1 className={common.title}>Twee dingen nodig</h1>
      <section className={common.card}>
        <h2 className={styles.permission}>
          <span className={`${styles.dot} ${styles.dotLocation}`} aria-hidden />
          Locatie
        </h2>
        <p className={common.body}>
          Zo weet de app of jullie echt op de plek staan. Je leerkracht ziet waar jullie groep is.
        </p>
      </section>
      <section className={common.card}>
        <h2 className={styles.permission}>
          <span className={`${styles.dot} ${styles.dotCamera}`} aria-hidden />
          Camera
        </h2>
        <p className={common.body}>Voor foto-opdrachten. Alleen live foto’s, je galerij blijft dicht.</p>
      </section>
      <section className={styles.fairPlay}>
        <h2 className={styles.fairPlayTitle}>Eerlijk spel</h2>
        <p>
          Nep-locatie apps en GPS-sprongen worden opgemerkt en gemeld aan je leerkracht. De app verlaten tijdens een
          vraag wordt ook gemeld.
        </p>
      </section>
      {error && <p className={common.error} role="alert">{error}</p>}
      <div className={common.spacer} />
      <Button onClick={start} disabled={pending}>
        {pending ? "Even geduld…" : "Toestaan en starten"}
      </Button>
    </div>
  );
}
