import {NextRequest,NextResponse} from 'next/server';
import {authorize,isError,jsonError,parsePost,createAlert} from '@/lib/security';
import {transaction,query} from '@/lib/db';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await authorize(req,'instructor');if(isError(user))return user;
  const body=await parsePost(req);if(isError(body))return body;
  const studentId=String(body.studentId||'');const reason=String(body.reason||'').trim();const {id}=await params;
  if(!/^[0-9a-f-]{36}$/.test(studentId)||reason.length<10||reason.length>500)return jsonError('Choose a student and provide a reason (10–500 characters).');
  const result=await transaction(async db=>{
    const accessible=await db.query(`SELECT 1 FROM class_sessions s JOIN subjects sub ON sub.id=s.subject_id
      JOIN enrollments e ON e.subject_id=sub.id WHERE s.id=$1 AND sub.instructor_id=$2 AND e.student_id=$3 AND e.status='active' AND s.state='active'`,[id,user.id,studentId]);
    if(!accessible.rowCount)return {error:'Student not enrolled, session closed, or class not assigned.'};
    const r=await db.query(`INSERT INTO attendance_records(student_id,session_id,status,method,added_by,manual_reason,verification)
      VALUES($1,$2,'manual','manual',$3,$4,'manual') ON CONFLICT(student_id,session_id) DO NOTHING RETURNING id`,[studentId,id,user.id,reason]);
    if(!r.rowCount)return {error:'Attendance already exists.'};
    await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,'manual_checkin','attendance_record',$2,$3)`,[user.id,r.rows[0].id,reason]);
    return {ok:true};
  });
  if ('error' in result) return jsonError(result.error!,409);
  try {
    const count=await query(`SELECT COUNT(*)::int AS n FROM attendance_records WHERE session_id=$1 AND method='manual' AND added_by=$2`,[id,user.id]);
    if (count.rows[0].n >= 5) await createAlert(id,`R8_${user.id.slice(0,16)}`,15,
      'Unusually high manual attendance additions by an instructor. This requires administrative context review.',{rule:'R8',manual_additions:count.rows[0].n});
  } catch (err) {console.error('Optional risk monitor failed:',err);}
  return NextResponse.json(result);
}
