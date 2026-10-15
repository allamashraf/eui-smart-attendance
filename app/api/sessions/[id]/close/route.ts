import { NextRequest, NextResponse } from 'next/server';
import { authorize,isError,jsonError,parsePost } from '@/lib/security';
import { transaction } from '@/lib/db';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await authorize(req,'instructor'); if(isError(user)) return user;
  const body=await parsePost(req);if(isError(body))return body;
  const {id}=await params;
  const changed = await transaction(async db=>{
    const r=await db.query(`UPDATE class_sessions s SET state='ended', ended_at=now()
      FROM subjects sub WHERE s.id=$1 AND s.subject_id=sub.id AND sub.instructor_id=$2 AND s.state='active' RETURNING s.id`,[id,user.id]);
    if(r.rowCount) await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,'session_ended','class_session',$2,'Instructor ended session')`,[user.id,id]);
    return r.rowCount;
  });
  return changed ? NextResponse.json({ok:true}) : jsonError('Session not found or already ended.',404);
}
