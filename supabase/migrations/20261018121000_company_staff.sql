-- Company staff are separate from server roles.
create table if not exists public.platform_staff(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 level text not null default 'staff' check(level in ('staff','admin')),
 added_by uuid references public.profiles(id) on delete set null,
 added_at timestamptz not null default now());
insert into public.platform_staff(user_id,level)
select user_id,'admin' from public.platform_admins on conflict(user_id) do update set level='admin';
insert into public.platform_staff(user_id,level)
select p.id,'admin' from public.profiles p join auth.users u on u.id=p.id where lower(u.email)='admin@guilded.info'
on conflict(user_id) do update set level='admin';
-- Keep the legacy, RLS-locked table in place for dependency safety. The
-- compatibility function below now reads platform_staff, so it is inert.

create table if not exists public.staff_badges(id text primary key,name text not null,icon_url text not null default '',position integer not null default 0);
insert into public.staff_badges(id,name,position) values('staff','Staff',0),('verified','Verified',1),('early-supporter','Early supporter',2) on conflict(id) do nothing;
alter table public.profile_badges drop constraint if exists profile_badges_badge_check;
create table if not exists public.user_suspensions(user_id uuid primary key references public.profiles(id) on delete cascade,reason text not null check(char_length(trim(reason)) between 1 and 1000),suspended_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create table if not exists public.server_suspensions(server_id uuid primary key references public.servers(id) on delete cascade,reason text not null check(char_length(trim(reason)) between 1 and 1000),suspended_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
alter table public.servers add column if not exists verified boolean not null default false;
alter table public.servers add column if not exists partner boolean not null default false;
create table if not exists public.staff_reports(id uuid primary key default gen_random_uuid(),reporter uuid not null references public.profiles(id),target_user uuid references public.profiles(id),server_id uuid references public.servers(id),message_id uuid references public.messages(id) on delete set null,reason text not null check(char_length(trim(reason)) between 1 and 2000),status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),assignee uuid references public.platform_staff(user_id),internal_notes text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(target_user is not null or server_id is not null or message_id is not null));
create table if not exists public.staff_audit(id bigint generated always as identity primary key,actor uuid not null references public.profiles(id),action text not null,target_type text not null,target_id text not null default '',reason text not null default '',created_at timestamptz not null default now());
alter table public.platform_staff enable row level security; alter table public.staff_badges enable row level security; alter table public.user_suspensions enable row level security; alter table public.server_suspensions enable row level security; alter table public.staff_reports enable row level security; alter table public.staff_audit enable row level security;
revoke all on public.platform_staff,public.staff_badges,public.user_suspensions,public.server_suspensions,public.staff_reports,public.staff_audit from anon,authenticated;

create or replace function public.is_platform_staff() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from platform_staff where user_id=auth.uid())$$;
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from platform_staff where user_id=auth.uid() and level='admin')$$;
revoke all on function public.is_platform_staff(),public.is_platform_admin() from public,anon;
grant execute on function public.is_platform_staff(),public.is_platform_admin() to authenticated;
create or replace function public.app_is_platform_admin(p_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from platform_staff where user_id=p_user and level='admin')$$;
revoke all on function public.app_is_platform_admin(uuid) from public,anon;
grant execute on function public.app_is_platform_admin(uuid) to authenticated;

-- Suspended accounts and servers have no channel capabilities, including Storage.
create or replace function public.has_server_permission(p_server uuid,p_user uuid,p_permission text) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare v_owner uuid;
begin
 if p_server is null or p_user is null or p_permission is null then return false; end if;
 if exists(select 1 from user_suspensions where user_id=p_user) or exists(select 1 from server_suspensions where server_id=p_server) then return false; end if;
 select owner into v_owner from servers where id=p_server;
 if not found then return false; end if;
 if v_owner=p_user then return true; end if;
 if not exists(select 1 from members where server_id=p_server and user_id=p_user) then return false; end if;
 if exists(select 1 from roles r where r.server_id=p_server and r.permissions ? 'administrator'
   and (r.position=0 or exists(select 1 from member_roles mr where mr.server_id=p_server and mr.user_id=p_user and mr.role_id=r.id))) then return true; end if;
 return exists(select 1 from roles r where r.server_id=p_server
   and (r.position=0 or exists(select 1 from member_roles mr where mr.server_id=p_server and mr.user_id=p_user and mr.role_id=r.id))
   and r.permissions ? p_permission);
end $$;
revoke all on function public.has_server_permission(uuid,uuid,text) from public,anon;
grant execute on function public.has_server_permission(uuid,uuid,text) to authenticated;

create or replace function public.sync_staff_badge() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then delete from profile_badges where user_id=old.user_id and badge='staff'; return old; end if;
 insert into profile_badges(user_id,badge) values(new.user_id,'staff') on conflict do nothing; return new;
end $$;
drop trigger if exists platform_staff_badge on public.platform_staff;
create trigger platform_staff_badge after insert or update of level or delete on public.platform_staff for each row execute function public.sync_staff_badge();
insert into public.profile_badges(user_id,badge) select user_id,'staff' from public.platform_staff on conflict do nothing;

create or replace function public.staff_action(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); target uuid:=nullif(p_payload->>'user_id','')::uuid; sid uuid:=nullif(p_payload->>'server_id','')::uuid; rid uuid:=nullif(p_payload->>'report_id','')::uuid; result jsonb; reason text:=left(trim(coalesce(p_payload->>'reason','')),1000); actor_level text;
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
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'name',p.name,'email',u.email,'created_at',u.created_at,'suspended',exists(select 1 from user_suspensions z where z.user_id=p.id))),'[]') into result from profiles p join auth.users u on u.id=p.id where p.username ilike '%'||left(p_payload->>'query',100)||'%' or p.name ilike '%'||left(p_payload->>'query',100)||'%' or u.email ilike '%'||left(p_payload->>'query',100)||'%' limit 50;
 elsif p_action='user/get' then
  select jsonb_build_object('profile',app_public_profile(target),'email',u.email,'created_at',u.created_at,'badges',coalesce((select jsonb_agg(badge) from profile_badges where user_id=target),'[]'),'servers',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'created_at',s.created_at)) from servers s join members m on m.server_id=s.id where m.user_id=target),'[]'),'suspension',(select to_jsonb(x) from user_suspensions x where x.user_id=target),'reports',(select count(*) from staff_reports where target_user=target),'is_staff',exists(select 1 from platform_staff where user_id=target),'staff_level',(select level from platform_staff where user_id=target)) into result from auth.users u where u.id=target;
 elsif p_action='user/badge' then
  if p_payload->>'enabled'='true' then
   if p_payload->>'badge'='staff' then raise exception 'The Staff badge is assigned automatically'; end if;
   if not exists(select 1 from staff_badges where id=p_payload->>'badge') then raise exception 'Choose an existing badge'; end if;
   insert into profile_badges(user_id,badge) values(target,p_payload->>'badge') on conflict do nothing;
  else if p_payload->>'badge'='staff' then raise exception 'The Staff badge is assigned automatically'; end if; delete from profile_badges where user_id=target and badge=p_payload->>'badge'; end if;
  result:='{}';
 elsif p_action='user/suspend' then
  if reason='' then raise exception 'A suspension reason is required'; end if;
  if p_payload->>'enabled'='true' then insert into user_suspensions(user_id,reason,suspended_by) values(target,reason,me) on conflict(user_id) do update set reason=excluded.reason,suspended_by=excluded.suspended_by,created_at=now(); else delete from user_suspensions where user_id=target; end if; result:='{}';
 elsif p_action='servers/search' then
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'owner',app_public_profile(s.owner),'members',(select count(*) from members m where m.server_id=s.id),'created_at',s.created_at,'verified',s.verified,'partner',s.partner,'suspended',exists(select 1 from server_suspensions z where z.server_id=s.id))),'[]') into result from servers s where s.name ilike '%'||left(p_payload->>'query',100)||'%' limit 50;
 elsif p_action='server/get' then
  select jsonb_build_object('server',to_jsonb(s),'owner',app_public_profile(s.owner),'members',(select count(*) from members m where m.server_id=s.id),'channels',(select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'type',c.type)) from channels c where c.server_id=s.id),'suspension',(select to_jsonb(x) from server_suspensions x where x.server_id=s.id)) into result from servers s where s.id=sid;
 elsif p_action='server/flags' then
  update servers set verified=coalesce((p_payload->>'verified')::boolean,verified),partner=coalesce((p_payload->>'partner')::boolean,partner) where id=sid; result:='{}';
 elsif p_action='server/suspend' then
  if reason='' then raise exception 'A suspension reason is required'; end if;
  if p_payload->>'enabled'='true' then insert into server_suspensions(server_id,reason,suspended_by) values(sid,reason,me) on conflict(server_id) do update set reason=excluded.reason,suspended_by=excluded.suspended_by,created_at=now(); else delete from server_suspensions where server_id=sid; end if; result:='{}';
 elsif p_action='reports' then
  select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('reporter_profile',app_public_profile(r.reporter),'target_profile',app_public_profile(r.target_user),'message',(select jsonb_build_object('id',m.id,'body',m.body,'channel_id',m.channel_id,'server_id',c.server_id) from messages m join channels c on c.id=m.channel_id where m.id=r.message_id)) order by r.created_at desc),'[]')
  into result from staff_reports r where (p_payload->>'status' is null or r.status=p_payload->>'status');
 elsif p_action='report/update' then
  update staff_reports set status=coalesce(p_payload->>'status',status),assignee=coalesce(nullif(p_payload->>'assignee','')::uuid,me),internal_notes=coalesce(p_payload->>'internal_notes',internal_notes),updated_at=now() where id=rid returning to_jsonb(staff_reports.*) into result; if not found then raise exception 'Report not found'; end if;
 elsif p_action='staff/list' then select coalesce(jsonb_agg(jsonb_build_object('user_id',s.user_id,'level',s.level,'added_by',s.added_by,'added_at',s.added_at,'profile',app_public_profile(s.user_id))),'[]') into result from platform_staff s;
 elsif p_action='staff/set' then
  if actor_level<>'admin' then raise exception 'Platform admin only'; end if;
  if p_payload->>'enabled'='true' then insert into platform_staff(user_id,level,added_by) values(target,coalesce(p_payload->>'level','staff'),me) on conflict(user_id) do update set level=excluded.level,added_by=me; else if target=me then raise exception 'You cannot remove yourself'; end if; delete from platform_staff where user_id=target; end if; result:='{}';
 elsif p_action='badges/list' then select coalesce(jsonb_agg(to_jsonb(b) order by position,id),'[]') into result from staff_badges b;
 elsif p_action='badge/save' then
  if coalesce(p_payload->>'id','') !~ '^[a-z0-9_-]{2,40}$' or nullif(trim(p_payload->>'name'),'') is null then raise exception 'Badge name and ID are required'; end if;
  insert into staff_badges(id,name,icon_url,position) values(lower(trim(p_payload->>'id')),left(trim(p_payload->>'name'),60),left(coalesce(p_payload->>'icon_url',''),500),coalesce((p_payload->>'position')::integer,0)) on conflict(id) do update set name=excluded.name,icon_url=excluded.icon_url,position=excluded.position;
  result:='{}';
 elsif p_action='badge/delete' then
  if p_payload->>'id' in ('staff','verified','early-supporter') then raise exception 'Built-in badges cannot be deleted'; end if;
  delete from profile_badges where badge=p_payload->>'id'; delete from staff_badges where id=p_payload->>'id'; result:='{}';
 elsif p_action='audit' then select coalesce(jsonb_agg(to_jsonb(a) order by id desc),'[]') into result from (select * from staff_audit where (p_payload->>'query' is null or action ilike '%'||left(p_payload->>'query',100)||'%') order by id desc limit 100) a;
 else raise exception 'Unknown staff action'; end if;
 insert into staff_audit(actor,action,target_type,target_id,reason) values(me,p_action,split_part(p_action,'/',1),coalesce(target::text,sid::text,rid::text,''),reason);
 return coalesce(result,'{}'::jsonb);
end $$;
revoke all on function public.staff_action(text,jsonb) from public,anon;
grant execute on function public.staff_action(text,jsonb) to authenticated;

alter function public.app_api(text,jsonb) rename to app_api_before_staff_suspensions;
create or replace function public.app_api(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from user_suspensions where user_id=auth.uid()) and (p_action='server/create' or p_action='message/send') then raise exception 'Your account is suspended'; end if;
 return app_api_before_staff_suspensions(p_action,p_payload);
end $$;
revoke all on function public.app_api(text,jsonb) from public,anon;
grant execute on function public.app_api(text,jsonb) to authenticated;

alter function public.app_state() rename to app_state_before_staff_suspensions;
create or replace function public.app_state() returns jsonb language plpgsql security definer set search_path=public as $$
declare state jsonb; me uuid:=auth.uid(); begin
 state:=app_state_before_staff_suspensions();
 return jsonb_set(state,'{user}',coalesce(state->'user','{}')||jsonb_build_object('is_platform_staff',is_platform_staff(),'is_platform_admin',is_platform_admin(),'suspended_reason',(select reason from user_suspensions where user_id=me)));
end $$;
revoke all on function public.app_state() from public,anon;
grant execute on function public.app_state() to authenticated;

-- Route the older badge RPC through the audited staff API; no unaudited bypass.
alter function public.app_feature_api(text,jsonb) rename to app_feature_api_before_company_staff;
create or replace function public.app_feature_api(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if p_action='staff/badge' then
  return public.staff_action('user/badge',jsonb_build_object('user_id',p_payload->>'user','badge',p_payload->>'badge','enabled',true));
 end if;
 return public.app_feature_api_before_company_staff(p_action,p_payload);
end $$;
revoke all on function public.app_feature_api(text,jsonb) from public,anon;
grant execute on function public.app_feature_api(text,jsonb) to authenticated;
notify pgrst,'reload schema';
