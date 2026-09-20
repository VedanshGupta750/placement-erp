import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Joining Pending",
  JOINED: "Joined",
  DID_NOT_JOIN: "Did Not Join",
  DEFERRED: "Deferred",
};

const STATUS_CLASSES: Record<string, string> = {
  JOINED: "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  DID_NOT_JOIN: "border-none bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  PENDING: "border-none bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  DEFERRED: "border-none bg-muted text-muted-foreground",
};

export async function JoiningTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const records = await db.joiningRecord.findMany({
    where: { offer: { studentId } },
    include: { offer: { include: { drive: { include: { company: true } }, position: true } } },
    orderBy: { actualJoiningDate: "desc" },
  });

  return (
    <Card>
      <CardContent className="flex flex-col divide-y pt-6">
        {records.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No offer has reached the joining stage yet.</p>}
        {records.map((r: {
          id: string;
          joiningStatus: string;
          actualJoiningDate: Date | null;
          reason: string | null;
          offer: { totalCompensation: unknown; joiningDate: Date | null; drive: { company: { name: string } }; position: { title: string } | null };
        }) => (
          <div key={r.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <div className="text-sm font-medium">{r.offer.drive.company.name}</div>
              <div className="text-muted-foreground text-xs">{r.offer.position?.title ?? "—"}</div>
              {r.offer.joiningDate && (
                <div className="text-muted-foreground text-xs">
                  Expected: {r.offer.joiningDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              )}
              {r.actualJoiningDate && (
                <div className="text-muted-foreground text-xs">
                  Actual: {r.actualJoiningDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              )}
              {r.reason && <div className="text-muted-foreground text-xs">{r.reason}</div>}
            </div>
            <Badge className={STATUS_CLASSES[r.joiningStatus] ?? "border-none bg-muted text-muted-foreground"}>
              {STATUS_LABEL[r.joiningStatus] ?? r.joiningStatus}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
