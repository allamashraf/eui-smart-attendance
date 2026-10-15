import { NextRequest, NextResponse } from 'next/server';
import { authorize,isError,jsonError,parsePost,parseQrToken,sha,logEvent,createAlert } from '@/lib/security';
import { query,transaction } from '@/lib/db';
import { QR,LOCATION } from '@/lib/config';
import { decideLocation,parseReading,type LocationDecision } from '@/lib/location';

type FarAway={distance_m:number,student_accuracy_m:number|null,room_accuracy_m:number|null};
type Outcome={ok:true,status:string,verification:string,location:LocationDecision}|{ok:false,error:string,code:string,far?:FarAway};

export async function POST(req:NextRequest) {
  const user=await authorize(req,'student'); if(isError(user))return user;
  const body=await parsePost(req); if(isError(body))return body;
  const token=String(body.token || '').trim();
  const parsed=parseQrToken(token);
  const sessionId=parsed?.sessionId || null;
  if(!parsed || !parsed.valid || parsed.expired) {
    await logEvent(user.id,sessionId,'invalid_or_expired_qr',{reason:!parsed?'malformed':!parsed.valid?'invalid_signature':'expired'});
    // An invalid attempt may not link to a valid session. Monitoring is advisory.
    if (sessionId) {
      try {
        const failures=await query(`SELECT COUNT(*)::int AS n FROM security_events WHERE user_id=$1 AND session_id=$2
          AND type='invalid_or_expired_qr' AND created_at > now()-interval '2 hours'`,[user.id,sessionId]);
        if (failures.rows[0].n>=5) await createAlert(sessionId,`R3_${user.id.slice(0,16)}`,15,
          'Repeated invalid or expired QR attempts from one demo user. Could reflect slow network or stale screenshots.',{rule:'R3',failures:failures.rows[0].n},user.id);
      }catch(e){console.error('Risk monitor error:',e);}
    }
    if (parsed && parsed.valid) return jsonError('This code has expired. Scan the current code on the screen.',400,'expired');
    return jsonError('This QR code is not a valid attendance code.',400,'invalid_qr');
  }
  const deviceId=String(body.deviceId || '');
  // Pseudonymous, not a permanent hardware identifier. Server salt prevents raw ID exposure.
  const deviceHash=/^[a-f0-9-]{36}$/.test(deviceId) ? sha(`${process.env.AUTH_SECRET}:${deviceId}`) : null;
  // The phone only sends its reading (or nothing). The server alone decides what the reading means.
  const student=parseReading(body.lat,body.lon,body.accuracy);
  if(student==='invalid')return jsonError('The location sent by this device is not valid.',400,'bad_location');
  let result: Outcome={ok:false,error:'Unable to check in.',code:'error'};
  try {
    result=await transaction<Outcome>(async db=>{
      const {rows} = await db.query(`SELECT s.id,s.started_at,s.state,s.qr_open,s.ontime_minutes,s.cutoff_minutes,s.anchor_lat,s.anchor_lon,s.anchor_accuracy_m,
        EXISTS(SELECT 1 FROM enrollments e WHERE e.subject_id=s.subject_id AND e.student_id=$2 AND e.status='active') AS enrolled,
        EXISTS(SELECT 1 FROM attendance_challenges ch WHERE ch.session_id=s.id AND ch.slot=$3 AND ch.token_hash=$4 AND now()>=ch.issued_at AND now()<=ch.expires_at + $5 * interval '1 second') AS issued,
        EXISTS(SELECT 1 FROM attendance_records ar WHERE ar.student_id=$2 AND ar.session_id=s.id) AS already,
        EXISTS(SELECT 1 FROM security_events ev WHERE ev.session_id=s.id AND ev.user_id=$2 AND ev.type='marked_absent') AS marked_absent
        FROM class_sessions s WHERE s.id=$1 FOR SHARE OF s`,[parsed.sessionId,user.id,parsed.slot,sha(token),QR.graceSeconds]);
      if(!rows.length||rows[0].state!=='active')return {ok:false,error:'This class session is not active.',code:'not_active'};
      const s=rows[0];
      if(!s.qr_open)return {ok:false,error:'Check-in is closed. Ask your instructor.',code:'qr_closed'};
      if(!s.enrolled)return {ok:false,error:'You are not enrolled in this class.',code:'not_enrolled'};
      if(!s.issued)return {ok:false,error:'The QR code was not issued by this session.',code:'not_issued'};
      if(s.already)return {ok:false,error:'You have already checked in to this session.',code:'already'};
      if(s.marked_absent)return {ok:false,error:'Your instructor marked you absent for this session. If this is a mistake, ask your instructor or request a correction.',code:'marked_absent'};
      const minutes=(Date.now()-new Date(s.started_at).getTime())/60000;
      if(minutes>s.cutoff_minutes)return {ok:false,error:'Check-in has closed. Request a correction.',code:'closed'};
      const status=minutes>s.ontime_minutes?'late':'present';
      // pg returns numeric columns as text, so the stored room accuracy is converted to a number.
      const anchor=s.anchor_lat==null?null:{lat:s.anchor_lat,lon:s.anchor_lon,accuracyM:Number(s.anchor_accuracy_m)};
      const {decision,distanceM}=decideLocation(student,anchor,LOCATION);
      if(decision==='outside') return {ok:false,code:'outside',
        error:'Your location is far from the classroom, so this check-in was not recorded. If you are in the room, ask your instructor.',
        far:{distance_m:Math.round(distanceM!),student_accuracy_m:student?.accuracyM??null,room_accuracy_m:anchor?.accuracyM??null}};
      const verification=decision==='inside'?'verified':'needs_review';
      const distance=distanceM==null?null:Math.round(distanceM*10)/10;
      // Privacy: only the distance, the student's accuracy and the decision are stored, never coordinates.
      const inserted=await db.query(`INSERT INTO attendance_records(student_id,session_id,status,method,device_hash,location_result,accuracy_m,distance_m,verification)
        VALUES($1,$2,$3,'qr',$4,$5,$6,$7,$8) ON CONFLICT(student_id,session_id) DO NOTHING RETURNING id`,[user.id,s.id,status,deviceHash,decision,student?.accuracyM??null,distance,verification]);
      if(!inserted.rowCount)return {ok:false,error:'You have already checked in to this session.',code:'already'};
      await db.query(`INSERT INTO security_events(user_id,session_id,type,details) VALUES($1,$2,'checkin_success',$3::jsonb)`,[user.id,s.id,JSON.stringify({status,device_hash:deviceHash,location_result:decision,verification,distance_m:distance})]);
      return {ok:true,status,verification,location:decision};
    });
  } catch(e) {console.error('Check-in failed:',e);return jsonError('Unable to record attendance. Please try again.',500);}
  if(!result.ok && result.far) {
    // A valid, current code used far from the room: no record (the transaction wrote nothing), one event, alert R9.
    await logEvent(user.id,parsed.sessionId,'checkin_far_away',{rule:'R9',...result.far});
    try {
      const km=(result.far.distance_m/1000).toFixed(1);
      await createAlert(parsed.sessionId,`R9_${user.id.slice(0,16)}`,70,
        `A current QR code was used about ${km} km from the room. This usually means the code was forwarded. It is a review signal, not proof: a wrong location reading is possible.`,{rule:'R9',...result.far},user.id);
    }catch(e){console.error('Risk monitor error:',e);}
    return jsonError(result.error,403,result.code);
  }
  if(!result.ok){await logEvent(user.id,parsed.sessionId,'checkin_rejected',{reason:result.code});return jsonError(result.error,409,result.code);}
  // Monitoring runs after the authoritative insert; failure must never undo a valid check-in.
  if(deviceHash) {
    try {
      const shared=await query(`SELECT COUNT(DISTINCT student_id)::int AS count FROM attendance_records
        WHERE session_id=$1 AND device_hash=$2`,[parsed.sessionId,deviceHash]);
      if(shared.rows[0].count>=2) await createAlert(parsed.sessionId,`R1_${deviceHash.slice(0,16)}`,30,
        'Multiple student accounts checked in from the same pseudonymous browser identifier. Shared devices are a possible explanation.',{rule:'R1',count:shared.rows[0].count},user.id);
      const recent=await query(`SELECT COUNT(DISTINCT user_id)::int AS count FROM security_events
        WHERE session_id=$1 AND type='checkin_success' AND details->>'device_hash'=$2
          AND created_at > now() - interval '10 minutes'`,[parsed.sessionId,deviceHash]);
      if(recent.rows[0].count>=3) await createAlert(parsed.sessionId,`R2_${deviceHash.slice(0,16)}`,55,
        'Three or more demo accounts used one pseudonymous browser within 10 minutes. This is a review signal, not proof of misconduct.',{rules:['R1','R2'],accounts_in_10_minutes:recent.rows[0].count},user.id);
    }catch(e){console.error('Optional risk signal failure:',e);}
  }
  return NextResponse.json({ok:true,status:result.status,verification:result.verification,location:result.location,sessionId:parsed.sessionId});
}
