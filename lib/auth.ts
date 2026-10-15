import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { query } from './db';
import type { NextRequest } from 'next/server';

export type Role = 'student' | 'instructor' | 'admin';
export type AppUser = { id: string; username: string; full_name: string; role: Role; demo: boolean; };
const cookieName = 'eui_demo_session';
function secret() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32 || /^(REPLACE_|PASTE_)/.test(process.env.AUTH_SECRET)) throw new Error('AUTH_SECRET must be at least 32 characters.');
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}
export async function issueSession(id: string): Promise<string> {
  return new SignJWT({ typ: 'demo' }).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuedAt().setExpirationTime('12h').sign(secret());
}
async function resolveUser(token?: string): Promise<AppUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (payload.typ !== 'demo' || typeof payload.sub !== 'string') return null;
    const result = await query<AppUser>('SELECT id, username, full_name, role, demo FROM users WHERE id=$1 AND active=true', [payload.sub]);
    return result.rows[0] || null;
  } catch { return null; }
}
export async function currentUser(): Promise<AppUser | null> {
  const store = await cookies();
  return resolveUser(store.get(cookieName)?.value);
}
export async function requestUser(req: NextRequest): Promise<AppUser | null> {
  return resolveUser(req.cookies.get(cookieName)?.value);
}
export async function requireUser(role?: Role): Promise<AppUser> {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (role && user.role !== role) redirect('/');
  return user;
}
export const sessionCookie = {
  name: cookieName,
  options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 12 }
};
export function defaultRoute(role: Role) { return role === 'admin' ? '/admin' : role === 'instructor' ? '/instructor' : '/student'; }
