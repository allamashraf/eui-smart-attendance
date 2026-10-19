import {Users,BookOpen,ClipboardCheck,ShieldAlert} from 'lucide-react';
import {requireUser} from '@/lib/auth';import {query} from '@/lib/db';
import {Shell,Stat,SectionHeader,displayDate} from '@/components/Shell';
import {Tip} from '@/components/Tip';
import {AdminConsole} from './AdminConsole';
export const dynamic='force-dynamic';
export default async function AdminPage(){const user=await requireUser('admin');
  const [counts,classes,students,instructors,corrections,events,audits]=await Promise.all([
    query(`SELECT (SELECT count(*)::int FROM users WHERE role='student') students,
      (SELECT count(*)::int FROM subjects) classes,
      (SELECT count(*)::int FROM attendance_records) checkins`),
    query(`SELECT sub.id,sub.code,sub.title,sub.term,sub.room,u.full_name AS instructor,
      (SELECT COUNT(*)::int FROM enrollments WHERE subject_id=sub.id AND status='active') enrolled
      FROM subjects sub JOIN users u ON u.id=sub.instructor_id ORDER BY sub.code`),
    query(`SELECT id,full_name,username FROM users WHERE role='student' AND active=true ORDER BY full_name`),
    query(`SELECT id,full_name FROM users WHERE role='instructor' AND active=true ORDER BY full_name`),
    query(`SELECT c.*,u.full_name AS student,sub.code,s.title AS session_title
      FROM correction_requests c JOIN users u ON u.id=c.student_id JOIN class_sessions s ON s.id=c.session_id
      JOIN subjects sub ON sub.id=s.subject_id ORDER BY (c.status='pending') DESC,c.created_at DESC LIMIT 25`),
    query(`SELECT ev.*,u.full_name AS actor FROM security_events ev LEFT JOIN users u ON u.id=ev.user_id
      ORDER BY ev.created_at DESC LIMIT 15`),
    query(`SELECT a.*,u.full_name AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id
      ORDER BY a.created_at DESC LIMIT 15`)
  ]);
  const s=counts.rows[0];
  const correctionRows=corrections.rows.map((c:any)=>({id:c.id,student:c.student,code:c.code,session:c.session_title,reason:c.reason,status:c.status,created:displayDate(c.created_at)}));
  return <Shell user={user} active="/admin" heading="Control center">
    <div className="grid grid-4">
      <Stat i={1} label="Students" value={s.students} Icon={Users}/>
      <Stat i={2} label="Classes" value={s.classes} Icon={BookOpen}/>
      <Stat i={3} label="Records" value={s.checkins} Icon={ClipboardCheck}/>
      <Stat i={4} label="Instructors" value={instructors.rows.length} Icon={Users}/>
    </div>
    <div className="alert alert-warn section reveal" style={{'--i':5} as React.CSSProperties}><ShieldAlert size={18} aria-hidden="true"/><span className="inline-gap"><b>Instructor alerts are reviewed on each instructor's dashboard.</b><Tip text="Scores only set the order of human review. Shared campus IPs alone never create an alert."/></span></div>
    <section className="card card-pad section reveal" style={{'--i':6} as React.CSSProperties}>
      <AdminConsole instructors={instructors.rows} students={students.rows} classes={classes.rows} corrections={correctionRows}/>
    </section>
    <div className="grid grid-2 section">
      <section className="card card-pad reveal" style={{'--i':7} as React.CSSProperties}>
        <SectionHeader title="Security events"/>
        <ul className="timeline">{events.rows.map((e:any)=><li key={e.id}><i aria-hidden="true"/><div><b>{e.type.replace(/_/g,' ')}</b><p>{e.actor||'Unknown'}</p><time>{displayDate(e.created_at)}</time></div></li>)}</ul>
        {!events.rows.length&&<p className="empty">No events.</p>}
      </section>
      <section className="card card-pad reveal" style={{'--i':8} as React.CSSProperties}>
        <SectionHeader title="Audit trail"/>
        <ul className="timeline">{audits.rows.map((a:any)=><li key={a.id}><i className="blue" aria-hidden="true"/><div><b>{a.action.replace(/_/g,' ')}</b><p>{a.actor||'System'} · {a.reason||'No note'}</p><time>{displayDate(a.created_at)}</time></div></li>)}</ul>
        {!audits.rows.length&&<p className="empty">No entries.</p>}
      </section>
    </div>
  </Shell>;
}
