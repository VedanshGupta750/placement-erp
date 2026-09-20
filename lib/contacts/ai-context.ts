import "server-only";
import { getCompanyHiringActivity } from "@/lib/contacts/stats";
import { computeRelationshipScore } from "@/lib/contacts/relationship-score";
import { RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";

// A compact, factual snapshot of one contact — handed to the AI as the ONLY
// source of truth for the relationship-insight feature, mirroring
// buildPlacementContext's contract for the TPO copilot: summary-level real
// data, never raw enough to let the model "fill in" specifics on its own.
export async function buildContactContext(db: any, contactId: string): Promise<string | null> {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      company: true,
      owner: true,
      communications: { include: { author: true }, orderBy: { occurredAt: "desc" }, take: 5 },
      notes: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  if (!contact) return null;

  const hiringActivity = contact.companyId
    ? await getCompanyHiringActivity(db, contact.companyId)
    : { activeDrives: 0, completedDrives: 0, studentsHired: 0, offersMade: 0, hiringHistory: [] as { year: number; studentsHired: number }[] };

  const lastCommunicationAt = contact.communications[0]?.occurredAt ?? null;
  const score = computeRelationshipScore({
    lastCommunicationAt,
    activeDriveCount: hiringActivity.activeDrives,
    studentsHiredCount: hiringActivity.studentsHired,
    nextFollowUpAt: contact.nextFollowUpAt,
  });

  const now = new Date();
  const daysSinceContact = lastCommunicationAt ? Math.round((now.getTime() - new Date(lastCommunicationAt).getTime()) / 86400000) : null;
  const followUpDays = contact.nextFollowUpAt ? Math.round((new Date(contact.nextFollowUpAt).getTime() - now.getTime()) / 86400000) : null;

  const lines = [
    `Contact: ${contact.name ?? "Unnamed"}${contact.designation ? `, ${contact.designation}` : ""}`,
    `Company: ${contact.company?.name ?? "Unaffiliated"}`,
    `Contact type: ${contact.contactType ?? "Not set"}`,
    `Relationship stage: ${RELATIONSHIP_STAGE_LABELS[contact.relationshipStage as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? contact.relationshipStage}`,
    `Status: ${contact.isActive ? "Active" : "Inactive"}`,
    `Owner: ${contact.owner?.name ?? "Unassigned"}`,
    `Tags: ${contact.tags.length ? contact.tags.join(", ") : "None"}`,
    `Relationship score: ${score.score}/100 (${score.label}) — computed from recency of contact, active drives, students hired, and follow-up status`,
    `Days since last communication: ${daysSinceContact ?? "no communication logged yet"}`,
    `Next follow-up: ${
      contact.nextFollowUpAt
        ? `${new Date(contact.nextFollowUpAt).toLocaleDateString("en-IN")} (${followUpDays !== null && followUpDays < 0 ? `${Math.abs(followUpDays)} days overdue` : `in ${followUpDays} days`})${contact.nextFollowUpNote ? ` — note: ${contact.nextFollowUpNote}` : ""}`
        : "none scheduled"
    }`,
    `Active drives with this company: ${hiringActivity.activeDrives}`,
    `Students hired via this company (all time): ${hiringActivity.studentsHired}`,
    `Offers made via this company (all time): ${hiringActivity.offersMade}`,
    `Recent communications (${contact.communications.length}):`,
    ...(contact.communications.length
      ? contact.communications.map(
          (c: { type: string; subject: string | null; occurredAt: Date; author: { name: string } }) =>
            `  - ${new Date(c.occurredAt).toLocaleDateString("en-IN")}: ${c.type}${c.subject ? ` — ${c.subject}` : ""} (logged by ${c.author.name})`,
        )
      : ["  - none logged"]),
    `Recent internal notes (${contact.notes.length}):`,
    ...(contact.notes.length ? contact.notes.map((n: { body: string }) => `  - ${n.body}`) : ["  - none"]),
  ];

  return lines.join("\n");
}
