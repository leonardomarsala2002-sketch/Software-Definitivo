/**
 * Setup condiviso: salva lo stato di sessione per ogni ruolo in file JSON
 * così i test non rieseguono il login ogni volta.
 *
 * Eseguito automaticamente da Playwright prima dei test grazie al progetto
 * "setup" nella config (quando necessario).
 *
 * Credenziali: usa le variabili d'ambiente oppure i valori di default
 * che corrispondono agli account di test già presenti nel DB.
 */
import { test as setup, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const STORAGE_DIR = path.join(__dirname, ".auth");

const ACCOUNTS = {
  employee: {
    email: process.env.E2E_EMPLOYEE_EMAIL ?? "employee@test.demo",
    password: process.env.E2E_EMPLOYEE_PASSWORD ?? "TestDemo2026!",
    file: path.join(STORAGE_DIR, "employee.json"),
  },
  manager: {
    email: process.env.E2E_MANAGER_EMAIL ?? "manager@test.demo",
    password: process.env.E2E_MANAGER_PASSWORD ?? "TestDemo2026!",
    file: path.join(STORAGE_DIR, "manager.json"),
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@test.demo",
    password: process.env.E2E_ADMIN_PASSWORD ?? "TestDemo2026!",
    file: path.join(STORAGE_DIR, "admin.json"),
  },
};

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  storageFile: string,
) {
  await page.goto("/");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /accedi|login/i }).click();
  // Wait for successful navigation away from login
  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: storageFile });
}

setup("save employee session", async ({ page }) => {
  await loginAs(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password, ACCOUNTS.employee.file);
});

setup("save manager session", async ({ page }) => {
  await loginAs(page, ACCOUNTS.manager.email, ACCOUNTS.manager.password, ACCOUNTS.manager.file);
});

setup("save admin session", async ({ page }) => {
  await loginAs(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password, ACCOUNTS.admin.file);
});
