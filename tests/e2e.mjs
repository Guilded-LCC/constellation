// Verifies the real signed-out /admin access boundary in Chromium.
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
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(`${url}/admin`, { waitUntil: "networkidle" });
if (!(await page.getByRole("heading", { name: "This page does not exist" }).count())) {
  await browser.close();
  throw Error("A signed-out visitor should get the normal not-found page at /admin");
}
await page.screenshot({ path: path.join(output, "phase-c-admin-denied-1280.png") });
await page.setViewportSize({ width: 390, height: 800 });
await page.screenshot({ path: path.join(output, "phase-c-admin-denied-390.png") });
await browser.close();

if (errors.length) throw Error(`Browser console errors: ${errors.join(" | ")}`);
console.log("signed-out /admin access boundary passed");
