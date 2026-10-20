create table if not exists public.user_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check(char_length(file_name) between 1 and 180),
  content_type text not null,
  byte_size bigint not null check(byte_size between 1 and 5242880),
  created_at timestamptz not null default now()
);

alter table public.user_uploads enable row level security;
revoke all on public.user_uploads from anon, authenticated;

create policy "users can view own uploads" on public.user_uploads
  for select to authenticated using (user_id = auth.uid());

create or replace function public.app_upload_file(p_path text, p_name text, p_type text, p_size bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid := auth.uid(); result jsonb;
begin
  if v_user is null then raise exception 'Please sign in'; end if;
  if p_size > 5242880 then raise exception 'File size exceeds 5MB limit'; end if;
  
  insert into public.user_uploads(user_id, storage_path, file_name, content_type, byte_size)
  values (v_user, p_path, p_name, p_type, p_size)
  returning to_jsonb(user_uploads.*) into result;
  
  return result;
end $$;

revoke all on function public.app_upload_file(text, text, text, bigint) from public, anon;
grant execute on function public.app_upload_file(text, text, text, bigint) to authenticated;

-- Ensure the bucket exists and is private
insert into storage.buckets(id,name,public,file_size_limit) 
values('user-uploads','user-uploads',false,5242880) 
on conflict(id) do update set public=false, file_size_limit=5242880;

create policy "user uploads are private to owner" on storage.objects
  for all to authenticated
  using (bucket_id='user-uploads' and (storage.foldername(name))[1] = (select id::text from public.profiles where id=auth.uid()));
