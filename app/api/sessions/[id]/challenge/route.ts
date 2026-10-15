import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { authorize, isError, isUuid, jsonError, qrToken, currentSlot, slotStart, slotEnd, sha } from '@/lib/security';
import { QR } from '@/lib/config';
import { query } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest, {params}:{params:Promise<{id:string}>}) {
  const user = await authorize(req,'instructor'); if (isError(user)) return user;
  const {id} = await params;
  if (!isUuid(id)) return jsonError('Session not found.',404);
  const {rows} = await query(`SELECT s.*, sub.code, sub.title AS subject_title,
    (SELECT count(*)::int FROM attendance_records a WHERE a.session_id=s.id) AS attended,
    (SELECT count(*)::int FROM enrollments e WHERE e.subject_id=s.subject_id AND e.status='active') AS roster_count
    FROM class_sessions s JOIN subjects sub ON sub.id=s.subject_id
    WHERE s.id=$1 AND sub.instructor_id=$2`,[id,user.id]);
  if (!rows.length) return jsonError('Session not found.',404);
  const s=rows[0];
  if (s.state !== 'active') return NextResponse.json({state:'ended',attended:s.attended,roster_count:s.roster_count});
  // QR closed by the instructor: no token is issued at all.
  if (!s.qr_open) return NextResponse.json({state:'qr_closed',now:new Date().toISOString(),intervalSeconds:QR.intervalSeconds,attended:s.attended,roster_count:s.roster_count,code:s.code,sessionTitle:s.title}, {headers:{'Cache-Control':'no-store'}});
  const now=Date.now(); const slot=currentSlot(now);
  const token=qrToken(id,slot); const exp=slotEnd(slot);
  await query(`INSERT INTO attendance_challenges(session_id,slot,token_hash,issued_at,expires_at)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(session_id,slot) DO NOTHING`,[id,slot,sha(token),slotStart(slot),exp]);
  // The QR holds only the signed token (no link), and the response never includes the token as text.
  // SVG stays sharp at any size; margin 4 is the quiet zone the QR standard asks for.
  const svg = await QRCode.toString(token,{type:'svg',margin:4,errorCorrectionLevel:'M',color:{dark:'#0B1F3A',light:'#FFFFFF'}});
  const qrImage = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return NextResponse.json({state:'active',qrImage,expiresAt:exp.toISOString(),now:new Date(now).toISOString(),intervalSeconds:QR.intervalSeconds,attended:s.attended,roster_count:s.roster_count,code:s.code,sessionTitle:s.title}, {headers:{'Cache-Control':'no-store'}});
}
