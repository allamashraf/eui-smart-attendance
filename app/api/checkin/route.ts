import { NextRequest, NextResponse } from 'next/server';
import { authorize,isError,jsonError,parsePost,parseQrToken,sha,logEvent,createAlert } from '@/lib/security';
import { query,transaction } from '@/lib/db';
import { QR } from '@/lib/config';

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
  const accuracy=Number(body.accuracy);
  const coords=Number.isFinite(Number(body.lat)) && Number.isFinite(Number(body.lon)) && typeof body.lat==='number' && typeof body.lon==='number';
  const locationResult=coords?'unverified':'not_collected';
  const safeAccuracy=Number.isFinite(accuracy)&&accuracy>=0&&accuracy<100000?accuracy:null;
  let result: {ok:boolean,status?:string,error?:string}={ok:false,error:'Unable to check in.'};
  try {
    result=await transaction(async db=>{
      const {rows} = await db.query(`SELECT s.id,s.started_at,s.state,s.ontime_minutes,s.cutoff_minutes,s.location_required,
        EXISTS(SELECT 1 FROM enrollments e WHERE e.subject_id=s.subject_id AND e.student_id=$2 AND e.status='active') AS enrolled,
        EXISTS(SELECT 1 FROM attendance_challenges ch WHERE ch.session_id=s.id AND ch.slot=$3 AND ch.token_hash=$4 AND now()>=ch.issued_at AND now()<=ch.expires_at + $5 * interval '1 second') AS issued
        FROM class_sessions s WHERE s.id=$1 FOR SHARE OF s`,[parsed.sessionId,user.id,parsed.slot,sha(token),QR.graceSeconds]);
      if(!rows.length||rows[0].state!=='active')return {ok:false,error:'This class session is not active.'};
      const s=rows[0];
      if(!s.enrolled)return {ok:false,error:'You are not enrolled in this class.'};
      if(!s.issued)return {ok:false,error:'The QR code was not issued by this session.'};
      if(s.location_required && !coords)return {ok:false,error:'This session requests location. Allow location or ask your instructor for assistance.'};
      const minutes=(Date.now()-new Date(s.started_at).getTime())/60000;
      if(minutes>s.cutoff_minutes)return {ok:false,error:'Check-in has closed. Request a correction.'};
      const status=minutes>s.ontime_minutes?'late':'present';
      const inserted=await db.query(`INSERT INTO attendance_records(student_id,session_id,status,method,device_hash,location_result,accuracy_m)
        VALUES($1,$2,$3,'qr',$4,$5,$6) ON CONFLICT(student_id,session_id) DO NOTHING RETURNING id`,[user.id,s.id,status,deviceHash,locationResult,safeAccuracy]);
      if(!inserted.rowCount)return {ok:false,error:'You have already checked in to this session.'};
      await db.query(`INSERT INTO security_events(user_id,session_id,type,details) VALUES($1,$2,'checkin_success',$3::jsonb)`,[user.id,s.id,JSON.stringify({status,device_hash:deviceHash,location_result:locationResult})]);
      return {ok:true,status};
    });
  } catch(e) {console.error('Check-in failed:',e);return jsonError('Unable to record attendance. Please try again.',500);}
  if(!result.ok){await logEvent(user.id,parsed.sessionId,'checkin_rejected',{reason:result.error});return jsonError(result.error || 'Check-in refused.',409);}
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
  return NextResponse.json({ok:true,status:result.status,sessionId:parsed.sessionId});
}
