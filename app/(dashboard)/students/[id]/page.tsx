import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/students/overview-tab";
import { AcademicTab } from "@/components/students/academic-tab";
import { EligibilityTab } from "@/components/students/eligibility-tab";
import { PlacementTab } from "@/components/students/placement-tab";
import { ApplicationsTab } from "@/components/students/applications-tab";
import { InterviewsTab } from "@/components/students/interviews-tab";
import { OffersTab } from "@/components/students/offers-tab";
import { JoiningTab } from "@/components/students/joining-tab";
import { DocumentsTab } from "@/components/students/documents-tab";
import { SkillsResumeTab } from "@/components/students/skills-resume-tab";
import { CommunicationTab } from "@/components/students/communication-tab";
import { NotesTab } from "@/components/students/notes-tab";
import { ActivityTab } from "@/components/students/activity-tab";
import { StudentHeaderActions } from "@/components/students/student-header-actions";
import { getStudentScopeWhere } from "@/lib/students/scope";

// Student 360 — same architecture as the Event 360 page: every tab below is
// a self-contained async server component taking only `{studentId}` and
// fetching its own data, so each can be built/changed independently without
// touching this shared shell.
const STUDENT_TABS = [
  "overview", "academic", "eligibility", "placement", "applications", "interviews",
  "offers", "joining", "documents", "skills", "communication", "notes", "activity",
] as const;

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  // Lets a notification link straight to the tab it is about — an academic
  // change request pointed at the Overview tab was effectively invisible.
  const { tab } = await searchParams;
  const initialTab = STUDENT_TABS.includes(tab as (typeof STUDENT_TABS)[number]) ? tab! : "overview";
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // Students have no student.view grant — this page is the TPO-facing
  // Student 360, entirely separate from a student's own /profile. Without
  // this gate any logged-in student could open any other student's full
  // profile (CGPA, backlogs, internal notes, documents).
  const canView = await hasPermission(session, "student.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this profile.</CardContent>
      </Card>
    );
  }

  const canViewSensitive = await hasPermission(session, "student.view_sensitive");

  const scopeWhere = await getStudentScopeWhere(db, session);
  const student = await db.student.findFirst({
    where: { id, ...scopeWhere },
    include: { user: true, course: true, batch: true, department: true },
  });
  if (!student) notFound();

  const [canEdit, canMessage, canAddToDrive, activeDrives, pendingAcademicRequests] = await Promise.all([
    hasPermission(session, "student.edit"),
    hasPermission(session, "message.send"),
    hasPermission(session, "application.approve"),
    db.drive.findMany({
      where: { status: { in: ["PUBLISHED", "REGISTRATION_OPEN"] } },
      include: { company: { select: { name: true } }, positions: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    // Surfaced on the tab itself: a request sitting inside the Academic tab
    // is invisible from the tab strip, which is exactly how the first one
    // went unnoticed.
    db.academicChangeRequest.count({ where: { studentId: id, status: "PENDING" } }),
  ]);

  const initials = student.user.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/students" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-3.5" /> Back to students
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="ring-border size-16 ring-1">
            <AvatarFallback className="bg-accent text-accent-foreground text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{student.user.name}</h1>
              <Badge variant={student.eligibleForPlacements ? "default" : "outline"} className="border-none">
                {student.eligibleForPlacements ? "Eligible" : "Not Eligible"}
              </Badge>
              <Badge variant={student.placementStatus === "PLACED" ? "default" : "outline"} className="border-none">
                {student.placementStatus === "PLACED" ? "Placed" : "Not Placed"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {student.course.specialization ?? student.course.name} · Batch {student.batch.year} · {student.enrollmentNumber}
              {student.department && ` · ${student.department.name}`}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3.5" /> {student.user.email}
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
        <StudentHeaderActions
          studentId={student.id}
          recipientUserId={student.userId}
          canEdit={canEdit}
          canMessage={canMessage}
          canAddToDrive={canAddToDrive}
          accountStatus={student.user.status}
          initial={{
            placementStatus: student.placementStatus,
            eligibleForPlacements: student.eligibleForPlacements,
            interestedInJobs: student.interestedInJobs,
            interestedInInternships: student.interestedInInternships,
          }}
          drives={activeDrives.map((d: { id: string; title: string; company: { name: string }; positions: { id: string; title: string }[] }) => ({
            id: d.id,
            title: d.title,
            companyName: d.company.name,
            positions: d.positions,
          }))}
        />
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="academic">
            Academic
            {pendingAcademicRequests > 0 && (
              <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {pendingAcademicRequests > 9 ? "9+" : pendingAcademicRequests}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="placement">Placement</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="joining">Joining</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="skills">Skills & Resume</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewTab studentId={student.id} /></TabsContent>
        <TabsContent value="academic" className="mt-4"><AcademicTab studentId={student.id} canViewSensitive={canViewSensitive} /></TabsContent>
        <TabsContent value="eligibility" className="mt-4"><EligibilityTab studentId={student.id} /></TabsContent>
        <TabsContent value="placement" className="mt-4"><PlacementTab studentId={student.id} /></TabsContent>
        <TabsContent value="applications" className="mt-4"><ApplicationsTab studentId={student.id} /></TabsContent>
        <TabsContent value="interviews" className="mt-4"><InterviewsTab studentId={student.id} /></TabsContent>
        <TabsContent value="offers" className="mt-4"><OffersTab studentId={student.id} /></TabsContent>
        <TabsContent value="joining" className="mt-4"><JoiningTab studentId={student.id} /></TabsContent>
        <TabsContent value="documents" className="mt-4"><DocumentsTab studentId={student.id} /></TabsContent>
        <TabsContent value="skills" className="mt-4"><SkillsResumeTab studentId={student.id} /></TabsContent>
        <TabsContent value="communication" className="mt-4"><CommunicationTab studentId={student.id} userId={student.userId} /></TabsContent>
        <TabsContent value="notes" className="mt-4"><NotesTab studentId={student.id} /></TabsContent>
        <TabsContent value="activity" className="mt-4"><ActivityTab studentId={student.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
