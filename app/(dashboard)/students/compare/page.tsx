import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/lib/rbac/guard";
import { PLACED_OFFER_STATUSES, effectivePlacementStatus, PLACEMENT_STATUS_LABELS } from "@/lib/students/placement";

// Select 2-5 students via ?ids=a,b,c and see a side-by-side metric table —
// a stretch beyond a single profile view, useful for shortlisting/ranking
// decisions. Metrics are all cheap counts, no new derived state introduced.
export default async function CompareStudentsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // student.view isn't held by Student — this page had no gate at all
  // before this fix, found by the same low-priv-role sweep as
  // drives/page.tsx: a student could pass any classmates' ids via ?ids=
  // and see their academic records side by side.
  const canView = await hasPermission(session, "student.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this page.</CardContent>
      </Card>
    );
  }

  const studentIds = (ids ?? "").split(",").filter(Boolean).slice(0, 5);

  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    include: {
      user: true,
      course: true,
      _count: { select: { applications: true, offers: true, roundCandidacies: true } },
      // Placing offers only — the Placement Status row below is derived
      // from these, not from the stale Student.placementStatus column.
      offers: { where: { status: { in: [...PLACED_OFFER_STATUSES] } }, select: { id: true }, take: 1 },
    },
  });
  // Preserve the order ids were passed in, not DB order.
  const ordered = studentIds.map((id) => students.find((s: { id: string }) => s.id === id)).filter(Boolean) as typeof students;

  const rows: { label: string; values: (string | number)[] }[] = [
    { label: "Course", values: ordered.map((s) => s.course.specialization ?? s.course.name) },
    { label: "CGPA", values: ordered.map((s) => s.aggregate ?? "—") },
    { label: "Active Backlogs", values: ordered.map((s) => s.liveBacklogs) },
    { label: "Applications", values: ordered.map((s) => s._count.applications) },
    { label: "Interview Rounds", values: ordered.map((s) => s._count.roundCandidacies) },
    { label: "Offers", values: ordered.map((s) => s._count.offers) },
    { label: "Placement Status", values: ordered.map((s) => PLACEMENT_STATUS_LABELS[effectivePlacementStatus(s.placementStatus, s.offers.length > 0)]) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/students" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-3.5" /> Back to students
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare Students</h1>
        <p className="text-muted-foreground text-sm">Side-by-side comparison of {ordered.length} student{ordered.length === 1 ? "" : "s"}.</p>
      </div>

      {ordered.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No students selected. Go back to the list, select 2-5 students, then use Compare.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  {ordered.map((s) => (
                    <TableHead key={s.id}>
                      <Link href={`/students/${s.id}`} className="hover:underline">{s.user.name}</Link>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.label}>
                    <TableCell className="text-muted-foreground font-medium">{r.label}</TableCell>
                    {r.values.map((v, i) => <TableCell key={i} className="tabular-nums">{v}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
