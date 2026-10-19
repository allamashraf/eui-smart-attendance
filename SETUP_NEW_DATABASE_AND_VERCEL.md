# EUI Smart Attendance — independent deployment guide

This is a **student-built prototype**, not an official university system. **Do not use actual university credentials or real student data without written authorization and security review.**

## 1. Copy into your own GitHub repository

The source repository belongs to another owner. This work is on branch `security-instructor-alerts-2026` so its `main` is unchanged.

On GitHub: use **Fork** on `allamashraf/eui-smart-attendance`. Under your own fork, sync/import that security branch, then optionally make it the default. Alternatively use GitHub **Import repository** with the original HTTPS Git URL, then cherry-pick the branch changes from the source repository. Confirm that your new repository has the instructor alert files and security migration. A new repository cannot be created automatically with this integration.

### Easiest way to create your own **separate** repository (Windows PowerShell)

Install **Git** and **GitHub CLI** (`gh`), then authenticate with `gh auth login` and run:

```powershell
git clone --branch security-instructor-alerts-2026 --single-branch https://github.com/allamashraf/eui-smart-attendance.git eui-smart-attendance-secure
cd eui-smart-attendance-secure
git remote remove origin
git branch -m main
gh repo create eui-smart-attendance-secure --private --source=. --remote=origin --push
```

This creates a new repository **owned by your signed-in GitHub account** and publishes the updated branch as its `main`. It does not alter the original repository. If you prefer a public repository, replace `--private` with `--public` (avoid committing secrets or real student data).

## 2. Create the database (Supabase/PostgreSQL)

1. Create a new project at https://supabase.com/dashboard and save its database password.
2. In Supabase select **Connect** and copy the **Session Pooler** PostgreSQL URI on port 5432, for example:
   `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres`.
3. Do not use the Supabase anon/publishable API key as `DATABASE_URL`.
4. On your computer, install Node.js 22, then in the project folder:
   ```powershell
   npm install
   Copy-Item .env.example .env.local
   ```
5. Edit `.env.local`:
   ```env
   DATABASE_URL="postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres"
   AUTH_SECRET="RANDOM_SECRET_1"
   QR_SECRET="DIFFERENT_RANDOM_SECRET_2"
   DEMO_PASSWORD="A_LONG_RANDOM_DEMO_PASSWORD"
   ```
   Generate each secret separately using:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   URL-encode special characters in the database password. For an external database, the Node PostgreSQL client validates TLS certificates; configure a trusted CA at the operating-system or Node trust store level if the provider requires it. **Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`.**
6. Initialize the schema:
   ```powershell
   npm run db:setup
   ```
   Only for a disposable **synthetic-demo** database, optionally run `npm run db:seed`. This creates demo passwords/accounts; never run it on real university data.
7. For existing databases, close duplicate active sessions before applying the security migration because the unique index enforces one active session per class.
8. Test:
   ```powershell
   npm test
   npm run build
   npm run dev
   ```

## 3. Deploy on Vercel

1. Sign in to https://vercel.com/dashboard with your GitHub account.
2. Select **Add New → Project**; import **your own fork or new repository** (not the original).
3. Select the intended deployment branch; Next.js should be detected automatically.
4. In **Settings → Environment Variables**, configure `DATABASE_URL`, `AUTH_SECRET` and `QR_SECRET` for Production (and Preview only if using a separate demo database). Never commit secrets to GitHub.
5. Click **Deploy**, then check `https://YOUR-SITE.vercel.app/api/health`.
6. If you edit environment variables after deploying, **redeploy** for the changes to take effect. Never expose the database URL through `NEXT_PUBLIC_` variables.
7. Seed the demo database from your local computer **only if** this is an isolated, synthetic test.
8. Instructor alerts should appear at `/instructor/alerts` for an instructor account and show only alerts for that instructor's classes.

## 4. University production requirements

- The current username/password login is **demo authentication**, not university Microsoft SSO. University IT must authorize and configure identity federation before handling real university credentials.
- Session-level risk alerts indicate anomalies rather than misconduct. Staff must investigate and can mark legitimate/inconclusive.
- Browser identifiers, GPS readings, and IP addresses are not reliable proof of a physical student's identity or actual classroom presence.
- Configure your host, access controls, retention limits, incident response, logs, database backups, and real student-data permissions before production.
- Vercel/Supabase Hobby availability and quotas change; review your providers' current terms and your institution's data governance policies.

## Troubleshooting

- `password authentication failed`: regenerate/reset the Supabase DB password and copy the exact connection URI; this is different from `AUTH_SECRET`.
- `DATABASE_URL is missing`: confirm `.env.local` sits beside `package.json`.
- `certificate verify failed`: configure the provider-recommended trusted CA; don't disable TLS checks.
- `relation auth_sessions does not exist`: run `npm run db:setup` against this database after pulling the new migration.
- `one_active_session_per_subject` migration failure: inspect and close duplicate active sessions for the same class before retrying.
