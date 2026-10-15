import Link from 'next/link';
import {BookOpen,CalendarDays,CheckCircle2,Clock3,ArrowUpRight,ScanLine} from 'lucide-react';
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
  return <Shell user={user} active="/student" heading={`Hello, ${user.full_name.split(' ')[0]} 👋`} subtitle="Here's your classes, attendance history, and upcoming check-ins.">
    <div className="stats-grid"><Stat label="Enrolled classes" value={s.classes} note="Current term" Icon={BookOpen}/><Stat label="Recorded check-ins" value={s.attended} note="Across your classes" Icon={CheckCircle2}/><Stat label="Late arrivals" value={s.late} note="Recorded separately" Icon={Clock3}/><Stat label="Active sessions" value={active.length} note="Ready to check in" Icon={ScanLine}/></div>
    {active.length>0&&<div className="feature-banner"><div><span className="banner-kicker"><span className="pulse-dot"/> SESSION IN PROGRESS</span><h2>{active[0].code} · {active[0].session_name}</h2><p>Scan your instructor's live QR code using your phone camera.</p></div><Link className="white-btn" href="/checkin">Open check-in <ArrowUpRight size={17}/></Link></div>}
    <div className="content-grid"><section className="panel"><SectionHeader title="Your classes" note="Assigned to your demo student account"/><div className="class-list">{subjects.rows.map((sub:any)=><div className="class-item" key={sub.id}><div className="class-icon"><BookOpen size={20}/></div><div className="class-text"><b>{sub.code} — {sub.title}</b><p>{sub.instructor_name} · {sub.room}</p><span>{sub.term}</span></div><div className="class-progress"><b>{sub.attended}/{sub.session_count}</b><small>Sessions recorded</small></div></div>)}</div></section>
    <section className="panel"><SectionHeader title="Check-in guidance" note="Secure by design, accessible by default"/><div className="howto"><div><span>01</span><p><b>Sign in</b><small>Your username identifies your demo student record.</small></p></div><div><span>02</span><p><b>Scan live QR</b><small>Scan the instructor's rotating code. It changes every {QR.intervalSeconds} seconds.</small></p></div><div><span>03</span><p><b>Get confirmation</b><small>One check-in per class session, enforced by PostgreSQL.</small></p></div></div><Link href="/checkin" className="secondary-btn">Open check-in screen <ArrowUpRight size={16}/></Link></section></div>
    <section className="panel"><SectionHeader title="Attendance history" note="Only you can see your records"/><div className="table-scroll"><table><thead><tr><th>Class</th><th>Session</th><th>Time</th><th>Status</th><th>Method</th></tr></thead><tbody>{history.rows.map((r:any)=><tr key={r.id}><td><b>{r.code}</b></td><td>{r.session_name}</td><td>{displayDate(r.checked_in_at)}</td><td><StateBadge value={r.status}/></td><td>{r.method==='qr'?'Rotating QR':'Manual / approved'}</td></tr>)}{history.rows.length===0&&<tr><td colSpan={5} className="empty-table">No check-ins yet. Your first attendance will appear here.</td></tr>}</tbody></table></div></section>
    <div className="content-grid"><section className="panel"><SectionHeader title="Request a correction" note="The administrator reviews every request"/><CorrectionForm sessions={sessions.rows.map((s:any)=>({id:s.id,label:`${s.code} — ${s.session_name}`}))}/></section><section className="panel"><SectionHeader title="Your requests" note="No automatic penalties or decisions"/>{corrections.rows.length?corrections.rows.map((c:any,i:number)=><div className="simple-row" key={i}><span>{c.code} · {c.session_name}</span><StateBadge value={c.status}/></div>):<p className="muted small">No correction requests submitted.</p>}<div className="privacy-tip"><CalendarDays size={19}/><span>Location and device signals are supporting evidence, never conclusive proof of absence or misconduct.</span></div></section></div>
  </Shell>;
}
