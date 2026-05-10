import { describe, it, expect } from "vitest";
import { buildAIContext, serializeContextForPrompt } from "../../lib/ai-assistant/context-builder";
import { processAIOutput } from "../../lib/ai-assistant/bridge";
import { extractJSON } from "../../lib/ai-assistant/prompt-utils";
import type { AIRawData, AIScheduleProposal, AIContext } from "../../lib/ai-assistant/types";
import type { AIProvider, AIMessage, ChatOptions } from "../../lib/ai-assistant/providers/base";

// ─── Mock provider — no real API calls ───────────────────────────────────────

class MockProvider implements AIProvider {
  readonly name = "mock";
  private readonly responseText: string;

  constructor(responseText: string) {
    this.responseText = responseText;
  }

  async chat(_messages: AIMessage[], _options?: ChatOptions): Promise<string> {
    return this.responseText;
  }
}

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const BASE_RAW: AIRawData = {
  storeId: "store-1",
  storeName: "Negozio Test",
  weekStart: "2026-05-11",
  weekEnd: "2026-05-17",
  employees: [
    {
      id: "emp-1",
      name: "Alice Rossi",
      department: "sala",
      weeklyContractHours: 40,
      daysOffPerWeek: 2,
      preferences: {
        preferredShiftType: "morning",
        preferredDaysOff: [],
        weekendAvailability: "limited",
        prefersOpening: true,
        prefersClosing: false,
        hourDistribution: "even",
      },
    },
    {
      id: "emp-2",
      name: "Bob Verdi",
      department: "sala",
      weeklyContractHours: 40,
      daysOffPerWeek: 2,
    },
  ],
  approvedTimeOff: [
    { userId: "emp-1", type: "ferie", date: "2026-05-15" },
  ],
  coverageRequirements: [
    { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 1 },
  ],
  storeRules: { minShiftHours: 3, maxShiftHours: 10, contractHoursToleranceH: 5 },
  openingHours: [
    { dayOfWeek: 0, openTime: "09:00", closeTime: "22:00", isClosed: false },
    { dayOfWeek: 6, openTime: "09:00", closeTime: "22:00", isClosed: false },
  ],
  recentShifts: [],
  holidays: [],
};

// ─── buildAIContext ───────────────────────────────────────────────────────────

describe("buildAIContext — context builder (FASE 4)", () => {
  it("maps raw employees to EmployeeInfo", () => {
    const ctx = buildAIContext(BASE_RAW);
    expect(ctx.employees).toHaveLength(2);
    expect(ctx.employees[0].id).toBe("emp-1");
    expect(ctx.employees[0].name).toBe("Alice Rossi");
    expect(ctx.employees[0].contractHoursPerWeek).toBe(40);
    expect(ctx.employees[0].daysOffPerWeek).toBe(2);
  });

  it("stores employee preferences in employeePreferences map", () => {
    const ctx = buildAIContext(BASE_RAW);
    expect(ctx.employeePreferences["emp-1"]).toBeDefined();
    expect(ctx.employeePreferences["emp-1"].preferredShiftType).toBe("morning");
    expect(ctx.employeePreferences["emp-2"]).toBeUndefined();
  });

  it("computes storeSummary correctly", () => {
    const ctx = buildAIContext(BASE_RAW);
    expect(ctx.storeSummary.totalEmployees).toBe(2);
    expect(ctx.storeSummary.totalContractHoursPerWeek).toBe(80);
    expect(ctx.storeSummary.departments).toContain("sala");
  });

  it("maps approvedTimeOff", () => {
    const ctx = buildAIContext(BASE_RAW);
    expect(ctx.approvedTimeOff).toHaveLength(1);
    expect(ctx.approvedTimeOff[0].userId).toBe("emp-1");
    expect(ctx.approvedTimeOff[0].type).toBe("ferie");
  });

  it("maps coverageRequirements", () => {
    const ctx = buildAIContext(BASE_RAW);
    expect(ctx.coverageRequirements).toHaveLength(1);
    expect(ctx.coverageRequirements[0].minStaffRequired).toBe(1);
  });

  it("maps openingHours", () => {
    const ctx = buildAIContext(BASE_RAW);
    expect(ctx.openingHours).toHaveLength(2);
  });

  it("produces a serializable context (JSON round-trip)", () => {
    const ctx = buildAIContext(BASE_RAW);
    const serialized = JSON.stringify(ctx);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.storeId).toBe("store-1");
    expect(deserialized.employees).toHaveLength(2);
  });
});

// ─── serializeContextForPrompt ────────────────────────────────────────────────

describe("serializeContextForPrompt — prompt text (FASE 4)", () => {
  it("includes store name and week range", () => {
    const ctx = buildAIContext(BASE_RAW);
    const text = serializeContextForPrompt(ctx);
    expect(text).toContain("Negozio Test");
    expect(text).toContain("2026-05-11");
    expect(text).toContain("2026-05-17");
  });

  it("includes all employee names and hours", () => {
    const ctx = buildAIContext(BASE_RAW);
    const text = serializeContextForPrompt(ctx);
    expect(text).toContain("Alice Rossi");
    expect(text).toContain("Bob Verdi");
    expect(text).toContain("40h/sett");
  });

  it("includes approved time-off", () => {
    const ctx = buildAIContext(BASE_RAW);
    const text = serializeContextForPrompt(ctx);
    expect(text).toContain("ferie");
    expect(text).toContain("Alice Rossi");
  });

  it("includes coverage requirements", () => {
    const ctx = buildAIContext(BASE_RAW);
    const text = serializeContextForPrompt(ctx);
    expect(text).toContain("12:00");
    expect(text).toContain("sala");
  });
});

// ─── processAIOutput (bridge) ─────────────────────────────────────────────────

describe("processAIOutput — bridge + rule engine integration (FASE 4)", () => {
  const ctx = buildAIContext(BASE_RAW);

  // 5 work days × 2 employees = 10 shifts, plus 2 days off each = 14 shifts total
  // emp-1 has ferie on 2026-05-15 (Fri), so we'll test autocorrection

  it("accepts a valid proposal and returns isValid=true", () => {
    const validProposal: AIScheduleProposal = {
      shifts: [
        // emp-1: works Mon–Thu, day off Fri (ferie) + Sat
        { userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala", reason: "Coverage" },
        { userId: "emp-1", date: "2026-05-12", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-13", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-14", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-15", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-1", date: "2026-05-16", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-1", date: "2026-05-17", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        // emp-2: works 5 days, 2 off
        { userId: "emp-2", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-12", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-13", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-14", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-15", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-16", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-2", date: "2026-05-17", startTime: null, endTime: null, isDayOff: true, department: "sala" },
      ],
      generalReasoning: "Proposta bilanciata",
    };

    const result = processAIOutput(validProposal, ctx);
    expect(result.isValid).toBe(true);
    expect(result.hardViolations).toHaveLength(0);
    expect(result.qualityScore).toBeGreaterThan(0);
  });

  it("auto-corrects ferie violation (HR003): converts work shift to day-off", () => {
    const proposal: AIScheduleProposal = {
      shifts: [
        // emp-1 scheduled on ferie day 2026-05-15 — should be auto-corrected
        { userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-12", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-13", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-14", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-15", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" }, // VIOLATION
        { userId: "emp-1", date: "2026-05-16", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-1", date: "2026-05-17", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-2", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-12", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-13", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-14", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-15", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-16", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-2", date: "2026-05-17", startTime: null, endTime: null, isDayOff: true, department: "sala" },
      ],
    };

    const result = processAIOutput(proposal, ctx);

    // Ferie violation should have been auto-corrected
    const emp1Fri = result.shifts.find(s => s.userId === "emp-1" && s.date === "2026-05-15");
    expect(emp1Fri?.isDayOff).toBe(true);
    expect(emp1Fri?.startTime).toBeNull();

    // Auto-corrections should be logged
    expect(result.autoCorrectionsApplied.length).toBeGreaterThan(0);
    expect(result.resolvedViolations.length).toBeGreaterThan(0);

    // After correction, no HR003 violation should remain
    const hr003 = result.hardViolations.filter(v => v.ruleId === "HR003");
    expect(hr003).toHaveLength(0);
  });

  it("auto-corrects too-short shift (HR011): extends endTime", () => {
    // minShiftHours = 3; shift of 1h should be extended to 3h
    const proposal: AIScheduleProposal = {
      shifts: [
        { userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "10:00", isDayOff: false, department: "sala" }, // 1h — too short
        { userId: "emp-1", date: "2026-05-12", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-13", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-14", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-15", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-1", date: "2026-05-16", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-1", date: "2026-05-17", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-12", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-13", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-14", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-15", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-16", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-2", date: "2026-05-17", startTime: null, endTime: null, isDayOff: true, department: "sala" },
      ],
    };

    const result = processAIOutput(proposal, ctx);

    const correctedShift = result.shifts.find(s => s.userId === "emp-1" && s.date === "2026-05-11");
    // endTime should have been extended to 12:00 (09:00 + 3h min)
    expect(correctedShift?.endTime).toBe("12:00");
    expect(result.autoCorrectionsApplied.length).toBeGreaterThan(0);
  });

  it("preserves explanations from AI proposal", () => {
    const proposal: AIScheduleProposal = {
      shifts: [
        { userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala", reason: "Copertura mattutina" },
        { userId: "emp-1", date: "2026-05-12", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-13", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-14", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-15", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-1", date: "2026-05-16", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-1", date: "2026-05-17", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-12", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-13", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-14", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-15", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-2", date: "2026-05-16", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-2", date: "2026-05-17", startTime: null, endTime: null, isDayOff: true, department: "sala" },
      ],
      generalReasoning: "Proposta ottimale",
    };

    const result = processAIOutput(proposal, ctx);
    expect(result.explanations["emp-1:2026-05-11"]).toBe("Copertura mattutina");
    expect(result.generalReasoning).toBe("Proposta ottimale");
  });

  it("preserves storeId on all corrected shifts", () => {
    const proposal: AIScheduleProposal = {
      shifts: [
        { userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-15", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-2", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
      ],
    };
    const result = processAIOutput(proposal, ctx);
    for (const s of result.shifts) {
      expect(s.storeId).toBe("store-1");
    }
  });
});

// ─── extractJSON ──────────────────────────────────────────────────────────────

describe("extractJSON — prompt-utils (FASE 4)", () => {
  it("parses bare JSON object", () => {
    const result = extractJSON<{ x: number }>('{"x": 42}');
    expect(result.x).toBe(42);
  });

  it("parses JSON wrapped in markdown code block", () => {
    const result = extractJSON<{ x: number }>("```json\n{\"x\": 99}\n```");
    expect(result.x).toBe(99);
  });

  it("parses JSON with surrounding text", () => {
    const result = extractJSON<{ name: string }>("Sure, here's the result:\n{\"name\": \"test\"}");
    expect(result.name).toBe("test");
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJSON("no json here")).toThrow();
  });

  it("parses JSON array", () => {
    const result = extractJSON<number[]>("[1, 2, 3]");
    expect(result).toHaveLength(3);
  });
});

// ─── MockProvider (integration smoke) ────────────────────────────────────────

describe("MockProvider — end-to-end smoke (FASE 4)", () => {
  it("mock provider returns the configured response", async () => {
    const mock = new MockProvider('{"shifts":[],"generalReasoning":"test"}');
    const response = await mock.chat([{ role: "user", content: "hello" }]);
    expect(response).toContain("shifts");
  });

  it("bridge rejects a proposal where hard violations cannot be auto-corrected (coverage gap)", () => {
    // An empty proposal has zero staff → coverage violation HR001 cannot be auto-corrected
    const ctx: AIContext = buildAIContext({
      ...BASE_RAW,
      coverageRequirements: [
        { dayOfWeek: 0, hourSlot: "12:00", department: "sala", minStaffRequired: 3 },
      ],
    });

    const proposal: AIScheduleProposal = {
      shifts: [
        // Only 1 employee on Mon, need 3
        { userId: "emp-1", date: "2026-05-11", startTime: "09:00", endTime: "17:00", isDayOff: false, department: "sala" },
        { userId: "emp-1", date: "2026-05-15", startTime: null, endTime: null, isDayOff: true, department: "sala" },
        { userId: "emp-2", date: "2026-05-11", startTime: null, endTime: null, isDayOff: true, department: "sala" },
      ],
    };

    const result = processAIOutput(proposal, ctx);
    // Coverage gap cannot be auto-corrected → should be in hardViolations
    const hr001 = result.hardViolations.filter(v => v.ruleId === "HR001");
    expect(hr001.length).toBeGreaterThan(0);
    expect(result.isValid).toBe(false);
  });
});
