# Prototype testing checklist

These are tests to run **after** installing dependencies and connecting PostgreSQL. They are **not claimed as passed**. Only source syntax/import checks have been performed in the authoring environment.

## Core demonstration

- [ ] Open `/api/health` and verify `database: connected`.
- [ ] Sign in as `motaz` (`EUI-Demo-2026!`); dashboard shows Motaz Alaa and CS301.
- [ ] Sign out; sign in as `instructor`; demo session and student roster appear.
- [ ] Create a fresh session and open its live board.
- [ ] Watch the instructor QR update after about 15 seconds.
- [ ] Sign in as `motaz` in another browser or phone, scan the current QR and confirm attendance.
- [ ] Student history and instructor counter reflect the inserted PostgreSQL record.
- [ ] Try the same check-in again. The server refuses duplicate attendance.
- [ ] Wait at least 21 seconds after a QR is generated, then use that old QR. Expect expiry error.
- [ ] End session. All subsequent check-ins to it are refused.

## Roles and audit

- [ ] As student, opening `/admin` redirects to the student dashboard; API calls to `/api/admin/classes` return `403`.
- [ ] As instructor, open a class not assigned to that instructor; the backend refuses access.
- [ ] As admin, create a new class and enroll an existing demo student; verify new rows in Supabase or psql.
- [ ] As instructor, manually add an enrolled student (without QR), entering a reason of at least 10 characters; verify `audit_logs`.
- [ ] As student, request a correction; admin can approve/reject with reviewer notes; audit logs record the review.
- [ ] Admin can review the seeded **synthetic** alert (inconclusive / legitimate / confirmed) with notes.

## Safety and privacy

- [ ] Confirm that university Microsoft credentials are never entered into any prototype page.
- [ ] With location option unchecked, attendance works on classes where location is not mandatory.
- [ ] Confirm database stores `location_result` and accuracy only, **not raw GPS coordinates**.
- [ ] Confirm raw QR token is absent from `attendance_challenges` (only SHA-256 hash).
- [ ] Check database constraint `UNIQUE(student_id, session_id)` and foreign keys.
- [ ] Check events and audit logs contain no passwords, cookie values or raw authentication secrets.
- [ ] Check the demo is clearly labeled as synthetic and not an official EUI system.

## Further work (not yet implemented)

- [ ] 100-request concurrent duplicate prevention load test.
- [ ] 300 students / 60 seconds performance test, aiming for p95 under 2 seconds.
- [ ] Accessibility WCAG 2.1 AA evaluation and camera alternative usability checks.
- [ ] Approved geofence with accuracy-aware retry and accessible alternative.
- [ ] Optional room PIN, spot-check, headcount, check-out scanning and relay simulation.
- [ ] Move post-check-in risk analysis into an asynchronous worker.
- [ ] Approved Microsoft Entra OIDC integration and verified university enrollment data.
- [ ] Validate privacy, retention, hosting, device-association and incident response policies with EUI.

## SQL inspections

Use `db/inspection.sql` for example read-only reports. The DB's uniqueness rule is defined in `db/schema.sql` as:

```sql
UNIQUE(student_id,session_id)
```

This is the authoritative control against duplicate attendance; JavaScript-only checks are insufficient for concurrent requests.
