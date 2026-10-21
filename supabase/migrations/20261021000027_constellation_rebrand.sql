-- Rebrand existing data: every Guilded-era identifier becomes a Constellation one.
-- Fresh databases already seed the Constellation names, so the updates below are
-- no-ops there. Existing databases need this to keep badge icons, the official
-- account and the QA fixtures matching the application code.
--
-- Real sign-in addresses are deliberately left alone: changing them silently
-- would lock people out of accounts they already use. The opt-in block at the
-- bottom renames them when an operator decides to.

begin;

-- staff_badges ids are referenced by two foreign keys. Drop them while the ids
-- change, then restore them unchanged.
alter table public.badge_requirements drop constraint if exists badge_requirements_badge_fkey;
alter table public.server_badges drop constraint if exists server_badges_badge_fkey;

update public.profile_badges
   set badge = replace(badge, 'guilded-', 'constellation-')
 where badge like 'guilded-%';

update public.badge_requirements
   set badge = replace(badge, 'guilded-', 'constellation-')
 where badge like 'guilded-%';

update public.server_badges
   set badge = replace(badge, 'guilded-', 'constellation-')
 where badge like 'guilded-%';

update public.staff_badges
   set id = replace(id, 'guilded-', 'constellation-')
 where id like 'guilded-%';

alter table public.badge_requirements
  add constraint badge_requirements_badge_fkey
  foreign key (badge) references public.staff_badges(id) on delete cascade;

alter table public.server_badges
  add constraint server_badges_badge_fkey
  foreign key (badge) references public.staff_badges(id) on delete cascade;

update public.staff_badges
   set description = replace(description, 'Guilded', 'Constellation')
 where description like '%Guilded%';

-- The official account keeps its user id and stays read-only.
update public.profiles
   set username = replace(username, 'guilded', 'constellation'),
       name = replace(name, 'Guilded', 'Constellation'),
       bio = replace(bio, 'Guilded', 'Constellation')
 where is_official
   and (username ilike '%guilded%' or name ilike '%guilded%' or bio like '%Guilded%');

-- Disposable test fixtures created by the live regression suites.
update auth.users
   set email = replace(replace(email, 'guilded-test-', 'constellation-test-'), '@guilded.local', '@constellation.local')
 where email like '%@guilded.local' and email not like 'qa-%@guilded.local';

update auth.users
   set email = replace(email, '@guilded.local', '@constellation.local')
 where email in ('qa-owner@guilded.local', 'qa-member@guilded.local');

update auth.identities
   set provider_id = replace(provider_id, '@guilded.local', '@constellation.local'),
       identity_data = jsonb_set(
         identity_data,
         '{email}',
         to_jsonb(replace(identity_data->>'email', '@guilded.local', '@constellation.local')),
         true
       )
 where provider_id like 'qa-%@guilded.local';

update auth.identities
   set provider_id = replace(replace(provider_id, 'guilded-test-', 'constellation-test-'), '@guilded.local', '@constellation.local'),
       identity_data = jsonb_set(
         identity_data,
         '{email}',
         to_jsonb(replace(replace(identity_data->>'email', 'guilded-test-', 'constellation-test-'), '@guilded.local', '@constellation.local')),
         true
       )
 where provider_id like 'guilded-test-%@guilded.local';

commit;

-- Opt in by running the block below in the SQL editor. It changes live sign-in
-- addresses: the platform admin and any other personal accounts keep their
-- password, but the address used to sign in becomes the new one.
--
-- begin;
-- update auth.users set email = 'admin@constellation.example' where email = 'admin@guilded.info';
-- update auth.identities
--    set provider_id = 'admin@constellation.example',
--        identity_data = jsonb_set(identity_data, '{email}', '"admin@constellation.example"', true)
--  where provider_id = 'admin@guilded.info';
-- commit;
