begin;
alter table public.roles add column if not exists gradient_angle integer not null default 90 check(gradient_angle between 0 and 360);
alter table public.roles add column if not exists color_start text generated always as (color) stored;
alter table public.roles add column if not exists color_end text generated always as (color2) stored;
update public.roles set name='Member' where position=0;
create or replace function public.normalize_base_role() returns trigger language plpgsql set search_path=public as $$
begin if new.position=0 then new.name:='Member'; end if; return new; end $$;
create trigger normalize_base_role before insert or update on public.roles for each row execute function public.normalize_base_role();
alter table public.servers add column if not exists visibility text not null default 'private' check(visibility in ('public','private'));
alter table public.servers add column if not exists invite_policy text not null default 'permission' check(invite_policy in ('permission','managers'));
alter table public.servers add column if not exists notification_level text not null default 'mentions' check(notification_level in ('all','mentions','none'));
alter table public.invites add column if not exists expires_at timestamptz;
create table public.server_groups(id uuid primary key default gen_random_uuid(),server_id uuid not null references public.servers on delete cascade,name text not null check(length(trim(name)) between 1 and 50),description text not null default '');
create table public.server_emotes(id uuid primary key default gen_random_uuid(),server_id uuid not null references public.servers on delete cascade,name text not null check(name ~ '^[a-zA-Z0-9_]{2,32}$'),image_url text not null,unique(server_id,name));
alter table public.server_groups enable row level security;
alter table public.server_emotes enable row level security;
revoke all on public.server_groups,public.server_emotes from public,anon,authenticated;

create or replace function public.app_roles_save(p_server uuid,p_roles jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r jsonb; old public.roles%rowtype; rid uuid; pos integer; seen uuid[]:='{}'; allowed text[]:=array['administrator','manage_server','manage_roles','create_invites','kick_members','ban_members','manage_groups','manage_emotes','manage_webhooks','view_audit','view_channels','send_messages','manage_messages','manage_channels','upload_media','mention_roles','join_voice','speak','manage_voice','create_topics','reply_topics','manage_topics','create_docs','manage_docs','create_events','manage_events','manage_lists']; perm text; highest integer; owner boolean;
begin
 if not public.app_has(p_server,'manage_roles') then raise exception 'You do not have permission to manage roles'; end if;
 if jsonb_typeof(p_roles)<>'array' or jsonb_array_length(p_roles)>100 then raise exception 'Invalid role list'; end if;
 perform 1 from servers where id=p_server for update;
 select s.owner=auth.uid() into owner from servers s where s.id=p_server;
 select coalesce(max(rr.position),0) into highest from roles rr join member_roles mr on mr.role_id=rr.id where mr.server_id=p_server and mr.user_id=auth.uid();
 if (select count(*) from jsonb_array_elements(p_roles) x where (x->>'position')::int=0)<>1 then raise exception 'The Member role must stay last'; end if;
 for r in select value from jsonb_array_elements(p_roles) loop
  rid:=(r->>'id')::uuid; pos:=(r->>'position')::int;
  if rid=any(seen) then raise exception 'Duplicate role'; end if; seen:=array_append(seen,rid);
  select * into old from roles where id=rid;
  if found and old.server_id<>p_server then raise exception 'Role belongs to another server'; end if;
  if found and old.position=0 and pos<>0 then raise exception 'The Member role must stay last'; end if;
  if not found and pos=0 then raise exception 'Cannot create another Member role'; end if;
  if not owner and (coalesce(old.position,0)>=highest or pos>=highest) then
   if old.id is not null and r @> jsonb_build_object('name',old.name,'color',old.color,'color2',old.color2,'position',old.position,'permissions',old.permissions,'emoji',old.emoji,'icon_url',old.icon_url,'self_assignable',old.self_assignable,'mentionable',old.mentionable,'hoist',old.hoist,'gradient_angle',old.gradient_angle) then continue; end if;
   raise exception 'You can only manage roles below your highest role';
  end if;
  if length(trim(r->>'name')) not between 1 and 40 then raise exception 'Role names must contain 1–40 characters'; end if;
  if coalesce(r->>'color','')!~'^#[0-9a-fA-F]{6}$' or (coalesce(r->>'color2','')<>'' and r->>'color2'!~'^#[0-9a-fA-F]{6}$') then raise exception 'Choose valid role colors'; end if;
  if jsonb_typeof(r->'permissions')<>'array' then raise exception 'Invalid permissions'; end if;
  for perm in select jsonb_array_elements_text(r->'permissions') loop
   if not perm=any(allowed) then raise exception 'Unknown permission'; end if;
   if not owner and not public.app_has(p_server,perm) then raise exception 'You cannot grant permissions you do not have'; end if;
  end loop;
  if coalesce(r->>'icon_url','')<>'' and r->>'icon_url' not like 'https://hyongvpfhikiibgdlkgw.supabase.co/storage/v1/object/public/community-media/roles/'||rid||'/%' and r->>'icon_url' not like 'https://hyongvpfhikiibgdlkgw.supabase.co/storage/v1/object/public/community-media/servers/'||p_server||'/role-icons/%' and r->>'icon_url' not like 'https://hyongvpfhikiibgdlkgw.supabase.co/storage/v1/object/public/community-media/servers/'||p_server||'/emotes/%' then raise exception 'Invalid role icon'; end if;
  insert into roles(id,server_id,name,color,color2,emoji,permissions,position,icon_url,self_assignable,mentionable,hoist,gradient_angle)
  values(rid,p_server,case when pos=0 then 'Member' else trim(r->>'name') end,r->>'color',coalesce(r->>'color2',''),left(coalesce(r->>'emoji',''),8),r->'permissions',pos,coalesce(r->>'icon_url',''),coalesce((r->>'self_assignable')::boolean,false),coalesce((r->>'mentionable')::boolean,false),coalesce((r->>'hoist')::boolean,false),coalesce((r->>'gradient_angle')::int,90))
  on conflict(id) do update set name=excluded.name,color=excluded.color,color2=excluded.color2,emoji=excluded.emoji,permissions=excluded.permissions,position=excluded.position,icon_url=excluded.icon_url,self_assignable=excluded.self_assignable,mentionable=excluded.mentionable,hoist=excluded.hoist,gradient_angle=excluded.gradient_angle;
 end loop;
 for old in select * from roles where server_id=p_server and not(id=any(seen)) loop
  if old.position=0 then raise exception 'Cannot delete the Member role'; end if;
  perform app_hierarchy(p_server,old.id);
  delete from roles where id=old.id;
 end loop;
 insert into audit(server_id,actor,action) values(p_server,auth.uid(),'Saved roles and permissions');
 return jsonb_build_object('saved',jsonb_array_length(p_roles));
end $$;

create or replace function public.app_settings(p_server uuid,p_action text default 'read',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare rid uuid:=nullif(p_data->>'id','')::uuid; code text; s servers%rowtype;
begin
 if not app_member(p_server) then raise exception 'You are not a member of this server'; end if;
 if p_action<>'read' then
  if not app_has(p_server,case when p_action like 'group/%' then 'manage_groups' when p_action like 'emote/%' then 'manage_emotes' when p_action like 'invite/%' then 'create_invites' else 'manage_server' end) then raise exception 'You do not have permission to change these settings'; end if;
  if p_action='server/save' then
   if length(trim(p_data->>'name')) not between 1 and 80 then raise exception 'Server name must contain 1–80 characters'; end if;
   if coalesce(p_data->>'avatar_url','')<>'' and p_data->>'avatar_url' not like 'https://hyongvpfhikiibgdlkgw.supabase.co/storage/v1/object/public/community-media/servers/'||p_server||'/avatar/%' then raise exception 'Invalid server avatar'; end if;
   if coalesce(p_data->>'banner_url','')<>'' and p_data->>'banner_url' not like 'https://hyongvpfhikiibgdlkgw.supabase.co/storage/v1/object/public/community-media/servers/'||p_server||'/banner/%' then raise exception 'Invalid server banner'; end if;
   update servers set name=trim(p_data->>'name'),description=left(coalesce(p_data->>'description',''),500),visibility=coalesce(p_data->>'visibility',visibility),invite_policy=coalesce(p_data->>'invite_policy',invite_policy),notification_level=coalesce(p_data->>'notification_level',notification_level),avatar_url=coalesce(p_data->>'avatar_url',avatar_url),banner_url=coalesce(p_data->>'banner_url',banner_url) where id=p_server;
  elsif p_action='group/save' then
   if rid is null then insert into server_groups(server_id,name,description) values(p_server,trim(p_data->>'name'),left(coalesce(p_data->>'description',''),300));
   else update server_groups set name=trim(p_data->>'name'),description=left(coalesce(p_data->>'description',''),300) where id=rid and server_id=p_server; end if;
  elsif p_action='group/delete' then delete from server_groups where id=rid and server_id=p_server;
  elsif p_action='emote/save' then
   if p_data->>'image_url' not like 'https://hyongvpfhikiibgdlkgw.supabase.co/storage/v1/object/public/community-media/servers/'||p_server||'/emotes/%' then raise exception 'Invalid emote image'; end if;
   insert into server_emotes(id,server_id,name,image_url) values(coalesce(rid,gen_random_uuid()),p_server,p_data->>'name',p_data->>'image_url') on conflict(id) do update set name=excluded.name where server_emotes.server_id=p_server;
  elsif p_action='emote/delete' then delete from server_emotes where id=rid and server_id=p_server;
  elsif p_action='invite/create' then
   select * into s from servers where id=p_server;
   if s.invite_policy='managers' and not app_has(p_server,'manage_server') then raise exception 'Only server managers may create invites'; end if;
   code:=encode(gen_random_bytes(8),'hex');
   insert into invites(code,server_id,expires_at) values(code,p_server,now()+make_interval(hours=>greatest(1,least(coalesce((p_data->>'hours')::int,168),8760))));
  elsif p_action='invite/revoke' then
   if not app_has(p_server,'manage_server') then raise exception 'Only server managers may revoke invites'; end if;
   delete from invites where server_id=p_server and invites.code=p_data->>'code';
  else raise exception 'Unknown settings operation'; end if;
  insert into audit(server_id,actor,action) values(p_server,auth.uid(),p_action);
 end if;
 return jsonb_build_object('server',(select to_jsonb(x) from servers x where id=p_server),'groups',coalesce((select jsonb_agg(g order by name) from server_groups g where server_id=p_server),'[]'::jsonb),'emotes',coalesce((select jsonb_agg(e order by name) from server_emotes e where server_id=p_server),'[]'::jsonb),'invites',case when app_has(p_server,'manage_server') then coalesce((select jsonb_agg(i order by created_at desc) from invites i where server_id=p_server),'[]'::jsonb) else '[]'::jsonb end,'code',code);
end $$;
-- Expired invitations are rejected even by the legacy join RPC.
create or replace function public.validate_member_invite() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid()=new.user_id and not exists(select 1 from servers where id=new.server_id and owner=auth.uid()) and not exists(select 1 from invites where server_id=new.server_id and (expires_at is null or expires_at>now())) then raise exception 'This invitation has expired'; end if;
 return new;
end $$;
create trigger validate_member_invite before insert on members for each row execute function validate_member_invite();
create policy "managers upload emotes" on storage.objects for insert to authenticated with check(bucket_id='community-media' and (storage.foldername(name))[1]='servers' and (storage.foldername(name))[3]='emotes' and public.app_has(((storage.foldername(name))[2])::uuid,'manage_emotes'));
create policy "managers upload draft role icons" on storage.objects for insert to authenticated with check(bucket_id='community-media' and (storage.foldername(name))[1]='servers' and (storage.foldername(name))[3]='role-icons' and public.app_has(((storage.foldername(name))[2])::uuid,'manage_roles'));
revoke execute on function public.app_roles_save(uuid,jsonb),public.app_settings(uuid,text,jsonb),public.normalize_base_role(),public.validate_member_invite() from public,anon;
grant execute on function public.app_roles_save(uuid,jsonb),public.app_settings(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
