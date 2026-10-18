# EUI Smart Attendance — working prototype

> **Online deployment:** see [`DEPLOY.md`](DEPLOY.md) (GitHub + Supabase + Vercel). GitHub Pages cannot run this project.

**A Next.js + TypeScript + PostgreSQL project based on the 18-page EUI Smart Attendance Project Proposal v2 (October 2026).**

> **DEMO, NOT AN OFFICIAL EUI SYSTEM.** The project uses synthetic data. Until Egypt University of Informatics approves Microsoft Entra ID integration, authentication uses locally stored **demo usernames and hashed passwords**. **Never enter university Microsoft credentials into the demo login page.** Do not connect real student records or publicly deploy this unreviewed prototype.

## Features ready to try

- Responsive student, instructor, and admin pages in navy/blue/white.
- Temporary username/password sign-in; bcrypt-hashed passwords and HTTP-only signed 12-hour session cookies; backend checks roles.
- Sample student **Motaz Alaa**, sample class **CS301 — Database Systems (Fall 2026)**, sample instructor, admin, and five extra synthetic students.
- Instructor can start/end a class session; QR codes rotate every **8 seconds** by default (3 s grace, both configurable), signed on the server and recorded as hashes in PostgreSQL. The QR holds only a signed code (`EUIA1.…`), **never a link**, so forwarding it opens nothing.
- Student scans the QR with the **camera scanner inside the website** (`/checkin`). There is no paste box, no image upload and no `?token=` link. Enrollment, active session, code signature/expiry, server-issued challenge, QR open/closed, class cut-off and uniqueness are checked on the server.
- **Location is judged by the server** (Phase 1): the phone sends its reading, the server compares it with the room position the instructor saved. In the room → *Verified*; unclear or missing → recorded as *Needs review*; far away (default > 1 km) → **refused** with a security event and a review alert (R9). Raw student coordinates are never stored.
- Database-level `UNIQUE(student_id, session_id)` prevents duplicate records even when requests run concurrently.
- Attendance history, status (present / late / manual), student requests for corrections, administrator reviews and audited changes.
- Instructor **live board** (updates every 2 s): room location, **Close / Reopen QR**, assisted check-in by searching name or student number (reason required, quick-pick chips), and review of each record (**Confirm** or **Mark absent**, both audited).
- **Projector view** (`/instructor/session/<id>/present`): full-screen QR, countdown ring, "42 / 186" counter and the latest check-ins. Keys: `Shift+F` fullscreen, `Shift+C` close/reopen QR (ignored while typing in a text field); a large notice shows for 2 seconds whenever the QR is closed or reopened.
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
```

Run this command **twice** and paste each output into `AUTH_SECRET` and `QR_SECRET` respectively:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

These secrets must be kept private. **Never commit `.env.local`**; it is included in `.gitignore`. (`APP_URL` is no longer used: the QR contains no link.)

### Optional Phase 1 settings

Leave these out to use the defaults. All of them are read in `lib/config.ts`; a value outside its allowed range stops the server with a clear error message.

| Variable | Default | Allowed | Meaning |
| --- | --- | --- | --- |
| `QR_INTERVAL_SECONDS` | `8` | 5–30 | How often the QR code changes. |
| `QR_GRACE_SECONDS` | `3` | 0–10 | Extra seconds a code still works after it changes (slow phones and networks). |
| `RADIUS_M` | `75` | 10–1000 | A student whose "gap" to the room is at most this is **inside** (Verified). |
| `MAX_ACCURACY_M` | `150` | 10–5000 | A student reading less precise than ±this goes to **review**. Also the least precise room location the instructor may save. |
| `REJECT_BEYOND_M` | `1000` | 100–100000 | A gap larger than this is **outside**: no record, security event `checkin_far_away`, alert R9. Must be larger than `RADIUS_M`. |

*Gap* = distance − student accuracy − room accuracy: the closest the two devices could really be. The rules are in `lib/location.ts` and tested by `npm test`.

## 4. Create database tables, sample class and accounts

```bash
npm run db:setup
npm run db:seed
```

`db:setup` runs `db/schema.sql` (tables, foreign keys, unique constraints, and indexes) and then every file in `db/migrations/` in name order. Every file is safe to run again, so **after pulling Phase 1 into an existing database, just run `npm run db:setup` once more**: `002_phase1.sql` adds the room location, QR open/closed and verification columns, and marks older QR records as *needs review* (they were never location-checked). `db:seed` inserts synthetic demo data and prints the login details. Both scripts can be rerun for development. **Rerunning seed resets the demo passwords, reopens the sample live session, and does not clear attendance already recorded.**

Sample class: **CS301 — Database Systems**, Fall 2026, Hall B2.

| Role | Username | Password | Name |
| --- | --- | --- | --- |
| Student | `motaz` | the `DEMO_PASSWORD` you set | Motaz Alaa |
| Instructor | `instructor` | the `DEMO_PASSWORD` you set | Dr. Salma Hassan (fictional) |
| Admin | `admin` | the `DEMO_PASSWORD` you set | EUI Demo Administrator |

The seed creates **6 demo students**, an active **Demo live attendance** session, one ended **Lecture 1** session with historical attendance, and one **SIMULATED** risk alert. All the demo accounts use the password you put in `DEMO_PASSWORD` (it is never written in the code). This is for local development only.

## 5. Run the website

```bash
npm run dev
```

Open **http://localhost:3000**, or use `npm run build && npm start` for a local production-mode test. Try the three roles in the login panel.

### Trial walkthrough

1. Sign in as **`instructor`**, open the existing **Demo live attendance** session (or create a new session if its check-in cut-off has passed).
2. Press **Set room location**. Do this from a phone inside the room (see below): a laptop's location is usually too imprecise and is refused. Without a room location every check-in goes to review.
3. Press **Open projector view** and put that tab on the projector (`Shift+F` = fullscreen). The QR changes every 8 seconds.
4. On a phone, sign in as **`motaz`** and open **Check in**. Allow location and the camera, then point the camera at the QR. The page shows *Present/Late* and *Verified/Needs review*.
5. The live board and the projector counter update within 2 seconds. Scan again: only one check-in is allowed per session.
6. Press **Close QR** (or `Shift+C` on the projector): scans are refused, but you can still add a student with **Assisted check-in** (search by name or number, give a reason).
7. In the roster, use **Confirm** or **Mark absent** on a *Needs review* record.
8. Sign in as **`admin`** to see the security events, the R9 alerts, audit history and correction requests.

### Testing on a real phone

The camera and precise location only work on **HTTPS** pages. `localhost` counts as secure only on the computer that runs the app, so a phone needs a temporary HTTPS address:

1. Build and start the app: `npm run build && npm start`.
2. In a second terminal, open a temporary tunnel (install `cloudflared` first):

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. It prints a random `https://….trycloudflare.com` address. Open that address on the phone (and on the instructor's phone to set the room location).
4. When you finish, **stop the tunnel with Ctrl+C**.

> **Warning:** while the tunnel is open, anyone who has the address can reach your demo, and can try to guess the demo password. Keep the tunnel open only while you test, never share the address publicly, and never put real student data behind it.

## 6. Microsoft approval and later sign-in integration

The current user-facing sign-in is **temporary local username and password**, **not** Microsoft sign-in. See **`MICROSOFT_APPROVAL_PLAN.md`** for the exact staged migration.

You will need EUI IT to approve an **Entra ID app registration** in the correct university tenant, redirect URIs, eligible user groups, minimal API permissions, enrollment data access (separately approved), and a lawful privacy/security basis.

**Never** ask users to type their actual Microsoft/university passwords into this application. When approved, use redirect-based **OpenID Connect Authorization Code + PKCE** through Microsoft's official sign-in page. Map the trusted directory `oid` + tenant `tid` to internal `users` IDs; **do not use email as the only permanent identity key**. Keep authorization and enrollment validation on the backend.

## 7. Security, scope and honest limitations

This project is an educational demo, **not production-ready**:

- Temporary local accounts and shared seed password are **not suitable for real students**. Disable demo login and remove demonstration accounts when Microsoft is enabled.
- An 8-second web QR plus a location check still cannot fully stop **live relaying**: a friend in the room can stream the QR to someone just outside who scans it from a second screen within the code lifetime. A changing room PIN, random spot-checks, headcount and context correlation are **planned**, not built.
- **GPS-spoofing apps** can fake a location; the browser cannot detect them. Readings are also reported by the phone itself, so a student can send a poor accuracy or no location at all — those check-ins are not refused, they go to the instructor as *Needs review*.
- Indoors, phone GPS can be weak; expect some honest students in *Needs review*. Tune `RADIUS_M` and `MAX_ACCURACY_M` after measuring real rooms.
- A website cannot obtain a permanent hardware identifier. Its local identifier is pseudonymous and resettable. Shared devices are common and not proof of misconduct.
- The location check compares each student with **one room position per session**, not an approved campus boundary. An official campus boundary, accuracy policy and accessible fallback are **planned** and need university approval.
- The in-site scanner uses `html5-qrcode` 2.3.8, whose last release was in 2023. Real-phone tests (a)–(d) **passed on an iPhone with Safari** (see `PHASE1_NOTES.md`). Still **pending**: test (e) (relay from home) and **Android Chrome**.
- Initial R1/R2/R3/R8/R9 review flags are demonstrative, not validated ML. The demo computes them after check-in / manual additions in the request path; a production system should move monitoring to an **asynchronous worker**. **No supervised model, Isolation Forest, automatic sanctions, biometric checks or real EUI records**.
- Temporary in-memory login rate limits are not shared between servers; production needs distributed rate limits, monitoring, MFA via Entra, HTTPS, security review and penetration testing.
- The demo illustrates the main Must-have architecture and several Should-have items; optional check-out, PIN challenges, advanced fraud rules, ML demo, timetable sync, native app and full policy settings are future work.
- Any real deployment needs approval by EUI and relevant privacy/data-protection stakeholders, including review under Egypt's Personal Data Protection Law (151/2020), hosting, retention, access controls, incident handling and WCAG accessibility testing.

### Key files

```text
app/login/                         Demo login UI
app/student/                       Student dashboard and correction form
app/checkin/                       Check-in page and in-site camera scanner (QrScanner.tsx)
app/instructor/                    Instructor class list
app/instructor/session/[id]/       Live board (LiveBoard.tsx, useLiveSession.ts)
app/instructor/session/[id]/present/  Projector view
app/admin/                         Admin classes, enrollment and review console
app/api/                           Role-protected server endpoints
app/api/sessions/[id]/             challenge, live, anchor, qr, manual, review, close
lib/auth.ts                        JWT cookie auth and backend identity lookups
lib/security.ts                    QR token signing/parsing, origin check, event/alert helpers
lib/config.ts                      Phase 1 settings (QR lifetime, location thresholds)
lib/location.ts                    Pure location decision (haversine) + lib/location.test.ts
lib/db.ts                          PostgreSQL connection and transaction helper
db/schema.sql                      PostgreSQL schema (fresh installs)
db/migrations/002_phase1.sql       Phase 1 changes for existing databases
scripts/setup-db.mjs               Run schema.sql, then every migration
scripts/seed.mjs                   Seed Motaz demo account and sample class
scripts/sim-attack.mjs             Proxy-attendance attack simulation (dev only)
scripts/load-test.mjs              Simultaneous check-in load test (dev only)
MICROSOFT_APPROVAL_PLAN.md         Approval/migration checklist
PHASE1_NOTES.md                    What Phase 1 changed, in simple English
```

### Commands

```bash
npm install                        # install dependencies
npm run db:setup                   # create tables and apply migrations (safe to repeat)
npm run db:seed                    # insert/reset synthetic seed accounts
npm run dev                        # dev server: http://localhost:3000
npm run build                      # compile for local production-mode test
npm start                          # serve a built app
npm test                           # unit tests for the location rules
npm run sim:attack                 # attack simulation; needs the running server (exit code 1 = failure)
npm run load:test -- --seed 300    # create 300 synthetic LOAD- students
npm run load:test                  # 300 simultaneous check-ins; needs `npm run build && npm start`
npm run load:test -- --cleanup     # remove the synthetic load-test data
```

`sim:attack` and `load:test` are **development tools only**: they read `AUTH_SECRET` and `QR_SECRET` from `.env.local`, create their own sessions in the local database, and refuse to run against anything but `localhost`.

### Helpful database queries

Run in Supabase SQL Editor or `psql`:

```sql
SELECT id, username, full_name, role FROM users ORDER BY role, username;
SELECT code, title, term FROM subjects;
SELECT title, state, started_at FROM class_sessions ORDER BY started_at DESC;
SELECT u.full_name, s.title, a.status, a.verification, a.location_result, a.distance_m FROM attendance_records a
  JOIN users u ON u.id=a.student_id JOIN class_sessions s ON s.id=a.session_id;
SELECT rule_key, score, state, demo, evidence FROM risk_alerts;
SELECT type, details, created_at FROM security_events ORDER BY created_at DESC LIMIT 20;
```

If the app cannot connect, verify `DATABASE_URL`, database credentials, host/SSL settings, firewall/network reachability, and that `npm run db:setup` completed. The `/api/health` URL checks connectivity without showing database credentials.
