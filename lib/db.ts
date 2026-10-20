import { Pool, type PoolClient, type QueryResultRow } from 'pg';

declare global { var __euiPool: Pool | undefined; }

export function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Read README.md.');
  if (!global.__euiPool) {
    const u = new URL(process.env.DATABASE_URL);
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
    u.searchParams.delete('sslmode');
    // Supabase's pooler certificate may require its project CA, copied into
    // DATABASE_CA_CERT in Vercel. Preserve peer/hostname verification.
    const cert = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
    global.__euiPool = new Pool({
      connectionString: u.toString(),
      ssl: local ? false : { rejectUnauthorized: true, ...(cert ? { ca: cert } : {}) },
      // Vercel runs many small instances; keep each one's pool small.
      max: process.env.VERCEL ? 3 : 10,
    });
  }
  return global.__euiPool;
}
export async function query<T extends QueryResultRow = any>(sql: string, params: unknown[] = []) {
  return pool().query<T>(sql, params);
}
export async function transaction<T>(run: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const value = await run(client);
    await client.query('COMMIT');
    return value;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}
