import {ShieldAlert,Users,BookOpen,ClipboardCheck} from 'lucide-react';
import {requireUser} from '@/lib/auth';import {query} from '@/lib/db';
import {Shell,Stat,SectionHeader,StateBadge,displayDate} from '@/components/Shell';
import {AdminConsole} from './AdminConsole';
export const dynamic='force-dynamic';
export default async function AdminPage(){const user=await requireUser('admin');
  const [counts,classes,students,instructors,alerts,corrections,events,audits]=await Promise.all([
    query(`SELECT (SELECT count(*)::int FROM users WHERE role='student') students,
      (SELECT count(*)::int FROM subjects) classes,
      (SELECT count(*)::int FROM attendance_records) checkins,
      (SELECT count(*)::int FROM risk_alerts WHERE state='open') alerts`),
    query(`SELECT sub.id,sub.code,sub.title,sub.term,sub.room,u.full_name AS instructor,
      (SELECT COUNT(*)::int FROM enrollments WHERE subject_id=sub.id AND status='active') enrolled
      FROM subjects sub JOIN users u ON u.id=sub.instructor_id ORDER BY sub.code`),
    query(`SELECT id,full_name,username FROM users WHERE role='student' AND active=true ORDER BY full_name`),
    query(`SELECT id,full_name FROM users WHERE role='instructor' AND active=true ORDER BY full_name`),
    query(`SELECT a.*,sub.code,s.title AS session_title,u.full_name AS student,
      r.outcome,r.notes AS review_notes FROM risk_alerts a JOIN class_sessions s ON s.id=a.session_id
      JOIN subjects sub ON sub.id=s.subject_id LEFT JOIN users u ON u.id=a.student_id
      LEFT JOIN LATERAL (SELECT outcome,notes FROM risk_reviews WHERE alert_id=a.id ORDER BY created_at DESC LIMIT 1) r ON true
      ORDER BY (a.state='open') DESC,a.score DESC,a.created_at DESC LIMIT 30`),
    query(`SELECT c.*,u.full_name AS student,sub.code,s.title AS session_title
      FROM correction_requests c JOIN users u ON u.id=c.student_id JOIN class_sessions s ON s.id=c.session_id
      JOIN subjects sub ON sub.id=s.subject_id ORDER BY (c.status='pending') DESC,c.created_at DESC LIMIT 25`),
    query(`SELECT ev.*,u.full_name AS actor FROM security_events ev LEFT JOIN users u ON u.id=ev.user_id
      ORDER BY ev.created_at DESC LIMIT 15`),
    query(`SELECT a.*,u.full_name AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id
      ORDER BY a.created_at DESC LIMIT 15`)
  ]);
  const s=counts.rows[0];
  const alertRows=alerts.rows.map((a:any)=>({id:a.id,code:a.code,session:a.session_title,rule:a.rule_key,score:a.score,description:a.explanation,evidence:a.evidence,state:a.state,demo:a.demo,student:a.student,created:displayDate(a.created_at),outcome:a.outcome,reviewNotes:a.review_notes}));
  const correctionRows=corrections.rows.map((c:any)=>({id:c.id,student:c.student,code:c.code,session:c.session_title,reason:c.reason,status:c.status,created:displayDate(c.created_at)}));
  return <Shell user={user} active="/admin" heading="Administrative control center" subtitle="Manage your demo university data, resolve reviews, and inspect audit history.">
    <div className="stats-grid"><Stat label="Demo students" value={s.students} note="Synthetic identities" Icon={Users}/><Stat label="Classes" value={s.classes} note="Fall 2026" Icon={BookOpen}/><Stat label="Attendance records" value={s.checkins} note="Validated check-ins" Icon={ClipboardCheck}/><Stat label="Open review alerts" value={s.alerts} note="Require a human decision" Icon={ShieldAlert}/></div>
    <div className="review-note"><ShieldAlert size={19}/><div><b>Risk is not proof.</b><p>Scores prioritize manual review only. Shared campus IPs alone never generate an alert; all examples are synthetic.</p></div></div>
    <section className="panel"><SectionHeader title="Class management" note="Create a class and enroll demo students — changes go directly into PostgreSQL"/><AdminConsole instructors={instructors.rows} students={students.rows} classes={classes.rows} alerts={alertRows} corrections={correctionRows}/></section>
    <div className="content-grid"><section className="panel"><SectionHeader title="Recent security events" note="System records notable actions without passwords or raw tokens"/><div className="event-list">{events.rows.map((e:any)=><div className="event-line" key={e.id}><span className="event-dot"/><div><b>{e.type.replace(/_/g,' ')}</b><p>{e.actor||'Unknown / rejected login'}</p><small>{displayDate(e.created_at)}</small></div></div>)}{!events.rows.length&&<p className="muted small">No events yet.</p>}</div></section><section className="panel"><SectionHeader title="Audit trail" note="Who changed what, when, and why"/><div className="event-list">{audits.rows.map((a:any)=><div className="event-line" key={a.id}><span className="event-dot blue"/><div><b>{a.action.replace(/_/g,' ')}</b><p>{a.actor||'System'} · {a.reason||'No note'}</p><small>{displayDate(a.created_at)}</small></div></div>)}{!audits.rows.length&&<p className="muted small">No audit entries yet.</p>}</div></section></div>
  </Shell>;
}
