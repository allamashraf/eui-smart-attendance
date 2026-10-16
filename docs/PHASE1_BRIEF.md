# Phase 1 brief: EUI Smart Attendance

You are working on a university course prototype built with Next.js 15, React 19, TypeScript, PostgreSQL (`pg`, raw SQL) and `jose` JWT cookies. Two students own it and will defend it in front of their professor. They must understand every change, so clarity matters as much as correctness.

## Why this phase exists

The prototype's purpose is to stop proxy attendance, and today it doesn't. A scripted test against the running app showed:

- A student in the room scanned the QR. A friend 25 km away opened the forwarded link 8 seconds later and was recorded **present**. A third student sent no location at all and was also recorded **present**. Zero alerts were raised.
- Cause 1: the QR encodes a full URL (`/checkin?token=...`). Anyone can forward it as text, and the instructor board even shows the URL with a copy button (`app/instructor/session/[id]/LiveBoard.tsx`).
- Cause 2: location is optional, requested with `enableHighAccuracy: false` (coarse cell-tower location), and never compared to anything. The server stores `location_result = 'unverified'` for every coordinate (`app/api/checkin/route.ts`).

The team also agreed on things the prototype contradicts:

- Scanning must happen with a camera **inside the website** (as in the university's current CIS attendance), not with the phone's camera app.
- The instructor can **close the QR** and then still add students who have no phone, by searching their name or student ID. Today, manual add only works while the session is active (`app/api/sessions/[id]/manual/route.ts` requires `state='active'`), "End session" is the only way to stop the QR, students are picked from a dropdown, and the "mandatory" reason textarea is pre-filled. That makes the reason meaningless.

The university's current system reportedly freezes. Phase 1 must not introduce anything that makes the server work harder per student. **Students never poll.** Only the instructor screen fetches periodically.

## Step 0: plan first, then wait

Read the codebase (`lib/`, `app/api/`, `app/checkin/`, `app/instructor/`, `db/schema.sql`, `scripts/`). Then reply with:

1. the files you will change or add,
2. the migration,
3. the order of work packages,
4. anything in this brief that conflicts with the code.

**Wait for my "go" before editing.** If you find a conflict later, stop and ask. Don't guess.

## Work packages (do them in this order)

### WP1: code lifetime and payload
- Make the rotation interval and grace configurable: `QR_INTERVAL_SECONDS` (default **8**, allowed 5–30) and `QR_GRACE_SECONDS` (default **3**, allowed 0–10). Use one config module for both `parseQrToken` in `lib/security.ts` and the hard-coded `interval '5 seconds'` in the check-in SQL.
- The QR payload is the signed token only, with a prefix: `EUIA1.<sessionId>.<slot>.<sig>`. No URL anywhere. Keep the HMAC.
- `GET /api/sessions/[id]/challenge` returns the QR image, `expiresAt` and the server's `now`. Remove `url` and `manualToken` from the response. `APP_URL` is no longer needed for the QR.

**Acceptance:** an expired token is rejected after interval + grace. The challenge response contains no URL and no raw token field.

### WP2: location decision (server is the judge)
- Add `lib/location.ts` with a **pure** function `decideLocation(student, anchor, cfg)`, where `student` and `anchor` are `{lat, lon, accuracyM}` or `null`, using a haversine distance. Rules, with every threshold read from env and documented:
  - `student == null` → `no_location` → record created, `verification = 'needs_review'`
  - `anchor == null` → `no_anchor` → record created, `needs_review`
  - `d - accS - accA > REJECT_BEYOND_M` (default 1000) → `outside` → **no record**; log security event `checkin_far_away` and create alert `R9` with the distance
  - `accS > MAX_ACCURACY_M` (default 150) or `d - accS - accA > RADIUS_M` (default 75) → `uncertain` → record created, `needs_review`
  - otherwise → `inside` → `verification = 'verified'`
- Migration `db/migrations/002_phase1.sql`, idempotent (`ADD COLUMN IF NOT EXISTS`):
  - on `class_sessions`: `anchor_lat`, `anchor_lon`, `anchor_accuracy_m`, `anchor_set_at`, `qr_open boolean NOT NULL DEFAULT true`
  - on `attendance_records`: `verification` (`verified` | `needs_review` | `manual`), `distance_m`
  - Update `scripts/setup-db.mjs` to run `schema.sql` and then every migration in order. Keep `schema.sql` in sync for fresh installs.
- **Privacy:** don't store raw student coordinates. Store the distance, the accuracy and the decision only. The anchor (the instructor's room position) may be stored.
- `POST /api/checkin` validates numbers (finite, valid lat/lon ranges, accuracy 0–100000), calls `decideLocation`, and keeps everything inside the existing transaction and the `UNIQUE(student_id, session_id)` constraint. Keep R1/R2/R3 working.

**Acceptance:** unit tests (WP6) pass, and the rejected/outside path writes no attendance row.

### WP3: student check-in page (in-site scanner)
- Use `html5-qrcode` through the `Html5Qrcode` class. Don't use `Html5QrcodeScanner`, because it offers image-file scanning. Load it with a dynamic import in a client component. Camera: `facingMode: 'environment'`. Accept only payloads that start with `EUIA1.`. Stop the camera after a successful decode and on unmount.
- Remove the token textarea and support for `?token=` on `/checkin`. **No paste, no upload, no typing a code.**
- **Location must be ready before the scan**, because the code expires in seconds. On page load, start `watchPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })` and keep the best reading (lowest accuracy) from the last 30 s. Show it live, for example "Location ±23 m". On decode, submit immediately with the best reading or `null`. Never wait for GPS after the scan. If there is still no reading after 20 s, say plainly that the student can still check in and that the instructor will review it.
- Clear states and messages: camera permission denied or no camera ("Ask your instructor for assisted check-in"), expired code (resume scanning automatically), success (show Present/Late plus Verified or Needs review), already checked in, QR closed.

**Acceptance:** works on Android Chrome and iOS Safari over HTTPS (localhost counts as secure for desktop testing).

### WP4: instructor controls
- **Room anchor:** on the live board, request the instructor's location (high accuracy, best reading over about 10 s) and `POST /api/sessions/[id]/anchor`. Show "Room location set (±X m) · Update". If it is missing, show a banner: "Without room location, every check-in goes to review."
- **Close / reopen QR:** `POST /api/sessions/[id]/qr {open}`, audited. When the QR is closed, the challenge endpoint returns `state: 'qr_closed'` and issues no token, and check-in returns "Check-in is closed. Ask your instructor." "End session" keeps its current meaning: everything stops, and later fixes go through the existing correction flow.
- **Manual add** works while the session is active, whether the QR is open or closed. Use a search box that matches name or student number and lists only students without a record. The reason is required and starts **empty**. Add quick-pick chips that fill it in (No phone · Dead battery · Camera not working · Accessibility), and keep it editable. Keep the audit log and R8.
- **Review on the board:** each roster row shows a status chip (Verified · Needs review · Late · Manual). The instructor can **Confirm** a needs-review record or **Mark absent** (removes the record). Both are audited with a reason.
- **Live data:** add `GET /api/sessions/[id]/live` (instructor-only, ownership checked) returning counts, roster statuses and the 8 most recent check-ins in one efficient query. The board polls it every 2 s instead of saying "Refresh this page". The QR image refreshes exactly at `expiresAt`, corrected for clock skew using the server's `now`.

### WP5: projector page
- `/instructor/session/[id]/present`: full-screen, high-contrast layout. QR sized to `min(78vh, 78vw)` with a proper quiet zone, a countdown ring for the code lifetime, a large "42 / 186" counter, and a live feed of the last 8 names fading in. When the QR is closed, show a large "Check-in closed" state.
- Add a fullscreen button (handle rejection quietly) and keyboard shortcuts: `F` for fullscreen, `C` to close or reopen the QR. No URL or token text anywhere on the page.
- Link to it from the live board ("Open projector view").

### WP6: proof scripts and tests (these decide whether you are done)
- `npm test`: unit tests for `decideLocation` using `tsx --test` (add `tsx` as a dev dependency). Cover at least: same point ±15 m → inside · 60 m away ±20 m → inside · 400 m away ±30 m → uncertain · 25 km away ±2500 m → outside · 25 km away ±30 m → outside · near but ±600 m → uncertain · null student → no_location · null anchor → no_anchor · exactly at the radius boundary.
- `scripts/sim-attack.mjs` (dev only; needs the running server, the DB and `AUTH_SECRET`; mints session cookies the same way `lib/auth.ts` does). It sets an anchor, then prints an **expected vs actual** table and exits non-zero on any mismatch:
  - A. in-room student 20 m from the anchor → present, verified
  - B. friend 25 km away with a fresh valid token → rejected, plus security event and R9 alert
  - C. student with location denied → recorded, needs_review
  - D. token older than interval + grace → rejected as expired
  - E. same student submits twice → exactly one record
  - F. QR closed → scan rejected; manual add with a reason → recorded as manual and audited
  - G. challenge response has no URL and no raw token field
- `scripts/load-test.mjs`: `--seed N` creates N enrolled synthetic students (prefix `LOAD-`), the run fires N simultaneous check-ins with one fresh token and in-room locations, and `--cleanup` removes them. Print the total time, p50, p95, error count, duplicate count (must be 0) and the final record count (must equal N). Default N = 300.
- If Playwright is available, screenshot `/checkin`, the live board, the projector page and `/admin` at 390×844 and 1366×850, and assert `document.documentElement.scrollWidth <= innerWidth`. If it isn't available, skip this and say so.

### WP7: docs
- Update `README.md` (setup, the new env variables and their defaults, migrations, and a "Testing on a real phone" section using a temporary HTTPS tunnel such as `cloudflared tunnel --url http://localhost:3000`, with a warning not to leave it open) and `TEST_PLAN.md`. Mark anything not built as **planned**.
- Write `PHASE1_NOTES.md` in **simple English (B1 level)**. For each work package, write 3–6 lines: what changed, why, which files, and how to demo it. End with "Known limits" stated honestly: GPS-spoofing apps, and a friend streaming the QR live to someone outside who scans it from a second screen within the code lifetime.

## Constraints
- Keep the stack. No ORM, no UI framework, no paid services. New dependencies: `html5-qrcode` and dev-only `tsx`, nothing else unless you ask first.
- Reuse the existing design tokens and classes in `app/globals.css`. The projector page may add its own scoped styles.
- Every decision happens on the server. Every new endpoint uses `authorize()` and `parsePost()` (origin check) and verifies that the instructor owns the session, like the existing queries do with `sub.instructor_id`.
- Don't break corrections, admin review, audit logs or R1/R2/R3/R8.
- Small optional polish, only if everything above is done: on screens under 540 px, render the student's attendance history as cards instead of a sideways-scrolling table.

## How to work
- After **each** work package, run `npx tsc --noEmit` and `npm run build` plus that package's tests, then `git commit -m "phase1(wpN): <summary>"`.
- Run `npm run db:setup` twice to prove the migration is idempotent.
- Finish with a report: a table of every check (PASS/FAIL), the load-test numbers, the sim-attack table, a list of the files you changed, and anything you could not verify (for example, a real iPhone).
