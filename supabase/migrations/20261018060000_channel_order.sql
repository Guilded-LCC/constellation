create or replace function public.app_channel_place(p_source uuid,p_target uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_server uuid; v_category uuid; v_source_position integer; v_target_position integer;
begin
  select server_id,category_id,position into v_server,v_category,v_source_position from channels where id=p_source;
  select position into v_target_position from channels where id=p_target and server_id=v_server and category_id is not distinct from v_category;
  if v_server is null or v_target_position is null or not app_has(v_server,'manage_channels') then raise exception 'Cannot reorder channels'; end if;
  perform 1 from servers where id=v_server for update;
  update channels set position=case when id=p_source then v_target_position else v_source_position end where id in(p_source,p_target);
  insert into audit(server_id,actor,action) values(v_server,auth.uid(),'Reordered channels');
  return '{}'::jsonb;
end $$;
revoke execute on function public.app_channel_place(uuid,uuid) from public,anon;
grant execute on function public.app_channel_place(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
