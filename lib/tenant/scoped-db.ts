import "server-only";
import { prisma } from "@/lib/db";

// Models that carry a collegeId column and must always be scoped to the
// caller's tenant. Every model added to prisma/schema.prisma with a
// collegeId field belongs in this list — it's the single source of truth
// the query extension below reads from.
const TENANT_MODELS = new Set([
  "Campus",
  "Department",
  "Batch",
  "Course",
  "Skill",
  "Role",
  "User",
  "Student",
  "Resume",
  "CollegePartnership",
  "Drive",
  "DrivePosition",
  "DriveEligibilityRule",
  "EligibilitySnapshot",
  "EligibilityResult",
  "EligibilityOverride",
  "AcademicChangeRequest",
  "Application",
  "ApplicationStatusHistory",
  "SelectionRound",
  "RoundCandidate",
  "Offer",
  "OffCampusPlacement",
  "JoiningRecord",
  "Contact",
  "Event",
  "EventSpeaker",
  "Conversation",
  "Forum",
  "Notification",
  "PushSubscription",
  "PushDelivery",
  "InviteRequest",
  "Import",
  "AuditLog",
  "MessageTemplate",
  "Broadcast",
  "PlacementCategory",
  "PlacementExpense",
  "PlacementRevenue",
  "StudentSavedView",
  "ExternalJobReview",
  "StudentSkillProfile",
  "Budget",
  // DepartmentCourse, DepartmentMembership, StudentSkill,
  // StudentExperience, StudentProject, StudentCertification, ResumeUsage,
  // File, FileAccessLog, DriveCourse, DriveSkill, DriveDocument,
  // DriveHistoryEntry, DriveNote, DriveApplicationField,
  // ApplicationFieldValue, CompanyNote, ContactCommunication, ContactNote, ContactDocument, ContactHistoryEntry,
  // EventRegistration, EventAttendance, EventFeedback, EventFile, EventCertificate,
  // StudentDocument, StudentNote, StudentBacklog, StudentSemesterResult,
  // ConversationParticipant, Message, ForumPost, ForumReply,
  // NotificationPreference, ImportError, BroadcastRecipient are intentionally NOT here — each
  // is scoped by hand via its parent relation (student/drive/forum/...) at
  // the call site, either because it has a composite id with no
  // single-field `where`, or no collegeId column at all. File.collegeId is
  // nullable (some files are pre-tenant, e.g. platform assets) so it's
  // scoped manually too.
  // Company / CompanyUser are intentionally NOT here — companies are
  // global (a company can partner with many colleges); scope those by
  // companyId or via CollegePartnership instead.
  // ExternalJobPosting is intentionally NOT here for the same reason — one
  // scraped job posting is the same object regardless of which college's
  // TPO is reviewing it. ExternalJobReview (the per-college approve/reject
  // decision) IS listed above.
  // Permission, Plan, PlatformAdmin are global/platform-level, never
  // tenant-scoped. Subscription is a single row per college (collegeId is
  // @unique), always fetched directly, never listed college-wide.
]);

const READ_OR_WHERE_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

/**
 * Returns a Prisma client scoped to a single college. Every query against a
 * TENANT_MODELS model automatically gets `collegeId` injected into `where`
 * (reads/updates/deletes) or `data` (creates) — so a route handler can
 * never accidentally return or mutate another college's rows just by
 * forgetting a `where` clause.
 *
 * Convention: every route handler does
 *   const db = getTenantDb(session.collegeId)
 * and only ever touches the raw `prisma` export for platform-level code
 * (provisioning, prisma/seed.ts, app/platform-admin/**, recruiter portal
 * code that legitimately spans colleges via CollegePartnership).
 */
export function getTenantDb(collegeId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }

          const scopedArgs = args as Record<string, unknown>;

          if (READ_OR_WHERE_OPS.has(operation)) {
            scopedArgs.where = { ...(scopedArgs.where as object), collegeId };
          } else if (operation === "create") {
            scopedArgs.data = { ...(scopedArgs.data as object), collegeId };
          } else if (operation === "createMany" || operation === "createManyAndReturn") {
            const data = scopedArgs.data;
            scopedArgs.data = Array.isArray(data)
              ? data.map((row) => ({ ...row, collegeId }))
              : data;
          } else if (operation === "upsert") {
            scopedArgs.where = { ...(scopedArgs.where as object), collegeId };
            scopedArgs.create = { ...(scopedArgs.create as object), collegeId };
          }

          return query(scopedArgs as never);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof getTenantDb>;

// The type of `tx` inside `db.$transaction(async (tx) => ...)` — narrower
// than TenantDb (no nested $transaction/$connect/$disconnect/$extends),
// but still carries the tenant-scoping query extension.
export type TenantTx = Omit<TenantDb, "$connect" | "$disconnect" | "$extends" | "$transaction">;
