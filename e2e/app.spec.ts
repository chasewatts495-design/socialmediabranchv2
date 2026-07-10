import { expect, test } from "@playwright/test";
import { isMobile, login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("password gate blocks wrong password and accepts the right one", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#password").fill("wrong-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("text=Wrong password")).toBeVisible();
  await login(page);
});

test("responsive shell: sidebar on desktop, bottom tabs on mobile", async ({ page }) => {
  await login(page);
  const sidebar = page.getByTestId("sidebar-nav");
  const tabBar = page.getByTestId("bottom-tab-bar");
  if (isMobile(page)) {
    await expect(tabBar).toBeVisible();
    await expect(sidebar).toBeHidden();
  } else {
    await expect(sidebar).toBeVisible();
    await expect(tabBar).toBeHidden();
  }
  // No horizontal page scroll at either viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("dashboard shows unified analytics from seeded data", async ({ page }) => {
  await login(page);
  await expect(page.locator("text=Total followers").first()).toBeVisible();
  await expect(page.getByTestId("follower-trend")).toBeVisible();
  await expect(page.getByTestId("engagement-bars")).toBeVisible();
  // Range toggle changes the query param.
  await page.locator('a:has-text("7d")').first().click();
  await page.waitForURL(/range=7/);
  await expect(page.locator("text=last 7 days").first()).toBeVisible();
});

test("composer walks the branch stepper and publishes to multiple accounts", async ({ page }) => {
  await login(page);
  await page.goto("/composer");
  await expect(page.getByTestId("branch-progress")).toBeVisible();

  const next = () =>
    page
      .locator('[data-testid="step-next"]:visible, .fixed button:has-text("Next")')
      .first()
      .click();

  // Step 1: Media — pick the first asset.
  await page.locator('section:has-text("Pick your media") button').first().click();
  await next();
  // Step 2: Caption.
  await page
    .getByTestId("master-caption")
    .fill(`E2E multi-post ${Date.now()} — hello from the test suite`);
  await next();
  // Step 3: Accounts — Instagram + Facebook + TikTok.
  for (const p of ["instagram", "facebook", "tiktok"]) {
    await page.locator(`[data-testid^="account-toggle-${p}-"]`).first().click();
  }
  await next();
  // Step 4: Fine-tune (auto variants are fine).
  await expect(page.getByTestId("variant-caption")).toBeVisible();
  await next();
  // Step 5: Launch.
  const publish = page.locator('[data-testid="publish-now"]:visible').first();
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.locator("text=/Published (everywhere|to)/")).toBeVisible({
    timeout: 60_000,
  });
  const published = page.locator("li:has-text('Published')");
  expect(await published.count()).toBeGreaterThanOrEqual(3);
});

test("strategist runs a demo report and streams demo chat", async ({ page }) => {
  await login(page);
  await page.goto("/strategist");
  // Reports tab on mobile.
  if (isMobile(page)) {
    await page.locator("text=Reports & Ad Builder").click();
  }
  await page.locator("text=Weekly review").first().click();
  await expect(page.locator("text=Demo analysis").first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("text=Next week").first()).toBeVisible();

  // Chat (demo mode streams a data-aware reply).
  if (isMobile(page)) {
    await page.locator("button:has-text('Chat')").first().click();
  }
  await page.getByTestId("chat-input").fill("What is working right now?");
  await page.locator('button[aria-label="Send"]').click();
  await expect(page.locator("text=Demo strategist").first()).toBeVisible({
    timeout: 30_000,
  });
});

test("calendar and queue render", async ({ page }) => {
  await login(page);
  await page.goto("/calendar");
  await expect(page.locator("h1:has-text('Calendar')")).toBeVisible();
  // Desktop: scheduled chips advertise drag-to-reschedule.
  if (!isMobile(page)) {
    await expect(
      page.locator('button[draggable="true"][title*="Drag to another day"]').first(),
    ).toBeVisible();
  }
  await page.goto("/calendar?tab=queue");
  // Queue list or empty-state message.
  await expect(
    page.getByTestId("queue-list").or(page.getByText("Queue is clear")).first(),
  ).toBeVisible();
});

test("brands: create, scope the dashboard, switch back", async ({ page }) => {
  await login(page);
  // Create a brand from Settings (switches into it automatically).
  await page.goto("/settings");
  const name = `Test Brand ${Date.now() % 100000}`;
  await page.getByTestId("new-brand-name").fill(name);
  await page.getByTestId("create-brand").click();
  await expect(page.locator(`text=Created ${name}`)).toBeVisible({ timeout: 15_000 });

  // Dashboard is now scoped to the empty brand (subtitle shows it).
  await page.goto("/");
  await expect(
    page.locator(`text=/${name} · 0 accounts/`).first(),
  ).toBeVisible();

  // Switch back to All brands via the switcher.
  await page.locator('[data-testid="brand-switcher"]:visible').first().click();
  await page.locator('[data-testid="brand-option-all"]:visible').first().click();
  await expect(page.locator("text=/All brands · 10 accounts/").first()).toBeVisible({
    timeout: 15_000,
  });

  // Clean up: delete the test brand so reruns don't accumulate rows.
  await page.goto("/settings");
  const row = page.locator(`div:has(> div > span:text("${name}"))`).first();
  await row.locator('button:has-text("Delete")').click();
  await row.locator('button:has-text("Confirm delete")').click();
  await expect(page.locator(`text=${name}`)).toHaveCount(0, { timeout: 15_000 });
});

test("command palette searches and navigates", async ({ page }) => {
  await login(page);
  await page.locator('[data-testid="command-palette-button"]:visible').first().click();
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("command-input").fill("queue");
  await page.getByTestId("command-input").press("Enter");
  await page.waitForURL(/calendar\?tab=queue/);
  // Keyboard shortcut opens it too.
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("command-palette")).toHaveCount(0);
});

test("AI caption writer drafts options and fills the caption", async ({ page }) => {
  await login(page);
  await page.goto("/composer");
  const next = () =>
    page
      .locator('[data-testid="step-next"]:visible, .fixed button:has-text("Next")')
      .first()
      .click();
  await page.locator('section:has-text("Pick your media") button').first().click();
  await next();
  await page.getByTestId("ai-caption-button").click();
  await page.getByTestId("ai-caption-brief").fill("navy hoodie restock friday");
  await page.getByTestId("ai-caption-go").click();
  await expect(page.getByTestId("ai-caption-option").first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("ai-caption-option").first().click();
  const caption = await page.getByTestId("master-caption").inputValue();
  expect(caption.length).toBeGreaterThan(20);
});

test("go-live checklist shows real progress on the dashboard", async ({ page }) => {
  await login(page);
  const checklist = page.getByTestId("golive-checklist");
  await expect(checklist).toBeVisible();
  await expect(checklist.locator("text=/Go fully live — \\d\\/6 done/")).toBeVisible();
  await expect(checklist.locator("li")).toHaveCount(6);
});

test("notifications bell lists activity and marks it read", async ({ page }) => {
  await login(page);
  // Two bells exist (sidebar + mobile top bar) — drive the visible one.
  await page.locator('[data-testid="notifications-bell"]:visible').first().click();
  const panel = page.locator('[data-testid="notifications-panel"]:visible');
  await expect(panel).toBeVisible();
  expect(await panel.locator("li").count()).toBeGreaterThan(0);
  await panel.locator("button:has-text('Mark all read')").click();
  await expect(page.getByTestId("notifications-badge")).toHaveCount(0, {
    timeout: 15_000,
  });
});

test("recycling tab toggles a rule per account", async ({ page }) => {
  await login(page);
  await page.goto("/calendar?tab=recycle");
  await expect(page.getByTestId("recycling-list")).toBeVisible();
  const toggle = page.locator('[data-testid^="recycle-toggle-"]').first();
  await toggle.click();
  await expect(page.locator("text=/Recycling (on|off)/").first()).toBeVisible({
    timeout: 15_000,
  });
});

test("composer launch step offers per-platform schedule modes", async ({ page }) => {
  await login(page);
  await page.goto("/composer");
  const next = () =>
    page
      .locator('[data-testid="step-next"]:visible, .fixed button:has-text("Next")')
      .first()
      .click();
  await page.locator('section:has-text("Pick your media") button').first().click();
  await next();
  await page.getByTestId("master-caption").fill("Schedule modes check");
  await next();
  await page.locator('[data-testid^="account-toggle-facebook-"]').first().click();
  await next();
  await next();
  // Open the scheduler and check all three modes exist.
  await page.locator('button:has-text("Schedule"):visible').first().click();
  await expect(page.getByTestId("schedule-mode-same")).toBeVisible();
  await page.getByTestId("schedule-mode-custom").click();
  await expect(page.getByTestId("target-time").first()).toBeVisible();
  await page.getByTestId("schedule-mode-best").click();
  await expect(
    page.locator("text=/no history yet|Learned from each account/").first(),
  ).toBeVisible();
});

test("connections wizard + capability matrix are honest about Snapchat", async ({ page }) => {
  await login(page);
  await page.goto("/connections");
  await expect(page.locator("text=Capability matrix")).toBeVisible();
  await expect(page.locator("text=No public API").first()).toBeVisible();
  await page.goto("/connections/snapchat");
  await expect(page.locator("text=Why Snapchat is manual")).toBeVisible();
});
