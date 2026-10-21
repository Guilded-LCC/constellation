create or replace function public.staff_list_uploads()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'file_name', a.file_name,
        'byte_size', a.byte_size,
        'content_type', a.content_type,
        'status', a.status,
        'created_at', a.created_at,
        'user', jsonb_build_object(
          'id', p.id,
          'name', to_jsonb(p)->'name',
          'username', to_jsonb(p)->'username')
      ) order by a.created_at desc)
    from public.message_attachments a
    left join public.messages m on m.id = a.message_id
    left join public.profiles p on p.id = coalesce(a.uploaded_by, m.sender)
  ), '[]'::jsonb);
end $$;

create or replace function public.staff_approve_upload(p_upload_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
  update public.message_attachments set status = 'approved' where id = p_upload_id;
  if not found then raise exception 'Attachment not found'; end if;
  insert into public.staff_audit(actor, action, target_type, target_id, reason)
  values (auth.uid(), 'upload/approve', 'attachment', p_upload_id::text, 'Staff moderation');
  return jsonb_build_object('id', p_upload_id, 'status', 'approved');
end $$;

create or replace function public.staff_delete_upload(p_upload_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
  delete from public.message_attachments where id = p_upload_id;
  if not found then raise exception 'Attachment not found'; end if;
  insert into public.staff_audit(actor, action, target_type, target_id, reason)
  values (auth.uid(), 'upload/delete', 'attachment', p_upload_id::text, 'Staff moderation');
  return jsonb_build_object('id', p_upload_id, 'deleted', true);
end $$;
