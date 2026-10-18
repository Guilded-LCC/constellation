# Constellation — hosted community chat

Constellation is now a static web app backed by Supabase. It does not start a local server, create a SQLite database, or store chat data or UI preferences on the device. Authentication sessions are memory-only, so a browser refresh requires signing in again by design.

## Online configuration

The application is connected to the Supabase project `hyongvpfhikiibgdlkgw`.
The migrations in `supabase/migrations/` were applied in filename order on
2026-10-18, including the upgrade of the four dashboard-created tables.
Do not rerun an already-applied migration. Only the project URL and public
publishable key appear in `static/config.js`; database passwords and secret
keys are not part of this project or the deployed website.

Hosted website: https://constellation-guilded-chat.lingify-official.chatgpt.site

Create an account on the website, then create a server or use an invite code.
The current Supabase settings allow email/password signup with immediate
sign-in. Sessions remain in memory and are discarded on a full page reload.
Nothing on the PC needs to stay running for the deployed website to work.

The database schema locks down direct browser table access. The UI only calls three Supabase RPCs, which enforce membership and permission checks in the hosted database.

## What changed

- E-mail/password accounts now use Supabase Auth.
- Servers, membership, channels, roles, messages, reactions, invitations, moderation state, and profiles live in Supabase Postgres.
- The existing Discord-style server, channel, role, DM, message, reaction, pin, invite, and moderation flows remain in the interface.
- There is no local SQLite use, browser localStorage use, local API endpoint, local launcher, tunnel, or background process.

## Removing the old local data

The legacy `constellation.db` and `Constellation_Local_Chat.zip` were archived
to the private Supabase Storage bucket `legacy-local-archive`, with byte-for-byte
verification. This preserves the old username account and server for reference;
the new hosted app uses Supabase Auth accounts. Automatic approval review
blocked deleting the local originals. They and `__pycache__` are unused and
excluded from source publication. The source files in this directory are
development files, not a running service or growing chat database.

Browsers still download the website code and may keep ordinary browser data.
The app requests no persistent auth storage, creates no local chat database,
and sends all application data to Supabase.

## Security note

The project URL and publishable key are intentionally public browser values. They are safe to include in `static/config.js`; row-level security and the RPC boundary protect the data. Never add the Supabase `service_role` secret to a browser file or source-control.
