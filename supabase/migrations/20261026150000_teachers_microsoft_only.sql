-- Teachers log in with Microsoft only, and student accounts are refused.
--
--   * An e-mail domain containing "student" (bob.jansens@student.sintlievenscollege.be)
--     can't create an account at all: the sign-up fails.
--   * Only Microsoft (azure) logins get a teacher row. Every RLS policy and
--     the tour.teacher_id foreign key hang off that row, so any other account
--     (e.g. e-mail + password made through the API) can't see or create anything.
--
-- Test accounts made with the secret key get their teacher row inserted by
-- the test itself.

create function public.is_student_email(email text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select split_part(lower(coalesce(email, '')), '@', 2) like '%student%';
$$;

-- Before insert: stop a student sign-up before the auth user exists.
create function public.refuse_student_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_student_email(new.email) then
    raise exception 'student_account: leerlingen kunnen geen leerkrachtaccount maken';
  end if;
  return new;
end;
$$;

create trigger refuse_student_user
  before insert or update of email on auth.users
  for each row execute function public.refuse_student_user();

-- After insert: only Microsoft logins become teachers.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'azure' then
    return new;
  end if;

  insert into public.teacher (id, name, email, school)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      ''
    ),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'school', '')
  );
  return new;
end;
$$;

-- Belt and braces: a student address can never be stored as a teacher.
alter table public.teacher
  add constraint teacher_not_student check (not public.is_student_email(email));
