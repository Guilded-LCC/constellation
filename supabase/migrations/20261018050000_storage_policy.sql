-- Supabase evaluates every applicable upload policy. Keep all role checks in
-- security-definer helpers because direct table/helper access is revoked.
create or replace function public.app_can_upload_server(p_server uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select app_has(p_server,'manage_server')
$$;

drop policy if exists "members upload server images" on storage.objects;
create policy "members upload server images" on storage.objects for insert to authenticated
with check(bucket_id='community-media' and (storage.foldername(name))[1]='servers'
  and (storage.foldername(name))[3] in ('avatar','banner')
  and public.app_can_upload_server(((storage.foldername(name))[2])::uuid));

revoke execute on function public.app_can_upload_server(uuid) from public,anon;
grant execute on function public.app_can_upload_server(uuid) to authenticated;
