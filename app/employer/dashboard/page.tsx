import Link from "next/link";
import { GraduationCap, Users, FileCheck2 } from "lucide-react";
import { requireCompanySession } from "@/lib/auth/company-session";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function EmployerDashboardPage() {
  const session = await requireCompanySession();

  const partnerships = await prisma.collegePartnership.findMany({
    where: { companyId: session.companyId },
    include: { college: true },
  });

  const drives = await prisma.drive.findMany({
    where: { companyId: session.companyId },
    include: { college: true, _count: { select: { applications: true, offers: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalApplicants = drives.reduce((s, d) => s + d._count.applications, 0);
  const totalOffers = drives.reduce((s, d) => s + d._count.offers, 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recruiter dashboard</h1>
        <p className="text-muted-foreground text-sm">Your open requisitions across partnered colleges.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={GraduationCap} label="Partnered colleges" value={partnerships.length} color="blue" />
        <StatCard icon={Users} label="Total applicants" value={totalApplicants} color="violet" />
        <StatCard icon={FileCheck2} label="Offers made" value={totalOffers} color="emerald" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your drives</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {drives.map((d) => (
            <Link key={d.id} href={`/employer/drives/${d.id}`} className="hover:bg-accent/40 -mx-2 flex items-center justify-between rounded-md px-2 py-3 transition-colors">
              <div>
                <div className="font-medium">{d.title}</div>
                <div className="text-muted-foreground text-xs">{d.college.name}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{d._count.applications} applicants</Badge>
                <StatusBadge status={d.status} />
              </div>
            </Link>
          ))}
          {drives.length === 0 && <p className="text-muted-foreground py-8 text-center text-sm">No drives yet — a placement cell will add you once your first drive is created.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
