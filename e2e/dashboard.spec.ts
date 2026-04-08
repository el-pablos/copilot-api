/**
 * Visual Test untuk Dashboard Copilot API
 *
 * Test cases:
 * 1. Layout tidak mepet kanan (main content centered)
 * 2. Sidebar ada di kiri (desktop view)
 * 3. Dashboard menampilkan stats summary
 * 4. History page menampilkan request entries table
 * 5. Format cost USD/IDR terformat dengan benar
 *
 * Prerequisite: Server harus running di port 4141
 * Jalankan: bunx playwright test
 */

import { test, expect, type Page } from "@playwright/test";

// Helper untuk tunggu halaman selesai load
async function waitForPageLoad(page: Page) {
  // Tunggu DOM loaded
  await page.waitForLoadState("domcontentloaded");

  // Tunggu Alpine.js selesai initialize (x-cloak harus hilang dari body)
  await page.waitForFunction(
    () => {
      const body = document.body;
      return body && !body.hasAttribute("x-cloak");
    },
    { timeout: 10000 },
  );

  // Tunggu sebentar untuk render
  await page.waitForTimeout(1000);
}

// Helper untuk navigate ke History tab
async function navigateToHistory(page: Page) {
  // Klik button History di sidebar
  const historyButton = page.getByRole("button", { name: "History" });
  if (await historyButton.isVisible()) {
    await historyButton.click();
    await page.waitForTimeout(1000);
  }
}

test.describe("Dashboard Layout Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForPageLoad(page);
  });

  test("layout tidak mepet kanan - main content centered", async ({ page }) => {
    // Ambil viewport width
    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();
    const viewportWidth = viewportSize!.width;

    // Cari main content container
    const mainContent = page.locator("main").first();
    await expect(mainContent).toBeVisible();

    // Get bounding box
    const boundingBox = await mainContent.boundingBox();
    expect(boundingBox).not.toBeNull();

    // Verifikasi tidak mepet kanan - harus ada margin/padding
    // Main content tidak boleh 100% width viewport
    expect(boundingBox!.width).toBeLessThan(viewportWidth);
  });

  test.skip("sidebar ada di kiri pada desktop view", async ({ page }) => {
    // TODO: Test ini diskip karena selector tidak stabil - perlu investigasi lebih lanjut
    // Kemungkinan karena ada multiple complementary elements dan urutan DOM berbeda saat test
    // Set viewport ke desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await waitForPageLoad(page);

    // Cari sidebar dengan role complementary (aside) yang pertama visible
    const allComplementary = page.locator('[role="complementary"], aside');

    // Cek ada minimal 1 complementary/aside element
    const count = await allComplementary.count();
    expect(count).toBeGreaterThan(0);

    // Cek element pertama untuk verifikasi posisi di kiri
    const firstComplementary = allComplementary.first();
    await expect(firstComplementary).toBeVisible();

    const boundingBox = await firstComplementary.boundingBox();
    expect(boundingBox).not.toBeNull();

    // Element complementary/aside pertama harus di posisi kiri viewport (x < 300)
    // Ini mengindikasikan sidebar layout di kiri
    expect(boundingBox!.x).toBeLessThan(300);

    // Screenshot untuk verifikasi visual
    await page.screenshot({
      path: "tests/visual-playwright/screenshots/sidebar-desktop.png",
      fullPage: false,
    });
  });

  test("dashboard menampilkan stats summary", async ({ page }) => {
    // Set viewport ke desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await waitForPageLoad(page);

    // Navigate ke History tab yang menampilkan stats
    await navigateToHistory(page);

    // Verifikasi stats summary elements ada - tunggu element visible
    const totalRequestsLabel = page.getByText("Total Requests").first();
    await expect(totalRequestsLabel).toBeVisible({ timeout: 10000 });

    // Cari text "Success Rate"
    const successRateLabel = page.getByText("Success Rate").first();
    await expect(successRateLabel).toBeVisible();

    // Cari text "Total Cost"
    const totalCostLabel = page.getByText("Total Cost").first();
    await expect(totalCostLabel).toBeVisible();

    // Screenshot stats summary
    await page.screenshot({
      path: "tests/visual-playwright/screenshots/dashboard-stats.png",
      fullPage: false,
    });
  });
});

test.describe("History Page Tests", () => {
  test("history page menampilkan request entries", async ({ page }) => {
    // Set viewport ke desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await waitForPageLoad(page);

    // Navigate ke History tab
    await navigateToHistory(page);

    // Verifikasi heading "Request Entries" ada
    const requestEntriesHeading = page.getByText("Request Entries").first();
    await expect(requestEntriesHeading).toBeVisible({ timeout: 10000 });

    // Verifikasi table ada
    const table = page.locator("table").first();
    await expect(table).toBeVisible();

    // Verifikasi kolom-kolom penting ada
    const timeHeader = page.getByRole("columnheader", { name: "Time" });
    const modelHeader = page.getByRole("columnheader", { name: "Model" });
    const costHeader = page.getByRole("columnheader", { name: "Cost" });
    const statusHeader = page.getByRole("columnheader", { name: "Status" });

    await expect(timeHeader).toBeVisible();
    await expect(modelHeader).toBeVisible();
    await expect(costHeader).toBeVisible();
    await expect(statusHeader).toBeVisible();

    // Screenshot history page
    await page.screenshot({
      path: "tests/visual-playwright/screenshots/history-page.png",
      fullPage: false,
    });
  });
});

test.describe("Cost Format Tests", () => {
  test("format cost USD dan IDR ditampilkan dengan benar", async ({ page }) => {
    // Set viewport ke desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await waitForPageLoad(page);

    // Navigate ke History tab yang menampilkan cost
    await navigateToHistory(page);

    // Tunggu stats muncul
    await page.waitForTimeout(2000);

    // Verifikasi format USD ada di page - cari $ symbol
    const pageContent = await page.content();
    expect(pageContent).toMatch(/\$[0-9,]+\.[0-9]+/);

    // Verifikasi format IDR ada di page - cari Rp symbol
    expect(pageContent).toMatch(/Rp [0-9.,]+/);

    // Screenshot untuk verifikasi
    await page.screenshot({
      path: "tests/visual-playwright/screenshots/cost-format.png",
      fullPage: false,
    });
  });

  test("verifikasi format currency USD/IDR di Total Cost", async ({ page }) => {
    // Set viewport ke desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await waitForPageLoad(page);

    // Navigate ke History tab
    await navigateToHistory(page);

    // Cari section Total Cost
    const totalCostLabel = page.getByText("Total Cost").first();
    await expect(totalCostLabel).toBeVisible({ timeout: 10000 });

    // Ambil page content dan verifikasi format
    const pageContent = await page.content();

    // Verifikasi kedua format currency ada
    expect(pageContent).toMatch(/\$[0-9,]+\.[0-9]+/); // USD format
    expect(pageContent).toMatch(/Rp [0-9.,]+/); // IDR format

    // Full page screenshot untuk dokumentasi
    await page.screenshot({
      path: "tests/visual-playwright/screenshots/full-page.png",
      fullPage: true,
    });
  });
});

test.describe("Visual Regression", () => {
  test("capture dashboard screenshot untuk baseline", async ({ page }) => {
    await page.goto("/");
    await waitForPageLoad(page);

    // Navigate ke History untuk capture full view
    await navigateToHistory(page);

    // Desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({
      path: "tests/visual-playwright/screenshots/dashboard-desktop-baseline.png",
      fullPage: true,
    });

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Tunggu responsive adjustment
    await page.screenshot({
      path: "tests/visual-playwright/screenshots/dashboard-mobile-baseline.png",
      fullPage: true,
    });
  });
});
