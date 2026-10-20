alter table public.user_uploads add column if not exists status text not null default 'pending';

create or replace function public.staff_list_uploads()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
  return coalesce(
    (select jsonb_agg(to_jsonb(u) || jsonb_build_object('user', public.app_public_profile(u.user_id))) 
     from public.user_uploads u 
     order by u.created_at desc), 
    '[]'::jsonb
  );
end $$;

create or replace function public.staff_approve_upload(p_upload_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid := p_upload_id;
begin
  if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
  
  update public.user_uploads set status = 'approved' where id = v_id;
  if not found then raise exception 'Upload not found'; end if;
  
  insert into public.staff_audit(actor, action, target_type, target_id, reason)
  values (auth.uid(), 'upload/approve', 'user_upload', v_id::text, 'Staff moderation');
  
  return jsonb_build_object('id', v_id, 'status', 'approved');
end $$;

revoke all on function public.staff_list_uploads() from public, anon;
grant execute on function public.staff_list_uploads() to authenticated;
revoke all on function public.staff_approve_upload(uuid) from public, anon;
grant execute on function public.staff_approve_upload(uuid) to authenticated;
