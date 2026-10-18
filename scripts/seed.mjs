import bcrypt from 'bcryptjs';
import pg from 'pg';
import { pgOptions } from './pg-config.mjs';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing.');
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 10) throw new Error('Set DEMO_PASSWORD (at least 10 characters) in .env.local before seeding.');
const hash = await bcrypt.hash(password, 12);
const client = new pg.Client(pgOptions());
async function addUser(username, name, role, num=null) {
  const {rows} = await client.query(`INSERT INTO users(username,full_name,role,student_number,password_hash,demo)
    VALUES($1,$2,$3,$4,$5,true) ON CONFLICT(username) DO UPDATE SET full_name=excluded.full_name, password_hash=excluded.password_hash
    RETURNING id`, [username,name,role,num,hash]);
  return rows[0].id;
}
try {
  await client.connect(); await client.query('BEGIN');
  const motaz = await addUser('motaz','Motaz Alaa','student','DEMO-001');
  const instructor = await addUser('instructor','Dr. Salma Hassan','instructor');
  const admin = await addUser('admin','EUI Demo Administrator','admin');
  const otherIds = [];
  for (const [index,name] of ['Nour Ibrahim','Omar Adel','Mariam Tarek','Youssef Ahmed','Laila Mahmoud'].entries())
    otherIds.push(await addUser(`student${index+2}`,name,'student',`DEMO-00${index+2}`));
  const {rows: [subject]} = await client.query(`INSERT INTO subjects(code,title,term,room,instructor_id)
    VALUES ('CS301','Database Systems','Fall 2026','Hall B2',$1)
    ON CONFLICT(code,term) DO UPDATE SET instructor_id=excluded.instructor_id
    RETURNING id`, [instructor]);
  for (const id of [motaz,...otherIds]) await client.query(`INSERT INTO enrollments(subject_id,student_id)
    VALUES ($1,$2) ON CONFLICT(subject_id,student_id) DO UPDATE SET status='active'`, [subject.id,id]);
  const {rows: [previous]} = await client.query(`SELECT id FROM class_sessions WHERE subject_id=$1 AND title='Lecture 1 · Practice history'`, [subject.id]);
  let historyId = previous?.id;
  if (!historyId) {
    const {rows} = await client.query(`INSERT INTO class_sessions(subject_id,title,room,started_at,ended_at,state)
      VALUES ($1,'Lecture 1 · Practice history','Hall B2',now()-interval '7 days',now()-interval '7 days'+interval '90 minutes','ended') RETURNING id`, [subject.id]);
    historyId = rows[0].id;
  }
  for (const studentId of [motaz,otherIds[0],otherIds[1],otherIds[2]]) {
    await client.query(`INSERT INTO attendance_records(student_id,session_id,status,method,checked_in_at)
      VALUES ($1,$2,'present','qr',now()-interval '7 days') ON CONFLICT(student_id,session_id) DO NOTHING`, [studentId,historyId]);
  }
  const {rows: [existingLive]} = await client.query(`SELECT id FROM class_sessions WHERE subject_id=$1 AND title='Demo live attendance'`, [subject.id]);
  let liveId = existingLive?.id;
  if (!liveId) {
    const {rows} = await client.query(`INSERT INTO class_sessions(subject_id,title,room,started_at,state,ontime_minutes,cutoff_minutes)
      VALUES($1,'Demo live attendance','Hall B2',now(),'active',15,90) RETURNING id`, [subject.id]);
    liveId = rows[0].id;
  } else {
    // Reset demo session clock when reseeding, to let the user try check-in again.
    await client.query(`UPDATE class_sessions SET started_at=now(),ended_at=null,state='active' WHERE id=$1`,[liveId]);
  }
  // Clearly labeled historical synthetic example, not an allegation about any person.
  await client.query(`INSERT INTO risk_alerts(session_id,rule_key,score,explanation,evidence,demo)
    VALUES($1,'SIMULATED_R1_R2',55,'Simulated scenario: multiple demo accounts appear on one browser; verify whether it is a shared lab device.',
      '{"rules":["R1 shared demo device (+30)","R2 rapid switches (+25)"],"possible_explanations":["shared lab computer","classroom demonstration"]}'::jsonb,true)
    ON CONFLICT(session_id,rule_key) DO NOTHING`, [historyId]);
  await client.query('COMMIT');
  console.log('\nDEMO DATA READY (synthetic, development only)');
  console.log('Website accounts (same password for each):');
  console.log('  motaz      / '+password+'   (student: Motaz Alaa)');
  console.log('  instructor / '+password+'   (instructor)');
  console.log('  admin      / '+password+'   (administrator)');
  console.log('Class: CS301 — Database Systems, Fall 2026');
  console.log('Demo live session ID:',liveId);
  console.log('\nNEVER use this seed script with real student accounts.\n');
} catch(err) { await client.query('ROLLBACK'); console.error(err); process.exitCode=1; }
finally { await client.end(); }
