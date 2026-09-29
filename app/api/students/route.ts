import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { hashPassword } from "@/lib/auth/password";
import { defaultStudentPassword, defaultPasswordHint } from "@/lib/auth/default-password";
import { sendPasswordLink } from "@/lib/auth/password-reset";
import { emailDeliveryConfigured } from "@/lib/email/send";
import { z } from "zod";

const createStudentSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Invalid email."),
  enrollmentNumber: z.string().trim().min(1, "Enrollment number is required."),
  courseId: z.string().min(1, "Course is required."),
  batchId: z.string().min(1, "Batch is required."),
  departmentId: z.string().optional(),
  aggregate: z.number().min(0).max(10).optional(),
  tenthScore: z.number().min(0).max(100).optional(),
  twelfthScore: z.number().min(0).max(100).optional(),
});

// The single-student counterpart to /api/students/import — same
// user/role/student-row creation shape, just for one person via a form
// instead of a CSV row.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const existingUser = await db.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
  if (existingUser) {
    return NextResponse.json({ error: "validation_error", fieldErrors: { email: ["A user with this email already exists."] } }, { status: 409 });
  }
  const existingEnrollment = await db.student.findFirst({ where: { enrollmentNumber: data.enrollmentNumber } });
  if (existingEnrollment) {
    return NextResponse.json({ error: "validation_error", fieldErrors: { enrollmentNumber: ["A student with this enrollment number already exists."] } }, { status: 409 });
  }

  const studentRole = await db.role.findFirst({ where: { name: "Student" } });
  const passwordHash = await hashPassword(defaultStudentPassword(data.enrollmentNumber));

  const user = await db.user.create({
    data: {
      collegeId: session.collegeId,
      email: data.email.toLowerCase().trim(),
      name: data.name,
      passwordHash,
      mustChangePassword: true,
      status: "INVITED",
      userType: "STUDENT",
      roleId: studentRole?.id,
    },
  });

  const student = await db.student.create({
    data: {
      userId: user.id,
      collegeId: session.collegeId,
      departmentId: data.departmentId,
      batchId: data.batchId,
      courseId: data.courseId,
      enrollmentNumber: data.enrollmentNumber,
      tenthScore: data.tenthScore,
      twelfthScore: data.twelfthScore,
      aggregate: data.aggregate,
      aggregateType: "CGPA",
    },
  });

  // Activation is by emailed link, not a password handed over in person —
  // the generated one above is random and never surfaced.
  const invite = await sendPasswordLink({
    userId: user.id,
    name: data.name,
    email: data.email.toLowerCase().trim(),
    purpose: "SET_PASSWORD",
    collegeId: session.collegeId,
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    id: student.id,
    inviteSent: Boolean(invite?.delivered),
    emailConfigured: emailDeliveryConfigured(),
    defaultPasswordHint: defaultPasswordHint(),
    // Only when mail isn't configured: gives the TPO something to pass on
    // by hand instead of leaving the student with no way in at all.
    setPasswordUrl: invite && !invite.delivered ? invite.url : undefined,
  });
}
