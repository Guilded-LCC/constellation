// Live browser/API regression against Supabase. Uses the service key only for
// one-time QA magic links; all application traffic uses anon-key RPC/Storage.
import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { chromium } from "playwright";

try { loadEnvFile(".env"); } catch {}
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.CONSTELLATION_URL || "http://localhost:8766";
if (!supabaseUrl || !anonKey || !serviceKey) {
  throw Error("Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.");
}

const passed = [];
const blocked = [];
const ownerEmail = "qa-owner@constellation.local";
const memberEmail = "qa-member@constellation.local";
const adminEmail = process.env.CONSTELLATION_ADMIN_EMAIL || "admin@constellation.example";
async function magicToken(email) {
  const generated = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!generated.ok) throw Error(`Could not create a QA sign-in link (HTTP ${generated.status}).`);
  const link = await generated.json();
  const verified = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ token_hash: link.hashed_token, type: "magiclink" }),
  });
  if (!verified.ok) throw Error(`Could not verify a QA sign-in link (HTTP ${verified.status}).`);
  return verified.json();
}
async function rpc(token, name, args = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Error(`${name} failed (${response.status}): ${body?.message || "request rejected"}`);
  return body;
}
async function relations(token, action, payload = {}) {
  return rpc(token, "app_message_relations", { p_action: action, p_payload: payload });
}
async function expectDenied(fn, label) {
  let rejected = false;
  try { await fn(); } catch { rejected = true; }
  assert(rejected, `${label} should be rejected`);
}

if (process.env.RELATIONS_ONLY === "1") {
  const owner = await magicToken(ownerEmail), member = await magicToken(memberEmail);
  let serverId = null, inviteTestServerId = null, browser, botProfileId = null, ownerProfileId = null;
  let inviteTestCode = null;
  const storagePaths = [];
  const browserErrors = [];
  let originalUiPreferences = null;
  let originalCustomStatus = null, originalCustomStatusEmoji = null;
  try {
    originalUiPreferences = await rpc(owner.access_token, "app_ui_state", { p_data: null });
    const ownerState = await rpc(owner.access_token, "app_state");
    ownerProfileId = ownerState.user.id;
    originalCustomStatus = ownerState.user.custom_status || "";
    originalCustomStatusEmoji = ownerState.user.custom_status_emoji || "";
    await rpc(owner.access_token, "app_profile_status", { p_text: "Temporary QA status", p_emoji: "🎧" });
    assert.equal((await rpc(owner.access_token, "app_state")).user.custom_status, "Temporary QA status");
    const server = await rpc(owner.access_token, "app_api", { p_action: "server/create", p_payload: { name: `Relations QA ${Date.now()}` } });
    serverId = server.id;
    const state = await rpc(owner.access_token, "app_state");
    const channel = state.servers.find((item) => item.id === serverId)?.channels.find((item) => item.type === "TEXT");
    assert(channel, "test server should have a text channel");
    const calendarChannel = await rpc(owner.access_token, "app_api", { p_action: "channel/save", p_payload: { server: serverId, name: "events", type: "CALENDAR", category: "TEXT CHANNELS" } });
    const overviewEvent = await rpc(owner.access_token, "app_feature_api", { p_action: "calendar/create", p_payload: { channel: calendarChannel.id, title: "Overview RSVP regression", starts_at: new Date(Date.now() + 86_400_000).toISOString(), description: "Live overview action" } });
    const invite = await rpc(owner.access_token, "app_api", { p_action: "server/invite", p_payload: { server: serverId } });
    const invitePreview = await rpc(member.access_token, "app_invite_preview", { p_code: invite.code });
    assert.equal(invitePreview.id, serverId);
    assert.equal(invitePreview.inviter_name, ownerState.user.name);
    await expectDenied(() => rpc(member.access_token, "app_invite_preview", { p_code: "invalid-qa-invite" }), "invalid invite preview");
    await rpc(member.access_token, "app_api", { p_action: "server/join", p_payload: { code: invite.code } });
    const inviteTestServer = await rpc(owner.access_token, "app_api", { p_action: "server/create", p_payload: { name: `Constellation QA Invite ${Date.now()}` } });
    inviteTestServerId = inviteTestServer.id;
    inviteTestCode = (await rpc(owner.access_token, "app_api", { p_action: "server/invite", p_payload: { server: inviteTestServerId } })).code;
    const anonymousPreviewResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/app_invite_preview`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_code: inviteTestCode }),
    });
    assert(anonymousPreviewResponse.ok, "valid invite preview should work without a signed-in session");
    const anonymousPreview = await anonymousPreviewResponse.json();
    assert.equal(anonymousPreview.id, inviteTestServerId);
    assert.deepEqual(Object.keys(anonymousPreview).sort(), ["avatar_url", "id", "inviter_avatar", "inviter_name", "member_count", "name"]);
    const anonymousInvalidPreview = await fetch(`${supabaseUrl}/rest/v1/rpc/app_invite_preview`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_code: "invalid-qa-invite" }),
    });
    assert(!anonymousInvalidPreview.ok, "invalid invite previews must remain rejected for anonymous callers");
    async function storageUpload(token, label) {
      const path = `channels/${channel.id}/relations-${label}-${crypto.randomUUID()}.txt`;
      const response = await fetch(`${supabaseUrl}/storage/v1/object/attachments/${path}`, { method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "text/plain", "x-upsert": "false" }, body: `storage permission ${label}` });
      if (response.ok) storagePaths.push(path);
      return response;
    }
    assert((await storageUpload(owner.access_token, "owner")).ok, "server owner should be able to upload");
    const beforeRoles = state.servers.find((item) => item.id === serverId).roles;
    const baseMember = beforeRoles.find((item) => item.position === 0);
    const adminRole = { id: crypto.randomUUID(), name: "Administrator QA", color: "#f6c500", color2: "", emoji: "", permissions: ["administrator"], position: Math.max(...beforeRoles.map((item) => item.position)) + 1, icon_url: "", self_assignable: false, mentionable: false, hoist: false, gradient_angle: 90 };
    await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: [...beforeRoles, adminRole] });
    await rpc(owner.access_token, "app_api", { p_action: "member/role", p_payload: { server: serverId, user: (await rpc(member.access_token, "app_state")).user.id, role: adminRole.id, enabled: true } });
    assert((await storageUpload(member.access_token, "administrator")).ok, "Administrator role should be able to upload");
    await rpc(owner.access_token, "app_api", { p_action: "member/role", p_payload: { server: serverId, user: (await rpc(member.access_token, "app_state")).user.id, role: adminRole.id, enabled: false } });
    const memberWithoutUpload = beforeRoles.map((role) => role.id === baseMember.id ? { ...role, permissions: (role.permissions || []).filter((permission) => permission !== "upload_media") } : role);
    await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: memberWithoutUpload });
    const deniedUpload = await storageUpload(member.access_token, "member-denied");
    const deniedBody = await deniedUpload.text();
    assert(!deniedUpload.ok, `member without upload_media should be rejected by Storage (HTTP ${deniedUpload.status}: ${deniedBody})`);
    assert.match(`${deniedUpload.status} ${deniedBody}`, /403|unauthorized|row.level security|policy/i, "upload denial should come from the Storage policy");
    const memberWithUpload = memberWithoutUpload.map((role) => role.id === baseMember.id ? { ...role, permissions: [...role.permissions, "upload_media"] } : role);
    await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: memberWithUpload });
    assert((await storageUpload(member.access_token, "member-allowed")).ok, "member with upload_media should be able to upload");
    await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: beforeRoles });
    console.log("PASS live Storage RLS: owner and Administrator uploads allowed; member upload denied then allowed by permission toggle");
    const memberIdentity = await rpc(member.access_token, "app_state");
    const root = await rpc(owner.access_token, "app_api", { p_action: "message/send", p_payload: { channel: channel.id, body: `relations security root @${memberIdentity.user.username}` } });
    const privateMentionChannel = await rpc(owner.access_token, "app_api", { p_action: "channel/save", p_payload: { server: serverId, name: "private-mentions", type: "TEXT", category: "TEXT CHANNELS", allowed: [crypto.randomUUID()] } });
    const hiddenMention = await rpc(owner.access_token, "app_api", { p_action: "message/send", p_payload: { channel: privateMentionChannel.id, body: `hidden mention @${memberIdentity.user.username}` } });
    const mentionFeed = await rpc(member.access_token, "app_mention_feed");
    assert(mentionFeed.some((item) => item.message_id === root.id), "member should see mentions from channels they can read");
    assert(!mentionFeed.some((item) => item.message_id === hiddenMention.id), "member mention feed must not leak messages from a channel they cannot read");
    console.log("PASS live mention feed security: readable-channel mention appears; inaccessible-channel message stays hidden");
    const publicReply = await relations(owner.access_token, "reply/create", { channel: channel.id, message: root.id, body: "public reply" });
    const privateReply = await relations(owner.access_token, "reply/create", { channel: channel.id, message: root.id, body: "owner-only private reply", private: true });
    const memberView = await relations(member.access_token, "list", { channel: channel.id });
    assert(memberView.replies.some((item) => item.id === publicReply.id));
    assert(!memberView.replies.some((item) => item.id === privateReply.id));
    await expectDenied(() => relations(member.access_token, "reply/create", { channel: channel.id, message: root.id, body: "private attack", private: true }), "member private reply");
    const baseRole = state.servers.find((item) => item.id === serverId).roles.find((item) => item.position === 0);
    const enabledRoles = state.servers.find((item) => item.id === serverId).roles.map((role) => role.id === baseRole.id ? { ...role, permissions: [...new Set([...(role.permissions || []), "private_replies"])] } : role);
    await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: enabledRoles });
    const permittedPrivate = await relations(member.access_token, "reply/create", { channel: channel.id, message: root.id, body: "private reply with permission", private: true });
    assert((await relations(member.access_token, "list", { channel: channel.id })).replies.some((item) => item.id === permittedPrivate.id), "authorized member should see their own private reply");
    const originalRoles = state.servers.find((item) => item.id === serverId).roles;
    await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: originalRoles });
    await expectDenied(() => relations(member.access_token, "reply/create", { channel: channel.id, message: root.id, body: "private after revoke", private: true }), "private reply after permission revoke");
    const memberId = (await rpc(member.access_token, "app_state")).user.id;
    const selfBotWrite = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${memberId}`, {
      method: "PATCH",
      headers: { apikey: anonKey, Authorization: `Bearer ${member.access_token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ is_bot: true }),
    });
    assert(!selfBotWrite.ok, "normal member must not be able to set their own is_bot flag");
    const otherProfileWrite = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${ownerProfileId}`, {
      method: "PATCH",
      headers: { apikey: anonKey, Authorization: `Bearer ${member.access_token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ custom_status: "unauthorized edit" }),
    });
    assert(!otherProfileWrite.ok, "a member must not be able to overwrite another profile status");
    const grantBotFlag = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${memberId}`, {
      method: "PATCH",
      headers: { apikey: anonKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ is_bot: true }),
    });
    assert(grantBotFlag.ok, `service-role bot flag setup failed (HTTP ${grantBotFlag.status})`);
    botProfileId = memberId;
    assert.equal((await rpc(member.access_token, "app_state")).user.is_bot, true, "profile bot flag should be returned in app_state");
    const botMessage = await rpc(member.access_token, "app_api", { p_action: "message/send", p_payload: { channel: channel.id, body: "BOT badge render regression" } });
    const thread = await relations(owner.access_token, "thread/create", { channel: channel.id, message: root.id });
    await relations(member.access_token, "thread/reply", { channel: channel.id, thread: thread.id, body: "member thread reply" });
    assert.equal((await relations(owner.access_token, "thread/open", { channel: channel.id, thread: thread.id })).replies.length, 1);
    await expectDenied(() => relations(member.access_token, "thread/archive", { channel: channel.id, thread: thread.id, archived: true }), "member thread archive");
    await relations(owner.access_token, "thread/archive", { channel: channel.id, thread: thread.id, archived: true });
    await expectDenied(() => relations(member.access_token, "thread/reply", { channel: channel.id, thread: thread.id, body: "archived thread attack" }), "write to archived thread");
    for (const table of ["message_replies", "message_threads", "thread_replies"]) {
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, { headers: { apikey: anonKey, Authorization: `Bearer ${owner.access_token}` } });
      assert(!response.ok, `${table} direct access should be denied`);
    }

    browser = await chromium.launch({ headless: true, args: ["--no-zygote", "--disable-gpu", "--disable-background-networking"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(async (session) => {
      const client = window.supabase.createClient(window.CONSTELLATION_CONFIG.supabaseUrl, window.CONSTELLATION_CONFIG.supabasePublishableKey);
      const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (result.error) throw result.error;
    }, owner);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".layout").waitFor();
    await page.locator(".profilebar .profile-identity").click();
    await page.locator("#profile-legacy-nav").check();
    await page.locator("#modal [data-action='save-profile']").click();
    await page.locator(".layout.legacy-nav").waitFor();
    assert.equal(await page.locator(".legacy-nav .rail").evaluate((el) => getComputedStyle(el).flexDirection), "row");
    assert.equal(await page.locator(".legacy-nav .rail").evaluate((el) => Math.round(el.getBoundingClientRect().bottom)), 800);
    await page.locator("#toast").waitFor({ state: "hidden" });
    await page.screenshot({ path: "verification/live-legacy-navigation-1280.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.querySelector(".layout")?.classList.remove("shownav"));
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    await page.screenshot({ path: "verification/live-legacy-navigation-390.png" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".layout.legacy-nav").waitFor();
    await page.locator(".legacy-profilebar .legacy-profile").click();
    assert.equal(await page.locator("#profile-legacy-nav").isChecked(), true);
    await page.locator("#profile-legacy-nav").uncheck();
    await page.locator("#modal [data-action='save-profile']").click();
    await page.locator(".layout:not(.legacy-nav)").waitFor();
    console.log("PASS live legacy navigation: Supabase preference survives refresh, horizontal bottom rail renders at 1280/390 without overflow");
    await page.locator(".profilebar .profile-identity").click();
    await page.locator("#profile-custom-status").waitFor();
    assert.equal(await page.locator("#profile-custom-status").inputValue(), "Temporary QA status");
    await page.locator("#profile-custom-status").fill("Reviewing Constellation UI");
    await page.locator("#profile-custom-emoji").fill("🎧");
    await page.locator("#modal [data-action='save-profile']").click();
    await page.locator(".profilebar").getByText("Reviewing Constellation UI", { exact: false }).waitFor();
    await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
    await page.locator(`.members .member[data-id="${ownerProfileId}"] .who small`).filter({ hasText: "Reviewing Constellation UI" }).waitFor();
    await page.screenshot({ path: "verification/live-custom-status-1280.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "verification/live-custom-status-390.png" });
    await page.setViewportSize({ width: 1280, height: 800 });
    console.log("PASS live custom status: self-edit persists, appears in sidebar/member list, another member cannot change it");
    await page.locator("#toast").waitFor({ state: "hidden" });
    await page.locator(".profilebar [data-action='user-menu']").click();
    await page.locator(".context-menu").filter({ hasText: "Referral program" }).waitFor();
    for (const label of ["Support", "Feedback", "Blog", "Become a partner", "Follow us on social media", "We're hiring!", "Log out"]) {
      await page.locator(".context-menu").getByText(label, { exact: true }).waitFor();
    }
    await page.locator(".context-menu [role='separator']").waitFor();
    await page.screenshot({ path: "verification/live-user-menu-1280.png" });
    await page.evaluate(() => document.querySelector(".context-menu")?.remove());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.querySelector(".layout")?.classList.add("shownav"));
    await page.locator(".profilebar [data-action='user-menu']").click();
    await page.locator(".context-menu").waitFor();
    await page.screenshot({ path: "verification/live-user-menu-390.png" });
    await page.evaluate(() => { document.querySelector(".context-menu")?.remove(); document.querySelector(".layout")?.classList.remove("shownav"); });
    await page.setViewportSize({ width: 1280, height: 800 });
    console.log("PASS live profile action menu: reference links and logout entries visible at desktop/mobile; destinations are explicitly handled");
    await page.locator(".main").click({ button: "right", position: { x: 10, y: 140 } });
    await page.locator(".context-menu").getByText("Server settings", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".profilebar .profile-identity").click({ button: "right" });
    await page.locator(".context-menu").getByText("Activity log", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    console.log("PASS right-click surfaces: blank server area opens server actions; profile panel opens account actions");
    await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
    await page.locator(".serverhead-title").click();
    await page.locator(`.context-menu [data-action="favorite-server"][data-id="${serverId}"]`).click();
    await page.locator(`.rail .orb[data-id="${serverId}"].favorite`).waitFor();
    await page.locator(".rail [data-action='server-list']").click();
    await page.locator(".server-list-panel").waitFor();
    await page.locator(".server-list-panel .server-list-group h3", { hasText: "Favorites" }).waitFor();
    await page.screenshot({ path: "verification/live-server-list-1280.png" });
    await page.locator("#server-list-search").fill("Relations QA");
    await page.locator(`.server-list-panel .server-list-select[data-id="${serverId}"]`).waitFor();
    await page.locator(`.server-list-panel .server-list-select[data-id="${serverId}"]`).click();
    await page.locator(".server-list-panel").waitFor({ state: "hidden" });
    await page.locator(".serverhead-actions [data-action='invite']").waitFor();
    await page.locator(".serverhead-actions [data-action='settings']").waitFor();
    await page.locator(".serverhead-actions [data-action='invite']").click();
    await page.locator("#modal[open]").filter({ hasText: "Invite people" }).waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#modal[open]").waitFor({ state: "hidden" });
    await page.locator(".serverhead-actions [data-action='settings']").click();
    await page.locator("#modal.s-settings[open]").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#modal[open]").waitFor({ state: "hidden" });
    for (const action of ["friends", "achievements", "activity", "join-server"]) {
      await page.locator(`.rail > [data-action='${action}']`).click();
      await page.locator("#modal[open]").waitFor();
      await page.keyboard.press("Escape");
      await page.locator("#modal[open]").waitFor({ state: "hidden" });
    }
    const guestInvitePage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    guestInvitePage.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    guestInvitePage.on("pageerror", (error) => browserErrors.push(error.message));
    await guestInvitePage.goto(`${appUrl}/?invite=${encodeURIComponent(inviteTestCode)}`, { waitUntil: "domcontentloaded" });
    await guestInvitePage.locator(".invite-landing").waitFor();
    await guestInvitePage.locator("#invite-display-name").waitFor();
    await guestInvitePage.getByText(`Accept ${ownerState.user.name}’s invite to join`).waitFor();
    await guestInvitePage.screenshot({ path: "verification/live-invite-guest-1280.png" });
    await guestInvitePage.setViewportSize({ width: 390, height: 844 });
    await guestInvitePage.locator(".invite-preview-art").waitFor();
    assert.equal(await guestInvitePage.evaluate(() => document.documentElement.scrollWidth), 390);
    const guestInviteBounds = await guestInvitePage.locator(".invite-preview-shell").boundingBox();
    assert(guestInviteBounds.x >= 0 && guestInviteBounds.x + guestInviteBounds.width <= 390, "guest invite card must fit the mobile viewport");
    await guestInvitePage.screenshot({ path: "verification/live-invite-guest-390.png" });
    await guestInvitePage.locator("#invite-display-name").fill("New Guest");
    await guestInvitePage.locator("[data-action='invite-signup']").click();
    await guestInvitePage.locator("#auth-form").getByText("Create account", { exact: false }).waitFor();
    await guestInvitePage.locator("[data-action='invite-back']").click();
    await guestInvitePage.locator("[data-action='invite-login']").click();
    await guestInvitePage.getByText("Log in to continue").waitFor();
    await guestInvitePage.evaluate(async (session) => {
      const client = window.supabase.createClient(window.CONSTELLATION_CONFIG.supabaseUrl, window.CONSTELLATION_CONFIG.supabasePublishableKey);
      const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (result.error) throw result.error;
    }, member);
    await guestInvitePage.reload({ waitUntil: "networkidle" });
    await guestInvitePage.locator(".layout").waitFor();
    await guestInvitePage.locator("#modal.invite-dialog").filter({ hasText: inviteTestServer.name }).waitFor();
    await guestInvitePage.locator("#modal [data-action='accept-invite']").click();
    await guestInvitePage.locator(`.rail .orb[data-id="${inviteTestServerId}"].active`).waitFor();
    assert((await rpc(member.access_token, "app_state")).servers.some((entry) => entry.id === inviteTestServerId));
    assert.equal(await guestInvitePage.evaluate(() => document.documentElement.scrollWidth), 390);
    assert.equal(browserErrors.length, 0, browserErrors.join(" | "));
    await guestInvitePage.close();
    console.log("PASS live guest invite: anonymous scoped preview, invalid-code rejection, name/signup/login continuation, browser acceptance, persistence, desktop/mobile and empty console");
    const invitePage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    invitePage.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    invitePage.on("pageerror", (error) => browserErrors.push(error.message));
    await invitePage.goto(appUrl, { waitUntil: "domcontentloaded" });
    await invitePage.evaluate(async (session) => {
      const client = window.supabase.createClient(window.CONSTELLATION_CONFIG.supabaseUrl, window.CONSTELLATION_CONFIG.supabasePublishableKey);
      const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (result.error) throw result.error;
    }, member);
    await invitePage.reload({ waitUntil: "domcontentloaded" });
    await invitePage.locator(".layout").waitFor();
    await invitePage.locator(".profilebar [data-action='activity']").click();
    await invitePage.locator("#modal[open]").filter({ hasText: "Activity log" }).waitFor();
    await invitePage.locator(`#modal [data-action='mention-open'][data-message="${root.id}"]`).waitFor();
    await invitePage.getByText("relations security root", { exact: false }).waitFor();
    await invitePage.getByText("hidden mention", { exact: false }).waitFor({ state: "detached" });
    await invitePage.screenshot({ path: "verification/live-activity-1280.png" });
    await invitePage.setViewportSize({ width: 390, height: 844 });
    await invitePage.screenshot({ path: "verification/live-activity-390.png" });
    await invitePage.setViewportSize({ width: 1280, height: 800 });
    await invitePage.locator(`#modal [data-action='mention-open'][data-message="${root.id}"]`).click();
    await invitePage.locator(`.message[data-message="${root.id}"]`).waitFor();
    await invitePage.locator(".rail [data-action='join-server']").click();
    await invitePage.locator("#invite-code").fill(inviteTestCode);
    await invitePage.locator("#modal [data-action='preview-invite']").click();
    await invitePage.locator("#modal.invite-dialog").filter({ hasText: "Constellation QA Invite" }).waitFor();
    await invitePage.locator("#modal.invite-dialog").filter({ hasText: "QA Owner invited you to join" }).waitFor();
    await invitePage.screenshot({ path: "verification/live-invite-preview-1280.png" });
    await invitePage.setViewportSize({ width: 390, height: 844 });
    await invitePage.screenshot({ path: "verification/live-invite-preview-390.png" });
    await invitePage.locator("#modal [data-action='accept-invite']").click();
    await invitePage.locator(`.rail .orb[data-id="${inviteTestServerId}"].active`).waitFor();
    assert.equal((await rpc(member.access_token, "app_state")).servers.some((server) => server.id === inviteTestServerId), true);
    assert.equal(await invitePage.evaluate(() => document.documentElement.scrollWidth), 390);
    assert.equal(browserErrors.length, 0, browserErrors.join(" | "));
    console.log("PASS live invite preview: authorized bearer-code preview, inviter/server metadata, browser acceptance, persistence, desktop/mobile and empty console");
    await invitePage.close();
    await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
    await page.getByText("Overview RSVP regression").waitFor();
    const maybeRsvp = page.locator(`[data-action="overview-rsvp"][data-id="${overviewEvent.id}"][data-status="maybe"]`);
    await maybeRsvp.click();
    await page.locator(`[data-action="overview-rsvp"][data-id="${overviewEvent.id}"][data-status="maybe"].selected`).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".layout").waitFor();
    await page.locator(`.rail .orb[data-id="${serverId}"].favorite`).waitFor();
    await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
    await page.locator(`[data-action="overview-rsvp"][data-id="${overviewEvent.id}"][data-status="maybe"].selected`).waitFor();
    assert.equal(await page.locator(".rail [data-action='friends']").count(), 1);
    assert.equal(await page.locator(".rail [data-action='achievements']").count(), 1);
    await page.locator(".overview-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await page.screenshot({ path: "verification/live-navigation-overview-1280.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.querySelector(".layout")?.classList.remove("shownav"));
    await page.waitForTimeout(220);
    await page.locator(".overview-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const overviewWidths = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    assert.equal(overviewWidths.content, overviewWidths.viewport, "mobile overview should not overflow horizontally");
    await page.screenshot({ path: "verification/live-navigation-overview-390.png" });
    await page.setViewportSize({ width: 1280, height: 800 });
    passed.push("live navigation rail, server Invite/Settings and overview RSVP persisted across hard refresh");
    await page.locator(`.channel[data-id="${channel.id}"]`).click();
    await page.locator(".message.reply-message .bot-badge").waitFor();
    const row = page.locator(`.message[data-message="${root.id}"]`);
    const publicReplyRow = page.locator(`.message[data-reply="${publicReply.id}"]`);
    const privateReplyRow = page.locator(`.message[data-reply="${privateReply.id}"]`);
    await publicReplyRow.getByText("public reply", { exact: true }).waitFor();
    await publicReplyRow.locator(".message-reply-preview").filter({ hasText: "relations security root" }).waitFor();
    await privateReplyRow.getByText("owner-only private reply", { exact: true }).waitFor();
    assert(await privateReplyRow.evaluate((el) => el.classList.contains("reply-private")));
    await row.locator('[data-action="reply"]').click({ force: true });
    assert(await row.evaluate((el) => el.classList.contains("reply-selected-row")));
    await page.locator("#message").fill("browser reply persistence");
    await page.locator("#compose").evaluate((form) => form.requestSubmit());
    await page.locator(".message.reply-message").filter({ hasText: "browser reply persistence" }).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".layout").waitFor();
    await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
    await page.locator(`.channel[data-id="${channel.id}"]`).click();
    await page.locator(`.message[data-message="${root.id}"] .message-thread-link`).waitFor();
    await page.locator(`.message[data-message="${root.id}"] .message-thread-link`).click();
    await page.locator(".thread-panel").filter({ hasText: "member thread reply" }).waitFor();
    await page.screenshot({ path: "verification/live-message-relations-1280.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".rail [data-action='server-list']").click();
    await page.locator(".server-list-panel").waitFor();
    const serverListWidths = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    assert.equal(serverListWidths.content, serverListWidths.viewport, "mobile server list should not overflow horizontally");
    await page.screenshot({ path: "verification/live-server-list-390.png" });
    await page.locator(".rail [data-action='server-list']").click();
    await page.locator(".server-list-panel").waitFor({ state: "hidden" });
    await page.locator(`.message[data-message="${root.id}"] .message-thread-link`).click();
    await page.locator("#modal[open]").filter({ hasText: "member thread reply" }).waitFor();
    const widths = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    assert.equal(widths.content, widths.viewport, "mobile page should not overflow horizontally");
    await page.screenshot({ path: "verification/live-message-relations-390.png" });
    assert.equal(browserErrors.length, 0, browserErrors.join(" | "));
    console.log("PASS live relation security: private replies hidden and rejected; thread moderation enforced; tables isolated");
    console.log("PASS live bot profile: member self-write denied, platform-service setup allowed, app_state and message BOT badge rendered");
    console.log("PASS live browser: public/private previews, reply composer, thread detail, hard-refresh persistence, 1280/390, empty console");
  } finally {
    if (browser) await browser.close();
    if (originalUiPreferences) await rpc(owner.access_token, "app_ui_state", { p_data: originalUiPreferences }).catch(() => {});
    if (ownerProfileId && originalCustomStatus !== null) await rpc(owner.access_token, "app_profile_status", { p_text: originalCustomStatus, p_emoji: originalCustomStatusEmoji }).catch(() => {});
    if (botProfileId) await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${botProfileId}`, { method: "PATCH", headers: { apikey: anonKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ is_bot: false }) }).catch(() => {});
    for (const path of storagePaths) await fetch(`${supabaseUrl}/storage/v1/object/attachments/${path}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }).catch(() => {});
    if (serverId) await rpc(owner.access_token, "app_api", { p_action: "server/delete", p_payload: { server: serverId } }).catch(() => {});
    if (inviteTestServerId) await rpc(owner.access_token, "app_api", { p_action: "server/delete", p_payload: { server: inviteTestServerId } }).catch(() => {});
  }
  process.exit(0);
}

const owner = await magicToken(ownerEmail);
const member = await magicToken(memberEmail);
const admin = await magicToken(adminEmail);
let serverId = null;
let storagePath = null;
let uiTestBadgeId = null;
let suspendedUserId = null;
let browser;
try {
  // The browser login is real and uses the same anon-key client as the site.
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const browserErrors = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(appUrl);
  await page.evaluate(async (session) => {
    const client = window.supabase.createClient(
      window.CONSTELLATION_CONFIG.supabaseUrl,
      window.CONSTELLATION_CONFIG.supabasePublishableKey,
    );
    const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (result.error) throw result.error;
  }, owner);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".layout").waitFor();
  assert.equal(await page.locator("#toast").evaluate((el) => getComputedStyle(el).display), "none");
  passed.push("qa-owner magic-link sign-in and clean localhost home");

  // Create an isolated server from the actual UI, then verify its state via RPC.
  const serverName = `Live regression ${Date.now()}`;
  await page.locator('[data-action="create-server"]').first().click();
  await page.locator("#new-server-name").fill(serverName);
  await page.locator('[data-action="submit-server"]').click();
  await page.locator(`.rail [title="${serverName}"]`).waitFor();
  const ownerState = await rpc(owner.access_token, "app_state");
  const server = ownerState.servers.find((item) => item.name === serverName);
  assert(server, "created server must persist in app_state");
  serverId = server.id;
  const settingsSnapshot = await rpc(owner.access_token, "app_settings", { p_server: serverId, p_action: "read", p_data: {} });
  assert(settingsSnapshot?.server?.created_at, "server settings read must include its creation timestamp");
  passed.push("server create, rail selection and Supabase persistence");

  // Create a category and every implemented channel type through production RPCs.
  const category = await rpc(owner.access_token, "app_category_api", {
    p_action: "save", p_payload: { server: serverId, name: "Regression category", allowed: [] },
  });
  const channels = {};
  for (const type of ["TEXT", "LIST", "DOCS", "CALENDAR", "FORUM", "VOICE"]) {
    const result = await rpc(owner.access_token, "app_api", {
      p_action: "channel/save",
      p_payload: { server: serverId, name: `regression-${type.toLowerCase()}`, type, category_id: category.id },
    });
    channels[type] = result.id;
  }
  const refreshed = await rpc(owner.access_token, "app_state");
  const savedServer = refreshed.servers.find((item) => item.id === serverId);
  assert.equal(savedServer.categories.find((item) => item.id === category.id)?.name, "Regression category");
  for (const [type, id] of Object.entries(channels)) assert.equal(savedServer.channels.find((item) => item.id === id)?.type, type);
  passed.push("category and TEXT/LIST/DOCS/CALENDAR/FORUM/VOICE channel persistence");

  const invite = await rpc(owner.access_token, "app_api", { p_action: "server/invite", p_payload: { server: serverId } });
  await rpc(member.access_token, "app_api", { p_action: "server/join", p_payload: { code: invite.code } });
  passed.push("qa-member joined the isolated test server");

  // Direct messages must be discoverable and readable by both participants after refresh.
  const memberUser = (await rpc(member.access_token, "app_state")).user;
  const ownerUser = ownerState.user;
  const previousDirectMessages = await rpc(owner.access_token, "app_messages", { p_channel: null, p_user: memberUser.id });
  for (const item of previousDirectMessages.filter((message) => message.body.startsWith("direct message regression"))) {
    await rpc(owner.access_token, "app_api", { p_action: "message/delete", p_payload: { id: item.id } });
  }
  await page.locator(".rail [data-action='home']").click();
  assert.equal(await page.locator(".rail .brand").evaluate((el) => getComputedStyle(el).outlineWidth), "2px", "active direct-message rail icon should use the Constellation gold outline");
  await page.locator(".sidebar [data-action='new-dm']").first().click();
  await page.locator("#dm-username").fill(memberUser.username);
  await page.locator("#modal [data-action='open-dm']").click();
  const dmBody = "Hey, nice to see you here!";
  await page.locator("#message").fill(dmBody);
  await page.locator("#compose").evaluate((form) => form.requestSubmit());
  await page.locator(".message").filter({ hasText: dmBody }).waitFor();
  assert.equal(await page.locator(".timeline .welcome").count(), 0, "existing messages should replace the empty conversation welcome");
  await page.screenshot({ path: "verification/live-dm-1280.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".layout").evaluate((el) => el.classList.remove("shownav"));
  await page.waitForTimeout(220);
  const closedDmSidebar = await page.locator(".sidebar").boundingBox();
  assert(closedDmSidebar.x + closedDmSidebar.width <= 0, `mobile direct-message screenshot should show the closed navigation drawer (bounds ${JSON.stringify(closedDmSidebar)}, layout ${await page.locator(".layout").getAttribute("class")})`);
  await page.screenshot({ path: "verification/live-dm-390.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  let dmMessages = await rpc(member.access_token, "app_messages", { p_channel: null, p_user: ownerUser.id });
  const persistedDirectMessage = dmMessages.find((item) => item.body === dmBody);
  assert(persistedDirectMessage, "recipient must read the direct message through Supabase");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".rail [data-action='home']").click();
  await page.locator(`.sidebar .channel[data-action='dm'][data-id='${memberUser.id}']`).click();
  await page.locator(".message").filter({ hasText: dmBody }).waitFor();
  await page.evaluate(async (session) => {
    const client = window.supabase.createClient(window.CONSTELLATION_CONFIG.supabaseUrl, window.CONSTELLATION_CONFIG.supabasePublishableKey);
    const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (result.error) throw result.error;
  }, member);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".rail [data-action='home']").click();
  await page.locator(`.sidebar .channel[data-action='dm'][data-id='${ownerUser.id}']`).click();
  await page.locator(".message").filter({ hasText: dmBody }).waitFor();
  await page.evaluate(async (session) => {
    const client = window.supabase.createClient(window.CONSTELLATION_CONFIG.supabaseUrl, window.CONSTELLATION_CONFIG.supabasePublishableKey);
    const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (result.error) throw result.error;
  }, owner);
  await page.reload({ waitUntil: "networkidle" });
  await rpc(owner.access_token, "app_api", { p_action: "message/delete", p_payload: { id: persistedDirectMessage.id } });
  passed.push("direct message create, recipient access, sidebar rediscovery and hard-refresh persistence for both accounts");

  // Chat send/edit/react/pin/read/delete; every read is through app_messages.
  const textChannel = channels.TEXT;
  const sent = await rpc(owner.access_token, "app_api", { p_action: "message/send", p_payload: { channel: textChannel, body: "live regression message" } });
  await rpc(owner.access_token, "app_api", { p_action: "message/edit", p_payload: { id: sent.id, body: "edited regression message" } });
  await rpc(owner.access_token, "app_api", { p_action: "message/react", p_payload: { id: sent.id, emoji: "👍" } });
  await rpc(owner.access_token, "app_api", { p_action: "message/pin", p_payload: { id: sent.id } });
  let chat = await rpc(owner.access_token, "app_messages", { p_channel: textChannel, p_user: null });
  let message = chat.find((item) => item.id === sent.id);
  assert.equal(message.body, "edited regression message");
  assert.equal(message.edited, true);
  assert.equal(message.pinned, true);
  assert(message.reactions.some((item) => item.emoji === "👍"));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".layout").waitFor();

  // Durable replies and threads use the production UI and SECURITY DEFINER RPC.
  await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
  await page.locator(`.channel[data-id="${textChannel}"]`).click();
  const messageRow = page.locator(`.message[data-message="${sent.id}"]`);
  await messageRow.locator('[data-action="reply"]').click({ force: true });
  await page.locator("#message").fill("persistent reply from owner");
  await page.locator("#compose").evaluate((form) => form.requestSubmit());
  await page.locator(".message.reply-message").filter({ hasText: "persistent reply from owner" }).waitFor();
  const createdReply = (await relations(owner.access_token, "list", { channel: textChannel })).replies[0];
  assert.equal(createdReply.parent_message_id, sent.id);
  await page.locator(`.message[data-reply="${createdReply.id}"] .message-reply-preview`).filter({ hasText: "edited regression message" }).waitFor();
  await messageRow.locator('[data-action="thread-create"]').click({ force: true });
  await page.locator(".thread-panel").waitFor();
  await page.locator("#thread-message").fill("persistent thread reply");
  await page.locator("#thread-compose").evaluate((form) => form.requestSubmit());
  await page.locator(".thread-replies").filter({ hasText: "persistent thread reply" }).waitFor();
  const threadData = await relations(owner.access_token, "list", { channel: textChannel });
  const thread = threadData.threads.find((item) => item.root_message_id === sent.id);
  assert(thread, "thread must be stored in Supabase");
  const privateReply = await relations(owner.access_token, "reply/create", { channel: textChannel, message: sent.id, body: "owner-only private reply", private: true });
  const memberVisible = await relations(member.access_token, "list", { channel: textChannel });
  assert(!memberVisible.replies.some((reply) => reply.id === privateReply.id), "non-participant must not read a private reply");
  await expectDenied(() => relations(member.access_token, "reply/create", { channel: textChannel, message: sent.id, body: "unauthorized private reply", private: true }), "member private reply without permission");
  await expectDenied(() => relations(member.access_token, "thread/archive", { channel: textChannel, thread: thread.id, archived: true }), "non-moderator thread archive");
  await relations(owner.access_token, "thread/archive", { channel: textChannel, thread: thread.id, archived: true });
  await expectDenied(() => relations(member.access_token, "thread/reply", { channel: textChannel, thread: thread.id, body: "reply after archive" }), "reply to archived thread");
  for (const table of ["message_replies", "message_threads", "thread_replies"]) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, { headers: { apikey: anonKey, Authorization: `Bearer ${owner.access_token}` } });
    assert(!response.ok, `${table} direct access must be denied`);
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".layout").waitFor();
  await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
  await page.locator(`.channel[data-id="${textChannel}"]`).click();
  const afterRefreshRelations = await relations(owner.access_token, "list", { channel: textChannel });
  const refreshedReply = afterRefreshRelations.replies.find((reply) => reply.id === createdReply.id);
  assert(refreshedReply, "reply must still be present in the Supabase relations RPC after hard refresh");
  assert.equal(refreshedReply.body, "@qa-owner persistent reply from owner");
  await page.locator(`.message[data-reply="${createdReply.id}"]`).getByText("persistent reply from owner").waitFor();
  await page.locator(`.message[data-message="${sent.id}"] .message-thread-link`).click();
  await page.locator(".thread-replies").filter({ hasText: "persistent thread reply" }).waitFor();
  passed.push("public/private replies, thread reply/archive, direct table denial and hard-refresh persistence");

  await rpc(owner.access_token, "app_api", { p_action: "message/delete", p_payload: { id: sent.id } });
  chat = await rpc(owner.access_token, "app_messages", { p_channel: textChannel, p_user: null });
  assert(!chat.some((item) => item.id === sent.id));
  passed.push("chat send/edit/react/pin, hard-refresh and delete persistence");

  await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
  await page.locator(`.channel[data-id="${textChannel}"]`).click();
  const groupedFirst = await rpc(owner.access_token, "app_api", { p_action: "message/send", p_payload: { channel: textChannel, body: "grouped message one" } });
  const groupedSecond = await rpc(owner.access_token, "app_api", { p_action: "message/send", p_payload: { channel: textChannel, body: "grouped message two" } });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
  await page.locator(`.channel[data-id="${textChannel}"]`).click();
  await page.locator(`.message[data-message="${groupedSecond.id}"]`).waitFor();
  assert(await page.locator(`.message.grouped[data-message="${groupedSecond.id}"]`).count());
  assert(await page.locator(".timeline .date").count());
  const lastMessage = page.locator(`.message[data-message="${groupedSecond.id}"]`);
  await lastMessage.hover();
  await page.waitForTimeout(180);
  assert.equal(await lastMessage.locator(".msgtools").evaluate((el) => getComputedStyle(el).opacity), "1");
  assert.equal(await lastMessage.locator(".group-timestamp").evaluate((el) => getComputedStyle(el).opacity), "1");
  await lastMessage.locator('[data-action="message-menu"]').click();
  const messageMenu = page.locator(".context-menu");
  for (const label of ["Edit", "Share message", "Copy link", "Pin message", "Delete"]) assert(await messageMenu.getByText(label, { exact: true }).count(), `missing menu item: ${label}`);
  await page.keyboard.press("Escape");
  await lastMessage.click({ button: "right" });
  const rightClickMenu = page.locator(".context-menu");
  for (const label of ["Reply", "Share message", "Copy link", "Edit", "Delete"]) assert(await rightClickMenu.getByText(label, { exact: true }).count(), `missing context item: ${label}`);
  await page.screenshot({ path: "verification/live-message-menu-1280.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator(".layout").evaluate((el) => el.classList.contains("shownav")), false, "mobile channel selection should leave the sidebar closed");
  await page.waitForTimeout(220);
  await page.screenshot({ path: "verification/live-message-menu-390.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.keyboard.press("Escape");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(appUrl).origin });
  await lastMessage.hover();
  await lastMessage.locator('[data-action="message-menu"]').click();
  await page.locator(".context-menu").getByText("Share message", { exact: true }).click();
  await page.locator("#toast").filter({ hasText: "Message copied to clipboard." }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "grouped message two");
  await lastMessage.hover();
  await lastMessage.locator('[data-action="message-menu"]').click();
  await page.locator(".context-menu").getByText("Copy link", { exact: true }).click();
  await page.locator("#toast").filter({ hasText: "Message link copied." }).waitFor();
  assert((await page.evaluate(() => navigator.clipboard.readText())).includes(`#message-${groupedSecond.id}`));
  const quickDeleteMessage = await rpc(owner.access_token, "app_api", { p_action: "message/send", p_payload: { channel: textChannel, body: "quick delete regression" } });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(`.rail .orb[data-id="${serverId}"]`).click();
  await page.locator(`.channel[data-id="${textChannel}"]`).click();
  const quickDeleteRow = page.locator(`.message[data-message="${quickDeleteMessage.id}"]`);
  await quickDeleteRow.waitFor();
  await quickDeleteRow.hover();
  await quickDeleteRow.locator('[data-action="quick-delete-message"]').click();
  await quickDeleteRow.waitFor({ state: "detached" });
  chat = await rpc(owner.access_token, "app_messages", { p_channel: textChannel, p_user: null });
  assert(!chat.some((item) => item.id === quickDeleteMessage.id), "quick delete should remove the message immediately");
  await rpc(owner.access_token, "app_api", { p_action: "message/delete", p_payload: { id: groupedFirst.id } });
  await rpc(owner.access_token, "app_api", { p_action: "message/delete", p_payload: { id: groupedSecond.id } });
  passed.push("message grouping, date divider, hover timestamp/toolbar, click/right-click menus and quick delete");

  // Attach an object, bind it to a message, then check the message read path.
  const candidateStoragePath = `channels/${textChannel}/live-regression-${crypto.randomUUID()}.txt`;
  const uploaded = await fetch(`${supabaseUrl}/storage/v1/object/attachments/${candidateStoragePath}`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${owner.access_token}`, "Content-Type": "text/plain", "x-upsert": "false" },
    body: "live attachment test",
  });
  if (!uploaded.ok) {
    const detail = await uploaded.json().catch(() => ({}));
    blocked.push(`attachment upload rejected by live Storage policy (HTTP ${uploaded.status}: ${detail.message || "unknown error"})`);
  } else {
    storagePath = candidateStoragePath;
    const attachment = await rpc(owner.access_token, "app_feature_api", {
      p_action: "attachment/create", p_payload: { channel: textChannel, path: storagePath, name: "live-regression.txt", content_type: "text/plain", size: 20 },
    });
    const attachmentMessage = await rpc(owner.access_token, "app_api", { p_action: "message/send", p_payload: { channel: textChannel, body: "attachment regression" } });
    await rpc(owner.access_token, "app_feature_api", { p_action: "attachment/bind", p_payload: { channel: textChannel, id: attachment.id, message: attachmentMessage.id } });
    const attachmentRead = await rpc(owner.access_token, "app_messages", { p_channel: textChannel, p_user: null });
    assert(attachmentRead.find((item) => item.id === attachmentMessage.id)?.attachments?.some((item) => item.id === attachment.id));
    passed.push("attachment upload, bind and message-read persistence");
  }

  // LIST, DOCS, CALENDAR, FORUM, and presence-only VOICE CRUD/state.
  const list = channels.LIST;
  const listItem = await rpc(owner.access_token, "app_feature_api", { p_action: "list/create", p_payload: { channel: list, title: "Original task", note: "one" } });
  await rpc(owner.access_token, "app_feature_api", { p_action: "list/save", p_payload: { channel: list, id: listItem.id, title: "Edited task", note: "two", done: true } });
  let feature = await rpc(owner.access_token, "app_feature_state", { p_channel: list });
  assert(feature.items.some((item) => item.id === listItem.id && item.title === "Edited task" && item.done));
  await rpc(owner.access_token, "app_feature_api", { p_action: "list/delete", p_payload: { channel: list, id: listItem.id } });
  feature = await rpc(owner.access_token, "app_feature_state", { p_channel: list });
  assert(!feature.items.some((item) => item.id === listItem.id));
  passed.push("LIST create/edit/refresh-read/delete");

  const docs = channels.DOCS;
  const doc = await rpc(owner.access_token, "app_feature_api", { p_action: "docs/create", p_payload: { channel: docs, title: "Original doc", body: "draft" } });
  await rpc(owner.access_token, "app_feature_api", { p_action: "docs/save", p_payload: { channel: docs, id: doc.id, title: "Edited doc", body: "saved content" } });
  feature = await rpc(owner.access_token, "app_feature_state", { p_channel: docs });
  assert(feature.docs.some((item) => item.id === doc.id && item.title === "Edited doc" && item.body === "saved content"));
  await rpc(owner.access_token, "app_feature_api", { p_action: "docs/delete", p_payload: { channel: docs, id: doc.id } });
  passed.push("DOCS create/edit/refresh-read/delete");

  const calendar = channels.CALENDAR;
  const starts = new Date(Date.now() + 86_400_000).toISOString();
  const event = await rpc(owner.access_token, "app_feature_api", { p_action: "calendar/create", p_payload: { channel: calendar, title: "Original event", starts_at: starts, description: "first" } });
  await rpc(owner.access_token, "app_feature_api", { p_action: "calendar/save", p_payload: { channel: calendar, id: event.id, title: "Edited event", starts_at: starts, description: "updated" } });
  await rpc(owner.access_token, "app_feature_api", { p_action: "calendar/rsvp", p_payload: { channel: calendar, id: event.id, status: "going" } });
  feature = await rpc(owner.access_token, "app_feature_state", { p_channel: calendar });
  assert(feature.events.some((item) => item.id === event.id && item.title === "Edited event" && item.rsvps.some((rsvp) => rsvp.status === "going")));
  await rpc(owner.access_token, "app_feature_api", { p_action: "calendar/delete", p_payload: { channel: calendar, id: event.id } });
  passed.push("CALENDAR event create/edit/RSVP/refresh-read/delete");

  const forum = channels.FORUM;
  const topic = await rpc(owner.access_token, "app_feature_api", { p_action: "forum/create", p_payload: { channel: forum, title: "Regression topic", body: "opening" } });
  await rpc(owner.access_token, "app_feature_api", { p_action: "forum/reply", p_payload: { channel: forum, topic: topic.id, body: "first reply" } });
  await rpc(member.access_token, "app_feature_api", { p_action: "forum/reply", p_payload: { channel: forum, topic: topic.id, body: "member reply before lock" } });
  await rpc(owner.access_token, "app_feature_api", { p_action: "forum/moderate", p_payload: { channel: forum, id: topic.id, pinned: true, locked: true } });
  feature = await rpc(owner.access_token, "app_feature_state", { p_channel: forum });
  assert(feature.topics.some((item) => item.id === topic.id && item.pinned && item.locked && item.reply_count === 2));
  await expectDenied(() => rpc(member.access_token, "app_feature_api", { p_action: "forum/reply", p_payload: { channel: forum, topic: topic.id, body: "locked reply" } }), "non-moderator reply to locked forum topic");
  passed.push("non-moderator locked forum reply rejected by live API");
  passed.push("FORUM topic/reply/pin/lock/refresh-read");

  const voice = channels.VOICE;
  await rpc(owner.access_token, "app_feature_api", { p_action: "voice/join", p_payload: { channel: voice } });
  await rpc(owner.access_token, "app_feature_api", { p_action: "voice/state", p_payload: { channel: voice, muted: true, deafened: true } });
  feature = await rpc(owner.access_token, "app_feature_state", { p_channel: voice });
  assert(feature.participants.some((item) => item.id && item.muted && item.deafened));
  await rpc(owner.access_token, "app_feature_api", { p_action: "voice/leave", p_payload: { channel: voice } });
  feature = await rpc(owner.access_token, "app_feature_state", { p_channel: voice });
  assert(!feature.participants.some((item) => item.id));
  passed.push("VOICE presence join/mute/deafen/leave; no audio claimed");

  // Verify the modified overview UI, viewport styling and its live data RPCs.
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.locator(".layout").waitFor();
  await page.locator(`.rail .orb[title="${serverName}"]`).click();
  await page.getByText("No upcoming events", { exact: true }).waitFor();
  assert.equal(await page.locator(".overview-about").count(), 1);
  await page.waitForFunction(() => {
    const text = document.querySelector(".overview-about")?.innerText || "";
    return /Created\s+\d/.test(text);
  }, null, { timeout: 5_000 });
  const aboutText = await page.locator(".overview-about").innerText();
  assert.match(aboutText, /Created\s+\d/, "About card should display the real server creation date");
  const activeIcon = page.locator(`.rail .orb[data-id="${serverId}"]`);
  const visual = await activeIcon.evaluate((el) => ({ shadow: getComputedStyle(el).boxShadow, outline: getComputedStyle(el).outlineStyle, root: getComputedStyle(document.documentElement).fontSize }));
  assert(visual.shadow.includes("rgba(255, 255, 255, 0.8)"));
  assert.equal(visual.outline, "none");
  assert.equal(visual.root, "16px");
  await page.screenshot({ path: "verification/live-overview-1280.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "verification/live-overview-390.png" });
  passed.push("overview About/date, empty Upcoming events, active rail ring, 16px root at 1280/390");

  // Test member sign-in and server membership through the browser after invite.
  const memberPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const memberErrors = [];
  memberPage.on("console", (message) => { if (message.type() === "error") memberErrors.push(message.text()); });
  memberPage.on("pageerror", (error) => memberErrors.push(error.message));
  await memberPage.goto(appUrl);
  await memberPage.evaluate(async (session) => {
    const client = window.supabase.createClient(window.CONSTELLATION_CONFIG.supabaseUrl, window.CONSTELLATION_CONFIG.supabasePublishableKey);
    const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (result.error) throw result.error;
  }, member);
  await memberPage.reload({ waitUntil: "networkidle" });
  await memberPage.locator(".layout").waitFor();
  await memberPage.locator(`.rail .orb[data-id="${serverId}"]`).waitFor();
  assert.equal(memberErrors.length, 0, memberErrors.join(" | "));
  passed.push("qa-member magic-link sign-in, server join and clean browser console");

  const dashboard = await rpc(admin.access_token, "staff_action", { p_action: "dashboard", p_payload: {} });
  const dashboardCounts = [dashboard.users, dashboard.servers, dashboard.messages_today, dashboard.open_reports, dashboard.suspended, dashboard.signups_7d];
  assert(dashboardCounts.every((count) => typeof count === "number"), "staff dashboard must return real numeric counts");
  const adminPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const adminErrors = [];
  adminPage.on("console", (message) => { if (message.type() === "error") adminErrors.push(message.text()); });
  adminPage.on("pageerror", (error) => adminErrors.push(error.message));
  await adminPage.goto(`${appUrl}/admin`);
  await adminPage.evaluate(async (session) => {
    const client = window.supabase.createClient(window.CONSTELLATION_CONFIG.supabaseUrl, window.CONSTELLATION_CONFIG.supabasePublishableKey);
    const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (result.error) throw result.error;
  }, admin);
  await adminPage.reload({ waitUntil: "networkidle" });
  await adminPage.locator(".staff-shell").waitFor();
  await adminPage.locator(".staff-stat").nth(5).waitFor();
  const shownCounts = await adminPage.locator(".staff-stat strong").allTextContents();
  assert.deepEqual(shownCounts.map(Number), dashboardCounts, "admin dashboard UI must display the exact live Supabase counts");
  await adminPage.screenshot({ path: "verification/live-admin-1280.png" });
  await adminPage.locator(".staff-nav [data-page='users']").click();
  const userSearch = adminPage.locator("form[data-staff-search='users']");
  await userSearch.locator("input[name='query']").fill("qa-owner");
  await userSearch.evaluate((form) => form.requestSubmit());
  await adminPage.locator(".staff-user-results").waitFor();
  assert.equal(await adminPage.locator(".staff-user-results").evaluate((el) => getComputedStyle(el).overflowY), "auto");
  await adminPage.locator(`.staff-user-results [data-staff-action='user'][data-id='${ownerState.user.id}']`).click();
  await adminPage.locator(".staff-detail").waitFor();
  await adminPage.locator(".staff-detail").getByText("QA Owner", { exact: true }).waitFor();
  await adminPage.locator(".staff-detail").getByText("Servers", { exact: true }).waitFor();
  const ownerStaffDetail = await rpc(admin.access_token, "staff_action", { p_action: "user/get", p_payload: { user_id: ownerState.user.id } });
  await adminPage.locator(".staff-detail").getByText(`${Number(ownerStaffDetail.reports) || 0} related report(s)`, { exact: true }).waitFor();
  assert((await adminPage.locator(".staff-detail").innerText()).includes("joined"), "user detail should show the account join date");
  await adminPage.screenshot({ path: "verification/live-admin-users-1280.png" });
  uiTestBadgeId = `qa-ui-${crypto.randomUUID().slice(0, 8)}`;
  await rpc(admin.access_token, "staff_action", { p_action: "badge/save", p_payload: { id: uiTestBadgeId, name: "QA UI Badge", position: 9001 } });
  await adminPage.locator(".staff-nav [data-page='users']").click();
  await adminPage.locator(`.staff-user-results [data-staff-action='user'][data-id='${ownerState.user.id}']`).click();
  await adminPage.locator(".staff-detail").waitFor();
  await adminPage.locator("#staff-badge-select").selectOption(uiTestBadgeId);
  await adminPage.locator(".staff-detail [data-staff-action='badge-grant']").click();
  await adminPage.locator(".staff-detail .staff-chip-list .staff-tag").filter({ hasText: uiTestBadgeId }).waitFor();
  await adminPage.locator(`.staff-detail button[aria-label='Revoke ${uiTestBadgeId}']`).click();
  await adminPage.locator(`.staff-detail button[aria-label='Revoke ${uiTestBadgeId}']`).waitFor({ state: "detached" });
  suspendedUserId = ownerState.user.id;
  await adminPage.locator("#staff-user-reason").fill("Temporary live UI suspension test");
  await adminPage.locator(".staff-detail [data-staff-action='user-suspend']").click();
  await adminPage.locator(".staff-detail .staff-reason").filter({ hasText: "Temporary live UI suspension test" }).waitFor();
  await adminPage.locator(".staff-detail [data-staff-action='user-unsuspend']").click();
  await adminPage.locator(".staff-detail .staff-tag").filter({ hasText: "Active" }).waitFor();
  assert.equal((await rpc(admin.access_token, "staff_action", { p_action: "user/get", p_payload: { user_id: ownerState.user.id } })).suspension, null);
  suspendedUserId = null;
  await rpc(admin.access_token, "staff_action", { p_action: "badge/delete", p_payload: { id: uiTestBadgeId } });
  uiTestBadgeId = null;
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await adminPage.waitForTimeout(220);
  assert.equal(await adminPage.evaluate(() => document.documentElement.scrollWidth), 390, "staff detail must fit a mobile viewport");
  await adminPage.screenshot({ path: "verification/live-admin-users-390.png" });
  await adminPage.locator(".staff-shell").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  assert(await adminPage.locator(".staff-shell").evaluate((el) => el.scrollTop > 0), "long staff detail page should remain scrollable on mobile");
  assert.equal(adminErrors.length, 0, adminErrors.join(" | "));
  passed.push("existing platform admin sees live dashboard counts and opens QA user detail; user list scrolls, mobile fits, empty console");

  await memberPage.goto(`${appUrl}/admin`, { waitUntil: "networkidle" });
  await memberPage.locator(".not-found").waitFor();
  assert.equal(memberErrors.length, 0, memberErrors.join(" | "));
  passed.push("non-staff /admin access resolves to the normal not-found page");
  await memberPage.close();

  if (browserErrors.length) throw Error(`QA owner browser console errors: ${browserErrors.join(" | ")}`);
  passed.push("qa-owner browser console empty");
} finally {
  if (suspendedUserId) await rpc(admin.access_token, "staff_action", { p_action: "user/suspend", p_payload: { user_id: suspendedUserId, enabled: false, reason: "Temporary UI regression cleanup" } }).catch(() => {});
  if (uiTestBadgeId) await rpc(admin.access_token, "staff_action", { p_action: "badge/delete", p_payload: { id: uiTestBadgeId } }).catch(() => {});
  if (browser) await browser.close();
  if (storagePath) {
    await fetch(`${supabaseUrl}/storage/v1/object/attachments/${storagePath}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    }).catch(() => {});
  }
  if (serverId) {
    await rpc(owner.access_token, "app_api", { p_action: "server/delete", p_payload: { server: serverId } }).catch(() => {});
  }
}
for (const item of passed) console.log(`PASS ${item}`);
for (const item of blocked) console.log(`BLOCKED ${item}`);
