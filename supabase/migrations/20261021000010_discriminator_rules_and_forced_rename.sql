-- Discriminators never change once assigned. A forced 2027 rename moves the account to a plain username with no tag.

alter table public.profiles add column if not exists username_plain boolean not null default false;
alter table public.profiles alter column discriminator drop not null;

create unique index if not exists profiles_plain_username_key on public.profiles(lower(username)) where username_plain;

create or replace function public.profile_assign_discriminator()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.discriminator is not null and not new.username_plain
     and new.discriminator is distinct from old.discriminator then
    raise exception 'Your tag never changes';
  end if;
  if new.username_plain then
    new.discriminator := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.username is distinct from old.username
     and exists (select 1 from profiles p where p.username = new.username and p.discriminator = old.discriminator and p.id <> new.id) then
    raise exception 'That name is already used with your tag';
  end if;
  if new.discriminator is null or new.discriminator !~ '^[0-9]{4}$' then
    new.discriminator := public.profile_random_discriminator(new.username, new.id);
  end if;
  return new;
end $$;

drop trigger if exists profiles_assign_discriminator on public.profiles;
create trigger profiles_assign_discriminator before insert or update of username, discriminator, username_plain on public.profiles
for each row execute function public.profile_assign_discriminator();

alter table public.profiles drop constraint if exists profiles_discriminator_check;
alter table public.profiles add constraint profiles_discriminator_check check (discriminator is null or discriminator ~ '^[0-9]{4}$');

-- Resolve "name#1234", a user id, or a plain username to one profile id.
create or replace function public.app_resolve_profile(p_text text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare t text := trim(coalesce(p_text, '')); found_id uuid; base text; tag text;
begin
  if t = '' then return null; end if;
  if t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into found_id from profiles where id = t::uuid;
    return found_id;
  end if;
  if t ~ '^.+#[0-9]{4}$' then
    base := lower(split_part(t, '#', 1));
    tag := split_part(t, '#', 2);
    select id into found_id from profiles where lower(username) = base and discriminator = tag;
    return found_id;
  end if;
  select id into found_id from profiles where username_plain and lower(username) = lower(t);
  if found_id is null then
    select id into found_id from profiles where lower(username) = lower(t) and discriminator is null limit 1;
  end if;
  return found_id;
end $$;
revoke all on function public.app_resolve_profile(text) from public, anon, authenticated;

-- Completing the forced rename: a name nobody else holds, and no tag afterwards.
create or replace function public.app_complete_forced_rename(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare name text := lower(trim(coalesce(p_username, '')));
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and must_rename) then
    raise exception 'No username change is required';
  end if;
  if name !~ '^[a-z0-9_.-]{3,32}$' then raise exception 'Choose 3–32 letters, numbers, dots, dashes or underscores'; end if;
  if exists (select 1 from profiles where lower(username) = name and id <> auth.uid()) then
    raise exception 'That username is taken';
  end if;
  update profiles set username = name, username_plain = true, discriminator = null, must_rename = false where id = auth.uid();
  return jsonb_build_object('profile', app_public_profile(auth.uid()));
end $$;
revoke all on function public.app_complete_forced_rename(text) from public, anon;
grant execute on function public.app_complete_forced_rename(text) to authenticated;

-- DM lookup uses the exact name#tag (or user id). Everything else passes to the existing dispatcher.
alter function public.app_api(text, jsonb) rename to app_api_before_discriminators;
create or replace function public.app_api(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_target uuid;
begin
  if p_action = 'dm/open' then
    v_target := public.app_resolve_profile(p_payload->>'username');
    if v_target is null or v_target = v_me then raise exception 'User not found'; end if;
    return jsonb_build_object('user', app_public_profile(v_target));
  end if;
  return public.app_api_before_discriminators(p_action, p_payload);
end $$;
revoke all on function public.app_api(text, jsonb) from public, anon;
grant execute on function public.app_api(text, jsonb) to authenticated;

-- Forced rename gate: the scheduled rollover marks accounts that still have a tag.
create or replace function public.apply_username_rollover(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_now < '2027-01-01T00:00:00Z'::timestamptz then return 0; end if;
  update profiles set must_rename = true where discriminator is not null and not username_plain and not must_rename;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.apply_username_rollover(timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';
