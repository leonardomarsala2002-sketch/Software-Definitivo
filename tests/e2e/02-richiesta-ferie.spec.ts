/**
 * Golden path 2 — Flusso completo richiesta ferie.
 * Dipendente invia richiesta → Manager la vede → Manager la approva.
 */
import { test, expect, type Page } from "@playwright/test";

function futureDateStr(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? "employee@test.demo";
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? "TestDemo2026!";
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? "manager@test.demo";
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD ?? "TestDemo2026!";

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.locator("button[type='submit']").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
}

async function logout(page: Page) {
  // Il bottone logout è un icon button con title="Esci" (nessun testo visibile)
  const logoutBtn = page.locator("button[title='Esci']")
    .or(page.getByRole("button", { name: /esci|logout/i }))
    .first();
  await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
  await logoutBtn.click();
  await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
}

async function submitFerieRequest(page: Page, daysAhead: number) {
  await page
    .getByRole("link", { name: /richieste/i })
    .or(page.getByRole("button", { name: /richieste/i }))
    .first()
    .click();
  await expect(page).toHaveURL(/richieste|requests/, { timeout: 8_000 });

  await page
    .getByRole("button", { name: /nuova richiesta|aggiungi|nuovo/i })
    .first()
    .click();

  const tipoCombobox = page.getByRole("combobox").first();
  await expect(tipoCombobox).toBeVisible({ timeout: 5_000 });
  await tipoCombobox.click();
  await page.getByRole("option", { name: /ferie/i }).click();

  await page.locator("input[type='date']").first().fill(futureDateStr(daysAhead));

  await page
    .getByRole("button", { name: /invia richiesta|crea e approva|invia|conferma|salva/i })
    .first()
    .click();

  await expect(page.locator("body")).toContainText(
    /inviata|successo|success|richiesta creata/i,
    { timeout: 10_000 }
  );
}

test.describe("richiesta ferie — dipendente", () => {
  test.use({ storageState: undefined });

  test("dipendente invia richiesta ferie", async ({ page }) => {
    await loginAs(page, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD);
    await submitFerieRequest(page, 14);
  });
});

test.describe("richiesta ferie — manager approva", () => {
  test.use({ storageState: undefined });

  test("manager approva una richiesta ferie", async ({ page }) => {
    // Crea una richiesta fresca come employee per garantire che ne esista una pending
    await loginAs(page, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD);
    await submitFerieRequest(page, 21);
    await logout(page);

    // Login come manager e approva
    await loginAs(page, MANAGER_EMAIL, MANAGER_PASSWORD);

    await page
      .getByRole("link", { name: /richieste/i })
      .or(page.getByRole("button", { name: /richieste/i }))
      .first()
      .click();
    await expect(page).toHaveURL(/richieste|requests/, { timeout: 8_000 });

    // Cerca il primo bottone Approva visibile (più robusto del match sulla riga)
    const approveBtn = page.getByRole("button", { name: /approva/i }).first();
    await expect(approveBtn).toBeVisible({ timeout: 8_000 });
    await approveBtn.click();

    await expect(page.locator("body")).toContainText(
      /approvata|success|aggiornata/i,
      { timeout: 10_000 }
    );
  });
});

