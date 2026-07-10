import { expect, type Page } from "@playwright/test";

export const PASSWORD = "test-password";

export async function login(page: Page) {
  await page.goto("/login");
  // Gate disabled → already redirected to the dashboard.
  if (!page.url().includes("/login")) return;
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await expect(page.locator("h1")).toContainText("Dashboard");
}

export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}
