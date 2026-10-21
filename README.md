# Constellation

Run `npm start` here, then open **http://localhost:8766**. The interface binds
only to `127.0.0.1`. It serves static files and does not write chat data, a
database, or logs to this computer. A local process must run while the site is
open. No npm packages are needed to run it.

Accounts, profiles, servers, categories, channels, messages, DMs, roles,
reactions, invites, moderation, audit entries, display preferences, and uploaded
server/role images use the Supabase project `hyongvpfhikiibgdlkgw`. Supabase auth
owns the browser session so hard refreshes remain signed in. The app does not write
application data to localStorage, sessionStorage, or IndexedDB. Browser-managed form autofill and
ordinary browser caches are controlled by the browser, although the local
server sends `Cache-Control: no-store`.

The project URL and publishable key are in `static/config.js`. The service
secret and database password are not in source or browser files. Migrations in
`supabase/migrations/` were applied through
`20261018104000_public_server_privacy.sql` on 2026-10-18. Do not reapply a completed
migration. Supabase access is through authenticated functions; direct table
access is revoked from browser roles.

## Current interface

The Guilded-inspired UI has a server rail, banner header, collapsible and
reorderable categories, channel sidebar, chat, grouped member list, server
settings, role colors and icons, private category and channel access, and an
audit log with date, action, and member filters. Server avatars and banners and
role icons upload to Supabase Storage. Images are center-cropped in browser
memory before upload. Server and role images have public URLs so that everyone
who has the URL can load them.

Text chat, DMs, reactions, edits, pins, roles, invites, kicks/bans, quick
switching, and responsive layouts are wired to the hosted database. This is not
yet complete Guilded feature parity: voice/video, forums, docs, calendars,
list channels, uploads in chat, badges, a platform staff panel, bots,
applications, and subscriptions are not implemented.

Server settings now use an in-memory draft with a full-screen overlay, role
gradients and icons, and one transaction for all pending role changes. Groups,
custom emotes, public/private visibility, default notification level, expiring
invites and bans have hosted storage and permission checks. Public servers can
be found and joined through the Join a server dialog. Private server joins
require a valid invitation. Announcements on the server home come from actual
messages in readable announcement channels.

Incoming webhook configuration and scoped, hashed-token database validation
are implemented. The Edge Function source is in
`supabase/functions/incoming-webhook/index.ts`, but its deployment is blocked:
no Supabase management access token is configured, and the project data/admin
key is rejected by the management API with HTTP 401. The Webhooks page states
that posting through the endpoint is unavailable. Deploy it using an
authenticated Supabase CLI with Edge Functions write access:

```
npx supabase functions deploy incoming-webhook --project-ref hyongvpfhikiibgdlkgw --use-api --no-verify-jwt
```

`verify_jwt=false` is intentional for incoming webhook callers. A random
256-bit scoped token is required, and the database checks the creator's
current channel permissions and applies a per-hook rate limit.

See `PROGRESS.md` and `verification/REPORT.md` for exact verification coverage,
remaining differences, screenshots and the current phase gate. Test tools are
development dependencies and are not needed by the static server.

## Legacy local data

The prior `constellation.db` and `Constellation_Local_Chat.zip` were uploaded
byte-for-byte to the private Supabase Storage bucket `legacy-local-archive`
before their local originals were deleted. The database's old account is a
legacy record; create a new Supabase Auth account in the current app. The old
SQLite journal files were also deleted.

Automatic approval review still blocks recursive removal of the unused
`__pycache__` and temporary setup/package folders. These are not read or
written by the running app. The earlier private hosted snapshot is unchanged;
the current requested interface remains on localhost only.
