// Human-readable label for an audit action. Shared by the per-conversation
// Activity tab and the /audit admin log so the two surfaces never drift.
export const AUDIT_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.logout": "Signed out",
  "message.file_shared": "File shared",
  "conversation.drive_linked": "Linked to a drive",
  "conversation.drive_unlinked": "Drive link removed",
  "conversation.member_added": "Member(s) added",
  "conversation.member_removed": "Member removed",
  "conversation.member_left": "Member left",
  "event.published": "Event published",
  "event.cancelled": "Event cancelled",
  "event.registration_approved": "Registration approved",
  "event.registration_rejected": "Registration rejected",
  "event.registration_waitlisted": "Moved to waitlist",
  "event.attendance_marked": "Attendance marked",
  "event.announcement_sent": "Announcement sent",
  "event.certificates_generated": "Certificates generated",
  "student.field_updated": "Student record updated",
  "student.backlog_added": "Backlog added",
  "student.backlog_cleared": "Backlog cleared",
  "student.tag_added": "Tag added",
  "student.tag_removed": "Tag removed",
  "student.document_uploaded": "Document uploaded",
  "student.document_verified": "Document verified",
  "student.bulk_action": "Bulk action performed",
  "student.password_reset": "Password reset",
  "company.created": "Company added",
  "company.updated": "Company details updated",
  "company.status_changed": "Partnership status changed",
  "company.document_uploaded": "Document uploaded",
  "company.document_deleted": "Document deleted",
  "company.bulk_action": "Bulk action performed",
  "company.recruiter_invited": "Recruiter portal account created",
  "company.recruiter_password_reset": "Recruiter password reset",
  "company.recruiter_status_changed": "Recruiter account status changed",
  "interview.scheduled": "Interview scheduled",
  "interview.rescheduled": "Interview rescheduled",
  "interview.cancelled": "Interview cancelled",
  "interview.evaluated": "Interview evaluated",
  "interview.no_show": "Marked no-show",
  "interview.bulk_action": "Bulk action performed",
  "external_job.approved": "External job approved",
  "external_job.rejected": "External job rejected",
  "external_job.bulk_approved": "External jobs bulk-approved",
  "external_job.bulk_rejected": "External jobs bulk-rejected",
  "finance.expense_recorded": "Expense recorded",
  "finance.expense_deleted": "Expense deleted",
  "finance.revenue_recorded": "Revenue recorded",
  "finance.revenue_deleted": "Revenue deleted",
  "finance.budget_item_added": "Budget item added",
  "finance.budget_item_updated": "Budget item updated",
  "finance.budget_item_deleted": "Budget item deleted",
};

// Writes to the AuditLog model, which existed in the schema but had no
// application-code writer until messaging needed one. Deliberately records
// only consequential, non-content events (a file was shared, a conversation
// was linked to a drive) — message bodies themselves are not copied into the
// audit trail, since Auditor-type roles are meant to see that something
// happened, not read private conversation content.
//
// `db` is intentionally untyped (`any`) — tenant-scoped client, same
// convention as lib/notify.ts / lib/applications.ts.
export async function recordAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: {
    collegeId: string;
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    after?: any;
    reason?: string;
  },
) {
  try {
    await db.auditLog.create({
      data: {
        collegeId: input.collegeId,
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        after: input.after ?? undefined,
        reason: input.reason,
      },
    });
  } catch {
    // Auditing must never break the action it's recording.
  }
}

// Sign-in / sign-out for college users. Kept alongside recordAudit rather
// than in the auth module so every audit action name lives in one file.
//
// Two deliberate limits, both forced by the AuditLog shape:
//  - collegeId is REQUIRED, so a failed sign-in for an email that matches
//    no user cannot be stored (there is no college to attach it to). Those
//    go to the structured log only — see lib/logger.ts.
//  - Recruiter (CompanyUser) sign-ins have no single collegeId either: a
//    company can partner with many colleges. Those are logged, not stored.
export async function recordAuthAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: {
    collegeId: string;
    actorId: string | null;
    action: "auth.login" | "auth.login_failed" | "auth.logout";
    ip?: string | null;
    userAgent?: string | null;
    userType?: string | null;
  },
) {
  await recordAudit(db, {
    collegeId: input.collegeId,
    actorId: input.actorId,
    action: input.action,
    resourceType: "Session",
    resourceId: input.actorId,
    // AuditLog has no ip/userAgent column; `after` is Json, so the request
    // context rides there rather than adding a migration for two strings.
    after: { ip: input.ip ?? null, userAgent: input.userAgent ?? null, userType: input.userType ?? null },
  });
}

/** Caller IP / UA for an audit row. Spoofable when the app is reachable
 *  directly — an investigation hint, never an identity claim. */
export function authRequestContext(request: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent"),
  };
}
