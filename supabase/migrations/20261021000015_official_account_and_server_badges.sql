-- The official Constellation account: no login, no discriminator, system messages only.
alter table public.profiles add column if not exists is_official boolean not null default false;

-- Only trusted server-side code may mark an account official; a member must not
-- be able to promote their own profile through a normal update.
create or replace function public.profile_guard_official()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.is_official is distinct from old.is_official then
    raise exception 'Reserved account flag';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_official on public.profiles;
create trigger profiles_guard_official before update on public.profiles
for each row execute function public.profile_guard_official();

create or replace function public.app_public_profile(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', id, 'username', username, 'discriminator', discriminator,
    'name', name, 'bio', bio, 'avatar', avatar, 'status', status,
    'is_bot', is_bot, 'is_official', is_official
  )
  from profiles where id = p_user
$$;

-- The official profile. The auth row exists only to satisfy the profiles
-- foreign key: it has no email, no password and no identity, so it cannot sign in.
do $$
declare official uuid := '00000000-0000-4000-8000-000000000001';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
  )
  values (
    '00000000-0000-0000-0000-000000000000', official, 'authenticated', 'authenticated',
    'system@constellation.invalid', null, null, now(), now(), '{}'::jsonb, '{"name":"Constellation"}'::jsonb, false
  )
  on conflict (id) do nothing;

  delete from auth.identities where user_id = official;
  update auth.users
    set email = null, encrypted_password = null, email_confirmed_at = null,
        raw_app_meta_data = '{}'::jsonb, raw_user_meta_data = '{"name":"Constellation"}'::jsonb
    where id = official;

  update public.profiles
    set username = 'constellation', name = 'Constellation', username_plain = true,
        discriminator = null, must_rename = false, is_official = true,
        bio = 'Official Constellation account. System and privacy notices only — this account cannot sign in or reply.'
    where id = official;
end $$;

-- A read-only conversation: nobody may post into the official account.
alter function public.app_api(text, jsonb) rename to app_api_before_official;
create or replace function public.app_api(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := nullif(p_payload->>'user', '')::uuid;
begin
  if p_action = 'message/send' then
    if exists (select 1 from profiles where id = auth.uid() and is_official) then
      raise exception 'This account cannot post';
    end if;
    if v_user is not null and exists (select 1 from profiles where id = v_user and is_official) then
      raise exception 'This conversation is read-only';
    end if;
  end if;
  return public.app_api_before_official(p_action, p_payload);
end $$;
revoke all on function public.app_api(text, jsonb) from public, anon;
grant execute on function public.app_api(text, jsonb) to authenticated;

-- Server badges. A server badge is granted automatically while the server has
-- the matching feature flag, and removed the moment the flag is switched off.
alter table public.servers add column if not exists features jsonb not null default '{}'::jsonb;
alter table public.staff_badges add column if not exists server_flag text;

create table if not exists public.server_badges (
  server_id uuid not null references public.servers(id) on delete cascade,
  badge text not null references public.staff_badges(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (server_id, badge)
);
alter table public.server_badges enable row level security;
revoke all on public.server_badges from public, anon, authenticated;

insert into public.staff_badges(id, name, description, category, assignment, display_scope, hidden_from_picker, position, accent, icon_url, server_flag)
values (
  'internal-employee', 'Internal Employee',
  'Given to servers with the INTERNAL_EMPLOYEE_ONLY feature flag.',
  'server', 'automatic', 'everywhere', true, 10, '#aeb3c5',
  '/assets/modifyuser.png', 'INTERNAL_EMPLOYEE_ONLY'
)
on conflict(id) do update set
  name = excluded.name, description = excluded.description, category = excluded.category,
  assignment = excluded.assignment, display_scope = excluded.display_scope,
  hidden_from_picker = excluded.hidden_from_picker, position = excluded.position,
  accent = excluded.accent, icon_url = excluded.icon_url, server_flag = excluded.server_flag;

create or replace function public.app_sync_server_badges(p_server uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if p_server is null then raise exception 'Choose a server'; end if;

  insert into server_badges(server_id, badge)
  select p_server, b.id
  from staff_badges b
  join servers s on s.id = p_server
  where b.server_flag is not null
    and coalesce((s.features ->> b.server_flag)::boolean, false)
  on conflict (server_id, badge) do nothing;

  delete from server_badges sb
  using staff_badges b, servers s
  where sb.server_id = p_server and b.id = sb.badge and s.id = p_server
    and b.server_flag is not null
    and not coalesce((s.features ->> b.server_flag)::boolean, false);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'name', b.name, 'description', b.description,
    'icon_url', b.icon_url, 'accent', b.accent
  ) order by b.position, b.id), '[]'::jsonb)
  into result
  from server_badges sb
  join staff_badges b on b.id = sb.badge
  where sb.server_id = p_server;

  return result;
end $$;
revoke all on function public.app_sync_server_badges(uuid) from public, anon, authenticated;

-- Every server badge the signed-in member can see, for the client to merge into state.
create or replace function public.app_server_badges()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'server_id', sb.server_id, 'id', b.id, 'name', b.name,
    'description', b.description, 'icon_url', b.icon_url, 'accent', b.accent
  ) order by b.position, b.id), '[]'::jsonb)
  from server_badges sb
  join staff_badges b on b.id = sb.badge
  where exists (
    select 1 from members m
    where m.server_id = sb.server_id and m.user_id = auth.uid()
  )
$$;
revoke all on function public.app_server_badges() from public, anon;
grant execute on function public.app_server_badges() to authenticated;

-- Staff can flip the flag that controls the badge.
alter function public.staff_action(text, jsonb) rename to staff_action_before_server_features;
create or replace function public.staff_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := nullif(p_payload->>'server_id', '')::uuid; flag text := upper(trim(coalesce(p_payload->>'flag', '')));
begin
  if p_action = 'server/features' then
    if sid is null then raise exception 'Choose a server'; end if;
    if flag !~ '^[A-Z][A-Z0-9_]{2,40}$' then raise exception 'Choose a valid feature flag'; end if;
    update servers
      set features = case
        when coalesce((p_payload->>'enabled')::boolean, false)
          then features || jsonb_build_object(flag, true)
        else features - flag
      end
      where id = sid;
    if not found then raise exception 'Server not found'; end if;
    perform app_sync_server_badges(sid);
    return jsonb_build_object('features', (select features from servers where id = sid));
  end if;
  return staff_action_before_server_features(p_action, p_payload);
end $$;
revoke all on function public.staff_action(text, jsonb) from public, anon;
grant execute on function public.staff_action(text, jsonb) to authenticated;

-- Backfill existing flags so the badge list is correct immediately.
do $$
declare s record;
begin
  for s in select id from servers loop
    perform app_sync_server_badges(s.id);
  end loop;
end $$;

notify pgrst, 'reload schema';
