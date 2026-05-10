import { describe, it, expect } from "vitest";

// ─── Pure logic mirrored from manage-time-off/index.ts ───────────────────────
// These functions contain no Supabase/Deno dependencies and can be unit-tested
// independently. Any change to the originals should be mirrored here.

function getWeekMonday(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

function getDeadline(requestDate: string, deadlineDays: number): Date {
  const monday = getWeekMonday(requestDate);
  monday.setUTCDate(monday.getUTCDate() - deadlineDays);
  monday.setUTCHours(23, 59, 59, 999);
  return monday;
}

// ─── Pure logic mirrored from get-leave-balance/index.ts ─────────────────────

function calcRemaining(totalHours: number, usedHours: number): number {
  return Math.max(0, totalHours - usedHours);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD from a Date in UTC */
function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ─── getWeekMonday ────────────────────────────────────────────────────────────

describe("getWeekMonday", () => {
  it("Monday returns itself", () => {
    expect(toDateStr(getWeekMonday("2026-05-11"))).toBe("2026-05-11");
  });

  it("Wednesday returns the Monday of that week", () => {
    expect(toDateStr(getWeekMonday("2026-05-13"))).toBe("2026-05-11");
  });

  it("Sunday returns the Monday of that week (not next Monday)", () => {
    expect(toDateStr(getWeekMonday("2026-05-17"))).toBe("2026-05-11");
  });

  it("Saturday returns the Monday of that week", () => {
    expect(toDateStr(getWeekMonday("2026-05-16"))).toBe("2026-05-11");
  });

  it("handles month boundary correctly", () => {
    // 2026-06-01 is a Monday
    expect(toDateStr(getWeekMonday("2026-06-01"))).toBe("2026-06-01");
    // 2026-05-31 is a Sunday → Monday is 2026-05-25
    expect(toDateStr(getWeekMonday("2026-05-31"))).toBe("2026-05-25");
  });

  it("handles year boundary correctly", () => {
    // 2026-01-01 is a Thursday → Monday is 2025-12-29
    expect(toDateStr(getWeekMonday("2026-01-01"))).toBe("2025-12-29");
  });
});

// ─── getDeadline ──────────────────────────────────────────────────────────────

describe("getDeadline (default deadlineDays=4)", () => {
  it("request for next Monday: deadline is previous Thursday at 23:59:59", () => {
    // Request date = 2026-05-18 (Monday). Week Monday = 2026-05-18. Minus 4 days = 2026-05-14 (Thursday)
    const deadline = getDeadline("2026-05-18", 4);
    expect(toDateStr(deadline)).toBe("2026-05-14");
    expect(deadline.getUTCHours()).toBe(23);
    expect(deadline.getUTCMinutes()).toBe(59);
    expect(deadline.getUTCSeconds()).toBe(59);
  });

  it("request for mid-week: deadline is still previous Thursday (based on week Monday)", () => {
    // Request date = 2026-05-13 (Wednesday). Week Monday = 2026-05-11. Minus 4 = 2026-05-07 (Thursday)
    const deadline = getDeadline("2026-05-13", 4);
    expect(toDateStr(deadline)).toBe("2026-05-07");
  });

  it("deadline with 0 days returns Monday of the target week at 23:59:59", () => {
    const deadline = getDeadline("2026-05-13", 0);
    expect(toDateStr(deadline)).toBe("2026-05-11");
  });

  it("deadline with 7 days returns Monday of previous week", () => {
    // Week Monday = 2026-05-11. Minus 7 = 2026-05-04 (Monday)
    const deadline = getDeadline("2026-05-13", 7);
    expect(toDateStr(deadline)).toBe("2026-05-04");
  });

  it("deadline correctly crosses month boundaries", () => {
    // Request = 2026-06-03 (Wednesday). Week Monday = 2026-06-01. Minus 4 = 2026-05-28 (Thursday)
    const deadline = getDeadline("2026-06-03", 4);
    expect(toDateStr(deadline)).toBe("2026-05-28");
  });
});

// ─── calcRemaining (leave balance) ───────────────────────────────────────────

describe("calcRemaining", () => {
  it("returns difference when total > used", () => {
    expect(calcRemaining(160, 40)).toBe(120);
  });

  it("returns 0 when total === used (exhausted)", () => {
    expect(calcRemaining(24, 24)).toBe(0);
  });

  it("returns 0 (not negative) when used > total", () => {
    expect(calcRemaining(24, 30)).toBe(0);
  });

  it("handles decimal hours correctly", () => {
    expect(calcRemaining(7.5, 3.75)).toBeCloseTo(3.75);
  });

  it("handles zero total hours", () => {
    expect(calcRemaining(0, 0)).toBe(0);
  });
});

// ─── Request type validation ──────────────────────────────────────────────────

describe("VALID_TYPES for time-off requests", () => {
  const VALID_TYPES = [
    "giorno_libero",
    "mattina_libera",
    "sera_libera",
    "ferie",
    "permesso",
    "permesso_104",
    "malattia",
  ];

  it("contains all 7 valid request types", () => {
    expect(VALID_TYPES).toHaveLength(7);
  });

  it("includes all new FASE 3 types", () => {
    expect(VALID_TYPES).toContain("giorno_libero");
    expect(VALID_TYPES).toContain("mattina_libera");
    expect(VALID_TYPES).toContain("sera_libera");
    expect(VALID_TYPES).toContain("permesso_104");
    expect(VALID_TYPES).toContain("malattia");
  });

  it("does not contain old deprecated types", () => {
    expect(VALID_TYPES).not.toContain("full_day_off");
    expect(VALID_TYPES).not.toContain("morning_off");
    expect(VALID_TYPES).not.toContain("evening_off");
  });

  it("rejects invalid types", () => {
    const invalid = ["vacation", "sick", "off", "day_off", "half_day", ""];
    for (const type of invalid) {
      expect(VALID_TYPES.includes(type)).toBe(false);
    }
  });

  it("permesso_104 is separate from permesso", () => {
    expect(VALID_TYPES.indexOf("permesso")).not.toBe(VALID_TYPES.indexOf("permesso_104"));
  });
});

// ─── Illness certificate date range ──────────────────────────────────────────

describe("illness certificate date range generation", () => {
  /** Mirrors the day-iteration logic from manage-illness-certificate/index.ts */
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

  it("single day returns one date", () => {
    expect(getDateRange("2026-05-11", "2026-05-11")).toEqual(["2026-05-11"]);
  });

  it("three consecutive days returns all three", () => {
    expect(getDateRange("2026-05-11", "2026-05-13")).toEqual([
      "2026-05-11",
      "2026-05-12",
      "2026-05-13",
    ]);
  });

  it("correctly crosses month boundary", () => {
    const dates = getDateRange("2026-05-30", "2026-06-02");
    expect(dates).toEqual(["2026-05-30", "2026-05-31", "2026-06-01", "2026-06-02"]);
  });

  it("correctly crosses year boundary", () => {
    const dates = getDateRange("2025-12-30", "2026-01-02");
    expect(dates).toEqual(["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"]);
  });

  it("week-long illness produces 7 dates", () => {
    const dates = getDateRange("2026-05-11", "2026-05-17");
    expect(dates).toHaveLength(7);
  });
});

// ─── Leave balance blocking threshold ────────────────────────────────────────

describe("balance blocking logic (block_over_balance)", () => {
  /** Mirrors the check in manage-time-off POST when block_over_balance=true */
  function shouldBlock(remainingHours: number): boolean {
    return remainingHours < 4;
  }

  it("blocks when remaining hours is 0", () => {
    expect(shouldBlock(0)).toBe(true);
  });

  it("blocks when remaining hours is 3 (< 4)", () => {
    expect(shouldBlock(3)).toBe(true);
  });

  it("does not block when remaining hours is exactly 4", () => {
    expect(shouldBlock(4)).toBe(false);
  });

  it("does not block when remaining hours is 8 (one full day)", () => {
    expect(shouldBlock(8)).toBe(false);
  });

  it("blocks on fractional remaining hours below threshold", () => {
    expect(shouldBlock(3.9)).toBe(true);
  });
});
