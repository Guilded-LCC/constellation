import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = await readFile(path.join(root, ".env"), "utf8");
for (const line of envFile.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match || process.env[match[1]]) continue;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  process.env[match[1]] = value;
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL is missing from .env");
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

function safeError(error) {
  return String(error?.message || error || "Database operation failed")
    .replaceAll(connectionString, "[redacted connection string]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted connection string]")
    .replace(/(password\s*[=:]\s*)\S+/gi, "$1[redacted]");
}

try {
  await client.connect();
  const version = await client.query("select version();");
  console.log(`Connected: ${version.rows[0].version}`);
  if (process.argv.includes("--check")) process.exit(0);

  await client.query(`create table if not exists public._applied_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);

  const files = (await readdir(path.join(root, "supabase", "migrations")))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  // Seed the private runner ledger from Supabase CLI history so old migrations
  // already deployed to this database are not replayed against live objects.
  const historyExists = await client.query("select to_regclass('supabase_migrations.schema_migrations') is not null as present");
  if (historyExists.rows[0].present) {
    const history = await client.query("select version::text from supabase_migrations.schema_migrations");
    const versions = new Set(history.rows.map((row) => row.version));
    for (const name of files) {
      const versionMatch = name.match(/^(\d{14})_/);
      if (versionMatch && versions.has(versionMatch[1])) {
        await client.query("insert into public._applied_migrations(name) values($1) on conflict(name) do nothing", [name]);
      }
    }
  }

  // A renamed migration keeps its version prefix, so a ledger row with the same
  // prefix means the file was already applied under its previous name.
  const applied = await client.query("select name from public._applied_migrations");
  const appliedVersions = new Set(
    applied.rows.map((row) => (row.name.match(/^(\d{14})_/) || [])[1]).filter(Boolean),
  );
  for (const name of files) {
    const versionMatch = name.match(/^(\d{14})_/);
    if (versionMatch && appliedVersions.has(versionMatch[1])) {
      await client.query("insert into public._applied_migrations(name) values($1) on conflict(name) do nothing", [name]);
    }
  }

  for (const name of files) {
    const known = await client.query("select 1 from public._applied_migrations where name=$1", [name]);
    if (known.rowCount) {
      console.log(`SKIP ${name}`);
      continue;
    }
    const sql = await readFile(path.join(root, "supabase", "migrations", name), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public._applied_migrations(name) values($1)", [name]);
      await client.query("commit");
      console.log(`APPLIED ${name}`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Migration ${name} failed: ${safeError(error)}`);
    }
  }

  const admins = await client.query("select user_id, level from public.platform_staff order by user_id");
  const migrations = await client.query("select name, applied_at from public._applied_migrations order by name");
  console.log("platform_staff:");
  console.log(JSON.stringify(admins.rows, null, 2));
  console.log("applied_migrations:");
  console.log(JSON.stringify(migrations.rows, null, 2));
} catch (error) {
  console.error(safeError(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
