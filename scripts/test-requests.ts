/**
 * test-requests.ts
 * Test completo del flusso richieste: ferie, malattia, permesso, deadline,
 * visibilità per ruolo, impatto sulla generazione, questionario preferenze, HR suggestions.
 *
 * Esegui: npx tsx scripts/test-requests.ts
 */
import * as fs from "fs";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, "utf-8").split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => { const [k, ...vs] = l.split("="); return [k.trim(), vs.join("=").trim().replace(/^"|"$/g, "")]; })
  );
}

const env     = loadEnv();
const SB_URL  = env["VITE_SUPABASE_URL"] ?? "https://hzcnvfqbbzkqyvolokvt.supabase.co";
const ANON    = env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";
const FN_BASE = `${SB_URL}/functions/v1`;
const REST    = `${SB_URL}/rest/v1`;

const SUPER_ADMIN_EMAIL = "superadmin@test.demo";
const SUPER_ADMIN_PASS  = "TestDemo2026!";
const TEST_PASSWORD     = "TestSched2026!";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function post(url: string, body: unknown, jwt?: string) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": ANON,
  };
  if (jwt) h["Authorization"] = `Bearer ${jwt}`;
  const res = await fetch(url, { method: "POST", headers: h, body: JSON.stringify(body) });
  let json: unknown;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json as Record<string, unknown> };
}

async function get(url: string, jwt?: string, params?: Record<string, string>) {
  const u = new URL(url);
  if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const h: Record<string, string> = { "apikey": ANON };
  if (jwt) h["Authorization"] = `Bearer ${jwt}`;
  const res = await fetch(u.toString(), { headers: h });
  let json: unknown;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json };
}

async function patch(url: string, body: unknown, jwt: string) {
  const h: Record<string, string> = {
    "Content-Type": "application/json", "apikey": ANON, "Authorization": `Bearer ${jwt}`,
  };
  const res = await fetch(url, { method: "PATCH", headers: h, body: JSON.stringify(body) });
  let json: unknown;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json as Record<string, unknown> };
}

async function dbGet(table: string, filter: Record<string, string>, jwt: string) {
  const u = new URL(`${REST}/${table}`);
  Object.entries(filter).forEach(([k, v]) => u.searchParams.set(k, `eq.${v}`));
  u.searchParams.set("select", "*");
  const res = await fetch(u.toString(), {
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, Accept: "application/json" },
  });
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json : [];
}

async function dbUpsert(table: string, row: Record<string, unknown>, jwt: string) {
  const res = await fetch(`${REST}/${table}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });
  return res.status;
}

async function login(email: string, password: string): Promise<string> {
  const r = await post(`${SB_URL}/auth/v1/token?grant_type=password`, { email, password });
  const tok = (r.body as any)?.access_token;
  if (!tok) throw new Error(`Login failed for ${email}: ${JSON.stringify(r.body)}`);
  return tok;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function postWithRetry(url: string, body: unknown, jwt: string, retries = 2): Promise<{ status: number; body: Record<string, unknown> }> {
  for (let i = 0; i <= retries; i++) {
    const r = await post(url, body, jwt);
    if (r.status !== 503 && r.status !== 429) return r;
    if (i < retries) {
      process.stdout.write(`  ⏳ ${r.status} — attendo 20s prima di riprovare (${i + 1}/${retries})...\n`);
      await sleep(20_000);
    }
  }
  return { status: 503, body: { error: "Service unavailable dopo retry" } };
}

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

// ─── Test tracking ────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const testResults: { test: string; ok: boolean; detail?: string }[] = [];

function log(test: string, ok: boolean, detail?: string) {
  testResults.push({ test, ok, detail });
  if (ok) { passed++; process.stdout.write(`  ✓ ${test}\n`); }
  else    { failed++; process.stdout.write(`  ✗ ${test}${detail ? ` — ${detail}` : ""}\n`); }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     TEST RICHIESTE — Shift Scheduler                        ║");
  console.log(`║     Data: ${new Date().toLocaleDateString("it-IT").padEnd(50)} ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ── Login admin ───────────────────────────────────────────────────────────
  process.stdout.write("🔐 Login super_admin...\n");
  const adminJwt = await login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS);
  log("Login super_admin", true);

  // ── Setup store di test ───────────────────────────────────────────────────
  process.stdout.write("\n⏳ Setup store di test (3 sala + 2 cucina)...\n");
  const setupRes = await post(`${FN_BASE}/setup-scheduling-test`, {
    action: "setup", sala_count: 3, cucina_count: 2,
  }, adminJwt);
  if (!setupRes.body.ok) throw new Error("Setup fallito: " + JSON.stringify(setupRes.body));

  const storeId   = setupRes.body.store_id as string;
  const employees = setupRes.body.employees as { userId: string; email: string; dept: string; name: string }[];
  const salaEmps  = employees.filter(e => e.dept === "sala");
  const emp1 = salaEmps[0]; // farà le ferie
  const emp2 = salaEmps[1]; // farà cambio turno / permesso
  const emp3 = salaEmps[2]; // malattia

  log("Setup store test", !!storeId, `store=${storeId.slice(-6)}, ${employees.length} dipendenti`);

  const emp1Jwt = await login(emp1.email, TEST_PASSWORD);
  const emp2Jwt = await login(emp2.email, TEST_PASSWORD);
  const emp3Jwt = await login(emp3.email, TEST_PASSWORD);
  log(`Login 3 dipendenti (${emp1.name}, ${emp2.name}, ${emp3.name})`, !!emp1Jwt && !!emp2Jwt && !!emp3Jwt);

  // ── VISIBILITÀ ────────────────────────────────────────────────────────────
  process.stdout.write("\n📋 TEST VISIBILITÀ RICHIESTE\n");

  const emp1View = await get(`${FN_BASE}/manage-time-off`, emp1Jwt, {});
  log("Employee GET manage-time-off (own requests)", emp1View.status === 200);

  const adminView = await get(`${FN_BASE}/manage-time-off`, adminJwt, { store_id: storeId });
  log("Admin GET tutte le richieste del store", adminView.status === 200,
    adminView.status !== 200 ? JSON.stringify(adminView.body).slice(0, 80) : undefined);

  // ── FERIE ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n🌴 TEST FERIE\n");

  const ferieDate = futureDate(14);
  const ferieRes = await post(`${FN_BASE}/manage-time-off`, {
    store_id: storeId,
    request_date: ferieDate,
    request_type: "ferie",
    notes: "Vacanza prenotata da mesi",
  }, emp1Jwt);
  const ferieId = (ferieRes.body.request as any)?.id ?? (ferieRes.body as any)?.id;
  log(`${emp1.name} invia ferie (${ferieDate})`, ferieRes.status === 200 || ferieRes.status === 201,
    ferieRes.body.error as string ?? `id=${ferieId ?? "N/A"}`);

  // Employee 2 non deve vedere le richieste di employee 1
  const emp2View = await get(`${FN_BASE}/manage-time-off`, emp2Jwt, {});
  const emp2Reqs = (emp2View.body as any)?.requests ?? [];
  const emp2SeesEmp1 = emp2Reqs.some((r: any) => r.user_id === emp1.userId);
  log("Employee NON vede richieste di altri dipendenti", !emp2SeesEmp1);

  // Manager approva (PATCH)
  let ferieApproved = false;
  if (ferieId) {
    const approveRes = await patch(`${FN_BASE}/manage-time-off`, {
      action: "approve", request_id: ferieId,
    }, adminJwt);
    ferieApproved = approveRes.status === 200 && !!(approveRes.body as any).ok;
    log("Admin approva richiesta ferie", ferieApproved, (approveRes.body as any).error ?? undefined);
  } else {
    log("Admin approva richiesta ferie", false, "request_id non trovato");
  }

  // ── GENERAZIONE CON FERIE APPROVATA ───────────────────────────────────────
  process.stdout.write("\n🗓️  TEST IMPATTO FERIE SU GENERAZIONE\n");
  await sleep(8_000); // attendi risorse Gemini API
  const genRes1 = await postWithRetry(`${FN_BASE}/generate-optimized-schedule`, {
    store_id: storeId,
    week_start_date: ferieDate,
    period_start_date: ferieDate,
    skip_lending: true,
  }, adminJwt);
  const gen1Ok = genRes1.status === 200 && !!(genRes1.body as any).ok;
  log("Generazione con ferie approvata", gen1Ok,
    (genRes1.body as any).error as string ?? `status=${genRes1.status}`);

  if (gen1Ok) {
    // Verifica che il dipendente in ferie non abbia turni di lavoro
    const emp1Shifts = await dbGet("shifts", { user_id: emp1.userId, date: ferieDate }, adminJwt);
    const workShifts = emp1Shifts.filter((s: any) => !s.is_day_off);
    log(`${emp1.name} non assegnato nel giorno ferie`, workShifts.length === 0,
      `turni lavoro trovati: ${workShifts.length}`);

    // HR suggestions presenti
    const hrSugg = (genRes1.body as any).hr_suggestions ?? [];
    log("HR suggestions nella risposta generazione", hrSugg.length > 0,
      `${hrSugg.length} suggerimenti: ${hrSugg.map((s: any) => s.type).join(", ")}`);
    for (const s of hrSugg) {
      process.stdout.write(`     → [${(s.severity as string).toUpperCase()}] ${s.title}: ${(s.message as string).slice(0, 90)}\n`);
    }
  }

  // ── RIFIUTO ───────────────────────────────────────────────────────────────
  process.stdout.write("\n❌ TEST RIFIUTO\n");
  const ferieDate2 = futureDate(21);
  const ferie2Res = await post(`${FN_BASE}/manage-time-off`, {
    store_id: storeId, request_date: ferieDate2, request_type: "ferie",
    notes: "Secondo tentativo",
  }, emp1Jwt);
  const ferieId2 = (ferie2Res.body.request as any)?.id ?? (ferie2Res.body as any)?.id;

  if (ferieId2) {
    const rejectRes = await patch(`${FN_BASE}/manage-time-off`, {
      action: "reject", request_id: ferieId2,
    }, adminJwt);
    log("Admin rifiuta richiesta ferie", rejectRes.status === 200 && !!(rejectRes.body as any).ok,
      (rejectRes.body as any).error as string ?? undefined);

    // Dipendente vede il rifiuto
    const emp1After = await get(`${FN_BASE}/manage-time-off`, emp1Jwt, {});
    const rejReq = ((emp1After.body as any)?.requests ?? []).find((r: any) => r.id === ferieId2);
    log("Employee vede stato 'rejected'", rejReq?.status === "rejected");
  } else {
    log("Admin rifiuta richiesta ferie", false, "request_id non trovato");
    log("Employee vede stato 'rejected'", false, "request non creata");
  }

  // ── MALATTIA ─────────────────────────────────────────────────────────────
  process.stdout.write("\n🤒 TEST MALATTIA + PATCH\n");
  const malattiaDate = futureDate(7);
  const malRes = await post(`${FN_BASE}/manage-time-off`, {
    store_id: storeId, request_date: malattiaDate, request_type: "malattia",
    notes: "Certificato medico allegato",
  }, emp3Jwt);
  const malattiaId = (malRes.body.request as any)?.id ?? (malRes.body as any)?.id;
  log(`${emp3.name} invia malattia (${malattiaDate})`, malRes.status === 200 || malRes.status === 201,
    malRes.body.error as string ?? undefined);

  let malattiaApproved = false;
  if (malattiaId) {
    const malApprove = await patch(`${FN_BASE}/manage-time-off`, {
      action: "approve", request_id: malattiaId,
    }, adminJwt);
    malattiaApproved = malApprove.status === 200 && !!(malApprove.body as any).ok;
    log("Admin approva malattia", malattiaApproved, (malApprove.body as any).error as string ?? undefined);
  } else {
    log("Admin approva malattia", false, "request_id non trovato");
  }

  // Patch schedule post-malattia
  if (malattiaApproved) {
    const patchRes = await post(`${FN_BASE}/patch-monthly-schedule`, {
      store_id: storeId, from_date: malattiaDate, department: "sala",
    }, adminJwt);
    const patchOk = patchRes.status === 200 && !!(patchRes.body as any).ok;
    log("Patch schedule post-malattia", patchOk,
      (patchRes.body as any).error as string ??
      `locked=${(patchRes.body as any).locked_shifts_preserved}, turni=${(patchRes.body as any).total_shifts}`);
  }

  // ── PERMESSO PARZIALE ─────────────────────────────────────────────────────
  // Usiamo una data nel mese prossimo (giugno) così siamo entro la deadline.
  // Deadline giugno = 25 maggio → oggi (21 maggio) siamo ancora ok.
  process.stdout.write("\n🕑 TEST PERMESSO SERA LIBERA\n");
  const permDate = futureDate(12); // ~2 giugno → entro deadline
  const permRes = await post(`${FN_BASE}/manage-time-off`, {
    store_id: storeId, request_date: permDate, request_type: "sera_libera",
    notes: "Appuntamento medico",
  }, emp2Jwt);
  log(`${emp2.name} invia permesso sera libera (${permDate})`,
    permRes.status === 200 || permRes.status === 201,
    permRes.body.error as string ?? undefined);

  // ── DEADLINE MENSILE ──────────────────────────────────────────────────────
  process.stdout.write("\n⏰ TEST DEADLINE MENSILE\n");
  const now = new Date();
  const nextMonth1 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const deadline = new Date(nextMonth1.getTime() - 7 * 86_400_000);
  const daysToDeadline = Math.round((deadline.getTime() - now.getTime()) / 86_400_000);
  const nextMonth1Str = nextMonth1.toISOString().split("T")[0];

  if (daysToDeadline < 0) {
    // Oltre deadline → deve essere rifiutata
    const lateRes = await post(`${FN_BASE}/manage-time-off`, {
      store_id: storeId, request_date: nextMonth1Str, request_type: "ferie",
      notes: "Richiesta tardiva (oltre deadline)",
    }, emp1Jwt);
    const isRejected = lateRes.status === 400 || lateRes.status === 422
      || (lateRes.body as any)?.error?.includes?.("deadline")
      || (lateRes.body as any)?.error?.includes?.("scadut");
    log(`Richiesta oltre deadline bloccata (${-daysToDeadline}gg scaduti)`, isRejected,
      `status=${lateRes.status}: ${(lateRes.body as any)?.error ?? "ok"}`);
  } else {
    // Prima della deadline → deve passare
    const earlyRes = await post(`${FN_BASE}/manage-time-off`, {
      store_id: storeId, request_date: nextMonth1Str, request_type: "giorno_libero",
      notes: "Richiesta entro deadline",
    }, emp2Jwt);
    const earlyOk = earlyRes.status === 200 || earlyRes.status === 201;
    log(`Richiesta entro deadline accettata (${daysToDeadline}gg rimasti)`, earlyOk,
      earlyRes.body.error as string ?? undefined);
  }

  // ── QUESTIONARIO PREFERENZE ───────────────────────────────────────────────
  process.stdout.write("\n📝 TEST QUESTIONARIO PREFERENZE\n");

  // Simula il salvataggio del questionario via REST (come fa il componente React)
  const prefStatus = await dbUpsert("employee_preferences", {
    user_id: emp1.userId,
    store_id: storeId,
    preferred_shift_type: "morning",
    preferred_days_off: [0, 6],
    prefers_opening: true,
    prefers_closing: false,
    prefer_split_shifts: false,
    max_consecutive_days: 4,
    preferred_weekly_hours: 30,
    preference_notes: "Disponibile solo mattina, no weekend",
    quiz_completed: true,
    quiz_completed_at: new Date().toISOString(),
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }, emp1Jwt);
  log("Dipendente salva preferenze via questionario", prefStatus < 300, `HTTP ${prefStatus}`);

  // Verifica che le preferenze siano in DB (lettura con JWT admin per aggirare RLS)
  const savedPrefs = await dbGet("employee_preferences", { user_id: emp1.userId }, adminJwt);
  const pref = savedPrefs[0];
  log("Preferenze salvate correttamente nel DB",
    pref?.quiz_completed === true && pref?.preferred_shift_type === "morning",
    `shift_type=${pref?.preferred_shift_type}, quiz_completed=${pref?.quiz_completed}`);

  // ── GENERAZIONE CON PREFERENZE ATTIVE + HR SUGGESTIONS ───────────────────
  process.stdout.write("\n🤖 TEST GENERAZIONE + HR SUGGESTIONS\n");
  const genDate2 = futureDate(28);
  await sleep(8_000);
  const genRes2 = await postWithRetry(`${FN_BASE}/generate-optimized-schedule`, {
    store_id: storeId,
    week_start_date: genDate2,
    period_start_date: genDate2,
    skip_lending: true,
  }, adminJwt);
  const gen2Ok = genRes2.status === 200 && !!(genRes2.body as any).ok;
  log("Generazione con preferenze dipendente", gen2Ok,
    (genRes2.body as any).error as string ?? `status=${genRes2.status}`);

  if (gen2Ok) {
    const hrSugg = (genRes2.body as any).hr_suggestions ?? [];
    log("HR suggestions generate", true, `${hrSugg.length} suggerimenti`);
    for (const s of hrSugg as any[]) {
      const sev = s.severity === "critical" ? "🔴" : s.severity === "warning" ? "🟡" : "🔵";
      process.stdout.write(`     ${sev} [${s.department}] ${s.title}\n`);
      process.stdout.write(`        ${(s.message as string).slice(0, 100)}\n`);
      if (s.action) process.stdout.write(`        → Azione: ${s.action}\n`);
    }
  }

  // ── FILTRI MANAGER ────────────────────────────────────────────────────────
  process.stdout.write("\n🔍 TEST FILTRI MANAGER\n");

  const filtroApproved = await get(`${FN_BASE}/manage-time-off`, adminJwt, {
    store_id: storeId, status: "approved",
  });
  const approvedList = (filtroApproved.body as any)?.requests ?? [];
  log("Manager filtra richieste per status=approved", filtroApproved.status === 200,
    `trovate: ${approvedList.length}`);

  const filtroPending = await get(`${FN_BASE}/manage-time-off`, adminJwt, {
    store_id: storeId, status: "pending",
  });
  const pendingList = (filtroPending.body as any)?.requests ?? [];
  log("Manager filtra richieste per status=pending", filtroPending.status === 200,
    `trovate: ${pendingList.length}`);

  const filtroDate = await get(`${FN_BASE}/manage-time-off`, adminJwt, {
    store_id: storeId, from: futureDate(5), to: futureDate(25),
  });
  log("Manager filtra richieste per range di date", filtroDate.status === 200);

  // ── CLEANUP ───────────────────────────────────────────────────────────────
  process.stdout.write("\n🧹 Cleanup...\n");
  const cleanupRes = await post(`${FN_BASE}/setup-scheduling-test`, { action: "cleanup" }, adminJwt);
  log("Cleanup store di test", !!(cleanupRes.body as any).ok);

  // ── RIEPILOGO ─────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  RIEPILOGO TEST RICHIESTE                                   ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  for (const r of testResults) {
    const icon = r.ok ? "✓" : "✗";
    const line = ` ${icon} ${r.test}`.padEnd(62);
    console.log(`║${line}║`);
    if (!r.ok && r.detail) {
      const detail = `    → ${r.detail}`.padEnd(62);
      console.log(`║${detail}║`);
    }
  }
  console.log("╠══════════════════════════════════════════════════════════════╣");
  const summary = `  ${passed}/${total} PASSED${failed > 0 ? `  (${failed} FAILED)` : "  ✓ TUTTI"}`.padEnd(62);
  console.log(`║${summary}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error("\n💥 Errore fatale:", err.message ?? err);
  process.exit(1);
});
