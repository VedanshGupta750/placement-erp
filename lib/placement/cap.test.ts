import { describe, it, expect } from "vitest";
import { evaluatePlacementCap, EMPTY_CAP_POLICY, type PlacementCapPolicy } from "./cap";

const policy = (over: Partial<PlacementCapPolicy> = {}): PlacementCapPolicy => ({
  ...EMPTY_CAP_POLICY,
  enabled: true,
  ...over,
});

const input = (over: Partial<Parameters<typeof evaluatePlacementCap>[1]> = {}) => ({
  placed: true,
  currentCtc: 600000,
  studentIsTechnical: true,
  existingIsTechnical: true,
  driveCtc: 1000000,
  driveIsTechnical: true,
  ...over,
});

describe("evaluatePlacementCap", () => {
  it("never caps a student who isn't confirmed placed", () => {
    const r = evaluatePlacementCap(policy({ floor: 5000000 }), input({ placed: false, driveCtc: 100000 }));
    expect(r.allowed).toBe(true);
  });

  it("blocks a placed student outright when no cap policy is on", () => {
    const r = evaluatePlacementCap(EMPTY_CAP_POLICY, input());
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("already placed");
  });

  // The worked example: placed at 6 LPA, floor set to 10 LPA.
  it("FIXED_FLOOR allows at or above the floor and blocks below", () => {
    const p = policy({ mode: "FIXED_FLOOR", floor: 1000000 });
    expect(evaluatePlacementCap(p, input({ driveCtc: 800000 })).allowed).toBe(false);
    expect(evaluatePlacementCap(p, input({ driveCtc: 1000000 })).allowed).toBe(true);
    expect(evaluatePlacementCap(p, input({ driveCtc: 2500000 })).allowed).toBe(true);
  });

  it("FIXED_FLOOR ignores what the student currently holds", () => {
    const p = policy({ mode: "FIXED_FLOOR", floor: 1000000 });
    // Already on 12L, drive at 10L — still allowed, the floor is absolute.
    expect(evaluatePlacementCap(p, input({ currentCtc: 1200000, driveCtc: 1000000 })).allowed).toBe(true);
  });

  // The rule the user described: hold 6 LPA, step of 4 LPA, so 10 LPA.
  it("INCREMENT sets the bar at current package plus the step", () => {
    const p = policy({ mode: "INCREMENT", increment: 400000 });
    expect(evaluatePlacementCap(p, input({ currentCtc: 600000, driveCtc: 900000 })).allowed).toBe(false);
    expect(evaluatePlacementCap(p, input({ currentCtc: 600000, driveCtc: 1000000 })).allowed).toBe(true);
    expect(evaluatePlacementCap(p, input({ currentCtc: 600000, driveCtc: 1500000 })).allowed).toBe(true);
  });

  it("INCREMENT moves the bar with each student, unlike a fixed floor", () => {
    const p = policy({ mode: "INCREMENT", increment: 400000 });
    // On 12L the same 10L drive is now below their own bar of 16L.
    expect(evaluatePlacementCap(p, input({ currentCtc: 1200000, driveCtc: 1000000 })).allowed).toBe(false);
    expect(evaluatePlacementCap(p, input({ currentCtc: 1200000, driveCtc: 1600000 })).allowed).toBe(true);
  });

  it("INCREMENT uses the cross-field step when the placement crossed fields", () => {
    const p = policy({ mode: "INCREMENT", increment: 400000, crossEnabled: true, crossIncrement: 100000 });
    // Same branch: needs 6L + 4L = 10L.
    expect(
      evaluatePlacementCap(p, input({ existingIsTechnical: true, currentCtc: 600000, driveCtc: 700000 })).allowed,
    ).toBe(false);
    // Crossed fields: only 6L + 1L = 7L.
    expect(
      evaluatePlacementCap(p, input({ existingIsTechnical: false, currentCtc: 600000, driveCtc: 700000 })).allowed,
    ).toBe(true);
  });

  it("INCREMENT says so when no package is recorded against the placement", () => {
    const r = evaluatePlacementCap(policy({ mode: "INCREMENT", increment: 400000 }), input({ currentCtc: null }));
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("no package is recorded");
  });

  it("MULTIPLIER scales the bar with the student's current package", () => {
    const p = policy({ mode: "MULTIPLIER", multiplier: 1.5 });
    // 6L x 1.5 = 9L
    expect(evaluatePlacementCap(p, input({ currentCtc: 600000, driveCtc: 800000 })).allowed).toBe(false);
    expect(evaluatePlacementCap(p, input({ currentCtc: 600000, driveCtc: 900000 })).allowed).toBe(true);
    // 12L x 1.5 = 18L — the same 10L drive is now out of reach.
    expect(evaluatePlacementCap(p, input({ currentCtc: 1200000, driveCtc: 1000000 })).allowed).toBe(false);
  });

  it("applies the cross-category rule only when the branch and the placement differ", () => {
    const p = policy({ mode: "FIXED_FLOOR", floor: 2000000, crossEnabled: true, crossFloor: 800000 });
    // Tech student placed in a tech role -> the strict 20L floor.
    expect(
      evaluatePlacementCap(p, input({ studentIsTechnical: true, existingIsTechnical: true, driveCtc: 1000000 })).allowed,
    ).toBe(false);
    // Tech student placed in a NON-tech role -> the softer 8L floor.
    expect(
      evaluatePlacementCap(p, input({ studentIsTechnical: true, existingIsTechnical: false, driveCtc: 1000000 })).allowed,
    ).toBe(true);
    // And the reverse: non-tech student placed in a tech role.
    expect(
      evaluatePlacementCap(p, input({ studentIsTechnical: false, existingIsTechnical: true, driveCtc: 1000000 })).allowed,
    ).toBe(true);
  });

  it("falls back to the main rule when cross is on but has no figure of its own", () => {
    const p = policy({ mode: "FIXED_FLOOR", floor: 2000000, crossEnabled: true, crossFloor: null });
    expect(
      evaluatePlacementCap(p, input({ studentIsTechnical: true, existingIsTechnical: false, driveCtc: 1000000 })).allowed,
    ).toBe(false);
  });

  it("explains itself rather than silently blocking when the policy is unconfigured", () => {
    const r = evaluatePlacementCap(policy({ mode: "FIXED_FLOOR", floor: null }), input());
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("hasn't set the figure");
  });

  it("blocks when the drive publishes no package, and says why", () => {
    const r = evaluatePlacementCap(policy({ mode: "FIXED_FLOOR", floor: 1000000 }), input({ driveCtc: null }));
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("hasn't published a package");
  });

  it("quotes the figure in lakhs so the message is readable", () => {
    const r = evaluatePlacementCap(policy({ mode: "FIXED_FLOOR", floor: 1000000 }), input({ driveCtc: 800000 }));
    expect(r.reason).toContain("₹10L");
    expect(r.reason).toContain("₹8L");
  });
});
