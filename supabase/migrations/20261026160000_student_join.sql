-- Students joining a session (L01 to L04).

-- Groups start at different spots so they don't all crowd spot 1:
-- the route is the tour order, rotated by start_index.
alter table public.team add column start_index int not null default 0 check (start_index >= 0);

-- Teachers watch groups join live on the session page.
-- (team is already in the supabase_realtime publication.)

-- Fast lookups for the student routes.
create index team_session_id_idx on public.team (session_id);
create index answer_team_id_idx on public.answer (team_id);
create index unlock_team_id_idx on public.unlock (team_id);
