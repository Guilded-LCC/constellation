drop policy if exists "attachment uploads follow channel permission" on storage.objects;
create policy "attachment uploads follow channel permission" on storage.objects
for insert to authenticated
with check (
  bucket_id='attachments'
  and (storage.foldername(name))[1]='channels'
  and public.app_access(((storage.foldername(name))[2])::uuid,true)
  and exists (
    select 1 from public.channels c
    where c.id=((storage.foldername(name))[2])::uuid
      and public.has_server_permission(c.server_id,auth.uid(),'upload_media')
  )
);
