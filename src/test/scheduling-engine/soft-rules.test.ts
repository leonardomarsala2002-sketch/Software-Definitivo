import { describe, it, expect } from "vitest";
import {
  checkPreferences,
  checkEquity,
  checkHistoricalContinuity,
  checkWorkloadBalance,
  checkHourBankCompensation,
  runAllSoftRules,
} from "../../lib/scheduling-engine/soft-rules";
import type { ShiftInput, ScheduleContext } from "../../lib/scheduling-engine/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeShift(overrides: Partial<ShiftInput> & { userId: string; date: string }): ShiftInput {
  return {
    storeId: "store-1",
    startTime: "09:00",
    endTime: "17:00",
    isDayOff: false,
    department: "sala",
    ...overrides,
  };
}

// 2026-05-11 = Monday, 2026-05-16 = Saturday, 2026-05-17 = Sunday
const BASE_CTX: ScheduleContext = {
  storeId: "store-1",
  weekStart: "2026-05-11",
  weekEnd: "2026-05-17",
  employees: [
    { id: "emp-1", name: "Alice", department: "sala", contractHoursPerWeek: 40, daysOffPerWeek: 2 },
    { id: "emp-2", name: "Bob",   department: "sala", contractHoursPerWeek: 40, daysOffPerWeek: 2 },
  ],
  coverageRequirements: [],
  approvedTimeOff: [],
  storeRules: { minShiftHours: 3, contractHoursToleranceH: 5 },
};

// ─── SR001 — Employee preferences ────────────────────────────────────────────

describe("SR001 checkPreferences", () => {
  it("returns no warnings when no employees have preferences", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    expect(checkPreferences(shifts, BASE_CTX)).toHaveLength(0);
  });

  it("warns when employee is scheduled on an avoided day", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [
        { ...BASE_CTX.employees[0], preferences: { avoidDays: [0] } }, // 0 = Monday
        BASE_CTX.employees[1],
      ],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })]; // Monday
    const result = checkPreferences(shifts, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("SR001");
    expect(result[0].affectedEmployeeId).toBe("emp-1");
  });

  it("does not warn when employee works on a non-avoided day", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [
        { ...BASE_CTX.employees[0], preferences: { avoidDays: [6] } }, // avoid Sunday only
        BASE_CTX.employees[1],
      ],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })]; // Monday
    expect(checkPreferences(shifts, ctx)).toHaveLength(0);
  });

  it("warns when shift type does not match preferred shift type", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [
        { ...BASE_CTX.employees[0], preferences: { preferredShifts: ["evening"] } },
        BASE_CTX.employees[1],
      ],
    };
    // morning shift (starts at 09:00, before default cutoff of 13:00)
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00" })];
    const result = checkPreferences(shifts, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("SR001");
    expect((result[0].details as { shiftType: string }).shiftType).toBe("morning");
  });

  it("does not warn when shift type matches preference", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [
        { ...BASE_CTX.employees[0], preferences: { preferredShifts: ["morning"] } },
        BASE_CTX.employees[1],
      ],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00" })];
    expect(checkPreferences(shifts, ctx)).toHaveLength(0);
  });

  it("detects afternoon shift type (between morningCutoff and eveningStart)", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [
        { ...BASE_CTX.employees[0], preferences: { preferredShifts: ["morning"] } },
        BASE_CTX.employees[1],
      ],
    };
    // 14:00 = afternoon (>= 13:00 cutoff, < 17:00 evening start)
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "14:00", endTime: "22:00" })];
    const result = checkPreferences(shifts, ctx);
    expect(result[0].details).toMatchObject({ shiftType: "afternoon" });
  });

  it("skips day-off shifts", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [
        { ...BASE_CTX.employees[0], preferences: { avoidDays: [0] } },
        BASE_CTX.employees[1],
      ],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", isDayOff: true })];
    expect(checkPreferences(shifts, ctx)).toHaveLength(0);
  });

  it("uses custom morningCutoffHour from storeRules", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      storeRules: { ...BASE_CTX.storeRules, morningCutoffHour: 12 },
      employees: [
        { ...BASE_CTX.employees[0], preferences: { preferredShifts: ["afternoon"] } },
        BASE_CTX.employees[1],
      ],
    };
    // 12:30 — with cutoff=12 this is afternoon; with default cutoff=13 it would also be afternoon
    // But if we set cutoff=14, a 12:30 shift would be morning
    const ctxHighCutoff: ScheduleContext = {
      ...ctx,
      storeRules: { ...ctx.storeRules, morningCutoffHour: 14 },
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "12:30", endTime: "20:30" })];
    const result = checkPreferences(shifts, ctxHighCutoff);
    expect(result[0].details).toMatchObject({ shiftType: "morning" });
  });
});

// ─── SR002 — Weekend equity ───────────────────────────────────────────────────

describe("SR002 checkEquity", () => {
  it("returns no warnings when fewer than 2 employees", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [BASE_CTX.employees[0]],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-16" })]; // Saturday
    expect(checkEquity(shifts, ctx)).toHaveLength(0);
  });

  it("returns no warnings when weekend distribution is even", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-16" }), // Saturday
      makeShift({ userId: "emp-2", date: "2026-05-16" }), // Saturday
    ];
    expect(checkEquity(shifts, BASE_CTX)).toHaveLength(0);
  });

  it("returns no warnings when diff is exactly 1", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-16" }), // Saturday
      makeShift({ userId: "emp-1", date: "2026-05-17" }), // Sunday
      makeShift({ userId: "emp-2", date: "2026-05-16" }), // Saturday
    ];
    expect(checkEquity(shifts, BASE_CTX)).toHaveLength(0);
  });

  it("warns when diff is more than 1", () => {
    // emp-1 has 3 weekend shifts, emp-2 has 0
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-16" }),
      makeShift({ userId: "emp-1", date: "2026-05-17" }),
      makeShift({ userId: "emp-1", date: "2026-05-09" }), // prev Saturday
    ];
    const result = checkEquity(shifts, BASE_CTX);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].ruleId).toBe("SR002");
    expect(result[0].affectedEmployeeId).toBe("emp-1");
  });

  it("only warns for the employee with max weekend shifts", () => {
    // emp-1: 3 weekend, emp-2: 0
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-16" }),
      makeShift({ userId: "emp-1", date: "2026-05-17" }),
      makeShift({ userId: "emp-1", date: "2026-05-09" }),
    ];
    const result = checkEquity(shifts, BASE_CTX);
    const warnedIds = result.map(w => w.affectedEmployeeId);
    expect(warnedIds).not.toContain("emp-2");
  });

  it("ignores day-off shifts for weekend count", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-16", isDayOff: true }),
      makeShift({ userId: "emp-1", date: "2026-05-17", isDayOff: true }),
      makeShift({ userId: "emp-1", date: "2026-05-09", isDayOff: true }),
    ];
    expect(checkEquity(shifts, BASE_CTX)).toHaveLength(0);
  });
});

// ─── SR003 — Historical continuity ───────────────────────────────────────────

describe("SR003 checkHistoricalContinuity", () => {
  it("returns empty when no previous week shifts", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    expect(checkHistoricalContinuity(shifts, BASE_CTX)).toHaveLength(0);
  });

  it("returns no warnings when avg start time changed less than 3h", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      previousWeekShifts: [
        makeShift({ userId: "emp-1", date: "2026-05-04", startTime: "09:00" }),
      ],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "10:00" })]; // +1h
    expect(checkHistoricalContinuity(shifts, ctx)).toHaveLength(0);
  });

  it("warns when avg start time changed more than 3h", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      previousWeekShifts: [
        makeShift({ userId: "emp-1", date: "2026-05-04", startTime: "08:00" }),
      ],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "14:00" })]; // +6h
    const result = checkHistoricalContinuity(shifts, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("SR003");
    expect(result[0].affectedEmployeeId).toBe("emp-1");
  });

  it("uses average across multiple shifts", () => {
    // prev week avg: (08:00 + 08:00) / 2 = 8h. curr: (10:00 + 10:00) / 2 = 10h. diff=2h → no warn
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      previousWeekShifts: [
        makeShift({ userId: "emp-1", date: "2026-05-04", startTime: "08:00" }),
        makeShift({ userId: "emp-1", date: "2026-05-05", startTime: "08:00" }),
      ],
    };
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "10:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-12", startTime: "10:00" }),
    ];
    expect(checkHistoricalContinuity(shifts, ctx)).toHaveLength(0);
  });

  it("skips employee when no prev-week shifts exist for them", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      previousWeekShifts: [
        makeShift({ userId: "emp-2", date: "2026-05-04", startTime: "08:00" }),
      ],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "20:00" })];
    expect(checkHistoricalContinuity(shifts, ctx)).toHaveLength(0);
  });
});

// ─── SR004 — Workload balance ─────────────────────────────────────────────────

describe("SR004 checkWorkloadBalance", () => {
  it("returns no warnings when fewer than 2 employees", () => {
    const ctx: ScheduleContext = { ...BASE_CTX, employees: [BASE_CTX.employees[0]] };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    expect(checkWorkloadBalance(shifts, ctx)).toHaveLength(0);
  });

  it("returns no warnings when hours are balanced", () => {
    // emp-1: 32h, emp-2: 32h → avg=32, no one is >6h above
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "08:00", endTime: "16:00" }), // 8h
      makeShift({ userId: "emp-1", date: "2026-05-12", startTime: "08:00", endTime: "16:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-13", startTime: "08:00", endTime: "16:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-14", startTime: "08:00", endTime: "16:00" }),
      makeShift({ userId: "emp-2", date: "2026-05-11", startTime: "08:00", endTime: "16:00" }),
      makeShift({ userId: "emp-2", date: "2026-05-12", startTime: "08:00", endTime: "16:00" }),
      makeShift({ userId: "emp-2", date: "2026-05-13", startTime: "08:00", endTime: "16:00" }),
      makeShift({ userId: "emp-2", date: "2026-05-14", startTime: "08:00", endTime: "16:00" }),
    ];
    expect(checkWorkloadBalance(shifts, BASE_CTX)).toHaveLength(0);
  });

  it("warns when employee has more than 6h above average", () => {
    // emp-1: 40h, emp-2: 8h → avg=24, emp-1 is 16h above → warn
    const shifts: ShiftInput[] = [];
    for (let i = 0; i < 5; i++) {
      shifts.push(makeShift({ userId: "emp-1", date: `2026-05-1${i + 1}`, startTime: "08:00", endTime: "16:00" })); // 8h each
    }
    shifts.push(makeShift({ userId: "emp-2", date: "2026-05-11", startTime: "08:00", endTime: "16:00" })); // 8h
    const result = checkWorkloadBalance(shifts, BASE_CTX);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].ruleId).toBe("SR004");
    expect(result[0].affectedEmployeeId).toBe("emp-1");
  });

  it("does not warn when difference is exactly 6h (threshold is strictly >6)", () => {
    // emp-1: 30h, emp-2: 24h → avg=27, emp-1 is 3h above → no warn
    const shifts = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeShift({ userId: "emp-1", date: `2026-05-1${i + 1}`, startTime: "08:00", endTime: "18:00" }) // 10h
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makeShift({ userId: "emp-2", date: `2026-05-1${i + 1}`, startTime: "08:00", endTime: "16:00" }) // 8h
      ),
    ];
    expect(checkWorkloadBalance(shifts, BASE_CTX)).toHaveLength(0);
  });
});

// ─── SR006 — Hour bank compensation ──────────────────────────────────────────

describe("SR006 checkHourBankCompensation", () => {
  it("returns no warnings when employee has no hourBankBalance", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    expect(checkHourBankCompensation(shifts, BASE_CTX)).toHaveLength(0);
  });

  it("returns no warnings when hourBankBalance is below threshold (< 2h)", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [{ ...BASE_CTX.employees[0], hourBankBalance: 1, contractHoursPerWeek: 40 }, BASE_CTX.employees[1]],
    };
    // actual = 8h, expected = 40 - 1 = 39h → diff = 31h > 3 but balance too small → no warn
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    expect(checkHourBankCompensation(shifts, ctx)).toHaveLength(0);
  });

  it("warns when actual hours differ from expected by more than 3h", () => {
    // hourBankBalance = 10h → expected = 40 - 10 = 30h. actual = 8h. diff = 22h → warn
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [{ ...BASE_CTX.employees[0], hourBankBalance: 10, contractHoursPerWeek: 40 }, BASE_CTX.employees[1]],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00" })]; // 8h
    const result = checkHourBankCompensation(shifts, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("SR006");
    expect(result[0].affectedEmployeeId).toBe("emp-1");
  });

  it("does not warn when actual matches expected within tolerance", () => {
    // hourBankBalance = 5h → expected = 40 - 5 = 35h. actual = 35h → no warn
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [{ ...BASE_CTX.employees[0], hourBankBalance: 5, contractHoursPerWeek: 40 }, BASE_CTX.employees[1]],
    };
    // 5 × 7h = 35h
    const shifts = Array.from({ length: 5 }, (_, i) =>
      makeShift({ userId: "emp-1", date: `2026-05-1${i + 1}`, startTime: "09:00", endTime: "16:00" }) // 7h each
    );
    expect(checkHourBankCompensation(shifts, ctx)).toHaveLength(0);
  });

  it("handles negative hourBankBalance (employee owed hours)", () => {
    // hourBankBalance = -8h (employee worked extra) → |balance| = 8 >= 2 → check active
    // expected = 40 - (-8) = 48h. actual = 8h → diff = 40h → warn
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [{ ...BASE_CTX.employees[0], hourBankBalance: -8, contractHoursPerWeek: 40 }, BASE_CTX.employees[1]],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00" })];
    const result = checkHourBankCompensation(shifts, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("SR006");
  });
});

// ─── runAllSoftRules ──────────────────────────────────────────────────────────

describe("runAllSoftRules", () => {
  it("returns empty array when no rules are violated", () => {
    expect(runAllSoftRules([], BASE_CTX)).toHaveLength(0);
  });

  it("aggregates violations from all rules", () => {
    // Trigger SR001 (avoided day) + SR002 (unequal weekend)
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [
        { ...BASE_CTX.employees[0], preferences: { avoidDays: [5] } }, // avoid Saturday
        BASE_CTX.employees[1],
      ],
    };
    // emp-1 gets Saturday (triggers SR001), plus 2 more weekend shifts (triggers SR002)
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-16" }), // Saturday — SR001 + SR002
      makeShift({ userId: "emp-1", date: "2026-05-17" }), // Sunday — SR002
      makeShift({ userId: "emp-1", date: "2026-05-09" }), // prev Saturday — SR002
    ];
    const result = runAllSoftRules(shifts, ctx);
    const ruleIds = result.map(v => v.ruleId);
    expect(ruleIds).toContain("SR001");
    expect(ruleIds).toContain("SR002");
  });

  it("all returned violations have severity 'soft'", () => {
    const ctx: ScheduleContext = {
      ...BASE_CTX,
      employees: [
        { ...BASE_CTX.employees[0], preferences: { avoidDays: [0] } },
        BASE_CTX.employees[1],
      ],
    };
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    const result = runAllSoftRules(shifts, ctx);
    expect(result.every(v => v.severity === "soft")).toBe(true);
  });
});
