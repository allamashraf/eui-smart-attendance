import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local first.');
// schema.sql builds a fresh database; the files in db/migrations update an existing one, in name order.
// Every file is safe to run again, so this script can be run any number of times.
const migrationsDir = path.join(process.cwd(), 'db/migrations');
const migrations = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(await fs.readFile(path.join(process.cwd(), 'db/schema.sql'), 'utf8'));
  console.log('Database schema created successfully.');
  for (const file of migrations) {
    await client.query(await fs.readFile(path.join(migrationsDir, file), 'utf8'));
    console.log(`Migration applied: ${file}`);
  }
} finally { await client.end(); }
