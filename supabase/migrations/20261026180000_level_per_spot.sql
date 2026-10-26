-- Groups now choose a level at every spot, after it unlocks, instead of once
-- at the start. The chosen level is the level of the assigned question.

-- team.level is no longer set for new groups (kept for older sessions).
alter table public.team alter column level drop not null;
drop trigger team_lock_level on public.team;
drop function public.lock_team_level();

-- Points use the level of the question the group chose at that spot.
create or replace view public.answer_points
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
    q.base_points * public.niveau_multiplier(q.level) * case
      when a.teacher_score is not null then a.teacher_score
      when q.needs_photo or q.answer_type = 'photo' then 0
      when a.auto_correct then 1
      else 0
    end
  ) as points
from public.answer a
join public.question q on q.id = a.question_id;
