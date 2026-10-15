import Link from 'next/link';
import {ArrowLeft,BookOpen,Users,ScanLine} from 'lucide-react';
import {notFound} from 'next/navigation';import {requireUser} from '@/lib/auth';import {query} from '@/lib/db';
import {Shell,Stat,SectionHeader,StateBadge,displayDate} from '@/components/Shell';
import {QR} from '@/lib/config';
import {LiveBoard} from './LiveBoard';
export const dynamic='force-dynamic';
export default async function SessionPage({params}:{params:Promise<{id:string}>}){
  const user=await requireUser('instructor');const {id}=await params;
  const {rows}=await query(`SELECT s.*,sub.code,sub.title AS class_title,
    (SELECT COUNT(*)::int FROM attendance_records WHERE session_id=s.id) AS attended
    FROM class_sessions s JOIN subjects sub ON sub.id=s.subject_id WHERE s.id=$1 AND sub.instructor_id=$2`,[id,user.id]);
  if(!rows.length)notFound();const session=rows[0];
  const roster=await query(`SELECT u.id,u.full_name,u.student_number,ar.status,ar.checked_in_at,ar.method
    FROM enrollments e JOIN users u ON u.id=e.student_id LEFT JOIN attendance_records ar ON ar.student_id=u.id AND ar.session_id=$2
    WHERE e.subject_id=$1 AND e.status='active' ORDER BY u.full_name`,[session.subject_id,id]);
  return <Shell user={user} active="/instructor" heading={`${session.code} · ${session.title}`} subtitle={`${session.class_title} · ${session.room} · Started ${displayDate(session.started_at)}`}>
    <Link className="back-link" href="/instructor"><ArrowLeft size={17}/> Back to classes</Link>
    <div className="stats-grid three-cols"><Stat label="Total students" value={roster.rows.length} note="Enrolled in this class" Icon={Users}/><Stat label="Checked in" value={session.attended} note="Real database records" Icon={ScanLine}/><Stat label="Course" value={session.code} note={session.room} Icon={BookOpen}/></div>
    <div className="content-grid session-grid"><section className="panel"><SectionHeader title="Live attendance QR" note={`Server-issued · changes every ${QR.intervalSeconds} seconds`} aside={<StateBadge value={session.state}/>}/><LiveBoard sessionId={id} active={session.state==='active'} roster={roster.rows.map((r:any)=>({id:r.id,label:r.full_name}))}/></section>
    <section className="panel"><SectionHeader title="Student roster" note="Refresh this page for updated check-in details"/><div className="roster-list">{roster.rows.map((r:any)=><div className="simple-row" key={r.id}><span><b>{r.full_name}</b><small>{r.student_number||'Demo student'}</small></span>{r.status?<StateBadge value={r.status}/>:<span className="muted">Not yet</span>}</div>)}</div></section></div>
  </Shell>;
}
