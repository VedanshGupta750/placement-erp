"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EVENT_CATEGORY_LABEL } from "@/lib/events/status";
import { EventCard } from "@/components/events/event-card";
import { SpeakerPicker, type EventSpeakerLite } from "@/components/events/speaker-picker";

type IdLabel = { id: string; label: string };

export type ExistingEventForWizard = {
  id: string;
  category: string;
  title: string;
  description: string;
  organizerLabel: string | null;
  mode: string;
  venue: string | null;
  meetingUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  capacity: number | null;
  approvalRequired: boolean;
  eligibleBatchIds: string[];
  eligibleDepartmentIds: string[];
  speaker: EventSpeakerLite | null;
  companyId: string | null;
  driveId: string | null;
  certificateEnabled: boolean;
  feedbackEnabled: boolean;
  publishedAt: string | null;
};

const STEPS = [
  { key: "basics", label: "Basics" },
  { key: "schedule", label: "Schedule" },
  { key: "venue", label: "Venue" },
  { key: "audience", label: "Audience & Eligibility" },
  { key: "registration", label: "Registration" },
  { key: "speaker", label: "Speaker & Links" },
  { key: "review", label: "Review" },
] as const;

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

type Conflict = { id: string; title: string; startAt: string | null; endAt: string | null; reason: "venue" | "speaker" };

// The Create/Edit Event wizard — a single client component with internal
// step state (deliberately not routed steps, per the build spec). Handles
// both create (POST /api/events) and edit (PATCH /api/events/[id]) by
// accepting an optional `existingEvent` prop. Renders its own trigger
// button by default; pass `open`/`onOpenChange` to drive it externally
// instead (e.g. a future "Edit" button on the event detail page).
export function CreateEventWizard({
  batches,
  departments,
  companies,
  drives,
  existingEvent,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
}: {
  batches: IdLabel[];
  departments: IdLabel[];
  companies: IdLabel[];
  drives: IdLabel[];
  existingEvent?: ExistingEventForWizard | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const isEdit = !!existingEvent;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState(existingEvent?.category ?? "EXPERT_SESSION");
  const [title, setTitle] = useState(existingEvent?.title ?? "");
  const [description, setDescription] = useState(existingEvent?.description ?? "");
  const [organizerLabel, setOrganizerLabel] = useState(existingEvent?.organizerLabel ?? "");

  const [startAt, setStartAt] = useState(toDatetimeLocalValue(existingEvent?.startAt));
  const [endAt, setEndAt] = useState(toDatetimeLocalValue(existingEvent?.endAt));
  const [registrationOpensAt, setRegistrationOpensAt] = useState(toDatetimeLocalValue(existingEvent?.registrationOpensAt));
  const [registrationClosesAt, setRegistrationClosesAt] = useState(toDatetimeLocalValue(existingEvent?.registrationClosesAt));

  const [mode, setMode] = useState(existingEvent?.mode ?? "OFFLINE");
  const [venue, setVenue] = useState(existingEvent?.venue ?? "");
  const [meetingUrl, setMeetingUrl] = useState(existingEvent?.meetingUrl ?? "");

  const [eligibleBatchIds, setEligibleBatchIds] = useState<string[]>(existingEvent?.eligibleBatchIds ?? []);
  const [eligibleDepartmentIds, setEligibleDepartmentIds] = useState<string[]>(existingEvent?.eligibleDepartmentIds ?? []);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [eligibleCountLoading, setEligibleCountLoading] = useState(false);

  const [capacity, setCapacity] = useState(existingEvent?.capacity != null ? String(existingEvent.capacity) : "");
  const [approvalRequired, setApprovalRequired] = useState(existingEvent?.approvalRequired ?? false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(existingEvent?.feedbackEnabled ?? true);
  const [certificateEnabled, setCertificateEnabled] = useState(existingEvent?.certificateEnabled ?? false);

  const [speaker, setSpeaker] = useState<EventSpeakerLite | null>(existingEvent?.speaker ?? null);
  const [companyId, setCompanyId] = useState(existingEvent?.companyId ?? "");
  const [driveId, setDriveId] = useState(existingEvent?.driveId ?? "");

  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  function resetForm() {
    setStepIndex(0);
    setCategory("EXPERT_SESSION");
    setTitle("");
    setDescription("");
    setOrganizerLabel("");
    setStartAt("");
    setEndAt("");
    setRegistrationOpensAt("");
    setRegistrationClosesAt("");
    setMode("OFFLINE");
    setVenue("");
    setMeetingUrl("");
    setEligibleBatchIds([]);
    setEligibleDepartmentIds([]);
    setEligibleCount(null);
    setCapacity("");
    setApprovalRequired(false);
    setFeedbackEnabled(true);
    setCertificateEnabled(false);
    setSpeaker(null);
    setCompanyId("");
    setDriveId("");
    setConflicts([]);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && !isEdit) resetForm();
  }

  // Live eligible-student count, recomputed whenever batch/department scope
  // changes on the Audience step.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setEligibleCountLoading(true);
      try {
        const res = await fetch("/api/events/eligible-count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eligibleBatchIds, eligibleDepartmentIds }),
        });
        if (res.ok) setEligibleCount((await res.json()).count);
      } finally {
        setEligibleCountLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, eligibleBatchIds, eligibleDepartmentIds]);

  // Non-blocking schedule-conflict check, recomputed whenever the
  // time/venue/speaker inputs change — surfaced as a warning banner on the
  // Schedule step.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      if (!startAt) {
        setConflicts([]);
        return;
      }
      const startIso = fromDatetimeLocalValue(startAt);
      const endIso = fromDatetimeLocalValue(endAt) ?? startIso;
      if (!startIso || !endIso) {
        setConflicts([]);
        return;
      }
      const res = await fetch("/api/events/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: startIso,
          endAt: endIso,
          venue: venue || undefined,
          speakerId: speaker?.id || undefined,
          excludeEventId: existingEvent?.id,
        }),
      });
      if (res.ok) setConflicts((await res.json()).conflicts ?? []);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startAt, endAt, venue, speaker?.id]);

  const basicsValid = category && title.trim().length >= 3 && description.trim().length > 0;

  const previewEvent = useMemo(
    () => ({
      category,
      title,
      description,
      organizerLabel,
      mode,
      venue,
      startAt: fromDatetimeLocalValue(startAt) ?? null,
      endAt: fromDatetimeLocalValue(endAt) ?? null,
      registrationOpensAt: fromDatetimeLocalValue(registrationOpensAt) ?? null,
      registrationClosesAt: fromDatetimeLocalValue(registrationClosesAt) ?? null,
      publishedAt: existingEvent?.publishedAt ?? new Date().toISOString(),
      cancelledAt: null,
      speakerName: speaker?.name ?? null,
      registrationCount: 0,
    }),
    [category, title, description, organizerLabel, mode, venue, startAt, endAt, registrationOpensAt, registrationClosesAt, speaker, existingEvent],
  );

  function toggleId(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function buildPayload(publish: boolean) {
    return {
      category,
      title: title.trim(),
      description: description.trim(),
      organizerLabel: organizerLabel.trim() || undefined,
      mode,
      venue: venue.trim() || undefined,
      meetingUrl: meetingUrl.trim() || undefined,
      startAt: fromDatetimeLocalValue(startAt),
      endAt: fromDatetimeLocalValue(endAt),
      registrationOpensAt: fromDatetimeLocalValue(registrationOpensAt),
      registrationClosesAt: fromDatetimeLocalValue(registrationClosesAt),
      capacity: capacity.trim() ? Number(capacity) : undefined,
      approvalRequired,
      eligibleBatchIds,
      eligibleDepartmentIds,
      speakerId: speaker?.id,
      companyId: companyId || undefined,
      driveId: driveId || undefined,
      certificateEnabled,
      feedbackEnabled,
      publish,
    };
  }

  async function handleSave(publish: boolean) {
    if (!basicsValid) {
      toast.error("Fill in the Basics step first — category, title and description are required.");
      setStepIndex(0);
      return;
    }
    setSaving(true);
    try {
      if (isEdit && existingEvent) {
        const payload = buildPayload(publish);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { publish: _publish, ...fields } = payload;
        const res = await fetch(`/api/events/${existingEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        if (!res.ok) {
          toast.error("Couldn't save changes.");
          return;
        }
        if (publish && !existingEvent.publishedAt) {
          const publishRes = await fetch(`/api/events/${existingEvent.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "publish" }),
          });
          if (!publishRes.ok) {
            toast.error("Saved, but publishing failed.");
            return;
          }
        }
        toast.success(publish ? "Event published." : "Changes saved.");
        handleOpenChange(false);
        router.push(`/events/${existingEvent.id}`);
        router.refresh();
      } else {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(publish)),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error("Couldn't create event.");
          return;
        }
        toast.success(publish ? "Event published." : "Draft saved.");
        handleOpenChange(false);
        router.push(`/events/${data.id}`);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger render={<Button size="sm" variant={isEdit ? "outline" : "default"} />}>
          {isEdit ? (
            <>
              <Pencil className="size-4" /> Edit Event
            </>
          ) : (
            <>
              <Plus className="size-4" /> Create Event
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit event" : "Create event"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex shrink-0 gap-1 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible">
            {STEPS.map((s, i) => (
              <button
                type="button"
                key={s.key}
                onClick={() => setStepIndex(i)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-left text-sm whitespace-nowrap transition-colors",
                  i === stepIndex ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {stepIndex === 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVENT_CATEGORY_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="organizerLabel">Organizer</Label>
                  <Input id="organizerLabel" placeholder="e.g. Placement Cell, CDPC" value={organizerLabel} onChange={(e) => setOrganizerLabel(e.target.value)} />
                </div>
              </div>
            )}

            {stepIndex === 1 && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="startAt">Starts</Label>
                    <Input id="startAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="endAt">Ends</Label>
                    <Input id="endAt" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="registrationOpensAt">Registration opens</Label>
                    <Input id="registrationOpensAt" type="datetime-local" value={registrationOpensAt} onChange={(e) => setRegistrationOpensAt(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="registrationClosesAt">Registration closes</Label>
                    <Input id="registrationClosesAt" type="datetime-local" value={registrationClosesAt} onChange={(e) => setRegistrationClosesAt(e.target.value)} />
                  </div>
                </div>
                {conflicts.length > 0 && (
                  <div className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 flex flex-col gap-1 rounded-md border p-3 text-sm">
                    {conflicts.map((c) => (
                      <div key={`${c.id}-${c.reason}`} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Schedule conflict detected — <strong>{c.title}</strong> uses the same {c.reason === "venue" ? "venue" : "speaker"} at an
                          overlapping time
                          {c.startAt ? ` (${new Date(c.startAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })})` : ""}.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {stepIndex === 2 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Mode</Label>
                  <Select value={mode} onValueChange={(v) => v && setMode(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OFFLINE">Offline</SelectItem>
                      <SelectItem value="ONLINE">Online</SelectItem>
                      <SelectItem value="HYBRID">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {mode !== "ONLINE" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="venue">Venue</Label>
                    <Input id="venue" placeholder="e.g. Main Auditorium" value={venue} onChange={(e) => setVenue(e.target.value)} />
                  </div>
                )}
                {mode !== "OFFLINE" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="meetingUrl">Meeting URL</Label>
                    <Input id="meetingUrl" placeholder="https://…" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {stepIndex === 3 && (
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="mb-2 block">Eligible batches</Label>
                  <p className="text-muted-foreground mb-2 text-xs">Leave all unchecked to allow every batch.</p>
                  <div className="flex flex-wrap gap-2">
                    {batches.map((b) => (
                      <label key={b.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
                        <Checkbox checked={eligibleBatchIds.includes(b.id)} onCheckedChange={() => toggleId(eligibleBatchIds, setEligibleBatchIds, b.id)} />
                        {b.label}
                      </label>
                    ))}
                    {batches.length === 0 && <p className="text-muted-foreground text-sm">No batches found.</p>}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Eligible departments</Label>
                  <p className="text-muted-foreground mb-2 text-xs">Leave all unchecked to allow every department.</p>
                  <div className="flex flex-wrap gap-2">
                    {departments.map((d) => (
                      <label key={d.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
                        <Checkbox checked={eligibleDepartmentIds.includes(d.id)} onCheckedChange={() => toggleId(eligibleDepartmentIds, setEligibleDepartmentIds, d.id)} />
                        {d.label}
                      </label>
                    ))}
                    {departments.length === 0 && <p className="text-muted-foreground text-sm">No departments found.</p>}
                  </div>
                </div>
                <div className="bg-muted rounded-md px-3 py-2 text-sm font-medium">
                  {eligibleCountLoading ? "Calculating…" : `${eligibleCount ?? 0} students eligible`}
                </div>
              </div>
            )}

            {stepIndex === 4 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input id="capacity" type="number" min={1} placeholder="Leave blank for unlimited" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={approvalRequired} onCheckedChange={(v) => setApprovalRequired(v === true)} />
                  Require approval for registrations
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={feedbackEnabled} onCheckedChange={(v) => setFeedbackEnabled(v === true)} />
                  Collect feedback after the event
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={certificateEnabled} onCheckedChange={(v) => setCertificateEnabled(v === true)} />
                  Issue certificates to attendees
                </label>
              </div>
            )}

            {stepIndex === 5 && (
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="mb-2 block">Speaker</Label>
                  <SpeakerPicker value={speaker} onChange={setSpeaker} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Related company (optional)</Label>
                    <Select value={companyId || undefined} onValueChange={(v) => setCompanyId(v ?? "")}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Related drive (optional)</Label>
                    <Select value={driveId || undefined} onValueChange={(v) => setDriveId(v ?? "")}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        {drives.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {stepIndex === 6 && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-muted-foreground">Category</div>
                  <div>{EVENT_CATEGORY_LABEL[category] ?? category}</div>
                  <div className="text-muted-foreground">Title</div>
                  <div className="truncate">{title || "—"}</div>
                  <div className="text-muted-foreground">Mode</div>
                  <div>{mode}</div>
                  <div className="text-muted-foreground">Venue</div>
                  <div>{mode === "ONLINE" ? meetingUrl || "—" : venue || "—"}</div>
                  <div className="text-muted-foreground">Starts</div>
                  <div>{startAt ? new Date(startAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</div>
                  <div className="text-muted-foreground">Capacity</div>
                  <div>{capacity || "Unlimited"}</div>
                  <div className="text-muted-foreground">Approval required</div>
                  <div>{approvalRequired ? "Yes" : "No"}</div>
                  <div className="text-muted-foreground">Eligible students</div>
                  <div>{eligibleCountLoading ? "…" : (eligibleCount ?? 0)}</div>
                  <div className="text-muted-foreground">Speaker</div>
                  <div>{speaker?.name ?? "—"}</div>
                </div>
                <div>
                  <Label className="mb-2 block">Student view preview</Label>
                  <EventCard event={previewEvent} />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="ghost" />}>Close</DialogClose>
          {stepIndex > 0 && (
            <Button type="button" variant="outline" onClick={() => setStepIndex((i) => i - 1)}>
              Back
            </Button>
          )}
          {stepIndex < STEPS.length - 1 && (
            <Button type="button" onClick={() => setStepIndex((i) => i + 1)} disabled={stepIndex === 0 && !basicsValid}>
              Next
            </Button>
          )}
          {stepIndex === STEPS.length - 1 && (
            <>
              <Button type="button" variant="outline" disabled={saving} onClick={() => handleSave(false)}>
                {saving ? "Saving…" : "Save Draft"}
              </Button>
              <Button type="button" disabled={saving} onClick={() => handleSave(true)}>
                {saving ? "Publishing…" : "Publish"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
