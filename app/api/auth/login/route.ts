import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { issueSession, defaultRoute, sessionCookie } from '@/lib/auth';
import { isError, jsonError, logEvent, parsePost } from '@/lib/security';

export const runtime = 'nodejs';
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(req: NextRequest) {
  const body = await parsePost(req); if (isError(body)) return body;
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[a-z0-9._-]{3,80}$/.test(username) || password.length < 1 || password.length > 200) return jsonError('Invalid username or password.', 401);
  const identifier = `${req.headers.get('x-forwarded-for')?.split(',')[0]?.slice(0,70) || 'local'}:${username}`;
  const now = Date.now(); const attempt = attempts.get(identifier);
  if (attempt && attempt.until > now && attempt.count >= 8) return jsonError('Too many attempts. Try again in 10 minutes.', 429);
  const { rows } = await query('SELECT id,username,full_name,role,password_hash FROM users WHERE username=$1 AND active=true LIMIT 1', [username]);
  const good = rows[0] && await bcrypt.compare(password, rows[0].password_hash);
  if (!good) {
    const data = attempt && attempt.until > now ? attempt : { count: 0, until: now + 10*60*1000 };
    attempts.set(identifier, { count: data.count + 1, until: data.until });
    await logEvent(rows[0]?.id || null,null,'login_failed',{username});
    return jsonError('Invalid username or password.', 401);
  }
  attempts.delete(identifier);
  const user = rows[0]; const token = await issueSession(user.id);
  const res = NextResponse.json({ ok: true, to: defaultRoute(user.role), name: user.full_name });
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  await logEvent(user.id,null,'login_success',{provider:'temporary_demo_password'});
  return res;
}
