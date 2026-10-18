-- Upgrade the four tables created in the dashboard, preserving existing rows.
do $$ begin
 if to_regclass('public.profiles') is not null then
  alter table public.profiles add column if not exists name text;
  alter table public.profiles add column if not exists bio text not null default '';
  alter table public.profiles add column if not exists avatar text not null default '✨';
  alter table public.profiles add column if not exists status text not null default 'online';
  alter table public.profiles add column if not exists created_at timestamptz not null default now();
  update public.profiles set name=coalesce(name,username,'Member');
  alter table public.profiles alter column name set not null;
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='servers' and column_name='owner_id') then
  alter table public.servers rename column owner_id to owner;
 end if;
 if to_regclass('public.servers') is not null then
  alter table public.servers add column if not exists description text not null default '';
  alter table public.servers add column if not exists icon text not null default '🌌';
  alter table public.servers add column if not exists rules text not null default '';
  alter table public.servers add column if not exists boost integer not null default 0;
  alter table public.servers add column if not exists created_at timestamptz not null default now();
 end if;
 if to_regclass('public.channels') is not null then
  alter table public.channels add column if not exists topic text not null default '';
  alter table public.channels add column if not exists category text not null default 'TEXT CHANNELS';
  alter table public.channels add column if not exists allowed jsonb not null default '[]';
  alter table public.channels add column if not exists readonly boolean not null default false;
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='profile_id') then
  alter table public.messages rename column profile_id to sender;
  alter table public.messages rename column content to body;
 end if;
 if to_regclass('public.messages') is not null then
  alter table public.messages alter column channel_id drop not null;
  alter table public.messages add column if not exists recipient uuid references public.profiles(id);
  alter table public.messages add column if not exists edited boolean not null default false;
  alter table public.messages add column if not exists pinned boolean not null default false;
 end if;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
