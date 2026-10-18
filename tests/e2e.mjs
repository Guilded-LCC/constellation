// Focused browser smoke test. Full authenticated flows reuse qa-owner and qa-member.
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const url = process.env.CONSTELLATION_URL || "http://localhost:8766";
const output = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../verification",
);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on(
  "console",
  (message) =>
    message.type() === "error" &&
    !/401/.test(message.text()) &&
    errors.push(message.text()),
);
page.on("pageerror", (error) => errors.push(error.message));
if (process.env.CONSTELLATION_ADMIN_KEY) {
  const response = await fetch(
    "https://hyongvpfhikiibgdlkgw.supabase.co/auth/v1/admin/generate_link",
    {
      method: "POST",
      headers: {
        apikey: process.env.CONSTELLATION_ADMIN_KEY,
        Authorization: `Bearer ${process.env.CONSTELLATION_ADMIN_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "magiclink",
        email: "admin@guilded.info",
        options: { redirectTo: url },
      }),
    },
  );
  const link = (await response.json()).action_link;
  if (!response.ok || !link)
    throw Error("Could not create the existing-account magic link");
  await page.goto(link, { waitUntil: "networkidle" });
}
await page.goto(url, { waitUntil: "networkidle" });
if (process.env.CONSTELLATION_QA_PASSWORD) {
  await page.fill("#email", "qa-owner@guilded.local");
  await page.fill("#password", process.env.CONSTELLATION_QA_PASSWORD);
  await page.locator("#auth-form button[type=submit]").click();
  await page.waitForTimeout(800);
  errors.length = 0;
}
if (!process.env.CONSTELLATION_ADMIN_KEY && !process.env.CONSTELLATION_QA_PASSWORD) {
  await page.goto(`${url}/admin`, { waitUntil: "networkidle" });
  if (!(await page.getByText("This page does not exist").count()))
    throw Error("A signed-out visitor should receive the normal not-found page at /admin");
  await page.screenshot({ path: path.join(output, "phase-c-access-denied-1280.png") });
  await page.evaluate(() => window.renderStaffPage({
    user: { id: "ui-preview", name: "Staff Preview", is_platform_staff: true, is_platform_admin: true },
    rpc: async (_name, args) => {
      const action = args.p_action;
      if (action === "dashboard") return { users: 24, servers: 7, messages_today: 132, open_reports: 2, suspended: 1, signups_7d: 4, activity: [] };
      if (action === "users/search" || action === "servers/search" || action === "reports" || action === "audit") return [];
      if (action === "badges/list") return [{ id: "staff", name: "Staff", position: 0 }];
      if (action === "staff/list") return [];
      return {};
    },
  }));
  await page.waitForSelector(".staff-shell");
  await page.locator('[data-staff-action="nav"][data-page="users"]').click();
  await page.getByRole("heading", { name: "Users" }).waitFor();
  await page.locator('[data-staff-action="nav"][data-page="dashboard"]').click();
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  await page.screenshot({ path: path.join(output, "phase-c-dashboard-preview-1280.png") });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.screenshot({ path: path.join(output, "phase-c-dashboard-preview-390.png") });
  await page.goto(`${url}/admin`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(output, "phase-c-access-denied-390.png") });
  await browser.close();
  if (errors.length) throw Error(`Browser console errors: ${errors.join(" | ")}`);
  console.log("anonymous /admin access boundary passed");
  process.exit(0);
}
await page.screenshot({
  path: path.join(output, "phase-current-1280.png"),
});
await page.setViewportSize({ width: 390, height: 800 });
await page.screenshot({
  path: path.join(output, "phase-current-390.png"),
});
await browser.close();
if (errors.length) throw Error(`Browser console errors: ${errors.join(" | ")}`);
console.log("e2e smoke passed");
