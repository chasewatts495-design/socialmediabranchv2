/**
 * Dev helper: screenshots a route at mobile (390px) and desktop (1440px).
 * Usage: BASE=http://localhost:3050 PATHNAME=/ PREFIX=dash OUT=./shots node scripts/screenshot.mjs
 */
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";

const exe = existsSync("/opt/pw-browsers/chromium")
  ? { executablePath: "/opt/pw-browsers/chromium" }
  : {};
const browser = await chromium.launch(exe);
const base = process.env.BASE || "http://localhost:3000";
const out = process.env.OUT || "./shots";
mkdirSync(out, { recursive: true });
for (const [name, vp] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto(base + (process.env.PATHNAME || "/"), { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${process.env.PREFIX || "shot"}-${name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log("done");
