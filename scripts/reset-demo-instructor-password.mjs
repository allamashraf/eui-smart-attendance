// Reset ONLY the seeded synthetic instructor account.
// Run locally against a demo database. Never commit passwords or run on real records.
import pg from 'pg';
import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { pgOptions } from './pg-config.mjs';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  throw new Error('Run this script in an interactive terminal so the password is not logged.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from .env.local.');

function readSecret(message) {
  return new Promise((resolve,reject)=>{
    const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
    const write=rl._writeToOutput.bind(rl);
    rl._writeToOutput=(value)=>{if(value.includes('\n') || value.includes('\r'))write(value);else if(value.startsWith(message))write(value);else if(value.includes('\x1b'))write(value);else write('*');};
    rl.question(message,(value)=>{rl.close();resolve(value);});
    rl.on('SIGINT',()=>{rl.close();reject(new Error('Cancelled.'));});
  });
}
const password=await readSecret('New demo instructor password (minimum 12 characters): ');
if(password.length<12 || password.length>200) throw new Error('Password length must be 12–200 characters.');
const confirmation=await readSecret('Confirm new password: ');
if(password!==confirmation)throw new Error('Passwords do not match.');
const client=new pg.Client(pgOptions());
try {
  await client.connect();
  await client.query('BEGIN');
  const record=await client.query(
    "SELECT id FROM users WHERE username='instructor' AND role='instructor' AND demo=true AND active=true FOR UPDATE"
  );
  if(record.rowCount!==1)throw new Error('Active synthetic instructor account not found; no changes made.');
  const hash=await bcrypt.hash(password,12);
  await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,record.rows[0].id]);
  // Revoke older sessions for this account without altering other users.
  await client.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[record.rows[0].id]);
  await client.query('COMMIT');
  console.log('Updated only the synthetic instructor password and revoked its old sessions.');
} catch(error) {
  try {await client.query('ROLLBACK');} catch{}
  throw error;
} finally {
  await client.end();
}
