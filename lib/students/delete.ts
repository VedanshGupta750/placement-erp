import "server-only";
import type { TenantDb } from "@/lib/tenant/scoped-db";

// Hard-deleting a student is the only irreversible operation in the
// Students module, so the mechanics live here rather than being duplicated
// between the single-student route and the bulk action.
//
// WHAT GETS DELETED, AND WHY IT HAS TO BE THE *USER* ROW
// ------------------------------------------------------
// Student.user is `onDelete: Cascade`, so deleting the User deletes the
// Student. The reverse is NOT true: deleting only the Student would leave a
// User row with userType STUDENT and no profile behind it — an account that
// can still sign in but whose every page does `student.findUnique(...)` and
// gets null. So the User is the thing that must go.
//
// Every one of the 16 Student relations (applications, offers, resumes,
// documents, notes, backlogs, semester results, eligibility results and
// overrides, round candidacies, skills, experiences, projects,
// certifications, skill profile, academic change requests) is declared
// `onDelete: Cascade`, so the database removes those for us.
//
// WHAT BLOCKS THE DELETE
// ----------------------
// A handful of User relations are REQUIRED, and Prisma's default action for
// a required relation is Restrict — those rows have to be dealt with first
// or the delete fails with a foreign-key error. Of them, only the forum and
// conversation ones are reachable by a student today (the forum routes have
// no permission check at all, so any signed-in user can post):
//
//   ForumPost.author / ForumReply.author -> deleted. The student's own
//     words go with the student. (Deleting a post cascades its replies,
//     which is ordinary forum behaviour.)
//   Forum.createdBy -> REASSIGNED, not deleted. A forum is a shared
//     container; deleting one would cascade away every other student's
//     posts inside it. Ownership moves to the staff member doing the
//     deletion so the discussion survives.
//   Conversation.createdById -> deleted, with its messages. A thread the
//     student started is part of their record. Threads started by staff
//     survive: Message.sender is optional, so their messages remain with a
//     null sender rather than vanishing from the TPO's copy.
//
// Anything unanticipated surfaces as a foreign-key error, which the callers
// turn into a plain-language 409 instead of a 500 — fail loudly rather than
// half-deleting a person.

export type StudentDeletionImpact = {
  studentCount: number;
  applications: number;
  offers: number;
  resumes: number;
  documents: number;
  notes: number;
  interviewRecords: number;
};

// Counts shown in the confirm dialog. An exact tally is the point: "delete
// 12 students" reads very differently once you can see it also destroys 34
// applications and 5 offers.
export async function collectStudentDeletionImpact(
  db: TenantDb,
  studentIds: string[],
): Promise<StudentDeletionImpact> {
  const where = { studentId: { in: studentIds } };
  const [applications, offers, resumes, documents, notes, interviewRecords] = await Promise.all([
    db.application.count({ where }),
    db.offer.count({ where }),
    db.resume.count({ where }),
    db.studentDocument.count({ where }),
    db.studentNote.count({ where }),
    db.roundCandidate.count({ where }),
  ]);

  return { studentCount: studentIds.length, applications, offers, resumes, documents, notes, interviewRecords };
}

// Single sentence describing the blast radius, so the dialog wording is
// identical wherever a delete is confirmed from.
export function describeDeletionImpact(impact: StudentDeletionImpact): string {
  const parts = [
    impact.applications > 0 ? `${impact.applications} application${impact.applications === 1 ? "" : "s"}` : null,
    impact.offers > 0 ? `${impact.offers} offer${impact.offers === 1 ? "" : "s"}` : null,
    impact.interviewRecords > 0
      ? `${impact.interviewRecords} interview record${impact.interviewRecords === 1 ? "" : "s"}`
      : null,
    impact.resumes > 0 ? `${impact.resumes} resume${impact.resumes === 1 ? "" : "s"}` : null,
    impact.documents > 0 ? `${impact.documents} document${impact.documents === 1 ? "" : "s"}` : null,
    impact.notes > 0 ? `${impact.notes} note${impact.notes === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  const tail = "Their login account is removed too, so they lose access immediately. This can't be undone.";
  if (parts.length === 0) return `No applications, offers or documents are attached. ${tail}`;
  return `This also permanently deletes ${parts.join(", ")}. ${tail}`;
}

export class StudentDeleteBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentDeleteBlockedError";
  }
}

// Deletes the given students and their login accounts. `actorUserId`
// inherits any forum the student created (see the note above).
export async function deleteStudentsCompletely(
  db: TenantDb,
  students: { id: string; userId: string }[],
  actorUserId: string,
): Promise<number> {
  if (students.length === 0) return 0;

  const studentIds = students.map((s) => s.id);
  const userIds = students.map((s) => s.userId);

  await db.$transaction(async (tx) => {
    // Replies first, then posts: a reply the student left on someone
    // else's post isn't reachable by the post cascade.
    await tx.forumReply.deleteMany({ where: { authorId: { in: userIds } } });
    await tx.forumPost.deleteMany({ where: { authorId: { in: userIds } } });
    await tx.forum.updateMany({ where: { createdById: { in: userIds } }, data: { createdById: actorUserId } });
    await tx.conversation.deleteMany({ where: { createdById: { in: userIds } } });

    // Cascades Student, and through it every student-owned relation.
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });

  // Belt and braces: if a Student row somehow outlived its User (it
  // shouldn't — the cascade is enforced in the database), remove it rather
  // than leaving a profile with no account.
  await db.student.deleteMany({ where: { id: { in: studentIds } } });

  return students.length;
}
