import pg from "pg";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../verification/", import.meta.url));
const adminEmail = process.env.CONSTELLATION_ADMIN_EMAIL || "admin@constellation.example";
const fixture = JSON.parse(await fs.readFile(root + "fixture.json", "utf8"));
if (fixture.cleaned) {
  console.log("Verification fixtures already cleaned.");
  process.exit(0);
}
const client = new pg.Client({
  connectionString: process.env.CONSTELLATION_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
const url = process.env.SUPABASE_URL,
  key = process.env.CONSTELLATION_ADMIN_KEY;
try {
  await client.connect();
  const ids = [fixture.user, fixture.guest].filter(Boolean),
    servers = fixture.servers || [];
  const users = (
    await client.query(
      "select id,email from auth.users where id=any($1::uuid[])",
      [ids],
    )
  ).rows;
  for (const user of users)
    if (
      ![fixture.email, fixture.guestEmail].includes(user.email) ||
      !/^phase-(verify|guest)-\d+@example\.invalid$/.test(user.email)
    )
      throw Error(
        "Refusing to delete an account outside the disposable verification set",
      );
  const targets = (
    await client.query(
      "select id,name,owner from public.servers where id=any($1::uuid[])",
      [servers],
    )
  ).rows;
  for (const target of targets)
    if (
      !["UI Verification Lab", "Fresh Verification Lab"].includes(target.name)
    )
      throw Error("Refusing to delete an unexpected server");
  const keptBefore = (
    await client.query(
      "select u.id,p.id profile_id,(select count(*) from public.servers s where s.owner=u.id and not(s.id=any($1::uuid[]))) servers from auth.users u join public.profiles p on p.id=u.id where u.email='" + adminEmail + "'",
      [servers],
    )
  ).rows;
  if (keptBefore.length !== 1)
    throw Error("Existing account preservation check failed");
  const preservedDataSQL =
    "select md5(jsonb_build_object('servers',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from servers s where not(s.id=any($1::uuid[]))),'channels',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from channels c where not(c.server_id=any($1::uuid[]))),'roles',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from roles r where not(r.server_id=any($1::uuid[]))),'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') from messages m left join channels c on c.id=m.channel_id where c.id is null or not(c.server_id=any($1::uuid[]))))::text) fingerprint";
  const preservedDataBefore = (await client.query(preservedDataSQL, [servers]))
    .rows[0].fingerprint;
  const objects = (
    await client.query(
      "select name from storage.objects where bucket_id='community-media' and split_part(name,'/',1)='servers' and split_part(name,'/',2)=any($1::text[])",
      [servers],
    )
  ).rows.map((x) => x.name);
  for (let offset = 0; offset < objects.length; offset += 100) {
    const response = await fetch(url + "/storage/v1/object/community-media", {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: objects.slice(offset, offset + 100) }),
    });
    if (!response.ok)
      throw Error(
        "Unable to remove disposable uploaded objects: " + response.status,
      );
  }
  await client.query("begin");
  await client.query("delete from public.servers where id=any($1::uuid[])", [
    servers,
  ]);
  await client.query("delete from public.profiles where id=any($1::uuid[])", [
    ids,
  ]);
  await client.query("commit");
  for (const user of users) {
    const response = await fetch(url + "/auth/v1/admin/users/" + user.id, {
      method: "DELETE",
      headers: { apikey: key, Authorization: "Bearer " + key },
    });
    if (!response.ok)
      throw Error("Unable to remove disposable Auth user: " + response.status);
  }
  const keptAfter = (
    await client.query(
      "select u.id,p.id profile_id,(select count(*) from public.servers s where s.owner=u.id) servers from auth.users u join public.profiles p on p.id=u.id where u.email='" + adminEmail + "'",
    )
  ).rows;
  if (JSON.stringify(keptAfter) !== JSON.stringify(keptBefore))
    throw Error("Preservation verification failed");
  if (
    (await client.query(preservedDataSQL, [servers])).rows[0].fingerprint !==
    preservedDataBefore
  )
    throw Error(
      "Pre-existing server/channel/role/message preservation check failed",
    );
  const remaining = (
    await client.query(
      "select (select count(*) from auth.users where id=any($1::uuid[])) users,(select count(*) from public.profiles where id=any($1::uuid[])) profiles,(select count(*) from public.servers where id=any($2::uuid[])) servers",
      [ids, servers],
    )
  ).rows[0];
  const missing = (
    await client.query(
      "select count(*) from auth.users u left join public.profiles p on p.id=u.id where p.id is null",
    )
  ).rows[0].count;
  fixture.cleaned = new Date().toISOString();
  await fs.writeFile(root + "fixture.json", JSON.stringify(fixture, null, 2));
  const report = {
    removed: {
      accounts: users.length,
      servers: targets.length,
      storageObjects: objects.length,
    },
    remaining,
    existingAccountPreserved: true,
    existingServersPreserved: true,
    existingChannelsRolesMessagesPreserved: true,
    missingProfiles: Number(missing),
  };
  await fs.writeFile(
    root + "cleanup-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await client.end();
}
