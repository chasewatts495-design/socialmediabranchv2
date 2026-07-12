/**
 * Console-error + long-task sweep: visits every section at both viewports,
 * fails loudly on any browser console error/warning or uncaught exception,
 * and reports main-thread long tasks (>50ms) on the animated pages.
 */
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";

const exe = existsSync("/opt/pw-browsers/chromium")
  ? { executablePath: "/opt/pw-browsers/chromium" }
  : {};
const BASE = process.env.BASE || "http://localhost:3100";
const PAGES = [
  "/",
  "/composer",
  "/trends",
  "/calendar",
  "/calendar?tab=queue",
  "/calendar?tab=recycle",
  "/library",
  "/strategist",
  "/connections",
  "/connections/reddit",
  "/connections/pinterest",
  "/connections/instagram",
  "/connections/youtube",
  "/settings",
];

const browser = await chromium.launch(exe);
const problems = [];

for (const [name, vp] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      const text = msg.text();
      // Next dev-tools/CSP noise filters: none expected in prod build.
      problems.push(`[${name}] console.${msg.type()} @ ${page.url()}: ${text.slice(0, 200)}`);
    }
  });
  page.on("pageerror", (err) => {
    problems.push(`[${name}] pageerror @ ${page.url()}: ${String(err).slice(0, 200)}`);
  });

  // login
  await page.goto(`${BASE}/login`);
  await page.locator("#password").fill("test-password");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${BASE}/`);

  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
  }

  // Long-task probe on the dashboard (globe + charts animating).
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const longTasks = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const tasks = [];
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) tasks.push(Math.round(e.duration));
        });
        obs.observe({ type: "longtask", buffered: true });
        setTimeout(() => {
          obs.disconnect();
          resolve(tasks);
        }, 4000);
      }),
  );
  console.log(`[${name}] long tasks during 4s of dashboard animation:`, longTasks);

  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log("PROBLEMS:");
  for (const p of problems) console.log(" -", p);
  process.exit(1);
}
console.log("CLEAN: no console errors/warnings or page errors across", PAGES.length, "pages × 2 viewports");
