import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Calculate the ISO week that just ended (the week containing "today" if called Sunday night)
    const now = new Date();
    // Get Monday of current week (ISO: Mon=1)
    const dayOfWeek = now.getUTCDay(); // 0=Sun
    const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekMonday = new Date(now);
    weekMonday.setUTCDate(weekMonday.getUTCDate() - diffToMon);
    const weekStart = weekMonday.toISOString().split("T")[0];

    const weekSunday = new Date(weekMonday);
    weekSunday.setUTCDate(weekSunday.getUTCDate() + 6);
    const weekEnd = weekSunday.toISOString().split("T")[0];

    console.log(`Archiving shifts for week ${weekStart} to ${weekEnd}`);

    // 1. Mark all published shifts for this week as archived
    const { data: archivedShifts, error: archiveErr } = await adminClient
      .from("shifts")
      .update({ status: "archived" })
      .eq("status", "published")
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .select("id, user_id, store_id, department, start_time, end_time, is_day_off, date");

    if (archiveErr) throw new Error(`Archive error: ${archiveErr.message}`);

    const archived = archivedShifts ?? [];
    console.log(`Archived ${archived.length} shifts`);

    // 2. Calculate actual hours worked per employee per store and update hour_balance
    // Group by user_id + store_id
    const hoursMap = new Map<string, { userId: string; storeId: string; totalHours: number }>();

    for (const s of archived) {
      if (s.is_day_off || !s.start_time || !s.end_time) continue;
      const key = `${s.user_id}::${s.store_id}`;
      const entry = hoursMap.get(key) ?? { userId: s.user_id, storeId: s.store_id, totalHours: 0 };
      const sh = parseInt(s.start_time.split(":")[0], 10);
      let eh = parseInt(s.end_time.split(":")[0], 10);
      if (eh === 0) eh = 24;
      entry.totalHours += (eh - sh);
      hoursMap.set(key, entry);
    }

    // Get contract hours for each employee
    const userIds = [...new Set(archived.map(s => s.user_id))];
    if (userIds.length > 0) {
      const { data: details } = await adminClient
        .from("employee_details")
        .select("user_id, weekly_contract_hours")
        .in("user_id", userIds);

      const contractMap = new Map((details ?? []).map(d => [d.user_id, d.weekly_contract_hours]));

      for (const [, entry] of hoursMap) {
        const contractHours = contractMap.get(entry.userId) ?? 40;
        const delta = entry.totalHours - contractHours; // positive = overtime, negative = undertime
        // Clamp to ±5h flexibility
        const clampedDelta = Math.max(-5, Math.min(5, delta));

        // Upsert employee_stats
        const { data: existing } = await adminClient
          .from("employee_stats")
          .select("id, current_balance")
          .eq("user_id", entry.userId)
          .eq("store_id", entry.storeId)
          .maybeSingle();

        if (existing) {
          await adminClient
            .from("employee_stats")
            .update({
              current_balance: Number(existing.current_balance) + clampedDelta,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await adminClient
            .from("employee_stats")
            .insert({
              user_id: entry.userId,
              store_id: entry.storeId,
              current_balance: clampedDelta,
            });
        }
      }
    }

    // 3. Also mark generation_runs for this week as archived
    await adminClient
      .from("generation_runs")
      .update({ status: "archived" })
      .eq("status", "published")
      .gte("week_start", weekStart)
      .lte("week_start", weekEnd);

    return new Response(JSON.stringify({
      ok: true,
      archived_shifts: archived.length,
      employees_updated: hoursMap.size,
      week: { start: weekStart, end: weekEnd },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("archive-shifts error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
