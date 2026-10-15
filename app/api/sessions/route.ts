import { NextRequest, NextResponse } from 'next/server';
import { authorize, isError, jsonError, parsePost } from '@/lib/security';
import { query, transaction } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await authorize(req,'instructor'); if (isError(user)) return user;
  const body = await parsePost(req); if (isError(body)) return body;
  const subjectId = String(body.subjectId || '');
  const title = String(body.title || '').trim().slice(0,120);
  if (!title || !/^[0-9a-f-]{36}$/.test(subjectId)) return jsonError('Choose a class and a session title.');
  const result = await transaction(async db => {
    const owns = await db.query('SELECT id,room FROM subjects WHERE id=$1 AND instructor_id=$2', [subjectId,user.id]);
    if (!owns.rowCount) return null;
    const record = await db.query(`INSERT INTO class_sessions(subject_id,title,room)
      VALUES($1,$2,$3) RETURNING id`,[subjectId,title,owns.rows[0].room]);
    await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason)
      VALUES($1,'session_started','class_session',$2,$3)`,[user.id,record.rows[0].id,title]);
    return record.rows[0].id;
  });
  if (!result) return jsonError('You are not assigned to this class.',403);
  return NextResponse.json({id:result});
}
