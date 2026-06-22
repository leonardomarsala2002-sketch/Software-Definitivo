/**
 * Golden path 4 - Protezione route basata su ruolo.
 * Verifica che employee non possa accedere a pagine admin via URL diretto.
 * Verifica che admin non possa accedere a pagine super_admin.
 */
import { test, expect } from "@playwright/test";

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.locator("button[type='submit']").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 12_000 });
}

const EMPLOYEE = {
  email: process.env.E2E_EMPLOYEE_EMAIL ?? "employee@test.demo",
  password: process.env.E2E_EMPLOYEE_PASSWORD ?? "TestDemo2026!",
};
const MANAGER = {
  email: process.env.E2E_MANAGER_EMAIL ?? "manager@test.demo",
  password: process.env.E2E_MANAGER_PASSWORD ?? "TestDemo2026!",
};

const ADMIN_ONLY_ROUTES = [
  "/scheduler",
  "/employees",
  "/store-settings",
  "/audit-log",
  "/settings",
];

const SUPER_ADMIN_ONLY_ROUTES = [
  "/admin-shifts",
  "/invitations",
  "/manage-stores",
];

test.describe("protezione route - employee", () => {
  test.use({ storageState: undefined });

  test("employee non puo raggiungere pagine admin", async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    for (const route of ADMIN_ONLY_ROUTES) {
      await page.goto(route);
      // RoleRoute fa Navigate to="/" — pathname diventa "/"
      await page.waitForFunction(() => window.location.pathname === "/", { timeout: 5_000 });
    }
  });

  test("employee non puo raggiungere pagine super_admin", async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);

    for (const route of SUPER_ADMIN_ONLY_ROUTES) {
      await page.goto(route);
      await page.waitForFunction(() => window.location.pathname === "/", { timeout: 5_000 });
    }
  });

  test("employee puo accedere alla propria dashboard", async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);
    await page.goto("/");
    await expect(page.locator("body")).toContainText(/turni|ciao|benvenuto|calendario/i, {
      timeout: 8_000,
    });
  });

  test("employee puo accedere a /requests", async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);
    await page.goto("/requests");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 });
    await expect(page).toHaveURL(/requests/, { timeout: 5_000 });
  });

  test("sidebar employee non mostra link admin", async ({ page }) => {
    await loginAs(page, EMPLOYEE.email, EMPLOYEE.password);
    await page.goto("/");

    const forbidden = [
      /dipendenti/i,
      /scheduler/i,
      /impostazioni store/i,
      /audit log/i,
      /inviti/i,
      /manage store/i,
    ];

    const sidebar = page.locator("nav, aside, [data-sidebar]").first();
    for (const pattern of forbidden) {
      await expect(sidebar.getByRole("link", { name: pattern })).not.toBeVisible();
    }
  });
});

test.describe("protezione route - manager", () => {
  test.use({ storageState: undefined });

  test("manager non puo raggiungere pagine super_admin", async ({ page }) => {
    await loginAs(page, MANAGER.email, MANAGER.password);

    for (const route of SUPER_ADMIN_ONLY_ROUTES) {
      await page.goto(route);
      await page.waitForFunction(() => window.location.pathname === "/", { timeout: 5_000 });
    }
  });

  test("manager puo raggiungere il team calendar", async ({ page }) => {
    await loginAs(page, MANAGER.email, MANAGER.password);
    await page.goto("/team-calendar");
    await expect(page).toHaveURL(/team-calendar/, { timeout: 8_000 });
  });

  test("manager puo raggiungere lo scheduler", async ({ page }) => {
    await loginAs(page, MANAGER.email, MANAGER.password);
    await page.goto("/scheduler");
    await expect(page).toHaveURL(/scheduler/, { timeout: 8_000 });
  });
});
