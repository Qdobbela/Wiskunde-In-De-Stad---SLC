-- Microsoft (azure) logins put the name in full_name, not name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
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
