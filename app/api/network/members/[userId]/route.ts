import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getPlacementStatusByStudentId } from "@/lib/network/placement-status";

// Backs the profile quick-view dialog. Contact details (email/phone) are
// only included for staff callers or when viewing your own record — same
// self-service-visibility principle as everywhere else in this app, applied
// from the start here since Network is the one surface where a Student can
// browse OTHER students, unlike the staff-only Students module.
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireSession();
  const { userId } = await params;
  const db = getTenantDb(session.collegeId);

  const caller = await db.user.findUnique({ where: { id: session.userId }, select: { userType: true } });
  const canSeeContactDetails = caller?.userType !== "STUDENT" || userId === session.userId;

  const member = await db.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: {
        include: {
          course: true,
          batch: true,
          department: true,
          skills: { include: { skill: true } },
        },
      },
      departmentMemberships: { include: { department: true } },
    },
  });
  if (!member) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let placement = null;
  let counts = { applications: 0, interviews: 0, offers: 0 };
  if (member.studentProfile) {
    const [placementMap, applications, interviews, offers] = await Promise.all([
      getPlacementStatusByStudentId(db, [member.studentProfile.id]),
      db.application.count({ where: { studentId: member.studentProfile.id } }),
      db.roundCandidate.count({ where: { studentId: member.studentProfile.id } }),
      db.offer.count({ where: { studentId: member.studentProfile.id } }),
    ]);
    placement = placementMap.get(member.studentProfile.id) ?? null;
    counts = { applications, interviews, offers };
  }

  return NextResponse.json({
    id: member.id,
    name: member.name,
    userType: member.userType,
    email: canSeeContactDetails ? member.email : null,
    phone: canSeeContactDetails ? member.phone : null,
    student: member.studentProfile
      ? {
          id: member.studentProfile.id,
          enrollmentNumber: member.studentProfile.enrollmentNumber,
          courseLabel: member.studentProfile.course.specialization ?? member.studentProfile.course.name,
          batchYear: member.studentProfile.batch.year,
          departmentName: member.studentProfile.department?.name ?? null,
          skills: member.studentProfile.skills.map((s: { skill: { name: string } }) => s.skill.name),
        }
      : null,
    departments: member.departmentMemberships.map((m: { department: { name: string }; title: string }) => ({ name: m.department.name, title: m.title })),
    placement,
    counts,
  });
}
