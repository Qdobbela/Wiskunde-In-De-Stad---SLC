import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDutchNumber, parseDutchNumber } from "./number.ts";

test("parses a decimal comma", () => {
  assert.equal(parseDutchNumber("31,8"), 31.8);
  assert.equal(parseDutchNumber(" 42 "), 42);
  assert.equal(parseDutchNumber("-2,5"), -2.5);
  assert.equal(parseDutchNumber("−4"), -4);
});

test("rejects a decimal point and other input (Figma Fout state)", () => {
  assert.equal(parseDutchNumber("31.8"), null);
  assert.equal(parseDutchNumber("1.250,5"), null);
  assert.equal(parseDutchNumber("12,"), null);
  assert.equal(parseDutchNumber("abc"), null);
  assert.equal(parseDutchNumber(""), null);
});

test("formats with a decimal comma", () => {
  assert.equal(formatDutchNumber(31.8), "31,8");
  assert.equal(formatDutchNumber(1250.456), "1250,46");
});
