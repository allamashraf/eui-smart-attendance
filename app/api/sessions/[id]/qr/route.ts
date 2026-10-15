import {NextRequest,NextResponse} from 'next/server';
import {authorize,isError,isUuid,jsonError,parsePost} from '@/lib/security';
import {transaction} from '@/lib/db';
// Closes or reopens the QR. Closed: no new codes are issued and scans are refused, but the session
// stays active, so the instructor can still add students manually. "End session" is separate.
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await authorize(req,'instructor');if(isError(user))return user;
  const body=await parsePost(req);if(isError(body))return body;
  const {id}=await params;
  if(!isUuid(id))return jsonError('Session not found.',404);
  if(typeof body.open!=='boolean')return jsonError('Send {"open": true} or {"open": false}.');
  const open:boolean=body.open;
  const result=await transaction(async db=>{
    const r=await db.query(`SELECT s.qr_open FROM class_sessions s JOIN subjects sub ON sub.id=s.subject_id
      WHERE s.id=$1 AND sub.instructor_id=$2 AND s.state='active' FOR UPDATE OF s`,[id,user.id]);
    if(!r.rowCount)return null;
    if(r.rows[0].qr_open!==open){ // pressing the same button twice changes and audits nothing
      await db.query(`UPDATE class_sessions SET qr_open=$2 WHERE id=$1`,[id,open]);
      await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,$2,'class_session',$3,$4)`,
        [user.id,open?'qr_reopened':'qr_closed',id,open?'Instructor reopened the QR':'Instructor closed the QR']);
    }
    return {ok:true,qrOpen:open};
  });
  if(!result)return jsonError('Session not found or already ended.',404);
  return NextResponse.json(result);
}
