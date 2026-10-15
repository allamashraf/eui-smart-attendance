// DEV ONLY. Replays the proxy-attendance attack and the Phase 1 rules against a running local server.
// Needs: the server (npm run build && npm start), the seeded demo database (npm run db:seed),
// and DATABASE_URL, AUTH_SECRET and QR_SECRET in .env.local.
// Run: npm run sim:attack   → prints an expected vs actual table; exits with code 1 on any mismatch.
import { randomUUID } from 'node:crypto';
import { api, cookieFor, db, freshToken, northOf, printTable, QR_GRACE_SECONDS, sleep, waitForServer } from './dev-helpers.mjs';

const ROOM = { lat: 30.0333, lon: 31.4667, accuracy: 10 }; // synthetic room position (±10 m)
const rows = [];
function report(id, scenario, expected, actual, pass) {
  rows.push({ case: id, scenario, expected, actual, result: pass ? 'PASS' : 'FAIL' });
}

await waitForServer();
const client = db();
await client.connect();
try {
  const users = Object.fromEntries((await client.query(
    `SELECT username,id FROM users WHERE username IN ('instructor','motaz','student2','student3','student4','student5','student6')`)).rows
    .map((r) => [r.username, r.id]));
  const subject = (await client.query(`SELECT id FROM subjects WHERE code='CS301' AND term='Fall 2026'`)).rows[0];
  if (Object.keys(users).length < 7 || !subject) throw new Error('Demo accounts or class CS301 missing. Run: npm run db:seed');
  const instructor = await cookieFor(users.instructor);
  const asStudent = (name) => cookieFor(users[name]);
  const recordOf = async (name, sessionId) =>
    (await client.query(`SELECT * FROM attendance_records WHERE student_id=$1 AND session_id=$2`, [users[name], sessionId])).rows;

  // Setup: a fresh session and the room anchor, set through the real API.
  const started = await api('/api/sessions', { cookie: instructor, body: { subjectId: subject.id, title: `Sim attack ${new Date().toISOString().slice(0, 16)}` } });
  const S = started.data?.id;
  if (!S) throw new Error(`Could not start a session: ${started.status} ${JSON.stringify(started.data)}`);
  const anchor = await api(`/api/sessions/${S}/anchor`, { cookie: instructor, body: ROOM });
  if (anchor.status !== 200) throw new Error(`Could not set the anchor: ${anchor.status} ${JSON.stringify(anchor.data)}`);
  console.log(`Session ${S} started, room anchor set (±${ROOM.accuracy} m).\n`);

  const checkin = async (name, token, location) =>
    api('/api/checkin', { cookie: await asStudent(name), body: { token, deviceId: randomUUID(), ...(location || {}) } });

  // G. The challenge response has no URL and no raw token field.
  {
    const { status, data } = await api(`/api/sessions/${S}/challenge`, { cookie: instructor });
    const svg = Buffer.from(String(data.qrImage).split(',')[1] || '', 'base64').toString('utf8');
    const banned = Object.keys(data).filter((k) => ['url', 'manualToken', 'token'].includes(k));
    const leaks = Object.entries(data).filter(([k, v]) => k !== 'qrImage' && /https?:|\/checkin|EUIA1/.test(String(v))).map(([k]) => k);
    const ok = status === 200 && banned.length === 0 && leaks.length === 0 && !svg.includes('EUIA1');
    report('G', 'challenge response', 'no url/token field, no link or token text', `keys: ${Object.keys(data).join(',')}${banned.length || leaks.length ? ' LEAK: ' + [...banned, ...leaks].join(',') : ''}`, ok);
  }
  // A. In-room student 20 m from the anchor → present, verified.
  {
    const { token } = await freshToken(S, instructor);
    const r = await checkin('motaz', token, northOf(ROOM, 20, 15));
    const rec = (await recordOf('motaz', S))[0];
    report('A', 'in room, 20 m away', 'present, verified', `${r.status} ${r.data?.status ?? r.data?.code}, ${rec?.verification ?? 'no record'}`,
      r.status === 200 && r.data.status === 'present' && rec?.verification === 'verified');
  }
  // B. Friend 25 km away with a fresh valid token → rejected, security event and R9 alert.
  {
    const { token } = await freshToken(S, instructor);
    const r = await checkin('student2', token, northOf(ROOM, 25000, 30));
    const recs = await recordOf('student2', S);
    const events = (await client.query(`SELECT details FROM security_events WHERE user_id=$1 AND session_id=$2 AND type='checkin_far_away'`, [users.student2, S])).rows;
    const alert = (await client.query(`SELECT evidence FROM risk_alerts WHERE session_id=$1 AND rule_key=$2`, [S, `R9_${users.student2.slice(0, 16)}`])).rows[0];
    report('B', 'friend 25 km away, fresh token', 'rejected, no record, event + R9',
      `${r.status} ${r.data?.code}, records=${recs.length}, events=${events.length}, R9=${alert ? alert.evidence.distance_m + ' m' : 'none'}`,
      r.status === 403 && r.data?.code === 'outside' && recs.length === 0 && events.length === 1 && alert?.evidence.distance_m > 24000);
  }
  // C. Student with location denied → recorded, needs_review.
  {
    const { token } = await freshToken(S, instructor);
    const r = await checkin('student3', token, null);
    const rec = (await recordOf('student3', S))[0];
    report('C', 'location denied', 'recorded, needs_review', `${r.status}, ${rec ? rec.verification + ' / ' + rec.location_result : 'no record'}`,
      r.status === 200 && rec?.verification === 'needs_review' && rec.location_result === 'no_location');
  }
  // D. Token older than interval + grace → rejected as expired.
  {
    const { token, challenge } = await freshToken(S, instructor);
    const deadline = Date.parse(challenge.expiresAt) + QR_GRACE_SECONDS * 1000;
    console.log(`D: waiting ${Math.ceil((deadline + 500 - Date.now()) / 1000)} s for the code to expire…`);
    await sleep(Math.max(0, deadline + 500 - Date.now()));
    const r = await checkin('student4', token, northOf(ROOM, 10, 10));
    const recs = await recordOf('student4', S);
    report('D', `token older than ${challenge.intervalSeconds} s + ${QR_GRACE_SECONDS} s`, 'rejected as expired, no record', `${r.status} ${r.data?.code}, records=${recs.length}`,
      r.status === 400 && r.data?.code === 'expired' && recs.length === 0);
  }
  // E. Same student submits twice (at the same moment) → exactly one record.
  {
    const { token } = await freshToken(S, instructor);
    const both = await Promise.all([checkin('student5', token, northOf(ROOM, 5, 10)), checkin('student5', token, northOf(ROOM, 5, 10))]);
    const recs = await recordOf('student5', S);
    report('E', 'same student twice, in parallel', 'exactly one record', `statuses ${both.map((x) => x.status).sort().join('+')}, records=${recs.length}`,
      recs.length === 1 && both.filter((x) => x.status === 200).length === 1);
  }
  // F. QR closed → scan rejected; manual add with a reason → recorded as manual and audited.
  {
    const { token } = await freshToken(S, instructor);
    const closed = await api(`/api/sessions/${S}/qr`, { cookie: instructor, body: { open: false } });
    const scan = await checkin('student6', token, northOf(ROOM, 10, 10));
    const manual = await api(`/api/sessions/${S}/manual`, { cookie: instructor, body: { studentId: users.student6, reason: 'No phone available' } });
    const rec = (await recordOf('student6', S))[0];
    const audited = rec ? (await client.query(`SELECT 1 FROM audit_logs WHERE action='manual_checkin' AND target_id=$1`, [rec.id])).rowCount : 0;
    report('F', 'QR closed, then manual add', 'scan rejected; manual, audited',
      `close=${closed.status}, scan=${scan.status} ${scan.data?.code}, manual=${manual.status} ${rec?.verification ?? 'no record'}, audit=${audited}`,
      closed.status === 200 && scan.status === 409 && scan.data?.code === 'qr_closed' && manual.status === 200 && rec?.method === 'manual' && rec.verification === 'manual' && audited === 1);
  }

  await api(`/api/sessions/${S}/close`, { cookie: instructor, body: {} });
  console.log('');
  printTable(rows.sort((a, b) => a.case.localeCompare(b.case)), ['case', 'scenario', 'expected', 'actual', 'result']);
  const failed = rows.filter((r) => r.result !== 'PASS').length;
  console.log(`\n${rows.length - failed}/${rows.length} passed. Session ${S} has been ended.`);
  process.exitCode = failed ? 1 : 0;
} catch (err) {
  console.error(err.message || err);
  process.exitCode = 1;
} finally {
  await client.end();
}
