// Connection options shared by the scripts. Hosted databases (Supabase) need SSL;
// a local PostgreSQL does not. sslmode is removed from the URL so these options decide.
export function pgOptions(url = process.env.DATABASE_URL) {
  const u = new URL(url);
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
  u.searchParams.delete('sslmode');
  return { connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: false } };
}
