# Wiskunde in de stad

School-day maths walk through Ghent. Read [docs/build-brief.md](docs/build-brief.md) first: it has the screens, data model, anti-cheat rules and build order. Progress is in [TODO.md](TODO.md).

## Architecture

- **Static site** (Next.js 15 `output: "export"`, TypeScript, CSS Modules, no Tailwind) on GitHub Pages: https://qdobbela.github.io/wiskunde-in-de-stad/. No Node server: no server actions, route handlers, middleware or dynamic route segments. Pages are client components; ids go in query strings (`/leerkracht/tocht/?id=…`). `NEXT_PUBLIC_BASE_PATH` is `/wiskunde-in-de-stad` on Pages; next/link adds it, plain URLs use `asset()` from [src/lib/basePath.ts](src/lib/basePath.ts).
- **Supabase** project `knmessihqonhjzvkezye` ("Wiskunde in de stad", not the paused "WiskundeInDeStad").
  - Teachers: Microsoft login in the browser ([src/lib/supabase/client.ts](src/lib/supabase/client.ts), PKCE, session in localStorage). They read and write tables directly; RLS limits them to their own tours/sessions. Mutations: [src/lib/teacher/mutations.ts](src/lib/teacher/mutations.ts).
  - Students: no accounts, no table access. Phones call the `leerling` Edge Function ([supabase/functions/leerling/index.ts](supabase/functions/leerling/index.ts)) with a group token and a phone id from localStorage ([src/lib/student/api.ts](src/lib/student/api.ts)). The function unlocks spots, grades, stores photos, logs flags. Question text is only sent after unlock.
  - The function reuses pure logic from `src/lib/` (formula, geo, grading, niveau, number, unlock), copied into `supabase/functions/_shared/` by `scripts/sync-functions-shared.mjs` (git-ignored; never edit the copy).
- Answer locking is a DB trigger (`lock_answer`); only `teacher_score`/`reviewed_*` may change. "group" is reserved in SQL, so the table is `team`.
- Auth rules in the database (migration `teachers_microsoft_only`): an e-mail *domain* containing "student" can't create an auth user; only `azure` users get a `teacher` row. The teacher layout signs out users without one. The Email provider stays on only for the e2e tests.
- MapLibre GL 6 with OpenFreeMap tiles, restyled from tokens at runtime ([src/lib/map/style.ts](src/lib/map/style.ts)). Its web worker is copied to `public/maplibre/` by `scripts/copy-maplibre-worker.mjs` (postinstall/predev/prebuild).

## Commands

- `npm run dev`; `npm test` (unit tests, `src/**/*.test.ts`); `npm run lint`; `npx tsc --noEmit`.
- `npm run build && npm run serve`: the static build on http://localhost:3123 (`scripts/serve-static.mjs`, like Pages).
- Tests against the real project (they create and delete a throwaway teacher): `npm run e2e:api`, `npm run e2e:teacher`, `npm run e2e:walk` (two phones with fake GPS/camera + teacher). The browser tests need `npm run serve` running.
- Migrations: `npx supabase db push --linked`, then `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.
- Edge Function: `npm run functions:deploy` (type-check first: `npx deno@2 check --config supabase/functions/leerling/deno.json supabase/functions/leerling/index.ts`).
- Deploy the site: push to `main`; `.github/workflows/deploy.yml` builds with repository variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Conventions

- All UI copy is Dutch. Code, comments and identifiers are English, except domain names from the designs (`niveau`, `vergrendeld`, ...).
- Use the CSS custom properties in [src/styles/tokens.css](src/styles/tokens.css). Never hardcode hex values in components.
- Signature look: thick black outlines, hard shadows with no blur (`--shadow-hard`, `--shadow-hard-s`), no gradients or blur.
- Component CSS that pages override (Button, Sticker) and the global resets use `:where()`: CSS-module order isn't stable between builds. Size MapView with flex, not `position`.
- Parse student numbers with `parseDutchNumber` (decimal comma only).
- PostgREST batch inserts fill missing fields with null, not the default: give every row every field.

## Figma

Design file key `Mddrpff78yDrTs8efCYRph` (in the "Quintens Projects" team; older links to `dSBctTI5BqbZkFoOESmF85` are a Starter-plan copy with a tight MCP limit). Pages: `0:1` Stijlrichtingen, `6:2` Componenten, `8:2` Schermen.
Screen node IDs: L01 `8:3`, L02 `8:21`, L03 `8:52`, L04 `8:81`, L05 `9:19`, L06 `9:67`, L07 `9:92`, L08 `10:46`, L09 `10:69`, L10 `10:100`, T01 `21:56`, T02 `21:187`, T03 `22:91`, T04 `22:188`, T05 `24:170`, T06 `24:268`.
Flows board (FigJam): `2yDHOXZlLn7APmGDdoqG5A`.
