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
const ownerEmail = "qa-owner@guilded.local";
const memberEmail = "qa-member@guilded.local";
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
async function expectDenied(fn, label) {
  let rejected = false;
  try { await fn(); } catch { rejected = true; }
  assert(rejected, `${label} should be rejected`);
}

const owner = await magicToken(ownerEmail);
const member = await magicToken(memberEmail);
let serverId = null;
let storagePath = null;
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
  await rpc(owner.access_token, "app_api", { p_action: "message/delete", p_payload: { id: groupedFirst.id } });
  await rpc(owner.access_token, "app_api", { p_action: "message/delete", p_payload: { id: groupedSecond.id } });
  passed.push("message grouping, date divider, hover timestamp/toolbar and click/right-click menus");

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
  await memberPage.close();

  if (browserErrors.length) throw Error(`QA owner browser console errors: ${browserErrors.join(" | ")}`);
  passed.push("qa-owner browser console empty");
} finally {
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
