import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyDraft, usedParams, validateQuestion, variablesNeeded, type QuestionDraft } from "./question.ts";

const knight: QuestionDraft = {
  ...emptyDraft("expert"),
  body: "Een ridder loopt {n} keer rond een vierkante toren met zijden van {z} m.",
  correct_value: "= n × 4 × z",
  unit: "m",
  base_points: 30,
  params: { n: { min: 2, max: 5 }, z: { min: 8, max: 15 }, q: { min: 1, max: 2 } },
};

test("the T03 example is valid", () => {
  assert.equal(validateQuestion(knight), null);
  assert.deepEqual(variablesNeeded(knight), ["n", "z"]);
  assert.deepEqual(Object.keys(usedParams(knight)), ["n", "z"]);
});

test("missing range, bad formula and bad range", () => {
  assert.match(validateQuestion({ ...knight, params: { n: { min: 2, max: 5 } } })!, /\{z\}/);
  assert.match(validateQuestion({ ...knight, correct_value: "n × (4" })!, /Haakje/);
  assert.match(validateQuestion({ ...knight, params: { ...knight.params, n: { min: 5, max: 2 } } })!, /groter/);
  assert.match(validateQuestion({ ...knight, correct_value: "n / (z - 8)" })!, /nul/);
});

test("text and photo questions", () => {
  const text = { ...emptyDraft("basis"), body: "Welke kleur?", answer_type: "text" as const };
  assert.match(validateQuestion(text)!, /juiste antwoord/);
  assert.equal(validateQuestion({ ...text, correct_value: "rood" }), null);
  const photo = { ...emptyDraft("basis"), body: "Maak een foto", answer_type: "photo" as const, needs_photo: true };
  assert.equal(validateQuestion(photo), null);
});
