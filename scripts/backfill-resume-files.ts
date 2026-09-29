// One-off: attaches a placeholder PDF to seeded Resume rows that have no
// File behind them.
//
// prisma/seed.ts used to create Resume rows with only a name, so every
// TPO-facing resume link showed the "uploaded before file download was
// wired up" fallback instead of downloading anything. The seed now creates
// a real File; this repairs databases that were seeded before that.
//
// Only touches resumes where fileId IS NULL, so a genuinely uploaded resume
// is never overwritten. Safe to re-run. Pass --dry-run to preview.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { buildDemoResume } from "../prisma/seed-pdf";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const orphans = await prisma.resume.findMany({
    where: { fileId: null },
    select: {
      id: true,
      name: true,
      collegeId: true,
      student: {
        select: {
          id: true,
          userId: true,
          enrollmentNumber: true,
          user: { select: { name: true } },
          course: { select: { name: true, specialization: true } },
        },
      },
    },
  });

  if (orphans.length === 0) {
    console.log("Every resume already has a file. Nothing to do.");
    return;
  }

  console.log(`${orphans.length} resume(s) with no file:`);
  for (const r of orphans.slice(0, 10)) {
    console.log(`  - ${r.student.user.name} (${r.student.enrollmentNumber}) — "${r.name}"`);
  }
  if (orphans.length > 10) console.log(`  … and ${orphans.length - 10} more`);

  if (dryRun) {
    console.log("\n--dry-run: nothing was written.");
    return;
  }

  let done = 0;
  for (const r of orphans) {
    const course = r.student.course?.specialization ?? r.student.course?.name ?? "Not recorded";
    const dataUri = buildDemoResume(r.student.user.name, course, r.student.enrollmentNumber);
    const safeName = r.student.user.name.replace(/[^A-Za-z0-9]+/g, "-");

    // File + Resume updated together: a File row with no resume pointing at
    // it would just be orphaned storage if this died halfway.
    await prisma.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          collegeId: r.collegeId,
          storageKey: `backfill/resume-${r.id}.pdf`,
          dataUrl: dataUri,
          originalName: `${safeName}-Resume.pdf`,
          mimeType: "application/pdf",
          sizeBytes: Buffer.byteLength(dataUri.split(",")[1] ?? "", "base64"),
          uploadedById: r.student.userId,
        },
      });
      await tx.resume.update({ where: { id: r.id }, data: { fileId: file.id } });
    });
    done += 1;
  }

  console.log(`\nAttached a placeholder PDF to ${done} resume(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
