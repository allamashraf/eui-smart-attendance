import { NextRequest,NextResponse } from 'next/server';
import {authorize,isError,jsonError,parsePost} from '@/lib/security';
import {transaction} from '@/lib/db';
export async function POST(req:NextRequest) {
  const user=await authorize(req,'student');if(isError(user))return user;
  const b=await parsePost(req);if(isError(b))return b;
  const sessionId=String(b.sessionId||''); const reason=String(b.reason||'').trim();
  if(reason.length<10||reason.length>500)return jsonError('Provide a reason between 10 and 500 characters.');
  const result=await transaction(async db=>{
    const r=await db.query(`SELECT 1 FROM class_sessions s JOIN enrollments e ON e.subject_id=s.subject_id
      WHERE s.id=$1 AND e.student_id=$2 AND e.status='active'`,[sessionId,user.id]);
    if(!r.rowCount)return {error:'You are not enrolled in this session.'};
    const record=await db.query(`INSERT INTO correction_requests(student_id,session_id,reason) VALUES($1,$2,$3)
      ON CONFLICT(student_id,session_id) DO NOTHING RETURNING id`,[user.id,sessionId,reason]);
    if(!record.rowCount)return {error:'You already requested a correction for this session.'};
    await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,'correction_requested','correction_request',$2,$3)`,[user.id,record.rows[0].id,reason]);
    return {ok:true};
  });
  return 'error'in result?jsonError(result.error!,409):NextResponse.json(result);
}
