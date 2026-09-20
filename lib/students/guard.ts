import "server-only";
import type { TenantDb } from "@/lib/tenant/scoped-db";

type Session = { userId: string; collegeId: string; roleId: string | null };

// Students hold `student.edit` too — it's the permission their OWN
// self-service /api/profile/* routes already check (scoped to their own
// row there). The Student 360 admin routes under /api/students/[id]/*
// share that same permission key but take an arbitrary :id from the URL
// with no ownership check, so without this guard any logged-in student
// could PATCH/upload/note-on *any other* student's record just by calling
// the API directly (confirmed live — a real vuln, not theoretical).
// Every admin route that mutates a student record via :id must call this
// in addition to its own requirePermission check.
export async function requireNotSelfServiceStudent(db: TenantDb, session: Session) {
  const caller = await db.user.findUnique({ where: { id: session.userId }, select: { userType: true } });
  if (caller?.userType === "STUDENT") {
    throw new StaffOnlyError();
  }
}

export class StaffOnlyError extends Error {
  constructor() {
    super("This action is staff-only.");
    this.name = "StaffOnlyError";
  }
}
