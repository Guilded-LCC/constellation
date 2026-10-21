-- Badge engine: descriptions, automatic requirements, multi-grant, and the
-- staff console payloads used by the redesigned moderation workspace.

alter table public.staff_badges add column if not exists description text not null default '';
alter table public.staff_badges add column if not exists category text not null default 'achievement';

alter table public.profile_badges add column if not exists source text not null default 'manual';
alter table public.profile_badges add column if not exists granted_by uuid;
alter table public.profile_badges add column if not exists granted_at timestamptz not null default now();

alter table public.profiles add column if not exists hypesquad text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_hypesquad_check'
  ) then
    alter table public.profiles
      add constraint profiles_hypesquad_check
      check (hypesquad is null or hypesquad in ('bravery', 'brilliance', 'balance'));
  end if;
end $$;

create table if not exists public.badge_requirements (
  id uuid primary key default gen_random_uuid(),
  badge text not null references public.staff_badges(id) on delete cascade,
  kind text not null check (kind in (
    'staff', 'account_age_days', 'created_before', 'server_count',
    'owned_server_members', 'message_count', 'partner_owner',
    'verified_owner', 'is_bot', 'hypesquad'
  )),
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists badge_requirements_badge_idx on public.badge_requirements(badge);
alter table public.badge_requirements enable row level security;
drop policy if exists "badge requirements are readable" on public.badge_requirements;
create policy "badge requirements are readable" on public.badge_requirements
  for select to authenticated using (true);

create table if not exists public.user_moderation_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  author uuid references public.profiles(id),
  kind text not null default 'note' check (kind in ('note', 'ban', 'unban', 'ip-ban', 'device-ban')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists user_moderation_notes_user_idx on public.user_moderation_notes(user_id, created_at desc);
alter table public.user_moderation_notes enable row level security;
drop policy if exists "staff read moderation notes" on public.user_moderation_notes;
create policy "staff read moderation notes" on public.user_moderation_notes
  for select to authenticated using (public.is_platform_staff());

-- Trigram search keeps the staff console fast as the user table grows.
do $$
begin
  begin
    create extension if not exists pg_trgm;
  exception when others then
    raise notice 'pg_trgm unavailable: %', sqlerrm;
  end;
  begin
    execute 'create index if not exists profiles_username_trgm on public.profiles using gin (username gin_trgm_ops)';
    execute 'create index if not exists profiles_name_trgm on public.profiles using gin (name gin_trgm_ops)';
  exception when others then
    raise notice 'profile trigram indexes skipped: %', sqlerrm;
  end;
end $$;

-- Storage: platform staff may publish badge artwork.
drop policy if exists "staff upload badge icons" on storage.objects;
create policy "staff upload badge icons" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'badges'
    and public.is_platform_staff()
  );
drop policy if exists "staff update badge icons" on storage.objects;
create policy "staff update badge icons" on storage.objects for update to authenticated
  using (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'badges'
    and public.is_platform_staff()
  );

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
  end if;
  return false;
end $$;
revoke all on function public.badge_requirement_met(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.app_sync_badges(p_user uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(p_user, auth.uid());
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if target is null then raise exception 'Choose a user'; end if;
  if target <> auth.uid() and not public.is_platform_staff() then raise exception 'Not found'; end if;

  insert into profile_badges(user_id, badge, source, granted_at)
  select target, b.id, 'auto', now()
  from staff_badges b
  where exists (select 1 from badge_requirements r where r.badge = b.id and r.enabled)
    and not exists (
      select 1 from badge_requirements r
      where r.badge = b.id and r.enabled
        and not public.badge_requirement_met(target, r.kind, r.config)
    )
  on conflict (user_id, badge) do nothing;

  delete from profile_badges pb
  where pb.user_id = target
    and pb.source = 'auto'
    and exists (select 1 from badge_requirements r where r.badge = pb.badge and r.enabled)
    and exists (
      select 1 from badge_requirements r
      where r.badge = pb.badge and r.enabled
        and not public.badge_requirement_met(target, r.kind, r.config)
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', b.id, 'name', b.name, 'description', b.description,
      'icon_url', b.icon_url, 'category', b.category, 'source', pb.source
    ) order by b.position, b.id
  ), '[]'::jsonb)
  into result
  from profile_badges pb
  join staff_badges b on b.id = pb.badge
  where pb.user_id = target;

  return result;
end $$;
revoke all on function public.app_sync_badges(uuid) from public, anon;
grant execute on function public.app_sync_badges(uuid) to authenticated;

create or replace function public.app_set_hypesquad(p_house text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare house text := lower(trim(coalesce(p_house, '')));
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if house <> '' and house not in ('bravery', 'brilliance', 'balance') then
    raise exception 'Choose a HypeSquad house';
  end if;
  update profiles set hypesquad = nullif(house, '') where id = auth.uid();
  return jsonb_build_object('hypesquad', nullif(house, ''), 'badges', app_sync_badges(auth.uid()));
end $$;
revoke all on function public.app_set_hypesquad(text) from public, anon;
grant execute on function public.app_set_hypesquad(text) to authenticated;

create or replace function public.app_public_profile(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'name', p.name,
    'bio', p.bio,
    'avatar', p.avatar,
    'avatar_url', p.avatar_url,
    'banner_url', p.banner_url,
    'status', p.status,
    'custom_status', p.custom_status,
    'custom_status_emoji', p.custom_status_emoji,
    'is_bot', coalesce(p.is_bot, false),
    'hypesquad', p.hypesquad,
    'created_at', p.created_at,
    'badges', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', b.id, 'name', b.name, 'description', b.description,
                           'icon_url', b.icon_url, 'category', b.category, 'source', pb.source)
        order by b.position, b.id)
      from public.profile_badges pb
      join public.staff_badges b on b.id = pb.badge
      where pb.user_id = p.id
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.id = p_user
$$;

-- Seed the Constellation badge catalogue descriptions.
update public.staff_badges set description = case id
  when 'staff' then 'Awarded automatically to members of the Constellation platform team.'
  when 'verified' then 'Confirms this account is an official, verified Constellation presence.'
  when 'early-supporter' then 'Supported Constellation during its earliest days. No longer obtainable.'
  when 'constellation-partner' then 'Runs a partnered community that meets Constellation partner criteria.'
  when 'constellation-house-bravery' then 'Member of HypeSquad Bravery, the house of courage.'
  when 'constellation-house-brilliance' then 'Member of HypeSquad Brilliance, the house of creativity.'
  when 'constellation-house-balance' then 'Member of HypeSquad Balance, the house of calm.'
  when 'constellation-events-attendee' then 'Attended an official Constellation community event.'
  when 'constellation-bug-hunter' then 'Reported valid security or product bugs to the Constellation team.'
  when 'constellation-certified-moderator' then 'Completed the Constellation certified moderator program.'
  when 'constellation-active-developer' then 'Ships an active Constellation bot or application.'
  when 'constellation-verified-bot-developer-legacy' then 'Legacy award for developers of verified bots.'
  when 'constellation-premium-subscriber' then 'Active Constellation Premium subscriber.'
  when 'constellation-server-booster' then 'Boosted a community with Constellation Premium.'
  when 'constellation-verified-bot' then 'An official bot verified by the Constellation team.'
  when 'constellation-early-verified-bot-developer' then 'Legacy award for early verified bot developers.'
  when 'constellation-community-moderator' then 'Recognised community leader and moderator.'
  when 'constellation-event-staff' then 'Helped run an official Constellation event.'
  when 'constellation-event-participant' then 'Took part in a seasonal Constellation event.'
  when 'constellation-seasonal-event' then 'Earned during a limited seasonal event.'
  when 'constellation-game-developer' then 'Built a game integration for Constellation.'
  else description end
where description = '';

update public.staff_badges set category = case
  when id in ('staff', 'verified') then 'identity'
  when id like 'constellation-house-%' then 'hypesquad'
  when id in ('constellation-partner', 'constellation-premium-subscriber', 'constellation-server-booster') then 'program'
  when id in ('constellation-verified-bot', 'constellation-active-developer',
              'constellation-verified-bot-developer-legacy', 'constellation-early-verified-bot-developer',
              'constellation-game-developer') then 'developer'
  when id like 'constellation-%event%' or id = 'constellation-events-attendee' or id = 'constellation-seasonal-event' then 'event'
  else 'achievement' end;

-- Badge icons are now drawn by the client; clear external images that the CSP blocks.
update public.staff_badges
set icon_url = ''
where icon_url <> '' and icon_url not like 'https://hyongvpfhikiibgdlkgw.supabase.co/storage/v1/object/public/community-media/%';

-- Default automatic requirements. Admins can edit these in the staff console.
insert into public.badge_requirements(badge, kind, config)
select v.badge, v.kind, v.config
from (values
  ('staff', 'staff', '{}'::jsonb),
  ('constellation-partner', 'partner_owner', '{}'::jsonb),
  ('constellation-house-bravery', 'hypesquad', '{"house":"bravery"}'::jsonb),
  ('constellation-house-brilliance', 'hypesquad', '{"house":"brilliance"}'::jsonb),
  ('constellation-house-balance', 'hypesquad', '{"house":"balance"}'::jsonb),
  ('constellation-active-developer', 'is_bot', '{}'::jsonb),
  ('early-supporter', 'created_before', '{"date":"2026-10-01T00:00:00Z"}'::jsonb)
) as v(badge, kind, config)
where exists (select 1 from public.staff_badges b where b.id = v.badge)
  and not exists (select 1 from public.badge_requirements r where r.badge = v.badge);

-- Remove the hard-coded staff badge special case in favour of the requirement engine.
create or replace function public.staff_action(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); target uuid:=nullif(p_payload->>'user_id','')::uuid; sid uuid:=nullif(p_payload->>'server_id','')::uuid; rid uuid:=nullif(p_payload->>'report_id','')::uuid; result jsonb; v_reason text:=left(trim(coalesce(p_payload->>'reason','')),1000); actor_level text; v_total integer; v_rows jsonb; q text; v_limit integer; v_offset integer;
begin
 if me is null then raise exception 'Please sign in'; end if;
 if p_action='report/create' then
  if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'Add a reason for this report'; end if;
  if nullif(p_payload->>'message_id','') is not null and not exists(select 1 from messages m join channels c on c.id=m.channel_id where m.id=(p_payload->>'message_id')::uuid and app_access(c.id)) then raise exception 'Reported message not found'; end if;
  insert into staff_reports(reporter,target_user,server_id,message_id,reason) values(me,nullif(p_payload->>'target_user','')::uuid,coalesce(nullif(p_payload->>'server_id','')::uuid,(select c.server_id from messages m join channels c on c.id=m.channel_id where m.id=nullif(p_payload->>'message_id','')::uuid)),nullif(p_payload->>'message_id','')::uuid,left(trim(p_payload->>'reason'),2000)) returning id into rid;
  return jsonb_build_object('id',rid);
 end if;
 if not is_platform_staff() then raise exception 'Not found'; end if;
 select level into actor_level from platform_staff where user_id=me;
 if p_action='dashboard' then
  select jsonb_build_object('users',(select count(*) from auth.users),'servers',(select count(*) from servers),'messages_today',(select count(*) from messages where created_at>=date_trunc('day',now())),'open_reports',(select count(*) from staff_reports where status in ('open','reviewing')),'suspended',(select count(*) from user_suspensions),'signups_7d',(select count(*) from auth.users where created_at>=now()-interval '7 days'),'activity',coalesce((select jsonb_agg(to_jsonb(a)) from (select actor,action,target_type,target_id,reason,created_at from staff_audit order by id desc limit 20) a),'[]')) into result;
 elsif p_action='users/search' then
  q := left(trim(coalesce(p_payload->>'query','')),100);
  v_limit := least(greatest(coalesce(nullif(p_payload->>'limit','')::integer,25),1),100);
  v_offset := greatest(coalesce(nullif(p_payload->>'offset','')::integer,0),0);
  select count(*) into v_total
  from profiles p join auth.users u on u.id=p.id
  where q=''
     or p.username ilike '%'||q||'%'
     or coalesce(p.name,'') ilike '%'||q||'%'
     or coalesce(u.email,'') ilike q||'%'
     or p.id::text = lower(q)
     or p.id::text ilike lower(q)||'%';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into v_rows
  from (
    select p.id,p.username,p.name,p.avatar,p.avatar_url,u.email,u.created_at,u.last_sign_in_at,
           coalesce(p.is_bot,false) as is_bot,
           exists(select 1 from user_suspensions z where z.user_id=p.id) as suspended,
           exists(select 1 from platform_staff z where z.user_id=p.id) as is_staff
    from profiles p join auth.users u on u.id=p.id
    where q=''
       or p.username ilike '%'||q||'%'
       or coalesce(p.name,'') ilike '%'||q||'%'
       or coalesce(u.email,'') ilike q||'%'
       or p.id::text = lower(q)
       or p.id::text ilike lower(q)||'%'
    order by u.created_at desc
    limit v_limit offset v_offset
  ) x;
  result := jsonb_build_object('total',v_total,'rows',v_rows,'limit',v_limit,'offset',v_offset);
 elsif p_action='user/get' then
  perform app_sync_badges(target);
  select jsonb_build_object(
    'profile',app_public_profile(target),
    'email',u.email,
    'created_at',u.created_at,
    'last_sign_in_at',u.last_sign_in_at,
    'email_confirmed',u.email_confirmed_at is not null,
    'badges',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'icon_url',b.icon_url,'category',b.category,'source',pb.source) order by b.position,b.id) from profile_badges pb join staff_badges b on b.id=pb.badge where pb.user_id=target),'[]'),
    'servers',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'created_at',s.created_at)) from servers s join members m on m.server_id=s.id where m.user_id=target),'[]'),
    'messages',(select count(*) from messages where sender=target),
    'suspension',(select to_jsonb(x) from user_suspensions x where x.user_id=target),
    'notes',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'body',n.body,'created_at',n.created_at,'author',app_public_profile(n.author)) order by n.created_at desc) from user_moderation_notes n where n.user_id=target),'[]'),
    'reports',(select count(*) from staff_reports where target_user=target),
    'is_staff',exists(select 1 from platform_staff where user_id=target),
    'staff_level',(select level from platform_staff where user_id=target),
    'hypesquad',(select hypesquad from profiles where id=target)
  ) into result from auth.users u where u.id=target;
 elsif p_action='user/badge' then
  if p_payload->>'badge'='staff' then raise exception 'The Staff badge is assigned automatically'; end if;
  if p_payload->>'enabled'='true' then
   if not exists(select 1 from staff_badges where id=p_payload->>'badge') then raise exception 'Choose an existing badge'; end if;
   insert into profile_badges(user_id,badge,source,granted_by) values(target,p_payload->>'badge','manual',me) on conflict(user_id,badge) do nothing;
  else
   delete from profile_badges where user_id=target and badge=p_payload->>'badge' and source='manual';
  end if;
  result:=jsonb_build_object('badges',app_sync_badges(target));
 elsif p_action='user/badges' then
  if target is null then raise exception 'Choose a user'; end if;
  delete from profile_badges
  where user_id=target and source='manual'
    and badge not in (select jsonb_array_elements_text(coalesce(p_payload->'badges','[]'::jsonb)));
  insert into profile_badges(user_id,badge,source,granted_by)
  select target, b.id, 'manual', me
  from staff_badges b
  where b.id in (select jsonb_array_elements_text(coalesce(p_payload->'badges','[]'::jsonb)))
    and b.id <> 'staff'
  on conflict(user_id,badge) do nothing;
  result:=jsonb_build_object('badges',app_sync_badges(target));
 elsif p_action='user/note' then
  if target is null then raise exception 'Choose a user'; end if;
  if nullif(trim(p_payload->>'body'),'') is null then raise exception 'Add a moderation note'; end if;
  if coalesce(p_payload->>'kind','note') not in ('note','ban','unban','ip-ban','device-ban') then raise exception 'Unknown note type'; end if;
  insert into user_moderation_notes(user_id,author,kind,body) values(target,me,coalesce(p_payload->>'kind','note'),left(trim(p_payload->>'body'),2000));
  result:='{}';
 elsif p_action='user/suspend' then
  if v_reason='' then raise exception 'A suspension reason is required'; end if;
  if p_payload->>'enabled'='true' then
   insert into user_suspensions(user_id,reason,suspended_by) values(target,v_reason,me) on conflict(user_id) do update set reason=excluded.reason,suspended_by=excluded.suspended_by,created_at=now();
   insert into user_moderation_notes(user_id,author,kind,body) values(target,me,'ban',v_reason);
  else
   delete from user_suspensions where user_id=target;
   insert into user_moderation_notes(user_id,author,kind,body) values(target,me,'unban',v_reason);
  end if;
  result:='{}';
 elsif p_action='servers/search' then
  q := left(trim(coalesce(p_payload->>'query','')),100);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into result
  from (
    select s.id,s.name,s.created_at,s.verified,s.partner,
           app_public_profile(s.owner) as owner,
           (select count(*) from members m where m.server_id=s.id) as members,
           exists(select 1 from server_suspensions z where z.server_id=s.id) as suspended
    from servers s
    where q='' or s.name ilike '%'||q||'%' or s.id::text ilike lower(q)||'%'
    order by s.created_at desc
    limit 100
  ) x;
 elsif p_action='server/get' then
  select jsonb_build_object('server',to_jsonb(s),'owner',app_public_profile(s.owner),'members',(select count(*) from members m where m.server_id=s.id),'channels',(select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'type',c.type)) from channels c where c.server_id=s.id),'suspension',(select to_jsonb(x) from server_suspensions x where x.server_id=s.id)) into result from servers s where s.id=sid;
 elsif p_action='server/flags' then
  update servers set verified=coalesce((p_payload->>'verified')::boolean,verified),partner=coalesce((p_payload->>'partner')::boolean,partner) where id=sid;
  perform app_sync_badges(s.owner) from servers s where s.id=sid;
  result:='{}';
 elsif p_action='server/suspend' then
  if v_reason='' then raise exception 'A suspension reason is required'; end if;
  if p_payload->>'enabled'='true' then insert into server_suspensions(server_id,reason,suspended_by) values(sid,v_reason,me) on conflict(server_id) do update set reason=excluded.reason,suspended_by=excluded.suspended_by,created_at=now(); else delete from server_suspensions where server_id=sid; end if; result:='{}';
 elsif p_action='reports' then
  select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('reporter_profile',app_public_profile(r.reporter),'target_profile',app_public_profile(r.target_user),'message',(select jsonb_build_object('id',m.id,'body',m.body,'channel_id',m.channel_id,'server_id',c.server_id) from messages m join channels c on c.id=m.channel_id where m.id=r.message_id)) order by r.created_at desc),'[]')
  into result from staff_reports r where (p_payload->>'status' is null or r.status=p_payload->>'status');
 elsif p_action='report/update' then
  update staff_reports set status=coalesce(p_payload->>'status',status),assignee=coalesce(nullif(p_payload->>'assignee','')::uuid,me),internal_notes=coalesce(p_payload->>'internal_notes',internal_notes),updated_at=now() where id=rid returning to_jsonb(staff_reports.*) into result; if not found then raise exception 'Report not found'; end if;
 elsif p_action='staff/list' then select coalesce(jsonb_agg(jsonb_build_object('user_id',s.user_id,'level',s.level,'added_by',s.added_by,'added_at',s.added_at,'profile',app_public_profile(s.user_id))),'[]') into result from platform_staff s;
 elsif p_action='staff/set' then
  if actor_level<>'admin' then raise exception 'Platform admin only'; end if;
  if p_payload->>'enabled'='true' then insert into platform_staff(user_id,level,added_by) values(target,coalesce(p_payload->>'level','staff'),me) on conflict(user_id) do update set level=excluded.level,added_by=me; else if target=me then raise exception 'You cannot remove yourself'; end if; delete from platform_staff where user_id=target; end if;
  perform app_sync_badges(target);
  result:='{}';
 elsif p_action='badges/list' then
  select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object(
    'requirements',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'config',r.config,'enabled',r.enabled) order by r.created_at) from badge_requirements r where r.badge=b.id),'[]'),
    'grants',(select count(*) from profile_badges pb where pb.badge=b.id)
  ) order by b.position,b.id),'[]') into result from staff_badges b;
 elsif p_action='badge/save' then
  if coalesce(p_payload->>'id','') !~ '^[a-z0-9_-]{2,40}$' or nullif(trim(p_payload->>'name'),'') is null then raise exception 'Badge name and ID are required'; end if;
  insert into staff_badges(id,name,icon_url,position,description,category)
  values(lower(trim(p_payload->>'id')),left(trim(p_payload->>'name'),60),left(coalesce(p_payload->>'icon_url',''),20000),coalesce((p_payload->>'position')::integer,0),left(coalesce(p_payload->>'description',''),500),left(coalesce(nullif(p_payload->>'category',''),'achievement'),24))
  on conflict(id) do update set name=excluded.name,icon_url=excluded.icon_url,position=excluded.position,description=excluded.description,category=excluded.category;
  result:='{}';
 elsif p_action='badge/requirements' then
  if not exists(select 1 from staff_badges where id=p_payload->>'badge') then raise exception 'Choose an existing badge'; end if;
  delete from badge_requirements where badge=p_payload->>'badge';
  insert into badge_requirements(badge,kind,config,enabled)
  select p_payload->>'badge', r->>'kind', coalesce(r->'config','{}'::jsonb), coalesce((r->>'enabled')::boolean,true)
  from jsonb_array_elements(coalesce(p_payload->'requirements','[]'::jsonb)) r
  where r->>'kind' in ('staff','account_age_days','created_before','server_count','owned_server_members','message_count','partner_owner','verified_owner','is_bot','hypesquad');
  if target is not null then perform app_sync_badges(target); end if;
  result:=jsonb_build_object('requirements',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'config',x.config,'enabled',x.enabled) order by x.created_at) from badge_requirements x where x.badge=p_payload->>'badge'),'[]'));
 elsif p_action='badge/sync' then
  if target is null then raise exception 'Choose a user'; end if;
  result:=jsonb_build_object('badges',app_sync_badges(target));
 elsif p_action='badge/delete' then
  if p_payload->>'id' in ('staff','verified','early-supporter') then raise exception 'Built-in badges cannot be deleted'; end if;
  delete from profile_badges where badge=p_payload->>'id'; delete from staff_badges where id=p_payload->>'id'; result:='{}';
 elsif p_action='audit' then select coalesce(jsonb_agg(to_jsonb(a) order by id desc),'[]') into result from (select * from staff_audit where (p_payload->>'query' is null or action ilike '%'||left(p_payload->>'query',100)||'%') order by id desc limit 100) a;
 else raise exception 'Unknown staff action'; end if;
 insert into staff_audit(actor,action,target_type,target_id,reason) values(me,p_action,split_part(p_action,'/',1),coalesce(target::text,sid::text,rid::text,''),v_reason);
 return coalesce(result,'{}'::jsonb);
end $$;

revoke all on function public.staff_action(text,jsonb) from public, anon;
grant execute on function public.staff_action(text,jsonb) to authenticated;

notify pgrst, 'reload schema';

-- Retire legacy manual Staff grants: platform staff are now evaluated by rule.
update public.profile_badges set source = 'auto'
where badge = 'staff'
  and user_id in (select user_id from public.platform_staff);
delete from public.profile_badges
where badge = 'staff'
  and not exists (select 1 from public.platform_staff s where s.user_id = profile_badges.user_id);

-- Expose badges and the HypeSquad choice in the session state so settings and
-- profile cards render them immediately after sign-in.
create or replace function public.app_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  state jsonb;
  me uuid := auth.uid();
begin
  state := public.app_state_before_staff_suspensions();
  return jsonb_set(
    state,
    '{user}',
    coalesce(state->'user', '{}'::jsonb) || jsonb_build_object(
      'is_platform_staff', public.is_platform_staff(),
      'is_platform_admin', public.is_platform_admin(),
      'is_bot', coalesce((select p.is_bot from public.profiles p where p.id = me), false),
      'hypesquad', (select p.hypesquad from public.profiles p where p.id = me),
      'badges', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', b.id, 'name', b.name, 'description', b.description,
          'icon_url', b.icon_url, 'category', b.category, 'source', pb.source
        ) order by b.position, b.id)
        from public.profile_badges pb
        join public.staff_badges b on b.id = pb.badge
        where pb.user_id = me
      ), '[]'::jsonb),
      'suspended_reason', (select s.reason from public.user_suspensions s where s.user_id = me)
    )
  );
end
$$;
