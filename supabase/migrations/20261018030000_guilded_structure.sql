-- Guilded-style organization and appearance. Apply once after the earlier migrations.
alter table public.servers add column if not exists avatar_url text not null default '';
alter table public.servers add column if not exists banner_url text not null default '';
alter table public.roles add column if not exists icon_url text not null default '';
alter table public.roles add column if not exists self_assignable boolean not null default false;
alter table public.roles add column if not exists mentionable boolean not null default false;
alter table public.roles add column if not exists hoist boolean not null default false;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  position integer not null default 0,
  allowed jsonb not null default '[]'::jsonb check (jsonb_typeof(allowed) = 'array'),
  unique (server_id,name)
);
alter table public.categories enable row level security;
revoke all on public.categories from public, anon, authenticated;

alter table public.channels add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.channels add column if not exists position integer not null default 0;
insert into public.categories(server_id,name,position)
select server_id,category,dense_rank() over(partition by server_id order by category) - 1
from (select distinct server_id,category from public.channels) c
on conflict(server_id,name) do nothing;
update public.channels c set category_id=k.id from public.categories k
where k.server_id=c.server_id and k.name=c.category and c.category_id is null;
with ordered as (select id,row_number() over(partition by category_id order by name,id)-1 pos from public.channels)
update public.channels c set position=o.pos from ordered o where c.id=o.id;
create index if not exists categories_server_position on public.categories(server_id,position);
create index if not exists channels_category_position on public.channels(category_id,position);

create or replace function public.attach_channel_category() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.category_id is null or (tg_op='UPDATE' and new.category is distinct from old.category
      and not exists(select 1 from categories where id=new.category_id and server_id=new.server_id and name=new.category)) then
    insert into categories(server_id,name,position)
    values(new.server_id,coalesce(nullif(trim(new.category),''),'Channels'),
      coalesce((select max(position)+1 from categories where server_id=new.server_id),0))
    on conflict(server_id,name) do nothing;
    select id into new.category_id from categories where server_id=new.server_id and name=coalesce(nullif(trim(new.category),''),'Channels');
  end if;
  if tg_op='INSERT' then
    select coalesce(max(position)+1,0) into new.position from channels where category_id=new.category_id;
  end if;
  return new;
end $$;
drop trigger if exists channel_category_link on public.channels;
create trigger channel_category_link before insert or update of category,category_id on public.channels
for each row execute function public.attach_channel_category();

create or replace function public.app_access(p_channel uuid,p_send boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select app_has(c.server_id,'view_channels')
    and (case when jsonb_array_length(c.allowed)>0 then c.allowed
              else coalesce(k.allowed,'[]'::jsonb) end = '[]'::jsonb
      or app_permissions(c.server_id) ? 'administrator'
      or exists(select 1 from member_roles mr where mr.server_id=c.server_id
        and mr.user_id=auth.uid() and
        (case when jsonb_array_length(c.allowed)>0 then c.allowed else coalesce(k.allowed,'[]'::jsonb) end) ? mr.role_id::text))
    and (not p_send or (app_has(c.server_id,'send_messages')
      and (not c.readonly or app_has(c.server_id,'manage_messages'))))
    from channels c left join categories k on k.id=c.category_id where c.id=p_channel),false)
$$;

create or replace function public.app_state() returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_state jsonb; v_servers jsonb:='[]'::jsonb; v_server jsonb; v_id uuid; v_enriched jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  v_state:=constellation_private.app_state();
  for v_server in select value from jsonb_array_elements(v_state->'servers') loop
    v_id:=(v_server->>'id')::uuid;
    v_enriched:=v_server || coalesce((select jsonb_build_object('avatar_url',s.avatar_url,'banner_url',s.banner_url)
      from servers s where s.id=v_id),'{}'::jsonb);
    v_enriched:=jsonb_set(v_enriched,'{roles}',coalesce((select jsonb_agg(
      to_jsonb(r) - 'server_id' || jsonb_build_object('server_id',r.server_id)
      order by r.position desc) from roles r where r.server_id=v_id),'[]'::jsonb));
    v_enriched:=jsonb_set(v_enriched,'{categories}',coalesce((select jsonb_agg(
      jsonb_build_object('id',k.id,'name',k.name,'position',k.position,'allowed',k.allowed)
      order by k.position,k.name) from categories k where k.server_id=v_id
      and (k.allowed='[]'::jsonb or app_permissions(v_id) ? 'administrator'
        or exists(select 1 from member_roles mr where mr.server_id=v_id and mr.user_id=auth.uid() and k.allowed ? mr.role_id::text))),'[]'::jsonb));
    v_enriched:=jsonb_set(v_enriched,'{channels}',coalesce((select jsonb_agg(
      jsonb_build_object('id',c.id,'server_id',c.server_id,'name',c.name,'topic',c.topic,
        'category',c.category,'category_id',c.category_id,'position',c.position,'type',c.type,
        'allowed',c.allowed,'readonly',c.readonly)
      order by k.position,c.position,c.name) from channels c
      left join categories k on k.id=c.category_id
      where c.server_id=v_id and app_access(c.id)),'[]'::jsonb));
    v_servers:=v_servers||jsonb_build_array(v_enriched);
  end loop;
  return jsonb_set(v_state,'{servers}',v_servers);
end $$;

create or replace function public.app_category_api(p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_me uuid:=auth.uid(); v_server uuid:=nullif(p_payload->>'server','')::uuid;
v_id uuid:=nullif(p_payload->>'id','')::uuid; v_category uuid:=nullif(p_payload->>'category','')::uuid;
v_name text:=trim(p_payload->>'name'); v_allowed jsonb:=coalesce(p_payload->'allowed','[]'::jsonb);
v_position integer; v_other uuid; v_other_position integer; v_item jsonb;
begin
  if v_me is null then raise exception 'Please sign in'; end if;
  if p_action not in ('save','delete','move','channel/move') then raise exception 'Unknown operation'; end if;
  if not app_has(v_server,'manage_channels') then raise exception 'Missing permission: manage_channels'; end if;
  if p_action='save' then
    if char_length(v_name) not between 1 and 50 then raise exception 'Category name must be 1–50 characters'; end if;
    if jsonb_typeof(v_allowed)<>'array' then raise exception 'Invalid category roles'; end if;
    for v_item in select value from jsonb_array_elements(v_allowed) loop
      if jsonb_typeof(v_item)<>'string' or not exists(select 1 from roles where server_id=v_server and id::text=v_item#>>'{}') then
        raise exception 'Invalid category role'; end if;
    end loop;
    perform 1 from servers where id=v_server for update;
    if v_id is null then
      select coalesce(max(position)+1,0) into v_position from categories where server_id=v_server;
      insert into categories(server_id,name,position,allowed) values(v_server,v_name,v_position,v_allowed) returning id into v_id;
      insert into audit(server_id,actor,action) values(v_server,v_me,'Created category '||v_name);
    else
      update categories set name=v_name,allowed=v_allowed where id=v_id and server_id=v_server;
      if not found then raise exception 'Category not found'; end if;
      update channels set category=v_name where category_id=v_id;
      insert into audit(server_id,actor,action) values(v_server,v_me,'Updated category '||v_name);
    end if;
    return jsonb_build_object('id',v_id);
  end if;
  if p_action='delete' then
    delete from categories where id=v_id and server_id=v_server;
    if not found then raise exception 'Category not found'; end if;
    insert into audit(server_id,actor,action) values(v_server,v_me,'Deleted category');
    return '{}'::jsonb;
  end if;
  if p_action='move' then
    perform 1 from servers where id=v_server for update;
    select position into v_position from categories where id=v_id and server_id=v_server;
    if not found then raise exception 'Category not found'; end if;
    if p_payload->>'direction'='up' then
      select id,position into v_other,v_other_position from categories where server_id=v_server and position<v_position order by position desc limit 1;
    elsif p_payload->>'direction'='down' then
      select id,position into v_other,v_other_position from categories where server_id=v_server and position>v_position order by position limit 1;
    else raise exception 'Choose up or down'; end if;
    if v_other is null then raise exception 'Category is already at the edge'; end if;
    update categories set position=case when id=v_id then v_other_position else v_position end where id in(v_id,v_other);
    insert into audit(server_id,actor,action) values(v_server,v_me,'Reordered categories');
    return '{}'::jsonb;
  end if;
  if p_action='channel/move' then
    if not exists(select 1 from channels where id=v_id and server_id=v_server) then raise exception 'Channel not found'; end if;
    if not exists(select 1 from categories where id=v_category and server_id=v_server) then raise exception 'Category not found'; end if;
    select coalesce(max(position)+1,0) into v_position from channels where category_id=v_category;
    update channels set category_id=v_category,category=(select name from categories where id=v_category),position=v_position where id=v_id;
    insert into audit(server_id,actor,action) values(v_server,v_me,'Moved channel');
    return '{}'::jsonb;
  end if;
  raise exception 'Unknown operation';
end $$;

create or replace function public.app_role_meta(p_role uuid,p_settings jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_server uuid; v_icon text:=coalesce(p_settings->>'icon_url','');
begin
  select server_id into v_server from roles where id=p_role and position>0;
  if v_server is null or not app_has(v_server,'manage_roles') then raise exception 'Missing permission: manage_roles'; end if;
  perform app_hierarchy(v_server,p_role);
  if v_icon<>'' and v_icon not like 'https://hyongvpfhikiibgdlkgw.supabase.co/storage/v1/object/public/community-media/roles/'||p_role::text||'/%' then raise exception 'Invalid role image'; end if;
  update roles set icon_url=v_icon,self_assignable=coalesce((p_settings->>'self_assignable')::boolean,false),
    mentionable=coalesce((p_settings->>'mentionable')::boolean,false),
    hoist=coalesce((p_settings->>'hoist')::boolean,false) where id=p_role;
  insert into audit(server_id,actor,action) values(v_server,auth.uid(),'Updated role settings');
  return '{}'::jsonb;
end $$;

create or replace function public.app_role_self(p_role uuid,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_server uuid;
begin
  select server_id into v_server from roles where id=p_role and self_assignable;
  if v_server is null or not app_member(v_server) then raise exception 'Role is not self-assignable'; end if;
  if p_enabled then insert into member_roles(server_id,user_id,role_id) values(v_server,auth.uid(),p_role) on conflict do nothing;
  else delete from member_roles where server_id=v_server and user_id=auth.uid() and role_id=p_role; end if;
  insert into audit(server_id,actor,action) values(v_server,auth.uid(),'Changed self-assigned role');
  return '{}'::jsonb;
end $$;

create or replace function public.app_server_media(p_server uuid,p_kind text,p_url text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not app_has(p_server,'manage_server') then raise exception 'Missing permission: manage_server'; end if;
  if p_kind not in ('avatar','banner') then raise exception 'Invalid image kind'; end if;
  if p_url<>'' and p_url not like 'https://hyongvpfhikiibgdlkgw.supabase.co/storage/v1/object/public/community-media/servers/'||p_server::text||'/'||p_kind||'/%' then raise exception 'Invalid image URL'; end if;
  if p_kind='avatar' then update servers set avatar_url=p_url where id=p_server;
  else update servers set banner_url=p_url where id=p_server; end if;
  insert into audit(server_id,actor,action) values(p_server,auth.uid(),'Updated server '||p_kind);
  return '{}'::jsonb;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('community-media','community-media',true,26214400,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict(id) do nothing;
create policy "members upload server images" on storage.objects for insert to authenticated
with check(bucket_id='community-media' and (storage.foldername(name))[1]='servers'
  and (storage.foldername(name))[3] in ('avatar','banner')
  and public.app_has(((storage.foldername(name))[2])::uuid,'manage_server'));
create policy "managers upload role icons" on storage.objects for insert to authenticated
with check(bucket_id='community-media' and (storage.foldername(name))[1]='roles'
  and exists(select 1 from public.roles r where r.id::text=(storage.foldername(name))[2]
    and public.app_has(r.server_id,'manage_roles')));
create policy "read community images" on storage.objects for select to public
using(bucket_id='community-media');

revoke execute on function public.attach_channel_category() from public,anon,authenticated;
revoke execute on function public.app_category_api(text,jsonb),public.app_role_meta(uuid,jsonb),public.app_role_self(uuid,boolean),public.app_server_media(uuid,text,text) from public,anon;
grant execute on function public.app_category_api(text,jsonb),public.app_role_meta(uuid,jsonb),public.app_role_self(uuid,boolean),public.app_server_media(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
