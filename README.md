# EUI Smart Attendance — working prototype

**A Next.js + TypeScript + PostgreSQL project based on the 18-page EUI Smart Attendance Project Proposal v2 (October 2026).**

> **DEMO, NOT AN OFFICIAL EUI SYSTEM.** The project uses synthetic data. Until Egypt University of Informatics approves Microsoft Entra ID integration, authentication uses locally stored **demo usernames and hashed passwords**. **Never enter university Microsoft credentials into the demo login page.** Do not connect real student records or publicly deploy this unreviewed prototype.

## Features ready to try

- Responsive student, instructor, and admin pages in navy/blue/white.
- Temporary username/password sign-in; bcrypt-hashed passwords and HTTP-only signed 12-hour session cookies; backend checks roles.
- Sample student **Motaz Alaa**, sample class **CS301 — Database Systems (Fall 2026)**, sample instructor, admin, and five extra synthetic students.
- Instructor can start/end a class session; QR codes rotate every **15 seconds** (5 s grace), signed on the server and recorded as hashes in PostgreSQL.
- Student scans instructor QR with normal phone camera (or pastes a token). Enrollment, active session, code signature/expiry, server-issued challenge, class cut-off and uniqueness checked on the server.
- Database-level `UNIQUE(student_id, session_id)` prevents duplicate records even when requests run concurrently.
- Attendance history, status (present / late / manual), student requests for corrections, administrator reviews and audited changes.
- Instructor roster, live check-in count, assisted/manual attendance with mandatory recorded reason.
- Optional **single check-in** location permission in demo; never continuously tracks. The demo only records `unverified` / `not_collected` and optional accuracy, NOT an actual campus geofence.
- First-party pseudonymous browser ID, hashed server-side. When multiple accounts use the same ID in one session, basic **R1/R2 risk signals** are created for admin review — *not automated allegations or penalties*.
- Administrator can create classes, enroll existing demo students, review alerts and corrections, and inspect security events / audit logs.
- Database health test at `/api/health`.

## 1. Prerequisites

Install **Node.js 20.12+** (Node 22 recommended), npm, and PostgreSQL 14+ locally **or** use a hosted PostgreSQL project, e.g. Supabase.

## 2. Set up PostgreSQL (choose ONE path)

### Option A: Supabase (simple hosted setup)

1. Create an account and a **new empty project** at https://supabase.com/dashboard.
2. On the project's **Connect** page, copy a PostgreSQL connection string. Prefer the **Session Pooler** if your computer or host lacks IPv6; otherwise use a direct connection. Do not paste service-role API keys here — this is a PostgreSQL connection, not a Supabase API URL.
3. Replace the placeholder password with your **database password**. URL-encode any reserved characters in it. Your `DATABASE_URL` might look like:

   ```env
   DATABASE_URL="postgresql://postgres.PROJECTREF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"
   ```

   The exact hostname and username **must come from YOUR project's Connect page**; never use the example verbatim.
4. Save it in `.env.local` as explained below.
5. Run the setup and seed commands in section 4. PostgreSQL tables will be created automatically. You can see them in **Supabase → Table Editor**.

Alternatively, paste `db/schema.sql` into Supabase SQL Editor and run it, then still run `npm run db:seed` from your computer to populate the demo rows.

**Privacy:** the database will contain only fictional demo students plus your requested demo display name. Do not add real student information until university approval and privacy review. Choose your Supabase region and project access policy appropriately.

### Option B: Local PostgreSQL

Create an empty database (run as a PostgreSQL administrator):

```bash
psql -U postgres -c "CREATE DATABASE eui_attendance;"
```

Example local URL in `.env.local`:

```env
DATABASE_URL="postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/eui_attendance"
```

For a local database, SSL is normally not required. PostgreSQL must be running before continuing.

## 3. Configure environment

From the extracted project folder:

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and change all these values:

```env
DATABASE_URL="postgresql://...your actual database connection..."
AUTH_SECRET="PASTE_YOUR_FIRST_RANDOM_SECRET"
QR_SECRET="PASTE_A_DIFFERENT_RANDOM_SECRET"
APP_URL="http://localhost:3000"
```

Run this command **twice** and paste each output into `AUTH_SECRET` and `QR_SECRET` respectively:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

These secrets must be kept private. **Never commit `.env.local`**; it is included in `.gitignore`.

## 4. Create database tables, sample class and accounts

```bash
npm run db:setup
npm run db:seed
```

`db:setup` runs `db/schema.sql` (tables, foreign keys, unique constraints, and indexes). `db:seed` inserts synthetic demo data and prints the login details. Both scripts can be rerun for development. **Rerunning seed resets the demo passwords, reopens the sample live session, and does not clear attendance already recorded.**

Sample class: **CS301 — Database Systems**, Fall 2026, Hall B2.

| Role | Username | Password | Name |
| --- | --- | --- | --- |
| Student | `motaz` | `EUI-Demo-2026!` | Motaz Alaa |
| Instructor | `instructor` | `EUI-Demo-2026!` | Dr. Salma Hassan (fictional) |
| Admin | `admin` | `EUI-Demo-2026!` | EUI Demo Administrator |

The seed creates **6 demo students**, an active **Demo live attendance** session, one ended **Lecture 1** session with historical attendance, and one **SIMULATED** risk alert. All the demo accounts use the same non-secret sample password. This is for local development only.

## 5. Run the website

```bash
npm run dev
```

Open **http://localhost:3000**, or use `npm run build && npm start` for a local production-mode test. Try the three roles in the login panel.

### Trial walkthrough

1. Sign in as **`instructor`**, open the existing **Demo live attendance** session (or create a new session if its check-in cut-off has passed).
2. Leave the instructor browser on the live QR board. The QR updates every ~15 seconds.
3. On a second browser/device, sign in as **`motaz`**. Scan the current code to open the check-in link and confirm attendance. On the **same computer**, you can use separate browser profiles or an incognito window. If both roles share the same browser, sign out to switch roles.
4. The student sees a confirmation and attendance history; the instructor's live counter updates shortly after.
5. Try submitting the same token again: only one check-in is allowed per session.
6. Sign in as **`admin`** to view classes, the synthetic review alert, audit history, and correction requests. Add a new class if you'd like.

**Important for scanning with a phone:** `localhost` works only on the computer running the app. If the phone is a different device, expose the app through a **private HTTPS tunnel or a suitable HTTPS development deployment**, then set `APP_URL` to that exact URL and restart the Next.js server. The student's phone must be able to reach that address. Do not expose the sample-password demo publicly; if using a tunnel, restrict access and keep it temporary.

## 6. Microsoft approval and later sign-in integration

The current user-facing sign-in is **temporary local username and password**, **not** Microsoft sign-in. See **`MICROSOFT_APPROVAL_PLAN.md`** for the exact staged migration.

You will need EUI IT to approve an **Entra ID app registration** in the correct university tenant, redirect URIs, eligible user groups, minimal API permissions, enrollment data access (separately approved), and a lawful privacy/security basis.

**Never** ask users to type their actual Microsoft/university passwords into this application. When approved, use redirect-based **OpenID Connect Authorization Code + PKCE** through Microsoft's official sign-in page. Map the trusted directory `oid` + tenant `tid` to internal `users` IDs; **do not use email as the only permanent identity key**. Keep authorization and enrollment validation on the backend.

## 7. Security, scope and honest limitations

This project is an educational demo, **not production-ready**:

- Temporary local accounts and shared seed password are **not suitable for real students**. Disable demo login and remove demonstration accounts when Microsoft is enabled.
- A web-only 15-second QR cannot fully stop **live relaying**. The proposal suggests a changing room PIN, random spot-checks, headcount and context correlation as later mitigations.
- A website cannot obtain a permanent hardware identifier. Its local identifier is pseudonymous and resettable. Shared devices are common and not proof of misconduct.
- **Campus geofencing is not implemented**. The demo can optionally ask for a one-time location reading, which is only saved as `unverified` plus an accuracy estimate. Do not enable mandatory location until an approved campus boundary, accuracy policy and accessible fallback are in place.
- Initial R1/R2/R3/R8 review flags are demonstrative, not validated ML. The demo computes them after check-in / manual additions in the request path; a production system should move monitoring to an **asynchronous worker**. **No supervised model, Isolation Forest, automatic sanctions, biometric checks or real EUI records**.
- Temporary in-memory login rate limits are not shared between servers; production needs distributed rate limits, monitoring, MFA via Entra, HTTPS, security review and penetration testing.
- The demo illustrates the main Must-have architecture and several Should-have items; optional check-out, PIN challenges, advanced fraud rules, ML demo, timetable sync, native app and full policy settings are future work.
- Any real deployment needs approval by EUI and relevant privacy/data-protection stakeholders, including review under Egypt's Personal Data Protection Law (151/2020), hosting, retention, access controls, incident handling and WCAG accessibility testing.

### Key files

```text
app/login/                 Demo login UI
app/student/               Student dashboard and correction form
app/checkin/               QR check-in confirmation
app/instructor/            Instructor class list and live session board
app/admin/                 Admin classes, enrollment and review console
app/api/                   Role-protected server endpoints
lib/auth.ts                JWT cookie auth and backend identity lookups
lib/security.ts            QR signing, origin check and event/alert helpers
lib/db.ts                  PostgreSQL connection and transaction helper
db/schema.sql              PostgreSQL schema and integrity constraints
scripts/setup-db.mjs       Install schema
scripts/seed.mjs           Seed Motaz demo account and sample class
MICROSOFT_APPROVAL_PLAN.md Approval/migration checklist
```

### Commands

```bash
npm install                  # install dependencies
npm run db:setup             # create tables
npm run db:seed              # insert/reset synthetic seed accounts
npm run dev                  # dev server: http://localhost:3000
npm run build                # compile for local production-mode test
npm start                    # serve a built app
```

### Helpful database queries

Run in Supabase SQL Editor or `psql`:

```sql
SELECT id, username, full_name, role FROM users ORDER BY role, username;
SELECT code, title, term FROM subjects;
SELECT title, state, started_at FROM class_sessions ORDER BY started_at DESC;
SELECT u.full_name, s.title, a.status FROM attendance_records a
  JOIN users u ON u.id=a.student_id JOIN class_sessions s ON s.id=a.session_id;
SELECT rule_key, score, state, demo FROM risk_alerts;
```

If the app cannot connect, verify `DATABASE_URL`, database credentials, host/SSL settings, firewall/network reachability, and that `npm run db:setup` completed. The `/api/health` URL checks connectivity without showing database credentials.
