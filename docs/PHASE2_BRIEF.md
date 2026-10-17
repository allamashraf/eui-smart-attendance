# Phase 2 brief: attendance analytics

Read `CLAUDE.md` and `PHASE1_NOTES.md` first. Phase 1 is finished and merged into `main`. Do not change Phase 1 behaviour.

## Why this phase exists

The team agreed with the professor on **two features: attendance and analytics**. Attendance works and has been tested on a real iPhone. Analytics barely exists. Today the student page computes "attended / sessions" with a naive query in `app/student/page.tsx`:

- it counts **active** sessions as held;
- it counts **needs_review** records as attended;
- it ignores **when the student enrolled**.

The professor will ask "how is this percentage calculated?". Every number in this phase must have **one written definition**, **one pure function** that computes it, and **a test** that proves it.

## Step 0: plan first, then wait

Read the code (`app/student`, `app/instructor`, `app/admin`, `lib/`, `db/`, `scripts/seed.mjs`). Then reply with:

1. the files you will add or change;
2. any migration or index you need;
3. the work-package order;
4. anything in this brief that conflicts with the code or with Phase 1.

**Wait for my "go".** Then create a branch `phase2` from `main`. Commit `docs/PHASE2_BRIEF.md` first.

## Metric definitions (the contract)

Put every rule in `lib/analytics.ts` as **pure functions with no database access**. All thresholds come from `lib/config.ts`, read from env with safe bounds and documented defaults.

- **Held session:** a session of the subject with `state = 'ended'`. Active sessions are never counted in percentages.
- **Expected sessions for a student:** held sessions that **started on or after the student's enrollment `created_at`**. A student who joined in week 3 is not absent for weeks 1–2. Withdrawn enrollments are excluded from rosters and class averages.
- **Attended (confirmed):** a record with `verification` in (`verified`, `manual`). `status` can be `present`, `late` or `manual`.
- **Pending:** a record with `verification = 'needs_review'`. It is **not** counted as attended yet, and it is always shown next to the rate (for example "82% confirmed · 2 pending"). Also show the rate "if all pending are confirmed".
- **Late:** a confirmed record with `status = 'late'`. It counts as attended and is also counted separately.
- **Absent:** expected sessions minus confirmed minus pending. A student marked absent has no record, so the session counts as absent.
- **Attendance rate:** confirmed ÷ expected. If expected is 0, show "—", not 0% and not 100%.
- **Absence rate:** absent ÷ expected.
- **Risk band:** `ok` / `at_risk` / `over_limit`, from the absence rate:
  - `ABSENCE_LIMIT_PERCENT`, default **25**: `over_limit` when the absence rate is greater than this;
  - `ABSENCE_WARNING_PERCENT`, default **15**: `at_risk` from this value up to the limit.
  The real limit is a university policy we have not confirmed. Write it as an open question in the notes.
- **Session attendance:** for one held session, confirmed ÷ students actively enrolled at that session's start, with on-time, late, manual and pending counts shown separately.

## Work packages (in this order)

### WP1: analytics library and tests
- `lib/analytics.ts`: types and pure functions for every definition above, including the risk band and the "—" case.
- `lib/analytics.test.ts`. Cover at least: no held sessions; a student enrolled after some sessions; late counts as attended; manual counts as attended; pending is not attended but changes the "if confirmed" rate; marked absent counts as absent; exact boundaries at 15% and 25%; a withdrawn student excluded from the class average.
- Change `npm test` so it runs every `lib/*.test.ts` file.

### WP2: data access
- `lib/analytics-queries.ts`: a few **aggregated** SQL queries (raw `pg`, no ORM) that load the counts for one subject, one student, and the admin overview. No query inside a loop. Add an index only if the plan shows a need, as an idempotent migration `db/migrations/003_phase2.sql` with `schema.sql` kept in sync.
- API routes (GET, role and ownership checked like `/live`):
  - `GET /api/analytics/subject/[id]`: instructor who owns the subject, or admin;
  - `GET /api/analytics/me`: the signed-in student's own data only;
  - `GET /api/analytics/overview`: admin only;
  - `GET /api/analytics/subject/[id]/export`: CSV of the student table (UTF-8 with BOM so Excel opens it correctly), same rights as the subject route.

### WP3: instructor analytics page
- `/instructor/analytics/[subjectId]`, linked from the instructor home and from each live board.
- **Top row:** sessions held, class average rate, students at risk, students over the limit, pending reviews.
- **Trend chart:** one bar per held session, stacked on-time / late / manual, with pending shown as an outline. Hand-built **SVG**, no chart library. Every bar has a text label and a `<title>`, and there is a table toggle for the same numbers.
- **Student table:** name, student number, confirmed/expected, rate, late, absent, pending, risk chip. Sort by any column, filter "at risk + over limit", search by name or number.
- **Student drill-down:** each session with its status, verification and reason (for manual records).
- **Integrity panel:** per session, the counts of needs_review, manual additions, and alerts by rule (R1, R2, R3, R8, R9). This links Phase 1 to analytics.
- **Export CSV** button.

### WP4: student view
- On `/student`, for each class: a rate ring or bar, "absences used: X of Y allowed" with the limit, the late count, the pending count, and a clear warning when at risk or over the limit.
- Replace the naive counts at the top of the page with the new definitions. A student never sees another student's data.

### WP5: admin overview
- On `/admin`, add an analytics tab: classes ranked by average rate, open alerts per class, and manual additions per instructor (context for R8). Keep it small.

### WP6: demo data for analytics
- `scripts/seed-analytics.mjs` with `--cleanup`. It must be **deterministic** (fixed random seed) and must not touch "Demo live attendance".
- For CS301, add 24 synthetic students (`DEMO-007` to `DEMO-030`) and 10 **ended** sessions over the last 5 weeks (two per week, about 10:00 Cairo time). Make the patterns realistic:
  - most students between 85% and 100%;
  - 4 students at risk and 2 over the limit;
  - some late arrivals, a few manual additions with reasons, and a few pending reviews;
  - one student who enrolled in week 3;
  - a few R1 and R9 alerts on past sessions.
- Everything stays clearly synthetic. Add `npm run db:seed:analytics`.

### WP7: proof
- `scripts/verify-analytics.mjs`: for every student and every session in CS301, recompute the numbers **directly with plain SQL**, independent of `lib/analytics.ts`, and compare them with the API output. Print a short table and exit non-zero on any mismatch.
- Run `npm run sim:attack` again: it must still pass 7/7.
- Measure the subject analytics route with the seeded data and report the time.
- In the browser pane, check `/instructor/analytics/...`, `/student` and `/admin` at 390×844 and 1366×850: no sideways scroll, readable charts, and working sorting and filters.

### WP8: docs
- `PHASE2_NOTES.md` in **simple English (B1)**:
  - "Metric definitions" with every formula in words;
  - per work package: what changed, why, which files, and how to demo it;
  - "Design decisions";
  - "Known limits";
  - "Questions for the professor": the absence limit, and whether pending check-ins should count.
- Update `README.md` (new env variables, the new commands), `TEST_PLAN.md`, and the commands table in `CLAUDE.md`.

## Design bar (it must look like a real product, not a school table)
The professor will judge this page in the first five seconds, so readability is the design.
- **First screen answers three questions without scrolling at 1366×850:** How is the class doing? Who is at risk? Which lecture was weak?
- **Clear hierarchy:** the class average is the largest number on the page. The other top numbers are smaller and use the same layout, so no two tiles compete.
- **Chart details:** a 0–100% axis with gridlines, a dashed class-average line, and the weakest lecture highlighted and labelled. On hover or keyboard focus, each bar shows its exact numbers. Under 540 px, the chart scrolls sideways inside its own box and never pushes the page wider.
- **Table:** at-risk and over-limit rows are marked by both a chip and a subtle row tint. The header stays visible while scrolling. Under 540 px, the rows become cards.
- **Every state is designed:** a loading skeleton, an empty state ("No ended lectures yet: start a lecture from the live board"), and an error state with a retry button.
- **One visual language:** reuse the existing navy/blue tokens and spacing, with one accent for risk. Use a tabular-number font for every figure that sits in a column. Every interactive element has a visible focus style.
- In the final report, describe what the first screen shows at both sizes. If you can save screenshots, put them in `docs/screenshots/`; if you can't, say so.

## Constraints
- Same stack. No ORM, no chart library, no UI framework, no paid services. Ask before adding any dependency.
- Reuse `app/globals.css` tokens. Colour is never the only signal: every chip and bar also has text.
- All numbers come from the server. Every route checks role and ownership. GET routes use `authorize()` plus ownership; any new POST uses `authorize()` and `parsePost()`.
- Dates and day labels use the Africa/Cairo time zone.

## How to work
- Follow `CLAUDE.md`: after each work package, run `npx tsc --noEmit`, `npm run build` and `npm test`, then commit `phase2(wpN): …`.
- Never run `npm run build` in the project folder while a server or tunnel from this folder is serving phones.
- At the end, push the `phase2` branch. **Do not merge into `main`** and do not push `main`.
- Final report: a table of every check (PASS/FAIL), the `verify-analytics` result, the route timing, the files changed, and anything you could not verify.
