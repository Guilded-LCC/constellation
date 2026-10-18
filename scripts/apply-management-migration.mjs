import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env"); } catch {}

const migrationName = process.argv[2];
const accessToken = process.env.access_key || process.env.SUPABASE_ACCESS_TOKEN;
const projectUrl = process.env.SUPABASE_URL;
if (!migrationName || path.basename(migrationName) !== migrationName || !accessToken || !projectUrl) {
  throw Error("Provide one migration filename and configure the local Supabase Management access key and project URL.");
}

const projectRef = new URL(projectUrl).hostname.split(".")[0];
const sql = await readFile(path.join("supabase", "migrations", migrationName), "utf8");
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

if (!response.ok) {
  console.error(`Supabase Management API rejected the migration (HTTP ${response.status}); no credential was displayed.`);
  process.exitCode = 1;
} else {
  console.log(`Applied ${migrationName} through the Supabase HTTPS Management API.`);
}
