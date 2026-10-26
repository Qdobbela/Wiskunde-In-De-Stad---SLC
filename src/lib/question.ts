import { evaluate, FormulaError, placeholdersIn, variablesIn, type Params, type Values } from "./formula.ts";
import type { Niveau } from "./niveau.ts";

export type AnswerType = "number" | "text" | "photo";

export type QuestionDraft = {
  level: Niveau;
  body: string;
  answer_type: AnswerType;
  correct_value: string;
  tolerance: number;
  unit: string;
  base_points: number;
  params: Params;
  needs_photo: boolean;
  photo_prompt: string;
  time_limit_s: number | null;
};

export function emptyDraft(level: Niveau): QuestionDraft {
  return {
    level,
    body: "",
    answer_type: "number",
    correct_value: "",
    tolerance: 0,
    unit: "",
    base_points: 10,
    params: {},
    needs_photo: false,
    photo_prompt: "",
    time_limit_s: null,
  };
}

/** Letters that need a range: placeholders in the text plus formula variables. */
export function variablesNeeded(draft: QuestionDraft): string[] {
  const names = new Set(placeholdersIn(draft.body));
  if (draft.answer_type === "number") {
    for (const v of variablesIn(draft.correct_value)) names.add(v);
  }
  return [...names].sort();
}

/** Keeps only the ranges that are used. */
export function usedParams(draft: QuestionDraft): Params {
  const params: Params = {};
  for (const name of variablesNeeded(draft)) {
    if (draft.params[name]) params[name] = draft.params[name];
  }
  return params;
}

/** A blank level isn't saved, so it doesn't count as an error. */
export function isBlank(draft: QuestionDraft) {
  return draft.body.trim() === "";
}

/** Returns a Dutch error message, or null when the question can be saved. */
export function validateQuestion(draft: QuestionDraft): string | null {
  if (isBlank(draft)) return "Vul de vraag in.";
  if (!(Number.isInteger(draft.base_points) && draft.base_points >= 0 && draft.base_points <= 1000)) {
    return "Punten moeten een geheel getal tussen 0 en 1000 zijn.";
  }
  if (draft.time_limit_s !== null && !(draft.time_limit_s > 0 && draft.time_limit_s <= 3600)) {
    return "De tijdslimiet moet tussen 1 en 60 minuten liggen.";
  }

  for (const name of variablesNeeded(draft)) {
    const range = draft.params[name];
    if (!range) return `Geef een bereik voor {${name}}.`;
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      return `Het bereik van {${name}} is geen getal.`;
    }
    if (range.min > range.max) return `Bij {${name}} is "van" groter dan "tot".`;
  }

  if (draft.answer_type === "number") {
    if (!draft.correct_value.trim()) return "Vul het juiste antwoord of een formule in.";
    if (!(draft.tolerance >= 0)) return "De marge kan niet negatief zijn.";
    // Check the formula at both ends of every range.
    for (const pick of ["min", "max"] as const) {
      const values: Values = {};
      for (const [name, range] of Object.entries(draft.params)) values[name] = range[pick];
      try {
        evaluate(draft.correct_value, values);
      } catch (err) {
        if (err instanceof FormulaError) return `Formule: ${err.message}.`;
        throw err;
      }
    }
  }
  if (draft.answer_type === "text" && !draft.correct_value.trim()) {
    return "Vul het juiste antwoord in.";
  }
  return null;
}

/** Deterministic random numbers, so the preview for "groep 3" stays stable. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
