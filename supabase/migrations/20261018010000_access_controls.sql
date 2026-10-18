-- Central authorization boundary for the hosted app. Internal functions cannot
-- be invoked through the Data API, even by a signed-in user.
create schema if not exists constellation_private;
revoke all on schema constellation_private from public, anon, authenticated;
alter function public.app_api(text,jsonb) set schema constellation_private;
alter function public.app_state() set schema constellation_private;
alter function public.app_messages(uuid,uuid) set schema constellation_private;

create or replace function public.app_access(p_channel uuid, p_send boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select app_has(c.server_id,'view_channels')
   and (jsonb_array_length(c.allowed)=0 or app_permissions(c.server_id) ? 'administrator'
     or exists(select 1 from member_roles mr where mr.server_id=c.server_id and mr.user_id=auth.uid() and c.allowed ? mr.role_id::text))
   and (not p_send or (app_has(c.server_id,'send_messages') and (not c.readonly or app_has(c.server_id,'manage_messages'))))
   from channels c where c.id=p_channel),false)
$$;

create or replace function public.app_hierarchy(p_server uuid,p_role uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_position integer; v_highest integer;
begin
 select position into v_position from roles where id=p_role and server_id=p_server;
 if not found then raise exception 'Role not found'; end if;
 if exists(select 1 from servers where id=p_server and owner=auth.uid()) then return; end if;
 select coalesce(max(r.position),0) into v_highest from roles r join member_roles mr on mr.role_id=r.id where mr.server_id=p_server and mr.user_id=auth.uid();
 if v_position >= v_highest then raise exception 'You can only manage roles below your highest role'; end if;
end $$;

create or replace function public.app_messages(p_channel uuid default null,p_user uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Please sign in'; end if;
 if p_channel is not null and not app_access(p_channel) then raise exception 'Cannot view this channel'; end if;
 return constellation_private.app_messages(p_channel,p_user);
end $$;

create or replace function public.app_state()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_state jsonb; v_servers jsonb := '[]'; v_server jsonb;
begin
 if auth.uid() is null then raise exception 'Please sign in'; end if;
 v_state := constellation_private.app_state();
 for v_server in select value from jsonb_array_elements(v_state->'servers') loop
  v_server := jsonb_set(v_server,'{channels}',coalesce((select jsonb_agg(c) from jsonb_array_elements(v_server->'channels') c where app_access((c->>'id')::uuid)),'[]'));
  v_servers := v_servers || jsonb_build_array(v_server);
 end loop;
 return jsonb_set(v_state,'{servers}',v_servers);
end $$;

create or replace function public.app_api(p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
 v_me uuid:=auth.uid(); v_server uuid:=nullif(p_payload->>'server','')::uuid;
 v_id uuid:=nullif(p_payload->>'id','')::uuid; v_user uuid:=nullif(p_payload->>'user','')::uuid;
 v_role uuid:=nullif(p_payload->>'role','')::uuid; v_channel uuid:=nullif(p_payload->>'channel','')::uuid;
 v_other roles%rowtype; v_current roles%rowtype; v_result jsonb; v_item jsonb; v_permission text;
 v_message messages%rowtype; v_owner boolean; v_rid uuid;
begin
 if v_me is null then raise exception 'Please sign in'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Expected an object'; end if;
 if p_action not in ('profile','server/create','server/join','server/invite','server/update','server/leave','server/transfer','server/delete','dm/open','message/send','message/react','message/edit','message/delete','message/pin','role/save','role/delete','role/move','channel/save','channel/delete','member/role','member/moderate') then raise exception 'Unknown operation'; end if;
 if p_action in ('profile','server/create','server/update','channel/save','role/save') then
  v_permission:=case when p_action='profile' then 'name' when p_action like 'server/%' then 'name' else 'name' end;
  if coalesce(char_length(trim(p_payload->>v_permission)),0)=0 then raise exception 'Name is required'; end if;
 end if;
 if p_action='profile' then
  if coalesce(p_payload->>'status','online') not in ('online','idle','dnd','invisible') then raise exception 'Invalid status'; end if;
  if coalesce(char_length(trim(p_payload->>'avatar')),0)=0 then raise exception 'Avatar is required'; end if;
 end if;
 if p_action in ('message/send','message/edit') and (coalesce(char_length(trim(p_payload->>'body')),0) not between 1 and 4000) then raise exception 'Message must contain 1–4000 characters'; end if;
 if p_action='message/send' and v_channel is not null and not app_access(v_channel,true) then raise exception 'You cannot send in this channel'; end if;
 if p_action in ('message/react','message/edit','message/delete','message/pin') then
  select * into v_message from messages where id=v_id;
  if not found then raise exception 'Message not found'; end if;
  if v_message.channel_id is not null and not app_access(v_message.channel_id) then raise exception 'Cannot view this channel'; end if;
  if p_action='message/react' and coalesce(p_payload->>'emoji','') not in ('💜','👍','✨','😂','🎉','👀') then raise exception 'Invalid reaction'; end if;
 end if;
 if (p_action like 'role/%' or p_action like 'channel/%' or p_action like 'member/%') then
  if v_server is null or not app_member(v_server) then raise exception 'You are not a member of this server'; end if;
  v_owner:=exists(select 1 from servers where id=v_server and owner=v_me);
 end if;
 if p_action like 'role/%' or p_action='member/role' then
  if not app_has(v_server,'manage_roles') then raise exception 'Missing permission: manage_roles'; end if;
  v_rid:=case when p_action='member/role' then v_role else v_id end;
  if v_rid is not null then perform app_hierarchy(v_server,v_rid); end if;
 end if;
 if p_action='role/save' then
  if jsonb_typeof(p_payload->'permissions') is distinct from 'array' then raise exception 'Invalid permissions'; end if;
  for v_item in select value from jsonb_array_elements(p_payload->'permissions') loop
   if jsonb_typeof(v_item)<>'string' then raise exception 'Invalid permission'; end if;
   v_permission:=v_item#>>'{}';
   if v_permission not in ('view_channels','send_messages','manage_messages','manage_channels','manage_roles','manage_server','kick_members','ban_members','create_invites','administrator') then raise exception 'Invalid permission'; end if;
   if not app_has(v_server,v_permission) then raise exception 'You cannot grant permissions you do not have'; end if;
  end loop;
  if coalesce(p_payload->>'color','') !~ '^#[0-9a-fA-F]{6}$' or (coalesce(p_payload->>'color2','')<>'' and p_payload->>'color2' !~ '^#[0-9a-fA-F]{6}$') then raise exception 'Invalid color'; end if;
  if (select boost from servers where id=v_server)<2 then
   select * into v_current from roles where id=v_id and server_id=v_server;
   if coalesce(p_payload->>'color2','')<>coalesce(v_current.color2,'') or coalesce(p_payload->>'emoji','')<>coalesce(v_current.emoji,'') then raise exception 'Role gradients and emoji require boost level 2'; end if;
  end if;
 end if;
 if p_action='role/move' then
  if p_payload->>'direction' not in ('up','down') then raise exception 'Choose up or down'; end if;
  perform 1 from servers where id=v_server for update;
  select * into v_current from roles where id=v_id and server_id=v_server and position>0;
  if not found then raise exception 'Role not found'; end if;
  if p_payload->>'direction'='up' then select * into v_other from roles where server_id=v_server and position>v_current.position order by position limit 1;
  else select * into v_other from roles where server_id=v_server and position<v_current.position and position>0 order by position desc limit 1; end if;
  if not found then raise exception 'Role is already at the edge'; end if;
  perform app_hierarchy(v_server,v_other.id);
  update roles set position=case when id=v_id then v_other.position else v_current.position end where id in (v_id,v_other.id);
  insert into audit(server_id,actor,action) values(v_server,v_me,'Reordered role '||v_current.name);
  return '{}';
 end if;
 if p_action='channel/save' then
  if jsonb_typeof(p_payload->'allowed') is distinct from 'array' then raise exception 'Invalid channel roles'; end if;
  for v_item in select value from jsonb_array_elements(p_payload->'allowed') loop
   if not exists(select 1 from roles where server_id=v_server and id::text=v_item#>>'{}') then raise exception 'Invalid channel role'; end if;
  end loop;
 end if;
 if p_action like 'channel/%' and v_id is not null and not exists(select 1 from channels where id=v_id and server_id=v_server) then raise exception 'Channel not found'; end if;
 if p_action='member/role' then
  if not exists(select 1 from roles where id=v_role and server_id=v_server and position>0) then raise exception 'Invalid role'; end if;
  if not app_member(v_server,v_user) then raise exception 'Member not found'; end if;
 end if;
 if p_action='member/moderate' and p_payload->>'action'<>'unban' then
  if not app_member(v_server,v_user) then raise exception 'Member not found'; end if;
  for v_rid in select role_id from member_roles where server_id=v_server and user_id=v_user loop perform app_hierarchy(v_server,v_rid); end loop;
 end if;
 if p_action='server/transfer' and not app_member(v_server,v_user) then raise exception 'Member not found'; end if;
 -- The internal API also checks permissions for every operation.
 v_result:=constellation_private.app_api(p_action,p_payload);
 if v_server is not null and p_action not like 'message/%' and p_action<>'server/delete' and exists(select 1 from servers where id=v_server) then
  insert into audit(server_id,actor,action) values(v_server,v_me,p_action);
 end if;
 return v_result;
end $$;

-- Fix the extension lookup of random invite generation inside the internal API.
alter function constellation_private.app_api(text,jsonb) set search_path=public,extensions;

create index if not exists messages_channel_created on public.messages(channel_id,created_at desc);
create index if not exists messages_dm_created on public.messages(sender,recipient,created_at desc) where channel_id is null;
create index if not exists members_user on public.members(user_id);
create index if not exists member_roles_user on public.member_roles(server_id,user_id);
create index if not exists channels_server on public.channels(server_id);
alter table public.messages add constraint messages_destination check ((channel_id is null) <> (recipient is null));
alter table public.messages add constraint messages_body_size check(char_length(body) between 1 and 4000);
alter table public.profiles add constraint profiles_status check(status in ('online','idle','dnd','invisible'));

-- Never expose helper functions that accept an arbitrary user ID.
revoke execute on all functions in schema constellation_private from public, anon, authenticated;
revoke execute on function public.app_permissions(uuid,uuid),public.app_member(uuid,uuid),public.app_has(uuid,text,uuid),public.app_public_profile(uuid),public.app_access(uuid,boolean),public.app_hierarchy(uuid,uuid),public.new_profile(),public.handle_new_user() from public,anon,authenticated;
revoke execute on function public.app_state(),public.app_messages(uuid,uuid),public.app_api(text,jsonb) from public,anon;
grant execute on function public.app_state(),public.app_messages(uuid,uuid),public.app_api(text,jsonb) to authenticated;
notify pgrst,'reload schema';
