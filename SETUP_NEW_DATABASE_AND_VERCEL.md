# EUI Smart Attendance — independent deployment guide

This is a **student-built prototype**, not an official university system. **Do not use actual university credentials or real student data without written authorization and security review.**

## 1. Copy into your own GitHub repository

The source repository belongs to another owner. This work is on branch `security-instructor-alerts-clean` so its `main` is unchanged.

On GitHub: use **Fork** on `allamashraf/eui-smart-attendance`. Under your own fork, sync/import that security branch, then optionally make it the default. Alternatively use GitHub **Import repository** with the original HTTPS Git URL, then cherry-pick the branch changes from the source repository. Confirm that your new repository has the instructor alert files and security migration. A new repository cannot be created automatically with this integration.

### Easiest way to create your own **separate** repository (Windows PowerShell)

Install **Git** and **GitHub CLI** (`gh`), then authenticate with `gh auth login` and run:

```powershell
git clone --branch security-instructor-alerts-clean --single-branch https://github.com/allamashraf/eui-smart-attendance.git eui-smart-attendance-secure
cd eui-smart-attendance-secure
git remote remove origin
git branch -m main
gh repo create eui-smart-attendance-secure --private --source=. --remote=origin --push
```

This creates a new repository **owned by your signed-in GitHub account** and publishes the updated branch as its `main`. It does not alter the original repository. If you prefer a public repository, replace `--private` with `--public` (avoid committing secrets or real student data).

## 2. Reuse the ORIGINAL Supabase database and variables from Vercel

**Do not create a new Supabase project.** Reuse the existing PostgreSQL instance that the original Vercel project already uses. GitHub branches do not contain secret environment variable values.

1. Open the **original** Vercel deployment at https://vercel.com/dashboard → `eui-smart-attendance` → **Settings → Environment Variables**.
2. Read the values for `DATABASE_URL`, `AUTH_SECRET`, `QR_SECRET`; preserve the originals. Do not put these secrets into GitHub or send them in chat.
3. In the **new** Vercel project, configure the exact same values and select the appropriate environment(s). If deploying a different branch within the *same* Vercel project, check whether its Preview environment already inherits the required variables instead of creating duplicates.
4. Preserve any existing optional settings: `QR_INTERVAL_SECONDS`, `QR_GRACE_SECONDS`, `RADIUS_M`, `MAX_ACCURACY_M`, `REJECT_BEYOND_M`. The demo-only `DEMO_PASSWORD` is needed only if you intentionally run a demo seed script from your computer.
5. **Back up the original database before changing it.** In the Supabase SQL Editor, inspect for multiple `active` class sessions per subject, then apply `db/migrations/004_security_hardening.sql` to add `auth_sessions` and `auth_rate_limits`. This schema upgrade is required for new login sessions. Review its changes before execution; do not run it against a production university database without authorization.
6. Do **not** run `npm run db:seed` against the existing database. That command can overwrite demo account passwords, change session timestamps, and modify class records.
7. If using local development, create `.env.local` beside `package.json` with the same original variables, but never commit the file. Run `npm install`, `npm test`, `npm run build`, and `npm run dev` to check the application.
8. The improved database client verifies hosted PostgreSQL TLS certificates, unlike the previous insecure `rejectUnauthorized:false` configuration. If the old Supabase connection fails certificate verification, configure the appropriate trusted CA; do not turn off certificate verification.

### Original variable names (same in `main` and this branch)

| Name | Required? | Source |
|---|---|---|
| `DATABASE_URL` | Yes | Original Vercel environment / existing Supabase connection |
| `AUTH_SECRET` | Yes | Original Vercel environment |
| `QR_SECRET` | Yes | Original Vercel environment |
| `DEMO_PASSWORD` | Local demo seed only | Original local setup, not needed on deployed Vercel |
| `QR_INTERVAL_SECONDS` | Optional | Original Vercel environment or default 8 |
| `QR_GRACE_SECONDS` | Optional | Original Vercel environment or default 3 |
| `RADIUS_M` | Optional | Original Vercel environment or default 75 |
| `MAX_ACCURACY_M` | Optional | Original Vercel environment or default 150 |
| `REJECT_BEYOND_M` | Optional | Original Vercel environment or default 1000 |

## 3. Deploy on Vercel

1. Sign in to https://vercel.com/dashboard with your GitHub account.
2. Select **Add New → Project**; import **your own fork or new repository** (not the original).
3. Select the intended deployment branch; Next.js should be detected automatically.
4. In **Settings → Environment Variables**, reuse the original project's values of `DATABASE_URL`, `AUTH_SECRET`, `QR_SECRET`, and all existing optional settings for the chosen environment. Never commit secrets to GitHub.
5. Click **Deploy**, then check `https://YOUR-SITE.vercel.app/api/health`.
6. If you edit environment variables after deploying, **redeploy** for the changes to take effect. Never expose the database URL through `NEXT_PUBLIC_` variables.
7. Do not seed the original database. Test using only existing authorized demo accounts.
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
