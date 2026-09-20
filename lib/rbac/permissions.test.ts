import { describe, it, expect } from "vitest";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLES } from "./permissions";

// This catalog is the actual security boundary of the app — every route
// gate (requirePermission/hasPermission) checks against it. A typo or a
// stale key here is invisible until someone hits the affected route, which
// is exactly the class of bug this session found and fixed by hand
// (7 zero-permission-gate leaks). These tests catch the catalog-level
// version of that mistake for free, on every change.

describe("PERMISSIONS catalog", () => {
  it("has no duplicate keys", () => {
    const keys = PERMISSIONS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every key follows resource.action shape", () => {
    for (const p of PERMISSIONS) {
      expect(p.key).toBe(`${p.resource}.${p.action}`);
      expect(p.resource.length).toBeGreaterThan(0);
      expect(p.action.length).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_ROLE_PERMISSIONS", () => {
  const catalogKeys = new Set(PERMISSIONS.map((p) => p.key));

  it("has an entry for every seeded system role except TPO", () => {
    const rolesNeedingEntries = SYSTEM_ROLES.filter((r) => r !== "TPO");
    for (const role of rolesNeedingEntries) {
      expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty(role);
    }
  });

  it("only grants permissions that exist in the catalog", () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const key of perms) {
        expect(catalogKeys.has(key), `${role} grants unknown permission "${key}"`).toBe(true);
      }
    }
  });

  it("grants no role duplicate permissions", () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      expect(new Set(perms).size, `${role} has duplicate grants`).toBe(perms.length);
    }
  });

  // Encodes the exact security invariant behind this session's bug sweep:
  // Student is a self-service role and must never get staff-only visibility
  // into the full student/company/drive roster. If this ever starts
  // failing, a self-service-vs-staff boundary just got blurred.
  it("Student role never gets staff-only roster permissions", () => {
    const studentPerms = new Set(DEFAULT_ROLE_PERMISSIONS.Student);
    const staffOnly = ["student.view", "drive.view", "drive.create", "company.view", "student.export", "student.bulk_update"];
    for (const key of staffOnly) {
      expect(studentPerms.has(key as never), `Student unexpectedly has "${key}"`).toBe(false);
    }
  });

  // Auditor is read-only by design — it exists to observe, not act.
  it("Auditor role never gets a create/edit/delete/approve permission", () => {
    const mutatingActions = ["create", "edit", "delete", "approve", "reject", "issue", "publish", "override", "bulk_update"];
    for (const key of DEFAULT_ROLE_PERMISSIONS.Auditor) {
      const action = key.split(".")[1];
      expect(mutatingActions.includes(action), `Auditor unexpectedly has mutating permission "${key}"`).toBe(false);
    }
  });
});
