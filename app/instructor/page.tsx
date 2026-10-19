import {BookOpen,Radio,Users} from 'lucide-react';
import {requireUser} from '@/lib/auth';import {query} from '@/lib/db';
import {Shell,Stat,SectionHeader,displayDate} from '@/components/Shell';
import {StartSessionForm} from './StartSessionForm';
import {SessionList} from './SessionList';
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
  return <Shell user={user} active="/instructor" heading="My classes">
    <div className="grid grid-3 stats">
      <Stat i={1} label="Classes" value={classes.rows.length} Icon={BookOpen}/>
      <Stat i={2} label="Students" value={count.rows[0].total} Icon={Users}/>
      <Stat i={3} label="Live now" value={active} Icon={Radio}/>
    </div>
    <div className="split section">
      <section className="card card-pad reveal" style={{'--i':4} as React.CSSProperties}>
        <SectionHeader title="Classes"/>
        <div>{classes.rows.map((c:any)=><div className="class-row" key={c.id}>
          <span className="class-code" aria-hidden="true">{c.code}</span>
          <div className="class-meta"><span className="row-title">{c.title}</span><span className="row-sub">{c.room} · {c.term}</span></div>
          <div className="class-count">{c.students}<small>students</small></div>
        </div>)}
        {!classes.rows.length&&<p className="empty">No classes yet.</p>}</div>
      </section>
      <section className="card card-pad reveal" style={{'--i':5} as React.CSSProperties}>
        <SectionHeader title="Start a session"/>
        <StartSessionForm classes={classes.rows.map((c:any)=>({id:c.id,label:`${c.code} — ${c.title}`}))}/>
      </section>
    </div>
    <section className="card card-pad section reveal" style={{'--i':6} as React.CSSProperties}>
      <SectionHeader title="Sessions"/>
      <SessionList rows={sessions.rows.map((s:any)=>({id:s.id,code:s.code,title:s.title,started:displayDate(s.started_at),attended:s.attended,state:s.state}))}/>
    </section>
  </Shell>;
}
