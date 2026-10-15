import {NextRequest,NextResponse} from 'next/server';
import {authorize,isError,isUuid,jsonError,parsePost} from '@/lib/security';
import {transaction} from '@/lib/db';
// The instructor's review of one student's record: "confirm" a needs-review record, or "absent"
// (removes the record). Both need a reason and are audited. Review also works after the session
// has ended, because needs-review records are often checked after class.
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await authorize(req,'instructor');if(isError(user))return user;
  const body=await parsePost(req);if(isError(body))return body;
  const {id}=await params;
  const studentId=String(body.studentId||'');const action=String(body.action||'');const reason=String(body.reason||'').trim();
  if(!isUuid(id)||!isUuid(studentId)||!['confirm','absent'].includes(action))return jsonError('Choose a student and an action.');
  if(reason.length<10||reason.length>500)return jsonError('Give a reason (10–500 characters).');
  const result=await transaction(async db=>{
    const r=await db.query(`SELECT ar.id,ar.status,ar.method,ar.verification,ar.location_result,ar.distance_m FROM attendance_records ar
      JOIN class_sessions s ON s.id=ar.session_id JOIN subjects sub ON sub.id=s.subject_id
      WHERE ar.session_id=$1 AND ar.student_id=$2 AND sub.instructor_id=$3 FOR UPDATE OF ar`,[id,studentId,user.id]);
    if(!r.rowCount)return {error:'This student has no attendance record in your session.'};
    const rec=r.rows[0];
    if(action==='confirm'){
      if(rec.verification!=='needs_review')return {error:'Only a record that needs review can be confirmed.'};
      await db.query(`UPDATE attendance_records SET verification='verified' WHERE id=$1`,[rec.id]);
      await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason,details) VALUES($1,'attendance_confirmed','attendance_record',$2,$3,$4::jsonb)`,
        [user.id,rec.id,reason,JSON.stringify({student_id:studentId,session_id:id,location_result:rec.location_result,distance_m:rec.distance_m})]);
      return {ok:true};
    }
    await db.query(`DELETE FROM attendance_records WHERE id=$1`,[rec.id]);
    await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason,details) VALUES($1,'attendance_marked_absent','attendance_record',$2,$3,$4::jsonb)`,
      [user.id,rec.id,reason,JSON.stringify({student_id:studentId,session_id:id,removed:rec})]);
    // Remembered, so the student cannot simply scan again while the QR is still open.
    // A real mistake is fixed with a correction request (or a manual add by the instructor).
    await db.query(`INSERT INTO security_events(user_id,session_id,type,details) VALUES($1,$2,'marked_absent',$3::jsonb)`,[studentId,id,JSON.stringify({by:user.id})]);
    return {ok:true};
  });
  return 'error' in result?jsonError(result.error!,409):NextResponse.json(result);
}
