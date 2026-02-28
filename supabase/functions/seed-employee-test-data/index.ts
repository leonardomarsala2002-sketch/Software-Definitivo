import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SALA = [
  { first: "Marco", last: "Rossi" },
  { first: "Giulia", last: "Bianchi" },
  { first: "Alessandro", last: "Giordano" },
  { first: "Valentina", last: "Greco" },
  { first: "Davide", last: "Fontana" },
  { first: "Chiara", last: "Costa" },
  { first: "Lorenzo", last: "Moretti" },
  { first: "Martina", last: "Lombardi" },
];

const CUCINA = [
  { first: "Luca", last: "Colombo" },
  { first: "Sara", last: "Ricci" },
  { first: "Andrea", last: "Marino" },
  { first: "Elisa", last: "Conti" },
  { first: "Matteo", last: "De Luca" },
  { first: "Federica", last: "Mancini" },
  { first: "Simone", last: "Barbieri" },
  { first: "Alessia", last: "Galli" },
];

function mkId(si: number, ei: number): string {
  const s = String(si).padStart(4, "0");
  const e = String(ei).padStart(4, "0");
  return `d0000000-${s}-${e}-0000-000000000001`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get caller id from body or skip deletion of self
    const body = await req.json().catch(() => ({}));
    const me = body.me || null;

    // Get stores
    const { data: stores } = await db.from("stores").select("id, name").eq("is_active", true).order("name");
    if (!stores?.length) throw new Error("No stores");

    // Get IDs to delete
    const query = db.from("profiles").select("id");
    const { data: others } = me ? await query.neq("id", me) : await query;
    const ids = (others ?? []).map(p => p.id);

    // Batch delete related tables
    if (ids.length > 0) {
      const tables = [
        "shifts", "employee_monthly_stats", "employee_stats", "employee_constraints",
        "employee_exceptions", "employee_availability", "employee_details",
        "generation_adjustments", "suggestion_outcomes", "time_off_requests",
        "notifications", "conversation_participants", "user_store_assignments", "user_roles",
      ];
      for (const t of tables) {
        await db.from(t).delete().in("user_id", ids);
      }
      // Special FK columns
      await db.from("lending_requests").delete().in("target_user_id", ids);
      await db.from("lending_suggestions").delete().in("user_id", ids);
      await db.from("appointments").delete().in("created_by", ids);
      await db.from("profiles").delete().in("id", ids);
    }

    // Build batch arrays
    const profiles: any[] = [];
    const roles: any[] = [];
    const assignments: any[] = [];
    const details: any[] = [];

    for (let si = 0; si < stores.length; si++) {
      const store = stores[si];
      const all = [
        ...SALA.map((n, i) => ({ ...n, dept: "sala", idx: i })),
        ...CUCINA.map((n, i) => ({ ...n, dept: "cucina", idx: i + 8 })),
      ];

      for (const emp of all) {
        const id = mkId(si + 1, emp.idx + 1);
        const sfx = store.name.replace("Store ", "").substring(0, 3).toLowerCase();
        profiles.push({
          id,
          full_name: `${emp.first} ${emp.last}`,
          email: `${emp.first.toLowerCase()}.${emp.last.toLowerCase().replace(/ /g, "")}@${sfx}.demo`,
          has_seen_tutorial: true,
        });
        roles.push({ user_id: id, role: "employee" });
        assignments.push({ user_id: id, store_id: store.id, is_primary: true });
        details.push({
          user_id: id,
          department: emp.dept,
          weekly_contract_hours: 40,
          is_active: true,
          first_name: emp.first,
          last_name: emp.last,
          role_label: emp.dept === "sala" ? "Cameriere" : "Cuoco",
        });
      }
    }

    // Batch upserts
    const { error: e1 } = await db.from("profiles").upsert(profiles, { onConflict: "id" });
    if (e1) throw new Error(`profiles: ${e1.message}`);

    const { error: e2 } = await db.from("user_roles").upsert(roles, { onConflict: "user_id" });
    if (e2) throw new Error(`roles: ${e2.message}`);

    const { error: e3 } = await db.from("user_store_assignments").upsert(assignments, { onConflict: "user_id,store_id" });
    if (e3) throw new Error(`assignments: ${e3.message}`);

    const { error: e4 } = await db.from("employee_details").upsert(details, { onConflict: "user_id" });
    if (e4) throw new Error(`details: ${e4.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: ids.length,
        created: profiles.length,
        stores: stores.length,
        message: `Eliminati ${ids.length}, creati ${profiles.length} dipendenti (16 × ${stores.length} store)`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("Seed error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
