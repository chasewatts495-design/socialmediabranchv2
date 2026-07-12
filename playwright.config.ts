import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// The remote dev environment pre-installs Chromium here; local machines use
// the Playwright-managed browser instead.
const CHROMIUM_PATH = "/opt/pw-browsers/chromium";
const launchOptions = existsSync(CHROMIUM_PATH)
  ? { executablePath: CHROMIUM_PATH }
  : {};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    launchOptions,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      APP_PASSWORD: "test-password",
      APP_ENCRYPTION_KEY: "e2e-test-encryption-key-not-secret",
      ENABLE_DEV_TICKER: "false",
      // Deterministic, offline Trend Radar scans.
      TRENDS_FORCE_DEMO: "1",
    },
  },
});
