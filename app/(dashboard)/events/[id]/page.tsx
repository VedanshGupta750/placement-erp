import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, MapPin, Users2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventRegisterButton } from "@/components/events/event-register-button";
import { EventHeaderActions } from "@/components/events/event-header-actions";
import { deriveEventStatus, EVENT_STATUS_LABEL, EVENT_STATUS_CLASSES, EVENT_CATEGORY_LABEL } from "@/lib/events/status";
import { OverviewTab } from "@/components/events/overview-tab";
import { RegistrationsTab } from "@/components/events/registrations-tab";
import { AttendanceTab } from "@/components/events/attendance-tab";
import { ScheduleTab } from "@/components/events/schedule-tab";
import { CommunicationTab } from "@/components/events/communication-tab";
import { FeedbackTab } from "@/components/events/feedback-tab";
import { FilesTab } from "@/components/events/files-tab";
import { AnalyticsTab } from "@/components/events/analytics-tab";

// Event 360 — every tab below is a self-contained async server component
// that takes only `eventId` and fetches its own data (same pattern as
// RequestDetectorCard / LinkDriveDialog in the Messages module). This page
// is only responsible for the header + tab shell; it deliberately does not
// thread event data down into tabs, so each tab can be built and changed
// independently without touching this file.
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [event, me, canEdit, canPublish] = await Promise.all([
    db.event.findUnique({
      where: { id },
      include: {
        registrations: { where: { userId: session.userId } },
        speaker: true,
        company: { select: { name: true } },
        _count: { select: { registrations: true } },
      },
    }),
    db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { userType: true } }),
    hasPermission(session, "event.edit"),
    hasPermission(session, "event.publish"),
  ]);
  if (!event) notFound();

  const status = deriveEventStatus(event);
  const myRegistrationStatus = event.registrations[0]?.status ?? null;
  const isStudent = me.userType === "STUDENT";

  const [batches, departments, companies, drives] = canEdit
    ? await Promise.all([
        db.batch.findMany({ orderBy: { year: "desc" } }),
        db.department.findMany({ orderBy: { name: "asc" } }),
        db.company.findMany({ orderBy: { name: "asc" }, take: 200, select: { id: true, name: true } }),
        db.drive.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true } }),
      ])
    : [[], [], [], []];

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/events" />}>
        <ArrowLeft className="size-3.5" /> Back to events
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{EVENT_CATEGORY_LABEL[event.category]}</Badge>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${EVENT_STATUS_CLASSES[status]}`}>
                  {EVENT_STATUS_LABEL[status]}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{event.title}</h1>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-4 text-sm">
                {event.startAt && (
                  <span className="flex items-center gap-1.5"><Calendar className="size-4" /> {event.startAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                )}
                {event.venue && <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {event.venue}</span>}
                <span className="flex items-center gap-1.5"><Users2 className="size-4" /> {event._count.registrations} registered</span>
              </div>
            </div>
            {isStudent && <EventRegisterButton eventId={event.id} initialStatus={myRegistrationStatus} />}
            {!isStudent && (
              <EventHeaderActions
                event={{
                  id: event.id,
                  category: event.category,
                  title: event.title,
                  description: event.description,
                  organizerLabel: event.organizerLabel,
                  mode: event.mode,
                  venue: event.venue,
                  meetingUrl: event.meetingUrl,
                  startAt: event.startAt ? event.startAt.toISOString() : null,
                  endAt: event.endAt ? event.endAt.toISOString() : null,
                  registrationOpensAt: event.registrationOpensAt ? event.registrationOpensAt.toISOString() : null,
                  registrationClosesAt: event.registrationClosesAt ? event.registrationClosesAt.toISOString() : null,
                  capacity: event.capacity,
                  approvalRequired: event.approvalRequired,
                  eligibleBatchIds: event.eligibleBatchIds,
                  eligibleDepartmentIds: event.eligibleDepartmentIds,
                  speaker: event.speaker
                    ? {
                        id: event.speaker.id,
                        name: event.speaker.name,
                        designation: event.speaker.designation,
                        organization: event.speaker.organization,
                        email: event.speaker.email,
                        bio: event.speaker.bio,
                      }
                    : null,
                  companyId: event.companyId,
                  driveId: event.driveId,
                  certificateEnabled: event.certificateEnabled,
                  feedbackEnabled: event.feedbackEnabled,
                  publishedAt: event.publishedAt ? event.publishedAt.toISOString() : null,
                }}
                batches={batches.map((b: { id: string; year: number }) => ({ id: b.id, label: String(b.year) }))}
                departments={departments.map((d: { id: string; name: string }) => ({ id: d.id, label: d.name }))}
                companies={companies.map((c: { id: string; name: string }) => ({ id: c.id, label: c.name }))}
                drives={drives.map((d: { id: string; title: string }) => ({ id: d.id, label: d.title }))}
                canEdit={canEdit}
                canPublish={canPublish}
                isCancelled={!!event.cancelledAt}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewTab eventId={event.id} /></TabsContent>
        <TabsContent value="registrations" className="mt-4"><RegistrationsTab eventId={event.id} /></TabsContent>
        <TabsContent value="attendance" className="mt-4"><AttendanceTab eventId={event.id} /></TabsContent>
        <TabsContent value="communication" className="mt-4"><CommunicationTab eventId={event.id} /></TabsContent>
        <TabsContent value="schedule" className="mt-4"><ScheduleTab eventId={event.id} /></TabsContent>
        <TabsContent value="feedback" className="mt-4"><FeedbackTab eventId={event.id} /></TabsContent>
        <TabsContent value="files" className="mt-4"><FilesTab eventId={event.id} /></TabsContent>
        <TabsContent value="analytics" className="mt-4"><AnalyticsTab eventId={event.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
