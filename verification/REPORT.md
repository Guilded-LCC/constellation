# Verification report — 2026-10-18

## Phase status

| Phase | Result | Reason |
|---|---|---|
| A: settings and roles | FAIL / BLOCKED | Browser and database checks below passed, but the incoming webhook Edge Function cannot be deployed with the available credentials. Visual parity is close, not pixel exact. |
| B: chat attachments | NOT RUN | Phase A is a blocking gate. The composer picker exists; file uploading is not implemented. |
| C: profiles, badges, platform staff | NOT RUN | Phase A gate. No platform-staff table or admin bootstrap has been installed. |
| D: list, docs, calendar, forum, voice | NOT RUN | Phase A gate. No audio or presence implementation is claimed. |

## Evidence

Standalone Playwright Chromium used actual Supabase sign-in links for the existing account and one new account created after the migrations. No password was changed. A second disposable guest was used for access and ban checks.

The recorded run is in [phase-a-report.json](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-report.json). It contains 24 viewport measurements, 19 successful security checks and two empty console captures (`output: []`, `pageErrors: []`). All 1280×800, 900×800 and 390×800 measurements have no horizontal overflow.

| Capture | 1280×800 | 900×800 | 390×800 |
|---|---|---|---|
| Existing account — roles | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-roles-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-roles-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-roles-390.png) |
| Existing account — overview settings | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-overview-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-overview-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-overview-390.png) |
| Existing account — dropdown | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-dropdown-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-dropdown-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-dropdown-390.png) |
| Existing account — populated chat | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-chat-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-chat-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-chat-390.png) |
| Fresh account — roles | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-roles-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-roles-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-roles-390.png) |
| Fresh account — overview settings | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-overview-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-overview-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-overview-390.png) |
| Fresh account — dropdown | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-dropdown-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-dropdown-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-dropdown-390.png) |
| Fresh account — populated chat | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-chat-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-chat-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-chat-390.png) |

Console capture images show the console events recorded from the actual localhost flow, rendered as an evidence panel; they are not screenshots of the DevTools interface: [existing account](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-existing-console-1280.png), [fresh account](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-fresh-console-1280.png).

## What passed on both accounts

- Roles: create, live draft naming, solid/gradient choices, icon upload and center crop, edit, atomic save, discard confirmation, delete, drag ordering saved in Supabase, base Member role protected, hard refresh and sign-out/sign-in.
- Groups: create, edit name/description, delete. Groups currently represent named community groups; a separate Constellation-style group/channel workspace is not implemented.
- Emotes: upload, name, rename, delete. Both Unicode and server custom emotes are available in the role picker.
- Server metadata: privacy/invite policy/default notification level save to Supabase; avatar/banner upload and removal; description persistence read back from the database.
- Invitations: create with expiration, revoke, and reject expired invitations. Private servers cannot be joined through public joining; public servers are discoverable and joinable.
- Bans: a disposable guest was banned through the authenticated API, appeared in the browser Bans page after reload, and was unbanned in that page.
- Webhooks: configuration creation/deletion, token hashing, permission checks, database posting with a valid scoped token, and rejected use after revocation. The HTTP Edge Function endpoint itself remains unverified and unavailable.

Group/emote CRUD was verified in the browser before the final hard refresh and sign-in cycle. Separate create→refresh→edit→refresh→delete→refresh cycles for each individual subpage were not run; no broader claim is made.

## Security attempts and results

All were real requests using ordinary account access tokens, not service-role simulation. HTTP 400 responses below are deliberate permission exceptions from RPCs. Direct table operations returned HTTP 403.

| Attempt | Result |
|---|---|
| Non-member reads server settings | Rejected |
| Direct role-table update | HTTP 403 |
| Direct webhook-table read | HTTP 403 |
| Non-manager uploads role icon | Storage rejected with `new row violates row-level security policy` |
| Non-member saves roles | Rejected |
| Member without Manage roles saves roles | Rejected |
| Ordinary member changes server settings | Rejected |
| Ordinary member creates group | Rejected |
| Ordinary member reads webhook configuration | Rejected |
| Invalid role batch, existing account | Rejected; earlier changes in that batch rolled back |
| Remove Read messages, then read as member | Rejected server-side |
| Remove Send messages, then post as member | Rejected server-side |
| Expired invitation, existing-account server | Rejected |
| Public-join attempt on private existing-account server | Rejected |
| Revoked webhook token, existing-account server | Rejected |
| Invalid role batch, fresh account | Rejected; rolled back |
| Expired invitation, fresh-account server | Rejected |
| Public-join attempt on private fresh-account server | Rejected |
| Revoked webhook token, fresh-account server | Rejected |

Phase C's badge/staff security tests were not attempted because that phase has not started. **Platform-admin bootstrap SQL applied: none.**

## Constellation comparisons and remaining differences

| View | 1280px comparison | 900px comparison | 390px comparison |
|---|---|---|---|
| Roles | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-roles-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-roles-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-roles-390.png) |
| Overview settings | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-overview-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-overview-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-overview-390.png) |
| Dropdown | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-dropdown-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-dropdown-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-dropdown-390.png) |
| Chat | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-chat-1280.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-chat-900.png) | [PNG](C:/Users/Sailish/Desktop/disc/constellation/verification/phase-a-compare-chat-390.png) |

- Font metrics and some vertical spacing differ from the reference; this is not pixel-exact parity.
- The requested hex values, angle field and live color preview add a row absent from the reference, pushing subsequent controls down.
- Fixtures use an original crest, initial avatars and test content instead of the reference's character emotes, photos, banner and server branding.
- The browser has no desktop application's title bar. Reference guide cursor highlights and dotted callouts are documentation annotations and are not reproduced.
- At 390px the role list stacks above the editor while retaining a narrower left navigation; no mobile reference was supplied. The member list hides at smaller widths and remains available through its button.
- The banner preview uses the explicitly requested 1920:300 aspect ratio. Guide screenshots show a different visual crop.
- Kick and Ban permissions are separate toggles rather than one combined row.
- Save is correctly dim in clean checkpoint images; the reference shows dirty gold Save. A dirty draft enables the gold button.
- Subscriptions, Level rewards, Widget and Integrations are intentionally excluded. Bots and Marketplace are excluded from the dropdown. These exclusions follow the requested scope.

## Deployment blocker and cleanup

The project key was tested against the Supabase management API: HTTP 401, `JWT could not be decoded`. An independent CLI check also failed with `Access token not provided`. No configured connector provides Supabase deployment access. The prepared function needs a Supabase management login/token with Edge Functions write access; the project data/admin key cannot supply that authority.

Only disposable verification records and files were removed: two accounts, two test servers and 37 uploaded objects. [cleanup-report.json](C:/Users/Sailish/Desktop/disc/constellation/verification/cleanup-report.json) confirms zero fixture users/profiles/servers remaining, zero users missing profiles, and preserved existing account, servers, channels, roles and messages. Cleanup is permanent; the screenshots and reports remain as the test evidence.

The app remains at http://localhost:8766 and its Node process serves static files only.
