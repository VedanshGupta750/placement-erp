import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_CLASSES: Record<string, string> = {
  ACCEPTED: "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  JOINING_PENDING: "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  JOINED: "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  DECLINED: "border-none bg-muted text-muted-foreground",
  DID_NOT_JOIN: "border-none bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  WITHDRAWN: "border-none bg-muted text-muted-foreground",
  ISSUED: "border-none bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
};

export async function OffersTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const offers = await db.offer.findMany({
    where: { studentId },
    include: { drive: { include: { company: true } }, position: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Card>
      <CardContent className="flex flex-col divide-y pt-6">
        {offers.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No offers yet.</p>}
        {offers.map((o: {
          id: string;
          status: string;
          offerType: string;
          totalCompensation: unknown;
          offerDate: Date | null;
          joiningDate: Date | null;
          drive: { title: string; company: { name: string } };
          position: { title: string } | null;
        }) => (
          <div key={o.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <div className="text-sm font-medium">{o.drive.company.name}</div>
              <div className="text-muted-foreground text-xs">{o.position?.title ?? o.drive.title} · {o.offerType}</div>
              {o.offerDate && <div className="text-muted-foreground text-xs">Offered {o.offerDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="font-semibold tabular-nums">₹{Number(o.totalCompensation).toLocaleString("en-IN")}</div>
              <Badge className={STATUS_CLASSES[o.status] ?? "border-none bg-muted text-muted-foreground"}>
                {o.status === "ACCEPTED" ? "Accepted Offer" : o.status.replaceAll("_", " ")}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
