# Phase 1 notes

**The problem.** In a test, a friend 25 km away opened a forwarded check-in link and was marked present. A student who sent no location was also marked present. Nobody got an alert. Phase 1 fixes this. The server makes every decision, and students never poll the server.

## WP1: code lifetime and payload

- **What changed:** The QR code now changes every 8 seconds, and a code still works for 3 more seconds after it changes. You can change both numbers in `.env.local`.
- **What is in the QR:** Only a signed code, `EUIA1.<session>.<slot>.<signature>`. There is no link, so a forwarded copy opens nothing. The page never shows the code as text.
- **Why:** The old QR was a full web link that anyone could forward, and the board even had a copy button.
- **Files:** `lib/config.ts`, `lib/security.ts`, `app/api/sessions/[id]/challenge/route.ts`, `app/api/checkin/route.ts`.
- **Demo:** Run `npm run sim:attack`. Case **G** shows that the challenge response has no link and no code text. Case **D** shows that an old code is refused as "expired".

## WP2: the server decides about location

- **What changed:** The phone only sends its location and its accuracy (± metres). The server compares them with the room position. In the room means *Verified*. Unclear or missing means the record is saved but *Needs review*. More than about 1 km away means the check-in is refused, the server saves a security event, and an R9 alert goes to the admin.
- **Privacy:** We store only the distance, the accuracy and the decision, never the student's coordinates.
- **Why:** Before, the location was optional, imprecise, and never checked.
- **Files:** `lib/location.ts` (the rules, with no database), `lib/location.test.ts`, `db/migrations/002_phase1.sql`, `scripts/setup-db.mjs`, `db/schema.sql`.
- **Demo:** Run `npm test` (18 tests). Then run `npm run sim:attack`: case **B** (friend 25 km away) is refused and makes no record.

## WP3: scanning inside the website

- **What changed:** Students scan with a camera **inside the check-in page**, like the university's current CIS system. There is no box to paste a code, no image upload, and no `?token=` link.
- **Location first:** Location starts as soon as the page opens, so it is ready before the scan. After a scan, the code is sent at once and the page never waits for GPS. If there is no location after 20 seconds, the page says the student can still check in and the instructor will review it.
- **Why:** A code that lives 8 seconds must be read from the real screen, at once.
- **Files:** `app/checkin/QrScanner.tsx`, `app/checkin/CheckinClient.tsx`, `app/checkin/page.tsx`.
- **Demo:** Sign in as `motaz` on a phone (see "Testing on a real phone" in the README), open **Check in**, and scan the projector.

## WP4: instructor controls

- **Room location:** The instructor presses **Set room location** on a phone in the room. The server refuses a reading that is not precise enough, such as a laptop's guess, because a bad room position would make everyone look "inside".
- **Close QR / Reopen QR:** When the QR is closed, scans are refused, but the instructor can still add students. To add a student, search for their name or student number and write a reason (the chips help). **End session** still stops everything.
- **Review:** Each student shows chips: *Verified*, *Needs review*, *Late* or *Manual*. The instructor can **Confirm** a record or **Mark absent**. Both need a reason and are saved in the audit log. A student marked absent cannot scan again.
- **Live data:** The board asks the server for new data every 2 seconds, with one database query. Only the instructor's screen does this. The QR changes at exactly the right moment.
- **Files:** `app/api/sessions/[id]/anchor`, `qr`, `review` and `live` routes, `LiveBoard.tsx`, `useLiveSession.ts`.
- **Demo:** Run case **F** in `npm run sim:attack`, or click through the live board.

## WP5: projector page

- **What changed:** A new full-screen page for the classroom projector. It shows a big QR, a ring that counts down to the next code, a large counter ("3 / 6"), and the last 8 names.
- **Privacy:** Names show as first name and last initial, because the whole class can see the screen.
- **Keys:** `Shift+F` turns fullscreen on or off. `Shift+C` closes or reopens the QR. Keys do nothing while you type in a text field. When the QR is closed or reopened, a big notice shows for 2 seconds; while it is closed, the screen says "Check-in closed". No link or code text appears anywhere.
- **Files:** `app/instructor/session/[id]/present/` (`page.tsx`, `Projector.tsx`, `present.module.css`).
- **Demo:** On the live board, press **Open projector view**, then press `Shift+C` twice.

## WP6: proof scripts and tests

- **`npm test`:** 18 unit tests for the location rules, including the exact boundary cases.
- **`npm run sim:attack`:** It runs the attack again (cases A–G) and prints an "expected vs actual" table. If any case fails, it stops with an error.
- **`npm run load:test`:** 300 students check in at the same moment with one code. Our result: about 2 seconds in total, 0 errors, 0 duplicates, 300 records.
- **Playwright screenshots:** Not done, because Playwright is not installed. We checked the page widths by hand in a browser instead.
- **Files:** `scripts/sim-attack.mjs`, `scripts/load-test.mjs`, `scripts/dev-helpers.mjs`.
- **Demo:** Start the app with `npm run build && npm start`, then run the commands above in a second terminal.

## WP7: documentation

- `README.md` now explains the new settings and their default values. It also covers migrations, the new commands, and how to test on a real phone with a temporary HTTPS tunnel.
- `TEST_PLAN.md` lists what was tested automatically and the results. It also lists what still needs a person and a real phone.
- Work that is not built is marked **planned**.

## Real-phone test (16 October 2026)

**Setup:** Through a temporary HTTPS tunnel (cloudflared), we used the same iPhone with Safari for the instructor and for the students (signing in and out to switch accounts). The laptop showed the projector view. The instructor set the room location from inside the room: **±11 m**. The session started at 06:36 Cairo time, so check-ins after 06:51 count as *Late*.

| Test | What we did | What the phone showed | What the database recorded | Result |
| --- | --- | --- | --- | --- |
| (a) Normal scan | `motaz` scanned the projector | "You are checked in", Late + Verified, "Your location matched the classroom" | `late`, `verified`, `inside`; student accuracy ±18 m, distance **6.1 m** from the room point | Pass |
| (b) Scan again | `motaz` scanned a newer code | "Already checked in" | Still one record; the scan was refused as `already` | Pass |
| (c) Location denied | `student2` scanned with location turned off in iOS | Late + Needs review, "No location was shared" | `late`, `needs_review`, `no_location`, no distance or accuracy stored | Pass |
| (d) QR closed + assisted check-in | Instructor closed the QR, then added Laila by search with the "No phone" chip | Projector: "Check-in closed", no code. Board: "added and audited", Laila shows Manual | The server issued no codes while closed. Laila: `manual`, reason "No phone available", audit entry `manual_checkin` | Pass |
| (e) Relay from home | A teammate scans the projector QR at home through a video call | — | — | **Pending** |

**Notes**

- The phone showed "±15 m", but the server received ±18 m. This is expected: the page sends the best reading from the last 30 seconds, and the ±15 m reading was older than that when the code was scanned.
- In (c) the server also raised an **R1** alert (score 30, "shared browser"), because the same phone was used for two student accounts. This is correct; a real student lending a phone looks the same.
- At 07:09 the QR was closed and reopened 7 times in 11 seconds, most likely by normal typing on the projector laptop. We changed the projector keys to `Shift+C` / `Shift+F` (see Design decisions).
- Not tested yet: Android Chrome.

## Design decisions

### Where the brief and the old code did not agree

1. **No location means "Needs review", not "refused".** The old `location_required` setting refused such check-ins. Nothing turned it on, and the brief wants a record with *Needs review*, so we stopped using it. The column is still in the database.
2. **The live data route (GET) does not use `parsePost()`.** `parsePost()` needs a JSON body and an `Origin` header, and a browser sends neither on a normal GET. So `GET /live` checks the role and the session owner, like `GET /challenge` already did. Every new POST route uses both checks.
3. **One R9 alert per student per session.** The alerts table allows only one alert for each rule key in a session. So the key is `R9_<student>`. If the same student tries again from far away, the server still saves a `checkin_far_away` event with the distance.
4. **The room location must be precise.** The rule subtracts the room's accuracy, so a laptop's guess (for example ±1500 m) would put almost everyone "inside". The server refuses a room location worse than ±150 m (`MAX_ACCURACY_M`), so the instructor sets it from a phone.
5. **The test scripts use `QR_SECRET` too.** The API never shows the code as text, and we may not add a QR-reading library. So the scripts ask the server for a new code (the server saves it as issued), then build the same code with `QR_SECRET`.
6. **The "No phone" chip writes "No phone available".** A reason needs at least 10 characters, and "No phone" has only 8. We kept the 10-character rule, because it keeps reasons useful.
7. **A student marked absent cannot scan again.** Deleting the record would let the student scan again while the QR is open. So the server remembers it (a `marked_absent` event) and refuses that student's scan. A real mistake is fixed with a correction request or a manual add.
8. **Review still works after "End session".** Teachers often check *Needs review* records after class, so Confirm and Mark absent still work. New records after the end still need a correction request.

### Smaller decisions

- **Two chips per student when needed.** Status (Present/Late/Manual) and verification (Verified/Needs review) are separate, so one row can show "Late · Needs review".
- **Confirm sets the record to *Verified*.** The audit log keeps a note that a person confirmed it, so we can always tell it apart.
- **The signature also covers the prefix.** The HMAC signs `EUIA1.<session>.<slot>`, so a signature can never be reused with a different format version.
- **The QR is an SVG image with a 4-module quiet zone.** It stays sharp at any size on a projector. A small PNG would look blurry when made large, and the quiet zone helps cameras find the code.
- **The scanner never sends the same code twice.** If the server refuses a code, the phone ignores that code from then on. Otherwise an old code on the screen could send many requests and trigger R3 against an honest student.
- **The projector shows "Mariam T.", not full names.** The whole class can see the screen, so we show less personal data. The brief said "names"; this is a small change on purpose.
- **The load test uses its own class (LOAD-TEST).** 300 synthetic students do not fill the demo roster, and `--cleanup` removes everything. It runs against `npm run build && npm start`, because dev mode is much slower.
- **Mark absent works on any record**, not only *Needs review* ones. A teacher may see that a *Verified* student is not in the room (for example, because of a GPS-spoofing app) and must be able to remove the record. A reason is always needed and saved.
- **R9 alerts have a score of 70.** A current code used far from the room is a strong sign of a forwarded code, stronger than a shared browser (R1: 30, R2: 55). It is still a review signal, not proof, because a location reading can be wrong.
- **Old records go to review.** Records made before Phase 1 were never checked for location, so the migration marks old QR records as *Needs review* and keeps manual records as *Manual*.
- **Projector keys need Shift.** In the phone test, the QR was closed and reopened 7 times in 11 seconds, most likely by normal typing on the projector laptop. Now only `Shift+C` and `Shift+F` work, keys are ignored while typing in a text field, and a big notice shows for 2 seconds when the QR closes or reopens, so nobody misses it.
- **A new index for the live board.** The board asks every 2 seconds for one session's records, so we added an index on `(session_id, checked_in_at)` to keep that query fast.

## Known limits

- **GPS-spoofing apps:** An app can fake the phone's location, and the website cannot see this. The phone also reports its own accuracy, so a student can send a very poor accuracy or no location at all. Those check-ins are not refused; they go to the instructor as *Needs review*. The instructor must look at them.
- **Live streaming of the QR:** A friend in the room can stream the QR live, for example with a video call, to someone just outside. That person can scan it from a second screen within the code's lifetime (8 + 3 seconds). If their phone is close enough to the room, the location check will not catch it. A room PIN or random spot-checks are **planned**, not built.
- **Indoor GPS:** Indoors, phone location can be weak, so some honest students may land in *Needs review*. The thresholds should be adjusted after we measure real rooms.
- **Real phones:** Tests (a) to (d) passed on a real iPhone with Safari, and the scanner library (`html5-qrcode` 2.3.8) worked there. Still pending: test (e) (relay from home) and Android Chrome. The library has had no new version since 2023, so it should be checked again on new phone systems.

## Online deployment preparation (18 October 2026)

- **Plan:** Keep the code on GitHub, use a free Supabase database, and run the website and API on Vercel. GitHub Pages cannot run this app's API.
- **Branch:** Work is on `codex/supabase-vercel-deployment`. The owner must approve any merge into `main` before deployment.
- **Dependency fix:** `package.json` now tells Next.js to use PostCSS 8.5.30. `package-lock.json` records the same version. The old version had security issues. We keep Next.js 15.
- **CSS fix:** `app/globals.css` uses `flex-start` for two flex layouts. This removes the browser support warning from the build.
- **Secret files:** `.gitignore` also ignores `.env.*`, `.vercel`, and `supabase/.temp/`. `.env.example` stays available with placeholders only.
- **Generated types:** The build updated `next-env.d.ts` with Next.js route types and its standard file comment.
- **Checks:** `npx tsc --noEmit`, `npm run build`, and all 18 tests passed after these changes. `npm audit` reports zero issues. There is no separate lint command in this project.
- **GitHub Pages:** The owner approved turning it off. It is now disabled. The GitHub Pages API returns HTTP 404, as expected when there is no Pages site.
- **Supabase setup:** The owner logged in locally. We created the `eui-attendance` organization and project, connected through the transaction pooler on port 6543, and ran `npm run db:setup` and `npm run db:seed`. The database contains only synthetic demo data. We checked that all three main accounts match the demo password.
- **Database access fix:** Supabase gave its public API roles access to the new tables. `db/schema.sql` and `db/migrations/003_server_only_access.sql` now enable row-level security on all 11 app tables. We add no public API policies, so these roles cannot read or change the app's rows. The Next.js server uses the table owner's database connection and still has access. A future connection with a different database role will need its own access rules.
- **Database checks:** RLS is on for all 11 tables. Both `anon` and `authenticated` see zero rows, and both are blocked from inserting a user. The server still reads all eight demo users. A local production server returned HTTP 200 from `/api/health` with `database: connected`. All three main accounts logged in and opened their role pages with HTTP 200. The public HTTPS health check is still pending deployment.
- **Passwords:** Generated values stay in ignored `.env.local`. `SUPABASE_DB_PASSWORD` is the database password. `DEMO_PASSWORD` is shared by the demo accounts. `AUTH_SECRET` and `QR_SECRET` are different random 64-hex values. No secret values belong in GitHub or these notes.
- **Vercel CLI:** Installed globally. The owner must run `vercel login` locally. Only `DATABASE_URL`, `AUTH_SECRET`, and `QR_SECRET` will be added to Vercel production; the seed password is not needed there.
- **Status:** The database is ready. The website has not been deployed yet. Before Vercel deployment, push this branch and ask the owner before merging it into `main`.
- **After deployment:** Open the HTTPS website on a phone. Check `/api/health` for `database: connected`. Test login as `motaz`, `instructor`, and `admin`. Allow camera and location access when testing attendance.
