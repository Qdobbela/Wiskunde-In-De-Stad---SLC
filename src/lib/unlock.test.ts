import { test } from "node:test";
import assert from "node:assert/strict";
import { dwellStatus, plausibility, type PingSample } from "./unlock.ts";
import { gradeNumber, gradeText, pointsFor } from "./grading.ts";

const zone = { lat: 51.0536, lng: 3.7253, radiusM: 25, dwellS: 30 };
const t0 = 1_800_000_000_000;
/** Pings at `seconds` after t0, `metres` north of the spot. Returned newest first. */
const pings = (...list: [seconds: number, metres: number, accuracy?: number][]): PingSample[] =>
  list
    .map(([s, m, accuracy = 10]) => ({ lat: zone.lat + m / 111_320, lng: zone.lng, accuracy, at: t0 + s * 1000 }))
    .reverse();

test("unlocks after 30 s inside the zone over at least 3 pings", () => {
  const status = dwellStatus(pings([0, 5], [10, 8], [20, 3], [30, 6]), zone);
  assert.equal(status.inside, true);
  assert.equal(status.streakPings, 4);
  assert.equal(status.streakSeconds, 30);
  assert.equal(status.ready, true);
});

test("not yet: too short, too few pings, or a gap", () => {
  assert.equal(dwellStatus(pings([0, 5], [10, 5], [25, 5]), zone).ready, false); // 25 s
  assert.equal(dwellStatus(pings([0, 5], [30, 5]), zone).ready, false); // 2 pings
  assert.equal(dwellStatus(pings([0, 5], [5, 5], [30, 5], [35, 5]), zone).ready, false); // 25 s gap
});

test("leaving the zone or bad accuracy restarts the count", () => {
  const left = dwellStatus(pings([0, 5], [10, 5], [20, 60], [30, 5], [40, 5]), zone);
  assert.equal(left.streakPings, 2);
  assert.equal(left.ready, false);
  const blurry = dwellStatus(pings([0, 5], [10, 5], [20, 5, 48], [30, 5], [40, 5]), zone);
  assert.equal(blurry.streakPings, 2);
  assert.equal(dwellStatus(pings([0, 5, 48]), zone).accurate, false);
});

test("dwell time 0 unlocks on the first good ping", () => {
  assert.equal(dwellStatus(pings([0, 5]), { ...zone, dwellS: 0 }).ready, true);
  assert.equal(dwellStatus([], zone).ready, false);
});

test("GPS jumps: 150 m in 5 s, or faster than 25 km/h", () => {
  assert.equal(plausibility(pings([0, 0], [3, 400]))?.type, "gps_jump");
  assert.equal(plausibility(pings([0, 0], [10, 200]))?.type, "gps_jump"); // 72 km/h
  assert.equal(plausibility(pings([0, 0], [10, 12])), null); // walking
  assert.equal(plausibility(pings([0, 0], [2, 20])), null); // jitter
});

test("identical coordinates look like a fake location", () => {
  const same = Array.from({ length: 6 }, (_, i) => ({ lat: 51.05, lng: 3.72, accuracy: 5, at: t0 + i * 4000 }));
  assert.equal(plausibility(same)?.type, "mock_suspected");
  const wobble = same.map((p, i) => ({ ...p, lat: p.lat + i * 1e-7 }));
  assert.equal(plausibility(wobble), null);
});

test("grading numbers, text and points", () => {
  assert.deepEqual(gradeNumber("31,8", 32, 0.5), { valid: true, correct: true });
  assert.deepEqual(gradeNumber("31,8", 144, 0), { valid: true, correct: false });
  assert.equal(gradeNumber("31.8", 31.8, 0).valid, false);
  assert.deepEqual(gradeText("  Rodé ", "rood|rode"), { valid: true, correct: true });
  assert.deepEqual(gradeText("blauw", "rood|rode"), { valid: true, correct: false });
  assert.equal(pointsFor(30, "expert", 1), 60);
  assert.equal(pointsFor(30, "gevorderd", 0.5), 23);
});
