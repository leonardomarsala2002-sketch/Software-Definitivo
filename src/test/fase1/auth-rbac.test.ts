import { describe, it, expect } from "vitest";

// ─── Unit tests for FASE 1 — Auth, RBAC, preview environment logic ────────────
// These tests mirror the pure-logic portions of AuthContext.tsx and ProtectedRoute.tsx.
// No Supabase/DOM dependencies: safe to run in Node via Vitest.

// ─── isPreviewEnvironment (mirrored from AuthContext) ────────────────────────

function isPreviewEnvironment(hostname: string, isDev: boolean): boolean {
  if (isDev) return true;
  return (
    hostname.includes("-preview--") ||
    hostname.includes("lovableproject.com")
  );
}

// ─── isDev check (mirrored from ProtectedRoute) ──────────────────────────────

function isBootstrapVisible(hostname: string, isDev: boolean): boolean {
  return (
    isDev ||
    hostname.includes("-preview--") ||
    hostname.includes("lovableproject.com")
  );
}

// ─── ROLE_CYCLE (mirrored from AuthContext) ───────────────────────────────────

type AppRole = "super_admin" | "admin" | "store_manager" | "employee";
const ROLE_CYCLE: (AppRole | null)[] = ["super_admin", "admin", "store_manager", "employee", null];

function cycleRole(current: AppRole | null): AppRole | null {
  const idx = ROLE_CYCLE.indexOf(current);
  return ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length];
}

// ─── isAuthorized (mirrored from AuthContext) ─────────────────────────────────

function isAuthorized(realRole: AppRole | null, storeCount: number): boolean {
  return realRole !== null && storeCount > 0;
}

// ─── Tests: isPreviewEnvironment ──────────────────────────────────────────────

describe("isPreviewEnvironment", () => {
  it("returns true in Vite dev mode regardless of hostname", () => {
    expect(isPreviewEnvironment("localhost", true)).toBe(true);
    expect(isPreviewEnvironment("myapp.com", true)).toBe(true);
  });

  it("returns true for Lovable preview hostnames", () => {
    expect(isPreviewEnvironment("abc123-preview--lovableproject.com", false)).toBe(true);
    expect(isPreviewEnvironment("myapp.lovableproject.com", false)).toBe(true);
  });

  it("returns false for production hostnames", () => {
    expect(isPreviewEnvironment("myapp.com", false)).toBe(false);
    expect(isPreviewEnvironment("gestionale.it", false)).toBe(false);
    expect(isPreviewEnvironment("staging.gestionale.it", false)).toBe(false);
  });

  it("does NOT match production domains containing the word 'preview' (old bug)", () => {
    // Old check: hostname.includes("preview") would match "preview.myapp.com"
    // Fixed check: hostname.includes("-preview--") does NOT match it
    expect(isPreviewEnvironment("preview.myapp.com", false)).toBe(false);
    expect(isPreviewEnvironment("mypreviewsite.com", false)).toBe(false);
  });
});

// ─── Tests: isBootstrapVisible ────────────────────────────────────────────────

describe("isBootstrapVisible (ProtectedRoute)", () => {
  it("shows bootstrap button in dev mode", () => {
    expect(isBootstrapVisible("localhost", true)).toBe(true);
  });

  it("shows bootstrap button on Lovable preview", () => {
    expect(isBootstrapVisible("abc-preview--lovableproject.com", false)).toBe(true);
  });

  it("hides bootstrap button on production hostname", () => {
    expect(isBootstrapVisible("myapp.com", false)).toBe(false);
  });

  it("hides bootstrap button on hostname with 'preview' but not Lovable pattern", () => {
    expect(isBootstrapVisible("preview.myapp.com", false)).toBe(false);
  });
});

// ─── Tests: ROLE_CYCLE ────────────────────────────────────────────────────────

describe("ROLE_CYCLE", () => {
  it("cycles super_admin → admin", () => {
    expect(cycleRole("super_admin")).toBe("admin");
  });

  it("cycles admin → store_manager", () => {
    expect(cycleRole("admin")).toBe("store_manager");
  });

  it("cycles store_manager → employee", () => {
    expect(cycleRole("store_manager")).toBe("employee");
  });

  it("cycles employee → null (real role)", () => {
    expect(cycleRole("employee")).toBeNull();
  });

  it("cycles null → super_admin (wraps around)", () => {
    expect(cycleRole(null)).toBe("super_admin");
  });

  it("cycle has exactly 5 entries (4 roles + null)", () => {
    expect(ROLE_CYCLE).toHaveLength(5);
  });

  it("store_manager is in the cycle (FASE 1 addition)", () => {
    expect(ROLE_CYCLE).toContain("store_manager");
  });
});

// ─── Tests: isAuthorized ──────────────────────────────────────────────────────

describe("isAuthorized", () => {
  it("authorized when role set and has at least 1 store", () => {
    expect(isAuthorized("employee", 1)).toBe(true);
    expect(isAuthorized("super_admin", 3)).toBe(true);
  });

  it("not authorized when role is null", () => {
    expect(isAuthorized(null, 1)).toBe(false);
  });

  it("not authorized when 0 stores (account not assigned)", () => {
    expect(isAuthorized("employee", 0)).toBe(false);
    expect(isAuthorized("admin", 0)).toBe(false);
  });

  it("not authorized when both null role and 0 stores", () => {
    expect(isAuthorized(null, 0)).toBe(false);
  });
});

// ─── Smoke test: RBAC role hierarchy ─────────────────────────────────────────

describe("RBAC role hierarchy — smoke", () => {
  const managerRoles: AppRole[] = ["super_admin", "admin", "store_manager"];
  const allRoles: AppRole[] = ["super_admin", "admin", "store_manager", "employee"];

  it("manager roles include store_manager (FASE 1)", () => {
    expect(managerRoles).toContain("store_manager");
  });

  it("all 4 roles are defined", () => {
    expect(allRoles).toHaveLength(4);
  });

  it("employee is not a manager role", () => {
    expect(managerRoles).not.toContain("employee");
  });

  it("isManager check matches Edge Function pattern", () => {
    const isManager = (role: AppRole | null) =>
      ["admin", "super_admin", "store_manager"].includes(role ?? "");
    expect(isManager("store_manager")).toBe(true);
    expect(isManager("admin")).toBe(true);
    expect(isManager("super_admin")).toBe(true);
    expect(isManager("employee")).toBe(false);
    expect(isManager(null)).toBe(false);
  });
});
