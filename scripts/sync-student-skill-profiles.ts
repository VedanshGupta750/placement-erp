// Pulls AGGREGATE assessment-performance signal out of the assessments app
// (~/placement-erp-assessments — a fully separate app/DB, reached
// everywhere else in this codebase only via one-shot SSO) and turns it
// into StudentSkillProfile rows here. This is the one place in this app
// that reads from that database, and it only ever reads: a plain SQL
// SELECT over its own Postgres connection, never a live query issued
// during a request, never a write back into that database. Same one-way,
// decoupled-sync philosophy as scripts/sync-external-jobs.ts.
//
// The join key is the SSO token's `sub` claim, which is this app's own
// User.id and is reused verbatim as the assessments app's
// AssessmentUser.id — that shared id is already the entire trust contract
// between the two apps (see app/api/assessments/sso/route.ts), so joining
// on it here isn't a new coupling risk.
//
// Run manually:
//   npx tsx scripts/sync-student-skill-profiles.ts
// Or on a cadence (assessment results don't change minute-to-minute):
//   0 6 * * *  cd /path/to/placement-erp && npx tsx scripts/sync-student-skill-profiles.ts >> logs/sync-student-skill-profiles.log 2>&1
//
// Idempotent and safe to re-run: one row per student, upserted by
// studentId — a re-run just refreshes the numbers.
import "dotenv/config";
import { Client } from "pg";
import { prisma } from "@/lib/db";

const ASSESSMENTS_DATABASE_URL =
  process.env.ASSESSMENTS_DATABASE_URL ?? "postgresql://yashkhandelwal@localhost:5432/placement_erp_assessments_dev?schema=public";

type Aggregate = {
  user_id: string;
  finalized_attempt_count: string; // bigint comes back as string from pg
  avg_score_percent: string | null;
  coding_submission_count: string;
  avg_coding_pass_percent: string | null;
};

async function fetchAggregates(): Promise<Aggregate[]> {
  const client = new Client({ connectionString: ASSESSMENTS_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<Aggregate>(`
      SELECT
        ta."userId" AS user_id,
        COUNT(DISTINCT ta.id) AS finalized_attempt_count,
        AVG(CASE WHEN ta."totalPoints" > 0 THEN ta.score::float / ta."totalPoints" * 100 END) AS avg_score_percent,
        COUNT(cs.id) AS coding_submission_count,
        AVG(CASE WHEN cs."totalCount" > 0 THEN cs."passedCount"::float / cs."totalCount" * 100 END) AS avg_coding_pass_percent
      FROM test_attempts ta
      LEFT JOIN coding_submissions cs ON cs."attemptId" = ta.id
      WHERE ta.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
      GROUP BY ta."userId"
    `);
    return rows;
  } finally {
    await client.end();
  }
}

async function main() {
  const aggregates = await fetchAggregates();
  console.log(`Read assessment aggregates for ${aggregates.length} user(s) from the assessments database.`);

  let upserted = 0;
  let skippedNoStudent = 0;

  for (const row of aggregates) {
    const student = await prisma.student.findUnique({ where: { userId: row.user_id }, select: { id: true, collegeId: true } });
    if (!student) {
      // A PLACEMENT_TEAM user (or a student who SSO'd but whose Student
      // row was later removed) has no Student row — nothing to attach a
      // skill profile to. Not an error, just not applicable.
      skippedNoStudent++;
      continue;
    }

    await prisma.studentSkillProfile.upsert({
      where: { studentId: student.id },
      create: {
        collegeId: student.collegeId,
        studentId: student.id,
        finalizedAttemptCount: Number(row.finalized_attempt_count),
        avgScorePercent: row.avg_score_percent != null ? Number(row.avg_score_percent) : null,
        codingSubmissionCount: Number(row.coding_submission_count),
        avgCodingPassPercent: row.avg_coding_pass_percent != null ? Number(row.avg_coding_pass_percent) : null,
      },
      update: {
        finalizedAttemptCount: Number(row.finalized_attempt_count),
        avgScorePercent: row.avg_score_percent != null ? Number(row.avg_score_percent) : null,
        codingSubmissionCount: Number(row.coding_submission_count),
        avgCodingPassPercent: row.avg_coding_pass_percent != null ? Number(row.avg_coding_pass_percent) : null,
      },
    });
    upserted++;
  }

  console.log(`Upserted ${upserted} StudentSkillProfile row(s). Skipped ${skippedNoStudent} user(s) with no matching Student.`);
}

main()
  .catch((err) => {
    console.error("sync-student-skill-profiles failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
