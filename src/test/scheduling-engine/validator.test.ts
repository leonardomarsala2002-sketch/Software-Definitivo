import { describe, it, expect } from "vitest";
import { validateSchedule } from "../../lib/scheduling-engine/validator";
import { canTransition, isPublishable } from "../../lib/scheduling-engine/lifecycle";
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

const EMPLOYEES = [
  { id: "emp-1", name: "Alice", department: "sala", contractHoursPerWeek: 40, daysOffPerWeek: 2 },
  { id: "emp-2", name: "Bob",   department: "sala", contractHoursPerWeek: 40, daysOffPerWeek: 2 },
];

const BASE_CONTEXT: ScheduleContext = {
  storeId: "store-1",
  weekStart: "2026-05-11",
  weekEnd:   "2026-05-17",
  employees: EMPLOYEES,
  coverageRequirements: [
    { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 1 },
  ],
  approvedTimeOff: [],
  storeRules: { minShiftHours: 3, contractHoursToleranceH: 5 },
};

// A minimal valid schedule: one work shift covering coverage, rest are day-off
function validWeekShifts(empId: string): ShiftInput[] {
  const dates = ["2026-05-11","2026-05-12","2026-05-13","2026-05-14","2026-05-15"];
  return dates.map(d => makeShift({ userId: empId, date: d })); // 5 * 8h = 40h
}

// ─── validateSchedule ────────────────────────────────────────────────────────

describe("validateSchedule", () => {
  it("returns isValid=true with no violations for a clean schedule", () => {
    const shifts = [
      ...validWeekShifts("emp-1"),
      ...validWeekShifts("emp-2"),
    ];
    const result = validateSchedule(shifts, BASE_CONTEXT);
    expect(result.isValid).toBe(true);
    expect(result.hardViolations).toHaveLength(0);
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(100);
  });

  it("returns isValid=false when hard violations exist", () => {
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "11:00" }), // <3h
    ];
    const result = validateSchedule(shifts, BASE_CONTEXT);
    expect(result.isValid).toBe(false);
    expect(result.hardViolations.length).toBeGreaterThan(0);
  });

  it("publication MUST be blocked when isValid is false", () => {
    // This test encodes the business rule: hard violations block publication
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "10:00" }), // 1h — HR011
    ];
    const result = validateSchedule(shifts, BASE_CONTEXT);
    // The caller is responsible for blocking, but the contract is clear:
    expect(result.isValid).toBe(false);
    // Soft warnings alone would not block
    const resultSoftOnly = validateSchedule(
      [...validWeekShifts("emp-1"), ...validWeekShifts("emp-2")],
      BASE_CONTEXT,
    );
    expect(resultSoftOnly.isValid).toBe(true); // soft warnings don't make it invalid
  });

  it("returns isValid=true when there are only soft warnings", () => {
    // Create a schedule that has soft warnings but no hard violations
    // (employees with mismatched preferences)
    const ctx: ScheduleContext = {
      ...BASE_CONTEXT,
      employees: [
        {
          ...EMPLOYEES[0],
          preferences: { preferredShifts: ["evening"] }, // prefers evening, but gets morning
        },
        EMPLOYEES[1],
      ],
    };
    const shifts = [...validWeekShifts("emp-1"), ...validWeekShifts("emp-2")];
    const result = validateSchedule(shifts, ctx);
    expect(result.isValid).toBe(true);
    // At least some soft warnings about preferred shifts
    expect(result.softWarnings.length).toBeGreaterThan(0);
  });

  it("quality score is between 0 and 100", () => {
    const shifts = [...validWeekShifts("emp-1"), ...validWeekShifts("emp-2")];
    const result = validateSchedule(shifts, BASE_CONTEXT);
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(100);
  });

  it("quality score decreases with hard violations", () => {
    const clean = validateSchedule(
      [...validWeekShifts("emp-1"), ...validWeekShifts("emp-2")],
      BASE_CONTEXT,
    );
    const violated = validateSchedule(
      [
        makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "10:00" }), // HR011
        ...validWeekShifts("emp-2"),
      ],
      BASE_CONTEXT,
    );
    expect(violated.qualityScore).toBeLessThan(clean.qualityScore);
  });

  it("metrics contain all required keys", () => {
    const result = validateSchedule(
      [...validWeekShifts("emp-1"), ...validWeekShifts("emp-2")],
      BASE_CONTEXT,
    );
    expect(result.metrics).toMatchObject({
      coverageRespectedPct: expect.any(Number),
      contractHoursRespectedPct: expect.any(Number),
      approvedRequestsRespectedPct: expect.any(Number),
      preferencesRespectedPct: expect.any(Number),
      weekendEquityPct: expect.any(Number),
      openCloseEquityPct: expect.any(Number),
      hourDeviationPerEmployee: expect.any(Object),
      hardViolationCount: expect.any(Number),
      softWarningCount: expect.any(Number),
    });
  });

  it("hour deviation is tracked per employee", () => {
    const shifts = [
      ...validWeekShifts("emp-1"), // 5*8=40h, target 40h → 0h deviation
      ...validWeekShifts("emp-2"),
    ];
    const result = validateSchedule(shifts, BASE_CONTEXT);
    expect(result.metrics.hourDeviationPerEmployee["emp-1"]).toBeCloseTo(0);
    expect(result.metrics.hourDeviationPerEmployee["emp-2"]).toBeCloseTo(0);
  });

  it("detects violation when employee works during approved ferie", () => {
    const ctx: ScheduleContext = {
      ...BASE_CONTEXT,
      approvedTimeOff: [{ userId: "emp-1", type: "ferie", date: "2026-05-11" }],
    };
    const shifts = [
      makeShift({ userId: "emp-1", date: "2026-05-11" }), // works during ferie
      ...validWeekShifts("emp-2"),
    ];
    const result = validateSchedule(shifts, ctx);
    expect(result.isValid).toBe(false);
    expect(result.hardViolations.some(v => v.ruleId === "HR003")).toBe(true);
  });

  it("manual edit from day X should re-validate the full schedule", () => {
    // Simulates that after editing a shift, we re-run validateSchedule
    // This is a contract test: validation is always full-week, not partial
    const shiftsBefore = [...validWeekShifts("emp-1"), ...validWeekShifts("emp-2")];
    const resultBefore = validateSchedule(shiftsBefore, BASE_CONTEXT);

    // Edit emp-1's Monday shift to be too short
    const shiftsAfter = [
      makeShift({ userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "10:00" }), // edited
      ...validWeekShifts("emp-1").slice(1), // rest of week
      ...validWeekShifts("emp-2"),
    ];
    const resultAfter = validateSchedule(shiftsAfter, BASE_CONTEXT);

    expect(resultBefore.isValid).toBe(true);
    expect(resultAfter.isValid).toBe(false);
    expect(resultAfter.hardViolations.some(v => v.ruleId === "HR011")).toBe(true);
  });
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

describe("lifecycle state machine", () => {
  it("allows draft → generated", () => {
    expect(canTransition("draft", "generated")).toBe(true);
  });

  it("allows generated → validated", () => {
    expect(canTransition("generated", "validated")).toBe(true);
  });

  it("allows validated → published", () => {
    expect(canTransition("validated", "published")).toBe(true);
  });

  it("allows published → modified", () => {
    expect(canTransition("published", "modified")).toBe(true);
  });

  it("allows any → archived", () => {
    expect(canTransition("draft", "archived")).toBe(true);
    expect(canTransition("generated", "archived")).toBe(true);
    expect(canTransition("validated", "archived")).toBe(true);
    expect(canTransition("published", "archived")).toBe(true);
    expect(canTransition("modified", "archived")).toBe(true);
  });

  it("does NOT allow published → generated (invalid backward transition)", () => {
    expect(canTransition("published", "generated")).toBe(false);
  });

  it("only validated is publishable", () => {
    expect(isPublishable("validated")).toBe(true);
    expect(isPublishable("generated")).toBe(false);
    expect(isPublishable("draft")).toBe(false);
    expect(isPublishable("published")).toBe(false);
    expect(isPublishable("modified")).toBe(false);
    expect(isPublishable("archived")).toBe(false);
  });
});
