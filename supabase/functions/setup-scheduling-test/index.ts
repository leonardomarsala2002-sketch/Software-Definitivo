/**
 * Edge Function: setup-scheduling-test
 *
 * Crea uno store di test completo con regole, orari, copertura e dipendenti.
 * Usata dallo script scripts/test-scheduling.ts.
 *
 * Actions:
 *   setup   — crea store + N dipendenti per dipartimento, ritorna store_id e info
 *   cleanup — elimina lo store di test e tutti i dati correlati
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/auth.ts";

const TEST_STORE_NAME = "__scheduling_test__";
const TEST_PASSWORD   = "TestSched2026!";

// ─── Employee name pool ───────────────────────────────────────────────────────
const SALA_NAMES = [
  { first: "Luca",    last: "Rossi"     },
  { first: "Marco",   last: "Bianchi"   },
  { first: "Sara",    last: "Ferrara"   },
  { first: "Giulia",  last: "Conti"     },
  { first: "Elena",   last: "Marino"    },
  { first: "Andrea",  last: "Costa"     },
  { first: "Marta",   last: "Romano"    },
  { first: "Davide",  last: "Greco"     },
  { first: "Chiara",  last: "Gallo"     },
  { first: "Matteo",  last: "Ricci"     },
];
const CUCINA_NAMES = [
  { first: "Paolo",     last: "Bruno"     },
  { first: "Simone",    last: "Lombardi"  },
  { first: "Federica",  last: "Moretti"   },
  { first: "Roberto",   last: "Barbieri"  },
  { first: "Valentina", last: "Orlando"   },
  { first: "Lorenzo",   last: "Gatti"     },
  { first: "Irene",     last: "Pellegrini"},
  { first: "Fabio",     last: "Caruso"    },
  { first: "Alessia",   last: "Marini"    },
  { first: "Giorgio",   last: "Ferrari"   },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action         = body.action ?? "setup";
    const salaN: number  = body.sala_count  ?? 6;
    const cucinaN: number = body.cucina_count ?? 6;

    // ── CLEANUP ────────────────────────────────────────────────────────────────
    if (action === "cleanup") {
      const { data: testStores } = await db
        .from("stores").select("id").eq("name", TEST_STORE_NAME);

      for (const store of (testStores ?? [])) {
        // Delete all user auth accounts assigned to this store
        const { data: assignments } = await db
          .from("user_store_assignments").select("user_id").eq("store_id", store.id);
        for (const a of (assignments ?? [])) {
          await db.auth.admin.deleteUser(a.user_id).catch(() => {});
        }
        // Cascade deletes everything else
        await db.from("stores").delete().eq("id", store.id);
      }
      return new Response(JSON.stringify({ ok: true, action: "cleanup" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SETUP ──────────────────────────────────────────────────────────────────

    // 1. Clean up any previous test store
    const { data: existing } = await db.from("stores").select("id").eq("name", TEST_STORE_NAME);
    for (const s of (existing ?? [])) {
      const { data: asgn } = await db.from("user_store_assignments").select("user_id").eq("store_id", s.id);
      for (const a of (asgn ?? [])) await db.auth.admin.deleteUser(a.user_id).catch(() => {});
      await db.from("stores").delete().eq("id", s.id);
    }

    // 2. Create store
    const { data: store, error: storeErr } = await db
      .from("stores")
      .insert({ name: TEST_STORE_NAME, address: "Via Test 1, Milano", is_active: true })
      .select("id").single();
    if (storeErr) throw new Error("store: " + storeErr.message);
    const storeId = store.id;

    // 3. Store rules (standard restaurant)
    await db.from("store_rules").insert({
      store_id: storeId,
      max_daily_hours_per_employee: 9,
      max_weekly_hours_per_employee: 40,
      max_daily_team_hours: 80,
      max_daily_team_hours_sala: 45,
      max_split_shifts_per_employee: 2,
      max_split_shifts_per_employee_per_week: 4,
      mandatory_days_off_per_week: 2,
      generation_enabled: true,
    });

    // 4. Opening hours: Mon-Sun 11:00-00:00
    const openingRows = Array.from({ length: 7 }, (_, i) => ({
      store_id: storeId,
      day_of_week: i,          // 0=domenica, 1=lunedì ...
      opening_time: "11:00",
      closing_time: "23:59",
    }));
    await db.from("store_opening_hours").insert(openingRows);

    // 5. Coverage requirements — ristorante tipico
    // Scala con il numero di dipendenti: base 1 staff, peak 2 staff nei weekend
    // Così anche con 2 dipendenti è teoricamente copribile
    const coverageRows: unknown[] = [];
    const salaLunch  = [12, 13, 14];
    const salaDinner = [18, 19, 20, 21, 22];
    const cucLunch   = [11, 12, 13, 14];
    const cucDinner  = [17, 18, 19, 20, 21, 22];

    // Base staff: 1 in settimana, 2 nel weekend — scalabile
    const baseStaff = (dow: number) => (dow === 5 || dow === 6) ? 2 : 1;

    for (let dow = 0; dow <= 6; dow++) {
      for (const h of salaLunch)  coverageRows.push({ store_id: storeId, day_of_week: dow, hour_slot: `${h}:00`, department: "sala",   min_staff_required: baseStaff(dow) });
      for (const h of salaDinner) coverageRows.push({ store_id: storeId, day_of_week: dow, hour_slot: `${h}:00`, department: "sala",   min_staff_required: baseStaff(dow) });
      for (const h of cucLunch)   coverageRows.push({ store_id: storeId, day_of_week: dow, hour_slot: `${h}:00`, department: "cucina", min_staff_required: baseStaff(dow) });
      for (const h of cucDinner)  coverageRows.push({ store_id: storeId, day_of_week: dow, hour_slot: `${h}:00`, department: "cucina", min_staff_required: baseStaff(dow) });
    }
    await db.from("store_coverage_requirements").insert(coverageRows);

    // 6. Allowed shift times
    const allowedTimes = [
      { store_id: storeId, department: "sala",   start_time: "11:00", end_time: "16:00" },
      { store_id: storeId, department: "sala",   start_time: "17:00", end_time: "23:59" },
      { store_id: storeId, department: "sala",   start_time: "11:00", end_time: "23:59" },
      { store_id: storeId, department: "cucina", start_time: "10:30", end_time: "16:00" },
      { store_id: storeId, department: "cucina", start_time: "16:30", end_time: "23:59" },
      { store_id: storeId, department: "cucina", start_time: "10:30", end_time: "23:59" },
    ];
    await db.from("store_shift_allowed_times").insert(allowedTimes); // ignore error if table missing

    // 7. Create employees
    const employees: Array<{ userId: string; email: string; dept: string; name: string }> = [];
    const sfx = storeId.slice(-6);

    async function createEmployee(first: string, last: string, dept: "sala" | "cucina", idx: number) {
      const email = `${first.toLowerCase()}.${last.toLowerCase().replace(/ /g, "")}${idx}@${sfx}.sched`;
      const fullName = `${first} ${last}`;

      const { data: authData, error } = await db.auth.admin.createUser({
        email, password: TEST_PASSWORD, email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error || !authData?.user) throw new Error(`create user ${email}: ${error?.message}`);
      const uid = authData.user.id;

      await db.from("profiles").update({ full_name: fullName, email, has_seen_tutorial: true }).eq("id", uid);
      await db.from("user_roles").upsert({ user_id: uid, role: "employee" }, { onConflict: "user_id" });
      await db.from("user_store_assignments").upsert({ user_id: uid, store_id: storeId, is_primary: true }, { onConflict: "user_id,store_id" });
      await db.from("employee_details").upsert({
        user_id: uid, department: dept, weekly_contract_hours: 40,
        is_active: true, first_name: first, last_name: last,
        role_label: dept === "sala" ? "Cameriere" : "Cuoco",
      }, { onConflict: "user_id" });

      // Full availability: Mon-Sun 08:00-24:00
      const availRows = Array.from({ length: 7 }, (_, dow) => ({
        user_id: uid, store_id: storeId, day_of_week: dow,
        start_time: "08:00", end_time: "23:59",
        availability_type: "available",
      }));
      await db.from("employee_availability").upsert(availRows, { onConflict: "user_id,store_id,day_of_week,start_time" });

      // Employee stats (hour bank starting at 0)
      await db.from("employee_stats").upsert({
        user_id: uid, store_id: storeId, current_balance: 0, hours_worked: 0,
      }, { onConflict: "user_id,store_id" }); // ignore error if column mismatch

      employees.push({ userId: uid, email, dept, name: fullName });
    }

    // Create sala employees
    for (let i = 0; i < Math.min(salaN, SALA_NAMES.length); i++) {
      await createEmployee(SALA_NAMES[i].first, SALA_NAMES[i].last, "sala", i);
    }
    // Create cucina employees
    for (let i = 0; i < Math.min(cucinaN, CUCINA_NAMES.length); i++) {
      await createEmployee(CUCINA_NAMES[i].first, CUCINA_NAMES[i].last, "cucina", i);
    }

    return new Response(JSON.stringify({
      ok: true,
      store_id: storeId,
      sala_count: salaN,
      cucina_count: cucinaN,
      employees,
      password: TEST_PASSWORD,
      coverage_note: "Pranzo 12-15 (2 sala/2 cuc), Cena 18-23 (3+sala/3+cuc). Ven/Sab +1 staff.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
