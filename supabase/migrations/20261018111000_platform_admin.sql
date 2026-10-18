-- First platform administrator. Kept as an idempotent email-based bootstrap.
insert into public.platform_admins(user_id)
select p.id from public.profiles p join auth.users u on u.id=p.id
where lower(u.email)='admin@guilded.info'
on conflict (user_id) do nothing;
insert into public.profile_badges(user_id,badge)
select p.id,'staff' from public.profiles p join auth.users u on u.id=p.id
where lower(u.email)='admin@guilded.info'
on conflict (user_id,badge) do nothing;
