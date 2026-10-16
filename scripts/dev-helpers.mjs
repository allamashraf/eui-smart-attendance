// DEV ONLY. Shared helpers for scripts/sim-attack.mjs and scripts/load-test.mjs.
// They talk to a running local server and the local database, and need DATABASE_URL,
// AUTH_SECRET and QR_SECRET from .env.local (run with: node --env-file=.env.local ...).
// Never point these scripts at a shared or production deployment.
import { createHmac } from 'node:crypto';
import { SignJWT } from 'jose';
import pg from 'pg';

export const BASE_URL = (process.env.SIM_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

for (const name of ['DATABASE_URL', 'AUTH_SECRET', 'QR_SECRET']) {
  if (!process.env[name]) { console.error(`${name} is missing. Run with: node --env-file=.env.local ...`); process.exit(2); }
}
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(BASE_URL).hostname)) {
  console.error(`Refusing to run against ${BASE_URL}: these scripts are for a local development server only.`);
  process.exit(2);
}

export const QR_GRACE_SECONDS = Number(process.env.QR_GRACE_SECONDS || 3);
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function db() { return new pg.Client({ connectionString: process.env.DATABASE_URL }); }

// Same as issueSession() in lib/auth.ts: an HS256 JWT with typ 'demo', valid for 12 hours.
export async function cookieFor(userId) {
  const token = await new SignJWT({ typ: 'demo' }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId)
    .setIssuedAt().setExpirationTime('12h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return `eui_demo_session=${token}`;
}

// Same as qrToken() in lib/security.ts.
export function qrToken(sessionId, slot) {
  const claim = `EUIA1.${sessionId}.${slot}`;
  return `${claim}.${createHmac('sha256', process.env.QR_SECRET).update(claim).digest('base64url')}`;
}

// Calls the API like the browser does. POSTs send an Origin header because parsePost() checks it.
export async function api(path, { cookie, body, method = body === undefined ? 'GET' : 'POST' } = {}) {
  const headers = { cookie };
  if (method !== 'GET') { headers['content-type'] = 'application/json'; headers.origin = BASE_URL; }
  const res = await fetch(BASE_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, data };
}

// Waits until the server answers /api/health, so the scripts can start right after `npm start`.
export async function waitForServer(timeoutMs = 60000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if ((await fetch(BASE_URL + '/api/health')).ok) return; } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`No server at ${BASE_URL}. Start it with: npm run build && npm start`);
}

// A reading `metres` due north of a point (along a meridian this is exactly the haversine distance).
export function northOf(point, metres, accuracy) {
  return { lat: point.lat + (metres / 6371008.8) * (180 / Math.PI), lon: point.lon, accuracy };
}

// Prints rows as a plain text table with the given column keys.
export function printTable(rows, columns) {
  const width = columns.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  const line = (cells) => cells.map((cell, i) => String(cell ?? '').padEnd(width[i])).join(' | ');
  console.log(line(columns));
  console.log(width.map((w) => '-'.repeat(w)).join('-+-'));
  for (const r of rows) console.log(line(columns.map((c) => r[c])));
}

// Fetches the challenge as the instructor (which records the slot as issued on the server),
// then rebuilds the same token the QR image contains. The API response never includes the token.
export async function freshToken(sessionId, instructorCookie) {
  const { status, data } = await api(`/api/sessions/${sessionId}/challenge`, { cookie: instructorCookie });
  if (status !== 200 || data?.state !== 'active') throw new Error(`Challenge failed: ${status} ${JSON.stringify(data)}`);
  const slot = Math.round(Date.parse(data.expiresAt) / (data.intervalSeconds * 1000)) - 1;
  return { token: qrToken(sessionId, slot), challenge: data };
}
