-- Finish invariants for both the original dashboard tables and fresh installs.
alter table public.profiles add constraint profiles_name_size check(char_length(name) between 1 and 40);
alter table public.servers add constraint servers_name_size check(char_length(name) between 1 and 80);
alter table public.servers add constraint servers_boost_range check(boost between 0 and 3);
alter table public.roles add constraint roles_color_format check(color ~ '^#[0-9a-fA-F]{6}$' and (color2='' or color2 ~ '^#[0-9a-fA-F]{6}$'));
alter table public.roles add constraint roles_permissions_array check(jsonb_typeof(permissions)='array');
alter table public.roles add constraint roles_name_size check(char_length(name) between 1 and 40);
alter table public.channels add constraint channels_name_size check(char_length(name) between 1 and 60);
alter table public.channels add constraint channels_allowed_array check(jsonb_typeof(allowed)='array');
alter table public.messages add constraint messages_distinct_participants check(recipient is null or sender<>recipient);
-- Expiring identity claims are checked by Supabase Auth. The application RPCs
-- use auth.uid() and never trust a user ID supplied by the browser.
notify pgrst,'reload schema';
