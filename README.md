# Wiskunde in de stad

A maths walk through Ghent for 13-year-olds. Groups walk to real places on one phone per group; a question only unlocks when the group is physically there. Teachers build tours, follow every group on a live map and review photo answers. The UI is in Dutch.

**Live:** https://qdobbela.github.io/Wiskunde-In-De-Stad---SLC/ (teachers: `/leerkracht/`, Microsoft login)

## How it works

- **Frontend:** Next.js (static export) on GitHub Pages. Every page runs in the browser.
- **Backend:** Supabase.
  - Teachers sign in with Microsoft and work directly on Postgres, protected by row-level security.
  - Students have no accounts: their phones only talk to the `leerling` Edge Function ([supabase/functions/leerling](supabase/functions/leerling/index.ts)), which unlocks spots, grades answers and stores photos.
- **Anti-cheat** (server-side, [src/lib/unlock.ts](src/lib/unlock.ts)):
  - A spot unlocks after ≥ 30 s inside the zone, with ≥ 3 pings at ≤ 30 m accuracy.
  - GPS jumps and fake locations are flagged and lock the next spot until the teacher decides.
  - Each group gets its own numbers, and question text is only sent after unlocking.
  - Answers are insert-only (database trigger).
  - Photos come from the live camera only, and only inside the zone.

Design brief: [docs/build-brief.md](docs/build-brief.md). Progress: [TODO.md](TODO.md).

## Development

```bash
npm install
cp .env.example .env.local      # Supabase URL + keys
npm run dev                     # http://localhost:3000
npm test                        # unit tests
npm run build && npm run serve  # static build on http://localhost:3123
npm run e2e:api && npm run e2e:teacher && npm run e2e:walk   # against the real project
npx supabase db push --linked   # migrations
npm run functions:deploy        # Edge Function
```
