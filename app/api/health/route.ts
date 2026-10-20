import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
export const dynamic='force-dynamic';
export const runtime='nodejs';

// Public health response intentionally exposes no credentials, user details,
// database hostnames, or raw database error messages.
export async function GET() {
  try {
    const result=await query<{rate_limits:string|null;sessions:string|null}>(`
      SELECT to_regclass('public.auth_rate_limits')::text AS rate_limits,
             to_regclass('public.auth_sessions')::text AS sessions
    `);
    const ready=Boolean(result.rows[0]?.rate_limits && result.rows[0]?.sessions);
    return NextResponse.json({
      app:'EUI Smart Attendance',
      database:'connected',
      loginStorage:ready?'ready':'migration_required',
      mode:'synthetic-demo'
    },{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('Database health check failed:',error);
    return NextResponse.json({
      app:'EUI Smart Attendance',
      database:'unavailable',
      loginStorage:'unknown',
      mode:'synthetic-demo'
    },{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
