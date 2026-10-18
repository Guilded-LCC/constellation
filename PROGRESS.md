# Constellation verification progress

## Phase 0b — desktop checkpoint
- status: PASS
- files changed: package.json, package-lock.json; the original desktop-checkpoint.mjs was superseded by scripts/verify-phase-a.mjs
- migrations applied: none
- screenshots: `C:/Users/Sailish/.codex/visualizations/2026/10/18/01a14e7f-d157-7640-9135-d43468236bbc/item0-1280.png`, `item0-900.png`, `item0-390.png`
- known gaps: standalone Playwright checkpoint passed with no horizontal overflow and no console errors.

## Phase A — server settings and roles
- status: BLOCKED / FAIL CHECKPOINT (not a pass)
- files changed: static/guilded.js, static/settings-ui.js, static/settings.css, static/index.html, scripts/serve.mjs, scripts/database.mjs, scripts/verify-phase-a.mjs, package.json, package-lock.json, supabase/functions/incoming-webhook/index.ts, supabase/config.toml
- migrations applied live: 20261018100000_settings.sql, 20261018101000_settings_security.sql, 20261018102000_webhooks_and_overview.sql, 20261018103000_settings_invariants.sql, 20261018104000_public_server_privacy.sql
- screenshots: `verification/phase-a-{existing,fresh}-{roles,overview,dropdown,chat}-{1280,900,390}.png`
- verified in standalone Chromium on both existing admin@guilded.info and a new account: role create/edit/delete, live draft name, gradients, role icon upload, save/discard, hard refresh, sign-out/sign-in; group create/edit/delete; emote upload/rename/delete; privacy/default notifications; server avatar/banner upload/remove; invite creation/revocation; webhook configuration and database token validation. Captured browser errors were empty in the last completed run. See verification/phase-a-report.json.
- security verified with authenticated requests: 19 checks passed. Non-member settings reads, non-member/non-manager role writes, direct role writes, direct webhook reads, role icon uploads, normal member server/group writes and webhook RPC reads were rejected. Invalid batches roll back. Removing Read/Send permissions blocks channel reads/posts. Expired invitations, private public-join attempts and revoked webhook tokens are rejected. Missing profile count remains zero.
- decisions: roles are saved with app_roles_save in one transaction; base role is Member; drafts remain in memory. Server groups have a name and description. Image uploads are center-cropped and re-encoded. Webhook secrets are stored hashed and only shown on creation. The app remains localhost, with Supabase holding all application data.
- blocker: incoming webhook Edge Function is prepared but not deployed. No Supabase management access token is configured. The supplied project secret was tested against the management API and returned HTTP 401 (JWT could not be decoded). The independent `npx supabase projects list --output json` check also reports `Access token not provided`. No available connector provides Supabase deployment access. Do not claim Phase A PASS or start Phase B until deployment and HTTP webhook verification pass. Deploy using an authenticated CLI and `npx supabase functions deploy incoming-webhook --project-ref hyongvpfhikiibgdlkgw --use-api --no-verify-jwt`.
- final completed run: 2026-10-18T12:31:14Z. Both accounts completed the implemented role/settings flows with empty consoles; 24 viewport measurements passed. Drag ordering, base-role protections, Bans/unban, atomic rollback and populated chats were verified. Actual recorded console arrays are empty. Group/emote CRUD was verified before the phase-wide refresh/sign-in cycle; separate create→refresh→edit→refresh→delete→refresh cycles for each subpage have not been run. Do not broaden the verification claim.
- checkpoint artifacts: `verification/REPORT.md`, `verification/phase-a-report.json`, 24 app screenshots, two console-capture images and 12 side-by-side comparison images. The report lists remaining visual differences; pixel-exact parity is not claimed. Console images render actual recorded events rather than the DevTools UI.
- cleanup: completed. Two disposable accounts, two test servers and 37 cloud objects were permanently removed through scoped cleanup. `verification/cleanup-report.json` confirms no fixture accounts/profiles/servers remain, and the existing account plus all pre-existing server/channel/role/message data were preserved. Missing profile count is zero. `verification/fixture.json` contains cleaned fixture metadata only and is ignored by Git. The verification script automatically creates a new set when the prior fixture is marked cleaned.
- resume: read this file and verification/REPORT.md. Connect Supabase management authentication; deploy and verify the actual webhook HTTP endpoint. Finish the remaining per-subpage persistence checks and visual differences before advancing to B. `npm run verify:settings` is the current standalone harness; it requires CONSTELLATION_ADMIN_KEY and CONSTELLATION_DATABASE_URL supplied securely via process environment. No secrets were added to source.

## Phases B–D
- status: NOT STARTED (Phase A checkpoint is blocking)
- migrations applied: none
- known gaps: chat attachments, profiles/badges/staff, remaining channel types are not implemented or verified. No platform-admin bootstrap SQL has been applied.

## Budget continuation — 2026-10-18
- TASK 1 permissions: PARTIAL — unified owner/admin/role evaluator and upload checks are authored; root cause is the attachment Storage insert policy relying on membership/send access and omitting `upload_media`; live DB regression uploads remain unrun because Supabase CLI DB queries hit a local Bun paging-file failure.
- SPEC: DONE — `SPEC.md` now carries the remaining Phase B–D scope and the focused verification budget.
- Phase A roles/webhooks: DONE — role list/default placeholders, popover color controls, dirty-state saving and visual rhythm were refined; `webhook-post` deployed with Supabase CLI.
- BLOCKED-EXTERNAL: existing-account magic links redirect to `http://localhost:3000`, the project Site URL, rather than localhost:8766; update Supabase Auth Site URL/redirect allow-list to finish that browser path.
- Phase B: PARTIAL — private `attachments` bucket, server-side access policies, attachment metadata/binding RPC, upload/drag/paste and durable inline previews/file chips are implemented.
- Phase C: PARTIAL — platform admins/badges and staff-panel assignment UI are implemented. Bootstrap applied: `insert into public.platform_admins(user_id) select p.id from public.profiles p join auth.users u on u.id=p.id where lower(u.email)='admin@guilded.info' on conflict (user_id) do nothing;`.
- Phase D: PARTIAL — LIST, DOCS, CALENDAR, FORUM and honest presence-only VOICE types are implemented with Supabase tables and checked RPCs.
- QA: created reusable `qa-owner@guilded.local` and `qa-member@guilded.local`; focused owner browser smoke passed at 1280/390 with empty post-login console; non-staff staff-RPC rejection returned 400.
- QA feature check: fixed an ambiguous channel-save identifier in migration `20261018114000_fix_channel_type_save.sql`; qa-owner created, edited and re-read a LIST item through the live Supabase RPC successfully.

## Final handoff
- Localhost remains healthy: HTTP 200 for settings-ui.js, Cache-Control no-store.
- npm run check and git diff --check passed (Git printed normal CRLF conversion warnings only).
- Verification, security results, cleanup and all screenshot/comparison links are collected in verification/REPORT.md.
- Source was formatted for readability. No application data or secret credentials were added to local files. Test artifacts and development dependencies are local as requested for verification.
- Task 2 platform admin/staff panel: PARTIAL — migration and standalone `/admin` UI authored; migration not applied or DB-negative tested because linked database access is unavailable here; localhost UI boundary and mocked layout smoke pass.
- Task 3 Guilded visual pass: PARTIAL — refreshed rail/sidebar/member/chat styling and admin page previews pass at 1280/390 with empty browser console; authenticated visual comparison remains blocked by unavailable live sign-in, and Threads/replies/right-side detail panels remain gaps.
- New session STEP 0: BLOCKED-EXTERNAL — no SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN; CLI can list the linked healthy project, but migration list and dry-run push both stall at “Initialising login role...” and were stopped; no migrations applied.
- Latest STEP 0: BLOCKED-EXTERNAL — .env is ignored and absent from Git history; Node/pg connection attempt timed out before select version() completed; no migrations or live tests run.
