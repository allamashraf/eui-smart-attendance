import {NextRequest,NextResponse} from 'next/server';
import {authorize,isError,isUuid,jsonError,parsePost} from '@/lib/security';
import {transaction} from '@/lib/db';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await authorize(req,'instructor');if(isError(user))return user;
 const body=await parsePost(req);if(isError(body))return body;
 const {id}=await params;
 const outcome=String(body.outcome||'');
 const notes=String(body.notes||'').trim();
 if(!isUuid(id))return jsonError('Not found',404);
 if(!['legitimate','inconclusive','confirmed'].includes(outcome)||notes.length<10||notes.length>1000)
   return jsonError('Select an outcome and provide 10–1000 characters of notes.');
 const result=await transaction(async db=>{
   const alert=await db.query(`SELECT a.id FROM risk_alerts a
     JOIN class_sessions s ON s.id=a.session_id JOIN subjects sub ON sub.id=s.subject_id
     WHERE a.id=$1 AND a.state='open' AND sub.instructor_id=$2 FOR UPDATE OF a`,[id,user.id]);
   if(!alert.rowCount)return false;
   await db.query('INSERT INTO risk_reviews(alert_id,reviewer_id,outcome,notes) VALUES($1,$2,$3,$4)',[id,user.id,outcome,notes]);
   await db.query("UPDATE risk_alerts SET state='resolved' WHERE id=$1",[id]);
   await db.query("INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,'alert_reviewed','risk_alert',$2,$3)",[user.id,id,outcome+': '+notes]);
   return true;
 });
 return result?NextResponse.json({ok:true}):jsonError('Alert not found, already reviewed, or not in your classes.',404);
}
