import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Service role client to bypass RLS
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Upsert employee_details
    const { data: existing } = await admin
      .from("employee_details")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: insertErr } = await admin.from("employee_details").insert({
        user_id: userId,
        department: "sala",
        weekly_contract_hours: 40,
        is_active: true,
      });
      if (insertErr) throw insertErr;
    }

    // 2. Get primary store
    const { data: primaryStore } = await admin
      .from("user_store_assignments")
      .select("store_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();

    if (!primaryStore) {
      return new Response(
        JSON.stringify({ error: "Nessuno store primario assegnato" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storeId = primaryStore.store_id;

    // 3. Insert availability (Monday 09-18) if not exists
    const { data: existingAvail } = await admin
      .from("employee_availability")
      .select("id")
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .eq("day_of_week", 0)
      .eq("start_time", "09:00")
      .maybeSingle();

    if (!existingAvail) {
      const { error: availErr } = await admin.from("employee_availability").insert({
        user_id: userId,
        store_id: storeId,
        day_of_week: 0,
        start_time: "09:00",
        end_time: "18:00",
        availability_type: "available",
      });
      if (availErr) throw availErr;
    }

    // 4. Insert exception (ferie, 3 days from tomorrow) if none exist for that range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endDate = new Date(tomorrow);
    endDate.setDate(endDate.getDate() + 2);

    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const { data: existingExc } = await admin
      .from("employee_exceptions")
      .select("id")
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .eq("exception_type", "ferie")
      .eq("start_date", fmt(tomorrow))
      .maybeSingle();

    if (!existingExc) {
      const { error: excErr } = await admin.from("employee_exceptions").insert({
        user_id: userId,
        store_id: storeId,
        exception_type: "ferie",
        start_date: fmt(tomorrow),
        end_date: fmt(endDate),
        notes: "Seed test data - ferie",
        created_by: userId,
      });
      if (excErr) throw excErr;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Dati test dipendente creati" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
