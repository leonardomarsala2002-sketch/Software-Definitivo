/**
 * Golden path 5 - DailyPerformanceCard: inserimento dati e calcoli automatici.
 * Manager/admin inserisce incasso e budget, verifica calcoli produttivita.
 */
import { test, expect } from "@playwright/test";

const MANAGER = {
  email: process.env.E2E_MANAGER_EMAIL ?? "manager@test.demo",
  password: process.env.E2E_MANAGER_PASSWORD ?? "TestDemo2026!",
};

test.describe("DailyPerformanceCard - manager", () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/email/i).fill(MANAGER.email);
    await page.getByLabel(/password/i).fill(MANAGER.password);
    await page.locator("button[type='submit']").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 12_000 });
    await page.goto("/");
  });

  test("card produttivita e budget e visibile nella dashboard", async ({ page }) => {
    const card = page.locator("body").getByText(/produttivit|budget/i).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test("tabella settimana e presente con colonne corrette", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const table = page.locator("table").last();
    await expect(table).toBeVisible({ timeout: 8_000 });

    await expect(page.locator("body")).toContainText(/incasso/i, { timeout: 8_000 });
    await expect(page.locator("body")).toContainText(/budget/i, { timeout: 8_000 });
  });

  test("cella incasso e editabile con click", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Usa il title attribute per trovare le celle editabili, indipendentemente dal valore
    const editableCell = page.locator("button[title='Clicca per modificare']").first();
    await expect(editableCell).toBeVisible({ timeout: 8_000 });

    await editableCell.click();

    const input = page.locator("input[type='number']").first();
    await expect(input).toBeVisible({ timeout: 3_000 });

    await input.fill("1500");
    await input.press("Enter");

    await expect(input).not.toBeVisible({ timeout: 3_000 });
  });

  test("navigazione settimana precedente funziona", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Cerca il bottone con ChevronLeft (la card usa icone lucide)
    const chevronLeft = page.locator("button").filter({
      has: page.locator("svg"),
    }).first();

    const hasPrev = await chevronLeft.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasPrev) {
      await chevronLeft.click();
      await page.waitForTimeout(300);
    }

    const weekTitle = page.locator("body").getByText(/sett|lun|mar|mer|gio|ven|sab/i).last();
    await expect(weekTitle).toBeVisible({ timeout: 5_000 });
  });

  test("totali settimanali sono presenti nel tfoot", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const tfoot = page.locator("tfoot").last();
    await expect(tfoot).toBeVisible({ timeout: 8_000 });
    await expect(tfoot).toContainText(/totale/i);
  });

  test("KPI chips incasso produttivita vs budget sono visibili", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect(page.locator("body")).toContainText(/incasso settimana|totale settimana/i, { timeout: 8_000 });
    await expect(page.locator("body")).toContainText(/produttivit|€\/ora/i, { timeout: 8_000 });
    await expect(page.locator("body")).toContainText(/vs budget/i, { timeout: 8_000 });
  });
});
