# Wiskunde in de stad: build brief for Claude Code

Give this file to Claude Code in VS Code (for example, save it as `docs/build-brief.md` and point to it from `CLAUDE.md`). It describes what to build, where the designs are, and how the anti-cheat logic works.

## 1. What the app is

A school-day app for Ghent. Groups of 13-year-olds walk through the city and solve maths questions about real places. A question only unlocks when the group is physically at that location. Each group picks a difficulty level. Teachers follow every group on a live map, upload questions and review photo answers. The whole UI is in Dutch.

- **Students:** use their own phones, one phone per group.
- **Teachers:** use a laptop or tablet.

## 2. Designs (Figma)

- Design file: https://www.figma.com/design/Mddrpff78yDrTs8efCYRph
  - `01 Stijlrichtingen`: the three style directions. **C, Graffitistraatje**, was chosen.
  - `02 Componenten`: the components (see section 4).
  - `03 Schermen`: student screens L01 to L10 (390 × 844, top row) and teacher screens T01 to T06 (1440 × 900, bottom row). Clickable prototype with two flows, "Leerling" and "Leerkracht" (press Present).
- Flows (FigJam): https://www.figma.com/board/2yDHOXZlLn7APmGDdoqG5A
  - Leerlingenflow, Leerkrachtenflow, Anti-spiekcontrole bij ontgrendelen

When you implement a screen, read it with the Figma MCP (`get_design_context`) and reuse the tokens below. Don't hardcode the hex values.

## 3. Design tokens

All variables have a WEB code syntax already set in Figma. Use these CSS custom properties.

| Token | Value | Use |
|---|---|---|
| `--color-bg-screen` | #E4E4DF | Screen background (concrete) |
| `--color-bg-surface` | #FFFFFF | Cards, inputs |
| `--color-bg-sunken` | #DADAD5 | Map, photo placeholders |
| `--color-bg-inverse` | #0D0D0D | Camera screen, dark labels |
| `--color-action-primary` | #FF3EA5 | Main action per screen (fluo pink) |
| `--color-action-secondary` | #C6F432 | Camera, success, "Juist!" (lime) |
| `--color-action-info` | #3255F5 | Groups on map, "Gevorderd" (riso blue) |
| `--color-status-warning` | #FF8A1F | Timer in the last minute |
| `--color-status-alert` | #E8261C | Cheating flags, errors |
| `--color-text-primary` / `--color-text-secondary` | #0D0D0D / #4A4A4A | Text |
| `--color-border-default` | #0D0D0D | All outlines |
| `--border-width` | 2.5px | All outlines |
| `--radius-sm` / `md` / `lg` / `full` | 8 / 14 / 22 / 999 px | Corners |
| `--spacing-2xs` … `--spacing-3xl` | 4, 8, 12, 16, 20, 24, 32, 48 px | Padding and gaps |

**Signature look:** thick black outlines, *hard* shadows with no blur (`5px 5px 0 #0D0D0D`, small `3px 3px 0`), stickers rotated by -2 to -5°, fluo only for actions and status. Avoid soft shadows, gradients and blur.

**Type** (Google Fonts):
- `Rubik Mono One` for headings and buttons, always uppercase. Display XL 40, L 28, M 20, Button 18.
- `Rubik` 500/700 for body text (18 / 16 / 13) and labels (uppercase, letter-spacing 4–8%).
- `Space Mono` 700 for numbers, answers, timers and scores.

## 4. Components

These are in Figma under `02 Componenten`:

- **Button:** Primary, Secondary or Outline × Default or Disabled
- **Status chip:** Vergrendeld, Je bent hier, Opgelost, Wacht op leerkracht, Verdacht
- **Niveau tag:** Basis, Gevorderd, Expert
- **Spot badge** ("SPOT 4/12") and **Timer** (Normaal, Bijna op)
- **Invoerveld:** Default, Focus, Fout. Numeric keyboard, accepts a decimal comma.
- **Kaartpin:** Vergrendeld, Hier, Opgelost, Groep
- **Voortgang:** progress bar
- **Groepsrij:** a row in the teacher's group list
- **Fototegel:** a photo with its "Live hh:mm" timestamp label

## 5. Screens

**Student (built):**

| # | Screen | Notes |
|---|---|---|
| L01 | Start | Enter the session code |
| L02 | Groep | Group name and first names (no surnames) |
| L03 | Niveau | Basis ×1, Gevorderd ×1.5, Expert ×2. Can't be changed once the walk starts. |
| L04 | Toestemming | Location and camera permission, plus a fair-play notice |
| L05 | Kaart | Map, route, next spot, progress |
| L06 | Bijna | Distance and direction arrow, plus the 30-second dwell timer |
| L07 | Vraag | Question unlocked: answer, photo, send |
| L08 | Camera | Live camera only, gallery disabled |
| L09 | Juist | Feedback and points, answer locked |
| L10 | Klassement | Final ranking |

**Teacher:**

| # | Screen |
|---|---|
| T01 | Overzicht tochten: tour cards with mini map, recent sessions |
| T02 | Tocht maken: spot list, pin locations on a map, radius and dwell time |
| T03 | Vragen: one version per level, formula answer, random numbers per group (`{n}`, `{z}`), live preview |
| T04 | Live kaart: group pins, stat tiles, cheating alert, group list |
| T05 | Groepsdetail: answers per spot, event log, photo review with 0 / half / full points |
| T06 | Resultaten: ranking table, stats, CSV and PDF export |

## 6. Suggested stack

- **Next.js (App Router) + TypeScript, delivered as a PWA.** Students open a link with no app-store install. Teacher dashboard in the same app.
- **Supabase:** Postgres, Auth for teachers, Realtime for the live map, Storage for photos, Edge Functions for unlock and grading.
- **MapLibre GL** with OpenStreetMap tiles, restyled to the concrete palette.
- **Camera:** `getUserMedia` plus canvas capture. **No** `<input type="file">`, so there is no gallery access.

**Trade-off:** a web app can't reliably detect a mock-location app. A native Expo app can on Android (`mocked` flag), but students would have to install it. The server-side plausibility checks below catch most cheating without that. If cheating turns out to be a real problem, switch to Expo.

## 7. Data model (first draft)

```
teacher(id, name, email)
tour(id, teacher_id, title, city='Gent')
location(id, tour_id, order, name, lat, lng, radius_m default 25)
question(id, location_id, level enum[basis,gevorderd,expert], variant int,
         body, answer_type enum[number,text,photo], correct_value, tolerance,
         unit, needs_photo bool, base_points)
session(id, tour_id, code, starts_at, ends_at, status)
group(id, session_id, name, level, member_first_names text[], device_token)
assignment(group_id, location_id, question_id)          -- variant chosen per group
ping(id, group_id, lat, lng, accuracy_m, speed, ts)
unlock(group_id, location_id, unlocked_at)
answer(id, group_id, question_id, value, photo_path, submitted_at,
       auto_correct bool null, teacher_points int null)  -- immutable once inserted
flag(id, group_id, type enum[gps_jump,mock_suspected,low_accuracy,app_left,
     second_device], detail jsonb, ts)
```

## 8. Anti-cheat rules (must-haves)

1. **Unlocking happens on the server.** The client only sends pings. An Edge Function decides to unlock when all of these hold:
   - Accuracy is 30 m or better.
   - The group is inside `radius_m`.
   - The group stays inside for 30 seconds in a row, over at least 3 pings.
2. **The question text is never shipped to the client before unlock.** It is fetched only through the unlock response.
3. **Plausibility checks.** Speed between pings above 25 km/h, or a jump of more than 150 m within 5 s, creates a `gps_jump` flag. Repeated identical coordinates with zero variance create `mock_suspected`.
4. **Each group gets its own variant.** Numbers are randomised per group, so answers can't be shared between groups.
5. **Answers are locked once sent.** Enforce this with a DB constraint or RLS: insert only, no update by students. One answer per group per question.
6. **Photos are live only.** Take them through the camera API. The server stores the upload time and position, and rejects uploads from outside the zone or after the timer runs out. The "Live hh:mm" label shows the server time.
7. **Leaving the app is logged.** Use `visibilitychange`: hiding the app during an open question creates an `app_left` flag with its duration.
8. **One device per group.** The session joins with a device token, and a second device creates a `second_device` flag.
9. **The teacher sees every flag** live on the map. The "Verdacht" chip links to the details.

## 9. Language and privacy

- All UI copy is Dutch (see the Figma screens). Parse numbers with a decimal comma: "31,8" means 31.8.
- The users are minors. Store first names only. Delete location pings 30 days after the session. Teachers log in, students don't need accounts.

## 10. Build order

1. Set up the project, tokens as CSS variables, fonts, and the base components (Button, Chip, Input).
2. Teacher: create a tour, add locations and questions, start a session and show its code.
3. Student: L01 to L05 (join, group, level, permissions, map), with pings stored.
4. Unlock Edge Function, then L06 and L07 (question), answer locking, then L09.
5. Camera (L08), photo upload and teacher review.
6. Live teacher map with Realtime, plus flags.
7. Ranking (L10), results export, and a dry run on a real route in Ghent.
