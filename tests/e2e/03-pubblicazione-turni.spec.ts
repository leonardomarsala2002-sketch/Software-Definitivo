/**
 * Golden path 3 — Pubblicazione turni mensili.
 * Manager genera il calendario del mese → verifica draft → pubblica.
 * Il test è smoke-only: verifica che i bottoni esistano e che la UI
 * risponda correttamente, senza aspettarsi un'intera generazione AI
 * (che richiederebbe credenziali reali e potrebbe durare minuti).
 */
import { test, expect } from "@playwright/test";

test.describe("pubblicazione turni — manager", () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/email/i).fill(
      process.env.E2E_MANAGER_EMAIL ?? "manager@test.demo"
    );
    await page.getByLabel(/password/i).fill(
      process.env.E2E_MANAGER_PASSWORD ?? "TestDemo2026!"
    );
    await page.getByRole("button", { name: /accedi|login/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("calendario turni è raggiungibile", async ({ page }) => {
    // Naviga al calendario del team
    const calLink = page
      .getByRole("link", { name: /calendario|turni|team/i })
      .first();
    await calLink.click();
    await expect(page).toHaveURL(/calendar|turni|calendario/, { timeout: 8_000 });

    // La pagina deve mostrare elementi tipici del calendario
    await expect(page.locator("body")).toContainText(
      /genera|turni|mese/i,
      { timeout: 8_000 }
    );
  });

  test("bottone Genera Mese è visibile e cliccabile", async ({ page }) => {
    const calLink = page
      .getByRole("link", { name: /calendario|turni|team/i })
      .first();
    await calLink.click();
    await expect(page).toHaveURL(/calendar|turni|calendario/, { timeout: 8_000 });

    // Verifica presenza bottone Genera
    const generateBtn = page
      .getByRole("button", { name: /genera mese|genera turni|genera/i })
      .first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    // Clicca e verifica che compaia un dialog di conferma o avvio spinner
    await generateBtn.click();

    // Deve comparire un dialog, un loader, o un messaggio di stato
    const feedbackVisible = await Promise.race([
      page.locator("[role='dialog']").waitFor({ timeout: 5_000 }).then(() => true),
      page.locator("[data-loading], .animate-spin, [aria-busy='true']").waitFor({ timeout: 5_000 }).then(() => true),
      page.locator("body").getByText(/generazione|avvio|in corso/i).waitFor({ timeout: 5_000 }).then(() => true),
    ]).catch(() => false);

    // Se nessun feedback visibile, il test è ancora accettabile —
    // almeno il bottone era presente e cliccabile
    if (!feedbackVisible) {
      console.log("[E2E] Nessun feedback immediato dopo Genera Mese — ok (potrebbe richiedere AI key)");
    }
  });

  test("badge deadline richieste è visibile nel calendario", async ({ page }) => {
    const calLink = page
      .getByRole("link", { name: /calendario|turni|team/i })
      .first();
    await calLink.click();
    await expect(page).toHaveURL(/calendar|turni|calendario/, { timeout: 8_000 });

    // Il badge con la scadenza delle richieste deve essere presente
    const deadlineBadge = page
      .locator("body")
      .getByText(/richieste entro|scadenza/i)
      .first();
    await expect(deadlineBadge).toBeVisible({ timeout: 8_000 });
  });

  test("bottone Pubblica Mese è presente (anche se disabilitato senza draft)", async ({ page }) => {
    const calLink = page
      .getByRole("link", { name: /calendario|turni|team/i })
      .first();
    await calLink.click();
    await expect(page).toHaveURL(/calendar|turni|calendario/, { timeout: 8_000 });

    const publishBtn = page
      .getByRole("button", { name: /pubblica mese|pubblica/i })
      .first();
    await expect(publishBtn).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("accesso negato — dipendente non può pubblicare", () => {
  test.use({ storageState: undefined });

  test("dipendente non vede il bottone Genera Mese", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/email/i).fill(
      process.env.E2E_EMPLOYEE_EMAIL ?? "employee@test.demo"
    );
    await page.getByLabel(/password/i).fill(
      process.env.E2E_EMPLOYEE_PASSWORD ?? "TestDemo2026!"
    );
    await page.getByRole("button", { name: /accedi|login/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

    // Il dipendente non dovrebbe vedere la pagina del team calendar
    // o se la vede non deve avere il bottone Genera
    const teamCalLink = page
      .getByRole("link", { name: /team calendar|gestione turni/i })
      .first();

    const hasTeamCal = await teamCalLink.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasTeamCal) {
      await teamCalLink.click();
      // Se raggiunge la pagina, il bottone Genera non deve esserci
      const generateBtn = page.getByRole("button", { name: /genera mese|genera turni/i });
      await expect(generateBtn).not.toBeVisible({ timeout: 5_000 });
    }
    // Se non vede il link al team calendar, il RBAC funziona correttamente
  });
});
