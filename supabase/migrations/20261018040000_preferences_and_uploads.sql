-- Private display preferences and safe upload authorization.
create table if not exists public.ui_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data)='object')
);
alter table public.ui_preferences enable row level security;
revoke all on public.ui_preferences from public,anon,authenticated;

create or replace function public.app_ui_state(p_data jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_data jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if p_data is not null then
    if jsonb_typeof(p_data)<>'object' or pg_column_size(p_data)>8192 then raise exception 'Invalid preferences'; end if;
    if p_data ? 'collapsed' and jsonb_typeof(p_data->'collapsed')<>'array' then raise exception 'Invalid collapsed categories'; end if;
    insert into ui_preferences(user_id,data) values(auth.uid(),p_data)
    on conflict(user_id) do update set data=excluded.data;
  end if;
  select data into v_data from ui_preferences where user_id=auth.uid();
  return coalesce(v_data,'{}'::jsonb);
end $$;

create or replace function public.app_can_upload_role(p_role uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select app_has(r.server_id,'manage_roles') and
    (s.owner=auth.uid() or r.position < coalesce((select max(own.position)
      from member_roles mr join roles own on own.id=mr.role_id
      where mr.server_id=r.server_id and mr.user_id=auth.uid()),0))
    from roles r join servers s on s.id=r.server_id where r.id=p_role and r.position>0),false)
$$;

create or replace function public.app_can_upload_server(p_server uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select app_has(p_server,'manage_server')
$$;

drop policy if exists "members upload server images" on storage.objects;
create policy "members upload server images" on storage.objects for insert to authenticated
with check(bucket_id='community-media' and (storage.foldername(name))[1]='servers'
  and (storage.foldername(name))[3] in ('avatar','banner')
  and public.app_can_upload_server(((storage.foldername(name))[2])::uuid));

drop policy if exists "managers upload role icons" on storage.objects;
create policy "managers upload role icons" on storage.objects for insert to authenticated
with check(bucket_id='community-media' and (storage.foldername(name))[1]='roles'
  and public.app_can_upload_role(((storage.foldername(name))[2])::uuid));

create or replace function public.app_channel_move(p_channel uuid,p_direction text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_server uuid; v_category uuid; v_position integer; v_other uuid; v_other_position integer;
begin
  select server_id,category_id,position into v_server,v_category,v_position from channels where id=p_channel;
  if v_server is null or not app_has(v_server,'manage_channels') then raise exception 'Missing permission: manage_channels'; end if;
  if p_direction not in ('up','down') then raise exception 'Choose up or down'; end if;
  perform 1 from servers where id=v_server for update;
  if p_direction='up' then
    select id,position into v_other,v_other_position from channels where category_id=v_category and position<v_position order by position desc limit 1;
  else
    select id,position into v_other,v_other_position from channels where category_id=v_category and position>v_position order by position limit 1;
  end if;
  if v_other is null then raise exception 'Channel is already at the edge'; end if;
  update channels set position=case when id=p_channel then v_other_position else v_position end where id in(p_channel,v_other);
  insert into audit(server_id,actor,action) values(v_server,auth.uid(),'Reordered channel');
  return '{}'::jsonb;
end $$;

create or replace function public.app_category_place(p_source uuid,p_target uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_server uuid; v_source_position integer; v_target_position integer;
begin
  select server_id,position into v_server,v_source_position from categories where id=p_source;
  select position into v_target_position from categories where id=p_target and server_id=v_server;
  if v_server is null or v_target_position is null or not app_has(v_server,'manage_channels') then raise exception 'Cannot reorder categories'; end if;
  perform 1 from servers where id=v_server for update;
  update categories set position=case when id=p_source then v_target_position else v_source_position end where id in(p_source,p_target);
  insert into audit(server_id,actor,action) values(v_server,auth.uid(),'Reordered categories');
  return '{}'::jsonb;
end $$;

revoke execute on function public.app_ui_state(jsonb),public.app_can_upload_role(uuid),public.app_can_upload_server(uuid),public.app_channel_move(uuid,text),public.app_category_place(uuid,uuid) from public,anon;
grant execute on function public.app_ui_state(jsonb),public.app_can_upload_role(uuid),public.app_can_upload_server(uuid),public.app_channel_move(uuid,text),public.app_category_place(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
