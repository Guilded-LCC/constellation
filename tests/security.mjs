// Live security regression over Supabase HTTPS. The service-role key is used
// only to mint short-lived QA sessions and clean disposable test artifacts.
import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env"); } catch {}
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw Error("Set Supabase HTTPS credentials in the local .env.");

async function session(email) {
  const created = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!created.ok) throw Error(`Could not create a QA session for ${email} (HTTP ${created.status}).`);
  const link = await created.json();
  const verified = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ token_hash: link.hashed_token, type: "magiclink" }),
  });
  if (!verified.ok) throw Error(`Could not verify a QA session for ${email} (HTTP ${verified.status}).`);
  return verified.json();
}
async function rpc(token, name, args = {}) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Error(`${name} rejected (HTTP ${response.status}): ${body?.message || "request rejected"}`);
  return body;
}
async function request(token, path, options = {}) {
  return fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: anon, Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
}
async function rejected(fn, label) {
  let denied = false;
  try { await fn(); } catch { denied = true; }
  assert(denied, `${label} must be rejected by Supabase`);
}
async function upload(token, channel, label, remember) {
  const path = `channels/${channel}/security-${label}-${crypto.randomUUID()}.txt`;
  const response = await request(token, `/storage/v1/object/attachments/${path}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "x-upsert": "false" },
    body: `security regression ${label}`,
  });
  if (response.ok) remember.push(path);
  return response;
}

const owner = await session("qa-owner@guilded.local");
const member = await session("qa-member@guilded.local");
const admin = await session("admin@guilded.info");
const ownerState = await rpc(owner.access_token, "app_state");
const memberState = await rpc(member.access_token, "app_state");
const adminState = await rpc(admin.access_token, "app_state");
let serverId = null;
let reportId = null;
const uploadedPaths = [];
const badgeId = `qa-security-${crypto.randomUUID().slice(0, 8)}`;
const staffActions = [
  "dashboard", "users/search", "user/get", "user/badge", "user/suspend",
  "servers/search", "server/get", "server/flags", "server/suspend",
  "reports", "report/update", "staff/list", "staff/set", "badges/list",
  "badge/save", "badge/delete", "audit",
];
try {
  for (const [label, identity, token] of [
    ["normal user", memberState.user, member.access_token],
    ["server owner", ownerState.user, owner.access_token],
  ]) {
    for (const action of staffActions) {
      await rejected(() => rpc(token, "staff_action", { p_action: action, p_payload: {} }), `${label} staff_action(${action})`);
    }
    for (const table of ["platform_staff", "staff_badges", "profile_badges", "user_suspensions", "server_suspensions", "staff_reports", "staff_audit"]) {
      const response = await request(token, `/rest/v1/${table}?select=*`);
      assert(!response.ok, `${label} must not read ${table}`);
    }
    const write = await request(token, "/rest/v1/platform_staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ user_id: identity.id, level: "staff" }),
    });
    assert(!write.ok, `${label} must not write platform_staff`);
  }
  console.log(`PASS member and server owner denied all ${staffActions.length} staff RPCs, staff tables and platform_staff writes`);

  const dashboard = await rpc(admin.access_token, "staff_action", { p_action: "dashboard", p_payload: {} });
  for (const key of ["users", "servers", "messages_today", "open_reports", "suspended", "signups_7d"]) {
    assert.equal(typeof dashboard[key], "number", `admin dashboard ${key} must be a real numeric count`);
  }
  console.log("PASS platform admin receives real dashboard counts");

  const created = await rpc(owner.access_token, "app_api", { p_action: "server/create", p_payload: { name: `Security QA ${Date.now()}` } });
  serverId = created.id;
  const currentOwner = await rpc(owner.access_token, "app_state");
  const server = currentOwner.servers.find((item) => item.id === serverId);
  const channel = server?.channels.find((item) => item.type === "TEXT");
  assert(channel, "isolated security channel must exist");
  const invite = await rpc(owner.access_token, "app_api", { p_action: "server/invite", p_payload: { server: serverId } });
  await rpc(member.access_token, "app_api", { p_action: "server/join", p_payload: { code: invite.code } });
  assert((await upload(owner.access_token, channel.id, "owner", uploadedPaths)).ok, "server owner upload should pass");

  const adminRole = {
    id: crypto.randomUUID(), name: "Security Administrator", color: "#f5c400", color2: "", emoji: "",
    permissions: ["administrator"], position: Math.max(...server.roles.map((role) => role.position)) + 1,
    icon_url: "", self_assignable: false, mentionable: false, hoist: false, gradient_angle: 90,
  };
  await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: [...server.roles, adminRole] });
  await rpc(owner.access_token, "app_api", { p_action: "member/role", p_payload: { server: serverId, user: memberState.user.id, role: adminRole.id, enabled: true } });
  assert((await upload(member.access_token, channel.id, "administrator", uploadedPaths)).ok, "Administrator upload should pass");
  await rpc(owner.access_token, "app_api", { p_action: "member/role", p_payload: { server: serverId, user: memberState.user.id, role: adminRole.id, enabled: false } });
  const baseRole = server.roles.find((role) => role.position === 0);
  const withoutUpload = server.roles.map((role) => role.id === baseRole.id ? { ...role, permissions: role.permissions.filter((value) => value !== "upload_media") } : role);
  await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: withoutUpload });
  const deniedUpload = await upload(member.access_token, channel.id, "member-denied", uploadedPaths);
  const deniedUploadReason = await deniedUpload.text();
  assert.match(deniedUploadReason, /row.level security|policy|unauthorized/i, "member upload must be rejected by the Storage policy");
  const withUpload = withoutUpload.map((role) => role.id === baseRole.id ? { ...role, permissions: [...role.permissions, "upload_media"] } : role);
  await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: withUpload });
  assert((await upload(member.access_token, channel.id, "member-allowed", uploadedPaths)).ok, "member with upload_media should pass Storage RLS");
  await rpc(owner.access_token, "app_roles_save", { p_server: serverId, p_roles: server.roles });
  console.log("PASS Storage RLS: owner and Administrator allowed; member denied then allowed by upload_media permission");

  const report = await rpc(member.access_token, "staff_action", { p_action: "report/create", p_payload: { target_user: ownerState.user.id, server_id: serverId, reason: "QA security report cleanup" } });
  reportId = report.id;
  const serverBefore = await rpc(admin.access_token, "staff_action", { p_action: "server/get", p_payload: { server_id: serverId } });
  const auditActions = [];
  const invoke = async (action, payload = {}) => { const result = await rpc(admin.access_token, "staff_action", { p_action: action, p_payload: payload }); auditActions.push(action); return result; };
  await invoke("users/search", { query: "qa-owner" });
  const detail = await invoke("user/get", { user_id: ownerState.user.id });
  assert.equal(detail.profile.id, ownerState.user.id);
  await invoke("badge/save", { id: badgeId, name: "QA Security Badge", position: 9000 });
  await invoke("user/badge", { user_id: memberState.user.id, badge: badgeId, enabled: true });
  await invoke("user/badge", { user_id: memberState.user.id, badge: badgeId, enabled: false });
  await invoke("servers/search", { query: "Security QA" });
  await invoke("server/flags", { server_id: serverId, verified: serverBefore.server.verified, partner: serverBefore.server.partner });
  await invoke("server/suspend", { server_id: serverId, enabled: true, reason: "temporary security test" });
  await invoke("server/suspend", { server_id: serverId, enabled: false, reason: "temporary security test cleanup" });
  await invoke("reports", { status: "open" });
  await invoke("report/update", { report_id: reportId, status: "dismissed", internal_notes: "QA test cleanup" });
  await invoke("staff/list");
  await invoke("staff/set", { user_id: memberState.user.id, enabled: true, level: "staff" });
  await invoke("staff/set", { user_id: memberState.user.id, enabled: false });
  await invoke("badges/list");
  await invoke("badge/delete", { id: badgeId });
  await invoke("server/get", { server_id: serverId });
  await invoke("user/suspend", { user_id: memberState.user.id, enabled: true, reason: "temporary security test" });
  await rejected(() => rpc(member.access_token, "app_api", { p_action: "message/send", p_payload: { channel: channel.id, body: "suspended user must not send" } }), "suspended member message insert");
  const suspendedUpload = await upload(member.access_token, channel.id, "suspended", uploadedPaths);
  const suspendedUploadReason = await suspendedUpload.text();
  assert.match(suspendedUploadReason, /row.level security|policy|unauthorized/i, "suspended member upload must be denied by Storage RLS");
  await invoke("user/suspend", { user_id: memberState.user.id, enabled: false, reason: "temporary security test cleanup" });
  await invoke("dashboard");
  const audit = await invoke("audit");
  const audited = new Set(audit.filter((row) => row.actor === adminState.user.id).map((row) => row.action));
  for (const action of auditActions) assert(audited.has(action), `staff_action(${action}) must write a staff_audit row`);
  console.log(`PASS admin staff RPCs audit all ${auditActions.length} tested action types`);
  console.log("PASS suspension blocks message insert and attachment upload at Supabase");
} finally {
  const cleanupErrors = [];
  const cleanupStep = async (label, action) => {
    try {
      const result = await action();
      if (result instanceof Response && !result.ok) {
        const detail = await result.text().catch(() => "");
        throw Error(`HTTP ${result.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`);
      }
    } catch (error) {
      cleanupErrors.push(`${label}: ${error.message}`);
    }
  };

  await cleanupStep("remove temporary member suspension", () => rpc(admin.access_token, "staff_action", {
    p_action: "user/suspend",
    p_payload: { user_id: memberState.user.id, enabled: false, reason: "temporary security test cleanup" },
  }));
  await cleanupStep("remove temporary staff assignment", () => rpc(admin.access_token, "staff_action", {
    p_action: "staff/set", p_payload: { user_id: memberState.user.id, enabled: false },
  }));
  if (serverId) await cleanupStep("remove temporary server suspension", () => rpc(admin.access_token, "staff_action", {
    p_action: "server/suspend", p_payload: { server_id: serverId, enabled: false, reason: "temporary security test cleanup" },
  }));

  // Delete references to the disposable server before deleting that server.
  if (reportId) await cleanupStep("delete temporary security report", () => fetch(`${url}/rest/v1/staff_reports?id=eq.${reportId}`, {
    method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` },
  }));
  await cleanupStep("remove temporary badge assignments", () => fetch(`${url}/rest/v1/profile_badges?badge=eq.${badgeId}`, {
    method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` },
  }));
  await cleanupStep("remove temporary badge", () => fetch(`${url}/rest/v1/staff_badges?id=eq.${badgeId}`, {
    method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` },
  }));
  for (const path of uploadedPaths) await cleanupStep("remove uploaded security fixture", () => fetch(`${url}/storage/v1/object/attachments/${path}`, {
    method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` },
  }));
  if (serverId) await cleanupStep("delete temporary security server", () => rpc(owner.access_token, "app_api", {
    p_action: "server/delete", p_payload: { server: serverId },
  }));
  if (cleanupErrors.length) throw Error(`Security test cleanup incomplete:\n${cleanupErrors.join("\n")}`);
}
