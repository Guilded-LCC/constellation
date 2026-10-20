import pg from "pg";
import fs from "node:fs/promises";
const client = new pg.Client({
  connectionString: process.env.CONSTELLATION_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  if (process.argv[2] === "--query")
    console.log(
      JSON.stringify((await client.query(process.argv[3])).rows, null, 2),
    );
  else if (process.argv[2]) {
    await client.query(await fs.readFile(process.argv[2], "utf8"));
    console.log("Migration applied:", process.argv[2]);
  } else {
    for (const sql of [
      "select table_name,column_name,data_type from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
      "select n.nspname, p.proname, pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('app_api','app_hierarchy','app_messages','app_has')) or (n.nspname='constellation_private' and p.proname='app_api')",
      "select schemaname,tablename,policyname,cmd,qual,with_check from pg_policies where schemaname in ('public','storage')",
    ])
      console.log(JSON.stringify((await client.query(sql)).rows, null, 2));
  }
} finally {
  await client.end();
}
