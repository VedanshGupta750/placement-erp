// The eligibility engine's evaluation core — a small, deterministic AND/OR/NOT
// interpreter over a fixed set of student fields. Deliberately not a general
// rule engine: the field set is closed and typed so "why was this student
// excluded" can always be rendered as a plain-English explanation, per the
// Placement OS spec's requirement that every eligibility decision be
// explainable.

// Field set intentionally stays closed to what real Student/
// StudentSkill/StudentExperience/StudentCertification columns back —
// gender/category/age/gap-years have no schema field anywhere in this app
// (Student was never modeled with them), so they're deliberately NOT here;
// adding UI for fields nothing stores would be exactly the kind of fake
// dashboard this app's build sessions have consistently avoided.
export type EligibilityField =
  | "cgpa"
  | "active_backlogs"
  | "batch_year"
  | "course_id"
  | "department_id"
  | "tenth_score"
  | "twelfth_score"
  | "diploma_score"
  | "closed_backlogs"
  | "skill_ids"
  | "has_experience"
  | "has_certification";
export type EligibilityOperator = ">=" | "<=" | "==" | "!=" | ">" | "<" | "IN" | "NOT_IN";

export type EligibilityCondition = {
  field: EligibilityField;
  operator: EligibilityOperator;
  value: number | string | boolean | string[];
};

export type EligibilityLogic =
  | EligibilityCondition
  | { operator: "AND" | "OR" | "NOT"; children: EligibilityLogic[] };

export type StudentEligibilityFacts = {
  cgpa: number | null;
  active_backlogs: number;
  batch_year: number;
  course_id: string;
  department_id: string | null;
  tenth_score: number | null;
  twelfth_score: number | null;
  diploma_score: number | null;
  closed_backlogs: number;
  skill_ids: string[];
  has_experience: boolean;
  has_certification: boolean;
};

export type EligibilityCheck = {
  field: EligibilityField;
  operator: EligibilityOperator;
  expected: number | string | boolean | string[];
  actual: number | string | boolean | string[] | null;
  passed: boolean;
};

function isCondition(node: EligibilityLogic): node is EligibilityCondition {
  return "field" in node;
}

const ARRAY_FACT_FIELDS = new Set<EligibilityField>(["skill_ids"]);
const BOOLEAN_FACT_FIELDS = new Set<EligibilityField>(["has_experience", "has_certification"]);

function evalCondition(cond: EligibilityCondition, facts: StudentEligibilityFacts): EligibilityCheck {
  const actual = facts[cond.field];
  let passed = false;

  if (ARRAY_FACT_FIELDS.has(cond.field)) {
    // "IN" here means "student has at least one of these" (e.g. required
    // skills), "NOT_IN" means "student has none of these" — a different
    // shape than the scalar IN/NOT_IN below (which checks a single actual
    // value against a list of acceptable ones).
    const actualIds = Array.isArray(actual) ? actual : [];
    const wanted = Array.isArray(cond.value) ? cond.value : [];
    const overlaps = wanted.some((v) => actualIds.includes(String(v)));
    passed = cond.operator === "NOT_IN" ? !overlaps : overlaps;
  } else if (BOOLEAN_FACT_FIELDS.has(cond.field)) {
    passed = cond.operator === "!=" ? actual !== cond.value : actual === cond.value;
  } else {
    switch (cond.operator) {
      case ">=":
        passed = actual !== null && Number(actual) >= Number(cond.value);
        break;
      case "<=":
        passed = actual !== null && Number(actual) <= Number(cond.value);
        break;
      case ">":
        passed = actual !== null && Number(actual) > Number(cond.value);
        break;
      case "<":
        passed = actual !== null && Number(actual) < Number(cond.value);
        break;
      case "==":
        passed = String(actual) === String(cond.value);
        break;
      case "!=":
        passed = String(actual) !== String(cond.value);
        break;
      case "IN":
        passed = Array.isArray(cond.value) && actual !== null && cond.value.includes(String(actual));
        break;
      case "NOT_IN":
        passed = Array.isArray(cond.value) && (actual === null || !cond.value.includes(String(actual)));
        break;
    }
  }
  return { field: cond.field, operator: cond.operator, expected: cond.value, actual, passed };
}

export function evaluateEligibility(
  logic: EligibilityLogic,
  facts: StudentEligibilityFacts,
): { eligible: boolean; checks: EligibilityCheck[] } {
  const checks: EligibilityCheck[] = [];

  function walk(node: EligibilityLogic): boolean {
    if (isCondition(node)) {
      const check = evalCondition(node, facts);
      checks.push(check);
      return check.passed;
    }
    if (node.operator === "AND") return node.children.every(walk);
    if (node.operator === "OR") return node.children.some(walk);
    // NOT — spec's example nests NOT around a single child.
    return !node.children.every(walk);
  }

  const eligible = walk(logic);
  return { eligible, checks };
}

// Default logic when a drive publishes with no custom rule authored — pure
// course eligibility (already enforced via DriveCourse), no additional
// academic filter. Kept explicit rather than "no rule = everyone eligible"
// so the snapshot always has a real, inspectable logic tree.
export const DEFAULT_ELIGIBILITY_LOGIC: EligibilityLogic = {
  operator: "AND",
  children: [{ field: "active_backlogs", operator: "<=", value: 0 }],
};

// Builds a logic tree from the simplified TPO-facing form — still a flat
// AND (see lib/validators/eligibility.ts for why a full visual AND/OR/NOT
// builder isn't exposed in the UI), now covering every field the engine
// understands, not just CGPA/backlogs.
export function buildSimpleEligibilityLogic(input: {
  minCgpa?: number;
  maxActiveBacklogs?: number;
  minTenth?: number;
  minTwelfth?: number;
  minDiploma?: number;
  maxClosedBacklogs?: number;
  requiredSkillIds?: string[];
  requireExperience?: boolean;
  requireCertification?: boolean;
}): EligibilityLogic {
  const children: EligibilityCondition[] = [];
  if (input.minCgpa !== undefined) children.push({ field: "cgpa", operator: ">=", value: input.minCgpa });
  children.push({ field: "active_backlogs", operator: "<=", value: input.maxActiveBacklogs ?? 0 });
  if (input.minTenth !== undefined) children.push({ field: "tenth_score", operator: ">=", value: input.minTenth });
  if (input.minTwelfth !== undefined) children.push({ field: "twelfth_score", operator: ">=", value: input.minTwelfth });
  if (input.minDiploma !== undefined) children.push({ field: "diploma_score", operator: ">=", value: input.minDiploma });
  if (input.maxClosedBacklogs !== undefined) children.push({ field: "closed_backlogs", operator: "<=", value: input.maxClosedBacklogs });
  if (input.requiredSkillIds && input.requiredSkillIds.length > 0) children.push({ field: "skill_ids", operator: "IN", value: input.requiredSkillIds });
  if (input.requireExperience) children.push({ field: "has_experience", operator: "==", value: true });
  if (input.requireCertification) children.push({ field: "has_certification", operator: "==", value: true });
  return { operator: "AND", children };
}

export function describeCondition(c: EligibilityCheck): string {
  const fieldLabel: Record<EligibilityField, string> = {
    cgpa: "CGPA",
    active_backlogs: "Active backlogs",
    batch_year: "Batch year",
    course_id: "Course",
    department_id: "Department",
    tenth_score: "10th %",
    twelfth_score: "12th %",
    diploma_score: "Diploma %",
    closed_backlogs: "Historical (cleared) backlogs",
    skill_ids: "Required skills",
    has_experience: "Work experience on file",
    has_certification: "Certification on file",
  };
  const opLabel: Record<EligibilityOperator, string> = {
    ">=": "at least",
    "<=": "at most",
    ">": "more than",
    "<": "less than",
    "==": "equal to",
    "!=": "not equal to",
    IN: "one of",
    NOT_IN: "not one of",
  };
  return `${fieldLabel[c.field]} must be ${opLabel[c.operator]} ${Array.isArray(c.expected) ? c.expected.join(", ") : c.expected} — actual: ${c.actual ?? "n/a"} (${c.passed ? "passed" : "failed"})`;
}
