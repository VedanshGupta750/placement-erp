// Global permission catalog: key = "{resource}.{action}". Adding a
// permission always means shipping the code that checks it — this list is
// not tenant-editable, only Role→Permission assignment is (see
// lib/provisioning.ts and app/(dashboard)/roles).
//
// Sourced from the Placement OS RBAC freeze matrix (8 college-side roles x
// ~60 permissions). api.* and billing.* are catalogued for completeness but
// intentionally never granted to any college-side SYSTEM_ROLE below — they
// belong to the platform/Super Admin layer only.

function perm(key: string, description: string) {
  const [resource, action] = key.split(".");
  return { key, resource, action, description } as const;
}

export const PERMISSIONS = [
  perm("student.view", "View student records"),
  perm("student.create", "Create student records"),
  perm("student.edit", "Edit student records"),
  perm("student.export", "Export student data"),
  perm("student.bulk_update", "Bulk-update student records"),
  perm("student.view_sensitive", "View sensitive student fields"),
  // Hard-deletes the student AND their login account, taking applications,
  // offers, interview records, resumes, documents and notes with it.
  // Deliberately separate from student.edit so the roles that maintain the
  // roster day to day (Placement/Department Coordinator) can correct a
  // record without being able to erase one.
  perm("student.delete", "Delete student records"),

  perm("eligibility.view", "View eligibility rules & results"),
  perm("eligibility.create_rule", "Create eligibility rules"),
  perm("eligibility.edit_rule", "Edit eligibility rules"),
  perm("eligibility.preview", "Preview eligible population"),
  perm("eligibility.publish", "Publish eligibility rules & evaluate"),
  perm("eligibility.override", "Override eligibility for a student"),

  perm("company.view", "View companies"),
  perm("company.create", "Add companies"),
  perm("company.edit", "Edit company records"),
  perm("company.archive", "Archive companies"),

  perm("drive.view", "View placement drives"),
  perm("drive.create", "Create placement drives"),
  perm("drive.edit", "Edit placement drives"),
  perm("drive.submit_approval", "Submit drives for approval"),
  perm("drive.approve", "Approve drives"),
  perm("drive.publish", "Publish drives"),
  perm("drive.suspend", "Suspend drives"),
  perm("drive.close", "Close drive registrations"),
  perm("drive.archive", "Archive drives"),
  perm("drive.export", "Export drive data"),

  perm("application.view", "View applications"),
  perm("application.approve", "Approve applications"),
  perm("application.reject", "Reject applications"),
  perm("application.shortlist", "Shortlist applications"),
  perm("application.withdraw", "Withdraw own application"),
  perm("application.move_round", "Move applications between rounds"),
  perm("application.export", "Export application data"),

  perm("round.view", "View selection rounds"),
  perm("round.create", "Create selection rounds"),
  perm("round.edit", "Edit selection rounds"),
  perm("round.schedule", "Schedule round candidates"),
  perm("round.score", "Score round candidates"),
  perm("round.publish_result", "Publish round results"),
  perm("round.cancel", "Cancel selection rounds"),

  perm("interview.view", "View interviews"),
  perm("interview.schedule", "Schedule interviews"),
  perm("interview.reschedule", "Reschedule interviews"),
  perm("interview.cancel", "Cancel interviews"),

  perm("offer.view", "View offers"),
  perm("offer.create", "Create offers"),
  perm("offer.edit", "Edit offers"),
  perm("offer.issue", "Issue offers"),
  perm("offer.accept", "Accept own offer"),
  perm("offer.decline", "Decline own offer"),
  perm("offer.mark_joined", "Mark offer as joined"),
  perm("offer.export", "Export offer data"),

  perm("resume.view", "View own resumes"),
  perm("resume.create", "Create resumes"),
  perm("resume.edit", "Edit resumes"),
  perm("resume.delete", "Delete resumes"),

  perm("document.view", "View documents"),
  perm("document.upload", "Upload documents"),
  perm("document.delete", "Delete documents"),
  perm("document.request", "Request documents from candidates"),

  perm("report.view", "View reports & analytics"),
  perm("report.create", "Create custom reports"),
  perm("report.export", "Export reports"),
  perm("report.finalize", "Finalize report snapshots"),

  perm("broadcast.view", "View broadcasts"),
  perm("broadcast.create", "Create broadcasts"),
  perm("broadcast.send", "Send broadcasts"),

  perm("message.view", "View and participate in conversations"),
  perm("message.send", "Send messages"),
  perm("message.create_group", "Create group conversations"),

  perm("event.view", "View events"),
  perm("event.create", "Create events"),
  perm("event.edit", "Edit events"),
  perm("event.publish", "Publish events"),
  perm("event.manage_registrations", "Approve, reject and export event registrations"),
  perm("event.mark_attendance", "Mark event attendance (QR, manual, import)"),
  perm("event.view_analytics", "View event analytics"),

  perm("audit.view", "View audit logs"),
  perm("audit.export", "Export audit logs"),

  perm("external_job.view", "View external fresher job review queue"),
  perm("external_job.review", "Approve or reject external fresher job postings"),

  perm("finance.view", "View placement finance (expenses & revenue)"),
  perm("finance.manage", "Record and edit placement expenses & revenue"),

  perm("settings.view", "View college settings"),
  perm("settings.edit", "Edit college settings"),

  // Platform-only — never assigned to a college Role.
  perm("api.create", "Create API keys"),
  perm("api.revoke", "Revoke API keys"),
  perm("billing.view", "View platform billing"),
  perm("billing.manage", "Manage platform billing"),
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

// The platform/Super Admin tier (see app/platform) — API keys and billing
// belong to whoever operates the software, not to any college. This is the
// single source of truth for that split: provisioning must never grant
// these to a college Role, the roles API must reject them, and the roles
// UI must not offer them. Keeping it as one exported constant is what stops
// those three places drifting apart, which is exactly how the TPO role
// ended up holding all four of these despite the comment above saying it
// never should.
export const PLATFORM_ONLY_RESOURCES = ["api", "billing"] as const;

export const PLATFORM_ONLY_PERMISSIONS = PERMISSIONS.filter((p) =>
  (PLATFORM_ONLY_RESOURCES as readonly string[]).includes(p.resource),
).map((p) => p.key);

// Every permission a college-side Role may legitimately hold. TPO is
// granted exactly this set at provisioning time.
export const COLLEGE_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.filter(
  (p) => !(PLATFORM_ONLY_RESOURCES as readonly string[]).includes(p.resource),
).map((p) => p.key);

export function isPlatformOnlyPermission(key: string): boolean {
  return (PLATFORM_ONLY_PERMISSIONS as readonly string[]).includes(key);
}

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.resource)));

// Resource groups a college's role editor may show.
export const COLLEGE_PERMISSION_GROUPS = PERMISSION_GROUPS.filter(
  (g) => !(PLATFORM_ONLY_RESOURCES as readonly string[]).includes(g),
);

// System roles seeded for every new college.
export const SYSTEM_ROLES = [
  "TPO",
  "College Admin",
  "Placement Coordinator",
  "Department Coordinator",
  "Faculty",
  "Management",
  "Student",
  "Auditor",
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

// Default permission grants per seeded system role, per the Placement OS
// RBAC freeze matrix. TPO gets every college-scoped permission automatically
// (see lib/provisioning.ts) so it isn't listed here.
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<SystemRole, "TPO">, PermissionKey[]> = {
  "College Admin": [
    "student.view",
    "student.create",
    "student.edit",
    "student.export",
    "student.bulk_update",
    "student.view_sensitive",
    "student.delete",
    "company.view",
    "company.create",
    "company.edit",
    "company.archive",
    "report.view",
    "report.create",
    "report.export",
    "report.finalize",
    "audit.view",
    "audit.export",
    "settings.view",
    "settings.edit",
    "message.view",
    "message.send",
    "message.create_group",
    "event.view",
    "event.create",
    "event.edit",
    "event.publish",
    "event.manage_registrations",
    "event.mark_attendance",
    "event.view_analytics",
    "finance.view",
    "finance.manage",
  ],
  "Placement Coordinator": [
    "student.view",
    "student.edit",
    "company.view",
    "company.create",
    "company.edit",
    "drive.view",
    "drive.create",
    "drive.edit",
    "drive.submit_approval",
    "drive.publish",
    "drive.suspend",
    "drive.close",
    "application.view",
    "application.approve",
    "application.reject",
    "application.shortlist",
    "application.move_round",
    "round.view",
    "round.create",
    "round.edit",
    "round.schedule",
    "round.score",
    "round.publish_result",
    "interview.view",
    "interview.schedule",
    "interview.reschedule",
    "interview.cancel",
    "offer.view",
    "offer.create",
    "offer.edit",
    "offer.issue",
    "offer.mark_joined",
    "external_job.view",
    "external_job.review",
    "broadcast.create",
    "broadcast.send",
    "event.view",
    "event.create",
    "event.edit",
    "event.publish",
    "event.manage_registrations",
    "event.mark_attendance",
    "event.view_analytics",
    "report.view",
    "message.view",
    "message.send",
    "message.create_group",
  ],
  "Department Coordinator": [
    "student.view",
    "student.edit",
    "eligibility.view",
    "eligibility.preview",
    "eligibility.override",
    "drive.view",
    "application.view",
    "round.view",
    "offer.view",
    "report.view",
    "event.view",
    "event.manage_registrations",
    "event.mark_attendance",
    "message.view",
    "message.send",
    "message.create_group",
  ],
  Faculty: ["student.view", "event.view", "event.create", "event.edit", "report.view", "message.view", "message.send"],
  Management: [
    "drive.view",
    "application.view",
    "round.view",
    "interview.view",
    "offer.view",
    "report.view",
    "report.export",
    "event.view",
    "event.view_analytics",
    "message.view",
    "message.send",
    "finance.view",
  ],
  Student: [
    "student.edit",
    "application.view",
    "application.withdraw",
    "offer.view",
    "offer.accept",
    "offer.decline",
    "resume.view",
    "resume.create",
    "resume.edit",
    "resume.delete",
    "document.view",
    "document.upload",
    "event.view",
    "message.view",
    "message.send",
  ],
  Auditor: [
    "drive.view",
    "application.view",
    "round.view",
    "interview.view",
    "offer.view",
    "report.view",
    "report.export",
    "audit.view",
    "audit.export",
    "finance.view",
  ],
};
