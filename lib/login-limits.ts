import { createHash } from 'node:crypto';
import { query } from './db';
function key(kind:string,value:string){
 return createHash('sha256').update((process.env.AUTH_SECRET||'')+':'+kind+':'+value).digest('hex');
}
export async function checkLoginLimit(username:string,source:string){
 const account=key('account',username), ip=key('source',source);
 // Increment both atomic database counters (Vercel instances share them).
 const sql=`INSERT INTO auth_rate_limits(key,attempts,reset_at)
 VALUES($1,1,now()+interval '10 minutes')
 ON CONFLICT(key) DO UPDATE SET
 attempts=CASE WHEN auth_rate_limits.reset_at<=now() THEN 1 ELSE auth_rate_limits.attempts+1 END,
 reset_at=CASE WHEN auth_rate_limits.reset_at<=now() THEN now()+interval '10 minutes' ELSE auth_rate_limits.reset_at END
 RETURNING attempts`;
 const [a,b]=await Promise.all([query(sql,[account]),query(sql,[ip])]);
 return {blocked:Number(a.rows[0].attempts)>8||Number(b.rows[0].attempts)>50,account};
}
export async function clearLoginLimit(account:string){
 await query('DELETE FROM auth_rate_limits WHERE key=$1',[account]);
}
