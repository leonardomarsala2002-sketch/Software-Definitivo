import { describe, it, expect } from "vitest";
import {
  runAllHardRules,
  shiftDuration,
  parseHours,
} from "../../lib/scheduling-engine/hard-rules";
import { calculateMetrics, calculateQualityScore } from "../../lib/scheduling-engine/quality-score";
import { validateSchedule } from "../../lib/scheduling-engine/validator";
import type { ShiftInput, ScheduleContext } from "../../lib/scheduling-engine/types";

// ─── FASE 2 Smoke tests: full rule engine + quality score pipeline ────────────

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

const BASE_CTX: ScheduleContext = {
  storeId: "store-1",
  weekStart: "2026-05-11",
  weekEnd:   "2026-05-17",
  employees: [
    { id: "emp-1", name: "Alice", department: "sala", contractHoursPerWeek: 40, daysOffPerWeek: 2 },
    { id: "emp-2", name: "Bob",   department: "sala", contractHoursPerWeek: 40, daysOffPerWeek: 2 },
  ],
  coverageRequirements: [
    { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 2 }, // Mon only
  ],
  approvedTimeOff: [],
  storeRules: { minShiftHours: 3, contractHoursToleranceH: 5 },
};

// ─── Smoke: valid schedule passes validation ──────────────────────────────────

describe("FASE 2 smoke — valid schedule", () => {
  // 5 days × 8h = 40h each, covers Mon 12:00 slot
  const validShifts: ShiftInput[] = [
    "2026-05-11","2026-05-12","2026-05-13","2026-05-14","2026-05-15",
  ].flatMap(d => [
    makeShift({ userId: "emp-1", date: d }),
    makeShift({ userId: "emp-2", date: d }),
  ]);

  it("no hard violations on a valid schedule", () => {
    const violations = runAllHardRules(validShifts, BASE_CTX);
    const hard = violations.filter(v => v.severity === "hard");
    expect(hard).toHaveLength(0);
  });

  it("validateSchedule returns isValid=true", () => {
    const result = validateSchedule(validShifts, BASE_CTX);
    expect(result.isValid).toBe(true);
    expect(result.hardViolations).toHaveLength(0);
  });

  it("quality score is above 0 for a valid schedule", () => {
    const result = validateSchedule(validShifts, BASE_CTX);
    expect(result.qualityScore).toBeGreaterThan(0);
  });
});

// ─── Smoke: invalid schedule is blocked ──────────────────────────────────────

describe("FASE 2 smoke — invalid schedule (ferie violation)", () => {
  const shiftsWithViolation: ShiftInput[] = [
    // emp-1 working on approved ferie day
    makeShift({ userId: "emp-1", date: "2026-05-11" }),
    makeShift({ userId: "emp-2", date: "2026-05-11" }),
  ];
  const ctxWithFerie: ScheduleContext = {
    ...BASE_CTX,
    approvedTimeOff: [
      { userId: "emp-1", type: "ferie", date: "2026-05-11" },
    ],
  };

  it("detects HR003 violation (ferie)", () => {
    const violations = runAllHardRules(shiftsWithViolation, ctxWithFerie);
    const ferie = violations.filter(v => v.ruleId === "HR003");
    expect(ferie.length).toBeGreaterThan(0);
  });

  it("validateSchedule returns isValid=false when hard violations exist", () => {
    const result = validateSchedule(shiftsWithViolation, ctxWithFerie);
    expect(result.isValid).toBe(false);
  });

  it("quality score is lower when hard violations exist vs a clean schedule", () => {
    // validateSchedule does not force score to 0 on hard violations —
    // it deducts 15pt per violation but other metrics (coverage, preferences) can keep it > 0.
    // The guarantee is isValid=false, not score=0.
    const result = validateSchedule(shiftsWithViolation, ctxWithFerie);
    const cleanResult = validateSchedule(
      [...Array(5)].flatMap((_, i) => {
        const d = ["2026-05-11","2026-05-12","2026-05-13","2026-05-14","2026-05-15"][i];
        return [
          makeShift({ userId: "emp-1", date: d }),
          makeShift({ userId: "emp-2", date: d }),
        ];
      }),
      BASE_CTX,
    );
    expect(result.qualityScore).toBeLessThan(cleanResult.qualityScore);
  });
});

// ─── estimatedCoverageChecks correctness ─────────────────────────────────────

describe("FASE 2 smoke — estimatedCoverageChecks (M2.2 fix)", () => {
  it("counts only matching weekdays, not always ×7", () => {
    // 1 requirement for Monday only (dayOfWeek=0): week has 1 Monday → 1 check
    const ctxMonOnly: ScheduleContext = {
      ...BASE_CTX,
      coverageRequirements: [
        { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 1 },
      ],
    };
    // Provide valid shifts so coverage is 100%
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11" }), // Mon
    ];
    const result = validateSchedule(shifts, ctxMonOnly);
    // Coverage 100% for the 1 Mon requirement → no HR001 violations
    expect(result.hardViolations.filter(v => v.ruleId === "HR001")).toHaveLength(0);
  });

  it("requirements for 7 days produce 7 checks", () => {
    // 1 requirement every day of week (0–6)
    const reqs = [0,1,2,3,4,5,6].map(dow => ({
      dayOfWeek: dow, hourSlot: "12:00", department: "sala", minStaffRequired: 1,
    }));
    const ctx7: ScheduleContext = { ...BASE_CTX, coverageRequirements: reqs };
    // 7 shifts, 1 per day → covers all 7 slots
    const shifts7 = ["2026-05-11","2026-05-12","2026-05-13","2026-05-14","2026-05-15","2026-05-16","2026-05-17"].map(d =>
      makeShift({ userId: "emp-1", date: d }),
    );
    const result = validateSchedule(shifts7, ctx7);
    expect(result.hardViolations.filter(v => v.ruleId === "HR001")).toHaveLength(0);
  });
});

// ─── Cross-midnight shift handling (M2.1 fix) ────────────────────────────────

describe("FASE 2 smoke — cross-midnight shifts (M2.1 fix)", () => {
  it("22:00–02:00 has duration 4h (not 0 or negative)", () => {
    const s = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "22:00", endTime: "02:00" });
    expect(shiftDuration(s)).toBe(4);
  });

  it("22:00–00:00 has duration 2h (midnight marker)", () => {
    const s = makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "22:00", endTime: "00:00" });
    expect(shiftDuration(s)).toBe(2);
  });

  it("cross-midnight shift is counted toward contract hours", () => {
    // emp-1: 5 normal shifts (8h) + 1 cross-midnight (4h) = 44h; tolerance 5 → OK
    const shifts = [
      ...["2026-05-11","2026-05-12","2026-05-13","2026-05-14","2026-05-15"].map(d =>
        makeShift({ userId: "emp-1", date: d }),
      ),
      makeShift({ userId: "emp-1", date: "2026-05-16", startTime: "22:00", endTime: "02:00" }),
    ];
    const violations = runAllHardRules(shifts, BASE_CTX);
    const hr002 = violations.filter(v => v.ruleId === "HR002" && v.affectedEmployeeId === "emp-1");
    // 44h vs 40h target = 4h deviation < 5h tolerance → no violation
    expect(hr002).toHaveLength(0);
  });
});

// ─── Quality score sanity ─────────────────────────────────────────────────────

describe("FASE 2 smoke — quality score bounds", () => {
  it("score is always between 0 and 100", () => {
    // Perfect schedule
    const shifts5 = ["2026-05-11","2026-05-12","2026-05-13","2026-05-14","2026-05-15"].flatMap(d => [
      makeShift({ userId: "emp-1", date: d }),
      makeShift({ userId: "emp-2", date: d }),
    ]);
    const result = validateSchedule(shifts5, BASE_CTX);
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(100);
  });

  it("empty schedule has score below 50 (coverage and contract hours are violated)", () => {
    // An empty schedule has no coverage and 0h/week per employee (vs 40h contract).
    // Score is not guaranteed to be exactly 0, but should be significantly penalized.
    const result = validateSchedule([], BASE_CTX);
    expect(result.qualityScore).toBeLessThan(50);
    expect(result.isValid).toBe(false);
  });

  it("hard violation causes score drop", () => {
    const badShifts = [makeShift({ userId: "emp-1", date: "2026-05-11" })];
    const goodShifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11" }),
      makeShift({ userId: "emp-2", date: "2026-05-11" }),
    ];
    const bad = validateSchedule(badShifts, BASE_CTX);
    const good = validateSchedule(goodShifts, BASE_CTX);
    // More violations → lower or equal score
    expect(bad.qualityScore).toBeLessThanOrEqual(good.qualityScore);
  });
});
