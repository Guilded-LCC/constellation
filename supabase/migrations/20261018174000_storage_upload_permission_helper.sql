create or replace function public.app_can_upload_to_channel(p_channel uuid)
returns boolean
language sql stable security definer set search_path=public as $$
  select public.app_access(p_channel,true)
    and exists (
      select 1 from public.channels c
      where c.id=p_channel
        and public.has_server_permission(c.server_id,auth.uid(),'upload_media')
    )
$$;

revoke all on function public.app_can_upload_to_channel(uuid) from public, anon;
grant execute on function public.app_can_upload_to_channel(uuid) to authenticated;

drop policy if exists "attachment uploads follow channel permission" on storage.objects;
create policy "attachment uploads follow channel permission" on storage.objects
for insert to authenticated
with check (
  bucket_id='attachments'
  and (storage.foldername(name))[1]='channels'
  and public.app_can_upload_to_channel(((storage.foldername(name))[2])::uuid)
);
