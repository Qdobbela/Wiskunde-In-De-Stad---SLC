# TODO

Overview of what's done and what's left. Follows the build order in [docs/build-brief.md](docs/build-brief.md) (section 10).

## 1. Setup and base components ✅

- [x] Next.js 15 + TypeScript project, CSS Modules
- [x] Design tokens as CSS variables ([src/styles/tokens.css](src/styles/tokens.css))
- [x] Fonts: Rubik Mono One, Rubik, Space Mono
- [x] Button, StatusChip, NiveauTag, Input, Pills, Switch, Sticker (checked against Figma)
- [x] Decimal-comma parser ([src/lib/number.ts](src/lib/number.ts))
- [x] Supabase project linked, CLI via `npx supabase`
- [x] Database schema, RLS, answer lock, 30-day ping cleanup

## 2. Teacher: tours, questions, sessions ✅

- [x] Login with Microsoft only; student addresses (`@student.…`) refused in the database
- [x] T01 Overzicht tochten, T02 Tocht maken, T03 Vragen (formula answers, `{n}`/`{z}` ranges, live preview)
- [x] Start a session (class, duration), code page for the projector, groups appear live
- [x] "Bekijk als leerling", Vragenbank (overview of all questions), Profiel (name and school)

## 3. Student: join and walk ✅

- [x] L01–L04 join flow; the group is created at L04, so the level is fixed from the start
- [x] L05 Kaart: own position, dotted route, next spot, distance, progress, timer
- [x] Groups start at different spots; pings every ~4 s, also while standing still

## 4. Unlocking and answering ✅

- [x] Unlock on the server: accuracy ≤ 30 m, inside the radius, dwell time over ≥ 3 pings
- [x] Plausibility flags `gps_jump` and `mock_suspected`; they keep spots locked until the teacher decides
- [x] Per-group question variant and random numbers; question text only sent after unlocking
- [x] L06 Bijna: compass arrow, distance, dwell countdown, "sta even stil" when inaccurate
- [x] L07 Vraag with timer; auto-grading (formula with margin, text with alternatives `a|b`)
- [x] L09 Juist / Helaas / Verstuurd (waiting for the teacher)

## 5. Camera and photo review ✅

- [x] L08 Camera: `getUserMedia` + canvas, no gallery
- [x] Photo upload through the Edge Function, refused outside the zone or after the timer
- [x] "Live hh:mm · in de zone" label with server time
- [x] T05 Groepsdetail: answers per spot, log, photo review with 0 / half / full points

## 6. Live map and flags ✅

- [x] T04 Live kaart: group pins via Realtime, stat tiles, alert card ("Negeer"), group list
- [x] "Bericht aan iedereen": message to all phones
- [x] `app_left` flag (also when the answer arrives first), `second_device` flag
- [x] "Nieuwe gsm toelaten": a group continues on another phone with the same name

## 7. Results and dry run

- [x] L10 Klassement
- [x] T06 Resultaten: ranking, stats, CSV export (Excel-friendly) and PDF (print)
- [x] Close a session; students then see the ranking
- [x] PWA manifest and icon
- [x] Static site on GitHub Pages; server logic in Supabase (Edge Function + RLS)
- [x] Tests: unit (`npm test`), API (`npm run e2e:api`), browser (`npm run e2e:teacher`, `npm run e2e:walk`)
- [ ] Supabase → Authentication → URL Configuration: add `https://qdobbela.github.io/Wiskunde-In-De-Stad---SLC/**` to Redirect URLs (needed for the Microsoft login on the live site)
- [ ] Test on real phones (iPhone and Android): GPS accuracy, compass, camera, screen staying on
- [ ] Dry run on a real route in Ghent

## Later / open questions

- [ ] Teacher screens are built for laptop/tablet width only; check them on an iPad
- [ ] T03 has a "Tijd (min)" field that isn't in Figma (the timer starts at unlock): keep it?
- [ ] Should a decimal point be accepted as well as a comma? (Figma says no)
- [ ] Delete photos after a while too? (brief only mentions pings)
- [ ] Vragenbank: copy questions to another tour (now an overview with links)
- [ ] PNG app icons for iPhone home screens (now SVG only)
- [ ] Switch to Expo if mock-location cheating becomes a real problem
