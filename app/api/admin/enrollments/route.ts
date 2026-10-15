import {NextRequest,NextResponse} from 'next/server';
import {authorize,isError,jsonError,parsePost} from '@/lib/security';
import {transaction} from '@/lib/db';
export async function POST(req:NextRequest) {
  const user=await authorize(req,'admin');if(isError(user))return user;
  const b=await parsePost(req);if(isError(b))return b;
  const studentId=String(b.studentId||''); const subjectId=String(b.subjectId||'');
  const result=await transaction(async db=>{
    const u=await db.query(`SELECT 1 FROM users WHERE id=$1 AND role='student'`,[studentId]);
    const s=await db.query(`SELECT 1 FROM subjects WHERE id=$1`,[subjectId]);
    if(!u.rowCount||!s.rowCount)return {error:'Choose a valid student and class.'};
    await db.query(`INSERT INTO enrollments(subject_id,student_id) VALUES($1,$2)
      ON CONFLICT(subject_id,student_id) DO UPDATE SET status='active'`,[subjectId,studentId]);
    await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,'student_enrolled','subject',$2,$3)`,[user.id,subjectId,`Demo student ${studentId} enrolled`]);
    return {ok:true};
  });
  return 'error' in result?jsonError(result.error!,400):NextResponse.json(result);
}
