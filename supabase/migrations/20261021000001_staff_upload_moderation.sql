create or replace function public.staff_list_uploads()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
  return (select jsonb_agg(to_jsonb(u) || jsonb_build_object('user', public.app_public_profile(u.user_id))) 
          from public.user_uploads u order by created_at desc);
end $$;

create or replace function public.staff_delete_upload(p_upload_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_path text; v_id uuid := p_upload_id;
begin
  if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
  
  select storage_path into v_path from public.user_uploads where id = v_id;
  if not found then raise exception 'Upload not found'; end if;
  
  delete from public.user_uploads where id = v_id;
  -- Note: Storage object deletion usually happens via API or a trigger, 
  -- but we remove the metadata record here.
  
  insert into public.staff_audit(actor, action, target_type, target_id, reason)
  values (auth.uid(), 'upload/delete', 'user_upload', v_id::text, 'Staff moderation');
  
  return jsonb_build_object('id', v_id, 'deleted', true);
end $$;

revoke all on function public.staff_list_uploads() from public, anon;
grant execute on function public.staff_list_uploads() to authenticated;
revoke all on function public.staff_delete_upload(uuid) from public, anon;
grant execute on function public.staff_delete_upload(uuid) to authenticated;
