import { isCorrect } from "./formula.ts";
import { NIVEAUS, type Niveau } from "./niveau.ts";
import { parseDutchNumber } from "./number.ts";

export type Grade = { valid: true; correct: boolean } | { valid: false; error: string };

/** Number answers: decimal comma, within the teacher's margin. */
export function gradeNumber(input: string, expected: number, tolerance: number): Grade {
  const value = parseDutchNumber(input);
  if (value === null) return { valid: false, error: "Gebruik een komma voor decimalen" };
  return { valid: true, correct: isCorrect(value, expected, tolerance) };
}

/** Lowercase, no accents, single spaces: "  Sint-Baafs  " ≈ "sint-baafs". */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Text answers. The teacher can allow alternatives with "|":
 * "rood|rode" accepts both.
 */
export function gradeText(input: string, expected: string): Grade {
  const given = normalizeText(input);
  if (!given) return { valid: false, error: "Vul een antwoord in" };
  const options = expected.split("|").map(normalizeText).filter(Boolean);
  return { valid: true, correct: options.includes(given) };
}

/** Points for an answer: base × level multiplier × score (0, ½ or 1). */
export function pointsFor(basePoints: number, level: Niveau, score: number): number {
  return Math.round(basePoints * NIVEAUS[level].multiplier * score);
}
