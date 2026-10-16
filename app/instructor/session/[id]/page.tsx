import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {notFound} from 'next/navigation';import {requireUser} from '@/lib/auth';import {query} from '@/lib/db';
import {Shell,displayDate} from '@/components/Shell';
import {isUuid} from '@/lib/security';
import {LiveBoard} from './LiveBoard';
export const dynamic='force-dynamic';
// The roster, counts and QR are loaded and kept up to date by LiveBoard (GET /live every 2 s).
export default async function SessionPage({params}:{params:Promise<{id:string}>}){
  const user=await requireUser('instructor');const {id}=await params;
  if(!isUuid(id))notFound();
  const {rows}=await query(`SELECT s.id,s.title,s.room,s.state,s.started_at,sub.code,sub.title AS class_title
    FROM class_sessions s JOIN subjects sub ON sub.id=s.subject_id WHERE s.id=$1 AND sub.instructor_id=$2`,[id,user.id]);
  if(!rows.length)notFound();const session=rows[0];
  return <Shell user={user} active="/instructor" heading={`${session.code} · ${session.title}`} subtitle={`${session.class_title} · ${session.room} · Started ${displayDate(session.started_at)}`}>
    <Link className="back-link" href="/instructor"><ArrowLeft size={17}/> Back to classes</Link>
    <LiveBoard sessionId={id} initiallyActive={session.state==='active'}/>
  </Shell>;
}
