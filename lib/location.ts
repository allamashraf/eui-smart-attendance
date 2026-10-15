// Decides whether a check-in location is inside the classroom.
// This file is pure: no database, no environment variables, no clock. The same inputs
// always give the same answer, which is why lib/location.test.ts can test every rule.
// The server is the judge: the phone only sends its reading, never a decision.

/** One location reading: latitude/longitude in degrees, and the device's own accuracy estimate (± metres). */
export type Reading = { lat: number; lon: number; accuracyM: number };
export type LocationRules = { radiusM: number; maxAccuracyM: number; rejectBeyondM: number };
export type LocationDecision = 'inside' | 'uncertain' | 'outside' | 'no_location' | 'no_anchor';
export type LocationResult = { decision: LocationDecision; distanceM: number | null };

const EARTH_RADIUS_M = 6371008.8; // mean radius of the Earth

/** Distance between two points along the Earth's surface, in metres (haversine formula). */
export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The rules, checked in this order:
 * 1. no student reading               → no_location (recorded, needs review)
 * 2. no room reading (anchor)         → no_anchor   (recorded, needs review)
 * 3. gap > rejectBeyondM              → outside     (NOT recorded, alert R9)
 * 4. student accuracy > maxAccuracyM,
 *    or gap > radiusM                 → uncertain   (recorded, needs review)
 * 5. otherwise                        → inside      (recorded, verified)
 *
 * gap = distance − student accuracy − room accuracy. Subtracting both accuracies gives the
 * student the benefit of the doubt: it is the closest the two devices could really be.
 */
export function decideLocation(student: Reading | null, anchor: Reading | null, cfg: LocationRules): LocationResult {
  if (!student) return { decision: 'no_location', distanceM: null };
  if (!anchor) return { decision: 'no_anchor', distanceM: null };
  const distanceM = haversineM(student, anchor);
  const gap = distanceM - student.accuracyM - anchor.accuracyM;
  if (gap > cfg.rejectBeyondM) return { decision: 'outside', distanceM };
  if (student.accuracyM > cfg.maxAccuracyM || gap > cfg.radiusM) return { decision: 'uncertain', distanceM };
  return { decision: 'inside', distanceM };
}

/**
 * Checks a reading sent by a browser. Returns the reading, null when no location was sent,
 * or 'invalid' when the numbers are missing, not finite, or out of range.
 */
export function parseReading(lat: unknown, lon: unknown, accuracy: unknown): Reading | null | 'invalid' {
  if (lat == null && lon == null && accuracy == null) return null;
  if (typeof lat !== 'number' || typeof lon !== 'number' || typeof accuracy !== 'number') return 'invalid';
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(accuracy)) return 'invalid';
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || accuracy < 0 || accuracy > 100000) return 'invalid';
  return { lat, lon, accuracyM: accuracy };
}
