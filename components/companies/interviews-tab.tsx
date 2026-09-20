import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { getCompanyFunnel } from "@/lib/companies/stats";

export async function InterviewsTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [funnel, rounds] = await Promise.all([
    getCompanyFunnel(db, companyId),
    db.roundCandidate.findMany({
      where: { application: { drive: { companyId } } },
      include: {
        student: { include: { user: true } },
        application: { include: { drive: { select: { title: true } }, position: { select: { title: true } } } },
        round: { select: { name: true, roundType: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Interview Funnel (All Time)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { label: "Applications", value: funnel.applications },
              { label: "Shortlisted", value: funnel.shortlisted },
              { label: "Interviews", value: funnel.interviewed },
              { label: "Selected", value: funnel.selected },
              { label: "Offers", value: funnel.offers },
              { label: "Joined", value: funnel.joined },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-muted-foreground text-xs">{s.label}</div>
                <div className="text-xl font-bold tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 border-t pt-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Offer Rate</div>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">{funnel.offerRate}%</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Joining Rate</div>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">{funnel.joiningRate}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Interviews</CardTitle></CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No interviews scheduled yet for this company&apos;s drives.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Drive / Position</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled At</TableHead>
                  <TableHead>Interviewer</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.map((rc: {
                  id: string;
                  status: string;
                  scheduledAt: Date | null;
                  interviewerName: string | null;
                  score: number | null;
                  studentId: string;
                  student: { user: { name: string } };
                  application: { drive: { title: string }; position: { title: string } | null };
                  round: { name: string; roundType: string };
                }) => (
                  <TableRow key={rc.id}>
                    <TableCell>
                      <Link href={`/students/${rc.studentId}`} className="text-primary hover:underline">
                        {rc.student.user.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>{rc.application.drive.title}</div>
                      {rc.application.position && <div className="text-muted-foreground text-xs">{rc.application.position.title}</div>}
                    </TableCell>
                    <TableCell>
                      <div>{rc.round.name}</div>
                      <div className="text-muted-foreground text-xs">{rc.round.roundType}</div>
                    </TableCell>
                    <TableCell><StatusBadge status={rc.status} /></TableCell>
                    <TableCell className="tabular-nums">
                      {rc.scheduledAt ? new Date(rc.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                    </TableCell>
                    <TableCell>{rc.interviewerName ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{rc.score ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
