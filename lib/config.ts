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
