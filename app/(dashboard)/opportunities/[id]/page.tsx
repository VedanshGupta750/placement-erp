import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Calendar, Users } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { computeMatchScore } from "@/lib/matching";
import { ApplyForm } from "@/components/opportunities/apply-form";

const VISIBLE_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SELECTION_ONGOING", "COMPLETED"];
const APPLICABLE_STATUSES = new Set(["PUBLISHED", "REGISTRATION_OPEN"]);

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({
    where: { userId: session.userId },
    include: { skills: { include: { skill: true } } },
  });
  if (!student) notFound();

  const drive = await db.drive.findUnique({
    where: { id },
    include: {
      company: true,
      positions: true,
      eligibleCourses: { include: { course: true } },
      requiredSkills: { include: { skill: true } },
      applicationFields: { orderBy: { order: "asc" } },
    },
  });
  if (!drive) notFound();

  const applications = await db.application.findMany({
    where: { driveId: id, studentId: student.id },
    include: { position: true },
    orderBy: { appliedAt: "desc" },
  });

  const isEligibleCourse = drive.eligibleCourses.some((c) => c.courseId === student.courseId);
  if (!VISIBLE_STATUSES.includes(drive.status) && applications.length === 0) notFound();
  if (!isEligibleCourse && applications.length === 0) notFound();

  const resumes = await db.resume.findMany({
    where: { studentId: student.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  const studentSkillNames = student.skills.map((s) => s.skill.name);
  const requiredSkillNames = drive.requiredSkills.map((s) => s.skill.name);
  const { matchScore, matchedSkills, missingSkills } = computeMatchScore(studentSkillNames, requiredSkillNames);

  const registrationOpen =
    APPLICABLE_STATUSES.has(drive.status) && (!drive.registrationClosesAt || new Date() < drive.registrationClosesAt);
  const canApply =
    registrationOpen && applications.length === 0 && student.eligibleForPlacements && student.hasPlacementAccess;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/opportunities" />}>
          <ArrowLeft className="size-3.5" /> Back to opportunities
</Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{drive.title}</h1>
            <StatusBadge status={drive.status} />
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Building2 className="size-3.5" /> {drive.company.name}
            {drive.company.industryType ? ` · ${drive.company.industryType}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Openings" value={drive.expectedOpenings ?? "-"} color="blue" />
        <StatCard
          icon={Calendar}
          label="Registration closes"
          value={drive.registrationClosesAt ? new Date(drive.registrationClosesAt).toLocaleDateString("en-IN") : "-"}
          color="amber"
        />
        <StatCard
          icon={Users}
          label="Skill match"
          value={matchScore !== null ? `${matchScore}%` : "N/A"}
          sublabel={requiredSkillNames.length > 0 ? `${matchedSkills.length}/${requiredSkillNames.length} skills` : "no skills required"}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Positions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {drive.positions.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {p.positionType.replaceAll("_", " ")} · {p.employmentType.replaceAll("_", " ")}
                    {p.openings ? ` · ${p.openings} opening${p.openings === 1 ? "" : "s"}` : ""}
                  </div>
                </div>
                <div className="text-right text-sm font-medium tabular-nums">
                  {p.minCtc ? `₹${(Number(p.minCtc) / 100000).toFixed(1)}L` : ""}
                  {p.maxCtc ? ` – ₹${(Number(p.maxCtc) / 100000).toFixed(1)}L` : ""}
                  {p.stipend ? ` · ₹${Number(p.stipend).toLocaleString("en-IN")}/mo` : ""}
                  {!p.minCtc && !p.maxCtc && !p.stipend && "-"}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eligible courses</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {drive.eligibleCourses.map((c) => (
              <Badge key={c.courseId} variant="outline">{c.course.specialization ?? c.course.name}</Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {drive.eligibilityCriteria && (
              <div>
                <div className="text-muted-foreground mb-1">Eligibility criteria</div>
                <p>{drive.eligibilityCriteria}</p>
              </div>
            )}
            {drive.selectionProcessDetails && (
              <div>
                <div className="text-muted-foreground mb-1">Selection process</div>
                <p>{drive.selectionProcessDetails}</p>
              </div>
            )}
            {drive.requiredSkills.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">Required skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {drive.requiredSkills.map((s) => (
                    <Badge key={s.skillId} variant={matchedSkills.includes(s.skill.name) ? "default" : "outline"}>
                      {s.skill.name}
                    </Badge>
                  ))}
                </div>
                {missingSkills.length > 0 && (
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    You&apos;re missing: {missingSkills.join(", ")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{applications.length > 0 ? "Your application" : "Apply"}</CardTitle>
          </CardHeader>
          <CardContent>
            {applications.length > 0 ? (
              <div className="flex flex-col gap-3">
                {applications.map((a) => (
                  <div key={a.id} className="flex flex-col gap-1 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{a.position.title}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <span className="text-muted-foreground text-xs">Applied {new Date(a.appliedAt).toLocaleDateString("en-IN")}</span>
                    {a.matchScore !== null && <span className="text-muted-foreground text-xs">{a.matchScore}% skill match</span>}
                  </div>
                ))}
              </div>
            ) : canApply ? (
              <ApplyForm
                driveId={drive.id}
                positions={drive.positions.map((p) => ({ id: p.id, title: p.title, positionType: p.positionType }))}
                resumes={resumes.map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault }))}
                matchScore={matchScore}
                extraFields={drive.applicationFields.map((f) => ({ id: f.id, label: f.label, fieldType: f.fieldType, required: f.required }))}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {!student.eligibleForPlacements || !student.hasPlacementAccess
                  ? "You aren't currently eligible to apply for placements."
                  : "Registrations for this drive aren't open right now."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
