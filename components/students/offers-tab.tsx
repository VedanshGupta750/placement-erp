import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OffCampusPlacementDialog } from "@/components/students/off-campus-placement-dialog";
import { OffCampusRowActions } from "@/components/students/off-campus-row-actions";

const STATUS_CLASSES: Record<string, string> = {
  ACCEPTED: "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  JOINING_PENDING: "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  JOINED: "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  VERIFIED: "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  DECLINED: "border-none bg-muted text-muted-foreground",
  DID_NOT_JOIN: "border-none bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  REJECTED: "border-none bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  WITHDRAWN: "border-none bg-muted text-muted-foreground",
  ISSUED: "border-none bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  REPORTED: "border-none bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};

const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export async function OffersTab({ studentId, studentName }: { studentId: string; studentName: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [offers, offCampus, canRecord, canEdit] = await Promise.all([
    db.offer.findMany({
      where: { studentId },
      include: { drive: { include: { company: true } }, position: true },
      orderBy: { createdAt: "desc" },
    }),
    db.offCampusPlacement.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } }),
    hasPermission(session, "offer.create"),
    hasPermission(session, "offer.edit"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campus offers ({offers.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {offers.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">No offers from college drives yet.</p>
          )}
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
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{o.drive.company.name}</div>
                <div className="text-muted-foreground text-xs">{o.position?.title ?? o.drive.title} · {o.offerType}</div>
                {o.offerDate && <div className="text-muted-foreground text-xs">Offered {date(o.offerDate)}</div>}
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

      {/* Kept as its own card rather than merged into the list above: these
          came from the student's own effort with no drive, no application and
          no company partnership behind them, and a TPO reading the page needs
          to see which is which at a glance. */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Off-campus placements ({offCampus.length})</CardTitle>
          {canRecord && <OffCampusPlacementDialog studentId={studentId} studentName={studentName} />}
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {offCampus.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nothing recorded. Use the button above when a student lands a job or internship on their own.
            </p>
          )}
          {offCampus.map((p: {
            id: string;
            companyName: string;
            role: string | null;
            placementType: string;
            status: string;
            totalCompensation: unknown;
            stipend: unknown;
            durationMonths: number | null;
            location: string | null;
            offerDate: Date | null;
            joiningDate: Date | null;
            joinedAt: Date | null;
            source: string | null;
            notes: string | null;
          }) => {
            const isInternship = p.placementType === "INTERNSHIP";
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{p.companyName}</span>
                    <Badge variant="outline" className="text-xs">
                      {isInternship ? "Internship" : "Job"}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {[p.role, p.location].filter(Boolean).join(" · ") || "Off-campus"}
                  </div>
                  {p.offerDate && <div className="text-muted-foreground text-xs">Offered {date(p.offerDate)}</div>}
                  {p.source && <div className="text-muted-foreground text-xs">Found via {p.source}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end gap-1">
                    <div className="font-semibold tabular-nums">
                      {isInternship
                        ? p.stipend !== null
                          ? `₹${Number(p.stipend).toLocaleString("en-IN")}/mo${p.durationMonths ? ` · ${p.durationMonths}m` : ""}`
                          : "—"
                        : p.totalCompensation !== null
                          ? `₹${Number(p.totalCompensation).toLocaleString("en-IN")}`
                          : "—"}
                    </div>
                    <Badge className={STATUS_CLASSES[p.status] ?? "border-none bg-muted text-muted-foreground"}>
                      {p.joinedAt ? "Joined" : p.status === "VERIFIED" ? "Verified" : p.status === "REPORTED" ? "Awaiting verification" : "Rejected"}
                    </Badge>
                  </div>
                  {canEdit && (
                    <OffCampusRowActions
                      studentId={studentId}
                      studentName={studentName}
                      joined={Boolean(p.joinedAt)}
                      placement={{
                        id: p.id,
                        companyName: p.companyName,
                        role: p.role,
                        placementType: p.placementType,
                        totalCompensation: p.totalCompensation === null ? null : String(p.totalCompensation),
                        stipend: p.stipend === null ? null : String(p.stipend),
                        durationMonths: p.durationMonths,
                        location: p.location,
                        offerDate: p.offerDate ? p.offerDate.toISOString() : null,
                        joiningDate: p.joiningDate ? p.joiningDate.toISOString() : null,
                        source: p.source,
                        notes: p.notes,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
