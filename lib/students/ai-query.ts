import "server-only";
import type { TenantDb } from "@/lib/tenant/scoped-db";
import { generateJSON } from "@/lib/ai/client";
import { runEligibilityEvaluation } from "@/lib/eligibility-runner";
import type { EligibilityLogic } from "@/lib/eligibility";

type ExtractedCriteria = {
  departmentName: string | null;
  courseName: string | null;
  batchYear: number | null;
  minCgpa: number | null;
  maxCgpa: number | null;
  eligibleForPlacements: boolean | null;
  placementStatus: "SEEKING" | "PLACED" | "NOT_INTERESTED" | "OPTED_OUT" | null;
  notPlaced: boolean | null;
  hasBacklogs: boolean | null;
  companyName: string | null;
  excludeAlreadyApplied: boolean;
  unmatchable: string[];
};

// Natural-language filter query — "Show me CSE students eligible for
// Siemens but not yet applied" -> a real student list. Deliberately never
// takes an action itself (no bulk mutation, no message send): it only ever
// produces a filtered list for the TPO to review, same "human confirms
// before anything happens" rule the rest of this app's AI features follow
// (grounded-only generation, explicit review before any bulk action goes
// through the existing BulkActionsBar).
export async function runStudentAiQuery(db: TenantDb, collegeId: string, query: string) {
  const [departments, courses, batches] = await Promise.all([
    db.department.findMany({ select: { id: true, name: true } }),
    db.course.findMany({ select: { id: true, name: true, specialization: true } }),
    db.batch.findMany({ select: { id: true, year: true } }),
  ]);

  const courseNames = courses.map((c: { name: string; specialization: string | null }) => c.specialization ?? c.name).join(", ");
  const departmentNames = departments.map((d: { name: string }) => d.name).join(", ") || "(none configured)";

  const { data: criteria, stub } = await generateJSON<ExtractedCriteria>({
    system:
      "You extract structured search criteria from a TPO's natural-language question about students at a campus placement cell. " +
      "Return ONLY fields you're confident about from the text — null for anything not mentioned. " +
      `This college's real departments are: ${departmentNames}. Its real courses/branches are: ${courseNames}. ` +
      "A branch/stream reference like 'CSE' or 'ECE' almost always means courseName (this college models branches as Courses, not Departments). " +
      "The caller matches courseName as a plain case-insensitive substring against the real course list above — it does NOT know abbreviation expansions itself, so YOU must expand any common engineering-branch abbreviation to a distinctive word that actually appears in that real course list before returning it (e.g. 'ECE' -> 'Electronics', 'EEE'/'EE' -> 'Electrical', 'ME' -> 'Mechanical', 'CE' -> 'Civil', 'IT' -> whichever real course name it maps to, 'CSE' -> 'Computer Science' UNLESS the question means only the base CSE branch and not its AI&ML/Data-Science variants, in which case keep 'CSE' so all three match). Look at the real course list above and pick the substring that will actually hit — never return an abbreviation that doesn't literally occur in any of those names. " +
      "Only set departmentName if the question clearly means an administrative department from the real list above, not a branch/stream. " +
      "placementStatus is ONLY ever one of these exact 4 strings — SEEKING, PLACED, NOT_INTERESTED, OPTED_OUT — or null; never invent any other value for it. " +
      "If the question means 'not placed' / 'unplaced' / 'yet to be placed', do NOT use placementStatus for that — set notPlaced to true instead (placementStatus is for the 4 exact literal states above only). " +
      "companyName is set only if a specific company/drive is named (e.g. 'eligible for Siemens', 'applied to TCS'). " +
      "excludeAlreadyApplied is true only if the query explicitly says something like 'not applied' / 'haven't applied' / 'not yet applied'. " +
      "unmatchable lists any part of the question you could NOT map to a field here (e.g. a criterion this schema has no field for) — be honest, don't silently drop things.",
    prompt: `Question: "${query}"\n\nRespond as JSON: {departmentName, courseName, batchYear, minCgpa, maxCgpa, eligibleForPlacements, placementStatus, notPlaced, hasBacklogs, companyName, excludeAlreadyApplied, unmatchable}`,
    stubFallback: () => ({
      departmentName: null,
      courseName: null,
      batchYear: null,
      minCgpa: null,
      maxCgpa: null,
      eligibleForPlacements: null,
      placementStatus: null,
      notPlaced: null,
      hasBacklogs: null,
      companyName: null,
      excludeAlreadyApplied: false,
      unmatchable: ["AI generation isn't configured (no ANTHROPIC_API_KEY/OPENAI_API_KEY set) — showing an unfiltered match on any text present instead."],
    }),
  });

  // Defense in depth: even with the prompt's explicit constraint, never
  // trust the model's output blindly — an invalid placementStatus value
  // would otherwise silently match zero rows instead of erroring loudly.
  const VALID_PLACEMENT_STATUSES = new Set(["SEEKING", "PLACED", "NOT_INTERESTED", "OPTED_OUT"]);
  if (criteria.placementStatus && !VALID_PLACEMENT_STATUSES.has(criteria.placementStatus)) {
    criteria.unmatchable = [...criteria.unmatchable, `Ignored an unrecognized placement status the AI returned: "${criteria.placementStatus}".`];
    criteria.placementStatus = null;
  }

  // Fuzzy-resolve the AI's plain-text guesses to real records ourselves —
  // more robust than asking the model to know exact IDs it was never given.
  // Broad terms like "CSE" deliberately match EVERY course containing that
  // text (e.g. CSE, CSE - AI & ML, CSE - Data Science all match "CSE"),
  // not just the first hit — a TPO asking for "CSE students" almost always
  // means all CSE-prefixed branches collectively.
  const matchedDepartments = criteria.departmentName
    ? departments.filter((d: { name: string }) => d.name.toLowerCase().includes(criteria.departmentName!.toLowerCase()) || criteria.departmentName!.toLowerCase().includes(d.name.toLowerCase()))
    : [];
  const matchedCourses = criteria.courseName
    ? courses.filter((c: { name: string; specialization: string | null }) => {
        const needle = criteria.courseName!.toLowerCase();
        return c.name.toLowerCase().includes(needle) || (c.specialization ?? "").toLowerCase().includes(needle);
      })
    : [];
  const batch = criteria.batchYear ? batches.find((b: { year: number }) => b.year === criteria.batchYear) : null;

  const where: Record<string, unknown> = {};
  if (matchedDepartments.length === 1) where.departmentId = matchedDepartments[0].id;
  else if (matchedDepartments.length > 1) where.departmentId = { in: matchedDepartments.map((d: { id: string }) => d.id) };
  if (matchedCourses.length === 1) where.courseId = matchedCourses[0].id;
  else if (matchedCourses.length > 1) where.courseId = { in: matchedCourses.map((c: { id: string }) => c.id) };
  if (batch) where.batchId = batch.id;
  if (criteria.minCgpa != null || criteria.maxCgpa != null) {
    where.aggregate = { ...(criteria.minCgpa != null ? { gte: criteria.minCgpa } : {}), ...(criteria.maxCgpa != null ? { lte: criteria.maxCgpa } : {}) };
  }
  if (criteria.eligibleForPlacements != null) where.eligibleForPlacements = criteria.eligibleForPlacements;
  if (criteria.placementStatus) where.placementStatus = criteria.placementStatus;
  else if (criteria.notPlaced) where.placementStatus = { not: "PLACED" };
  if (criteria.hasBacklogs != null) where.liveBacklogs = criteria.hasBacklogs ? { gt: 0 } : 0;

  let drive: { id: string; title: string; companyName: string } | null = null;
  let studentIds: string[] | null = null;

  if (criteria.companyName) {
    const matchingDrive = await db.drive.findFirst({
      where: { company: { name: { contains: criteria.companyName, mode: "insensitive" } } },
      select: {
        id: true,
        title: true,
        company: { select: { name: true } },
        eligibilityRules: { where: { isPublished: true }, orderBy: { version: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    if (matchingDrive && matchingDrive.eligibilityRules.length > 0) {
      drive = { id: matchingDrive.id, title: matchingDrive.title, companyName: matchingDrive.company.name };
      const logic = matchingDrive.eligibilityRules[0].logic as EligibilityLogic;
      const evaluations = await runEligibilityEvaluation(db, matchingDrive.id, logic);
      let ids = evaluations.filter((e) => e.eligible).map((e) => e.studentId);

      // Apply the same general filters (department/course/batch/cgpa/...)
      // as an additional narrowing pass on top of the drive-eligible set.
      if (Object.keys(where).length > 0) {
        const filtered = await db.student.findMany({ where: { ...where, id: { in: ids } }, select: { id: true } });
        ids = filtered.map((s: { id: string }) => s.id);
      }

      if (criteria.excludeAlreadyApplied && ids.length > 0) {
        const applied = await db.application.findMany({ where: { driveId: matchingDrive.id, studentId: { in: ids } }, select: { studentId: true } });
        const appliedIds = new Set(applied.map((a: { studentId: string }) => a.studentId));
        ids = ids.filter((id) => !appliedIds.has(id));
      }
      studentIds = ids;
    } else if (matchingDrive) {
      criteria.unmatchable = [...criteria.unmatchable, `Found a "${criteria.companyName}" drive but it has no published eligibility rule to check against.`];
    } else {
      criteria.unmatchable = [...criteria.unmatchable, `No drive found matching "${criteria.companyName}".`];
    }
  }

  const students = studentIds
    ? await db.student.findMany({ where: { id: { in: studentIds } }, include: { user: true, course: true }, orderBy: { user: { name: "asc" } }, take: 200 })
    : await db.student.findMany({ where, include: { user: true, course: true }, orderBy: { user: { name: "asc" } }, take: 200 });

  return {
    stub,
    drive,
    matchedIds: students.map((s: { id: string }) => s.id),
    students: students.map((s: { id: string; enrollmentNumber: string; user: { name: string }; course: { name: string; specialization: string | null }; aggregate: number | null }) => ({
      id: s.id,
      enrollmentNumber: s.enrollmentNumber,
      name: s.user.name,
      courseLabel: s.course.specialization ?? s.course.name,
      cgpa: s.aggregate,
    })),
    unmatched: criteria.unmatchable,
    interpreted: {
      department: matchedDepartments.map((d: { name: string }) => d.name).join(", ") || null,
      course: matchedCourses.map((c: { specialization: string | null; name: string }) => c.specialization ?? c.name).join(", ") || null,
      batchYear: batch?.year ?? null,
      minCgpa: criteria.minCgpa,
      maxCgpa: criteria.maxCgpa,
      eligibleForPlacements: criteria.eligibleForPlacements,
      placementStatus: criteria.placementStatus ?? (criteria.notPlaced ? "NOT PLACED" : null),
      hasBacklogs: criteria.hasBacklogs,
      company: drive?.companyName ?? null,
      excludeAlreadyApplied: criteria.excludeAlreadyApplied,
    },
  };
}
