import Link from 'next/link';
import {BookOpen,Users,Radio,ClipboardCheck,ArrowUpRight} from 'lucide-react';
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
  return <Shell user={user} active="/instructor" heading={`Welcome, ${user.full_name}`} subtitle="Manage your classes, launch live QR sessions, and support your students.">
    <div className="stats-grid three-cols"><Stat label="Classes assigned" value={classes.rows.length} note="Teaching this term" Icon={BookOpen}/><Stat label="Enrolled students" value={count.rows[0].total} note="Across your classes" Icon={Users}/><Stat label="Active sessions" value={active} note="Check-ins in progress" Icon={Radio}/></div>
    <div className="content-grid"><section className="panel"><SectionHeader title="Your classes" note="All sample classes are synthetic"/>{classes.rows.map((c:any)=><div className="class-item" key={c.id}><div className="class-icon"><BookOpen size={22}/></div><div className="class-text"><b>{c.code} — {c.title}</b><p>{c.term} · {c.room}</p></div><div className="class-progress"><b>{c.students}</b><small>Students</small></div></div>)}{!classes.rows.length&&<p className="muted">No classes assigned yet.</p>}</section><section className="panel"><SectionHeader title="Start a new session" note={`The server generates a new secure QR every ${QR.intervalSeconds} seconds`}/><StartSessionForm classes={classes.rows.map((c:any)=>({id:c.id,label:`${c.code} — ${c.title}`}))}/></section></div>
    <section className="panel"><SectionHeader title="Class sessions" note="Select a live session to display the QR and roster"/><div className="table-scroll"><table><thead><tr><th>Class</th><th>Session</th><th>Started</th><th>Check-ins</th><th>Status</th><th></th></tr></thead><tbody>{sessions.rows.map((s:any)=><tr key={s.id}><td><b>{s.code}</b></td><td>{s.title}</td><td>{displayDate(s.started_at)}</td><td>{s.attended}</td><td><StateBadge value={s.state}/></td><td><Link className="table-link" href={`/instructor/session/${s.id}`}>{s.state==='active'?'Open live board':'View roster'} <ArrowUpRight size={15}/></Link></td></tr>)}{!sessions.rows.length&&<tr><td className="empty-table" colSpan={6}>Start a session to see it here.</td></tr>}</tbody></table></div></section>
  </Shell>;
}
