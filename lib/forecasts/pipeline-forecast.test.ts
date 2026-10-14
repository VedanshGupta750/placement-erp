import { describe, it, expect } from "vitest";
import { getPipelineForecast } from "./pipeline-forecast";

// A stand-in for the Prisma client, driven by plain numbers. The forecast
// module only ever calls count/findMany, so this is enough to assert the
// arithmetic without a database.
type Fixture = {
  resolvedApps: number;
  selectedApps: number;
  roundOutcomes: number;
  roundPassed: number;
  eligibleStudents: number;
  /** studentId -> live application count */
  inProgress: Record<string, number>;
  /** students whose applications have all resolved */
  settled: string[];
  placed: string[];
};

function fakeDb(f: Fixture) {
  const inProgressRows = Object.entries(f.inProgress).flatMap(([id, n]) =>
    Array.from({ length: n }, () => ({ studentId: id, student: { department: { name: "CSE" } } })),
  );
  return {
    offer: {
      findMany: async () => f.placed.map((id) => ({ studentId: id })),
    },
    student: { count: async () => f.eligibleStudents },
    roundCandidate: {
      count: async ({ where }: { where: { status: unknown } }) =>
        Array.isArray((where.status as { in?: string[] }).in) ? f.roundOutcomes : f.roundPassed,
    },
    application: {
      count: async ({ where }: { where: { status: unknown } }) =>
        typeof where.status === "string" ? f.selectedApps : f.resolvedApps,
      findMany: async ({ where, distinct }: { where: { status: { in: string[] } }; distinct?: string[] }) => {
        const resolved = where.status.in.includes("SELECTED");
        if (resolved) return f.settled.map((id) => ({ studentId: id }));
        // In-progress: distinct asks for unique students, otherwise raw rows.
        return distinct ? [...new Set(inProgressRows.map((r) => r.studentId))].map((studentId) => ({ studentId })) : inProgressRows;
      },
    },
  };
}

const base: Fixture = {
  resolvedApps: 0,
  selectedApps: 0,
  roundOutcomes: 20,
  roundPassed: 10,
  eligibleStudents: 100,
  inProgress: {},
  settled: [],
  placed: [],
};

describe("getPipelineForecast", () => {
  it("refuses to project when too little has finished", async () => {
    const f = { ...base, resolvedApps: 4, selectedApps: 2, settled: ["a", "b"] };
    const r = await getPipelineForecast(fakeDb(f));
    expect(r.confident).toBe(false);
    expect(r.expectedAdditionalPlacements).toBeNull();
  });

  it("prefers the per-student rate once enough students have finished", async () => {
    // 20 settled students, 10 of them placed -> 50% per-student rate.
    const settled = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const f: Fixture = {
      ...base,
      resolvedApps: 40,
      selectedApps: 36, // a wildly different application rate, to prove it isn't used
      settled,
      placed: settled.slice(0, 10),
      inProgress: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i}`, 1])),
    };
    const r = await getPipelineForecast(fakeDb(f));
    expect(r.basis).toBe("student");
    expect(r.conversionRatePct).toBe(50);
    expect(r.sampleUnit).toBe("students");
    // 10 in progress x 50% = 5
    expect(r.expectedAdditionalPlacements).toBe(5);
  });

  it("falls back to the application rate, converted per student, when students are too few", async () => {
    // 20 resolved applications, 10 selected -> p = 0.5. Only 3 settled
    // students, so the student basis can't be used.
    const f: Fixture = {
      ...base,
      resolvedApps: 20,
      selectedApps: 10,
      settled: ["a", "b", "c"],
      placed: [],
      // One student with 2 live applications: 1 - 0.5^2 = 0.75, not 0.5.
      inProgress: { x: 2 },
    };
    const r = await getPipelineForecast(fakeDb(f));
    expect(r.basis).toBe("application");
    expect(r.sampleUnit).toBe("applications");
    expect(r.inProgressStudents).toBe(1);
    expect(r.inProgressApplications).toBe(2);
    expect(r.expectedAdditionalPlacements).toBe(1); // round(0.75)
  });

  it("never projects more placements than there are unplaced students", async () => {
    const settled = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const f: Fixture = {
      ...base,
      eligibleStudents: 12,
      resolvedApps: 20,
      selectedApps: 20,
      settled,
      placed: settled.slice(0, 10), // 10 placed of 12 eligible -> only 2 spare
      inProgress: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`p${i}`, 1])),
    };
    const r = await getPipelineForecast(fakeDb(f));
    expect(r.expectedAdditionalPlacements).toBe(2);
    expect(r.projectedPlacedCount).toBe(12);
    expect(r.projectedPlacementPct).toBe(100);
  });

  it("flags a thin sample as indicative", async () => {
    const settled = Array.from({ length: 12 }, (_, i) => `s${i}`);
    const f: Fixture = { ...base, resolvedApps: 12, selectedApps: 6, settled, placed: settled.slice(0, 6) };
    const r = await getPipelineForecast(fakeDb(f));
    expect(r.confident).toBe(true);
    expect(r.indicative).toBe(true);
  });

  it("reports the interview pass rate without letting it touch the projection", async () => {
    const settled = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const inProgress = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i}`, 1]));
    const low = await getPipelineForecast(
      fakeDb({ ...base, settled, placed: settled.slice(0, 10), inProgress, roundOutcomes: 20, roundPassed: 2 }),
    );
    const high = await getPipelineForecast(
      fakeDb({ ...base, settled, placed: settled.slice(0, 10), inProgress, roundOutcomes: 20, roundPassed: 18 }),
    );
    expect(low.interviewPassRatePct).toBe(10);
    expect(high.interviewPassRatePct).toBe(90);
    // A 9x difference in interview pass rate must not move the projection.
    expect(low.expectedAdditionalPlacements).toBe(high.expectedAdditionalPlacements);
  });
});
