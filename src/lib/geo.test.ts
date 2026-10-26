import { test } from "node:test";
import assert from "node:assert/strict";
import { bearingDeg, distanceM, formatDistance, normalizeCode, rotateRoute, walkMinutes } from "./geo.ts";

const belfort = { lat: 51.0536, lng: 3.7253 };
const gravensteen = { lat: 51.0573, lng: 3.7208 };

test("distance between two Ghent landmarks", () => {
  const d = distanceM(belfort, gravensteen);
  assert.ok(d > 480 && d < 520, `got ${d}`);
  assert.equal(distanceM(belfort, belfort), 0);
});

test("bearing points the right way", () => {
  const north = bearingDeg(belfort, { lat: 51.06, lng: 3.7253 });
  const east = bearingDeg(belfort, { lat: 51.0536, lng: 3.74 });
  assert.ok(north < 1 || north > 359);
  assert.ok(Math.abs(east - 90) < 1);
  const toCastle = bearingDeg(belfort, gravensteen);
  assert.ok(toCastle > 300 && toCastle < 360, `north-west, got ${toCastle}`);
});

test("walking time and distance labels", () => {
  assert.equal(walkMinutes(240), 3);
  assert.equal(walkMinutes(10), 1);
  assert.equal(formatDistance(238), "240 m");
  assert.equal(formatDistance(1234), "1,2 km");
});

test("routes rotate per group", () => {
  const spots = [1, 2, 3, 4];
  assert.deepEqual(rotateRoute(spots, 0), [1, 2, 3, 4]);
  assert.deepEqual(rotateRoute(spots, 1), [2, 3, 4, 1]);
  assert.deepEqual(rotateRoute(spots, 5), [2, 3, 4, 1]);
  assert.deepEqual(rotateRoute([], 3), []);
});

test("session codes ignore case, spaces and dashes", () => {
  assert.equal(normalizeCode(" u5n2-eg "), "U5N2EG");
});
