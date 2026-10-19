import { NextRequest, NextResponse } from 'next/server';
import { isError, parsePost } from '@/lib/security';
import { sessionCookie,revokeSession } from '@/lib/auth';
export async function POST(req: NextRequest) {
  const body = await parsePost(req); if (isError(body)) return body;
  await revokeSession(req.cookies.get(sessionCookie.name)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, '', { ...sessionCookie.options, maxAge: 0 });
  return res;
}
