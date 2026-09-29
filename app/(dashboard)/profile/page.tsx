import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { ExperienceManager } from "@/components/profile/experience-manager";
import { ProjectManager } from "@/components/profile/project-manager";
import { CertificationManager } from "@/components/profile/certification-manager";
import { ParseResumeDialog } from "@/components/profile/parse-resume-dialog";
import { StaffProfileHeader } from "@/components/profile/staff-profile-header";
import { StaffProfileTabs } from "@/components/profile/staff-profile-tabs";
import { EditStaffProfileDialog } from "@/components/profile/edit-staff-profile-dialog";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { AcademicChangeRequestPanel } from "@/components/profile/academic-change-request-panel";
import { PLACED_OFFER_STATUSES, effectivePlacementStatus, PLACEMENT_STATUS_LABELS } from "@/lib/students/placement";

export default async function ProfilePage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true, coverImageUrl: true, linkedinUrl: true, userType: true, role: { select: { name: true } }, college: { select: { name: true } } },
  });

  if (user.userType !== "STUDENT") {
    const myPosts = await db.event.findMany({ where: { createdById: session.userId }, orderBy: { createdAt: "desc" }, take: 20 });

    const roleLabel = user.role?.name ?? user.userType.replaceAll("_", " ");

    return (
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground mb-4 flex w-fit items-center gap-1.5 text-sm">
            <ArrowLeft className="size-3.5" /> Back to Dashboard
          </Link>
          <StaffProfileHeader
            name={user.name}
            avatarUrl={user.avatarUrl}
            coverImageUrl={user.coverImageUrl}
            roleLabel={roleLabel}
            collegeName={user.college.name}
          />
          <StaffProfileTabs
            careerJourney={[{ roleLabel, collegeName: user.college.name }]}
            email={user.email}
            phone={user.phone}
            linkedinUrl={user.linkedinUrl}
            posts={myPosts.map((p) => ({ id: p.id, title: p.title, description: p.description, createdAt: p.createdAt.toISOString() }))}
          />
        </div>
        <div className="flex flex-col gap-3 lg:mt-11">
          <EditStaffProfileDialog name={user.name} phone={user.phone} linkedinUrl={user.linkedinUrl} avatarUrl={user.avatarUrl} coverImageUrl={user.coverImageUrl} />
          <ChangePasswordDialog />
        </div>
      </div>
    );
  }

  const student = await db.student.findUnique({
    where: { userId: session.userId },
    include: {
      user: true,
      course: true,
      batch: true,
      skills: { include: { skill: true } },
      experiences: { orderBy: { startDate: "desc" } },
      projects: { orderBy: { createdAt: "desc" } },
      certifications: { orderBy: { issueDate: "desc" } },
      // Placing offers only — the student's own "Placement status" row is
      // derived from these, never from the stale column.
      offers: { where: { status: { in: [...PLACED_OFFER_STATUSES] } }, select: { id: true }, take: 1 },
      // The student's own correction requests — raising one never changes
      // the record above, so both are shown together for the contrast.
      academicChangeRequests: {
        orderBy: { createdAt: "desc" },
        include: { reviewedBy: { select: { name: true } } },
      },
    },
  });
  const [eventRegistrations, eventAttendances, eventCertificates] = await Promise.all([
    db.eventRegistration.findMany({
      where: { userId: session.userId },
      include: { event: { select: { id: true, title: true, startAt: true } } },
      orderBy: { registeredAt: "desc" },
    }),
    db.eventAttendance.findMany({ where: { userId: session.userId } }),
    db.eventCertificate.findMany({ where: { userId: session.userId } }),
  ]);
  const attendanceByEventId = new Map(eventAttendances.map((a) => [a.eventId, a]));
  const certificateByEventId = new Map(eventCertificates.map((c) => [c.eventId, c]));
  const eventsParticipated = eventRegistrations
    .slice()
    .sort((a, b) => {
      const aTime = a.event.startAt?.getTime() ?? a.registeredAt.getTime();
      const bTime = b.event.startAt?.getTime() ?? b.registeredAt.getTime();
      return bTime - aTime;
    });

  if (!student) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">No student profile is linked to your account yet.</p>
      </div>
    );
  }

  const initials = student.user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-w-0 flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <Avatar className="ring-border size-16 ring-1">
          <AvatarFallback className="bg-accent text-accent-foreground text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{student.user.name}</h1>
          <p className="text-muted-foreground text-sm">
            {student.course.specialization ?? student.course.name} · Batch {student.batch.year} · {student.enrollmentNumber}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">
              <Mail className="size-3.5 shrink-0" /> <span className="truncate">{student.user.email}</span>
            </span>
            {student.user.phone && (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Phone className="size-3.5" /> {student.user.phone}
              </span>
            )}
            {student.user.linkedinUrl && (
              <a href={student.user.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1.5 hover:underline">
                <ExternalLink className="size-3.5" /> LinkedIn
              </a>
            )}
          </div>
        </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row [&>button]:w-full sm:[&>button]:w-auto">
          <ParseResumeDialog />
          {/* Students had no way to change their own password: the dialog was
              mounted only in the staff branch above, even though
              /api/profile/change-password has always accepted any session. */}
          <ChangePasswordDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Academics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Aggregate</div>
              <div className="font-medium">{student.aggregate ?? "-"} {student.aggregateType}</div>
            </div>
            <div>
              <div className="text-muted-foreground">10th</div>
              <div className="font-medium">{student.tenthScore ?? "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">12th</div>
              <div className="font-medium">{student.twelfthScore ?? "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Live backlogs</div>
              <div className="font-medium">{student.liveBacklogs}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Dead backlogs</div>
              <div className="font-medium">{student.closedBacklogs}</div>
            </div>
            <div className="col-span-2 border-t pt-3">
              <AcademicChangeRequestPanel
                requests={student.academicChangeRequests.map((r) => ({
                  id: r.id,
                  field: r.field,
                  currentValue: r.currentValue,
                  requestedValue: r.requestedValue,
                  reason: r.reason,
                  status: r.status,
                  reviewNote: r.reviewNote,
                  reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
                  reviewedByName: r.reviewedBy?.name ?? null,
                  createdAt: r.createdAt.toISOString(),
                }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Placement policy</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {[
              ["Eligible for placements", student.eligibleForPlacements],
              ["Interested in jobs", student.interestedInJobs],
              ["Interested in internships", student.interestedInInternships],
              ["Placement status", PLACEMENT_STATUS_LABELS[effectivePlacementStatus(student.placementStatus, student.offers.length > 0)]],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between">
                <span className="text-muted-foreground">{label}</span>
                {typeof value === "boolean" ? (
                  <Badge variant={value ? "default" : "outline"} className="border-none">{value ? "Yes" : "No"}</Badge>
                ) : (
                  <Badge variant="outline">{value as string}</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {student.skills.map((s) => (
              <Badge key={s.skillId} variant="outline">{s.skill.name}</Badge>
            ))}
            {student.skills.length === 0 && <p className="text-muted-foreground text-sm">No skills added.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileEditForm
            summary={student.summary ?? ""}
            expertise={student.expertise}
            areasOfInterest={student.areasOfInterest}
            values={student.values}
            languagesSpeaking={student.languagesSpeaking}
            languagesProgramming={student.languagesProgramming}
            awards={Array.isArray(student.awardsJson) ? (student.awardsJson as string[]) : []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Experience</CardTitle>
        </CardHeader>
        <CardContent>
          <ExperienceManager
            items={student.experiences.map((e) => ({
              id: e.id,
              organisation: e.organisation,
              role: e.role,
              experienceType: e.experienceType,
              startDate: e.startDate ? e.startDate.toISOString() : null,
              endDate: e.endDate ? e.endDate.toISOString() : null,
              description: e.description,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectManager
            items={student.projects.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              techStack: p.techStack,
              url: p.url,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certifications</CardTitle>
        </CardHeader>
        <CardContent>
          <CertificationManager
            items={student.certifications.map((c) => ({
              id: c.id,
              name: c.name,
              issuer: c.issuer,
              issueDate: c.issueDate ? c.issueDate.toISOString() : null,
              credentialUrl: c.credentialUrl,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Events Participated</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {eventsParticipated.length === 0 && (
            <p className="text-muted-foreground py-4 text-sm">No event registrations yet.</p>
          )}
          {eventsParticipated.map((reg) => {
            const attendance = attendanceByEventId.get(reg.eventId);
            const certificate = certificateByEventId.get(reg.eventId);
            const attendanceLabel = attendance?.checkInAt ? "Present" : attendance ? "Absent" : "Not yet marked";
            return (
              <div key={reg.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="font-medium">{reg.event.title}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {reg.event.startAt
                      ? reg.event.startAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "Date TBA"}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant={attendanceLabel === "Present" ? "default" : "outline"} className="border-none">
                    {attendanceLabel}
                  </Badge>
                  {certificate ? (
                    <Link href={`/events/${reg.eventId}/certificates/${session.userId}`} className="text-primary flex items-center gap-1 font-medium hover:underline">
                      View <ExternalLink className="size-3.5" />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
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
