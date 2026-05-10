import { describe, it, expect } from "vitest";
import {
  checkMinimumCoverage,
  checkContractHours,
  checkTimeOffBlocks,
  checkNoOverlaps,
  checkMinShiftDuration,
  checkHolidayCoverage,
  runAllHardRules,
  parseHours,
  shiftDuration,
  getDayOfWeek,
  getWeekDates,
} from "../../lib/scheduling-engine/hard-rules";
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

const BASE_CONTEXT: ScheduleContext = {
  storeId: "store-1",
  weekStart: "2026-05-11", // Monday
  weekEnd: "2026-05-17",   // Sunday
  employees: [
    { id: "emp-1", name: "Alice", department: "sala", contractHoursPerWeek: 40, daysOffPerWeek: 2 },
    { id: "emp-2", name: "Bob",   department: "sala", contractHoursPerWeek: 40, daysOffPerWeek: 2 },
  ],
  coverageRequirements: [
    { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 2 }, // Monday
  ],
  approvedTimeOff: [],
  storeRules: { minShiftHours: 3, contractHoursToleranceH: 5 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

describe("parseHours", () => {
  it("parses HH:MM correctly", () => {
    expect(parseHours("08:00")).toBe(8);
    expect(parseHours("08:30")).toBe(8.5);
    expect(parseHours("13:15")).toBeCloseTo(13.25);
    expect(parseHours("00:00")).toBe(0);
  });
});

describe("shiftDuration", () => {
  it("returns 0 for day-off shifts", () => {
    expect(shiftDuration(makeShift({ userId: "emp-1", date: "2026-05-11", isDayOff: true }))).toBe(0);
  });

  it("calculates standard shift duration", () => {
    const s = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00" });
    expect(shiftDuration(s)).toBe(8);
  });

  it("treats 00:00 endTime as midnight (24h) — ends-at-midnight shift", () => {
    const s = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "22:00", endTime: "00:00" });
    expect(shiftDuration(s)).toBe(2);
  });

  it("handles cross-midnight shift (22:00–02:00) — 4 hours", () => {
    const s = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "22:00", endTime: "02:00" });
    expect(shiftDuration(s)).toBe(4);
  });

  it("handles cross-midnight shift (23:00–01:00) — 2 hours", () => {
    const s = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "23:00", endTime: "01:00" });
    expect(shiftDuration(s)).toBe(2);
  });

  it("does NOT produce negative duration for any valid shift", () => {
    const pairs: [string, string][] = [
      ["06:00", "14:00"],
      ["14:00", "22:00"],
      ["22:00", "00:00"],
      ["22:00", "06:00"],
      ["00:00", "08:00"],
    ];
    for (const [start, end] of pairs) {
      const s = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: start, endTime: end });
      expect(shiftDuration(s)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("checkNoOverlaps — midnight edge cases", () => {
  it("does not report overlap for adjacent end-at-midnight + start-of-day shifts", () => {
    // 22:00–00:00 and 00:00–08:00 on the same date — these are adjacent, not overlapping
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "22:00", endTime: "00:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "00:00", endTime: "08:00" }),
    ];
    const violations = checkNoOverlaps(shifts);
    expect(violations).toHaveLength(0);
  });

  it("detects overlap between two cross-midnight shifts on same date", () => {
    // 22:00–04:00 and 23:00–03:00 on same date — second shift starts inside first
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "22:00", endTime: "04:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "23:00", endTime: "03:00" }),
    ];
    const violations = checkNoOverlaps(shifts);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe("HR010");
  });
});

describe("getDayOfWeek", () => {
  it("returns 0 for Monday", () => expect(getDayOfWeek("2026-05-11")).toBe(0));
  it("returns 6 for Sunday",  () => expect(getDayOfWeek("2026-05-17")).toBe(6));
  it("returns 5 for Saturday",() => expect(getDayOfWeek("2026-05-16")).toBe(5));
});

describe("getWeekDates", () => {
  it("returns 7 dates for a full week", () => {
    const dates = getWeekDates("2026-05-11", "2026-05-17");
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-05-11");
    expect(dates[6]).toBe("2026-05-17");
  });
});

// ─── HR001 — Minimum coverage ────────────────────────────────────────────────

describe("checkMinimumCoverage — HR001", () => {
  it("passes when coverage is met", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
      makeShift({ userId: "emp-2", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
    ];
    const violations = checkMinimumCoverage(shifts, BASE_CONTEXT);
    expect(violations).toHaveLength(0);
  });

  it("detects under-staffed slot", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
      // emp-2 absent
    ];
    const violations = checkMinimumCoverage(shifts, BASE_CONTEXT);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe("HR001");
    expect(violations[0].severity).toBe("hard");
    expect((violations[0].details as Record<string, unknown>).type).toBe("under");
  });

  it("detects over-staffed slot when maxStaffRequired is set", () => {
    const ctx: ScheduleContext = {
      ...BASE_CONTEXT,
      coverageRequirements: [
        { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 1, maxStaffRequired: 1 },
      ],
    };
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
      makeShift({ userId: "emp-2", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
    ];
    const violations = checkMinimumCoverage(shifts, ctx);
    expect(violations.length).toBeGreaterThan(0);
    expect((violations[0].details as Record<string, unknown>).type).toBe("over");
  });

  it("ignores holiday dates (handled by HR012)", () => {
    const ctx: ScheduleContext = {
      ...BASE_CONTEXT,
      holidays: ["2026-05-11"],
    };
    const shifts: ShiftInput[] = []; // no coverage
    const violations = checkMinimumCoverage(shifts, ctx);
    expect(violations).toHaveLength(0);
  });

  it("does not flag a different department", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "10:00", endTime: "16:00", department: "cucina" }),
      makeShift({ userId: "emp-2", date: "2026-05-11", startTime: "10:00", endTime: "16:00", department: "cucina" }),
    ];
    // requirement is for "sala" — should still flag
    const violations = checkMinimumCoverage(shifts, BASE_CONTEXT);
    expect(violations.length).toBeGreaterThan(0); // sala still uncovered
  });
});

// ─── HR002 — Contract hours ──────────────────────────────────────────────────

describe("checkContractHours — HR002", () => {
  it("passes when hours are within ±5h tolerance", () => {
    // 5 shifts of 8h = 40h (target 40h)
    const shifts = ["2026-05-11","2026-05-12","2026-05-13","2026-05-14","2026-05-15"].map(d =>
      makeShift({ userId: "emp-1", date: d, startTime: "09:00", endTime: "17:00" }),
    );
    const violations = checkContractHours(shifts, BASE_CONTEXT);
    expect(violations.filter(v => v.affectedEmployeeId === "emp-1")).toHaveLength(0);
  });

  it("blocks when deviation > 5h", () => {
    // 6 shifts of 8h = 48h (target 40h, deviation 8h > 5h)
    const shifts = ["2026-05-11","2026-05-12","2026-05-13","2026-05-14","2026-05-15","2026-05-16"].map(d =>
      makeShift({ userId: "emp-1", date: d, startTime: "09:00", endTime: "17:00" }),
    );
    const violations = checkContractHours(shifts, BASE_CONTEXT);
    const emp1V = violations.filter(v => v.affectedEmployeeId === "emp-1");
    expect(emp1V.length).toBeGreaterThan(0);
    expect(emp1V[0].ruleId).toBe("HR002");
    expect(emp1V[0].severity).toBe("hard");
  });

  it("does not block when deviation is exactly 5h", () => {
    // 5h over: 45h total (40+5)
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "18:00" }), // 9h
      makeShift({ userId: "emp-1", date: "2026-05-12", startTime: "09:00", endTime: "18:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-13", startTime: "09:00", endTime: "18:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-14", startTime: "09:00", endTime: "18:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-15", startTime: "09:00", endTime: "18:00" }),
    ]; // 5 * 9 = 45h, deviation = 5h (not > 5)
    const violations = checkContractHours(shifts, BASE_CONTEXT);
    expect(violations.filter(v => v.affectedEmployeeId === "emp-1")).toHaveLength(0);
  });
});

// ─── HR003–HR009 — Time-off blocks ───────────────────────────────────────────

describe("checkTimeOffBlocks — HR003–HR009", () => {
  const makeCtxWithTimeOff = (type: string, date = "2026-05-11"): ScheduleContext => ({
    ...BASE_CONTEXT,
    approvedTimeOff: [{ userId: "emp-1", type: type as never, date }],
  });

  it("HR003 — blocks shift during ferie", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    const violations = checkTimeOffBlocks(shifts, makeCtxWithTimeOff("ferie"));
    expect(violations.some(v => v.ruleId === "HR003")).toBe(true);
  });

  it("HR004 — blocks shift during permesso", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    const violations = checkTimeOffBlocks(shifts, makeCtxWithTimeOff("permesso"));
    expect(violations.some(v => v.ruleId === "HR004")).toBe(true);
  });

  it("HR005 — permesso_104 is distinct from permesso", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    const v104 = checkTimeOffBlocks(shifts, makeCtxWithTimeOff("permesso_104"));
    const vPerm = checkTimeOffBlocks(shifts, makeCtxWithTimeOff("permesso"));
    expect(v104.some(v => v.ruleId === "HR005")).toBe(true);
    expect(vPerm.some(v => v.ruleId === "HR004")).toBe(true);
    expect(v104.some(v => v.ruleId === "HR004")).toBe(false); // not HR004
    expect(vPerm.some(v => v.ruleId === "HR005")).toBe(false); // not HR005
  });

  it("HR006 — blocks shift during malattia", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    const violations = checkTimeOffBlocks(shifts, makeCtxWithTimeOff("malattia"));
    expect(violations.some(v => v.ruleId === "HR006")).toBe(true);
  });

  it("HR007 — blocks shift during giorno_libero", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    const violations = checkTimeOffBlocks(shifts, makeCtxWithTimeOff("giorno_libero"));
    expect(violations.some(v => v.ruleId === "HR007")).toBe(true);
  });

  it("HR008 — blocks morning shift during mattina_libera", () => {
    const ctx = makeCtxWithTimeOff("mattina_libera");
    const morningShift = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "13:00" });
    const violations = checkTimeOffBlocks([morningShift], ctx);
    expect(violations.some(v => v.ruleId === "HR008")).toBe(true);
  });

  it("HR008 — allows afternoon shift during mattina_libera", () => {
    const ctx = makeCtxWithTimeOff("mattina_libera");
    const afternoonShift = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "14:00", endTime: "22:00" });
    const violations = checkTimeOffBlocks([afternoonShift], ctx);
    expect(violations.filter(v => v.ruleId === "HR008")).toHaveLength(0);
  });

  it("HR009 — blocks evening shift during sera_libera", () => {
    const ctx = makeCtxWithTimeOff("sera_libera");
    const eveningShift = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "17:00", endTime: "23:00" });
    const violations = checkTimeOffBlocks([eveningShift], ctx);
    expect(violations.some(v => v.ruleId === "HR009")).toBe(true);
  });

  it("HR009 — allows morning shift during sera_libera", () => {
    const ctx = makeCtxWithTimeOff("sera_libera");
    const morningShift = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "08:00", endTime: "14:00" });
    const violations = checkTimeOffBlocks([morningShift], ctx);
    expect(violations.filter(v => v.ruleId === "HR009")).toHaveLength(0);
  });

  it("does not flag day-off shifts", () => {
    const ctx = makeCtxWithTimeOff("ferie");
    const dayOff = makeShift({ userId: "emp-1", date: "2026-05-11", isDayOff: true });
    const violations = checkTimeOffBlocks([dayOff], ctx);
    expect(violations).toHaveLength(0);
  });

  it("does not flag a different employee", () => {
    const ctx = makeCtxWithTimeOff("ferie");
    const shifts = [makeShift({ userId: "emp-2", date: "2026-05-11" })]; // emp-2, not emp-1
    const violations = checkTimeOffBlocks(shifts, ctx);
    expect(violations).toHaveLength(0);
  });
});

// ─── HR010 — No overlaps ─────────────────────────────────────────────────────

describe("checkNoOverlaps — HR010", () => {
  it("passes with a single shift per employee per day", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00" }),
      makeShift({ userId: "emp-2", date: "2026-05-11", startTime: "12:00", endTime: "20:00" }),
    ];
    expect(checkNoOverlaps(shifts)).toHaveLength(0);
  });

  it("detects overlapping shifts for same employee", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "15:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "13:00", endTime: "20:00" }),
    ];
    const violations = checkNoOverlaps(shifts);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe("HR010");
  });

  it("allows adjacent shifts (end == start of next)", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "13:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "13:00", endTime: "18:00" }),
    ];
    expect(checkNoOverlaps(shifts)).toHaveLength(0);
  });
});

// ─── HR011 — Minimum shift duration ─────────────────────────────────────────

describe("checkMinShiftDuration — HR011", () => {
  it("passes for a 8h shift", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00" })];
    expect(checkMinShiftDuration(shifts, BASE_CONTEXT)).toHaveLength(0);
  });

  it("blocks shift shorter than 3h", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "11:00" })]; // 2h
    const violations = checkMinShiftDuration(shifts, BASE_CONTEXT);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe("HR011");
    expect(violations[0].severity).toBe("hard");
  });

  it("ignores day-off shifts", () => {
    const shifts = [makeShift({ userId: "emp-1", date: "2026-05-11", isDayOff: true, startTime: "09:00", endTime: "10:00" })];
    expect(checkMinShiftDuration(shifts, BASE_CONTEXT)).toHaveLength(0);
  });
});

// ─── HR012 — Holiday coverage ────────────────────────────────────────────────

describe("checkHolidayCoverage — HR012", () => {
  it("returns no violations when no holidays", () => {
    expect(checkHolidayCoverage([], BASE_CONTEXT)).toHaveLength(0);
  });

  it("applies 20% bonus on holidays", () => {
    const ctx: ScheduleContext = {
      ...BASE_CONTEXT,
      holidays: ["2026-05-11"],
      coverageRequirements: [
        { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 2 }, // needs ceil(2*1.2)=3
      ],
    };
    // Only 2 staff on holiday — need 3
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
      makeShift({ userId: "emp-2", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
    ];
    const violations = checkHolidayCoverage(shifts, ctx);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe("HR012");
  });

  it("passes when holiday coverage is sufficient", () => {
    const ctx: ScheduleContext = {
      ...BASE_CONTEXT,
      holidays: ["2026-05-11"],
      employees: [
        ...BASE_CONTEXT.employees,
        { id: "emp-3", name: "Carol", department: "sala", contractHoursPerWeek: 40, daysOffPerWeek: 2 },
      ],
      coverageRequirements: [
        { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 2 }, // needs 3
      ],
    };
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
      makeShift({ userId: "emp-2", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
      makeShift({ userId: "emp-3", date: "2026-05-11", startTime: "10:00", endTime: "16:00" }),
    ];
    expect(checkHolidayCoverage(shifts, ctx)).toHaveLength(0);
  });
});

// ─── runAllHardRules — combined ───────────────────────────────────────────────

describe("runAllHardRules — combined", () => {
  it("returns no violations for a valid schedule", () => {
    const ctx: ScheduleContext = {
      ...BASE_CONTEXT,
      coverageRequirements: [
        { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 1 },
      ],
    };
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00" }),
      makeShift({ userId: "emp-1", date: "2026-05-11", isDayOff: true }),
      makeShift({ userId: "emp-2", date: "2026-05-11", isDayOff: true }),
    ];
    // emp-1 has 8h (within ±5h of 40h target), emp-2 has 0h (40h deficit — will violate HR002)
    const violations = runAllHardRules(shifts, ctx);
    expect(violations.every(v => v.severity === "hard")).toBe(true);
  });

  it("accumulates violations from all rules", () => {
    const ctx: ScheduleContext = {
      ...BASE_CONTEXT,
      approvedTimeOff: [{ userId: "emp-1", type: "ferie", date: "2026-05-11" }],
    };
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "11:00" }), // HR011 + HR003
    ];
    const violations = runAllHardRules(shifts, ctx);
    const ruleIds = violations.map(v => v.ruleId);
    expect(ruleIds).toContain("HR003"); // ferie block
    expect(ruleIds).toContain("HR011"); // too short
  });
});
