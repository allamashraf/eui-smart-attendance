import {NextRequest,NextResponse} from 'next/server';
import {authorize,isError,jsonError,parsePost} from '@/lib/security';
import {transaction} from '@/lib/db';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await authorize(req,'admin');if(isError(user))return user;
  const b=await parsePost(req);if(isError(b))return b;
  const outcome=String(b.outcome||'');const notes=String(b.notes||'').trim();const {id}=await params;
  if(!['approved','rejected'].includes(outcome)||notes.length<8||notes.length>500)return jsonError('Choose a decision and write a short note (8–500 characters).');
  const result=await transaction(async db=>{
    const r=await db.query(`SELECT * FROM correction_requests WHERE id=$1 AND status='pending' FOR UPDATE`,[id]);
    if(!r.rowCount)return {error:'Request already reviewed or not found.'};
    const c=r.rows[0];
    if(outcome==='approved') {
      await db.query(`INSERT INTO attendance_records(student_id,session_id,status,method,added_by,manual_reason)
        VALUES($1,$2,'manual','manual',$3,$4) ON CONFLICT(student_id,session_id) DO NOTHING`,[c.student_id,c.session_id,user.id,`Approved correction: ${c.reason}`]);
    }
    await db.query(`UPDATE correction_requests SET status=$1,reviewer_id=$2,review_note=$3,reviewed_at=now() WHERE id=$4`,[outcome,user.id,notes,id]);
    await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,'correction_reviewed','correction_request',$2,$3)`,[user.id,id,`${outcome}: ${notes}`]);
    return {ok:true};
  });
  return 'error' in result?jsonError(result.error!,409):NextResponse.json(result);
}
