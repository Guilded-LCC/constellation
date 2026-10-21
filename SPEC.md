# Remaining product scope

## Phase B — chat attachments
- Store chat files in a Supabase Storage `attachments` bucket. Reading is limited to members who can read the channel; uploads require the same server-side permission as posting messages.
- Composer attach button, drag and drop, clipboard paste, upload progress, human-friendly size failures, inline image previews and file chips.
- Attachments are attached to messages and persist after refresh/sign-in.

## Phase C — profiles, badges, platform staff
- Editable member profile with avatar, bio, status and durable badges.
- Add a Supabase-backed platform-staff model and staff panel for staff-only moderation/visibility. Bootstrap `admin@constellation.example` as the first platform admin with explicit SQL.
- All reads must be null-safe and all errors human readable.

## Phase D — channel types
- Lists: title, optional note, done, assignee and reorder; Supabase persistence and realtime updates.
- Docs: document list, create/edit/delete and autosave with markdown or rich-text editing.
- Calendar: month view and persisted events with title, time, description and RSVP.
- Forum: topics/replies, author/count/activity, create/reply, moderator pin and lock.
- Voice: Supabase Realtime presence for join/leave, participant tiles and mute/deafen. Label presence-only honestly unless reliable WebRTC audio is implemented.

## Verification budget
- Reuse qa-owner and qa-member; create/edit/refresh plus one database-level negative RLS/RPC test per new table or RPC.
- Capture only touched pages at 1280px and 390px; use one role-page comparison.
