-- Steps 4 to 7: unlocking, live map, messages, phone binding.

-- The phone a group plays on (a random id kept in that phone's browser).
-- A request with the group's token from another phone raises a second_device
-- flag. The teacher can clear it so a group can continue on a new phone.
alter table public.team add column device_id text;

-- Teachers may only change device_id on a team (to let a new phone in).
revoke update on public.team from authenticated;
grant update (device_id) on public.team to authenticated;
create policy "teacher resets team phone" on public.team
  for update to authenticated
  using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

-- "Bericht aan iedereen" on T04.
create table public.session_message (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.session (id) on delete cascade,
  body text not null check (length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index session_message_session_idx on public.session_message (session_id, created_at desc);
alter table public.session_message enable row level security;
create policy "teacher manages messages" on public.session_message
  for all to authenticated
  using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

-- Newest position per group, for the live map (T04).
create view public.team_last_ping
with (security_invoker = true)
as
select distinct on (p.team_id)
  p.team_id, p.lat, p.lng, p.accuracy_m, p.received_at
from public.ping p
order by p.team_id, p.received_at desc;

-- The live map follows these tables (ping, flag, answer, unlock, team are
-- already published).
alter publication supabase_realtime add table public.session_message;

-- Unresolved suspicious flags per team are looked up on every ping.
create index flag_team_unresolved_idx on public.flag (team_id) where resolved_at is null;
