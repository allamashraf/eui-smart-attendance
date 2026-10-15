import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local first.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(await fs.readFile(path.join(process.cwd(), 'db/schema.sql'), 'utf8'));
  console.log('Database schema created successfully.');
} finally { await client.end(); }
