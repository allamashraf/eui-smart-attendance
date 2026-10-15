import {NextRequest,NextResponse} from 'next/server';
import {authorize,isError,jsonError,parsePost} from '@/lib/security';
import {transaction} from '@/lib/db';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await authorize(req,'admin');if(isError(user))return user;
  const b=await parsePost(req);if(isError(b))return b;
  const outcome=String(b.outcome||'');const notes=String(b.notes||'').trim();const {id}=await params;
  if(!['legitimate','confirmed','inconclusive'].includes(outcome)||notes.length<10||notes.length>1000)return jsonError('Choose an outcome and add at least 10 characters of notes.');
  const result=await transaction(async db=>{
    const locked=await db.query(`SELECT id FROM risk_alerts WHERE id=$1 AND state='open' FOR UPDATE`,[id]);
    if(!locked.rowCount)return {error:'This alert is already resolved or not found.'};
    await db.query(`INSERT INTO risk_reviews(alert_id,reviewer_id,outcome,notes) VALUES($1,$2,$3,$4)`,[id,user.id,outcome,notes]);
    await db.query(`UPDATE risk_alerts SET state='resolved' WHERE id=$1`,[id]);
    await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,'alert_reviewed','risk_alert',$2,$3)`,[user.id,id,`${outcome}: ${notes}`]);
    return {ok:true};
  });
  return 'error' in result?jsonError(result.error!,409):NextResponse.json(result);
}
