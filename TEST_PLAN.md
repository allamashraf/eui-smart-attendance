# Prototype testing checklist

Two kinds of checks: **automated** ones (scripts in this repository) and **manual** ones (a person with a browser or phone). Manual items are **not claimed as passed** unless a result is written next to them.

## Automated checks

| Command | What it proves | Last result |
| --- | --- | --- |
| `npx tsc --noEmit` | TypeScript compiles with no errors. | PASS (2026-10-15) |
| `npm run build` | The production build succeeds. | PASS (2026-10-15) |
| `npm test` | 18 unit tests for `decideLocation` / `parseReading`: inside, uncertain, outside, no location, no anchor, exact radius and reject boundaries, bad input. | 18/18 PASS (2026-10-15) |
| `npm run db:setup` (twice) | The migration is idempotent; a fresh install and a migrated database have the same columns, constraints and indexes. | PASS (2026-10-15) |
| `npm run sim:attack` | Cases A–G below, against the running server. Exit code 1 on any mismatch. | 7/7 PASS (2026-10-15) |
| `npm run load:test` (300 students) | 300 simultaneous check-ins with one fresh code: no errors, no duplicates, 300 records. | PASS: 2.21 s total, p95 2106 ms; second run 1.58 s, p95 1512 ms (2026-10-15, one Windows laptop running app, database and test together) |

`sim:attack` cases:

- **A** In-room student 20 m from the room → present, verified.
- **B** Friend 25 km away with a fresh, valid code → refused, no record, security event `checkin_far_away`, alert R9 with the distance.
- **C** Student who denies location → recorded, needs review.
- **D** Code older than interval + grace → refused as expired.
- **E** Same student submits twice at the same moment → exactly one record.
- **F** QR closed → scan refused; manual add with a reason → recorded as manual and audited.
- **G** The challenge response contains no URL and no raw token field.

Screenshots with Playwright: **skipped**, Playwright is not installed in this project. As a partial replacement, `/checkin`, the live board, the projector page, `/student` and `/admin` were opened in a browser at 390×844 and 1366×850, and `document.documentElement.scrollWidth <= innerWidth` was true on every page (2026-10-15).

## Core demonstration (manual)

- [ ] Open `/api/health` and verify `database: connected`.
- [ ] Sign in as `motaz` (your `DEMO_PASSWORD`); dashboard shows Motaz Alaa and CS301.
- [ ] Sign out; sign in as `instructor`; create a fresh session and open its live board.
- [ ] Press **Set room location** on a phone inside the room; the board shows "Room location set (±X m)". On a laptop with only Wi-Fi location, expect a clear refusal.
- [ ] Open the projector view; the QR changes every 8 seconds and the ring counts down.
- [ ] On a phone (HTTPS tunnel, see README), sign in as `motaz`, open **Check in**, allow camera and location; the location line shows "Location ±X m".
- [ ] Scan the projector QR; the phone shows Present/Late and Verified. The board and projector counters update within 2 seconds.
- [ ] Deny location and scan with another student; the record shows *Needs review* with the reason "no location shared".
- [ ] Take a photo of the QR, wait 15 seconds, scan the photo from another screen: expect "That code had just changed" and the scanner keeps going.
- [ ] Press **Close QR**; a scan shows "Check-in is closed". Add a student by searching their name or number and choosing a reason chip.
- [ ] **Confirm** one *Needs review* record and **Mark absent** another (reason required). The student marked absent cannot scan again.
- [ ] End session. Scans and assisted check-in are refused; Confirm / Mark absent still work.
- [ ] Repeat the phone test on **Android Chrome** and **iOS Safari** (not yet done).

## Roles and audit (manual)

- [ ] As student, opening `/admin` redirects to the student dashboard; API calls to `/api/admin/classes` return `403`.
- [ ] As instructor, open a class not assigned to that instructor; the backend refuses access.
- [ ] As admin, create a new class and enroll an existing demo student; verify new rows in Supabase or psql.
- [ ] Check `audit_logs` for `room_location_set`, `qr_closed`, `qr_reopened`, `manual_checkin`, `attendance_confirmed`, `attendance_marked_absent`.
- [ ] As student, request a correction; admin can approve/reject with reviewer notes; audit logs record the review.
- [ ] Admin can review the seeded **synthetic** alert and an R9 alert (inconclusive / legitimate / confirmed) with notes.

## Safety and privacy (manual)

- [ ] Confirm that university Microsoft credentials are never entered into any prototype page.
- [ ] Confirm the database stores only `location_result`, `accuracy_m` and `distance_m` for students, **not raw GPS coordinates** (also not in `security_events`, `risk_alerts` or `audit_logs`).
- [ ] Confirm raw QR token is absent from `attendance_challenges` (only SHA-256 hash) and from the challenge API response.
- [ ] Check database constraint `UNIQUE(student_id, session_id)` and foreign keys.
- [ ] Check events and audit logs contain no passwords, cookie values or raw authentication secrets.
- [ ] Check the demo is clearly labeled as synthetic and not an official EUI system.

## Further work (planned, not built)

- [ ] Accessibility WCAG 2.1 AA evaluation and camera alternative usability checks.
- [ ] Approved campus boundary instead of one room position per session; accuracy policy agreed with EUI.
- [ ] Optional room PIN, random spot-checks, headcount and check-out scanning against live relaying.
- [ ] Move post-check-in risk analysis into an asynchronous worker.
- [ ] Approved Microsoft Entra OIDC integration and verified university enrollment data.
- [ ] Validate privacy, retention, hosting, device-association and incident response policies with EUI.
- [ ] Load test on a separate server and database (the numbers above come from one laptop).

## SQL inspections

Use `db/inspection.sql` for example read-only reports. The DB's uniqueness rule is defined in `db/schema.sql` as:

```sql
UNIQUE(student_id,session_id)
```

This is the authoritative control against duplicate attendance; JavaScript-only checks are insufficient for concurrent requests.
