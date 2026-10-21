-- Discriminators (name#1234), badge v2 options, and the seeded badge set.

-- 1. Discriminators: usernames may repeat; name + discriminator is unique.
alter table public.profiles add column if not exists discriminator text;
alter table public.profiles add column if not exists must_rename boolean not null default false;
alter table public.profiles drop constraint if exists profiles_username_key;

create or replace function public.profile_random_discriminator(p_username text, p_exclude uuid default null)
returns text language plpgsql as $$
declare candidate text;
begin
  loop
    candidate := lpad((1000 + floor(random() * 9000))::integer::text, 4, '0');
    exit when not exists (
      select 1 from public.profiles p
      where p.username = p_username and p.discriminator = candidate and p.id is distinct from p_exclude
    );
  end loop;
  return candidate;
end $$;

create or replace function public.profile_assign_discriminator()
returns trigger language plpgsql as $$
begin
  if new.discriminator is null or new.discriminator !~ '^[0-9]{4}$'
     or (tg_op = 'UPDATE' and new.username is distinct from old.username
         and exists (select 1 from public.profiles p where p.username = new.username and p.discriminator = new.discriminator and p.id <> new.id)) then
    new.discriminator := public.profile_random_discriminator(new.username, new.id);
  end if;
  return new;
end $$;

drop trigger if exists profiles_assign_discriminator on public.profiles;
create trigger profiles_assign_discriminator before insert or update of username, discriminator on public.profiles
for each row execute function public.profile_assign_discriminator();

-- Backfill every existing account now.
update public.profiles set discriminator = null where discriminator is not null and discriminator !~ '^[0-9]{4}$';
do $$
declare r record;
begin
  for r in select id, username from public.profiles where discriminator is null loop
    update public.profiles set discriminator = public.profile_random_discriminator(r.username, r.id) where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column discriminator set not null;
alter table public.profiles drop constraint if exists profiles_discriminator_check;
alter table public.profiles add constraint profiles_discriminator_check check (discriminator ~ '^[0-9]{4}$');
create unique index if not exists profiles_username_discriminator_key on public.profiles(username, discriminator);

-- Public profile now carries the discriminator so the UI can show name#1234.
create or replace function public.app_public_profile(p_user uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'username', username, 'discriminator', discriminator, 'name', name, 'bio', bio, 'avatar', avatar, 'status', status)
  from profiles where id = p_user
$$;

-- 2. Badge v2 options.
alter table public.staff_badges add column if not exists assignment text not null default 'manual';
alter table public.staff_badges add column if not exists display_scope text not null default 'everywhere';
alter table public.staff_badges add column if not exists hidden_from_picker boolean not null default false;
alter table public.staff_badges add column if not exists accent text not null default '#f5c400';
alter table public.staff_badges drop constraint if exists staff_badges_assignment_check;
alter table public.staff_badges add constraint staff_badges_assignment_check check (assignment in ('manual', 'automatic', 'both'));
alter table public.staff_badges drop constraint if exists staff_badges_display_scope_check;
alter table public.staff_badges add constraint staff_badges_display_scope_check check (display_scope in ('everywhere', 'profile', 'owned_servers', 'hidden'));

alter table public.badge_requirements drop constraint if exists badge_requirements_kind_check;
alter table public.badge_requirements add constraint badge_requirements_kind_check check (kind in (
  'staff', 'account_age_days', 'created_before', 'server_count',
  'owned_server_members', 'message_count', 'partner_owner',
  'verified_owner', 'is_bot', 'hypesquad', 'owns_server', 'legacy_username'
));

create or replace function public.badge_requirement_met(p_user uuid, p_kind text, p_config jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare n integer;
begin
  if p_user is null then return false; end if;
  if p_kind = 'staff' then
    return exists (select 1 from platform_staff where user_id = p_user);
  elsif p_kind = 'account_age_days' then
    return coalesce((
      select now() - u.created_at >= make_interval(days => greatest(0, coalesce((p_config->>'days')::integer, 0)))
      from auth.users u where u.id = p_user
    ), false);
  elsif p_kind = 'created_before' then
    return coalesce((
      select u.created_at < coalesce(nullif(p_config->>'date', '')::timestamptz, now())
      from auth.users u where u.id = p_user
    ), false);
  elsif p_kind = 'server_count' then
    select count(*) into n from members where user_id = p_user;
    return n >= greatest(1, coalesce((p_config->>'count')::integer, 1));
  elsif p_kind = 'owned_server_members' then
    select count(distinct m.user_id) into n
    from servers s join members m on m.server_id = s.id
    where s.owner = p_user;
    return n >= greatest(1, coalesce((p_config->>'count')::integer, 1));
  elsif p_kind = 'owns_server' then
    select count(*) into n from servers where owner = p_user;
    return n >= greatest(1, coalesce((p_config->>'count')::integer, 1));
  elsif p_kind = 'message_count' then
    select count(*) into n from messages where sender = p_user;
    return n >= greatest(1, coalesce((p_config->>'count')::integer, 1));
  elsif p_kind = 'partner_owner' then
    return exists (select 1 from servers where owner = p_user and partner);
  elsif p_kind = 'verified_owner' then
    return exists (select 1 from servers where owner = p_user and verified);
  elsif p_kind = 'is_bot' then
    return exists (select 1 from profiles where id = p_user and is_bot);
  elsif p_kind = 'hypesquad' then
    return exists (
      select 1 from profiles
      where id = p_user and hypesquad is not null and hypesquad = p_config->>'house'
    );
  elsif p_kind = 'legacy_username' then
    -- Given on the first Discord-style cutover date to every #-tagged account that signed up before the cutoff.
    return coalesce((
      select now() >= coalesce(nullif(p_config->>'available_from', '')::timestamptz, 'infinity'::timestamptz)
        and u.created_at < coalesce(nullif(p_config->>'signed_up_before', '')::timestamptz, 'infinity'::timestamptz)
        and p.discriminator is not null
      from auth.users u join profiles p on p.id = u.id where u.id = p_user
    ), false);
  end if;
  return false;
end $$;
revoke all on function public.badge_requirement_met(uuid, text, jsonb) from public, anon, authenticated;

-- 3. Forced username change after the 2027 cutover (run by the scheduled rollover).
create or replace function public.apply_username_rollover(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_now < '2027-01-01T00:00:00Z'::timestamptz then return 0; end if;
  update profiles set must_rename = true where discriminator is not null and not must_rename;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.apply_username_rollover(timestamptz) from public, anon, authenticated;

-- 4. Seed badges. Each badge is idempotent; requirements are only added when missing.
create or replace function pg_temp.seed_badge(
  p_id text, p_name text, p_desc text, p_category text, p_assignment text, p_scope text, p_hidden boolean, p_position integer,
  p_accent text, p_kind text, p_config jsonb
) returns void language plpgsql as $$
begin
  insert into public.staff_badges(id, name, description, category, assignment, display_scope, hidden_from_picker, position, accent)
  values (p_id, p_name, p_desc, p_category, p_assignment, p_scope, p_hidden, p_position, p_accent)
  on conflict (id) do update set name = excluded.name, description = excluded.description, category = excluded.category,
    assignment = excluded.assignment, display_scope = excluded.display_scope, hidden_from_picker = excluded.hidden_from_picker,
    position = excluded.position, accent = excluded.accent;
  if p_kind is not null and not exists (select 1 from public.badge_requirements where badge = p_id) then
    insert into public.badge_requirements(badge, kind, config) values (p_id, p_kind, p_config);
  end if;
end $$;

select pg_temp.seed_badge('account-seed', 'Seed', 'Keep an active account for one year.', 'account-age', 'automatic', 'everywhere', false, 100, '#7fb08a', 'account_age_days', '{"days":365}');
select pg_temp.seed_badge('account-sprout', 'Sprout', 'Two years of activity.', 'account-age', 'automatic', 'everywhere', false, 101, '#8cc86a', 'account_age_days', '{"days":730}');
select pg_temp.seed_badge('account-bud', 'Bud', 'Three years of activity.', 'account-age', 'automatic', 'everywhere', false, 102, '#5fd17a', 'account_age_days', '{"days":1095}');
select pg_temp.seed_badge('account-sapling', 'Sapling', 'Four years of activity.', 'account-age', 'automatic', 'everywhere', false, 103, '#4fd1c5', 'account_age_days', '{"days":1460}');
select pg_temp.seed_badge('account-blossom', 'Blossom', 'Five years of activity.', 'account-age', 'automatic', 'everywhere', false, 104, '#5bb8fa', 'account_age_days', '{"days":1825}');
select pg_temp.seed_badge('account-redwood', 'Redwood', 'Six years of activity.', 'account-age', 'automatic', 'everywhere', false, 105, '#7c8cff', 'account_age_days', '{"days":2190}');
select pg_temp.seed_badge('account-sequoia', 'Sequoia', 'Seven years of activity.', 'account-age', 'automatic', 'everywhere', false, 106, '#a78bfa', 'account_age_days', '{"days":2555}');
select pg_temp.seed_badge('account-bristlecone', 'Bristlecone', 'Eight years of activity.', 'account-age', 'automatic', 'everywhere', false, 107, '#d670e8', 'account_age_days', '{"days":2920}');
select pg_temp.seed_badge('account-stromatolite', 'Stromatolite', 'Nine years of activity.', 'account-age', 'automatic', 'everywhere', false, 108, '#f472b6', 'account_age_days', '{"days":3285}');
select pg_temp.seed_badge('account-primordial', 'Primordial', 'Ten or more years of activity.', 'account-age', 'automatic', 'everywhere', false, 109, '#f5c400', 'account_age_days', '{"days":3650}');

select pg_temp.seed_badge('hypesquad-bravery', 'HypeSquad Bravery', 'Chose the Bravery house in the HypeSquad quiz.', 'house', 'automatic', 'everywhere', false, 120, '#a78bfa', 'hypesquad', '{"house":"bravery"}');
select pg_temp.seed_badge('hypesquad-brilliance', 'HypeSquad Brilliance', 'Chose the Brilliance house in the HypeSquad quiz.', 'house', 'automatic', 'everywhere', false, 121, '#ed6a5e', 'hypesquad', '{"house":"brilliance"}');
select pg_temp.seed_badge('hypesquad-balance', 'HypeSquad Balance', 'Chose the Balance house in the HypeSquad quiz.', 'house', 'automatic', 'everywhere', false, 122, '#43d4a0', 'hypesquad', '{"house":"balance"}');

select pg_temp.seed_badge('legacy-username', 'Legacy Username', 'Kept a name#1234 username from before the cutover. Awarded 14 January 2027 to everyone who signed up before 1 January 2027.', 'legacy', 'automatic', 'everywhere', false, 130, '#5bb8fa', 'legacy_username', '{"signed_up_before":"2027-01-01T00:00:00Z","available_from":"2027-01-14T00:00:00Z"}');
select pg_temp.seed_badge('server-owner', 'Server Owner', 'Owns a server. Only shown inside the servers you own.', 'ownership', 'automatic', 'owned_servers', false, 140, '#f5c400', 'owns_server', '{"count":1}');
select pg_temp.seed_badge('spark-supporter', 'Spark', 'Subscriber badge. Only granted by billing, never picked by staff.', 'subscription', 'manual', 'everywhere', true, 150, '#f5c400', null, '{}');
select pg_temp.seed_badge('gift-giver', 'Gift Giver', 'Sent gifts to other members. Only granted by billing.', 'subscription', 'manual', 'profile', true, 151, '#ed6a5e', null, '{}');
select pg_temp.seed_badge('early-supporter', 'Early Supporter', 'Early member who helped shape Constellation.', 'achievement', 'both', 'everywhere', false, 2, '#f5c400', null, '{}');
select pg_temp.seed_badge('staff', 'Staff', 'Constellation staff.', 'staff', 'both', 'everywhere', false, 0, '#5bb8fa', 'staff', '{}');
select pg_temp.seed_badge('verified', 'Verified', 'Verified account.', 'achievement', 'manual', 'everywhere', false, 1, '#43d440', null, '{}');

drop function pg_temp.seed_badge(text, text, text, text, text, text, boolean, integer, text, text, jsonb);
