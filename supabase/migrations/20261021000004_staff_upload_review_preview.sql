-- Staff upload review: expose status/storage path to staff, let staff preview and
-- clean up stored files, hide pending attachments from other members, and align
-- the chat attachment limit with the 5 MB bucket limit.

update storage.buckets set file_size_limit = 5242880 where id = 'attachments';

-- New attachments record their uploader even before the message is sent.
create or replace function public.message_attachment_uploader()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.uploaded_by is null then new.uploaded_by := auth.uid(); end if;
  return new;
end $$;

drop trigger if exists message_attachment_uploader on public.message_attachments;
create trigger message_attachment_uploader before insert on public.message_attachments
for each row execute function public.message_attachment_uploader();

-- Backfill the uploader for attachments created before the trigger existed.
update public.message_attachments a
set uploaded_by = m.sender
from public.messages m
where a.message_id = m.id and a.uploaded_by is null;

-- Message payloads carry review state so clients can gate pending files.
create or replace function public.app_messages_before_unified_permissions(p_channel uuid default null, p_user uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare payload jsonb; begin
 payload:=app_messages_before_features(p_channel,p_user);
 return coalesce((select jsonb_agg(m||jsonb_build_object('attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name,'type',a.content_type,'size',a.byte_size,'path',a.storage_path,'status',a.status,'uploaded_by',a.uploaded_by)) from message_attachments a where a.message_id=(m->>'id')::uuid),'[]'::jsonb)) order by ord) from jsonb_array_elements(payload) with ordinality x(m,ord)),'[]'::jsonb);
end $$;

-- Staff queue exposes the storage path needed for previews and file removal.
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
        'storage_path', a.storage_path,
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
declare v_path text;
begin
  if not public.is_platform_staff() then raise exception 'Not authorized'; end if;

  delete from public.message_attachments where id = p_upload_id returning storage_path into v_path;
  if not found then raise exception 'Attachment not found'; end if;

  insert into public.staff_audit(actor, action, target_type, target_id, reason)
  values (auth.uid(), 'upload/delete', 'attachment', p_upload_id::text, 'Staff moderation');

  return jsonb_build_object('id', p_upload_id, 'storage_path', v_path, 'deleted', true);
end $$;

revoke all on function public.staff_list_uploads() from public, anon;
grant execute on function public.staff_list_uploads() to authenticated;
revoke all on function public.staff_approve_upload(uuid) from public, anon;
grant execute on function public.staff_approve_upload(uuid) to authenticated;
revoke all on function public.staff_delete_upload(uuid) from public, anon;
grant execute on function public.staff_delete_upload(uuid) to authenticated;

-- Members can read approved files and their own pending files; storage policies
-- run as the caller, so the attachment lookup is wrapped in a definer helper.
create or replace function public.attachment_is_viewable(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.message_attachments a
    where a.storage_path = p_path
      and (a.status <> 'pending' or a.uploaded_by = auth.uid())
  )
$$;

revoke all on function public.attachment_is_viewable(text) from public, anon;
grant execute on function public.attachment_is_viewable(text) to authenticated;

drop policy if exists "attachment reads follow channel access" on storage.objects;
create policy "attachment reads follow channel access" on storage.objects
  for select to authenticated using (
    bucket_id = 'attachments'
    and (
      public.is_platform_staff()
      or (
        public.app_access(((storage.foldername(name))[2])::uuid)
        and public.attachment_is_viewable(storage.objects.name)
      )
    )
  );

drop policy if exists "platform staff delete attachments" on storage.objects;
create policy "platform staff delete attachments" on storage.objects
  for delete to authenticated using (
    bucket_id = 'attachments' and public.is_platform_staff()
  );

notify pgrst, 'reload schema';
