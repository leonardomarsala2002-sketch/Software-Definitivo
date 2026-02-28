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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const me = body.me || null;

    // Get stores
    const { data: stores } = await db.from("stores").select("id, name").eq("is_active", true).order("name");
    if (!stores?.length) throw new Error("No stores");

    // Get IDs to delete (exclude caller)
    const query = db.from("profiles").select("id");
    const { data: others } = me ? await query.neq("id", me) : await query;
    const ids = (others ?? []).map((p: any) => p.id);

    // Delete related data and auth users
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
      await db.from("lending_requests").delete().in("target_user_id", ids);
      await db.from("lending_suggestions").delete().in("user_id", ids);
      await db.from("appointments").delete().in("created_by", ids);
      await db.from("profiles").delete().in("id", ids);

      // Delete auth users (profile cascade should handle it but let's be explicit)
      for (const uid of ids) {
        await db.auth.admin.deleteUser(uid).catch(() => {});
      }
    }

    // Build employees list per store
    let created = 0;
    const errors: string[] = [];

    for (let si = 0; si < stores.length; si++) {
      const store = stores[si];
      const sfx = store.name.replace("Store ", "").substring(0, 3).toLowerCase();
      const all = [
        ...SALA.map((n, i) => ({ ...n, dept: "sala", idx: i })),
        ...CUCINA.map((n, i) => ({ ...n, dept: "cucina", idx: i + 8 })),
      ];

      for (const emp of all) {
        const email = `${emp.first.toLowerCase()}.${emp.last.toLowerCase().replace(/ /g, "")}@${sfx}.demo`;
        const fullName = `${emp.first} ${emp.last}`;

        // 1. Create auth user via admin API
        const { data: authData, error: authErr } = await db.auth.admin.createUser({
          email,
          password: "Demo1234!",
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

        if (authErr) {
          errors.push(`auth ${email}: ${authErr.message}`);
          continue;
        }

        const userId = authData.user.id;

        // 2. Update profile (created by trigger handle_new_user)
        await db.from("profiles").update({
          full_name: fullName,
          email,
          has_seen_tutorial: true,
        }).eq("id", userId);

        // 3. Role
        const { error: e2 } = await db.from("user_roles").upsert(
          { user_id: userId, role: "employee" },
          { onConflict: "user_id" }
        );
        if (e2) errors.push(`role ${email}: ${e2.message}`);

        // 4. Store assignment
        const { error: e3 } = await db.from("user_store_assignments").upsert(
          { user_id: userId, store_id: store.id, is_primary: true },
          { onConflict: "user_id,store_id" }
        );
        if (e3) errors.push(`assignment ${email}: ${e3.message}`);

        // 5. Employee details
        const { error: e4 } = await db.from("employee_details").upsert({
          user_id: userId,
          department: emp.dept,
          weekly_contract_hours: 40,
          is_active: true,
          first_name: emp.first,
          last_name: emp.last,
          role_label: emp.dept === "sala" ? "Cameriere" : "Cuoco",
        }, { onConflict: "user_id" });
        if (e4) errors.push(`details ${email}: ${e4.message}`);

        created++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted: ids.length,
        created,
        stores: stores.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Eliminati ${ids.length} utenti, creati ${created} dipendenti (16 × ${stores.length} store)`,
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
