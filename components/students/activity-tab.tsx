import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { AUDIT_LABELS } from "@/lib/audit";

type ActivityEntry = { id: string; label: string; detail: string | null; at: Date; actorName: string | null };

// A single merged timeline — audit log entries (field edits, backlog/tag/
// document changes) plus application submissions, so a TPO doesn't have to
// piece the story together from separate tabs.
export async function ActivityTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [auditEntries, applications, resumes] = await Promise.all([
    db.auditLog.findMany({
      where: { resourceType: "Student", resourceId: studentId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.application.findMany({ where: { studentId }, include: { drive: { include: { company: true } } }, orderBy: { appliedAt: "desc" }, take: 20 }),
    db.resume.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const entries: ActivityEntry[] = [
    ...auditEntries.map((e: { id: string; action: string; after: unknown; createdAt: Date; actor: { name: string } | null }) => ({
      id: e.id,
      label: AUDIT_LABELS[e.action] ?? e.action,
      detail: formatDetail(e.after),
      at: e.createdAt,
      actorName: e.actor?.name ?? null,
    })),
    ...applications.map((a: { id: string; appliedAt: Date; drive: { company: { name: string } } }) => ({
      id: `app-${a.id}`,
      label: "Application submitted",
      detail: a.drive.company.name,
      at: a.appliedAt,
      actorName: null,
    })),
    ...resumes.map((r: { id: string; name: string; createdAt: Date }) => ({
      id: `resume-${r.id}`,
      label: "Resume uploaded",
      detail: r.name,
      at: r.createdAt,
      actorName: null,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const grouped = groupByDay(entries);

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        {entries.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No recorded activity yet.</p>}
        {grouped.map(([day, dayEntries]) => (
          <div key={day}>
            <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">{day}</div>
            <div className="flex flex-col gap-2">
              {dayEntries.map((e) => (
                <div key={e.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    {e.label}
                    {e.detail && <span className="text-muted-foreground"> — {e.detail}</span>}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {e.actorName ? `${e.actorName} · ` : ""}
                    {e.at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatDetail(after: unknown): string | null {
  if (!after || typeof after !== "object") return null;
  const obj = after as Record<string, unknown>;
  if (typeof obj.fileName === "string") return obj.fileName;
  if (typeof obj.tag === "string") return obj.tag;
  if (typeof obj.subjectName === "string") return obj.subjectName;
  if (obj.changes && typeof obj.changes === "object") return Object.keys(obj.changes as object).join(", ");
  return null;
}

function groupByDay(entries: ActivityEntry[]): [string, ActivityEntry[]][] {
  const map = new Map<string, ActivityEntry[]>();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  for (const e of entries) {
    let label: string;
    if (e.at.toDateString() === today.toDateString()) label = "Today";
    else if (e.at.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else label = e.at.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(e);
  }
  return [...map.entries()];
}
