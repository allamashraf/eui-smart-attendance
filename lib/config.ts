// Every Phase 1 setting lives in this one file. Values come from environment
// variables (.env.local) and fall back to the documented defaults.
// A value outside its allowed range stops the server with a clear message,
// so a typo can never silently weaken the attendance checks.

function wholeNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}. Current value: "${raw}".`);
  }
  return value;
}

/**
 * QR code lifetime. Time is cut into slots of `intervalSeconds`; each slot has its own code.
 * A code is accepted until its slot ends plus `graceSeconds`, then it is rejected as expired.
 */
export const QR = {
  /** QR_INTERVAL_SECONDS: how often the instructor's QR changes. Default 8, allowed 5–30. */
  intervalSeconds: wholeNumber('QR_INTERVAL_SECONDS', 8, 5, 30),
  /** QR_GRACE_SECONDS: extra time after a code changes, for slow phones and networks. Default 3, allowed 0–10. */
  graceSeconds: wholeNumber('QR_GRACE_SECONDS', 3, 0, 10),
};

/**
 * Location rules used by decideLocation() in lib/location.ts. All values are in metres.
 * "gap" = distance − student accuracy − room accuracy: the closest the two devices could really be.
 */
export const LOCATION = {
  /** RADIUS_M: a gap up to this counts as inside the room. Default 75, allowed 10–1000. */
  radiusM: wholeNumber('RADIUS_M', 75, 10, 1000),
  /**
   * MAX_ACCURACY_M: a student reading less precise than ±this is "uncertain" and goes to review.
   * It is also the least precise room location the instructor may save. Default 150, allowed 10–5000.
   */
  maxAccuracyM: wholeNumber('MAX_ACCURACY_M', 150, 10, 5000),
  /** REJECT_BEYOND_M: a gap beyond this is "outside": no record, alert R9. Default 1000, allowed 100–100000. */
  rejectBeyondM: wholeNumber('REJECT_BEYOND_M', 1000, 100, 100000),
};
if (LOCATION.rejectBeyondM <= LOCATION.radiusM) throw new Error('REJECT_BEYOND_M must be larger than RADIUS_M.');
