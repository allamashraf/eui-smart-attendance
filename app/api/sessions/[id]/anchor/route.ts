import {NextRequest,NextResponse} from 'next/server';
import {authorize,isError,isUuid,jsonError,parsePost} from '@/lib/security';
import {transaction} from '@/lib/db';
import {LOCATION} from '@/lib/config';
import {parseReading} from '@/lib/location';
// Saves the room position ("anchor") that every student reading is compared with.
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await authorize(req,'instructor');if(isError(user))return user;
  const body=await parsePost(req);if(isError(body))return body;
  const {id}=await params;
  if(!isUuid(id))return jsonError('Session not found.',404);
  const room=parseReading(body.lat,body.lon,body.accuracy);
  if(!room||room==='invalid')return jsonError('Send a valid location reading.',400,'bad_location');
  // A laptop's Wi-Fi location can be off by a kilometre. decideLocation() subtracts the room's accuracy,
  // so an imprecise anchor would make almost everyone "inside". Such a reading is refused.
  if(room.accuracyM>LOCATION.maxAccuracyM)return jsonError(`This reading is only accurate to ±${Math.round(room.accuracyM)} m (limit ±${LOCATION.maxAccuracyM} m). Set the room location from a phone inside the classroom.`,422,'anchor_imprecise');
  const setAt=await transaction(async db=>{
    const r=await db.query(`UPDATE class_sessions s SET anchor_lat=$3,anchor_lon=$4,anchor_accuracy_m=$5,anchor_set_at=now()
      FROM subjects sub WHERE s.id=$1 AND s.subject_id=sub.id AND sub.instructor_id=$2 AND s.state='active' RETURNING s.anchor_set_at`,[id,user.id,room.lat,room.lon,room.accuracyM]);
    if(!r.rowCount)return null;
    await db.query(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason) VALUES($1,'room_location_set','class_session',$2,$3)`,[user.id,id,`Room location set (±${Math.round(room.accuracyM)} m)`]);
    return r.rows[0].anchor_set_at;
  });
  if(!setAt)return jsonError('Session not found or already ended.',404);
  return NextResponse.json({ok:true,accuracyM:room.accuracyM,setAt});
}
