import Link from 'next/link';
import {ArrowRight,BookOpen,CheckCircle2,Clock3,ScanLine,ShieldCheck} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {query} from '@/lib/db';
import {Shell,Stat,SectionHeader,StateBadge,displayDate} from '@/components/Shell';
import {QR} from '@/lib/config';
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
  return <Shell user={user} active="/student" heading={`Hello, ${user.full_name.split(' ')[0]}`} subtitle="Your classes, check-ins and attendance history in one place.">
    {active.length>0&&<section className="live-hero reveal" style={{'--i':1} as React.CSSProperties} aria-label="Session in progress">
      <div className="live-hero-copy">
        <span className="eyebrow eyebrow-light"><span className="live-dot mint"/>Session in progress</span>
        <h2>{active[0].code} · {active[0].session_name}</h2>
        <p>Open check-in and scan the live code on your instructor’s screen with the camera inside this website.</p>
      </div>
      <Link className="btn btn-light btn-lg" href="/checkin"><ScanLine size={18} aria-hidden="true"/>Check in now<ArrowRight size={17} className="arrow" aria-hidden="true"/></Link>
    </section>}

    <div className="grid grid-4">
      <Stat i={2} label="Enrolled classes" value={s.classes} note="Current term" Icon={BookOpen}/>
      <Stat i={3} label="Recorded check-ins" value={s.attended} note="Across your classes" Icon={CheckCircle2}/>
      <Stat i={4} label="Late arrivals" value={s.late} note="Recorded separately" Icon={Clock3}/>
      <Stat i={5} label="Active sessions" value={active.length} note="Ready to check in" Icon={ScanLine}/>
    </div>

    <div className="split section">
      <section className="card card-pad reveal" style={{'--i':6} as React.CSSProperties}>
        <SectionHeader title="Your classes" note="Sessions recorded for you in each class"/>
        <div>{subjects.rows.map((sub:any,i:number)=><div className="class-row" key={sub.id}>
          <span className="class-code" aria-hidden="true">{sub.code}</span>
          <div className="class-meta">
            <span className="row-title">{sub.code} · {sub.title}</span>
            <span className="row-sub">{sub.instructor_name} · {sub.room} · {sub.term}</span>
            <div className="meter" aria-hidden="true"><span style={{width:`${sub.session_count?Math.min(100,100*sub.attended/sub.session_count):0}%`,'--i':i} as React.CSSProperties}/></div>
          </div>
          <div className="class-count">{sub.attended}<span className="muted">/{sub.session_count}</span><small>recorded</small></div>
        </div>)}
        {!subjects.rows.length&&<p className="empty">You are not enrolled in any class yet.</p>}</div>
      </section>
      <section className="card card-pad reveal" style={{'--i':7} as React.CSSProperties}>
        <SectionHeader title="How check-in works" note="Fast, private and checked by the server"/>
        <ol className="steps">
          <li><span className="step-n">01</span><div><b>Open check-in</b><span>Allow location and the camera on this website.</span></div></li>
          <li><span className="step-n">02</span><div><b>Scan the live code</b><span>The code on the screen changes every <span className="num">{QR.intervalSeconds}</span> seconds.</span></div></li>
          <li><span className="step-n">03</span><div><b>See your result</b><span>One check-in per session, enforced by the database.</span></div></li>
        </ol>
        <Link href="/checkin" className="btn btn-secondary btn-block" style={{marginTop:16}}>Open check-in<ArrowRight size={16} className="arrow" aria-hidden="true"/></Link>
      </section>
    </div>

    <section className="card card-pad section reveal" style={{'--i':8} as React.CSSProperties}>
      <SectionHeader title="Attendance history" note="Only you can see your records"/>
      <div className="table-wrap"><table className="table history-table">
        <thead><tr><th>Class</th><th>Session</th><th>Time</th><th>Status</th><th className="end">Method</th></tr></thead>
        <tbody>{history.rows.map((r:any)=><tr key={r.id}>
          <td data-label="Class"><b className="num">{r.code}</b></td>
          <td data-label="Session">{r.session_name}</td>
          <td data-label="Time"><span className="num muted">{displayDate(r.checked_in_at)}</span></td>
          <td data-label="Status"><StateBadge value={r.status}/></td>
          <td data-label="Method" className="end muted">{r.method==='qr'?'Rotating QR':'Manual / approved'}</td>
        </tr>)}
        {history.rows.length===0&&<tr><td colSpan={5} className="empty">No check-ins yet. Your first attendance will appear here.</td></tr>}</tbody>
      </table></div>
    </section>

    <div className="split section">
      <section className="card card-pad reveal" style={{'--i':9} as React.CSSProperties}>
        <SectionHeader title="Request a correction" note="The administrator reviews every request"/>
        <CorrectionForm sessions={sessions.rows.map((s:any)=>({id:s.id,label:`${s.code} — ${s.session_name}`}))}/>
      </section>
      <section className="card card-pad reveal" style={{'--i':10} as React.CSSProperties}>
        <SectionHeader title="Your requests" note="No automatic penalties or decisions"/>
        <div className="rows">{corrections.rows.map((c:any,i:number)=><div className="row" key={i}><span className="row-title">{c.code} · {c.session_name}</span><StateBadge value={c.status}/></div>)}</div>
        {!corrections.rows.length&&<p className="muted small">No correction requests submitted.</p>}
        <div className="privacy-tip"><ShieldCheck size={18} aria-hidden="true"/><span>Location and device signals are supporting evidence, never conclusive proof of absence or misconduct.</span></div>
      </section>
    </div>
  </Shell>;
}
