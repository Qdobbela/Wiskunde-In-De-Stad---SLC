"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NiveauTag } from "@/components/ui/NiveauTag";
import { Pills } from "@/components/ui/Pills";
import { Switch } from "@/components/ui/Switch";
import { evaluate, FormulaError, pickValues, renderBody } from "@/lib/formula";
import { LEVELS, NIVEAUS, type Niveau } from "@/lib/niveau";
import { formatDutchNumber, parseDutchNumber } from "@/lib/number";
import {
  isBlank,
  seededRandom,
  validateQuestion,
  variablesNeeded,
  type AnswerType,
  type QuestionDraft,
} from "@/lib/question";
import { saveQuestions } from "@/lib/teacher/mutations";
import layout from "../teacher.module.css";
import styles from "./questions.module.css";

type Drafts = Record<Niveau, QuestionDraft>;

type QuestionEditorProps = {
  tourId: string;
  spotId: string;
  spotName: string;
  spotNumber: number;
  initialDrafts: Drafts;
  prevSpotId: string | null;
  nextSpotId: string | null;
};

const ANSWER_TYPES: { value: AnswerType; label: string }[] = [
  { value: "number", label: "Getal" },
  { value: "text", label: "Tekst" },
  { value: "photo", label: "Alleen foto" },
];

/** The preview shows "groep 3", always with the same numbers. */
const PREVIEW_GROUP = 3;

/** Number input that accepts a decimal comma and keeps the typed text. */
function NumberBox({
  label,
  value,
  onChange,
  prefix,
  width = "6ch",
  allowEmpty = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  prefix?: string;
  width?: string;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : formatDutchNumber(value, 6));
  const parsed = text.trim() === "" ? null : parseDutchNumber(text);
  const invalid = parsed === null && !(allowEmpty && text.trim() === "");
  return (
    <label className={styles.box}>
      <span className={layout.sectionLabel}>{label}</span>
      <span className={[styles.boxInput, invalid && styles.boxInvalid].filter(Boolean).join(" ")}>
        {prefix && <span>{prefix}</span>}
        <input
          inputMode="decimal"
          value={text}
          style={{ width }}
          onChange={(e) => {
            setText(e.target.value);
            const next = e.target.value.trim() === "" ? null : parseDutchNumber(e.target.value);
            if (next !== null || allowEmpty) onChange(next);
          }}
        />
      </span>
    </label>
  );
}

export function QuestionEditor({
  tourId,
  spotId,
  spotName,
  spotNumber,
  initialDrafts,
  prevSpotId,
  nextSpotId,
}: QuestionEditorProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Drafts>(initialDrafts);
  const [level, setLevel] = useState<Niveau>(
    LEVELS.find((l) => isBlank(initialDrafts[l])) ?? "basis",
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const draft = drafts[level];
  const filledCount = LEVELS.filter((l) => !isBlank(drafts[l])).length;
  const needed = variablesNeeded(draft);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(patch: Partial<QuestionDraft>) {
    setDrafts((all) => ({ ...all, [level]: { ...all[level], ...patch } }));
    setDirty(true);
    setError(null);
  }

  function updateRange(name: string, key: "min" | "max", value: number | null) {
    const current = draft.params[name] ?? { min: 1, max: 10 };
    update({ params: { ...draft.params, [name]: { ...current, [key]: value ?? 0 } } });
  }

  function save(then?: () => void) {
    startSaving(async () => {
      const result = await saveQuestions(spotId, LEVELS.map((l) => drafts[l]));
      if (result.error) {
        setError(result.error);
        return;
      }
      setDirty(false);
      then?.();
    });
  }

  function goTo(otherSpotId: string) {
    const go = () => router.push(`/leerkracht/vragen/?spot=${otherSpotId}`);
    if (dirty) save(go);
    else go();
  }

  // Live preview with this group's numbers.
  const preview = useMemo(() => {
    const params = Object.fromEntries(
      needed.map((n) => [n, draft.params[n] ?? { min: 1, max: 10 }]),
    );
    const values = pickValues(params, seededRandom(PREVIEW_GROUP * 7919));
    const body = renderBody(draft.body, values);
    let answer: string | null = null;
    let formulaError: string | null = null;
    if (draft.answer_type === "number" && draft.correct_value.trim()) {
      try {
        const result = evaluate(draft.correct_value, values);
        answer = `Juist: ${formatDutchNumber(result)}${draft.unit ? ` ${draft.unit}` : ""}`;
      } catch (err) {
        if (!(err instanceof FormulaError)) throw err;
        formulaError = err.message;
      }
    } else if (draft.answer_type === "text" && draft.correct_value.trim()) {
      answer = `Juist: ${draft.correct_value.trim()}`;
    }
    return { body, answer, formulaError };
  }, [draft, needed]);

  const problem = isBlank(draft) ? null : validateQuestion(draft);
  const showPhoto = draft.answer_type === "photo" || draft.needs_photo;

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Spot {spotNumber} · Vragen</span>
          <h1 className={layout.title}>{spotName}</h1>
        </div>
        <div className={layout.actions}>
          <ButtonLink variant="outline" href={`/leerkracht/tocht/?id=${tourId}`} className={styles.navButton}>
            Terug naar tocht
          </ButtonLink>
          {prevSpotId && (
            <Button variant="outline" className={styles.navButton} onClick={() => goTo(prevSpotId)} disabled={saving}>
              Vorige spot
            </Button>
          )}
          {nextSpotId && (
            <Button variant="outline" className={styles.navButton} onClick={() => goTo(nextSpotId)} disabled={saving}>
              Volgende spot
            </Button>
          )}
          <Button className={styles.saveButton} onClick={() => save()} disabled={saving || !dirty}>
            {saving ? "Bezig…" : dirty ? "Opslaan" : "Opgeslagen"}
          </Button>
        </div>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.workspace}>
        {/* Keyed by level: the number fields keep their own typed text. */}
        <section key={level} className={`${layout.panel} ${styles.form}`} aria-label="Vraag bewerken">
          <div className={styles.row}>
            <Pills
              label="Niveau"
              value={level}
              onChange={setLevel}
              options={LEVELS.map((l) => ({
                value: l,
                label: `${NIVEAUS[l].label}${isBlank(drafts[l]) ? "" : " ✓"}`,
              }))}
            />
            <span className={styles.spacer} />
            <span className={styles.hint}>{filledCount} van 3 ingevuld</span>
          </div>

          <label className={styles.stack}>
            <span className={layout.sectionLabel}>Vraag</span>
            <textarea
              className={styles.body}
              value={draft.body}
              rows={3}
              placeholder="Een ridder loopt {n} keer rond een vierkante toren met zijden van {z} m. Hoeveel meter stapt hij in totaal?"
              onChange={(e) => update({ body: e.target.value })}
            />
          </label>

          <div className={styles.row}>
            <span className={layout.sectionLabel}>Antwoord</span>
            <Pills
              label="Soort antwoord"
              value={draft.answer_type}
              onChange={(answer_type) =>
                update({ answer_type, needs_photo: answer_type === "photo" ? true : draft.needs_photo })
              }
              options={ANSWER_TYPES}
            />
          </div>

          <div className={styles.fields}>
            {draft.answer_type !== "photo" && (
              <label className={`${styles.box} ${styles.grow}`}>
                <span className={layout.sectionLabel}>
                  {draft.answer_type === "number" ? "Juist antwoord (formule)" : "Juist antwoord"}
                </span>
                <span className={[styles.boxInput, preview.formulaError && styles.boxInvalid].filter(Boolean).join(" ")}>
                  <input
                    value={draft.correct_value}
                    placeholder={draft.answer_type === "number" ? "= n × 4 × z" : "rood"}
                    onChange={(e) => update({ correct_value: e.target.value })}
                  />
                </span>
              </label>
            )}
            {draft.answer_type === "number" && (
              <>
                <NumberBox label="Marge" prefix="±" value={draft.tolerance} onChange={(v) => update({ tolerance: v ?? 0 })} width="5ch" />
                <label className={styles.box}>
                  <span className={layout.sectionLabel}>Eenheid</span>
                  <span className={styles.boxInput}>
                    <input value={draft.unit} style={{ width: "5ch" }} maxLength={8} onChange={(e) => update({ unit: e.target.value })} />
                  </span>
                </label>
              </>
            )}
            <NumberBox label="Punten" value={draft.base_points} onChange={(v) => update({ base_points: Math.round(v ?? 0) })} width="4ch" />
            <NumberBox
              label="Tijd (min)"
              value={draft.time_limit_s === null ? null : draft.time_limit_s / 60}
              allowEmpty
              onChange={(v) => update({ time_limit_s: v === null ? null : Math.round(v * 60) })}
              width="4ch"
            />
          </div>
          {preview.formulaError && <p className={styles.fieldError}>{preview.formulaError}</p>}

          <div className={styles.variants}>
            <p className={styles.variantsTitle}>Elke groep een eigen versie</p>
            <p className={styles.variantsText}>
              {needed.length > 0
                ? "De app kiest per groep andere getallen, zodat groepen geen antwoorden kunnen doorgeven."
                : "Zet {n} of {z} in de vraag en gebruik dezelfde letters in de formule. Dan krijgt elke groep andere getallen."}
            </p>
            {needed.length > 0 && (
              <div className={styles.ranges}>
                {needed.map((name) => {
                  const range = draft.params[name];
                  return (
                    <span key={name} className={styles.range}>
                      <span className={styles.rangeName}>{`{${name}}`}</span>
                      <RangeInput value={range?.min} onChange={(v) => updateRange(name, "min", v)} label={`${name} van`} />
                      <span>tot</span>
                      <RangeInput value={range?.max} onChange={(v) => updateRange(name, "max", v)} label={`${name} tot`} />
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.row}>
            <Switch
              label="Foto verplicht"
              checked={showPhoto}
              disabled={draft.answer_type === "photo"}
              onChange={(needs_photo) => update({ needs_photo })}
            />
            <span className={styles.photoLabel}>Foto verplicht{showPhoto ? ":" : ""}</span>
            {showPhoto && (
              <input
                className={styles.photoPrompt}
                value={draft.photo_prompt}
                placeholder="de groep op de foto, met de toren erachter"
                onChange={(e) => update({ photo_prompt: e.target.value })}
              />
            )}
          </div>

          {problem && <p className={styles.fieldError}>{problem}</p>}
        </section>

        <aside className={styles.preview} aria-label="Voorbeeld">
          <span className={layout.sectionLabel}>Zo ziet groep {PREVIEW_GROUP} het</span>
          <div className={styles.phone}>
            <span className={layout.sectionLabel}>Jullie staan aan</span>
            <p className={styles.phoneTitle}>{spotName}</p>
            <div className={styles.phoneCard}>
              <NiveauTag niveau={level} />
              <p className={styles.phoneBody}>{preview.body || "De vraag verschijnt hier."}</p>
              {draft.answer_type === "number" && (
                <Input label="Jullie antwoord" numeric unit={draft.unit || undefined} placeholder="0" readOnly hint={preview.answer ?? undefined} />
              )}
              {draft.answer_type === "text" && (
                <Input label="Jullie antwoord" readOnly hint={preview.answer ?? undefined} />
              )}
              {showPhoto && draft.photo_prompt && <p className={styles.hint}>Foto: {draft.photo_prompt}</p>}
            </div>
            {showPhoto && (
              <Button variant="secondary" tabIndex={-1}>
                + Foto
              </Button>
            )}
            <Button tabIndex={-1}>Versturen</Button>
          </div>
        </aside>
      </div>
    </>
  );
}

function RangeInput({
  value,
  onChange,
  label,
}: {
  value: number | undefined;
  onChange: (v: number | null) => void;
  label: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : formatDutchNumber(value, 6));
  return (
    <input
      className={styles.rangeInput}
      inputMode="decimal"
      aria-label={label}
      value={text}
      placeholder="?"
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parseDutchNumber(e.target.value);
        if (parsed !== null) onChange(parsed);
      }}
    />
  );
}
