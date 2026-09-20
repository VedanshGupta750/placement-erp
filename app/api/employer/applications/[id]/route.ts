import { NextResponse } from "next/server";
import { requireCompanySession } from "@/lib/auth/company-session";
import { prisma } from "@/lib/db";
import { transitionApplication } from "@/lib/applications";
import type { ApplicationStatus } from "@/lib/generated/prisma/client";

// Recruiter-side application actions — deliberately narrower than the TPO's
// (app/api/drives/[id]/applications/[applicationId]): a recruiter can move
// an application forward (shortlist) or reject it, but never approve
// college-side eligibility or force a final SELECTED without going through
// a round. Scoped by the drive's companyId matching the recruiter's own
// company — never by a client-supplied studentId/collegeId, per the "no
// unrestricted access to the student database" rule.
const ACTION_MAP: Record<string, ApplicationStatus> = {
  shortlist: "SHORTLISTED",
  reject: "REJECTED",
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompanySession();
  const { id } = await params;

  const { action } = await request.json().catch(() => ({}));
  const toStatus = ACTION_MAP[action as string];
  if (!toStatus) return NextResponse.json({ error: "invalid_action" }, { status: 400 });

  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, driveId: true, status: true, collegeId: true, drive: { select: { companyId: true } } },
  });
  if (!application || application.drive.companyId !== session.companyId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await transitionApplication(prisma, application.collegeId, application, toStatus, session.companyUserId, `Recruiter action: ${action}`);
  } catch (e) {
    return NextResponse.json({ error: "invalid_transition", message: (e as Error).message }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
