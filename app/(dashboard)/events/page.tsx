import Link from "next/link";
import { CalendarDays, List } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { deriveEventStatus, type EventStatus } from "@/lib/events/status";
import { EventSummaryCards } from "@/components/events/event-summary-cards";
import { EventFiltersBar } from "@/components/events/event-filters-bar";
import { EventCard } from "@/components/events/event-card";
import { EventCalendarView } from "@/components/events/event-calendar-view";
import { CreateEventWizard } from "@/components/events/create-event-wizard";
import { EventDetailPanel } from "@/components/events/event-detail-panel";
import { OverviewTab } from "@/components/events/overview-tab";
import { RegistrationsTab } from "@/components/events/registrations-tab";
import { AttendanceTab } from "@/components/events/attendance-tab";
import { ScheduleTab } from "@/components/events/schedule-tab";
import { CommunicationTab } from "@/components/events/communication-tab";
import { FeedbackTab } from "@/components/events/feedback-tab";
import { FilesTab } from "@/components/events/files-tab";
import { AnalyticsTab } from "@/components/events/analytics-tab";

type SearchParams = {
  q?: string;
  category?: string;
  status?: string;
  department?: string;
  batch?: string;
  mode?: string;
  organizer?: string;
  dateFrom?: string;
  dateTo?: string;
  tab?: string;
  view?: string;
  selected?: string;
};

const TABS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "drafts", label: "Drafts" },
];

const UPCOMING_STATUSES: EventStatus[] = ["SCHEDULED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"];

// The "Placement Events & Engagement Center" home — replaces the old bare
// Post/PostRegistration feed. Real-DB summary stats, a live-count tab row,
// a search + filters row, and a List/Calendar view toggle over the same
// filtered event set.
export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const canCreate = await hasPermission(session, "event.create");

  const where: Record<string, unknown> = {};
  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.category) where.category = params.category;
  if (params.mode) where.mode = params.mode;
  if (params.organizer) where.organizerLabel = { contains: params.organizer, mode: "insensitive" };
  if (params.department) where.eligibleDepartmentIds = { has: params.department };
  if (params.batch) where.eligibleBatchIds = { has: params.batch };

  const [rawEvents, batches, departments, companies, drives] = await Promise.all([
    db.event.findMany({
      where,
      include: { speaker: { select: { name: true } }, _count: { select: { registrations: true } } },
      orderBy: { startAt: "asc" },
    }),
    db.batch.findMany({ orderBy: { year: "desc" } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.company.findMany({ orderBy: { name: "asc" }, take: 200, select: { id: true, name: true } }),
    db.drive.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true } }),
  ]);

  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
  const dateTo = params.dateTo ? new Date(params.dateTo) : null;

  let events = rawEvents.map((e) => ({ ...e, status: deriveEventStatus(e) }));

  if (params.status) events = events.filter((e) => e.status === params.status);
  if (dateFrom) events = events.filter((e) => e.startAt && e.startAt >= dateFrom);
  if (dateTo) events = events.filter((e) => e.startAt && e.startAt <= dateTo);

  const tabCounts = {
    all: events.length,
    upcoming: events.filter((e) => UPCOMING_STATUSES.includes(e.status)).length,
    live: events.filter((e) => e.status === "LIVE").length,
    completed: events.filter((e) => e.status === "COMPLETED").length,
    drafts: events.filter((e) => e.publishedAt === null).length,
  };

  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "all";
  const visibleEvents = events.filter((e) => {
    switch (activeTab) {
      case "upcoming":
        return UPCOMING_STATUSES.includes(e.status);
      case "live":
        return e.status === "LIVE";
      case "completed":
        return e.status === "COMPLETED";
      case "drafts":
        return e.publishedAt === null;
      default:
        return true;
    }
  });

  const view = params.view === "calendar" ? "calendar" : "list";

  const [selectedEvent, canEdit, canPublish] = params.selected
    ? await Promise.all([
        db.event.findUnique({
          where: { id: params.selected },
          include: { speaker: true, _count: { select: { registrations: true } } },
        }),
        hasPermission(session, "event.edit"),
        hasPermission(session, "event.publish"),
      ])
    : [null, false, false];

  function hrefWith(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/events?${qs}` : "/events";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events & Engagement</h1>
          <p className="text-muted-foreground text-sm">Create, manage and track placement events, expert sessions and competitions.</p>
        </div>
        {canCreate && (
          <CreateEventWizard
            batches={batches.map((b) => ({ id: b.id, label: String(b.year) }))}
            departments={departments.map((d) => ({ id: d.id, label: d.name }))}
            companies={companies.map((c) => ({ id: c.id, label: c.name }))}
            drives={drives.map((d) => ({ id: d.id, label: d.title }))}
          />
        )}
      </div>

      <EventSummaryCards collegeId={session.collegeId} />

      <div className="-mx-4 flex items-center gap-1 overflow-x-auto border-b px-4 pb-1 overscroll-x-contain [scrollbar-width:thin] sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={hrefWith({ tab: t.key === "all" ? undefined : t.key })}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[11px] tabular-nums">
              {tabCounts[t.key as keyof typeof tabCounts]}
            </span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full min-w-0 sm:flex-1">
              <EventFiltersBar
                departments={departments.map((d) => ({ id: d.id, label: d.name }))}
                batches={batches.map((b) => ({ id: b.id, label: String(b.year) }))}
              />
            </div>
            <div className="flex w-fit max-w-full items-center gap-1 self-start overflow-x-auto rounded-lg border p-0.5 [scrollbar-width:thin] sm:shrink-0">
              <Link
                href={hrefWith({ view: undefined })}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="size-3.5" /> List View
              </Link>
              <Link
                href={hrefWith({ view: "calendar" })}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  view === "calendar" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="size-3.5" /> Calendar View
              </Link>
            </div>
          </div>

          {view === "calendar" ? (
            <EventCalendarView
              events={events
                .filter((e) => e.startAt)
                .map((e) => ({ id: e.id, title: e.title, category: e.category, startAt: e.startAt!.toISOString() }))}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {visibleEvents.map((e) => (
                <EventCard
                  key={e.id}
                  href={`${hrefWith({ selected: e.id })}#event-details`}
                  selected={params.selected === e.id}
                  event={{
                    id: e.id,
                    category: e.category,
                    title: e.title,
                    description: e.description,
                    organizerLabel: e.organizerLabel,
                    mode: e.mode,
                    venue: e.venue,
                    startAt: e.startAt,
                    endAt: e.endAt,
                    registrationOpensAt: e.registrationOpensAt,
                    registrationClosesAt: e.registrationClosesAt,
                    publishedAt: e.publishedAt,
                    cancelledAt: e.cancelledAt,
                    speakerName: e.speaker?.name ?? null,
                    registrationCount: e._count.registrations,
                  }}
                />
              ))}
              {visibleEvents.length === 0 && (
                <Card>
                  <CardContent className="text-muted-foreground py-10 text-center text-sm">No events match these filters.</CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {selectedEvent && (
          <EventDetailPanel
            event={{
              id: selectedEvent.id,
              category: selectedEvent.category,
              status: deriveEventStatus(selectedEvent),
              title: selectedEvent.title,
              startAt: selectedEvent.startAt ? selectedEvent.startAt.toISOString() : null,
              endAt: selectedEvent.endAt ? selectedEvent.endAt.toISOString() : null,
              venue: selectedEvent.venue,
              mode: selectedEvent.mode,
            }}
            closeHref={hrefWith({ selected: undefined })}
            canEdit={canEdit}
            canPublish={canPublish}
            batches={batches.map((b) => ({ id: b.id, label: String(b.year) }))}
            departments={departments.map((d) => ({ id: d.id, label: d.name }))}
            companies={companies.map((c) => ({ id: c.id, label: c.name }))}
            drives={drives.map((d) => ({ id: d.id, label: d.title }))}
            existingEventForEdit={{
              id: selectedEvent.id,
              category: selectedEvent.category,
              title: selectedEvent.title,
              description: selectedEvent.description,
              organizerLabel: selectedEvent.organizerLabel,
              mode: selectedEvent.mode,
              venue: selectedEvent.venue,
              meetingUrl: selectedEvent.meetingUrl,
              startAt: selectedEvent.startAt ? selectedEvent.startAt.toISOString() : null,
              endAt: selectedEvent.endAt ? selectedEvent.endAt.toISOString() : null,
              registrationOpensAt: selectedEvent.registrationOpensAt ? selectedEvent.registrationOpensAt.toISOString() : null,
              registrationClosesAt: selectedEvent.registrationClosesAt ? selectedEvent.registrationClosesAt.toISOString() : null,
              capacity: selectedEvent.capacity,
              approvalRequired: selectedEvent.approvalRequired,
              eligibleBatchIds: selectedEvent.eligibleBatchIds,
              eligibleDepartmentIds: selectedEvent.eligibleDepartmentIds,
              speaker: selectedEvent.speaker
                ? {
                    id: selectedEvent.speaker.id,
                    name: selectedEvent.speaker.name,
                    designation: selectedEvent.speaker.designation,
                    organization: selectedEvent.speaker.organization,
                    email: selectedEvent.speaker.email,
                    bio: selectedEvent.speaker.bio,
                  }
                : null,
              companyId: selectedEvent.companyId,
              driveId: selectedEvent.driveId,
              certificateEnabled: selectedEvent.certificateEnabled,
              feedbackEnabled: selectedEvent.feedbackEnabled,
              publishedAt: selectedEvent.publishedAt ? selectedEvent.publishedAt.toISOString() : null,
            }}
            tabContent={{
              overview: <OverviewTab eventId={selectedEvent.id} />,
              registrations: <RegistrationsTab eventId={selectedEvent.id} />,
              attendance: <AttendanceTab eventId={selectedEvent.id} />,
              communication: <CommunicationTab eventId={selectedEvent.id} />,
              schedule: <ScheduleTab eventId={selectedEvent.id} />,
              feedback: <FeedbackTab eventId={selectedEvent.id} />,
              files: <FilesTab eventId={selectedEvent.id} />,
              analytics: <AnalyticsTab eventId={selectedEvent.id} />,
            }}
          />
        )}
      </div>
    </div>
  );
}
