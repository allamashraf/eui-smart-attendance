import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET() {
  try { await query('SELECT 1');return NextResponse.json({app:'EUI Smart Attendance',database:'connected',mode:'synthetic-demo'}); }
  catch {return NextResponse.json({app:'EUI Smart Attendance',database:'unavailable',mode:'synthetic-demo'},{status:503});}
}
