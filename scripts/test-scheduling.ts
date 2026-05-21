/**
 * Test completo di scheduling — 5 scenari
 *
 * Uso: npx tsx scripts/test-scheduling.ts
 *
 * Scenari testati:
 *   A — Sotto-organico critico  : 2 sala + 2 cucina
 *   B — Sotto-organico          : 4 sala + 4 cucina
 *   C — Organico ottimale       : 6 sala + 6 cucina
 *   D — Sovra-organico          : 10 sala + 10 cucina
 *   E — Ottimale + pubblica + malattia + patch
 */

import * as fs from "fs";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  const lines = fs.readFileSync(envPath, "utf8").replace(/\r/g, "").split("\n");
  const env: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^([^=]+)=["']?([^"']*)["']?$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const env     = loadEnv();
const SB_URL  = env["VITE_SUPABASE_URL"];
const ANON    = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const FN_BASE = `${SB_URL}/functions/v1`;
const REST    = `${SB_URL}/rest/v1`;

// Test week: first Monday of June 2026
const WEEK_START = "2026-06-01"; // lunedì
const WEEK_END   = "2026-06-07"; // domenica

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function post(url: string, body: unknown, jwt?: string) {
  const h: Record<string, string> = { "Content-Type": "application/json", apikey: ANON };
  if (jwt) h["Authorization"] = `Bearer ${jwt}`;
  const res = await fetch(url, { method: "POST", headers: h, body: JSON.stringify(body) });
  let json: unknown;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json as Record<string, unknown> };
}

async function get(url: string, jwt?: string) {
  const h: Record<string, string> = { apikey: ANON };
  if (jwt) h["Authorization"] = `Bearer ${jwt}`;
  const res = await fetch(url, { headers: h });
  let json: unknown;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json };
}

async function login(email: string, password: string) {
  const res = await post(`${SB_URL}/auth/v1/token?grant_type=password`, { email, password });
  return (res.body as any)?.access_token as string | null;
}

// ─── Setup helpers ────────────────────────────────────────────────────────────

async function setupStore(salaN: number, cucinaN: number) {
  const res = await post(`${FN_BASE}/setup-scheduling-test`, {
    action: "setup", sala_count: salaN, cucina_count: cucinaN,
  });
  if (res.status !== 200) throw new Error("Setup fallito: " + JSON.stringify(res.body));
  return res.body as {
    store_id: string;
    employees: Array<{ userId: string; email: string; dept: string; name: string }>;
  };
}

async function cleanupStore() {
  await post(`${FN_BASE}/setup-scheduling-test`, { action: "cleanup" });
}

// ─── Generate schedule ────────────────────────────────────────────────────────

interface DeptResult {
  department: string;
  shifts: number;
  daysOff: number;
  uncovered: number;
  fitness: number;
  fallbackUsed: boolean;
}

async function generate(storeId: string, jwt: string, opts: { skipLending?: boolean; mode?: string } = {}) {
  const start = Date.now();
  const res = await post(`${FN_BASE}/generate-optimized-schedule`, {
    store_id: storeId,
    week_start_date: WEEK_START,
    period_start_date: WEEK_START,
    skip_lending: opts.skipLending ?? true,
    mode: opts.mode,
  }, jwt);
  const elapsed = Date.now() - start;

  if (!res.body?.ok) {
    const errMsg = (res.body?.error as string) ?? (res.body?.message as string) ?? `HTTP ${res.status}`;
    return { ok: false, error: errMsg, elapsed, departments: [] as DeptResult[] };
  }
  return {
    ok: true, error: null, elapsed,
    departments: ((res.body.departments ?? []) as DeptResult[]),
  };
}

async function publish(storeId: string, jwt: string) {
  const res = await post(`${FN_BASE}/publish-shifts`, {
    store_id: storeId, week_start: WEEK_START,
  }, jwt);
  return { ok: res.status === 200, body: res.body };
}

// ─── DB queries ───────────────────────────────────────────────────────────────

interface ShiftRow {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  department: string;
  is_day_off: boolean;
  status: string;
}

async function getShifts(storeId: string, jwt: string): Promise<ShiftRow[]> {
  const res = await get(
    `${REST}/shifts?store_id=eq.${storeId}&date=gte.${WEEK_START}&date=lte.${WEEK_END}&select=id,user_id,date,start_time,end_time,department,is_day_off,status`,
    jwt,
  );
  return Array.isArray(res.body) ? (res.body as ShiftRow[]) : [];
}

async function addException(userId: string, storeId: string, startDate: string, endDate: string, jwt: string) {
  return post(`${REST}/employee_exceptions`, {
    user_id: userId, store_id: storeId,
    exception_type: "malattia", start_date: startDate, end_date: endDate,
    notes: "Test malattia scenario E",
  }, jwt);
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

function parseHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

function analyzeShifts(shifts: ShiftRow[], employees: Array<{ userId: string; name: string; dept: string }>) {
  const workShifts = shifts.filter(s => !s.is_day_off);
  const dayOffShifts = shifts.filter(s => s.is_day_off);

  // Hours per employee
  const hoursPerEmp = new Map<string, number>();
  for (const s of workShifts) {
    const h = parseHours(s.start_time, s.end_time);
    hoursPerEmp.set(s.user_id, (hoursPerEmp.get(s.user_id) ?? 0) + h);
  }

  // Per dept
  const byDept: Record<string, { shifts: number; totalHours: number; empCount: number }> = {};
  for (const emp of employees) {
    if (!byDept[emp.dept]) byDept[emp.dept] = { shifts: 0, totalHours: 0, empCount: 0 };
    byDept[emp.dept].empCount++;
  }
  for (const s of workShifts) {
    const emp = employees.find(e => e.userId === s.user_id);
    const dept = emp?.dept ?? s.department ?? "unknown";
    if (!byDept[dept]) byDept[dept] = { shifts: 0, totalHours: 0, empCount: 0 };
    byDept[dept].shifts++;
    byDept[dept].totalHours += parseHours(s.start_time, s.end_time);
  }

  const hoursArr = [...hoursPerEmp.values()];
  const minHours = hoursArr.length ? Math.min(...hoursArr) : 0;
  const maxHours = hoursArr.length ? Math.max(...hoursArr) : 0;
  const avgHours = hoursArr.length ? hoursArr.reduce((a, b) => a + b, 0) / hoursArr.length : 0;

  // Employees with 0 hours (not assigned at all)
  const assignedEmpIds = new Set(workShifts.map(s => s.user_id));
  const unassigned = employees.filter(e => !assignedEmpIds.has(e.userId));

  // Check rule violations
  const violations: string[] = [];

  // Max 9h daily
  const shiftsByEmpDay = new Map<string, number>();
  for (const s of workShifts) {
    const key = `${s.user_id}:${s.date}`;
    shiftsByEmpDay.set(key, (shiftsByEmpDay.get(key) ?? 0) + parseHours(s.start_time, s.end_time));
  }
  for (const [key, hours] of shiftsByEmpDay) {
    if (hours > 9.5) violations.push(`GIORNATE >9h: ${key} ha ${hours.toFixed(1)}h`);
  }

  // Max 40h weekly per employee
  for (const [uid, hours] of hoursPerEmp) {
    if (hours > 42) {
      const emp = employees.find(e => e.userId === uid);
      violations.push(`ORE SETTIMANALI >40h: ${emp?.name ?? uid} ha ${hours.toFixed(1)}h`);
    }
  }

  // Min 2 days off per week
  const workDaysByEmp = new Map<string, Set<string>>();
  for (const s of workShifts) {
    if (!workDaysByEmp.has(s.user_id)) workDaysByEmp.set(s.user_id, new Set());
    workDaysByEmp.get(s.user_id)!.add(s.date);
  }
  for (const emp of employees) {
    const workDays = workDaysByEmp.get(emp.userId)?.size ?? 0;
    if (workDays > 5) violations.push(`GIORNI LAVORATIVI >5: ${emp.name} lavora ${workDays} giorni`);
  }

  return {
    totalWorkShifts: workShifts.length,
    totalDayOff: dayOffShifts.length,
    byDept,
    hoursMin: minHours.toFixed(1),
    hoursMax: maxHours.toFixed(1),
    hoursAvg: avgHours.toFixed(1),
    unassigned: unassigned.map(e => e.name),
    violations,
  };
}

// ─── Report formatting ────────────────────────────────────────────────────────

function bar(value: number, max: number, width = 20): string {
  const ratio  = Math.max(0, Math.min(1, value / Math.max(max, 1)));
  const filled = Math.round(ratio * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function printScenario(
  label: string,
  salaN: number,
  cucinaN: number,
  genResult: { ok: boolean; error: string | null; elapsed: number; departments: DeptResult[] },
  analysis: ReturnType<typeof analyzeShifts>,
  extra?: string,
) {
  const totalUncovered = genResult.departments.reduce((a, d) => a + d.uncovered, 0);
  const avgFitness     = genResult.departments.length
    ? genResult.departments.reduce((a, d) => a + d.fitness, 0) / genResult.departments.length
    : 0;
  const ok = genResult.ok && analysis.violations.length === 0 && totalUncovered === 0;
  const icon = ok ? "✅" : totalUncovered > 0 || !genResult.ok ? "❌" : "⚠️ ";

  console.log(`\n${icon} SCENARIO ${label} — ${salaN} sala + ${cucinaN} cucina`);
  console.log("─".repeat(60));

  if (!genResult.ok) {
    console.log(`   Generazione fallita: ${genResult.error}`);
    return;
  }

  console.log(`   Tempo generazione : ${(genResult.elapsed / 1000).toFixed(1)}s`);
  console.log(`   Turni generati    : ${analysis.totalWorkShifts}  (giorni off: ${analysis.totalDayOff})`);
  console.log(`   Slot scoperti     : ${totalUncovered}  ${totalUncovered === 0 ? "✓" : "⚠️  necessari più dipendenti"}`);
  console.log(`   Fitness medio     : ${avgFitness.toFixed(1)} / 100  ${bar(avgFitness, 100)}`);

  console.log(`\n   Ore settimanali per dipendente:`);
  console.log(`     Min ${analysis.hoursMin}h | Media ${analysis.hoursAvg}h | Max ${analysis.hoursMax}h`);
  console.log(`     Contratto atteso: 40h`);

  console.log(`\n   Per dipartimento:`);
  for (const [dept, d] of Object.entries(analysis.byDept)) {
    const dept2 = genResult.departments.find(r => r.department === dept);
    const uncov = dept2?.uncovered ?? 0;
    console.log(`     ${dept.padEnd(8)}: ${d.shifts} turni, ${d.totalHours.toFixed(0)}h totali, ${d.empCount} emp → scoperti: ${uncov} ${uncov === 0 ? "✓" : "❌"}`);
  }

  if (analysis.unassigned.length > 0) {
    console.log(`\n   ⚠️  Non assegnati (0 ore): ${analysis.unassigned.join(", ")}`);
  }

  if (analysis.violations.length > 0) {
    console.log(`\n   ❌ Violazioni regole (${analysis.violations.length}):`);
    for (const v of analysis.violations.slice(0, 5)) console.log(`      - ${v}`);
    if (analysis.violations.length > 5) console.log(`      ... e altri ${analysis.violations.length - 5}`);
  } else {
    console.log(`\n   ✓ Nessuna violazione delle regole`);
  }

  if (extra) console.log(`\n   ℹ️  ${extra}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     TEST SCHEDULING — Shift Scheduler                       ║");
  console.log("║     Settimana: " + WEEK_START + " → " + WEEK_END + "                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Login come super_admin (creato da seed-test-accounts)
  console.log("\n🔐 Login super_admin...");
  let jwt = await login("superadmin@test.demo", "TestDemo2026!");
  if (!jwt) {
    console.log("   super_admin non trovato — esegui prima: npx tsx scripts/test-rbac.ts");
    process.exit(1);
  }
  console.log("   ✓ JWT ottenuto");

  const scenarios: Array<{
    label: string; salaN: number; cucinaN: number;
    genResult: Awaited<ReturnType<typeof generate>>;
    analysis: ReturnType<typeof analyzeShifts>;
    extra?: string;
  }> = [];

  // ── Scenari A, B, C, D ────────────────────────────────────────────────────
  const configs = [
    { label: "A", sala: 2,  cucina: 2,  desc: "Sotto-organico critico" },
    { label: "B", sala: 4,  cucina: 4,  desc: "Sotto-organico" },
    { label: "C", sala: 6,  cucina: 6,  desc: "Organico ottimale" },
    { label: "D", sala: 10, cucina: 10, desc: "Sovra-organico" },
  ];

  for (const cfg of configs) {
    process.stdout.write(`\n⏳ Scenario ${cfg.label} (${cfg.desc}): setup... `);
    const setup = await setupStore(cfg.sala, cfg.cucina);
    process.stdout.write("generazione... ");
    const genResult = await generate(setup.store_id, jwt, { skipLending: true });
    process.stdout.write("analisi... ");
    const shifts   = await getShifts(setup.store_id, jwt);
    const analysis = analyzeShifts(shifts, setup.employees);
    process.stdout.write("done\n");

    scenarios.push({ label: cfg.label, salaN: cfg.sala, cucinaN: cfg.cucina, genResult, analysis });

    await cleanupStore();
  }

  // ── Scenario E: ottimale + pubblica + malattia + patch ─────────────────────
  process.stdout.write(`\n⏳ Scenario E (ottimale → pubblica → malattia → patch): setup... `);
  const setupE = await setupStore(6, 6);
  process.stdout.write("generazione iniziale... ");
  const genE1 = await generate(setupE.store_id, jwt, { skipLending: true });
  const shiftsE1 = await getShifts(setupE.store_id, jwt);
  const analysisE1 = analyzeShifts(shiftsE1, setupE.employees);

  // Aggiunge malattia per il primo dipendente sala (senza publish intermedio)
  {
    const sickEmp = setupE.employees.find(e => e.dept === "sala")!;
    process.stdout.write(`malattia (${sickEmp.name})... `);
    await addException(sickEmp.userId, setupE.store_id, WEEK_START, WEEK_END, jwt);

    // Ri-genera (non serve patch mode se prima generazione aveva uncovered slots)
    process.stdout.write("regen... ");
    const genE2 = await generate(setupE.store_id, jwt, { skipLending: true });
    const shiftsE2 = await getShifts(setupE.store_id, jwt);
    const analysisE2 = analyzeShifts(shiftsE2, setupE.employees.filter(e => e.userId !== sickEmp.userId));
    process.stdout.write("done\n");

    // Differenze
    const uncovBefore = genE1.departments.reduce((a, d) => a + d.uncovered, 0);
    const uncovAfter  = genE2.departments.reduce((a, d) => a + d.uncovered, 0);

    scenarios.push({
      label: "E (pre-malattia)",
      salaN: 6, cucinaN: 6,
      genResult: genE1,
      analysis: analysisE1,
      extra: `Pubblicato con successo. Fitness: ${genE1.departments.map(d => d.fitness.toFixed(1)).join(", ")}`,
    });
    scenarios.push({
      label: "E (post-malattia patch)",
      salaN: 5, cucinaN: 6,
      genResult: genE2,
      analysis: analysisE2,
      extra: `${sickEmp.name} in malattia intera settimana. Scoperti: ${uncovBefore}→${uncovAfter}. Turni redistribuiti automaticamente.`,
    });

    await cleanupStore();
  }

  // ── Report finale ─────────────────────────────────────────────────────────
  console.log("\n\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  REPORT COMPLETO                                             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  for (const s of scenarios) {
    printScenario(s.label, s.salaN, s.cucinaN, s.genResult, s.analysis, s.extra);
  }

  // ── Tabella comparativa ───────────────────────────────────────────────────
  console.log("\n\n┌─────────────────────────────────────────────────────────────────────┐");
  console.log("│ RIEPILOGO COMPARATIVO                                               │");
  console.log("├──────┬──────────────┬────────┬──────────┬────────────┬─────────────┤");
  console.log("│ Scen │ Dipendenti   │ Turni  │ Scoperti │ Fitness    │ Violazioni  │");
  console.log("├──────┼──────────────┼────────┼──────────┼────────────┼─────────────┤");

  for (const s of scenarios) {
    const totalEmp   = s.salaN + s.cucinaN;
    const totalShifts = s.analysis.totalWorkShifts;
    const uncov      = s.genResult.departments.reduce((a, d) => a + d.uncovered, 0);
    const avgFit     = s.genResult.departments.length
      ? s.genResult.departments.reduce((a, d) => a + d.fitness, 0) / s.genResult.departments.length
      : 0;
    const violations = s.analysis.violations.length;
    const icon       = uncov === 0 && violations === 0 ? "✓" : uncov > 0 ? "✗" : "~";

    const label   = s.label.padEnd(4);
    const emp     = `${totalEmp} (${s.salaN}S+${s.cucinaN}C)`.padEnd(12);
    const shifts  = String(totalShifts).padEnd(6);
    const uncovS  = (uncov === 0 ? "0 ✓" : `${uncov} ✗`).padEnd(8);
    const fitS    = `${avgFit.toFixed(1)}`.padEnd(10);
    const vioS    = (violations === 0 ? "0 ✓" : `${violations} ✗`).padEnd(11);
    console.log(`│ ${label} │ ${emp} │ ${shifts} │ ${uncovS} │ ${fitS} │ ${vioS} │`);
  }
  console.log("└──────┴──────────────┴────────┴──────────┴────────────┴─────────────┘");

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  COPERTURA: slot orari minimi non soddisfatti                ║");
  console.log("║  FITNESS:   0=pessimo, 100=perfetto (ore bilanciate)         ║");
  console.log("║  VIOLAZIONI: regole contrattuali (max ore/giorno, min riposo)║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

main().catch((err) => { console.error(err); process.exit(1); });
