import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Calcola primo e ultimo giorno del mese prossimo (UTC)
function getNextMonthPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based: 0=Jan … 11=Dec
  const nextMonth = m === 11 ? 0 : m + 1;
  const nextYear  = m === 11 ? y + 1 : y;

  const first = new Date(Date.UTC(nextYear, nextMonth, 1));
  const last  = new Date(Date.UTC(nextYear, nextMonth + 1, 0)); // day 0 = last day of nextMonth

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { periodStart: fmt(first), periodEnd: fmt(last) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const publicAppUrl = Deno.env.get("PUBLIC_APP_URL");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { periodStart, periodEnd } = getNextMonthPeriod();
    const monthLabel = new Date(periodStart + "T00:00:00Z")
      .toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });

    // Get all active stores with generation enabled
    const { data: stores } = await adminClient
      .from("stores")
      .select("id, name")
      .eq("is_active", true);

    if (!stores || stores.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No active stores" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter stores with generation_enabled
    const enabledStores: { id: string; name: string }[] = [];
    for (const store of stores) {
      const { data: rules } = await adminClient
        .from("store_rules")
        .select("generation_enabled")
        .eq("store_id", store.id)
        .single();
      if (rules?.generation_enabled) {
        enabledStores.push(store);
      }
    }

    if (enabledStores.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No stores with generation enabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { store: string; department: string; status: string; error?: string }[] = [];

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: Generate monthly shifts for ALL stores (skip lending)
    // ═══════════════════════════════════════════════════════════════════
    console.log(`[PHASE 1] Generating monthly shifts for ${enabledStores.length} stores — ${periodStart}..${periodEnd}`);

    const phase1Promises = enabledStores.map(async (store) => {
      try {
        // Upsert schedule_period record
        await adminClient.rpc("upsert_schedule_period", {
          p_store_id:    store.id,
          p_period_start: periodStart,
          p_period_end:   periodEnd,
          p_status:       "generating",
        });

        const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-optimized-schedule`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store_id: store.id,
            period_start_date: periodStart,
            period_end_date:   periodEnd,
            skip_lending: true, // Phase 1: no lending
          }),
        });
        const genBody = await genRes.json();
        if (genRes.ok && genBody.departments) {
          for (const d of genBody.departments) {
            results.push({ store: store.name, department: d.department, status: "success" });
          }
          return { store, departments: genBody.departments, ok: true };
        } else {
          results.push({ store: store.name, department: "all", status: "failed", error: genBody.error ?? "Unknown error" });
          return { store, departments: [], ok: false };
        }
      } catch (e) {
        results.push({ store: store.name, department: "all", status: "failed", error: (e as Error).message });
        return { store, departments: [], ok: false };
      }
    });

    const phase1Results = await Promise.all(phase1Promises);

    // Update lifecycle_status to "generated" for all successfully completed runs
    for (const p1 of phase1Results) {
      if (!p1.ok) continue;
      await adminClient
        .from("generation_runs")
        .update({ lifecycle_status: "generated" } as any)
        .eq("store_id", p1.store.id)
        .eq("week_start", periodStart)
        .eq("status", "completed");
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: Cross-store lending detection
    // ═══════════════════════════════════════════════════════════════════
    console.log(`[PHASE 2] Running cross-store lending detection`);

    let totalLendingSuggestions = 0;

    // Build list of all dates in the period
    const periodDates: string[] = [];
    const d = new Date(periodStart + "T00:00:00Z");
    const endD = new Date(periodEnd + "T00:00:00Z");
    while (d <= endD) {
      periodDates.push(d.toISOString().split("T")[0]);
      d.setUTCDate(d.getUTCDate() + 1);
    }

    // Group stores by city for lending
    const storeMap = new Map<string, { id: string; name: string; city: string }[]>();
    const { data: allStoresWithCity } = await adminClient
      .from("stores").select("id, name, city").eq("is_active", true);

    for (const s of (allStoresWithCity ?? [])) {
      if (!s.city) continue;
      const arr = storeMap.get(s.city) ?? [];
      arr.push(s);
      storeMap.set(s.city, arr);
    }

    // Only process cities with 2+ stores
    for (const [, cityStores] of storeMap) {
      if (cityStores.length < 2) continue;

      const storeAnalysis = new Map<string, {
        uncovered: { date: string; hour: number; dept: string }[];
        surplus: { date: string; hour: number; dept: string; userId: string; startTime: string; endTime: string }[];
      }>();

      for (const store of cityStores) {
        const uncovered: { date: string; hour: number; dept: string }[] = [];
        const surplus: { date: string; hour: number; dept: string; userId: string; startTime: string; endTime: string }[] = [];

        for (const dept of ["sala", "cucina"]) {
          const [covRes, shiftsRes] = await Promise.all([
            adminClient.from("store_coverage_requirements").select("*")
              .eq("store_id", store.id).eq("department", dept),
            adminClient.from("shifts").select("id, user_id, start_time, end_time, is_day_off, date, department")
              .eq("store_id", store.id).eq("department", dept)
              .eq("status", "draft").gte("date", periodStart).lte("date", periodEnd),
          ]);

          const covData = covRes.data ?? [];
          const shiftData = (shiftsRes.data ?? []).filter((s: any) => !s.is_day_off && s.start_time && s.end_time);

          for (const dateStr of periodDates) {
            const dow = (new Date(dateStr + "T00:00:00Z").getUTCDay() + 6) % 7;
            const dayCov = covData.filter((c: any) => c.day_of_week === dow);

            for (const cov of dayCov) {
              const h = parseInt(cov.hour_slot.split(":")[0], 10);
              const covering: typeof shiftData = [];

              for (const s of shiftData) {
                if (s.date !== dateStr) continue;
                const sh = parseInt(String(s.start_time).split(":")[0], 10);
                let eh = parseInt(String(s.end_time).split(":")[0], 10);
                if (eh === 0) eh = 24;
                if (h >= sh && h < eh) covering.push(s);
              }

              const diff = covering.length - cov.min_staff_required;
              if (diff < 0) {
                uncovered.push({ date: dateStr, hour: h, dept });
              } else if (diff > 0) {
                for (const s of covering.slice(-diff)) {
                  surplus.push({
                    date: dateStr, hour: h, dept,
                    userId: s.user_id,
                    startTime: String(s.start_time),
                    endTime: String(s.end_time),
                  });
                }
              }
            }
          }
        }

        storeAnalysis.set(store.id, { uncovered, surplus });
      }

      for (const targetStore of cityStores) {
        const targetData = storeAnalysis.get(targetStore.id);
        if (!targetData || targetData.uncovered.length === 0) continue;

        for (const slot of targetData.uncovered) {
          for (const sourceStore of cityStores) {
            if (sourceStore.id === targetStore.id) continue;
            const sourceData = storeAnalysis.get(sourceStore.id);
            if (!sourceData) continue;

            const match = sourceData.surplus.find(
              (s: any) => s.date === slot.date && s.hour === slot.hour && s.dept === slot.dept
            );
            if (!match) continue;

            const { data: targetRun } = await adminClient
              .from("generation_runs").select("id, suggestions")
              .eq("store_id", targetStore.id).eq("department", slot.dept)
              .eq("week_start", periodStart).eq("status", "completed")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!targetRun) continue;

            const { data: existing } = await adminClient
              .from("lending_suggestions").select("id")
              .eq("generation_run_id", targetRun.id)
              .eq("user_id", match.userId)
              .eq("suggested_date", slot.date)
              .maybeSingle();

            if (existing) continue;

            const { data: profile } = await adminClient
              .from("profiles").select("full_name").eq("id", match.userId).single();
            const candidateName = profile?.full_name ?? "Dipendente";

            await adminClient.from("lending_suggestions").insert({
              generation_run_id: targetRun.id,
              user_id: match.userId,
              source_store_id: sourceStore.id,
              target_store_id: targetStore.id,
              department: slot.dept,
              suggested_date: slot.date,
              suggested_start_time: match.startTime,
              suggested_end_time: match.endTime,
              reason: `${candidateName} da ${sourceStore.name} (surplus alle ${slot.hour}:00). Turno: ${match.startTime.slice(0,5)}-${match.endTime.slice(0,5)}`,
              status: "pending",
            } as any);

            totalLendingSuggestions++;
            break;
          }
        }
      }
    }

    console.log(`[PHASE 2] Created ${totalLendingSuggestions} lending suggestions`);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: Notifications to store admins
    // ═══════════════════════════════════════════════════════════════════
    for (const p1 of phase1Results) {
      if (!p1.ok) continue;
      const store = p1.store;
      const deptResults = p1.departments;
      const totalUncovered = deptResults.reduce((sum: number, d: any) => sum + (d.uncovered ?? 0), 0);
      const hasCritical = totalUncovered > 0;

      if (resendKey && publicAppUrl) {
        const { data: assignments } = await adminClient
          .from("user_store_assignments")
          .select("user_id")
          .eq("store_id", store.id);

        const adminUserIds = (assignments ?? []).map((a: any) => a.user_id);

        if (adminUserIds.length > 0) {
          const { data: roles } = await adminClient
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", adminUserIds);

          const adminIds = (roles ?? [])
            .filter((r: any) => r.role === "admin" || r.role === "super_admin")
            .map((r: any) => r.user_id);

          if (adminIds.length > 0) {
            const { data: profiles } = await adminClient
              .from("profiles")
              .select("id, email, full_name")
              .in("id", adminIds);

            const emailSubject = totalUncovered > 0
              ? `⚠️ Turni ${monthLabel} generati con problemi – ${store.name}`
              : `Turni ${monthLabel} generati – da validare – ${store.name}`;

            const warningBanner = totalUncovered > 0
              ? `<tr><td style="padding:12px 36px;background:#fef2f2;border-left:4px solid #ef4444;">
<p style="margin:0;font-size:13px;color:#dc2626;font-weight:600;">⚠️ Attenzione: ${totalUncovered} fascia/e oraria/e non coperta/e</p>
</td></tr>`
              : "";

            const deptRows = deptResults.map((d: any) =>
              `<tr><td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;font-size:13px;color:#18181b;text-transform:capitalize;">${d.department}</td><td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;font-size:13px;color:#18181b;text-align:center;">${d.shifts ?? 0}</td><td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;font-size:13px;text-align:center;color:${(d.uncovered ?? 0) > 0 ? "#dc2626" : "#16a34a"};font-weight:600;">${d.uncovered ?? 0}</td></tr>`
            ).join("");

            const deptTable = deptResults.length > 0
              ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;margin:12px 0;">
<thead><tr style="background:#f4f4f5;"><th style="padding:8px 12px;font-size:11px;color:#71717a;text-align:left;font-weight:600;">Reparto</th><th style="padding:8px 12px;font-size:11px;color:#71717a;text-align:center;font-weight:600;">Turni</th><th style="padding:8px 12px;font-size:11px;color:#71717a;text-align:center;font-weight:600;">Non coperti</th></tr></thead>
<tbody>${deptRows}</tbody></table>`
              : "";

            for (const p of profiles ?? []) {
              if (!p.email) continue;
              try {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${resendKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: "Shift Scheduler <onboarding@resend.dev>",
                    to: [p.email],
                    subject: emailSubject,
                    html: `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="padding:40px 36px 16px;text-align:center;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Turni mensili generati</h1>
<p style="margin:0;font-size:14px;color:#71717a;">${store.name}</p>
<p style="margin:8px 0 0;font-size:13px;color:#a1a1aa;">${monthLabel} &mdash; ${periodStart} → ${periodEnd}</p>
</td></tr>
${warningBanner}
<tr><td style="padding:24px 36px;">
<p style="font-size:14px;color:#52525b;margin:0 0 12px;">La generazione automatica dei turni mensili è stata completata. Rivedi il draft, poi usa "Valida" per verificare le regole e infine pubblica.</p>
${deptTable}
</td></tr>
<tr><td style="padding:16px 36px 32px;text-align:center;">
<a href="${publicAppUrl}team-calendar" style="display:inline-block;background:#18181b;color:#fff;font-size:14px;font-weight:600;padding:12px 36px;border-radius:10px;text-decoration:none;">Rivedi turni</a>
</td></tr></table></td></tr></table></body></html>`,
                  }),
                });
              } catch (emailErr) {
                console.error(`Email to ${p.email} failed:`, emailErr);
              }

              try {
                await adminClient.from("notifications").insert({
                  user_id: p.id,
                  store_id: store.id,
                  type: "draft_ready",
                  title: hasCritical ? "⚠️ Turni mensili generati con problemi" : "Turni mensili generati – da validare",
                  message: hasCritical
                    ? `I turni per ${monthLabel} sono stati generati per ${store.name} con ${totalUncovered} slot non coperti. Risolvi i problemi, valida e poi pubblica.`
                    : `I turni per ${monthLabel} sono stati generati per ${store.name}. Rivedi il draft, valida le regole e pubblica quando sei pronto.`,
                  link: "/team-calendar",
                });
              } catch (notifErr) {
                console.error(`Notification insert failed for ${p.id}:`, notifErr);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, results, lending_suggestions: totalLendingSuggestions, period: { start: periodStart, end: periodEnd } }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cron-generate-shifts error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
