import { Pool, type PoolClient, type QueryResultRow } from 'pg';

declare global { var __euiPool: Pool | undefined; }

export function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Read README.md.');
  if (!global.__euiPool) global.__euiPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
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
