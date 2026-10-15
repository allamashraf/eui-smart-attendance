import { NextRequest, NextResponse } from 'next/server';
import { authorize,isError,jsonError,parsePost } from '@/lib/security';
import { transaction } from '@/lib/db';
export async function POST(req:NextRequest) {
  const user=await authorize(req,'admin');if(isError(user))return user;
  const b=await parsePost(req);if(isError(b))return b;
  const code=String(b.code||'').trim().toUpperCase().slice(0,32);
  const title=String(b.title||'').trim().slice(0,160);
  const term=String(b.term||'').trim().slice(0,80);
  const room=String(b.room||'').trim().slice(0,100);
  const instructorId=String(b.instructorId||'');
  if(!/^[A-Z0-9_-]{2,32}$/.test(code)||!title||!term)return jsonError('Class code, title and term are required.');
  const result=await transaction(async db=>{
    const exists=await db.query(`SELECT 1 FROM users WHERE id=$1 AND role='instructor'`,[instructorId]);
    if(!exists.rowCount)return {error:'Select an instructor.'};
    const record=await db.query(`INSERT INTO subjects(code,title,term,room,instructor_id) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(code,term) DO NOTHING RETURNING id`,[code,title,term,room,instructorId]);
    if(!record.rowCount)return {error:'A class with this code and term already exists.'};
    await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,'class_created','subject',$2,$3)`,[user.id,record.rows[0].id,`${code} ${term}`]);
    return {ok:true};
  });
  return 'error' in result?jsonError(result.error!,409):NextResponse.json(result);
}
