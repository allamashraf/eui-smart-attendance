import {ShieldAlert,Users,BookOpen,ClipboardCheck} from 'lucide-react';
import {requireUser} from '@/lib/auth';import {query} from '@/lib/db';
import {Shell,Stat,SectionHeader,displayDate} from '@/components/Shell';
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
  return <Shell user={user} active="/admin" heading="Control center" subtitle="Manage the demo classes, resolve review alerts and corrections, and inspect the audit history.">
    <div className="grid grid-4">
      <Stat i={1} label="Demo students" value={s.students} note="Synthetic identities" Icon={Users}/>
      <Stat i={2} label="Classes" value={s.classes} note="Fall 2026" Icon={BookOpen}/>
      <Stat i={3} label="Attendance records" value={s.checkins} note="All check-ins" Icon={ClipboardCheck}/>
      <Stat i={4} label="Open review alerts" value={s.alerts} note="Need a human decision" Icon={ShieldAlert}/>
    </div>
    <div className="alert alert-warn section reveal" style={{'--i':5} as React.CSSProperties}><ShieldAlert size={18} aria-hidden="true"/><span><b>Risk is not proof.</b> Scores only set the order of manual review. Shared campus IPs alone never create an alert. All examples are synthetic.</span></div>
    <section className="card card-pad section reveal" style={{'--i':6} as React.CSSProperties}>
      <AdminConsole instructors={instructors.rows} students={students.rows} classes={classes.rows} alerts={alertRows} corrections={correctionRows}/>
    </section>
    <div className="grid grid-2 section">
      <section className="card card-pad reveal" style={{'--i':7} as React.CSSProperties}>
        <SectionHeader title="Recent security events" note="Notable actions, without passwords or raw tokens"/>
        <ul className="timeline">{events.rows.map((e:any)=><li key={e.id}><i aria-hidden="true"/><div><b>{e.type.replace(/_/g,' ')}</b><p>{e.actor||'Unknown / rejected login'}</p><time className="num">{displayDate(e.created_at)}</time></div></li>)}</ul>
        {!events.rows.length&&<p className="empty">No events yet.</p>}
      </section>
      <section className="card card-pad reveal" style={{'--i':8} as React.CSSProperties}>
        <SectionHeader title="Audit trail" note="Who changed what, when and why"/>
        <ul className="timeline">{audits.rows.map((a:any)=><li key={a.id}><i className="blue" aria-hidden="true"/><div><b>{a.action.replace(/_/g,' ')}</b><p>{a.actor||'System'} · {a.reason||'No note'}</p><time className="num">{displayDate(a.created_at)}</time></div></li>)}</ul>
        {!audits.rows.length&&<p className="empty">No audit entries yet.</p>}
      </section>
    </div>
  </Shell>;
}
