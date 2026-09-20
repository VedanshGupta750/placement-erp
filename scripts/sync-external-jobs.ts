// Pulls fresh entry-level job postings from an OFFLINE scraper
// (~/JobTracker, a completely separate project — this script only ever
// reads its JSON export, never writes back to it, never queries it live)
// and, for every college on the platform, auto-approves the ones that pass
// a conservative fresher-relevance filter — no TPO click-through required.
// The keyword filter itself is the trust boundary here, not a human
// review step. This is the only place in this app that ever touches
// JobTracker's output.
//
// Run manually:
//   npx tsx scripts/sync-external-jobs.ts
// Or on a daily cron (matches JobTracker's own daily scrape cadence):
//   0 7 * * *  cd /path/to/placement-erp && npx tsx scripts/sync-external-jobs.ts >> logs/sync-external-jobs.log 2>&1
//
// Idempotent and safe to re-run: postings are upserted by (company,
// sourceJobId), and a college's ExternalJobReview row is only ever
// CREATED once (skipDuplicates) — a TPO's manual override (e.g. rejecting
// an auto-approved posting) is never touched again by a later sync run,
// and a posting already reviewed never resurfaces.
//
// Capped at MAX_NEW_POSTINGS_PER_RUN brand-new postings per run — this is
// a curated daily feed for a TPO to review, not a bulk import. Uncapped,
// a single run against a fresh multi-thousand-job scrape floods every
// college's review queue at once, which defeats the point of a TPO
// reviewing each one individually. Postings already known from a previous
// run are always refreshed (title/location/keywords) regardless of the
// cap — only *new* postings count against it. Diversified one-per-company
// where possible so the 10 aren't dominated by whichever company happens
// to sort first in the scrape.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { classifyFresherJob } from "@/lib/external-jobs/filter";

const SOURCE_PATH = process.env.EXTERNAL_JOBS_SOURCE_PATH ?? join(homedir(), "JobTracker", "jobs.json");
const MAX_NEW_POSTINGS_PER_RUN = Number(process.env.EXTERNAL_JOBS_MAX_NEW_PER_RUN ?? 10);

type SourceJob = {
  company: string;
  job_id: string;
  title: string;
  location?: string;
  link: string;
  description: string;
};

async function main() {
  const raw = await readFile(SOURCE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as { generated_at?: string; jobs: SourceJob[] };
  const jobs = parsed.jobs ?? [];
  console.log(`Read ${jobs.length} postings from ${SOURCE_PATH} (generated_at: ${parsed.generated_at ?? "unknown"})`);

  const matched: { job: SourceJob; result: { matchedKeywords: string[] } }[] = [];
  for (const job of jobs) {
    if (!job.company || !job.job_id || !job.title) continue;
    const result = classifyFresherJob(job.title, job.description ?? "");
    if (!result.matched) continue;
    matched.push({ job, result });
  }

  // A plain select of every known (company, sourceJobId) pair, rather than
  // a WHERE...OR built from `matched` — `matched` can run into the
  // thousands on a fresh scrape, and a many-thousand-condition OR clause
  // is a worse query than just scanning the (realistically small, since
  // this table only grows by up to MAX_NEW_POSTINGS_PER_RUN per run) table.
  const existing = await prisma.externalJobPosting.findMany({ select: { company: true, sourceJobId: true } });
  const existingKey = new Set(existing.map((e) => `${e.company}::${e.sourceJobId}`));

  const toUpsert: typeof matched = [];
  const seenNewCompanies = new Set<string>();
  let newCount = 0;
  for (const entry of matched) {
    const key = `${entry.job.company}::${entry.job.job_id}`;
    if (existingKey.has(key)) {
      toUpsert.push(entry); // already known — always refresh, doesn't count against the cap
      continue;
    }
    if (newCount >= MAX_NEW_POSTINGS_PER_RUN) continue; // cap reached, skip remaining new postings this run
    if (seenNewCompanies.has(entry.job.company)) continue; // one new posting per company per run, for diversity
    toUpsert.push(entry);
    seenNewCompanies.add(entry.job.company);
    newCount++;
  }

  const postingIds: string[] = [];
  for (const { job, result } of toUpsert) {
    const posting = await prisma.externalJobPosting.upsert({
      where: { company_sourceJobId: { company: job.company, sourceJobId: job.job_id } },
      create: {
        sourceJobId: job.job_id,
        company: job.company,
        title: job.title,
        location: job.location || null,
        link: job.link,
        description: job.description ?? "",
        matchedKeywords: result.matchedKeywords,
      },
      // Keep matchedKeywords/location/title fresh in case the source
      // listing was edited, but never touch firstSeenAt — that's when a
      // TPO's review candidate first appeared, not when it was re-synced.
      update: {
        title: job.title,
        location: job.location || null,
        matchedKeywords: result.matchedKeywords,
      },
    });
    postingIds.push(posting.id);
  }

  const colleges = await prisma.college.findMany({ select: { id: true } });
  const now = new Date();
  let newReviewCount = 0;
  for (const college of colleges) {
    const result = await prisma.externalJobReview.createMany({
      data: postingIds.map((postingId) => ({ collegeId: college.id, postingId, status: "APPROVED", reviewedAt: now })),
      skipDuplicates: true,
    });
    newReviewCount += result.count;
  }

  console.log(
    `${matched.length} postings passed the fresher filter (${newCount} new, capped at ${MAX_NEW_POSTINGS_PER_RUN}/run; ${toUpsert.length - newCount} already-known postings refreshed). ` +
      `Auto-approved ${newReviewCount} new review row(s) across ${colleges.length} college(s) — visible to students immediately.`
  );
}

main()
  .catch((err) => {
    console.error("sync-external-jobs failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
