# TODO

Overview of what's done and what's left. Follows the build order in [docs/build-brief.md](docs/build-brief.md) (section 10).

## 1. Setup and base components ✅

- [x] Next.js 15 + TypeScript project, CSS Modules
- [x] Design tokens as CSS variables ([src/styles/tokens.css](src/styles/tokens.css))
- [x] Fonts: Rubik Mono One, Rubik, Space Mono
- [x] Button, StatusChip, NiveauTag, Input (checked against Figma)
- [x] Decimal-comma parser ([src/lib/number.ts](src/lib/number.ts))
- [x] Supabase project linked, CLI via `npx supabase`
- [x] Database schema, RLS, answer lock, 30-day ping cleanup

## 2. Teacher: tours, questions, sessions ✅

- [x] Teacher login with Microsoft only; student addresses (`@student.…`) refused in the database
- [x] T01 Overzicht tochten: tour cards with mini map, Klaar/Concept, recent sessions
- [x] T02 Tocht maken: click map to add, drag pins, reorder list, radius and dwell time
- [x] MapLibre GL with OpenFreeMap (OSM) tiles, restyled to the concrete palette
- [x] T03 Vragen: one version per level, formula answer, `{n}`/`{z}` ranges, live preview
- [x] Start a session (with class) and show its code; close a session
- [x] Formula engine without eval ([src/lib/formula.ts](src/lib/formula.ts)) + unit tests
- [x] Browser test of the whole teacher flow: `npm run e2e:teacher`
- [x] "Aanmelden met Microsoft" button (Supabase `azure` provider)
- [x] Register the app in Microsoft Entra and enable Azure in Supabase
- [x] First real Microsoft login tested by a teacher
- [x] Decide who may log in as a teacher: any Microsoft account whose domain doesn't contain "student"
- [ ] Let teachers fill in their school after a Microsoft login (Microsoft doesn't send it)
- [ ] "Bekijk als leerling" button on T02 (disabled until the student screens exist)
- [ ] Session page: show joining groups live (now needs a refresh)
- [ ] Before deploying: set Site URL and Redirect URLs in Supabase → Authentication → URL Configuration

## 3. Student: join and walk

- [ ] Server routes for students (device token in httpOnly cookie)
- [ ] L01 Start: session code
- [ ] L02 Groep: group name and first names
- [ ] L03 Niveau: Basis / Gevorderd / Expert, locked at start
- [ ] L04 Toestemming: location + camera, fair-play notice
- [ ] L05 Kaart: map, route, next spot, progress
- [ ] Send pings and store them

## 4. Unlocking and answering

- [ ] Unlock check on the server: accuracy ≤ 30 m, inside radius, dwell time over ≥ 3 pings
- [ ] Plausibility flags: `gps_jump` (> 25 km/h or > 150 m in 5 s), `mock_suspected`
- [ ] Per-team variant and random numbers (`assignment`)
- [ ] L06 Bijna: distance, direction arrow, dwell timer, "sta even stil" when inaccurate
- [ ] L07 Vraag: question text only from the unlock response, answer, timer
- [ ] Auto-grading (formula with tolerance)
- [ ] L09 Juist: feedback and points

## 5. Camera and photo review

- [ ] L08 Camera: `getUserMedia` + canvas, no gallery
- [ ] Photo upload through the server: reject outside the zone or after the timer
- [ ] "Live hh:mm" label with server time
- [ ] T05 Groepsdetail: answers per spot, event log, 0 / half / full points

## 6. Live map and flags

- [ ] T04 Live kaart: group pins via Realtime, stat tiles, group list
- [ ] `app_left` flag via `visibilitychange`
- [ ] `second_device` flag
- [ ] "Verdacht" chip links to flag details

## 7. Results and dry run

- [ ] L10 Klassement
- [ ] T06 Resultaten: ranking, stats, CSV and PDF export
- [ ] Close a session
- [ ] PWA manifest and icons
- [ ] Deploy (e.g. Vercel)
- [ ] Dry run on a real route in Ghent

## Later / open questions

- [ ] Teacher screens are built for laptop/tablet width only; check them on an iPad
- [ ] T03 has a "Tijd (min)" field that isn't in Figma (the timer starts at unlock): keep it?

- [ ] Vragenbank: reuse questions across tours (in the FigJam flow, not built yet)
- [ ] Should a decimal point be accepted as well as a comma? (Figma says no)
- [ ] Delete photos after a while too? (brief only mentions pings)
- [ ] Switch to Expo if mock-location cheating becomes a real problem
