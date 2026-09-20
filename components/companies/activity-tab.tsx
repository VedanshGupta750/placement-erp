import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { AUDIT_LABELS } from "@/lib/audit";
import { AiInsightCard } from "@/components/companies/ai-insight-card";

type ActivityEntry = { id: string; label: string; detail: string | null; at: Date; actorName: string | null };

// AI insight card + a merged audit-log timeline — mirrors the shape of
// components/students/activity-tab.tsx, scoped to Company instead of
// Student. The AI card stays visible even with zero audit history since it
// can still generate from the company's other real data (funnel, health
// score, follow-ups).
export async function ActivityTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const auditEntries = await db.auditLog.findMany({
    where: { resourceType: "Company", resourceId: companyId },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const entries: ActivityEntry[] = auditEntries.map(
    (e: { id: string; action: string; after: unknown; createdAt: Date; actor: { name: string } | null }) => ({
      id: e.id,
      label: AUDIT_LABELS[e.action] ?? e.action,
      detail: formatDetail(e.after),
      at: e.createdAt,
      actorName: e.actor?.name ?? null,
    }),
  );

  const grouped = groupByDay(entries);

  return (
    <div className="flex flex-col gap-4">
      <AiInsightCard companyId={companyId} />

      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          {entries.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No activity recorded yet.</p>}
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
    </div>
  );
}

function formatDetail(after: unknown): string | null {
  if (!after || typeof after !== "object") return null;
  const obj = after as Record<string, unknown>;
  if (typeof obj.fileName === "string") return obj.fileName;
  if (typeof obj.status === "string") return obj.status;
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
