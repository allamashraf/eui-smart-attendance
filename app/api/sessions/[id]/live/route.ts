import {NextRequest,NextResponse} from 'next/server';
import {authorize,isError,isUuid,jsonError} from '@/lib/security';
import {query} from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Everything the live board and the projector need, in ONE query: session state, counts,
// each enrolled student's status, and the 8 most recent check-ins. Instructor only, own sessions only.
// Only the instructor's screens poll this (every 2 s). Students never poll.
// GET has no body and browsers send no Origin header on same-origin GETs, so parsePost() is not used here.
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await authorize(req,'instructor');if(isError(user))return user;
  const {id}=await params;
  if(!isUuid(id))return jsonError('Session not found.',404);
  const {rows}=await query(`
    WITH s AS (
      SELECT cs.id,cs.subject_id,cs.state,cs.qr_open,cs.anchor_accuracy_m,cs.anchor_set_at
      FROM class_sessions cs JOIN subjects sub ON sub.id=cs.subject_id
      WHERE cs.id=$1 AND sub.instructor_id=$2
    ), roster AS (
      SELECT u.id,u.full_name AS name,u.student_number AS number,ar.status,ar.verification,ar.method,
        ar.checked_in_at AS "checkedInAt",ar.location_result AS location,ar.distance_m::float AS "distanceM"
      FROM s JOIN enrollments e ON e.subject_id=s.subject_id AND e.status='active'
      JOIN users u ON u.id=e.student_id
      LEFT JOIN attendance_records ar ON ar.session_id=s.id AND ar.student_id=u.id
    )
    SELECT s.state,s.qr_open AS "qrOpen",s.anchor_accuracy_m::float AS "anchorAccuracyM",s.anchor_set_at AS "anchorSetAt",
      (SELECT json_build_object('roster',count(*),'attended',count(status),
        'needsReview',count(*) FILTER (WHERE verification='needs_review')) FROM roster) AS counts,
      (SELECT coalesce(json_agg(r ORDER BY r.name),'[]'::json) FROM roster r) AS roster,
      (SELECT coalesce(json_agg(x),'[]'::json) FROM (
        SELECT u.full_name AS name,ar.status,ar.verification,ar.checked_in_at AS "checkedInAt"
        FROM attendance_records ar JOIN users u ON u.id=ar.student_id
        WHERE ar.session_id=s.id ORDER BY ar.checked_in_at DESC LIMIT 8) x) AS recent
    FROM s`,[id,user.id]);
  if(!rows.length)return jsonError('Session not found.',404);
  const r=rows[0];
  return NextResponse.json({state:r.state,qrOpen:r.qrOpen,
    anchor:r.anchorSetAt?{accuracyM:r.anchorAccuracyM,setAt:r.anchorSetAt}:null,
    counts:r.counts,roster:r.roster,recent:r.recent,now:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}
