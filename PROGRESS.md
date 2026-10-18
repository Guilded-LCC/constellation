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
- webhook follow-up: DONE — deployed `webhook-post` through the Supabase HTTPS Management API; live delivery persisted to the channel, invalid tokens were rejected, and method/body limits passed.
- final completed run: 2026-10-18T12:31:14Z. Both accounts completed the implemented role/settings flows with empty consoles; 24 viewport measurements passed. Drag ordering, base-role protections, Bans/unban, atomic rollback and populated chats were verified. Actual recorded console arrays are empty. Group/emote CRUD was verified before the phase-wide refresh/sign-in cycle; separate create→refresh→edit→refresh→delete→refresh cycles for each subpage have not been run. Do not broaden the verification claim.
- checkpoint artifacts: `verification/REPORT.md`, `verification/phase-a-report.json`, 24 app screenshots, two console-capture images and 12 side-by-side comparison images. The report lists remaining visual differences; pixel-exact parity is not claimed. Console images render actual recorded events rather than the DevTools UI.
- cleanup: completed. Two disposable accounts, two test servers and 37 cloud objects were permanently removed through scoped cleanup. `verification/cleanup-report.json` confirms no fixture accounts/profiles/servers remain, and the existing account plus all pre-existing server/channel/role/message data were preserved. Missing profile count is zero. `verification/fixture.json` contains cleaned fixture metadata only and is ignored by Git. The verification script automatically creates a new set when the prior fixture is marked cleaned.
- resume: continue the unfinished end-to-end and visual-parity checks using the existing QA accounts and live HTTPS APIs. Do not infer full feature parity from the passing focused checks above.

## Phases B–D
- status: IN PROGRESS — attachments, staff tools and LIST/DOCS/CALENDAR/FORUM/presence-only VOICE are implemented; broader CRUD/sign-in and parity verification is still incomplete.
- migrations applied: live Supabase versions `20261018161829`, `20261018162322`, `20261018163001`, `20261018163222`, `20261018163259` are mirrored locally by their exact version names.
- known gaps: full Guilded parity is not claimed; the complete legacy regression runner was interrupted by a Windows Chromium resource error, so only focused live checks are reported as passing.

## Budget continuation — 2026-10-18
- TASK 1 permissions: DONE — live Storage policy now uses a SECURITY DEFINER channel helper; owner and Administrator uploads pass, Member upload_media-off is rejected, and enabling the permission allows upload.
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
- Task 2 platform admin/staff panel: PARTIAL — migration and standalone `/admin` UI authored; migration not applied or DB-negative tested because linked database access is unavailable here; localhost signed-out route passed, live dashboard remains unverified.
- Task 3 Guilded visual pass: PARTIAL — refreshed rail/sidebar/member/chat styling and admin page previews pass at 1280/390 with empty browser console; authenticated visual comparison remains blocked by unavailable live sign-in, and Threads/replies/right-side detail panels remain gaps.
- New session STEP 0: DONE — `access_key` used over HTTPS Management API; live migrations applied and verified without direct Postgres or Supabase CLI login.
- Latest STEP 0: DONE — `.env` remains ignored and uncommitted; database and function changes were applied through Supabase HTTPS APIs.
- STEP 1: PARTIAL — removed the simulated staff panel and fixed counters; dashboard reads staff_action('dashboard'), and missing responses show unavailable rather than fabricated zeros; real anonymous /admin route passed at 1280/390, but signed-in live counts were not exercised.
- E2E continuation: PARTIAL — focused live security tests pass for owner/Admin/member upload permissions, private replies, thread moderation and direct table denial; focused localhost browser tests pass for replies/threads at 1280/390 with empty console; the broader regression runner still hit a Windows Chromium resource failure.
- Live regression follow-up: DONE — `access_key` validated and used over HTTPS; staff RPC 42702 fixed by migration; real dashboard counts, user detail, 14-row internal scroll, member/owner staff-denial checks, live QA flows and attachment upload passed; admin/browser consoles empty.
- Durable message replies and threads: DONE — live Supabase migrations; private-reply permission is off by default, can be granted/revoked, and is enforced on the RPC; member privacy/thread-moderation/RLS checks pass; authenticated browser create/reply/thread/refresh passes with empty console at 1280/390 (`verification/live-message-relations-{1280,390}.png`).
