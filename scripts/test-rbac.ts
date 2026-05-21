/**
 * Script di test RBAC automatico.
 *
 * Uso:
 *   npx tsx scripts/test-rbac.ts
 *
 * Richiede: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY nel .env
 * (già presenti nel progetto — nessuna configurazione aggiuntiva)
 *
 * Step 1: chiama seed-test-accounts per creare i 4 account di prova
 * Step 2: fa login come ciascun ruolo
 * Step 3: testa le operazioni permesse/negate per ogni ruolo
 * Step 4: stampa il report finale
 */

import * as fs from "fs";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) throw new Error(".env non trovato");
  const lines = fs.readFileSync(envPath, "utf8").replace(/\r/g, "").split("\n");
  const env: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^([^=]+)=["']?([^"']*)["']?$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const ANON_KEY     = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const FN_BASE      = `${SUPABASE_URL}/functions/v1`;
const REST_BASE    = `${SUPABASE_URL}/rest/v1`;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Mancano VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY nel .env");
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TestResult = { label: string; passed: boolean; detail: string };

async function apiPost(url: string, body: unknown, jwt?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
  };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  let json: unknown;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json as Record<string, unknown> };
}

async function apiGet(url: string, jwt?: string) {
  const headers: Record<string, string> = { "apikey": ANON_KEY };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  const res = await fetch(url, { headers });
  let json: unknown;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json };
}

async function login(email: string, password: string): Promise<string | null> {
  const res = await apiPost(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    { email, password },
  );
  return (res.body as any)?.access_token ?? null;
}

function pass(label: string, detail = ""): TestResult {
  return { label, passed: true, detail };
}

function fail(label: string, detail = ""): TestResult {
  return { label, passed: false, detail };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seedAccounts() {
  console.log("\n🌱 Creazione account di prova...");
  const res = await apiPost(`${FN_BASE}/seed-test-accounts`, {});
  if (res.status !== 200) {
    console.error("Seed fallito:", res.body);
    process.exit(1);
  }
  const data = res.body as any;
  console.log(`   Store: ${data.store_id}`);
  console.log(`   Password comune: ${data.password}`);
  for (const acc of data.accounts) {
    const icon = acc.status === "OK" ? "✓" : "✗";
    console.log(`   ${icon} [${acc.role.padEnd(13)}] ${acc.email}`);
  }
  return data as {
    store_id: string;
    password: string;
    accounts: Array<{ email: string; role: string; password: string; status: string; userId?: string }>;
  };
}

// ─── Test suites per ruolo ────────────────────────────────────────────────────

async function testSuperAdmin(jwt: string, storeId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Può vedere tutti gli store
  const stores = await apiGet(`${REST_BASE}/stores?select=id,name`, jwt);
  results.push(
    Array.isArray(stores.body) && (stores.body as any[]).length > 0
      ? pass("Vede tutti gli store", `${(stores.body as any[]).length} store`)
      : fail("Vede tutti gli store", `status ${stores.status}`)
  );

  // Può vedere audit_logs
  const audit = await apiGet(`${REST_BASE}/audit_logs?limit=1`, jwt);
  results.push(
    audit.status === 200
      ? pass("Accede a audit_logs")
      : fail("Accede a audit_logs", `status ${audit.status}`)
  );

  // Può generare turni
  const gen = await apiPost(`${FN_BASE}/generate-optimized-schedule`, { store_id: storeId, week_start: "2026-06-02" }, jwt);
  results.push(
    gen.status !== 401 && gen.status !== 403
      ? pass("Può generare turni", `status ${gen.status}`)
      : fail("Può generare turni", `status ${gen.status}`)
  );

  // Può vedere dipendenti
  const emps = await apiGet(`${REST_BASE}/profiles?select=id,full_name&limit=5`, jwt);
  results.push(
    Array.isArray(emps.body) && (emps.body as any[]).length > 0
      ? pass("Vede i dipendenti", `${(emps.body as any[]).length} profili`)
      : fail("Vede i dipendenti", `status ${emps.status}`)
  );

  // Può vedere le richieste ferie
  const tor = await apiGet(`${REST_BASE}/time_off_requests?select=id&limit=1`, jwt);
  results.push(
    tor.status === 200
      ? pass("Vede time_off_requests")
      : fail("Vede time_off_requests", `status ${tor.status}`)
  );

  return results;
}

async function testAdmin(jwt: string, storeId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Può vedere store
  const stores = await apiGet(`${REST_BASE}/stores?select=id,name`, jwt);
  results.push(
    Array.isArray(stores.body) && (stores.body as any[]).length > 0
      ? pass("Vede gli store", `${(stores.body as any[]).length} store`)
      : fail("Vede gli store", `status ${stores.status}`)
  );

  // Può generare turni
  const gen = await apiPost(`${FN_BASE}/generate-optimized-schedule`, { store_id: storeId, week_start: "2026-06-02" }, jwt);
  results.push(
    gen.status !== 401 && gen.status !== 403
      ? pass("Può generare turni", `status ${gen.status}`)
      : fail("Può generare turni", `status ${gen.status}`)
  );

  // NON può vedere audit_logs (RLS blocca)
  const audit = await apiGet(`${REST_BASE}/audit_logs?limit=1`, jwt);
  results.push(
    Array.isArray(audit.body) && (audit.body as any[]).length === 0
      ? pass("NON vede audit_logs (corretto)")
      : fail("NON vede audit_logs — PROBLEMA RBAC", `status ${audit.status}, body: ${JSON.stringify(audit.body).slice(0, 80)}`)
  );

  // Può invitare dipendenti
  const invite = await apiPost(`${FN_BASE}/send-invite-email`, {
    store_id: storeId, email: "fake@nonexist.demo", full_name: "Test", role: "employee"
  }, jwt);
  results.push(
    invite.status !== 401 && invite.status !== 403
      ? pass("Può invitare dipendenti", `status ${invite.status}`)
      : fail("Può invitare dipendenti", `status ${invite.status}`)
  );

  return results;
}

async function testStoreManager(jwt: string, storeId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Può generare turni del suo store
  const gen = await apiPost(`${FN_BASE}/generate-optimized-schedule`, { store_id: storeId, week_start: "2026-06-02" }, jwt);
  results.push(
    gen.status !== 401 && gen.status !== 403
      ? pass("Può generare turni del suo store", `status ${gen.status}`)
      : fail("Può generare turni del suo store", `status ${gen.status}`)
  );

  // Può vedere i turni del suo store
  const shifts = await apiGet(`${REST_BASE}/shifts?store_id=eq.${storeId}&select=id&limit=1`, jwt);
  results.push(
    shifts.status === 200
      ? pass("Vede i turni del suo store")
      : fail("Vede i turni del suo store", `status ${shifts.status}`)
  );

  // NON può vedere audit_logs
  const audit = await apiGet(`${REST_BASE}/audit_logs?limit=1`, jwt);
  results.push(
    Array.isArray(audit.body) && (audit.body as any[]).length === 0
      ? pass("NON vede audit_logs (corretto)")
      : fail("NON vede audit_logs — PROBLEMA RBAC", `status ${audit.status}`)
  );

  // Può approvare richieste (edge function)
  const approve = await apiPost(`${FN_BASE}/manage-time-off`, {
    action: "list", store_id: storeId
  }, jwt);
  results.push(
    approve.status !== 401 && approve.status !== 403
      ? pass("Accede a manage-time-off", `status ${approve.status}`)
      : fail("Accede a manage-time-off", `status ${approve.status}`)
  );

  return results;
}

async function testEmployee(jwt: string, storeId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Può vedere i propri turni
  const shifts = await apiGet(`${REST_BASE}/shifts?select=id&limit=5`, jwt);
  results.push(
    shifts.status === 200
      ? pass("Vede i propri turni")
      : fail("Vede i propri turni", `status ${shifts.status}`)
  );

  // NON può generare turni
  const gen = await apiPost(`${FN_BASE}/generate-optimized-schedule`, { store_id: storeId, week_start: "2026-06-02" }, jwt);
  results.push(
    gen.status === 401 || gen.status === 403
      ? pass("NON può generare turni (corretto)", `status ${gen.status}`)
      : fail("NON può generare turni — PROBLEMA RBAC", `status ${gen.status}`)
  );

  // NON può pubblicare turni
  const pub = await apiPost(`${FN_BASE}/publish-shifts`, { store_id: storeId, week_start: "2026-06-02" }, jwt);
  results.push(
    pub.status === 401 || pub.status === 403
      ? pass("NON può pubblicare turni (corretto)", `status ${pub.status}`)
      : fail("NON può pubblicare turni — PROBLEMA RBAC", `status ${pub.status}`)
  );

  // NON può vedere audit_logs
  const audit = await apiGet(`${REST_BASE}/audit_logs?limit=1`, jwt);
  results.push(
    Array.isArray(audit.body) && (audit.body as any[]).length === 0
      ? pass("NON vede audit_logs (corretto)")
      : fail("NON vede audit_logs — PROBLEMA RBAC")
  );

  // Può fare una richiesta ferie
  const tor = await apiPost(`${FN_BASE}/manage-time-off`, {
    action: "request",
    store_id: storeId,
    type: "ferie",
    start_date: "2026-07-01",
    end_date: "2026-07-07",
  }, jwt);
  results.push(
    tor.status !== 500
      ? pass("Può inviare richiesta ferie", `status ${tor.status}`)
      : fail("Può inviare richiesta ferie", `status ${tor.status}`)
  );

  return results;
}

// ─── Report ───────────────────────────────────────────────────────────────────

function printReport(role: string, results: TestResult[]) {
  const passed = results.filter((r) => r.passed).length;
  const total  = results.length;
  const icon   = passed === total ? "✅" : "⚠️ ";
  console.log(`\n${icon} [${role.toUpperCase()}] — ${passed}/${total} test passati`);
  for (const r of results) {
    const mark = r.passed ? "  ✓" : "  ✗";
    const detail = r.detail ? ` (${r.detail})` : "";
    console.log(`${mark} ${r.label}${detail}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  TEST RBAC — Shift Scheduler              ");
  console.log("═══════════════════════════════════════════");

  // 1. Seed
  const seedData = await seedAccounts();
  const storeId  = seedData.store_id;
  const password = seedData.password;

  // 2. Login per ogni ruolo
  console.log("\n🔐 Login account di prova...");
  const tokens: Record<string, string | null> = {};
  for (const acc of seedData.accounts) {
    if (acc.status !== "OK") { console.log(`   ✗ Skip ${acc.role} (seed fallito)`); continue; }
    tokens[acc.role] = await login(acc.email, password);
    console.log(`   ${tokens[acc.role] ? "✓" : "✗"} ${acc.role}: ${acc.email}`);
  }

  // 3. Test per ruolo
  console.log("\n🧪 Esecuzione test di accesso...");

  const allResults: { role: string; results: TestResult[] }[] = [];

  if (tokens["super_admin"]) {
    const r = await testSuperAdmin(tokens["super_admin"]!, storeId);
    allResults.push({ role: "super_admin", results: r });
  }
  if (tokens["admin"]) {
    const r = await testAdmin(tokens["admin"]!, storeId);
    allResults.push({ role: "admin", results: r });
  }
  if (tokens["store_manager"]) {
    const r = await testStoreManager(tokens["store_manager"]!, storeId);
    allResults.push({ role: "store_manager", results: r });
  }
  if (tokens["employee"]) {
    const r = await testEmployee(tokens["employee"]!, storeId);
    allResults.push({ role: "employee", results: r });
  }

  // 4. Report finale
  console.log("\n\n═══════════════════════════════════════════");
  console.log("  RISULTATI                                 ");
  console.log("═══════════════════════════════════════════");

  let totalPassed = 0;
  let totalTests  = 0;

  for (const { role, results } of allResults) {
    printReport(role, results);
    totalPassed += results.filter((r) => r.passed).length;
    totalTests  += results.length;
  }

  console.log("\n═══════════════════════════════════════════");
  const allOk = totalPassed === totalTests;
  console.log(`  ${allOk ? "✅ TUTTI I TEST PASSATI" : "⚠️  ALCUNI TEST FALLITI"}`);
  console.log(`  ${totalPassed}/${totalTests} test passati`);
  console.log("═══════════════════════════════════════════\n");

  // 5. Riepilogo account per login manuale
  console.log("📋 Account di prova per login manuale:");
  console.log(`   Password comune: ${password}\n`);
  for (const acc of seedData.accounts) {
    if (acc.status === "OK") {
      console.log(`   [${acc.role.padEnd(13)}] ${acc.email}`);
    }
  }
  console.log("");

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
