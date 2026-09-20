import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, FileCheck2 } from "lucide-react";
import { requireCompanySession } from "@/lib/auth/company-session";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { CandidatesPanel } from "@/components/employer/candidates-panel";

export default async function EmployerDriveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCompanySession();

  const drive = await prisma.drive.findUnique({
    where: { id },
    include: {
      college: true,
      positions: true,
      requiredSkills: { include: { skill: true } },
      applications: {
        include: {
          student: {
            select: {
              enrollmentNumber: true,
              course: true,
              aggregate: true,
              aggregateType: true,
              user: { select: { name: true, email: true, phone: true } },
              skills: { select: { skill: { select: { name: true } } } },
            },
          },
          resume: { select: { name: true, file: { select: { dataUrl: true, originalName: true } } } },
          roundCandidacies: {
            select: {
              status: true,
              mode: true,
              scheduledAt: true,
              venue: true,
              meetingUrl: true,
              score: true,
              resultPublishedAt: true,
              round: { select: { name: true, roundType: true, sequenceNo: true } },
            },
            orderBy: { round: { sequenceNo: "asc" } },
          },
          offer: {
            select: {
              status: true,
              totalCompensation: true,
              offerDate: true,
              joiningDate: true,
              joiningRecord: { select: { joiningStatus: true } },
            },
          },
        },
        orderBy: { matchScore: "desc" },
      },
      _count: { select: { offers: true } },
    },
  });
  if (!drive || drive.companyId !== session.companyId) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/employer/dashboard" />}>
        <ArrowLeft className="size-3.5" /> Back to dashboard
      </Button>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{drive.title}</h1>
          <StatusBadge status={drive.status} />
        </div>
        <p className="text-muted-foreground text-sm">{drive.college.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={Users} label="Applicants" value={drive.applications.length} color="blue" />
        <StatCard icon={FileCheck2} label="Offers made" value={drive._count.offers} color="emerald" />
      </div>

      {drive.requiredSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {drive.requiredSkills.map((s) => (
            <Badge key={s.skillId} variant="outline">{s.skill.name}</Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Candidates</CardTitle></CardHeader>
        <CardContent>
          <CandidatesPanel
            applications={drive.applications.map((a) => ({
              id: a.id,
              status: a.status,
              matchScore: a.matchScore,
              matchedSkills: a.matchedSkills,
              student: {
                enrollmentNumber: a.student.enrollmentNumber,
                course: a.student.course,
                aggregate: a.student.aggregate,
                aggregateType: a.student.aggregateType,
                user: a.student.user,
                skills: a.student.skills.map((s) => s.skill.name),
              },
              resume: a.resume
                ? { name: a.resume.name, originalName: a.resume.file?.originalName ?? null, dataUrl: a.resume.file?.dataUrl ?? null }
                : null,
              rounds: a.roundCandidacies.map((rc) => ({
                roundName: rc.round.name,
                roundType: rc.round.roundType,
                status: rc.status,
                mode: rc.mode,
                scheduledAt: rc.scheduledAt?.toISOString() ?? null,
                venue: rc.venue,
                meetingUrl: rc.meetingUrl,
                score: rc.score,
                resultPublished: rc.resultPublishedAt !== null,
              })),
              offer: a.offer
                ? {
                    status: a.offer.status,
                    totalCompensation: Number(a.offer.totalCompensation),
                    offerDate: a.offer.offerDate?.toISOString() ?? null,
                    joiningDate: a.offer.joiningDate?.toISOString() ?? null,
                    joiningStatus: a.offer.joiningRecord?.joiningStatus ?? null,
                  }
                : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
