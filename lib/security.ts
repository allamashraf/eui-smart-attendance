import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from './db';
import type { AppUser, Role } from './auth';
import { requestUser } from './auth';

export function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
export async function authorize(req: NextRequest, role: Role): Promise<AppUser | NextResponse> {
  const user = await requestUser(req);
  return !user ? jsonError('Please sign in.', 401) : user.role !== role ? jsonError('Forbidden.', 403) : user;
}
export function safeOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.get('host'); } catch { return false; }
}
export async function parsePost(req: NextRequest): Promise<Record<string, any> | NextResponse> {
  if (!safeOrigin(req)) return jsonError('Invalid request origin.', 403);
  if (!req.headers.get('content-type')?.includes('application/json')) return jsonError('Expected JSON.', 415);
  try {
    const obj = await req.json();
    if (!obj || Array.isArray(obj) || typeof obj !== 'object') return jsonError('Invalid JSON body.');
    return obj;
  } catch { return jsonError('Invalid JSON.'); }
}
export function isError(x: unknown): x is NextResponse { return x instanceof NextResponse; }
export function sha(text: string) { return createHash('sha256').update(text).digest('hex'); }
function qrSecret() {
  if (!process.env.QR_SECRET || process.env.QR_SECRET.length < 32 || process.env.QR_SECRET === process.env.AUTH_SECRET || /^(REPLACE_|PASTE_)/.test(process.env.QR_SECRET)) throw new Error('QR_SECRET is not configured.');
  return process.env.QR_SECRET;
}
export const QR_INTERVAL_MS = 15000;
export function qrToken(sessionId: string, slot: number): string {
  const claim = `${sessionId}.${slot}`;
  const signature = createHmac('sha256', qrSecret()).update(claim).digest('base64url');
  return `${claim}.${signature}`;
}
export function parseQrToken(token: string): { sessionId: string; slot: number; valid: boolean; expired: boolean } | null {
  if (token.length > 250) return null;
  const m = token.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.([0-9]{7,15})\.([A-Za-z0-9_-]{43})$/);
  if (!m) return null;
  const sessionId = m[1]; const slot = Number(m[2]);
  const expected = qrToken(sessionId, slot).split('.').at(-1)!;
  const valid = timingSafeEqual(Buffer.from(m[3]), Buffer.from(expected));
  const now = Date.now();
  return { sessionId, slot, valid, expired: now > (slot + 1) * QR_INTERVAL_MS + 5000 || now < slot * QR_INTERVAL_MS - 1000 };
}
export async function logEvent(userId: string | null, sessionId: string | null, type: string, detail: Record<string, unknown> = {}) {
  try {
    await query('INSERT INTO security_events (user_id, session_id, type, details) VALUES ($1,$2,$3,$4::jsonb)', [userId, sessionId, type, JSON.stringify(detail)]);
  } catch (e) { console.error('Security event failure:', e); }
}
export async function createAlert(sessionId: string, rule: string, score: number, explanation: string, evidence: Record<string, unknown>, studentId: string | null = null) {
  await query(`INSERT INTO risk_alerts (session_id,student_id,rule_key,score,explanation,evidence)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (session_id,rule_key) DO NOTHING`, [sessionId, studentId, rule, score, explanation, JSON.stringify(evidence)]);
}
