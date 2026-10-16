# EUI Smart Attendance

University course prototype for QR attendance with server-side location checks. Two students own it and defend it in front of their professor, so every change must be easy to explain. All data is synthetic; this is not an official EUI system.

## Stack

- **Next.js 15** (App Router), **React 19**, **TypeScript** (strict).
- **PostgreSQL** through `pg` with raw SQL (no ORM). Helpers in `lib/db.ts`: `query()` and `transaction()`.
- **Auth:** `jose` HS256 JWT in the httpOnly cookie `eui_demo_session` (`lib/auth.ts`); demo passwords hashed with `bcryptjs`.
- **QR:** `qrcode` renders an SVG on the server; the student scanner uses `html5-qrcode` 2.3.8 (the `Html5Qrcode` class only, never `Html5QrcodeScanner`).
- **Tests:** `tsx --test` with `node:test`.
- **Styles:** plain CSS in `app/globals.css` (tokens on `:root`); the projector page has its own CSS module. No UI framework.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Serve the production build |
| `npm test` | Unit tests for the location rules (`lib/location.test.ts`) |
| `npx tsc --noEmit` | Type check only |
| `npm run db:setup` | Run `db/schema.sql`, then every file in `db/migrations/` in name order (safe to repeat) |
| `npm run db:seed` | Insert/reset the synthetic demo accounts, class CS301 and the demo live session |
| `npm run sim:attack` | Attack simulation A–G against the running server; exit code 1 on any mismatch |
| `npm run load:test -- --seed 300` | Create 300 synthetic LOAD- students in class LOAD-TEST |
| `npm run load:test` | Fire one check-in per LOAD- student at once (use `npm run build && npm start`, not dev) |
| `npm run load:test -- --cleanup` | Remove the LOAD-TEST class, its sessions, events and students |

The db, sim and load scripts read `.env.local` (`DATABASE_URL`, `AUTH_SECRET`, `QR_SECRET`). The sim and load scripts refuse any server that is not `localhost`.

## Folder layout

```text
app/api/                      Role-protected API routes
app/api/checkin/              Student check-in (token, location decision, R1/R2/R3/R9)
app/api/sessions/[id]/        challenge, live, anchor, qr, manual, review, close
app/checkin/                  Student check-in page + in-site camera scanner (QrScanner.tsx)
app/instructor/session/[id]/  Live board (LiveBoard.tsx, useLiveSession.ts)
  present/                    Full-screen projector view
app/student/  app/admin/  app/login/
components/Shell.tsx          Layout, Stat, SectionHeader, StateBadge
lib/config.ts                 All Phase 1 settings from env (QR lifetime, location thresholds)
lib/location.ts               Pure location decision (haversine), tested by lib/location.test.ts
lib/security.ts               authorize(), parsePost(), QR token sign/parse, events, alerts
lib/auth.ts  lib/db.ts
db/schema.sql                 Full schema for fresh installs
db/migrations/                Idempotent changes for existing databases (002_phase1.sql, …)
scripts/                      setup-db, seed, sim-attack, load-test, dev-helpers
docs/PHASE1_BRIEF.md          The Phase 1 brief
PHASE1_NOTES.md               What Phase 1 changed and why, in simple English
README.md  TEST_PLAN.md
```

## How the code is built

- Every decision happens on the server. API routes call `authorize()`; POST routes also call `parsePost()` (Origin check); instructor routes check ownership with `sub.instructor_id`.
- Settings live in `lib/config.ts` only. Location rules stay pure in `lib/location.ts`.
- A schema change is a new idempotent file in `db/migrations/` plus the same change in `db/schema.sql`.
- Students never poll the server; only the instructor's board and projector poll `GET /live`.
- Student coordinates are never stored: only distance, accuracy and the decision.

## Rules

- **Never commit `.env.local` or any secret** (database URLs, `AUTH_SECRET`, `QR_SECRET`, tokens). `.env.example` holds placeholders only.
- **Before every commit, run `npx tsc --noEmit`, `npm run build` and `npm test`.** All three must pass.
- **Work on a branch.** Never push to `main`, and never merge or push, without asking first.
- **Keep `PHASE1_NOTES.md` up to date in simple English** (B1 level) whenever behaviour changes: what changed, why, which files, how to demo.
