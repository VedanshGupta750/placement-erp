"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Calendar, Clock, MapPin, X, QrCode, Send, Download, ClipboardList, Award, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EVENT_STATUS_LABEL, EVENT_STATUS_CLASSES, EVENT_CATEGORY_LABEL, type EventStatus } from "@/lib/events/status";
import { EventHeaderActions } from "@/components/events/event-header-actions";
import type { ExistingEventForWizard } from "@/components/events/create-event-wizard";

type IdLabel = { id: string; label: string };
type TabKey = "overview" | "registrations" | "attendance" | "communication" | "schedule" | "feedback" | "files" | "analytics";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "registrations", label: "Registrations" },
  { key: "attendance", label: "Attendance" },
  { key: "communication", label: "Communication" },
  { key: "schedule", label: "Schedule" },
  { key: "feedback", label: "Feedback" },
  { key: "files", label: "Files" },
  { key: "analytics", label: "Analytics" },
];

// The mockup's right-side split panel — list on the left stays mounted,
// this renders alongside it instead of navigating to a separate page. Every
// tab's content is pre-rendered server-side (the exact same self-contained
// tab components the full /events/[id] page uses) and handed in as a
// ReactNode prop; this component's only job is the header + client-side tab
// switching, same "server content, client shell" split already established
// by ConversationSidePanels in the Messages module.
export function EventDetailPanel({
  event,
  closeHref,
  canEdit,
  canPublish,
  batches,
  departments,
  companies,
  drives,
  tabContent,
  existingEventForEdit,
}: {
  event: {
    id: string;
    category: string;
    status: EventStatus;
    title: string;
    startAt: string | null;
    endAt: string | null;
    venue: string | null;
    mode: string;
  };
  closeHref: string;
  canEdit: boolean;
  canPublish: boolean;
  batches: IdLabel[];
  departments: IdLabel[];
  companies: IdLabel[];
  drives: IdLabel[];
  tabContent: Record<TabKey, ReactNode>;
  existingEventForEdit: ExistingEventForWizard;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  async function quickExport() {
    window.open(`/api/events/${event.id}/registrations/export`, "_blank");
  }

  return (
    <aside id="event-details" className="bg-card flex h-fit w-full scroll-mt-4 flex-col gap-4 rounded-xl border p-4 sm:p-5 lg:sticky lg:top-0 lg:max-w-md lg:shrink-0 lg:w-[420px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{EVENT_CATEGORY_LABEL[event.category] ?? event.category}</Badge>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${EVENT_STATUS_CLASSES[event.status]}`}>
            {EVENT_STATUS_LABEL[event.status]}
          </span>
        </div>
        <Link href={closeHref} className="text-muted-foreground hover:text-foreground" aria-label="Close panel">
          <X className="size-4" />
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">{event.title}</h2>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
          {event.startAt && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" /> {new Date(event.startAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {event.startAt && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />{" "}
              {new Date(event.startAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              {event.endAt && ` – ${new Date(event.endAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          )}
          {event.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> {event.venue}
            </span>
          )}
        </div>
      </div>

      <EventHeaderActions
        event={existingEventForEdit}
        batches={batches}
        departments={departments}
        companies={companies}
        drives={drives}
        canEdit={canEdit}
        canPublish={canPublish}
        isCancelled={event.status === "CANCELLED"}
      />

      <div className="flex max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain rounded-lg border p-0.5 [scrollbar-width:thin]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-visible lg:max-h-[calc(100vh-22rem)] lg:overflow-y-auto">{tabContent[activeTab]}</div>

      <div className="border-t pt-4">
        <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Quick Actions</div>
        <div className="grid grid-cols-3 gap-2">
          <QuickAction icon={QrCode} label="QR Check-in" onClick={() => setActiveTab("attendance")} />
          <QuickAction icon={Send} label="Send Reminder" onClick={() => setActiveTab("communication")} />
          <QuickAction icon={Download} label="Export List" onClick={quickExport} />
          <QuickAction icon={ClipboardList} label="Feedback Form" onClick={() => setActiveTab("feedback")} />
          <QuickAction icon={Award} label="Certificate" onClick={() => setActiveTab("files")} />
          <QuickAction icon={ExternalLink} label="Full Page" href={`/events/${event.id}`} />
        </div>
      </div>
    </aside>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
}: {
  icon: typeof QrCode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <Icon className="size-4" />
      <span className="text-center text-[10px] leading-tight">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="hover:bg-accent text-muted-foreground hover:text-foreground flex flex-col items-center gap-1 rounded-lg border p-2.5 transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground h-auto flex-col gap-1 p-2.5"
    >
      {inner}
    </Button>
  );
}
