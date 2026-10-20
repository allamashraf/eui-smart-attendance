import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { issueSession, defaultRoute, sessionCookie } from '@/lib/auth';
import { isError, jsonError, logEvent, parsePost } from '@/lib/security';
import { checkLoginLimit,clearLoginLimit } from '@/lib/login-limits';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const body = await parsePost(req); if (isError(body)) return body;
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[a-z0-9._-]{3,80}$/.test(username) || password.length < 1 || password.length > 200) return jsonError('Invalid username or password.', 401);
  const source=(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,80);
  let blocked:boolean; let account:string;
  try {
    ({blocked,account}=await checkLoginLimit(username,source));
  } catch(error) {
    console.error('Authentication rate-limit database failure:',error);
    return jsonError('Login temporarily unavailable. Check database connection and security migrations.',503,'auth_storage_unavailable');
  }
  if(blocked)return jsonError('Too many login attempts. Try again after 10 minutes.',429);
  let rows: Array<{id:string;username:string;full_name:string;role:'student'|'instructor'|'admin';password_hash:string}>;
  try {
    const result=await query<typeof rows[number]>('SELECT id,username,full_name,role,password_hash FROM users WHERE username=$1 AND active=true LIMIT 1',[username]);
    rows=result.rows;
  } catch(error) {
    console.error('Authentication account database failure:',error);
    return jsonError('Login temporarily unavailable. Check the configured database.',503,'auth_storage_unavailable');
  }
  const good = rows[0] && await bcrypt.compare(password, rows[0].password_hash);
  if (!good) {
    await logEvent(rows[0]?.id || null,null,'login_failed',{username});
    return jsonError('Invalid username or password.', 401);
  }
  const user=rows[0];
  let token:string;
  try {
    token=await issueSession(user.id);
  } catch(error) {
    console.error('Session creation failure:',error);
    return jsonError('Unable to start a session. Check the auth_sessions migration and AUTH_SECRET.',503,'session_unavailable');
  }
  try { await clearLoginLimit(account); }
  catch(error) { console.error('Failed to reset login limit:',error); }
  const res = NextResponse.json({ ok: true, to: defaultRoute(user.role), name: user.full_name });
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  await logEvent(user.id,null,'login_success',{provider:'temporary_demo_password'});
  return res;
}
