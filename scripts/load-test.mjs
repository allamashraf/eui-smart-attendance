// DEV ONLY. Load test: N students check in at the same moment with one fresh code.
//   npm run load:test -- --seed 300   create 300 synthetic students (LOAD-0001…) in class LOAD-TEST
//   npm run load:test                 run: start a session, fire one check-in per LOAD- student at once
//   npm run load:test -- --cleanup    remove the LOAD-TEST class, its sessions and all LOAD- students
// Needs the running server (use `npm run build && npm start`, not dev mode) and .env.local.
import { randomUUID, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { api, cookieFor, db, freshToken, northOf, sleep, waitForServer } from './dev-helpers.mjs';

const ROOM = { lat: 30.0333, lon: 31.4667, accuracy: 10 };
const CLASS = { code: 'LOAD-TEST', term: 'Load test', title: 'Synthetic load test', room: 'Synthetic room' };
const args = process.argv.slice(2);
const seedIndex = args.indexOf('--seed');
const mode = args.includes('--cleanup') ? 'cleanup' : seedIndex >= 0 ? 'seed' : 'run';
const N = seedIndex >= 0 && /^\d+$/.test(args[seedIndex + 1] || '') ? Number(args[seedIndex + 1]) : 300;

const client = db();
await client.connect();
try {
  const instructorId = (await client.query(`SELECT id FROM users WHERE username='instructor'`)).rows[0]?.id;
  if (!instructorId) throw new Error('Demo instructor missing. Run: npm run db:seed');

  if (mode === 'seed') {
    if (N < 1 || N > 5000) throw new Error('Use --seed with a number from 1 to 5000.');
    // These accounts never sign in: one random password hash is shared by all of them.
    const hash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
    const numbers = Array.from({ length: N }, (_, i) => `LOAD-${String(i + 1).padStart(4, '0')}`);
    await client.query('BEGIN');
    const subject = (await client.query(`INSERT INTO subjects(code,title,term,room,instructor_id) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(code,term) DO UPDATE SET instructor_id=excluded.instructor_id RETURNING id`, [CLASS.code, CLASS.title, CLASS.term, CLASS.room, instructorId])).rows[0].id;
    await client.query(`INSERT INTO users(username,full_name,role,student_number,password_hash,demo)
      SELECT lower(n), n || ' Synthetic', 'student', n, $2, true FROM unnest($1::text[]) AS n
      ON CONFLICT(username) DO NOTHING`, [numbers, hash]);
    await client.query(`INSERT INTO enrollments(subject_id,student_id)
      SELECT $1, id FROM users WHERE student_number = ANY($2::text[]) ON CONFLICT(subject_id,student_id) DO UPDATE SET status='active'`, [subject, numbers]);
    await client.query('COMMIT');
    const total = (await client.query(`SELECT count(*)::int n FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.subject_id=$1 AND u.student_number LIKE 'LOAD-%'`, [subject])).rows[0].n;
    console.log(`Seeded: class ${CLASS.code} with ${total} synthetic LOAD- students. Now run: npm run load:test`);
  }

  if (mode === 'cleanup') {
    await client.query('BEGIN');
    // Deleting the class removes its sessions, and with them their attendance records, challenges and alerts.
    const subjects = await client.query(`DELETE FROM subjects WHERE code=$1 AND term=$2`, [CLASS.code, CLASS.term]);
    const users = await client.query(`DELETE FROM users WHERE role='student' AND student_number LIKE 'LOAD-%' AND username LIKE 'load-%'`);
    await client.query('COMMIT');
    console.log(`Cleanup: removed ${subjects.rowCount} LOAD-TEST class and ${users.rowCount} LOAD- students.`);
  }

  if (mode === 'run') {
    await waitForServer();
    const subject = (await client.query(`SELECT id FROM subjects WHERE code=$1 AND term=$2`, [CLASS.code, CLASS.term])).rows[0];
    const students = subject ? (await client.query(`SELECT u.id FROM enrollments e JOIN users u ON u.id=e.student_id
      WHERE e.subject_id=$1 AND e.status='active' AND u.student_number LIKE 'LOAD-%'`, [subject.id])).rows : [];
    if (!students.length) throw new Error('No LOAD- students found. Run first: npm run load:test -- --seed 300');
    const instructor = await cookieFor(instructorId);
    const started = await api('/api/sessions', { cookie: instructor, body: { subjectId: subject.id, title: `Load test ${new Date().toISOString().slice(0, 16)}` } });
    const S = started.data?.id;
    if (!S) throw new Error(`Could not start a session: ${started.status} ${JSON.stringify(started.data)}`);
    await api(`/api/sessions/${S}/anchor`, { cookie: instructor, body: ROOM });
    const cookies = await Promise.all(students.map((s) => cookieFor(s.id)));

    // Wait for a new code to appear, so the run gets the code's full lifetime (like a real class).
    const first = await freshToken(S, instructor);
    await sleep(Math.max(0, Date.parse(first.challenge.expiresAt) - Date.now() + 150));
    const { token, challenge } = await freshToken(S, instructor);
    console.log(`Firing ${students.length} simultaneous check-ins (code valid for about ${challenge.intervalSeconds} s + grace)…`);

    const t0 = performance.now();
    const results = await Promise.all(cookies.map(async (cookie) => {
      const start = performance.now();
      // Every student is in the room: 0–30 m from the anchor, ±8–25 m accuracy, own browser id.
      const location = northOf(ROOM, Math.random() * 30, 8 + Math.random() * 17);
      try {
        const r = await api('/api/checkin', { cookie, body: { token, deviceId: randomUUID(), ...location } });
        return { ms: performance.now() - start, status: r.status, code: r.data?.code, verification: r.data?.verification };
      } catch (e) { return { ms: performance.now() - start, status: 0, code: 'network: ' + (e.cause?.code || e.message) }; }
    }));
    const totalMs = performance.now() - t0;
    await api(`/api/sessions/${S}/close`, { cookie: instructor, body: {} });

    const times = results.map((r) => r.ms).sort((a, b) => a - b);
    const pct = (p) => times[Math.min(times.length - 1, Math.ceil((p / 100) * times.length) - 1)];
    const errors = results.filter((r) => r.status !== 200);
    const byCode = errors.reduce((m, r) => ({ ...m, [`${r.status} ${r.code}`]: (m[`${r.status} ${r.code}`] || 0) + 1 }), {});
    const db1 = (await client.query(`SELECT count(*)::int AS records, (count(*) - count(DISTINCT student_id))::int AS duplicates,
      count(*) FILTER (WHERE verification='verified')::int AS verified FROM attendance_records WHERE session_id=$1`, [S])).rows[0];
    console.log(`\nStudents:        ${students.length}`);
    console.log(`Total time:      ${(totalMs / 1000).toFixed(2)} s`);
    console.log(`Latency p50:     ${pct(50).toFixed(0)} ms`);
    console.log(`Latency p95:     ${pct(95).toFixed(0)} ms`);
    console.log(`Latency max:     ${times.at(-1).toFixed(0)} ms`);
    console.log(`Errors:          ${errors.length}${errors.length ? '  ' + JSON.stringify(byCode) : ''}`);
    console.log(`Duplicates:      ${db1.duplicates} (must be 0)`);
    console.log(`Final records:   ${db1.records} (must equal ${students.length}); verified: ${db1.verified}`);
    console.log(`Session ${S} has been ended. Remove the synthetic data with: npm run load:test -- --cleanup`);
    process.exitCode = errors.length || db1.duplicates || db1.records !== students.length ? 1 : 0;
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch { /* no open transaction */ }
  console.error(err.message || err);
  process.exitCode = 1;
} finally {
  await client.end();
}
