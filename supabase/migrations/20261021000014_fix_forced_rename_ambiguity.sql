-- The plpgsql variable `name` collided with profiles.name inside the lookup
-- query, so every forced rename failed with "column reference name is ambiguous".
create or replace function public.app_complete_forced_rename(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text := lower(trim(coalesce(p_username, '')));
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and must_rename) then
    raise exception 'No username change is required';
  end if;
  if v_name !~ '^[a-z0-9_.-]{3,32}$' then raise exception 'Choose 3–32 letters, numbers, dots, dashes or underscores'; end if;
  if exists (select 1 from profiles p where lower(p.username) = v_name and p.id <> auth.uid()) then
    raise exception 'That username is taken';
  end if;
  update profiles set username = v_name, username_plain = true, discriminator = null, must_rename = false where id = auth.uid();
  return jsonb_build_object('profile', app_public_profile(auth.uid()));
end $$;
revoke all on function public.app_complete_forced_rename(text) from public, anon;
grant execute on function public.app_complete_forced_rename(text) to authenticated;

notify pgrst, 'reload schema';
