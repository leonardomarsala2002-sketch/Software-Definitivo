/**
 * Golden path 1 â€” Login per ogni ruolo.
 * Verifica che ogni account di test acceda alla dashboard corretta.
 */
import { test, expect } from "@playwright/test";

const ACCOUNTS = [
  {
    role: "employee",
    email: process.env.E2E_EMPLOYEE_EMAIL ?? "employee@test.demo",
    password: process.env.E2E_EMPLOYEE_PASSWORD ?? "TestDemo2026!",
    expectedUrl: /\/(dashboard|personal-calendar|calendario)/i,
    expectedText: /calendario|turni/i,
  },
  {
    role: "manager",
    email: process.env.E2E_MANAGER_EMAIL ?? "manager@test.demo",
    password: process.env.E2E_MANAGER_PASSWORD ?? "TestDemo2026!",
    expectedUrl: /\/(dashboard|team-calendar|turni)/i,
    expectedText: /dashboard|turni/i,
  },
  {
    role: "admin",
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@test.demo",
    password: process.env.E2E_ADMIN_PASSWORD ?? "TestDemo2026!",
    expectedUrl: /\/(dashboard|admin)/i,
    expectedText: /dashboard|store/i,
  },
];

for (const account of ACCOUNTS) {
  test(`login come ${account.role}`, async ({ page }) => {
    await page.goto("/");

    // Deve mostrare il form di login
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Inserisci credenziali
    await page.getByLabel(/email/i).fill(account.email);
    await page.getByLabel(/password/i).fill(account.password);
    await page.locator("button[type='submit']").click();

    // Dopo login deve uscire dalla pagina /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

    // Deve comparire contenuto della dashboard
    await expect(page.locator("body")).toContainText(account.expectedText, {
      ignoreCase: true,
      timeout: 10_000,
    });
  });

  test(`logout dopo login come ${account.role}`, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/email/i).fill(account.email);
    await page.getByLabel(/password/i).fill(account.password);
    await page.locator("button[type='submit']").click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

    // Cerca il bottone/menu di logout
    const logoutTrigger =
      page.getByRole("button", { name: /logout|esci/i }).first();
    const avatarMenu = page.getByRole("button", { name: /profilo|account|menu/i }).first();

    if (await logoutTrigger.isVisible()) {
      await logoutTrigger.click();
    } else {
      await avatarMenu.click();
      await page.getByRole("menuitem", { name: /logout|esci/i }).click();
    }

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
}

test("login con credenziali errate mostra errore", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/email/i).fill("nobody@example.com");
  await page.getByLabel(/password/i).fill("WrongPassword123!");
  await page.locator("button[type='submit']").click();

  // Deve rimanere su /login e mostrare un messaggio d'errore
  await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  await expect(page.locator("body")).toContainText(/errore|invalid|credenziali|non valido/i, {
    timeout: 8_000,
  });
});

