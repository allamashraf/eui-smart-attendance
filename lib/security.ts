import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from './db';
import type { AppUser, Role } from './auth';
import { requestUser } from './auth';
import { QR } from './config';

// `code` is an optional machine-readable reason (for example 'expired'), so pages can react without parsing text.
export function jsonError(message: string, status = 400, code?: string) { return NextResponse.json(code ? { error: message, code } : { error: message }, { status }); }
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
// QR payload format: EUIA1.<sessionId>.<slot>.<signature>
// "EUIA1" lets the scanner ignore unrelated QR codes; the "1" is the format version.
// The payload is never a link, so forwarding it as text opens nothing.
export const QR_PREFIX = 'EUIA1';
const QR_INTERVAL_MS = QR.intervalSeconds * 1000;
const QR_GRACE_MS = QR.graceSeconds * 1000;
// Time is cut into numbered slots of QR_INTERVAL_MS. Slot n lasts from n*interval to (n+1)*interval.
export function currentSlot(now = Date.now()) { return Math.floor(now / QR_INTERVAL_MS); }
export function slotStart(slot: number) { return new Date(slot * QR_INTERVAL_MS); }
export function slotEnd(slot: number) { return new Date((slot + 1) * QR_INTERVAL_MS); }
export function qrToken(sessionId: string, slot: number): string {
  // The HMAC signs the prefix too, so a signature can never be reused under another format version.
  const claim = `${QR_PREFIX}.${sessionId}.${slot}`;
  const signature = createHmac('sha256', qrSecret()).update(claim).digest('base64url');
  return `${claim}.${signature}`;
}
export function parseQrToken(token: string): { sessionId: string; slot: number; valid: boolean; expired: boolean } | null {
  if (token.length > 250) return null;
  const m = token.match(/^EUIA1\.([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.([0-9]{7,15})\.([A-Za-z0-9_-]{43})$/);
  if (!m) return null;
  const sessionId = m[1]; const slot = Number(m[2]);
  const expected = qrToken(sessionId, slot).split('.').at(-1)!;
  const valid = timingSafeEqual(Buffer.from(m[3]), Buffer.from(expected));
  const now = Date.now();
  const tooOld = now > slotEnd(slot).getTime() + QR_GRACE_MS;   // slot ended more than the grace time ago
  const tooNew = now < slotStart(slot).getTime() - 1000;        // 1 s allowance for small clock differences
  return { sessionId, slot, valid, expired: tooOld || tooNew };
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
