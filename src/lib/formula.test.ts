import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluate,
  FormulaError,
  isCorrect,
  pickValues,
  placeholdersIn,
  renderBody,
  variablesIn,
} from "./formula.ts";

test("the T03 example: a knight walks n times around a square tower", () => {
  assert.equal(evaluate("= n × 4 × z", { n: 3, z: 12 }), 144);
});

test("operators, precedence and brackets", () => {
  assert.equal(evaluate("2 + 3 * 4"), 14);
  assert.equal(evaluate("(2 + 3) * 4"), 20);
  assert.equal(evaluate("10 ÷ 4"), 2.5);
  assert.equal(evaluate("10 : 4"), 2.5);
  assert.equal(evaluate("2 ^ 3 ^ 2"), 512);
  assert.equal(evaluate("-n + 1", { n: 3 }), -2);
});

test("decimal comma and implicit multiplication", () => {
  assert.equal(evaluate("n * 2,5", { n: 4 }), 10);
  assert.equal(evaluate("4n", { n: 3 }), 12);
  assert.equal(evaluate("2(n + 1)", { n: 3 }), 8);
  assert.equal(evaluate("{n} × {z}", { n: 2, z: 5 }), 10);
});

test("errors are Dutch FormulaErrors", () => {
  assert.throws(() => evaluate("n × 2", {}), FormulaError);
  assert.throws(() => evaluate("4 / 0"), /nul/);
  assert.throws(() => evaluate("(1 + 2"), /Haakje/);
  assert.throws(() => evaluate("2 $ 3"), FormulaError);
  assert.throws(() => evaluate(""), FormulaError);
});

test("variables and placeholders", () => {
  assert.deepEqual(variablesIn("= n × 4 × z"), ["n", "z"]);
  assert.deepEqual(placeholdersIn("Loopt {n} keer rond {z} m, {n} keer"), ["n", "z"]);
});

test("renderBody fills numbers with a decimal comma", () => {
  assert.equal(renderBody("{n} keer {z} m", { n: 3, z: 12.5 }), "3 keer 12,5 m");
  assert.equal(renderBody("{q} blijft", {}), "{q} blijft");
});

test("pickValues stays within range and on the step", () => {
  for (let i = 0; i < 200; i++) {
    const v = pickValues({ n: { min: 2, max: 5 }, z: { min: 8, max: 15, step: 0.5 } });
    assert.ok(v.n >= 2 && v.n <= 5 && Number.isInteger(v.n));
    assert.ok(v.z >= 8 && v.z <= 15 && (v.z * 2) % 1 === 0);
  }
  assert.deepEqual(pickValues({ n: { min: 2, max: 5 } }, () => 0.999), { n: 5 });
});

test("isCorrect uses the tolerance", () => {
  assert.ok(isCorrect(144, 144, 0));
  assert.ok(isCorrect(31.8, 32, 0.5));
  assert.ok(!isCorrect(143, 144, 0));
});
