import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/auth.ts";

const TEST_PASSWORD = "TestDemo2026!";

const TEST_ACCOUNTS = [
  { email: "superadmin@test.demo", role: "super_admin",    name: "Super Admin Test"    },
  { email: "admin@test.demo",      role: "admin",           name: "Admin Test"          },
  { email: "manager@test.demo",    role: "store_manager",   name: "Store Manager Test"  },
  { email: "employee@test.demo",   role: "employee",        name: "Employee Test"       },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ensure at least one store exists
    let { data: stores } = await db.from("stores").select("id, name").eq("is_active", true).limit(1);
    let storeId: string;

    if (!stores?.length) {
      const { data: newStore, error } = await db
        .from("stores")
        .insert({ name: "Store Demo", address: "Via Test 1, Milano" })
        .select("id")
        .single();
      if (error) throw new Error("Impossibile creare store: " + error.message);
      storeId = newStore.id;
    } else {
      storeId = stores[0].id;
    }

    const results: Array<{
      email: string; role: string; password: string; status: string; userId?: string;
    }> = [];

    for (const account of TEST_ACCOUNTS) {
      // Delete if already exists
      const { data: existing } = await db.auth.admin.listUsers();
      const existingUser = existing?.users?.find((u) => u.email === account.email);
      if (existingUser) {
        await db.auth.admin.deleteUser(existingUser.id).catch(() => {});
      }

      // Create auth user
      const { data: authData, error: authErr } = await db.auth.admin.createUser({
        email: account.email,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      });

      if (authErr || !authData?.user) {
        results.push({ email: account.email, role: account.role, password: TEST_PASSWORD, status: "ERROR: " + authErr?.message });
        continue;
      }

      const uid = authData.user.id;

      // Profile
      await db.from("profiles").update({ full_name: account.name, email: account.email, has_seen_tutorial: true }).eq("id", uid);

      // Role
      await db.from("user_roles").upsert({ user_id: uid, role: account.role }, { onConflict: "user_id" });

      // Store assignment
      await db.from("user_store_assignments").upsert(
        { user_id: uid, store_id: storeId, is_primary: true },
        { onConflict: "user_id,store_id" },
      );

      // Employee details for store_manager and employee
      if (account.role === "store_manager" || account.role === "employee") {
        await db.from("employee_details").upsert({
          user_id: uid,
          department: "sala",
          weekly_contract_hours: 40,
          is_active: true,
          first_name: account.name.split(" ")[0],
          last_name: account.name.split(" ").slice(1).join(" "),
          role_label: account.role === "store_manager" ? "Responsabile" : "Dipendente",
        }, { onConflict: "user_id" });
      }

      results.push({ email: account.email, role: account.role, password: TEST_PASSWORD, status: "OK", userId: uid });
    }

    return new Response(JSON.stringify({
      success: true,
      store_id: storeId,
      password: TEST_PASSWORD,
      accounts: results,
      note: "Tutti gli account usano la stessa password: " + TEST_PASSWORD,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
