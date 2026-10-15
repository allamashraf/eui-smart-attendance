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
- **Keys:** `F` turns fullscreen on or off. `C` closes or reopens the QR. When the QR is closed, the screen says "Check-in closed". No link or code text appears anywhere.
- **Files:** `app/instructor/session/[id]/present/` (`page.tsx`, `Projector.tsx`, `present.module.css`).
- **Demo:** On the live board, press **Open projector view**, then press `C` twice.

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

## Known limits

- **GPS-spoofing apps:** An app can fake the phone's location, and the website cannot see this. The phone also reports its own accuracy, so a student can send a very poor accuracy or no location at all. Those check-ins are not refused; they go to the instructor as *Needs review*. The instructor must look at them.
- **Live streaming of the QR:** A friend in the room can stream the QR live, for example with a video call, to someone just outside. That person can scan it from a second screen within the code's lifetime (8 + 3 seconds). If their phone is close enough to the room, the location check will not catch it. A room PIN or random spot-checks are **planned**, not built.
- **Indoor GPS:** Indoors, phone location can be weak, so some honest students may land in *Needs review*. The thresholds should be adjusted after we measure real rooms.
- **Real phones:** We have not yet tested on a real iPhone or Android phone. The scanner library (`html5-qrcode` 2.3.8) has had no new version since 2023.
