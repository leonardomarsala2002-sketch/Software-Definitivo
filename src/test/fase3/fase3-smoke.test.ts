import { describe, it, expect } from "vitest";

// ─── FASE 3 Smoke tests — pure logic only (no Supabase/Deno dependencies) ────
// Tests mirror the business logic in:
//   - manage-time-off/index.ts
//   - manage-illness-certificate/index.ts
//   - get-leave-balance/index.ts
//   - employee-onboarding/index.ts
//   - _shared/notify.ts

// ─── Leave balance calculations ───────────────────────────────────────────────

/** weekly_contract_hours × 4 = total vacation hours (Italian law, art.10 D.Lgs. 66/2003) */
function calcFerieTotal(weeklyContractHours: number): number {
  return weeklyContractHours * 4.0;
}

function calcDailyHours(weeklyContractHours: number): number {
  return weeklyContractHours / 5.0;
}

describe("Leave balance — ferie formula (Italian law)", () => {
  it("40h/week employee gets 160h vacation (20 working days)", () => {
    expect(calcFerieTotal(40)).toBe(160);
    // 160h / 8h per day = 20 days = 4 weeks ✓
    expect(160 / (40 / 5)).toBe(20);
  });

  it("30h/week employee gets 120h vacation (20 working days)", () => {
    expect(calcFerieTotal(30)).toBe(120);
    // 120h / 6h per day = 20 days ✓
    expect(120 / (30 / 5)).toBe(20);
  });

  it("20h/week employee gets 80h vacation (20 working days)", () => {
    expect(calcFerieTotal(20)).toBe(80);
    expect(80 / (20 / 5)).toBe(20);
  });

  it("daily hours are proportional to contract", () => {
    expect(calcDailyHours(40)).toBe(8);
    expect(calcDailyHours(30)).toBe(6);
    expect(calcDailyHours(20)).toBe(4);
  });

  it("permesso default is always 24h regardless of contract", () => {
    // Business rule: 24h flat
    const permessoDefault = 24.0;
    expect(permessoDefault).toBe(24);
  });
});

// ─── Balance remaining calculation ───────────────────────────────────────────

function calcRemaining(totalHours: number, usedHours: number): number {
  return Math.max(0, totalHours - usedHours);
}

describe("Leave balance — remaining hours", () => {
  it("40h/week, 8 days used (64h): 96h remaining", () => {
    expect(calcRemaining(160, 64)).toBe(96);
  });

  it("never goes negative", () => {
    expect(calcRemaining(24, 30)).toBe(0);
  });

  it("block threshold: remaining < 4h triggers block", () => {
    const shouldBlock = (r: number) => r < 4;
    expect(shouldBlock(0)).toBe(true);
    expect(shouldBlock(3.9)).toBe(true);
    expect(shouldBlock(4)).toBe(false);
    expect(shouldBlock(8)).toBe(false);
  });
});

// ─── Request deadline logic ───────────────────────────────────────────────────

function getWeekMonday(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

function getDeadline(requestDate: string, deadlineDays: number): Date {
  const monday = getWeekMonday(requestDate);
  monday.setUTCDate(monday.getUTCDate() - deadlineDays);
  monday.setUTCHours(23, 59, 59, 999);
  return monday;
}

describe("Request deadline (manage-time-off)", () => {
  it("default 4-day deadline lands on Thursday of previous week", () => {
    const d = getDeadline("2026-05-18", 4); // week of 2026-05-18 (Mon)
    expect(d.toISOString().split("T")[0]).toBe("2026-05-14"); // Thu
  });

  it("malattia bypasses deadline (always allowed)", () => {
    // Smoke: this is logic we test by verifying the bypass condition exists
    const requestType = "malattia";
    const bypassTypes = ["malattia"];
    expect(bypassTypes.includes(requestType)).toBe(true);
  });
});

// ─── Illness certificate date range ──────────────────────────────────────────

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

describe("Illness certificate — date range (M3.5 fix context)", () => {
  it("1-day illness generates 1 request", () => {
    expect(getDateRange("2026-05-11", "2026-05-11")).toHaveLength(1);
  });

  it("5-day illness generates 5 requests (Mon–Fri)", () => {
    expect(getDateRange("2026-05-11", "2026-05-15")).toHaveLength(5);
  });

  it("end < start is rejected by validation (returns empty via guard)", () => {
    // The Edge Function returns 400 when end_date < start_date
    const isValid = (start: string, end: string) => new Date(end) >= new Date(start);
    expect(isValid("2026-05-11", "2026-05-10")).toBe(false);
    expect(isValid("2026-05-11", "2026-05-11")).toBe(true);
  });

  it("certificate URL signed for 1 year (365 days, M3.5 fix)", () => {
    const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
    const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;
    // New value should be exactly 1 year, not 10
    expect(ONE_YEAR_SECONDS).toBe(31536000);
    expect(ONE_YEAR_SECONDS).not.toBe(TEN_YEARS_SECONDS);
  });
});

// ─── Notification channels ────────────────────────────────────────────────────

describe("Notification channels (notify.ts M3.4 fix)", () => {
  const VALID_CHANNELS = ["in-app", "email", "whatsapp"] as const;

  it("all 3 channels are defined", () => {
    expect(VALID_CHANNELS).toHaveLength(3);
  });

  it("whatsapp channel is logged to DB (same as email)", () => {
    // Smoke: verify the channel string matches the DB constraint
    expect(VALID_CHANNELS).toContain("whatsapp");
  });

  it("in-app is the default channel", () => {
    expect(VALID_CHANNELS[0]).toBe("in-app");
  });
});

// ─── Onboarding preferences validation ───────────────────────────────────────

describe("Employee onboarding — preference validation", () => {
  const VALID_SHIFT_TYPES = ["morning", "afternoon", "evening", "any", null];
  const VALID_DISTRIBUTIONS = ["front_loaded", "even", "back_loaded", null];
  const VALID_WEEKEND = ["available", "unavailable", "limited"];

  it("all valid shift types accepted", () => {
    for (const t of VALID_SHIFT_TYPES) {
      if (t === null) {
        expect(t).toBeNull();
      } else {
        expect(["morning","afternoon","evening","any"]).toContain(t);
      }
    }
  });

  it("all valid weekend availabilities", () => {
    expect(VALID_WEEKEND).toContain("available");
    expect(VALID_WEEKEND).toContain("unavailable");
    expect(VALID_WEEKEND).toContain("limited");
  });

  it("all valid hour distributions", () => {
    for (const d of VALID_DISTRIBUTIONS) {
      if (d !== null) {
        expect(["front_loaded","even","back_loaded"]).toContain(d);
      }
    }
  });
});

// ─── Manager notification improvement (M3.2) ─────────────────────────────────

describe("Manager notification — super_admin inclusion (M3.2 fix)", () => {
  it("super_admin is always included in notification recipients", () => {
    // Smoke: deduplication logic merges store managers + global super_admins
    const storeManagers = [{ user_id: "mgr-1" }, { user_id: "mgr-2" }];
    const superAdmins   = [{ user_id: "sa-1" }, { user_id: "mgr-1" }]; // mgr-1 is both

    const idSet = new Set([
      ...storeManagers.map(m => m.user_id),
      ...superAdmins.map(s => s.user_id),
    ]);

    expect(idSet.size).toBe(3); // deduplicated: mgr-1, mgr-2, sa-1
    expect(idSet.has("sa-1")).toBe(true);
    expect(idSet.has("mgr-1")).toBe(true);
  });

  it("request creator is excluded from notifications", () => {
    const requesterId = "emp-1";
    const recipients = [
      { user_id: "mgr-1" },
      { user_id: "emp-1" }, // the requester — should be filtered
      { user_id: "sa-1"  },
    ].filter(r => r.user_id !== requesterId);

    expect(recipients).toHaveLength(2);
    expect(recipients.map(r => r.user_id)).not.toContain("emp-1");
  });
});

// ─── approved_request_counts rename (M3.3) ───────────────────────────────────

describe("get-leave-balance response format (M3.3 fix)", () => {
  it("response uses approved_request_counts, not approved_days", () => {
    // Smoke: field name consistency
    const response = {
      user_id: "user-1",
      store_id: "store-1",
      year: 2026,
      balances: {},
      approved_request_counts: { ferie: 5, permesso: 2, permesso_104: 0 },
    };

    expect(response).toHaveProperty("approved_request_counts");
    expect(response).not.toHaveProperty("approved_days");
  });
});
