import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3100/login", { waitUntil: "networkidle" });
if (page.url().includes("login")) {
  await page.locator("#password").fill("test-password");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.includes("login"));
}
await page.waitForTimeout(1500);
const wide = await page.evaluate(() => {
  const out = [];
  const vw = document.documentElement.clientWidth;
  document.querySelectorAll("*").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 4) {
      out.push(`${el.tagName}.${String(el.className).slice(0, 90)} → ${Math.round(r.width)}px`);
    }
  });
  return { vw, scrollW: document.documentElement.scrollWidth, wide: out.slice(0, 12) };
});
console.log(JSON.stringify(wide, null, 1));
await browser.close();
