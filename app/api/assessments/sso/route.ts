import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { signAssessmentSsoToken } from "@/lib/auth/jwt";

// Handoff into the standalone Assessment microservice. That app's UserType
// only accepts STUDENT / PLACEMENT_TEAM (see its lib/auth/jwt.ts) — Faculty
// and Management accounts don't have an assessment-side role yet.
export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { name: true, email: true, userType: true, college: { select: { name: true } } },
  });

  if (user.userType !== "STUDENT" && user.userType !== "PLACEMENT_TEAM") {
    return NextResponse.json({ error: "Assessments are only available to students and placement-team staff." }, { status: 403 });
  }

  const assessmentsUrl = process.env.ASSESSMENTS_APP_URL;
  if (!assessmentsUrl) {
    return NextResponse.json({ error: "Assessment service is not configured (ASSESSMENTS_APP_URL unset)." }, { status: 503 });
  }

  const token = await signAssessmentSsoToken({
    userId: session.userId,
    collegeId: session.collegeId,
    name: user.name,
    email: user.email,
    userType: user.userType,
  });

  const destination = new URL("/sso", assessmentsUrl);
  destination.searchParams.set("token", token);
  destination.searchParams.set("collegeName", user.college.name);

  return NextResponse.redirect(destination);
}
