import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright configuration untuk visual testing dashboard Copilot API
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],
  use: {
    // Server harus running di port 4141
    baseURL: "http://localhost:4141",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Tidak perlu webServer karena server harus sudah running manual
})
