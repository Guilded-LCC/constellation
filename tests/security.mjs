// Database-level negative RPC check. Supply a non-staff qa member JWT to execute it.
if (!process.env.CONSTELLATION_MEMBER_TOKEN) {
  console.log(
    "security script ready; set CONSTELLATION_MEMBER_TOKEN for authenticated negative RPC checks",
  );
  process.exit(0);
}
const url = "https://hyongvpfhikiibgdlkgw.supabase.co";
const response = await fetch(`${url}/rest/v1/rpc/app_feature_api`, {
  method: "POST",
  headers: {
    apikey: process.env.CONSTELLATION_PUBLISHABLE_KEY || "",
    Authorization: `Bearer ${process.env.CONSTELLATION_MEMBER_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    p_action: "staff/badge",
    p_payload: { user: crypto.randomUUID(), badge: "staff" },
  }),
});
if (response.ok) throw Error("Non-staff feature RPC unexpectedly succeeded");
console.log("negative staff RPC rejected", response.status);
