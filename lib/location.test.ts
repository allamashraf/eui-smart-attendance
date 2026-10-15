// Unit tests for lib/location.ts. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideLocation, haversineM, parseReading, type Reading } from './location';

const RULES = { radiusM: 75, maxAccuracyM: 150, rejectBeyondM: 1000 }; // the documented defaults
const EARTH_RADIUS_M = 6371008.8;
const ROOM: Reading = { lat: 30.0333, lon: 31.4667, accuracyM: 10 }; // synthetic room anchor, ±10 m

// A reading `metres` due north of the room. Along a meridian the haversine distance is exactly this.
function north(metres: number, accuracyM: number): Reading {
  return { lat: ROOM.lat + (metres / EARTH_RADIUS_M) * (180 / Math.PI), lon: ROOM.lon, accuracyM };
}
const decide = (student: Reading | null, anchor: Reading | null = ROOM, rules = RULES) => decideLocation(student, anchor, rules).decision;

test('haversine: a point north of the room is that many metres away', () => {
  assert.ok(Math.abs(haversineM(ROOM, north(400, 0)) - 400) < 0.001);
});
test('haversine: Cairo to Alexandria is about 180 km', () => {
  const km = haversineM({ lat: 30.0444, lon: 31.2357 }, { lat: 31.2001, lon: 29.9187 }) / 1000;
  assert.ok(km > 175 && km < 185, `got ${km} km`);
});

test('same point ±15 m → inside', () => assert.equal(decide(north(0, 15)), 'inside'));
test('60 m away ±20 m → inside', () => assert.equal(decide(north(60, 20)), 'inside'));
test('400 m away ±30 m → uncertain', () => assert.equal(decide(north(400, 30)), 'uncertain'));
test('25 km away ±2500 m → outside', () => assert.equal(decide(north(25000, 2500)), 'outside'));
test('25 km away ±30 m → outside', () => assert.equal(decide(north(25000, 30)), 'outside'));
test('near but ±600 m → uncertain', () => assert.equal(decide(north(20, 600)), 'uncertain'));
test('null student → no_location', () => assert.equal(decide(null), 'no_location'));
test('null anchor → no_anchor', () => assert.equal(decide(north(10, 10), null), 'no_anchor'));
test('null student and null anchor → no_location (student is checked first)', () => assert.equal(decide(null, null), 'no_location'));

test('exactly at the radius boundary → inside; just beyond → uncertain', () => {
  const s = north(150, 20);
  // Same arithmetic as decideLocation, so the gap equals the radius exactly.
  const gap = haversineM(s, ROOM) - s.accuracyM - ROOM.accuracyM;
  assert.equal(decide(s, ROOM, { ...RULES, radiusM: gap }), 'inside');
  assert.equal(decide(s, ROOM, { ...RULES, radiusM: gap - 0.001 }), 'uncertain');
});
test('exactly at the reject boundary → uncertain; just beyond → outside', () => {
  const s = north(1500, 20);
  const gap = haversineM(s, ROOM) - s.accuracyM - ROOM.accuracyM;
  assert.equal(decide(s, ROOM, { ...RULES, rejectBeyondM: gap }), 'uncertain');
  assert.equal(decide(s, ROOM, { ...RULES, rejectBeyondM: gap - 0.001 }), 'outside');
});
test('student accuracy exactly at the limit (±150 m) is not uncertain by itself', () => {
  assert.equal(decide(north(0, 150)), 'inside');
  assert.equal(decide(north(0, 150.1)), 'uncertain');
});
test('far away is refused even with poor accuracy, if the gap is still beyond the limit', () => {
  assert.equal(decide(north(5000, 3000)), 'outside'); // gap = 5000 − 3000 − 10 = 1990 m
});
test('distance is returned so it can be stored (rounded later); never the coordinates', () => {
  const r = decideLocation(north(60, 20), ROOM, RULES);
  assert.deepEqual(Object.keys(r).sort(), ['decision', 'distanceM']);
  assert.ok(Math.abs((r.distanceM ?? 0) - 60) < 0.001);
});

test('parseReading accepts valid numbers and treats "nothing sent" as no location', () => {
  assert.deepEqual(parseReading(30, 31, 12), { lat: 30, lon: 31, accuracyM: 12 });
  assert.equal(parseReading(undefined, undefined, undefined), null);
  assert.equal(parseReading(null, null, null), null);
});
test('parseReading rejects broken or out-of-range values', () => {
  for (const [lat, lon, acc] of [[91, 0, 5], [0, 181, 5], [0, 0, -1], [0, 0, 100001], [NaN, 0, 5], [0, Infinity, 5], ['30', 31, 5], [30, 31, undefined]]) {
    assert.equal(parseReading(lat, lon, acc), 'invalid', `${lat},${lon},${acc}`);
  }
});
