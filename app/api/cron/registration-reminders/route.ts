import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";

// Time-based automation — genuinely needs an external scheduler to call
// this on a cadence (this app has no in-process job runner). Wired to
// Vercel Cron via vercel.json (hourly), which will only actually fire if
// this app is deployed on Vercel; if it's deployed elsewhere, point that
// host's own scheduler (Railway cron, a GitHub Actions workflow, etc.) at
// this same route on the same schedule instead — the route itself doesn't
// assume anything about who's calling it beyond the shared secret.
//
// Protected by a bearer token compared against CRON_SECRET (not session
// auth — there is no logged-in user for a scheduled call) so this can't be
// hit by an outsider to spam every eligible student across every college.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured", message: "CRON_SECRET isn't set." }, { status: 501 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000); // ~26h — wide enough that an hourly sweep never skips a drive between runs

  const drives = await prisma.drive.findMany({
    where: {
      status: { in: ["PUBLISHED", "REGISTRATION_OPEN"] },
      registrationClosesAt: { gte: now, lte: windowEnd },
      registrationReminderSentAt: null,
    },
    include: {
      company: { select: { name: true } },
      eligibleCourses: { select: { courseId: true } },
    },
  });

  let drivesProcessed = 0;
  let studentsNotified = 0;

  for (const drive of drives) {
    const courseIds = drive.eligibleCourses.map((c) => c.courseId);
    const [eligibleStudents, applied] = await Promise.all([
      prisma.student.findMany({
        where: { batchId: drive.batchId, courseId: { in: courseIds }, hasPlacementAccess: true, eligibleForPlacements: true },
        select: { id: true, userId: true },
      }),
      prisma.application.findMany({ where: { driveId: drive.id }, select: { studentId: true } }),
    ]);

    const appliedStudentIds = new Set(applied.map((a) => a.studentId));
    const targetUserIds = eligibleStudents.filter((s) => !appliedStudentIds.has(s.id)).map((s) => s.userId);

    if (targetUserIds.length > 0) {
      await notifyUsers(
        prisma,
        drive.collegeId,
        targetUserIds,
        "drive.registration_closing_soon",
        `Registration closing soon: ${drive.title}`,
        `"${drive.title}" at ${drive.company.name} closes registration soon — apply before it closes.`,
        `/opportunities/${drive.id}`,
      );
      studentsNotified += targetUserIds.length;
    }

    await prisma.drive.update({ where: { id: drive.id }, data: { registrationReminderSentAt: now } });
    drivesProcessed += 1;
  }

  return NextResponse.json({ ok: true, drivesProcessed, studentsNotified });
}
