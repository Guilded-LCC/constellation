// Database-level regression checks. Never use a service-role key in this script.
const url = "https://hyongvpfhikiibgdlkgw.supabase.co";
const publishable = process.env.CONSTELLATION_PUBLISHABLE_KEY || "";
async function call(token, rpc, payload) {
  return fetch(`${url}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      apikey: publishable,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

if (!process.env.CONSTELLATION_MEMBER_TOKEN) {
  console.log("security script ready; set authenticated QA tokens to run checks");
} else {
  const denied = await call(process.env.CONSTELLATION_MEMBER_TOKEN, "app_feature_api", {
    p_action: "staff/badge",
    p_payload: { user: crypto.randomUUID(), badge: "staff" },
  });
  if (denied.ok) throw Error("Non-staff feature RPC unexpectedly succeeded");
  console.log("PASS non-staff staff RPC rejected");
}

const staffActions = [
  "dashboard", "users/search", "user/get", "user/badge", "user/suspend",
  "servers/search", "server/get", "server/flags", "server/suspend",
  "reports", "report/update", "staff/list", "staff/set", "badges/list",
  "badge/save", "badge/delete", "audit",
];
for (const [label, token] of [
  ["member", process.env.CONSTELLATION_MEMBER_TOKEN],
  ["server owner", process.env.CONSTELLATION_OWNER_TOKEN],
]) {
  if (!token) continue;
  for (const action of staffActions) {
    const response = await call(token, "staff_action", {
      p_action: action,
      p_payload: {},
    });
    if (response.ok)
      throw Error(`${label} unexpectedly accessed staff RPC ${action}`);
  }
  console.log(`PASS ${label} blocked from ${staffActions.length} staff actions`);
  for (const table of [
    "platform_staff", "staff_badges", "profile_badges", "user_suspensions", "server_suspensions",
    "staff_reports", "staff_audit",
  ]) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: publishable,
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.ok) throw Error(`${label} unexpectedly read ${table}`);
  }
  console.log(`PASS ${label} blocked from staff tables`);
}

// Storage fixtures are deliberately supplied as IDs from the reusable QA accounts;
// each case exercises the real Storage RLS policy, not a client-side permission check.
const cases = [
  ["owner", "CONSTELLATION_OWNER_TOKEN", true],
  ["administrator", "CONSTELLATION_ADMIN_ROLE_TOKEN", true],
  ["member without upload_media", "CONSTELLATION_MEMBER_DENIED_TOKEN", false],
  ["member with upload_media", "CONSTELLATION_MEMBER_ALLOWED_TOKEN", true],
];
for (const [label, tokenEnv, shouldPass] of cases) {
  const token = process.env[tokenEnv];
  if (!token) continue;
  const channel = process.env[`${tokenEnv}_CHANNEL`];
  if (!channel) throw Error(`Missing ${tokenEnv}_CHANNEL test fixture`);
  const path = `channels/${channel}/security-${crypto.randomUUID()}.txt`;
  const response = await fetch(`${url}/storage/v1/object/attachments/${path}`, {
    method: "POST",
    headers: {
      apikey: publishable,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
      "x-upsert": "false",
    },
    body: `security regression ${label}`,
  });
  if (response.ok !== shouldPass)
    throw Error(`${label} upload expected ${shouldPass ? "pass" : "deny"}, got ${response.status}`);
  console.log(`PASS ${label} upload ${shouldPass ? "allowed" : "rejected"}`);
}
