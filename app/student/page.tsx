import Link from 'next/link';
import {ArrowRight,BookOpen,CheckCircle2,Clock3,ScanLine} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {query} from '@/lib/db';
import {Shell,Stat,SectionHeader,StateBadge,displayDate} from '@/components/Shell';
import {CorrectionForm} from './CorrectionForm';
export const dynamic='force-dynamic';
export default async function StudentPage(){const user=await requireUser('student');
  const [subjects,summary,history,sessions,corrections]=await Promise.all([
    query(`SELECT sub.*,u.full_name as instructor_name,
      (SELECT count(*)::int FROM class_sessions WHERE subject_id=sub.id) as session_count,
      (SELECT count(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.session_id WHERE ar.student_id=$1 AND cs.subject_id=sub.id) as attended
      FROM subjects sub JOIN enrollments e ON e.subject_id=sub.id JOIN users u ON u.id=sub.instructor_id
      WHERE e.student_id=$1 AND e.status='active' ORDER BY sub.code`,[user.id]),
    query(`SELECT (SELECT count(*)::int FROM attendance_records WHERE student_id=$1) AS attended,
      (SELECT count(*)::int FROM attendance_records WHERE student_id=$1 AND status='late') AS late,
      (SELECT count(*)::int FROM enrollments WHERE student_id=$1 AND status='active') AS classes`,[user.id]),
    query(`SELECT ar.*,s.title as session_name,sub.code,sub.title as subject_title
      FROM attendance_records ar JOIN class_sessions s ON s.id=ar.session_id JOIN subjects sub ON sub.id=s.subject_id
      WHERE ar.student_id=$1 ORDER BY ar.checked_in_at DESC LIMIT 12`,[user.id]),
    query(`SELECT s.id,s.title as session_name,s.state,s.started_at,sub.code FROM class_sessions s JOIN subjects sub ON sub.id=s.subject_id
      JOIN enrollments e ON e.subject_id=sub.id WHERE e.student_id=$1 AND e.status='active' ORDER BY s.started_at DESC LIMIT 20`,[user.id]),
    query(`SELECT c.status,s.title as session_name,sub.code FROM correction_requests c JOIN class_sessions s ON s.id=c.session_id
      JOIN subjects sub ON sub.id=s.subject_id WHERE c.student_id=$1 ORDER BY c.created_at DESC LIMIT 5`,[user.id])
  ]);
  const s=summary.rows[0];const active=sessions.rows.filter(x=>x.state==='active');
  return <Shell user={user} active="/student" heading={`Hello, ${user.full_name.split(' ')[0]}`}>
    {active.length>0&&<section className="live-hero reveal" style={{'--i':1} as React.CSSProperties} aria-label="Session in progress">
      <div className="live-hero-copy">
        <span className="eyebrow eyebrow-light"><span className="live-dot mint"/>Live now</span>
        <h2>{active[0].code} · {active[0].session_name}</h2>
      </div>
      <Link className="btn btn-light btn-lg" href="/checkin"><ScanLine size={18} aria-hidden="true"/>Check in<ArrowRight size={17} className="arrow" aria-hidden="true"/></Link>
    </section>}

    <div className="grid grid-3 stats">
      <Stat i={2} label="Classes" value={s.classes} Icon={BookOpen}/>
      <Stat i={3} label="Check-ins" value={s.attended} Icon={CheckCircle2}/>
      <Stat i={4} label="Late" value={s.late} Icon={Clock3}/>
    </div>

    <div className="split section">
      <section className="card card-pad reveal" style={{'--i':6} as React.CSSProperties}>
        <SectionHeader title="Classes"/>
        <div>{subjects.rows.map((sub:any,i:number)=><div className="class-row" key={sub.id}>
          <span className="class-code" aria-hidden="true">{sub.code}</span>
          <div className="class-meta">
            <span className="row-title">{sub.title}</span>
            <span className="row-sub">{sub.instructor_name} · {sub.room}</span>
            <div className="meter" aria-hidden="true"><span style={{width:`${sub.session_count?Math.min(100,100*sub.attended/sub.session_count):0}%`,'--i':i} as React.CSSProperties}/></div>
          </div>
          <div className="class-count" aria-label={`${sub.attended} of ${sub.session_count} sessions`}>{sub.attended}<span className="muted">/{sub.session_count}</span></div>
        </div>)}
        {!subjects.rows.length&&<p className="empty">No classes yet.</p>}</div>
      </section>
      <section className="card card-pad reveal" style={{'--i':7} as React.CSSProperties}>
        <SectionHeader title="History"/>
        <div className="rows">{history.rows.map((r:any)=><div className="record" key={r.id}>
          <div className="record-main"><b>{r.code} · {r.session_name}</b><time className="mono">{displayDate(r.checked_in_at)}</time></div>
          <StateBadge value={r.status}/>
        </div>)}</div>
        {history.rows.length===0&&<div className="empty stack" style={{gap:12,alignItems:'center'}}><span>No check-ins yet.</span><Link href="/checkin" className="btn btn-secondary btn-sm">Check in</Link></div>}
      </section>
    </div>

    <div className="split section">
      <section className="card card-pad reveal" style={{'--i':8} as React.CSSProperties}>
        <SectionHeader title="Request a correction"/>
        <CorrectionForm sessions={sessions.rows.map((s:any)=>({id:s.id,label:`${s.code} — ${s.session_name}`}))}/>
      </section>
      <section className="card card-pad reveal" style={{'--i':9} as React.CSSProperties}>
        <SectionHeader title="Requests"/>
        <div className="rows">{corrections.rows.map((c:any,i:number)=><div className="record" key={i}><div className="record-main"><b>{c.code} · {c.session_name}</b></div><StateBadge value={c.status}/></div>)}</div>
        {!corrections.rows.length&&<p className="empty">No requests.</p>}
      </section>
    </div>
  </Shell>;
}
