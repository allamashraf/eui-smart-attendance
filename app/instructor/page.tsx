import Link from 'next/link';
import {ArrowRight,BookOpen,Radio,Users} from 'lucide-react';
import {requireUser} from '@/lib/auth';import {query} from '@/lib/db';
import {Shell,Stat,SectionHeader,StateBadge,displayDate} from '@/components/Shell';
import {QR} from '@/lib/config';
import {StartSessionForm} from './StartSessionForm';
export const dynamic='force-dynamic';
export default async function InstructorPage(){const user=await requireUser('instructor');
  const [classes,sessions,count]=await Promise.all([
    query(`SELECT sub.*,(SELECT count(*)::int FROM enrollments e WHERE e.subject_id=sub.id AND e.status='active') AS students
      FROM subjects sub WHERE instructor_id=$1 ORDER BY sub.code`,[user.id]),
    query(`SELECT s.*,sub.code,(SELECT count(*)::int FROM attendance_records a WHERE a.session_id=s.id) AS attended
      FROM class_sessions s JOIN subjects sub ON sub.id=s.subject_id WHERE sub.instructor_id=$1 ORDER BY s.started_at DESC LIMIT 15`,[user.id]),
    query(`SELECT count(*)::int AS total FROM enrollments e JOIN subjects s ON s.id=e.subject_id WHERE s.instructor_id=$1 AND e.status='active'`,[user.id])
  ]);
  const active=sessions.rows.filter(s=>s.state==='active').length;
  return <Shell user={user} active="/instructor" heading={`Welcome, ${user.full_name}`} subtitle="Start a live session, show the code on the projector and follow check-ins as they happen.">
    <div className="grid grid-3 stats">
      <Stat i={1} label="Classes assigned" value={classes.rows.length} note="Teaching this term" Icon={BookOpen}/>
      <Stat i={2} label="Enrolled students" value={count.rows[0].total} note="Across your classes" Icon={Users}/>
      <Stat i={3} label="Active sessions" value={active} note="Check-ins in progress" Icon={Radio}/>
    </div>
    <div className="split section">
      <section className="card card-pad reveal" style={{'--i':4} as React.CSSProperties}>
        <SectionHeader title="Your classes" note="All sample classes are synthetic"/>
        <div>{classes.rows.map((c:any)=><div className="class-row" key={c.id}>
          <span className="class-code" aria-hidden="true">{c.code}</span>
          <div className="class-meta"><span className="row-title">{c.code} · {c.title}</span><span className="row-sub">{c.term} · {c.room}</span></div>
          <div className="class-count">{c.students}<small>students</small></div>
        </div>)}
        {!classes.rows.length&&<p className="empty">No classes assigned yet.</p>}</div>
      </section>
      <section className="card card-pad reveal" style={{'--i':5} as React.CSSProperties}>
        <SectionHeader title="Start a live session" note={`A new signed QR every ${QR.intervalSeconds} seconds`}/>
        <StartSessionForm classes={classes.rows.map((c:any)=>({id:c.id,label:`${c.code} — ${c.title}`}))}/>
      </section>
    </div>
    <section className="card card-pad section reveal" style={{'--i':6} as React.CSSProperties}>
      <SectionHeader title="Class sessions" note="Open a live session to show the QR and follow the roster"/>
      <div className="table-wrap"><table className="table" style={{minWidth:640}}>
        <thead><tr><th>Class</th><th>Session</th><th>Started</th><th>Check-ins</th><th>Status</th><th className="end"><span className="sr-only">Open</span></th></tr></thead>
        <tbody>{sessions.rows.map((s:any)=><tr key={s.id}>
          <td><b className="num">{s.code}</b></td>
          <td>{s.title}</td>
          <td><span className="num muted">{displayDate(s.started_at)}</span></td>
          <td><span className="num">{s.attended}</span></td>
          <td><StateBadge value={s.state}/></td>
          <td className="end"><Link className="link" href={`/instructor/session/${s.id}`}>{s.state==='active'?'Open live board':'View roster'}<ArrowRight size={15} aria-hidden="true"/></Link></td>
        </tr>)}
        {!sessions.rows.length&&<tr><td className="empty" colSpan={6}>Start a session to see it here.</td></tr>}</tbody>
      </table></div>
    </section>
  </Shell>;
}
