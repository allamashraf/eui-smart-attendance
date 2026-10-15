import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {query} from '@/lib/db';
import {isUuid} from '@/lib/security';
import {Projector} from './Projector';
export const dynamic='force-dynamic';
// Full-screen view for the classroom projector. Instructor only, own sessions only.
export default async function PresentPage({params}:{params:Promise<{id:string}>}){
  const user=await requireUser('instructor');const {id}=await params;
  if(!isUuid(id))notFound();
  const {rows}=await query(`SELECT s.title,s.room,s.state,sub.code FROM class_sessions s JOIN subjects sub ON sub.id=s.subject_id
    WHERE s.id=$1 AND sub.instructor_id=$2`,[id,user.id]);
  if(!rows.length)notFound();
  const s=rows[0];
  return <Projector sessionId={id} heading={`${s.code} · ${s.title}`} room={s.room} initiallyActive={s.state==='active'}/>;
}
