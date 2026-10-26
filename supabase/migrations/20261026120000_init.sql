-- Wiskunde in de stad: initial schema.
--
-- Access model:
--   * Teachers sign in with Supabase Auth. RLS gives them their own tours and
--     everything inside the sessions of those tours.
--   * Students have no Supabase account and no direct database access. Their
--     phones call Next.js server routes, which use the secret key and identify
--     the phone by team.device_token. The anon role gets nothing here, so
--     question text can never reach a phone before the server unlocks it.
--
-- "group" is a reserved word in SQL, so a student group is a `team`.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.niveau as enum ('basis', 'gevorderd', 'expert');
create type public.answer_type as enum ('number', 'text', 'photo');
create type public.session_status as enum ('draft', 'live', 'closed');
create type public.flag_type as enum (
  'gps_jump', 'mock_suspected', 'low_accuracy', 'app_left', 'second_device'
);

-- Basis ×1, Gevorderd ×1.5, Expert ×2
create function public.niveau_multiplier(level public.niveau)
returns numeric
language sql immutable
set search_path = ''
as $$
  select case level
    when 'basis' then 1.0
    when 'gevorderd' then 1.5
    when 'expert' then 2.0
  end;
$$;

-- ---------------------------------------------------------------------------
-- Teachers and tours
-- ---------------------------------------------------------------------------

create table public.teacher (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

-- Every new auth user is a teacher (students never get an auth user).
create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.teacher (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.tour (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher (id) on delete cascade,
  title text not null,
  city text not null default 'Gent',
  created_at timestamptz not null default now()
);

create index tour_teacher_id_idx on public.tour (teacher_id);

create table public.location (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tour (id) on delete cascade,
  position int not null,
  name text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m int not null default 25 check (radius_m between 5 and 500),
  -- Seconds the group must stay inside the zone before unlocking.
  dwell_s int not null default 30 check (dwell_s between 0 and 600),
  unique (tour_id, position) deferrable initially deferred
);

create table public.question (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location (id) on delete cascade,
  level public.niveau not null,
  variant int not null default 1,
  -- May contain placeholders such as {n} and {z}, filled per team.
  body text not null,
  answer_type public.answer_type not null,
  -- Ranges for the placeholders, e.g. {"n": {"min": 10, "max": 40, "step": 1}}.
  params jsonb not null default '{}'::jsonb,
  -- For number answers: a formula over the placeholders, e.g. "{n} * 2,5".
  -- For text answers: the expected text. Unused for photo answers.
  correct_value text,
  tolerance numeric not null default 0 check (tolerance >= 0),
  unit text,
  needs_photo boolean not null default false,
  base_points int not null default 10 check (base_points >= 0),
  -- Timer that starts at unlock. Null means no time limit.
  time_limit_s int check (time_limit_s > 0),
  unique (location_id, level, variant)
);

-- ---------------------------------------------------------------------------
-- Sessions and teams
-- ---------------------------------------------------------------------------

-- Six characters, no look-alikes (0/O, 1/I/L).
create function public.generate_session_code()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate
        || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.session where code = candidate);
  end loop;
  return candidate;
end;
$$;

create table public.session (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tour (id) on delete cascade,
  code text not null unique,
  status public.session_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.session
  alter column code set default public.generate_session_code();

create index session_tour_id_idx on public.session (tour_id);

create table public.team (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.session (id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  level public.niveau not null,
  -- First names only: the students are minors.
  member_first_names text[] not null
    check (cardinality(member_first_names) between 1 and 8),
  -- Secret token stored in an httpOnly cookie on the group's phone.
  device_token uuid not null default gen_random_uuid() unique,
  -- Set when the walk starts. After that the level is fixed.
  started_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, name)
);

create function public.lock_team_level()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.started_at is not null and new.level is distinct from old.level then
    raise exception 'Het niveau kan niet meer veranderen na de start.';
  end if;
  return new;
end;
$$;

create trigger team_lock_level
  before update on public.team
  for each row execute function public.lock_team_level();

-- The variant and random numbers each team gets per location.
create table public.assignment (
  team_id uuid not null references public.team (id) on delete cascade,
  location_id uuid not null references public.location (id) on delete cascade,
  question_id uuid not null references public.question (id) on delete cascade,
  param_values jsonb not null default '{}'::jsonb,
  -- Correct number for this team, computed on the server from the formula.
  expected_value numeric,
  primary key (team_id, location_id)
);

-- ---------------------------------------------------------------------------
-- Walking: pings, unlocks, answers, flags
-- ---------------------------------------------------------------------------

create table public.ping (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.team (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real not null,
  speed real,
  -- Time reported by the phone; checks use received_at.
  ts timestamptz not null,
  received_at timestamptz not null default now()
);

create index ping_team_received_idx on public.ping (team_id, received_at desc);

create table public.unlock (
  team_id uuid not null references public.team (id) on delete cascade,
  location_id uuid not null references public.location (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  -- unlocked_at + question.time_limit_s, or null without a timer.
  deadline_at timestamptz,
  primary key (team_id, location_id)
);

create table public.answer (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.team (id) on delete cascade,
  question_id uuid not null references public.question (id) on delete cascade,
  value text,
  photo_path text,
  -- Server time and position of the photo upload ("Live hh:mm").
  photo_taken_at timestamptz,
  photo_lat double precision,
  photo_lng double precision,
  submitted_at timestamptz not null default now(),
  -- Set by the server at insert for auto-gradable questions.
  auto_correct boolean,
  -- Teacher review: 0, half or full points.
  teacher_score numeric(2, 1) check (teacher_score in (0, 0.5, 1)),
  reviewed_at timestamptz,
  reviewed_by uuid references public.teacher (id) on delete set null,
  -- One answer per team per question.
  unique (team_id, question_id),
  check (value is not null or photo_path is not null)
);

-- Answers are locked once sent. Only the teacher review may change later.
-- A trigger (not just RLS) so it also holds for the server's secret key.
create function public.lock_answer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.team_id, new.question_id, new.value, new.photo_path,
      new.photo_taken_at, new.photo_lat, new.photo_lng, new.submitted_at,
      new.auto_correct)
     is distinct from
     (old.team_id, old.question_id, old.value, old.photo_path,
      old.photo_taken_at, old.photo_lat, old.photo_lng, old.submitted_at,
      old.auto_correct)
  then
    raise exception 'Een ingestuurd antwoord kan niet meer veranderen.';
  end if;
  return new;
end;
$$;

create trigger answer_lock
  before update on public.answer
  for each row execute function public.lock_answer();

create table public.flag (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.team (id) on delete cascade,
  type public.flag_type not null,
  detail jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.teacher (id) on delete set null
);

create index flag_team_ts_idx on public.flag (team_id, ts desc);

-- ---------------------------------------------------------------------------
-- Scores
-- ---------------------------------------------------------------------------

-- Fraction of the points earned: the teacher's review wins; photo questions
-- wait for it; other questions use the automatic check.
create view public.answer_points
with (security_invoker = true)
as
select
  a.id as answer_id,
  a.team_id,
  a.question_id,
  case
    when a.teacher_score is not null then a.teacher_score
    when q.needs_photo or q.answer_type = 'photo' then null
    when a.auto_correct then 1
    else 0
  end as score,
  round(
    q.base_points * public.niveau_multiplier(t.level) * case
      when a.teacher_score is not null then a.teacher_score
      when q.needs_photo or q.answer_type = 'photo' then 0
      when a.auto_correct then 1
      else 0
    end
  ) as points
from public.answer a
join public.question q on q.id = a.question_id
join public.team t on t.id = a.team_id;

-- ---------------------------------------------------------------------------
-- Row level security (teachers only; anon gets nothing)
-- ---------------------------------------------------------------------------

create function public.owns_tour(p_tour_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tour
    where id = p_tour_id and teacher_id = (select auth.uid())
  );
$$;

create function public.owns_session(p_session_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.session s
    join public.tour t on t.id = s.tour_id
    where s.id = p_session_id and t.teacher_id = (select auth.uid())
  );
$$;

create function public.owns_team(p_team_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team tm
    join public.session s on s.id = tm.session_id
    join public.tour t on t.id = s.tour_id
    where tm.id = p_team_id and t.teacher_id = (select auth.uid())
  );
$$;

alter table public.teacher enable row level security;
alter table public.tour enable row level security;
alter table public.location enable row level security;
alter table public.question enable row level security;
alter table public.session enable row level security;
alter table public.team enable row level security;
alter table public.assignment enable row level security;
alter table public.ping enable row level security;
alter table public.unlock enable row level security;
alter table public.answer enable row level security;
alter table public.flag enable row level security;

create policy "teacher reads self" on public.teacher
  for select to authenticated using (id = (select auth.uid()));
create policy "teacher updates self" on public.teacher
  for update to authenticated using (id = (select auth.uid()));

create policy "teacher manages own tours" on public.tour
  for all to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

create policy "teacher manages locations" on public.location
  for all to authenticated
  using (public.owns_tour(tour_id))
  with check (public.owns_tour(tour_id));

create policy "teacher manages questions" on public.question
  for all to authenticated
  using (public.owns_tour((select tour_id from public.location where id = location_id)))
  with check (public.owns_tour((select tour_id from public.location where id = location_id)));

create policy "teacher manages sessions" on public.session
  for all to authenticated
  using (public.owns_tour(tour_id))
  with check (public.owns_tour(tour_id));

-- Teams, pings, unlocks and assignments are written by the server.
create policy "teacher reads teams" on public.team
  for select to authenticated using (public.owns_session(session_id));
create policy "teacher reads assignments" on public.assignment
  for select to authenticated using (public.owns_team(team_id));
create policy "teacher reads pings" on public.ping
  for select to authenticated using (public.owns_team(team_id));
create policy "teacher reads unlocks" on public.unlock
  for select to authenticated using (public.owns_team(team_id));

-- The lock_answer trigger limits teacher updates to the review columns.
create policy "teacher reads answers" on public.answer
  for select to authenticated using (public.owns_team(team_id));
create policy "teacher reviews answers" on public.answer
  for update to authenticated
  using (public.owns_team(team_id))
  with check (public.owns_team(team_id));

create policy "teacher reads flags" on public.flag
  for select to authenticated using (public.owns_team(team_id));
create policy "teacher resolves flags" on public.flag
  for update to authenticated
  using (public.owns_team(team_id))
  with check (public.owns_team(team_id));

-- ---------------------------------------------------------------------------
-- Realtime for the teacher's live map
-- ---------------------------------------------------------------------------

alter publication supabase_realtime
  add table public.team, public.ping, public.unlock, public.answer, public.flag;

-- ---------------------------------------------------------------------------
-- Photo storage: photos/{session_id}/{team_id}/{question_id}.jpg
-- Uploads go through the server; teachers can view their sessions' photos.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 8388608, array['image/jpeg', 'image/webp']);

create policy "teacher reads session photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and public.owns_session(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Privacy: delete location pings 30 days after the session
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

create function public.purge_old_pings()
returns void
language sql security definer
set search_path = ''
as $$
  delete from public.ping p
  using public.team tm, public.session s
  where p.team_id = tm.id
    and s.id = tm.session_id
    and coalesce(s.ends_at, s.created_at) < now() - interval '30 days';
$$;

revoke execute on function public.purge_old_pings() from public, anon, authenticated;

select cron.schedule('purge-old-pings', '15 3 * * *', 'select public.purge_old_pings()');
