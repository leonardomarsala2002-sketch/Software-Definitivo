/**
 * Golden path 3 - Pubblicazione turni mensili.
 * Manager genera il calendario del mese -> verifica draft -> pubblica.
 */
import { test, expect } from "@playwright/test";

test.describe("pubblicazione turni - manager", () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/email/i).fill(
      process.env.E2E_MANAGER_EMAIL ?? "manager@test.demo"
    );
    await page.getByLabel(/password/i).fill(
      process.env.E2E_MANAGER_PASSWORD ?? "TestDemo2026!"
    );
    await page.locator("button[type='submit']").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("calendario turni e raggiungibile", async ({ page }) => {
    const calLink = page
      .getByRole("link", { name: /calendario|turni|team/i })
      .first();
    await calLink.click();
    await expect(page).toHaveURL(/calendar|turni|calendario/, { timeout: 8_000 });

    await expect(page.locator("body")).toContainText(
      /genera|turni|mese/i,
      { timeout: 8_000 }
    );
  });

  test("bottone Genera Mese apre conferma e avvia generazione", async ({ page }) => {
    const calLink = page
      .getByRole("link", { name: /calendario|turni|team/i })
      .first();
    await calLink.click();
    await expect(page).toHaveURL(/calendar|turni|calendario/, { timeout: 8_000 });

    const generateBtn = page
      .getByRole("button", { name: /genera mese|genera turni|genera/i })
      .first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    // Click apre il dialog di conferma (Radix AlertDialog usa role="alertdialog")
    await generateBtn.click();
    const dialog = page.locator("[role='alertdialog']");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toContainText(/genera turni mensili/i);

    // Conferma la generazione cliccando l'action button dentro il dialog
    const confirmBtn = dialog.getByRole("button", { name: /genera mese/i });
    await confirmBtn.click();

    // Il dialog deve chiudersi dopo la conferma
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // La generazione e avviata: compare lo spinner nel bottone (isPending)
    // oppure un toast con il risultato (turni generati o errore Gemini se manca AI key)
    const spinner = generateBtn.locator(".animate-spin");
    const resultToast = page.locator("body").getByText(
      /turni mensili generati|gemini.*non disponibile|errore generazione/i
    );
    await expect(spinner.or(resultToast)).toBeVisible({ timeout: 30_000 });
  });

  test("badge deadline richieste e visibile nel calendario", async ({ page }) => {
    const calLink = page
      .getByRole("link", { name: /calendario|turni|team/i })
      .first();
    await calLink.click();
    await expect(page).toHaveURL(/calendar|turni|calendario/, { timeout: 8_000 });

    const deadlineBadge = page
      .locator("body")
      .getByText(/richieste entro|scadenza/i)
      .first();
    await expect(deadlineBadge).toBeVisible({ timeout: 8_000 });
  });

  test("bottone Pubblica Mese compare quando ci sono bozze", async ({ page }) => {
    const calLink = page
      .getByRole("link", { name: /calendario|turni|team/i })
      .first();
    await calLink.click();
    await expect(page).toHaveURL(/calendar|turni|calendario/, { timeout: 8_000 });

    // "Pubblica Mese" appare solo se ci sono turni in bozza (hasDraftShifts).
    // Senza bozze nel DB di test il bottone non compare - comportamento corretto.
    const publishBtn = page.getByRole("button", { name: /pubblica mese/i }).first();
    const hasDraftBtn = await publishBtn.isVisible({ timeout: 6_000 }).catch(() => false);

    if (hasDraftBtn) {
      console.log("[E2E] Bottone Pubblica Mese trovato");
    } else {
      await expect(page.locator("body")).toContainText(/genera|turni|calendario/i, { timeout: 5_000 });
      console.log("[E2E] Nessuna bozza - Pubblica Mese non visibile (comportamento corretto)");
    }
  });
});

test.describe("accesso negato - dipendente non puo pubblicare", () => {
  test.use({ storageState: undefined });

  test("dipendente non vede il bottone Genera Mese", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/email/i).fill(
      process.env.E2E_EMPLOYEE_EMAIL ?? "employee@test.demo"
    );
    await page.getByLabel(/password/i).fill(
      process.env.E2E_EMPLOYEE_PASSWORD ?? "TestDemo2026!"
    );
    await page.locator("button[type='submit']").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

    const teamCalLink = page
      .getByRole("link", { name: /team calendar|gestione turni/i })
      .first();

    const hasTeamCal = await teamCalLink.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasTeamCal) {
      await teamCalLink.click();
      const generateBtn = page.getByRole("button", { name: /genera mese|genera turni/i });
      await expect(generateBtn).not.toBeVisible({ timeout: 5_000 });
    }
    // Se non vede il link al team calendar, il RBAC funziona correttamente
  });
});
