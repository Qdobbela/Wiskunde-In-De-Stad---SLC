# Wiskunde in de stad

School-day maths walk through Ghent. Read [docs/build-brief.md](docs/build-brief.md) first: it has the screens, data model, anti-cheat rules and build order.

## Stack

- Next.js 15 (App Router) + TypeScript, plain CSS Modules (no Tailwind).
- Supabase project `knmessihqonhjzvkezye` ("Wiskunde in de stad", not the paused "WiskundeInDeStad"). CLI via `npx supabase` (linked). Schema in [supabase/migrations/](supabase/migrations/); apply with `npx supabase db push --linked`.
  - Teachers: Supabase Auth + RLS. Students: no account and no direct DB access; their phones call Next.js server routes that use `SUPABASE_SECRET_KEY` and identify the group by `team.device_token` (httpOnly cookie). "group" is reserved in SQL, so the table is `team`.
  - Answer locking is a DB trigger (`lock_answer`), so it also binds the secret key. Only `teacher_score`/`reviewed_*` may change.
- MapLibre GL 6 with OpenFreeMap vector tiles, restyled from tokens at runtime ([src/lib/map/style.ts](src/lib/map/style.ts)). Its web worker is copied to `public/maplibre/` by `scripts/copy-maplibre-worker.mjs` (postinstall/predev/prebuild) because Turbopack can't serve it from the package.

## Commands

- `npm run dev`: dev server. `npm test`: unit tests (Node test runner, `src/**/*.test.ts`). `npm run lint`, `npx tsc --noEmit`.
- `npm run e2e:teacher`: browser test of the teacher flow in local Chrome via `playwright-core`; needs `npx next start -p 3123` running. It creates and deletes a throwaway teacher in the real Supabase project.
- After a migration: `npx supabase db push --linked`, then `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.

## Auth

- Teachers log in with Microsoft only (Supabase `azure` provider, multitenant Entra app). Students have no accounts.
- Enforced in the database (migration `teachers_microsoft_only`): an e-mail *domain* containing "student" can't create an auth user, and only `azure` users get a `teacher` row. Without a teacher row there's no access (RLS + FK); `getTeacher()` signs such users out via `/auth/uitloggen`.
- The Email provider stays on in Supabase only for `npm run e2e:teacher`, which inserts its own teacher row.

## Layout

- Teacher area: `src/app/leerkracht/(app)/` (sidebar layout), login at `src/app/leerkracht/login`. `src/middleware.ts` guards `/leerkracht`.
- Teacher pages read and write through `createTeacherClient()` (RLS). `createAdminClient()` bypasses RLS: only for student routes.
- Component CSS that pages may override (e.g. `Button.module.css`) uses `:where()` selectors, and global resets do too: CSS-module order isn't stable between builds.
- Shared logic with tests: `src/lib/formula.ts`, `src/lib/question.ts`, `src/lib/number.ts`.

## Conventions

- All UI copy is Dutch. Code, comments and identifiers are English, except domain names that come from the designs (`niveau`, `vergrendeld`, ...).
- Use the CSS custom properties in [src/styles/tokens.css](src/styles/tokens.css). Never hardcode hex values in components.
- Signature look: thick black outlines, hard shadows with no blur (`--shadow-hard`, `--shadow-hard-s`), no gradients or blur.
- Fonts come from `next/font` in `src/app/layout.tsx`: `--font-display` (Rubik Mono One, uppercase), `--font-body` (Rubik), `--font-numeric` (Space Mono).
- Parse student numbers with `parseDutchNumber` in [src/lib/number.ts](src/lib/number.ts) (decimal comma).
- Base components live in `src/components/ui/`. `/componenten` shows them all.
- Anti-cheat logic (unlocking, grading) runs on the server only. The client sends pings; it never receives question text before unlock.

## Figma

Design file key `Mddrpff78yDrTs8efCYRph`. Pages: `0:1` Stijlrichtingen, `6:2` Componenten, `8:2` Schermen.
Screen node IDs: L01 `8:3`, L02 `8:21`, L03 `8:52`, L04 `8:81`, L05 `9:19`, L06 `9:67`, L07 `9:92`, L08 `10:46`, L09 `10:69`, L10 `10:100`, T01 `21:56`, T02 `21:187`, T03 `22:91`, T04 `22:188`, T05 `24:170`, T06 `24:268`.
Flows board (FigJam): `2yDHOXZlLn7APmGDdoqG5A`.
The file lives in the "Quintens Projects" team (student plan). Older links to `dSBctTI5BqbZkFoOESmF85` point at a Starter-plan copy with a tight MCP call limit: don't use them.
