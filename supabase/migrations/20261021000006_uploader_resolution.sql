-- Attachments uploaded before uploader tracking existed, or written without a
-- message, can still be attributed from the stored object's owner. Resolve the
-- uploader at read time so the staff queue never shows a blank uploader, and
-- describe an unresolved uploader as null instead of an object of nulls.

update public.message_attachments a
set uploaded_by = m.sender
from public.messages m
where a.message_id = m.id
  and a.uploaded_by is null
  and m.sender is not null;

update public.message_attachments a
set uploaded_by = o.owner_id::uuid
from storage.objects o
where o.bucket_id = 'attachments'
  and o.name = a.storage_path
  and a.uploaded_by is null
  and o.owner_id is not null
  and o.owner_id ~ '^[0-9a-fA-F-]{36}$';

create or replace function public.staff_list_uploads()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_staff() then raise exception 'Not authorized'; end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'message_id', a.message_id,
        'file_name', a.file_name,
        'byte_size', a.byte_size,
        'content_type', a.content_type,
        'status', a.status,
        'created_at', a.created_at,
        'storage_path', a.storage_path,
        'user', case when p.id is null then null else jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'username', p.username,
          'avatar_url', p.avatar_url) end
      ) order by a.created_at desc)
    from public.message_attachments a
    left join public.messages m on m.id = a.message_id
    left join storage.objects o
      on o.bucket_id = 'attachments' and o.name = a.storage_path
    left join public.profiles p
      on p.id = coalesce(a.uploaded_by, m.sender, o.owner_id::uuid)
  ), '[]'::jsonb);
end $$;

revoke all on function public.staff_list_uploads() from public, anon;
grant execute on function public.staff_list_uploads() to authenticated;

notify pgrst, 'reload schema';
