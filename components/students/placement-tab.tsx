import { Check } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// A student's placement journey — each stage's "reached" state is derived
// from real rows (never a separately-tracked pipeline stage field, so it
// can't drift from the actual Application/RoundCandidate/Offer/
// JoiningRecord data).
export async function PlacementTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [student, applicationCount, shortlistedCount, roundCount, selectedCount, offer] = await Promise.all([
    db.student.findUniqueOrThrow({ where: { id: studentId } }),
    db.application.count({ where: { studentId } }),
    db.application.count({ where: { studentId, status: { in: ["SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] } } }),
    db.roundCandidate.count({ where: { studentId } }),
    db.application.count({ where: { studentId, status: "SELECTED" } }),
    db.offer.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: { joiningRecord: true },
    }),
  ]);

  const stages = [
    { key: "eligible", label: "Eligible", reached: student.eligibleForPlacements },
    { key: "applied", label: "Applied", reached: applicationCount > 0 },
    { key: "shortlisted", label: "Shortlisted", reached: shortlistedCount > 0 },
    { key: "interview", label: "Interview", reached: roundCount > 0 },
    { key: "selected", label: "Selected", reached: selectedCount > 0 },
    { key: "offer", label: "Offer", reached: !!offer },
    { key: "accepted", label: "Accepted", reached: offer?.status === "ACCEPTED" || offer?.status === "JOINING_PENDING" || offer?.status === "JOINED" },
    { key: "joined", label: "Joined", reached: offer?.joiningRecord?.joiningStatus === "JOINED" },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-0">
          {stages.map((stage, i) => (
            <div key={stage.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    stage.reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {stage.reached ? <Check className="size-3.5" /> : i + 1}
                </div>
                {i < stages.length - 1 && <div className={cn("my-0.5 h-6 w-0.5", stage.reached ? "bg-primary" : "bg-muted")} />}
              </div>
              <div className={cn("pb-6 text-sm font-medium", !stage.reached && "text-muted-foreground")}>{stage.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
